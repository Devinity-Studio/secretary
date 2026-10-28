import { Camera, Keyboard, Mic, MicOff, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ContextHeroCard } from "@/components/prototype/context-hero-card";
import { UpcomingStrip } from "@/components/upcoming-strip";
import { ReceiptCameraModal } from "@/components/receipt-camera";
import { cn } from "@/lib/utils";
import { createContextFromNote, createContextFromReceipt, shortContextRef } from "@/lib/context/note";
import { speakSecretaryReply } from "@/lib/context/tts";
import { rmsFromTimeDomain, smoothLevel } from "@/lib/context/mic-meter";
import { useSpeechRecognition } from "@/lib/context/use-speech";
import { useContextStore } from "@/lib/context/store";
import type { Evidence, SecretaryContext } from "@/lib/context/types";

/**
 * VoiceHome — Home หลักแบบ voice-first วางตามสรีระผู้ใช้ (Context Card UX Guide)
 *
 * โครงหน้าจอ (มือถือ):
 *   1. การ์ดฮีโร่ = บริบทล่าสุดที่จับไว้ (พิมพ์หรือเสียง) มีป้ายเวลา + แถบใบเสร็จ Related
 *   2. บรรทัดช่วยเหลือ + แถบหลักฐาน (ตำ, ไทย)
 *   3. แถบภาพจับทั้งหมด (live) — ไมค์ส้มใหญ่ อยู่กึ่งล่าง = โซนนิ้วโป้ง
 *      ปุ่มไมค์มี mic-level (ไล่เฉดตามความดังเสียงจริงจาก Web Audio)
 *   4. ปุ่มรอง: กล้อง (รูปใบเสร็จ/เอกสาร) + คีย์บอร์ด (พิมพ์)
 */
