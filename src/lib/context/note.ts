/**
 * Secretary Context — Note Capture (Text / Voice)
 *
 * Round-1 UX slice: create a Context from a free-form note typed into the
 * Context Input or transcribed from voice.
 *
 * Principles kept intact:
 * - Original input (typed or transcript) becomes IMMUTABLE Evidence
 * - Source channel is preserved: "user" (typed) vs "voice" (dictated)
 * - Lifecycle starts at "tentative" — no judgment at capture time
 * - NO parser, NO finance write, NO inference — this is Record First
 * - Context store is local-first (localStorage persist) and scoped away from
 *   Finance / Goals / Calendar stores
 */

import type {
  ConfidenceLevel,
  CreateContextInput,
  Evidence,
  EvidenceContent,
  SecretaryContext,
  SourceType,
} from "./types";
import { CONTEXT_DOMAIN_TYPES } from "./types";
import { useContextStore } from "./store";

export type ContextNoteOrigin = "text" | "voice";

export interface CreateContextNoteInput {
  /** ข้อความที่ผู้ใช้พิมพ์ หรือ transcript จากไมค์ (บรรทัดเดียว ตัดช่องว่างเกิน) */
  text: string;
  /** ช่องทางที่ข้อความเกิดขึ้น — กำหนด SourceType ของ evidence */
  origin: ContextNoteOrigin;
  /** เวลาที่จับได้ (ISO) — ปกติคือตอน commit; เว้นไว้เพื่อ test */
  capturedAt?: string;
  /**
   * ความเชื่อมั่นของ evidence — พิมพ์เอง = high, ถอดเสียง = medium
   * (transcript อาจผิดพลาด จึงไม่ควรตั้ง high โดยดีฟอลต์)
   */
  confidence?: ConfidenceLevel;
  /** เก็บ metadata เสริมของการ capture เช่น ความยาวคลิปเสียง */
  metadata?: Record<string, unknown>;
}

/** แผนที่ origin → ช่องทาง source ของ evidence */
export function originToSourceType(origin: ContextNoteOrigin): SourceType {
  return origin === "voice" ? "voice" : "user";
}

/** สร้าง Evidence (immutable) จากข้อความดิบ — ไม่แต่งเรื่องแทนผู้ใช้ */
export function noteToEvidence(
  input: CreateContextNoteInput,
): Omit<Evidence, "id"> {
  const text = input.text.trim();
  const content: EvidenceContent =
    input.metadata && Object.keys(input.metadata).length > 0
      ? { kind: "hybrid", text, data: { ...input.metadata } }
      : { kind: "text", text };

  return {
    sourceType: originToSourceType(input.origin),
    sourceId: null,
    content,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    confidence:
      input.confidence ?? (input.origin === "voice" ? "medium" : "high"),
  };
}

/**
 * สร้าง Context จากโน้ตเสียง/ข้อความ
 *
 * - lifecycle = "tentative", type = "user.note" (เสียงจะโดน tag "voice" ด้วย)
 * - ไม่มี Fact / Inference ถูกสร้างอัตโนมัติ (Judgment Boundary)
 * - เขียนเฉพาะ context store — Finance/Goals/Calendar ไม่ถูกแตะ
 *
 * @returns Context ที่สร้าง หรือ null ถ้าข้อความว่าง
 */
export function createContextFromNote(
  input: CreateContextNoteInput,
): SecretaryContext | null {
  const text = input.text.trim();
  if (!text) return null;

  const evidence = noteToEvidence(input);
  const tags =
    input.origin === "voice" ? ["context", "voice"] : ["context"];

  const createInput: CreateContextInput = {
    evidence,
    type: CONTEXT_DOMAIN_TYPES.USER_NOTE,
    source: originToSourceType(input.origin),
    lifecycle: "tentative",
    tags,
  };

  const context = useContextStore.getState().createContext(createInput);

  // Capture เชิงสังเกต — ยังไม่มีการตัดสินใด ๆ (pattern-only)
  useContextStore.getState().markPatternOnly(context.id);

  return context;
}

/** Helper สำหรับ UI: ตัวระบุแหล่งกำเนิดแบบสั้น เช่น "ctx_ab12" ไว้โชว์บนการ์ด */
export function shortContextRef(id: string): string {
  return `ctx_${id.replace(/-/g, "").slice(0, 6)}`;
}
