/**
 * Secretary Context — Speech state machine (pure, framework-free)
 *
 * Round-1 UX: สถานะไมค์ให้ชัดเจนเป็นสถานะตาม UX flow:
 *
 *   idle → listening → transcribing → done
 *            (จากสถานะใดก็ได้) → error
 *
 * done ไม่ใช่สถานะค้าง — หลังแสดงผลแล้วกลับเป็น idle เพื่อรอรอบถัดไป
 * แยก state machine ออกจาก React เพื่อให้ทดสอบได้โดยไม่ต้องมี DOM/ไมค์จริง
 */

export type SpeechStatus = "idle" | "listening" | "transcribing" | "done" | "error";

export interface SpeechState {
  status: SpeechStatus;
  /** ข้อความที่ถอดเสียงได้ (ระหว่างฟัง = ผลลัพธ์ชั่วคราว, done = ผลสุดท้าย) */
  transcript: string;
  /** ข้อความ error แบบอ่านง่าย (ภาษาไทย) เมื่อ status = error */
  error: string | null;
}

export type SpeechEvent =
  | { type: "START" }
  | { type: "PARTIAL"; transcript: string }
  | { type: "STOP_REQUESTED" }
  | { type: "FINAL"; transcript: string }
  | { type: "RESET" }
  | { type: "ERROR"; message: string };

export const initialSpeechState: SpeechState = {
  status: "idle",
  transcript: "",
  error: null,
};

/**
 * Reducer ของ state machine — pure function
 *
 * กติกาสำคัญ:
 * - FINAL ได้รับอนุญาตจาก listening (จบเอง) หรือ transcribing (กดหยุดแล้วรอผล)
 * - PARTIAL มีผลเฉพาะตอน listening (กันผลซ้ำมาช้าหลังหยุด)
 * - ERROR จากสถานะใดก็ได้ และเก็บ transcript เดิมไว้ให้ผู้ใช้ยังก๊อปได้
 */
export function speechTransition(state: SpeechState, event: SpeechEvent): SpeechState {
  switch (event.type) {
    case "START":
      return { status: "listening", transcript: "", error: null };

    case "PARTIAL":
      if (state.status !== "listening") return state;
      return { ...state, transcript: event.transcript };

    case "STOP_REQUESTED":
      if (state.status !== "listening") return state;
      return { ...state, status: "transcribing" };

    case "FINAL":
      if (state.status !== "listening" && state.status !== "transcribing") return state;
      return { status: "done", transcript: event.transcript, error: null };

    case "RESET":
      return initialSpeechState;

    case "ERROR":
      return {
        status: "error",
        transcript: state.transcript,
        error: event.message,
      };
  }
}

/** ป้ายสถานะสำหรับแสดงบน UI (ภาษาไทย) */
export const SPEECH_STATUS_LABELS: Record<SpeechStatus, string> = {
  idle: "พร้อมใช้",
  listening: "กำลังฟัง…",
  transcribing: "กำลังถอดเสียง…",
  done: "ถอดเสียงแล้ว",
  error: "เกิดข้อผิดพลาด",
};

/**
 * รวมผลจาก onresult เข้ากับที่สะสมไว้ — pure function เพื่อให้ทดสอบได้ตรง ๆ
 *
 * กติกา:
 * - ผล isFinal ยืนยันสิ่งที่เคย interim ของสล็อตเดียวกัน → ผนวกเข้า committed ครั้งเดียว
 *   (partial "นัดหมอ" ตามด้วย final "นัดหมอ" ต้องได้ "นัดหมอ" ไม่ใช่ "นัดหมอ นัดหมอ")
 * - interim ใหม่ของรอบนี้แทนที่ draft เดิม (engine พิมพ์ทับของเดิมเสมอ)
 * - committed ที่ยืนยันแล้วไม่มีวันถูก interim แทนที่หรือทำให้ซ้ำ
 */
export function accumulateRecognitionText(
  committed: string,
  items: Array<{ isFinal: boolean; text: string }>,
): { committed: string; draft: string } {
  let nextCommitted = committed;
  let nextDraft = "";
  for (const item of items) {
    const text = item.text.trim();
    if (!text) continue;
    if (item.isFinal) {
      nextCommitted = nextCommitted ? `${nextCommitted} ${text}` : text;
    } else {
      nextDraft = nextDraft ? `${nextDraft} ${text}` : text;
    }
  }
  return { committed: nextCommitted, draft: nextDraft };
}

/** แปลง error จาก Web Speech API เป็นข้อความที่ผู้ใช้อ่านรู้เรื่อง */
export function speechErrorMessage(
  code: string | undefined,
  unsupported = false,
): string {
  if (unsupported) {
    return "เบราว์เซอร์นี้ยังไม่รองรับการถอดเสียง ลองใช้ Chrome หรือ Edge";
  }
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน ตรวจสอบการตั้งค่าสิทธิ์ของเบราว์เซอร์";
    case "no-speech":
      return "ไม่ได้ยินเสียง ลองพูดใหม่อีกครั้ง";
    case "audio-capture":
      return "หาไมโครโฟนไม่เจอ ตรวจสอบการเชื่อมต่ออุปกรณ์";
    case "network":
      return "เครือข่ายขัดข้องระหว่างถอดเสียง ลองใหม่อีกครั้ง";
    case "aborted":
      return "การฟังเสียงถูกยกเลิก";
    default:
      return "ถอดเสียงไม่สำเร็จ ลองใหม่อีกครั้ง";
  }
}
