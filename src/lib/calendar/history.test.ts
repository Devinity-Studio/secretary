/**
 * Month history lib tests — ประวัติย้อนหลังของเดือนในหน้าปฏิทิน
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildMonthActivity, monthPrefix } from "./history.ts";
import type { CalendarEvent } from "./types.ts";
import type { Contribution, Goal } from "@/lib/goals/types";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    type: "appointment",
    title: "ประชุมทีม",
    date: "2026-10-05",
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
    leaveType: null,
    note: null,
    color: "#0f766e",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

const goal: Goal = {
  id: "g1",
  title: "รายวัน",
  type: "savings",
  targetAmount: 1200,
  unit: "฿",
  startDate: "2026-10-01",
  endDate: "2026-10-24",
  status: "active",
  note: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function makeContribution(overrides: Partial<Contribution> = {}): Contribution {
  return {
    id: "c1",
    goalId: "g1",
    amount: 100,
    date: "2026-10-06",
    note: null,
    createdAt: "2026-10-06T08:00:00.000Z",
    ...overrides,
  };
}

describe("monthPrefix — รูปแบบเดือน", () => {
  it("เติมศูนย์ให้เดือนเดียว", () => {
    assert.equal(monthPrefix(2026, 9), "2026-10");
    assert.equal(monthPrefix(2026, 0), "2026-01");
  });
});

describe("buildMonthActivity — ไทม์ไลน์ของเดือน", () => {
  const events = [
    makeEvent({ id: "e1", date: "2026-10-05", startTime: "09:00", title: "ประชุมทีม" }),
    makeEvent({ id: "e2", type: "leave", leaveType: "sick", date: "2026-10-07", startTime: null, title: "ลาป่วย" }),
    makeEvent({ id: "e3", date: "2026-11-02", title: "เดือนอื่น" }),
  ];
  const contributions = [
    makeContribution({ id: "c1", date: "2026-10-06", amount: 100 }),
    makeContribution({ id: "c2", date: "2026-10-06", amount: 50, note: "จากโบนัส" }),
    makeContribution({ id: "c3", date: "2026-11-03", amount: 999 }),
  ];

  it("นับเฉพาะเดือนที่เลือก", () => {
    const activity = buildMonthActivity(events, [goal], contributions, 2026, 9);
    assert.equal(activity.eventCount, 2);
    assert.equal(activity.leaveCount, 1);
    assert.equal(activity.contributionCount, 2);
    assert.equal(activity.entries.length, 4);
  });

  it("นับวันที่มีความเคลื่อนไหวแบบไม่ซ้ำ", () => {
    const activity = buildMonthActivity(events, [goal], contributions, 2026, 9);
    assert.equal(activity.activeDays, 3);
  });

  it("เรียงใหม่สุดก่อน และในวันเดียวกันนัดหมายมาก่อนเป้าหมาย", () => {
    const activity = buildMonthActivity(events, [goal], contributions, 2026, 9);
    assert.deepEqual(
      activity.entries.map((e) => e.id),
      ["event:e2", "goal:c1", "goal:c2", "event:e1"],
    );
  });

  it("เป้าหมายแสดงชื่อและหน่วยจาก goal ที่อ้างถึง", () => {
    const activity = buildMonthActivity(events, [goal], contributions, 2026, 9);
    const entry = activity.entries.find((e) => e.id === "goal:c2");
    assert.equal(entry?.title, "รายวัน");
    assert.equal(entry?.amount, 50);
    assert.equal(entry?.unit, "฿");
    assert.equal(entry?.detail, "จากโบนัส");
  });

  it("ไม่รู้จักเป้าหมายก็ยังแสดงรายการได้", () => {
    const activity = buildMonthActivity(events, [], [makeContribution({ id: "c9", goalId: "gone" })], 2026, 9);
    const entry = activity.entries.find((e) => e.id === "goal:c9");
    assert.equal(entry?.title, "เป้าหมาย");
    assert.equal(entry?.unit, null);
  });

  it("เดือนว่างคืนศูนย์ทุกช่อง", () => {
    const activity = buildMonthActivity([], [], [], 2026, 5);
    assert.deepEqual(activity, {
      entries: [],
      eventCount: 0,
      leaveCount: 0,
      contributionCount: 0,
      activeDays: 0,
    });
  });
});
