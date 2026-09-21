import { useCallback, useMemo, useState } from "react";
import { Mic, MicOff, Square, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SOURCE_TYPE_LABELS } from "@/lib/context/types";
import { createContextFromNote, shortContextRef } from "@/lib/context/note";
import { SPEECH_STATUS_LABELS } from "@/lib/context/speech";
import { useSpeechRecognition } from "@/lib/context/use-speech";

type MicStatus = "idle" | "listening" | "transcribing" | "done" | "error";

const MIC_HINTS: Record<MicStatus, string> = {
  idle: "แตะไมค์เพื่อพูดบันทึก",
  listening: "กำลังฟัง… พูดได้เลย แตะอีกครั้งเพื่อหยุด",
  transcribing: "กำลังถอดเสียง…",
  done: "ถอดเสียงแล้ว ตรวจข้อความแล้วบันทึกได้",
  error: "ลองแตะไมค์อีกครั้ง หรือพิมพ์แทน",
};

export function ContextInput() {
  const [text, setText] = useState("");
  const { state: speech, supported, start, stop, reset } = useSpeechRecognition();

  const busy = speech.status === "listening" || speech.status === "transcribing";
  const canSubmit = useMemo(() => text.trim().length > 0, [text]);

  const commit = useCallback(
    (origin: "text" | "voice", rawValue?: string) => {
      const value = (rawValue ?? text).trim();
      if (!value) return;

      const context = createContextFromNote({ text: value, origin });
      if (!context) return;

      toast.success(`บันทึกบริบทแล้ว ${shortContextRef(context.id)}`, {
        description:
          origin === "voice"
            ? `แหล่งที่มา: ${SOURCE_TYPE_LABELS.voice}`
            : `แหล่งที่มา: ${SOURCE_TYPE_LABELS.user}`,
      });

      setText("");
      reset();
    },
    [text, reset],
  );

  const handleMic = useCallback(() => {
    if (!supported) {
      toast.error("เบราว์เซอร์นี้ยังไม่รองรับการถอดเสียง ลองใช้ Chrome หรือ Edge");
      return;
    }
    if (speech.status === "listening") {
      stop();
    } else if (speech.status === "transcribing") {
      // รอผลถอดเสียง — ไม่ทำอะไร
      return;
    } else {
      setText("");
      start();
    }
  }, [supported, speech.status, start, stop]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_0_rgba(28,25,23,0.04)] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          บริบท
        </p>
        {speech.status !== "idle" ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs",
              speech.status === "listening" && "bg-accent/10 text-accent",
              speech.status === "transcribing" && "bg-surface-2 text-muted",
              speech.status === "done" && "bg-surface-2 text-muted",
              speech.status === "error" && "bg-expense/10 text-expense",
            )}
            role="status"
            aria-live="polite"
          >
            {SPEECH_STATUS_LABELS[speech.status]}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        พิมพ์หรือพูดเล่าสิ่งที่อยากให้เลขาจำ — เช่น "พรุ่งนี้เอาเอกสารไปส่งที่ธนาคาร"
      </p>

      <div className="mt-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit && !busy) commit("text");
          }}
          placeholder="พิมพ์บริบท…"
          aria-label="ช่องพิมพ์บริบท"
          disabled={speech.status === "listening"}
        />
        <Button
          type="button"
          variant={speech.status === "listening" ? "danger" : "secondary"}
          size="icon"
          className="shrink-0"
          onClick={handleMic}
          disabled={speech.status === "transcribing"}
          aria-label={
            speech.status === "listening" ? "หยุดฟังเสียง" : "เริ่มฟังเสียง"
          }
          aria-pressed={speech.status === "listening"}
        >
          {speech.status === "listening" ? (
            <Square className="size-4" />
          ) : supported ? (
            <Mic className="size-4" />
          ) : (
            <MicOff className="size-4" />
          )}
        </Button>
        <Button
          type="button"
          onClick={() => commit("text")}
          className="shrink-0"
          disabled={!canSubmit || busy}
          aria-label="บันทึกบริบท"
        >
          <Type className="size-4" />
          บันทึก
        </Button>
      </div>

      {/* แถบสถานะไมค์ / ผลถอดเสียง */}
      {speech.status !== "idle" ? (
        <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
          {speech.status === "error" ? (
            <p className="text-expense">{speech.error}</p>
          ) : speech.transcript ? (
            <p className="leading-5">
              <span className="text-xs text-muted">
                {MIC_HINTS[speech.status]}
              </span>
              <span className="mt-1 block">{speech.transcript}</span>
            </p>
          ) : (
            <p className="text-muted">{MIC_HINTS[speech.status]}</p>
          )}
        </div>
      ) : null}

      {speech.status === "done" && speech.transcript ? (
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1"
            onClick={() => {
              setText(speech.transcript);
              commit("voice", speech.transcript);
            }}
          >
            ใช้ข้อความนี้
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setText(speech.transcript);
              reset();
            }}
          >
            แก้ไขก่อน
          </Button>
        </div>
      ) : null}

      {!supported ? (
        <p className="mt-2 text-xs text-subtle">
          การถอดเสียงใช้ได้บน Chrome / Edge — ยังพิมพ์บันทึกได้ปกติ
        </p>
      ) : null}
    </section>
  );
}
