/**
 * Goal statement lib tests — สรุปการเดินบัญชีของเป้าหมายที่กางดูรายละเอียดได้
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { Contribution, Goal } from "./types.ts";
import {
  buildGoalStatement,
  formatGoalAmount,
  goalContributions,
  goalDayCounts,
} from "./statement.ts";

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
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
    ...overrides,
  };
}

function makeContribution(overrides: Partial<Contribution> = {}): Contribution {
  return {
    id: "c1",
    goalId: "g1",
    amount: 50,
    date: "2026-10-02",
    note: null,
    createdAt: "2026-10-02T08:00:00.000Z",
    ...overrides,
  };
}

describe("goalDayCounts — นับวันของเป้าหมาย", () => {
  it("นับวันรวมแบบรวมหัวท้าย และเหลือ 0 เมื่อเลยกำหนด", () => {
    const goal = makeGoal();
    const counts = goalDayCounts(goal, new Date("2026-11-05T10:00:00.000Z"));
    assert.equal(counts.daysTotal, 24);
    assert.equal(counts.daysElapsed, 24);
    assert.equal(counts.daysLeft, 0);
  });

  it("นับวันผ่านไปตามวันที่ปัจจุบัน", () => {
    const goal = makeGoal();
    const counts = goalDayCounts(goal, new Date("2026-10-11T10:00:00.000Z"));
    assert.equal(counts.daysTotal, 24);
    assert.equal(counts.daysElapsed, 11);
    assert.equal(counts.daysLeft, 13);
  });
});

describe("goalContributions — กรองและเรียงรายการ", () => {
  it("เอาเฉพาะของเป้าหมายนี้ เรียงวันใหม่สุดก่อน", () => {
    const list = [
      makeContribution({ id: "a", date: "2026-10-02" }),
      makeContribution({ id: "b", date: "2026-10-05" }),
      makeContribution({ id: "x", goalId: "other", date: "2026-10-06" }),
      makeContribution({ id: "c", date: "2026-10-03" }),
    ];
    assert.deepEqual(
      goalContributions(list, "g1").map((c) => c.id),
      ["b", "c", "a"],
    );
  });

  it("วันเดียวกันใช้เวลาสร้างใหม่สุดก่อน", () => {
    const list = [
      makeContribution({ id: "early", date: "2026-10-02", createdAt: "2026-10-02T07:00:00.000Z" }),
      makeContribution({ id: "late", date: "2026-10-02", createdAt: "2026-10-02T20:00:00.000Z" }),
    ];
    assert.deepEqual(
      goalContributions(list, "g1").map((c) => c.id),
      ["late", "early"],
    );
  });
});

describe("buildGoalStatement — สรุปรวมยอดและจังหวะ", () => {
  it("รวมยอด คงเหลือ จำนวนครั้ง และวันที่มีบันทึก", () => {
    const statement = buildGoalStatement(
      makeGoal(),
      [
        makeContribution({ id: "a", amount: 400, date: "2026-10-02" }),
        makeContribution({ id: "b", amount: 500, date: "2026-10-03" }),
        makeContribution({ id: "c", amount: 150, date: "2026-10-03" }),
      ],
      new Date("2026-10-11T10:00:00.000Z"),
    );

    assert.equal(statement.total, 1050);
    assert.equal(statement.remaining, 150);
    assert.equal(statement.count, 3);
    assert.equal(statement.recordedDays, 2);
    assert.equal(statement.averagePerEntry, 350);
    assert.equal(statement.firstEntryDate, "2026-10-02");
    assert.equal(statement.lastEntryDate, "2026-10-03");
  });

  it("เทียบกับแผนเส้นตรง: ทำได้เกินแผน paceDiff เป็นบวก", () => {
    // วันที่ 11/24 ของเป้า 1,200 → ควรได้ 550
    const statement = buildGoalStatement(
      makeGoal(),
      [makeContribution({ amount: 1050, date: "2026-10-11" })],
      new Date("2026-10-11T10:00:00.000Z"),
    );
    assert.equal(statement.expectedByNow, 550);
    assert.equal(statement.paceDiff, 500);
    assert.equal(Math.round(statement.expectedPercent), 46);
  });

  it("คำนวณยอดที่ต้องเก็บต่อวันจากวันที่เหลือ", () => {
    const statement = buildGoalStatement(
      makeGoal(),
      [makeContribution({ amount: 300, date: "2026-10-02" })],
      new Date("2026-10-11T10:00:00.000Z"),
    );
    // เหลือ 900 จาก 13 วัน
    assert.equal(statement.perDayNeeded, 900 / 13);
    assert.equal(statement.averagePerDay, 300 / 11);
  });

  it("วันสุดท้ายที่ยังไม่ถึงเป้า: ต้องเก็บที่เหลือทั้งหมดวันนี้", () => {
    const statement = buildGoalStatement(
      makeGoal(),
      [makeContribution({ amount: 1000, date: "2026-10-24" })],
      new Date("2026-10-24T10:00:00.000Z"),
    );
    assert.equal(statement.perDayNeeded, 200);
  });

  it("ไม่มีรายการเลย: คืนศูนย์และไม่หารศูนย์", () => {
    const statement = buildGoalStatement(makeGoal(), [], new Date("2026-10-11T10:00:00.000Z"));
    assert.equal(statement.count, 0);
    assert.equal(statement.total, 0);
    assert.equal(statement.remaining, 1200);
    assert.equal(statement.averagePerEntry, 0);
    assert.equal(statement.firstEntryDate, null);
    assert.equal(statement.lastEntryDate, null);
  });

  it("ทำเกินเป้า: คงเหลือเป็นศูนย์ และไม่ติดลบ", () => {
    const statement = buildGoalStatement(
      makeGoal(),
      [makeContribution({ amount: 1500, date: "2026-10-11" })],
      new Date("2026-10-11T10:00:00.000Z"),
    );
    assert.equal(statement.remaining, 0);
    assert.equal(statement.perDayNeeded, 0);
  });
});

describe("formatGoalAmount — แสดงผลตามหน่วย", () => {
  it("หน่วยเงินนำหน้าด้วย ฿", () => {
    assert.equal(formatGoalAmount(1050, "฿"), "฿1,050");
    assert.equal(formatGoalAmount(0, "฿"), "฿0");
  });

  it("ค่าตั้งแต 10 ขึ้นไปปัดเป็นจำนวนเต็ม", () => {
    assert.equal(formatGoalAmount(108.89, "฿"), "฿109");
    assert.equal(formatGoalAmount(46.67, "฿"), "฿47");
  });

  it("ค่าน้อยกว่า 10 คงทศนิยมไม่เกิน 2 ตำแหน่ง", () => {
    assert.equal(formatGoalAmount(0.33, "฿"), "฿0.33");
    assert.equal(formatGoalAmount(2.5, "ครั้ง"), "2.5 ครั้ง");
  });

  it("roundUp ปัดขึ้น — ใช้กับยอดที่ต้องเก็บต่อวัน", () => {
    assert.equal(formatGoalAmount(73.33, "฿", { roundUp: true }), "฿74");
    assert.equal(formatGoalAmount(1.2, "ครั้ง", { roundUp: true }), "2 ครั้ง");
  });

  it("หน่วยอื่นต่อท้ายด้วยชื่อหน่วย", () => {
    assert.equal(formatGoalAmount(7, "ครั้ง"), "7 ครั้ง");
  });
});
