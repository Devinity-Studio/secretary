/**
 * Secretary Context — Overview lib (UI-agnostic)
 *
 * ใช้โดยหน้ารวมบริบท (/context): กรอง/ค้น/เรียง/นับ โดยไม่ผูกกับ React
 * - ค้นหาแบบ deterministic: คำค้นไปเทียบข้อความ evidence + type + tags
 * - ไม่ mutate ข้อมูล — อ่านจาก record ที่ส่งเข้ามาเท่านั้น
 */

import type { Evidence, LifecycleStatus, SecretaryContext, SourceType } from "./types";

export type OverviewLifecycleFilter = LifecycleStatus | "all";

export interface OverviewQuery {
  /** ค้นหาอิสระ (trim แล้วเทียบแบบไม่สนตัวพิมพ์) — ว่าง = ไม่กรอง */
  search: string;
  lifecycle: OverviewLifecycleFilter;
  source: SourceType | "all";
  /** เรียงลำดับ — ค่าเริ่มต้นใหม่สุดก่อน */
  orderBy: "createdAt-desc" | "createdAt" | "priority-desc";
}

export const defaultOverviewQuery: OverviewQuery = {
  search: "",
  lifecycle: "all",
  source: "all",
  orderBy: "createdAt-desc",
};

/** ข้อความค้นหาทั้งหมดที่อ่านได้จาก context + evidence ของมัน */
export function overviewSearchText(
  context: SecretaryContext,
  evidenceById: Record<string, Evidence>,
): string {
  const evidenceText = context.evidenceIds
    .map((id) => evidenceById[id])
    .filter((e): e is Evidence => Boolean(e))
    .map((e) => {
      if (e.content.kind === "structured") {
        return Object.entries(e.content.data)
          .map(([k, v]) => `${k} ${String(v)}`)
          .join(" ");
      }
      return e.content.text;
    })
    .join(" ");

  return [evidenceText, context.type, ...context.tags].join(" ").toLowerCase();
}

/** กรอง + ค้น + เรียง — pure function สำหรับหน้ารวมบริบท */
export function selectOverviewContexts(
  contextsRecord: Record<string, SecretaryContext>,
  evidenceById: Record<string, Evidence>,
  query: OverviewQuery,
): SecretaryContext[] {
  const terms = query.search.trim().toLowerCase();

  const list = Object.values(contextsRecord).filter((c) => {
    if (c.archived) return false;
    if (query.lifecycle !== "all" && c.lifecycle !== query.lifecycle) return false;
    if (query.source !== "all" && !c.sources.includes(query.source)) return false;
    if (terms && !overviewSearchText(c, evidenceById).includes(terms)) return false;
    return true;
  });

  switch (query.orderBy) {
    case "createdAt":
      return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "priority-desc":
      return list.sort(
        (a, b) => b.priority - a.priority || b.createdAt.localeCompare(a.createdAt),
      );
    case "createdAt-desc":
    default:
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export interface OverviewCounts {
  total: number;
  tentative: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

/** นับสรุปสำหรับชิปกรอง — นับจาก non-archived ทั้งหมดเสมอ (ไม่ขึ้นกับ filter ปัจจุบัน) */
export function overviewCounts(
  contextsRecord: Record<string, SecretaryContext>,
): OverviewCounts {
  const counts: OverviewCounts = {
    total: 0,
    tentative: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const c of Object.values(contextsRecord)) {
    if (c.archived) continue;
    counts.total += 1;
    counts[c.lifecycle] += 1;
  }
  return counts;
}
