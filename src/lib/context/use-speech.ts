import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  initialSpeechState,
  speechErrorMessage,
  speechTransition,
  type SpeechState,
} from "@/lib/context/speech";

/**
 * useSpeechRecognition — React hook ครอบ Web Speech API
 *
 * คุณสมบัติ:
 * - สถานะตาม state machine: idle → listening → transcribing → done / error
 * - ภาษาไทยเป็นค่าเริ่มต้น (th-TH)
 * - ไม่พึ่ง dependency เพิ่ม; เบราว์เซอร์ที่ไม่รองรับจะรายงาน unsupported
 * - กดหยุดแล้ว flow ต้องจบเสมอ: รอผล final จาก engine สั้น ๆ แล้ว fallback
 *   ปิดด้วย transcript ที่สะสมไว้ กันสถานะค้าง "กำลังถอดเสียง" ตลอดไป
 * - cleanup ครบ: ยกเลิก recognition และล้าง timeout ตอน unmount
 */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** เผื่อเวลา engine ส่งผล final หลังกดหยุด; ถ้าเงียบ จะปิดด้วย transcript ที่ฟังได้ */
const FINALIZE_AFTER_STOP_MS = 2500;

export function useSpeechRecognition() {
  const [state, dispatch] = useReducer(speechTransition, initialSpeechState);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** ค่าล่าสุดของ transcript ที่ฟังได้ (interim + final สะสม) */
  const interimRef = useRef("");
  /**
   * ผลตรวจ support แบบ lazy — ต้องคง false ระหว่าง SSR และเช็คจริงหลัง mount
   * เพื่อไม่ให้ icon (Mic/MicOff) ต่างกันระหว่าง server/client → hydration mismatch
   */
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);
  /** สถานะล่าสุดแบบ ref — ให้ start() อ่านสถานะปัจจุบันได้โดยไม่เพิ่ม dependency */
  const statusRef = useRef<SpeechState["status"]>(initialSpeechState.status);
  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  const clearTimers = useCallback(() => {
    if (finalizeTimerRef.current !== null) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    if (stopFallbackRef.current !== null) {
      clearTimeout(stopFallbackRef.current);
      stopFallbackRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    const recognition = recognitionRef.current;
    if (recognition) {
      // ห้าม detach onresult ตรงนี้ — Chrome ส่งผล final หลัง stop()
      // ทาง onresult ก่อน onend; ปล่อยให้ onend เป็นผู้เคลียร์
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          /* ไมโครโฟนอาจหยุดไปแล้ว */
        }
      }
    }
    // Fallback: บาง engine เงียบหลัง stop — ปิดจบด้วยสิ่งที่ฟังได้
    stopFallbackRef.current = setTimeout(() => {
      stopFallbackRef.current = null;
      dispatch({ type: "FINAL", transcript: interimRef.current.trim() });
    }, FINALIZE_AFTER_STOP_MS);
    dispatch({ type: "STOP_REQUESTED" });
  }, [clearTimers]);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      dispatch({
        type: "ERROR",
        message: speechErrorMessage(undefined, true),
      });
      return;
    }

    // ปุ่มเดิมทำหน้าที่ toggle: ฟังอยู่ = กดหยุด
    if (recognitionRef.current && statusRef.current !== "error") {
      stop();
      return;
    }
    // หลัง error อาจไม่มี onend ตามมา — เคลียร์อ้างอิงเก่าให้กดเริ่มใหม่ได้เสมอ
    recognitionRef.current = null;

    clearTimers();
    interimRef.current = "";
    dispatch({ type: "START" });

    try {
      const recognition = new Ctor();
      recognition.lang = "th-TH";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            interimRef.current = interimRef.current
              ? `${interimRef.current} ${text}`.trim()
              : text.trim();
            // ผล final มาแล้วหลังกดหยุด — ปิดจบทันที (ไม่รอ fallback)
            if (stopFallbackRef.current !== null) {
              clearTimeout(stopFallbackRef.current);
              stopFallbackRef.current = null;
              dispatch({ type: "FINAL", transcript: interimRef.current.trim() });
              return;
            }
            // ระหว่างฟัง: หน่วงนิดให้ผลเพิ่มเติมไหลมารวมก่อน
            clearTimers();
            finalizeTimerRef.current = setTimeout(() => {
              finalizeTimerRef.current = null;
              dispatch({ type: "FINAL", transcript: interimRef.current.trim() });
            }, 120);
          } else {
            interim += text;
          }
        }
        if (interim) {
          interimRef.current = interimRef.current
            ? `${interimRef.current} ${interim}`.trim()
            : interim.trim();
          dispatch({ type: "PARTIAL", transcript: interimRef.current });
        }
      };

      recognition.onerror = (event) => {
        clearTimers();
        dispatch({
          type: "ERROR",
          message: speechErrorMessage(event.error),
        });
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        // จบเองหรือ engine ปิด — ถ้ายังไม่ done ให้ปิดด้วยสิ่งที่ฟังได้
        // (FINAL จากสถานะ done/idle จะถูก state machine เมินเอง)
        if (stopFallbackRef.current !== null) {
          clearTimeout(stopFallbackRef.current);
          stopFallbackRef.current = null;
        }
        if (finalizeTimerRef.current !== null) {
          clearTimeout(finalizeTimerRef.current);
          finalizeTimerRef.current = null;
        }
        dispatch({ type: "FINAL", transcript: interimRef.current.trim() });
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      recognitionRef.current = null;
      dispatch({ type: "ERROR", message: speechErrorMessage(undefined, false) });
    }
  }, [clearTimers, stop]);

  const reset = useCallback(() => {
    clearTimers();
    dispatch({ type: "RESET" });
  }, [clearTimers]);

  // Cleanup เมื่อ component ถูกถอดออก
  useEffect(() => {
    return () => {
      if (finalizeTimerRef.current !== null) {
        clearTimeout(finalizeTimerRef.current);
      }
      if (stopFallbackRef.current !== null) {
        clearTimeout(stopFallbackRef.current);
      }
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try {
          recognition.abort();
        } catch {
          /* ignore */
        }
      }
      recognitionRef.current = null;
    };
  }, []);

  return {
    state: state as SpeechState,
    supported,
    start,
    stop,
    reset,
  };
}