export function VoiceHome({
  contextsRecord,
  evidenceById,
  onRelatedClick,
}: {
  contextsRecord: Record<string, SecretaryContext>;
  evidenceById: Record<string, Evidence>;
  onRelatedClick?: (relatedContextId: string) => void;
}) {
  const { state: speech, supported, start, stop, reset } = useSpeechRecognition();
  const [micLevel, setMicLevel] = useState(0);
  const [typingOpen, setTypingOpen] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  // ══ mic level meter (Web Audio) ══
  // เปิดสตรีมไมค์แยกจาก Web Speech — อ่านความดังจริงไปไล่เฉดสีปุ่ม
  // ตามที่ผู้ใช้ขอ: "ปุ่มไมค์เป็น mic level ไล่เฉดขึ้นลงตาม level"
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const smoothRef = useRef(0);
  const [micError, setMicError] = useState<string | null>(null);

  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
    }
    smoothRef.current = 0;
    setMicLevel(0);
  }, []);

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      // fftSize 512 → buffer 256 samples ~ ฟลุกตัวเชิญเวลาพอดี ๆ ที่ 60fps
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        frameRef.current += 1;
        // อ่านไม่เกิน ~20fps กัน React re-render ถุกไป
        if (frameRef.current % 3 === 0) {
          // คำนวณ RMS → ระดับ 0..1 จากตัวช่วย pure (ทดสอบแยกได้)
          const level = rmsFromTimeDomain(buffer);
          smoothRef.current = smoothLevel(smoothRef.current, level, 0.25);
          setMicLevel(smoothRef.current);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setMicError("ไม่สามารถเปิดไมโครโฟนเพื่อแสดงระดับเสียงได้");
    }
  }, []);

  // เปิด/ปิด meter ตามสถานะฟัง
  useEffect(() => {
    if (speech.status === "listening") {
      void startMeter();
    } else {
      stopMeter();
    }
    return stopMeter;
  }, [speech.status, startMeter, stopMeter]);

  // cleanup สุดท้าย
  useEffect(() => stopMeter, [stopMeter]);

  const latest = useMemo(
    () =>
      Object.values(contextsRecord)
        .filter((c) => !c.archived)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    [contextsRecord],
  );

  const listening = speech.status === "listening";

  function commit(value: string, origin: "text" | "voice") {
    const text = value.trim();
    if (!text) return;
    const context = createContextFromNote({ text, origin });
    if (!context) return;
    toast.success(`บันทึกบริบทแล้ว ${shortContextRef(context.id)}`, {
      description: origin === "voice" ? "แหล่งที่มา: เสียง" : "แหล่งที่มา: พิมพ์",
    });
    // เสียงเลขาตอบกลับ — พูดยืนยัน + อ่านทวนสิ่งที่จับได้ (เช่น "เรียบร้อยแล้วค่ะบอส")
    speakSecretaryReply(context.id, text);
    reset();
  }

  const handleMic = () => {
    if (!supported) {
      toast.error("เบราว์เซอร์นี้ยังไม่รองรับการถอดเสียง ลองใช้ Chrome หรือ Edge");
      return;
    }
    if (listening) {
      stop();
    } else if (speech.status === "transcribing") {
      return;
    } else {
      start();
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* ══ 1. การ์ดฮีโร่ ══ */}
      {latest ? (
        <ContextHeroCard
          key={latest.id}
          context={latest}
          evidenceById={evidenceById}
          onRelatedClick={onRelatedClick}
        />
      ) : (
        <section
          className="hero-enter overflow-hidden rounded-xl border border-hero-accent/20 shadow-[0_10px_30px_-12px_rgba(38,32,28,0.25)]"
          style={{
            backgroundImage:
              "linear-gradient(180deg, var(--color-hero-top) 0%, var(--color-hero-bottom) 100%)",
          }}
        >
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <img
              src="/secretary-logo.png"
              alt="คุณเลขา"
              className="h-16 w-16 rounded-full object-cover shadow-md"
            />
            <p className="mt-4 font-hand text-3xl leading-snug text-hero-ink">
              สวัสดีค่ะ บอกอะไรฉันให้จำได้ไหม?
            </p>
            <p className="mt-2 max-w-sm text-sm text-hero-ink/60">
              เล่าผ่านไมค์ด้านล่าง หรือพิมพ์ได้ — ฉันจะจำให้พร้อมทุกเรื่อง
            </p>
          </div>
        </section>
      )}

      {/* ══ 2. เหตุการณ์ใกล้เวลานี้ (จากปฏิทิน) ══ */}
      <UpcomingStrip />

      {/* ══ 3. บรรทัดช่วยเหลือ ══ */}
      <p className="text-center text-xs text-muted">
        แตะไมค์เล่าเรื่องเลย — ปุ่มจะเรืองแสงตามเสียงพูด
      </p>

      {/* ══ 4. transcript ระหว่างฟัง/หลังถอด ══ */}
      {speech.status !== "idle" ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            speech.status === "error"
              ? "border-expense/30 bg-expense/5 text-expense"
              : "border-border bg-surface",
          )}
          role="status"
          aria-live="polite"
        >
          {speech.status === "listening" && !speech.transcript ? (
            <p className="text-muted">กำลังฟัง… พูดได้เลย แตะไมค์อีกครั้งเพื่อหยุด</p>
          ) : speech.error ? (
            <p>{speech.error}</p>
          ) : speech.transcript ? (
            <p className="font-hand text-lg leading-relaxed text-hero-ink">
              {speech.transcript}
            </p>
          ) : null}
        </div>
      ) : null}

      {speech.status === "done" && speech.transcript ? (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            className="min-h-11 rounded-full bg-hero-accent px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
            onClick={() => commit(speech.transcript, "voice")}
          >
            บันทึกสิ่งนี้
          </button>
          <button
            type="button"
            className="min-h-11 rounded-full border border-border px-6 text-sm text-muted transition-colors hover:bg-surface-2"
            onClick={reset}
          >
            แก้ไข
          </button>
        </div>
      ) : null}

      {/* ══ 5. แผงพิมพ์ (เปิดจากปุ่มคีย์บอร์ด) — inline ไม่ใช้ window.prompt ══ */}
      {typingOpen ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && typedText.trim()) {
                commit(typedText, "text");
                setTypedText("");
                setTypingOpen(false);
              }
            }}
            placeholder="พิมพ์บริบทที่จะให้เลขาจำ…"
            aria-label="ช่องพิมพ์บริบท"
            className="h-11 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-full bg-hero-accent px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            onClick={() => {
              if (typedText.trim()) {
                commit(typedText, "text");
                setTypedText("");
                setTypingOpen(false);
              }
            }}
          >
            บันทึก
          </button>
        </div>
      ) : null}

      {/* ══ 6. แถบ capture — ชิดขอบล่างเหนือแท็บ (โซนนิ้วโป้ง one-hand) ══ */}
      <div className="mt-auto flex flex-col items-center gap-3 pb-1">
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="ถ่ายรูปใบเสร็จ/เอกสาร"
            className="flex size-14 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition-colors hover:bg-surface-2"
            onClick={() => setCameraOpen(true)}
          >
            <Camera className="size-5" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            aria-label={listening ? "หยุดฟังเสียง" : "เริ่มฟังเสียง"}
            aria-pressed={listening}
            onClick={handleMic}
            className={cn(
              "relative flex size-24 items-center justify-center overflow-hidden rounded-full text-white transition-transform",
              listening ? "scale-105" : "hover:scale-[1.03]",
            )}
            style={
              listening
                ? {
                    // ไล่เฉดตาม level: level 0 = ส้มอ่อน → level 1 = ส้มเข้มเต็มปุ่ม
                    backgroundImage: `linear-gradient(0deg, var(--color-hero-accent) ${micLevel * 100}%, color-mix(in srgb, var(--color-hero-accent) 34%, transparent) ${micLevel * 100}%)`,
                    boxShadow: `0 8px 28px -6px color-mix(in srgb, var(--color-hero-accent) ${45 + micLevel * 35}%, transparent)`,
                  }
                : {
                    backgroundColor: "var(--color-hero-accent)",
                    boxShadow: "0 8px 24px -6px rgba(232,89,12,0.55)",
                  }
            }
          >
            {listening ? <Square className="size-8" /> : supported ? (
              <Mic className="size-10" strokeWidth={1.75} />
            ) : (
              <MicOff className="size-9" strokeWidth={1.75} />
            )}
          </button>

          <button
            type="button"
            aria-label="พิมพ์บันทึก"
            aria-expanded={typingOpen}
            className={cn(
              "flex size-14 items-center justify-center rounded-full border shadow-sm transition-colors",
              typingOpen
                ? "border-hero-accent/40 bg-hero-accent/10 text-hero-accent"
                : "border-border bg-surface text-muted hover:bg-surface-2",
            )}
            onClick={() => setTypingOpen((v) => !v)}
          >
            <Keyboard className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        {micError ? <p className="text-xs text-expense">{micError}</p> : null}
        {!supported ? (
          <p className="text-xs text-subtle">
            ถอดเสียงใช้ได้บน Chrome / Edge — ยังพิมพ์บันทึกได้ปกติ
          </p>
        ) : null}
      </div>

      {/* ══ กล้องถ่ายใบเสร็จ — แนบรูปเป็น Evidence ══ */}
      <ReceiptCameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCaptured={(dataUrl, origin) => {
          const context = createContextFromReceipt(dataUrl, origin);
          toast.success(`แนบใบเสร็จเป็นหลักฐานแล้ว ${shortContextRef(context.id)}`);
          speakSecretaryReply(context.id, "แนบใบเสร็จให้แล้วค่ะ");
        }}
      />
    </div>
  );
}
