import { Camera, Keyboard, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createContextFromNote, shortContextRef } from "@/lib/context/note";
import { useSpeechRecognition } from "@/lib/context/use-speech";

/**
 * CardInputBar — แถบอินพุตของ prototype (กล้อง / ไมค์ / คีย์บอร์ด)
 *
 * ตาม Guide: ไมค์ส้มเป็นปุ่มหลักกลางแถบ, กล้อง+คีย์บอร์ดเป็นปุ่มรอง
 * การบันทึกใช้เส้นทางเดียวกับ production (createContextFromNote → store จริง)
 */
export function CardInputBar({
  onCaptured,
  onKeyboard,
}: {
  /** เรียกหลังบันทึกสำเร็จ (ได้ context id) — ไว้ให้ demo เดิน step ถัดไป */
  onCaptured?: (contextId: string) => void;
  /** เปิด input แบบพิมพ์ (โชว์ textarea ใน demo) */
  onKeyboard?: () => void;
}) {
  const { state: speech, supported, start, stop, reset } = useSpeechRecognition();

  const commit = (value: string, origin: "text" | "voice") => {
    const text = value.trim();
    if (!text) return;
    const context = createContextFromNote({ text, origin });
    if (!context) return;
    toast.success(`บันทึกบริบทแล้ว ${shortContextRef(context.id)}`);
    reset();
    onCaptured?.(context.id);
  };

  const handleMic = () => {
    if (!supported) {
      toast.error("เบราว์เซอร์นี้ยังไม่รองรับการถอดเสียง ลองใช้ Chrome หรือ Edge");
      return;
    }
    if (speech.status === "listening") {
      stop();
    } else if (speech.status === "transcribing") {
      return;
    } else {
      start();
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {speech.status === "done" && speech.transcript ? (
        <div className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center">
          <p className="text-xs text-muted">ถอดเสียงแล้ว — ตรวจก่อนบันทึก</p>
          <p className="mt-1 font-hand text-xl text-hero-ink">{speech.transcript}</p>
          <div className="mt-2 flex justify-center gap-2">
            <button
              type="button"
              className="min-h-11 rounded-full bg-hero-accent px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              onClick={() => commit(speech.transcript, "voice")}
            >
              ใช้ข้อความนี้
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full border border-border px-5 text-sm text-muted transition-colors hover:bg-surface-2"
              onClick={reset}
            >
              ล้าง
            </button>
          </div>
        </div>
      ) : null}

      {speech.status === "listening" ? (
        <p className="font-hand text-lg text-hero-ink/70" role="status" aria-live="polite">
          กำลังฟัง… พูดได้เลย
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="ถ่ายรูปใบเสร็จ (เร็ว ๆ นี้)"
          className="flex size-14 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition-colors hover:bg-surface-2"
          onClick={() => toast.info("กล้องจะมาใน step ถัดไปของ prototype")}
        >
          <Camera className="size-5" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          aria-label={
            speech.status === "listening" ? "หยุดฟังเสียง" : "เริ่มฟังเสียง"
          }
          aria-pressed={speech.status === "listening"}
          onClick={handleMic}
          className={cn(
            "flex size-20 items-center justify-center rounded-full text-white shadow-[0_8px_24px_-6px_rgba(232,89,12,0.55)] transition-transform",
            speech.status === "listening" ? "scale-105 bg-danger" : "bg-hero-accent hover:scale-[1.03]",
          )}
        >
          {speech.status === "listening" ? (
            <Square className="size-8" />
          ) : (
            <Mic className="size-9" strokeWidth={1.75} />
          )}
        </button>

        <button
          type="button"
          aria-label="พิมพ์บันทึก"
          className="flex size-14 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition-colors hover:bg-surface-2"
          onClick={() => onKeyboard?.()}
        >
          <Keyboard className="size-5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
