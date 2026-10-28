/**
 * Account ledger lib tests — สรุปการเดินบัญชีต่อบัญชีในหน้าการเงิน
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { accountEffect, accountTransactions, buildAccountLedger } from "./ledger.ts";
import type { Account, Transaction } from "./types.ts";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-bank",
    name: "บัญชีกสิกร",
    type: "bank",
    currentBalance: 0,
    color: "#1D4E4A",
    archived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    type: "expense",
    title: "กาแฟ",
    amount: 65,
    accountId: "acc-bank",
    toAccountId: null,
    category: "food",
    date: "2026-10-05",
    note: null,
    createdAt: "2026-10-05T08:00:00.000Z",
    updatedAt: "2026-10-05T08:00:00.000Z",
    ...overrides,
  };
}

const credit = makeAccount({ id: "acc-credit", name: "บัตรเครดิต", type: "credit" });

describe("accountEffect — ผลของรายการต่อยอดบัญชี", () => {
  it("รายรับเข้าบัญชีเป็นบวก", () => {
    assert.equal(accountEffect(makeTx({ type: "income", amount: 1000 }), makeAccount()), 1000);
  });

  it("รายจ่ายจากบัญชีปกติเป็นลบ", () => {
    assert.equal(accountEffect(makeTx({ type: "expense", amount: 65 }), makeAccount()), -65);
  });

  it("รายจ่ายบนบัตรเครดิตทำให้ยอดหนี้เพิ่ม", () => {
    assert.equal(accountEffect(makeTx({ amount: 500, accountId: "acc-credit" }), credit), 500);
  });

  it("โอนออกเป็นลบ โอนเข้าเป็นบวก", () => {
    const transfer = makeTx({ type: "transfer", amount: 300, accountId: "acc-cash", toAccountId: "acc-bank" });
    assert.equal(accountEffect(transfer, makeAccount()), 300);
    assert.equal(accountEffect(transfer, makeAccount({ id: "acc-cash", type: "cash" })), -300);
  });

  it("บัญชีอื่นที่ไม่เกี่ยวข้องได้ศูนย์", () => {
    assert.equal(accountEffect(makeTx(), makeAccount({ id: "acc-other" })), 0);
  });
});

describe("accountTransactions — กรองและเรียงรายการของบัญชี", () => {
  it("เอาเฉพาะรายการที่แตะบัญชีนี้ เรียงใหม่สุดก่อน", () => {
    const list = [
      makeTx({ id: "a", date: "2026-10-02" }),
      makeTx({ id: "b", date: "2026-10-09" }),
      makeTx({ id: "x", accountId: "acc-cash", date: "2026-10-10" }),
      makeTx({ id: "t", type: "transfer", accountId: "acc-cash", toAccountId: "acc-bank", date: "2026-10-07" }),
    ];
    assert.deepEqual(
      accountTransactions(list, "acc-bank").map((t) => t.id),
      ["b", "t", "a"],
    );
  });

  it("กรองตามช่วงวันที่ได้", () => {
    const list = [
      makeTx({ id: "a", date: "2026-10-02" }),
      makeTx({ id: "b", date: "2026-10-09" }),
    ];
    assert.deepEqual(
      accountTransactions(list, "acc-bank", "2026-10-05", "2026-10-31").map((t) => t.id),
      ["b"],
    );
  });
});

describe("buildAccountLedger — สรุปช่วงเวลา", () => {
  const now = new Date("2026-10-11T10:00:00.000Z");
  // ยอดปัจจุบัน 2,300 = รายรับ ก.ย. 2,000 + สุทธิ ต.ค. 300 (ตรงกับผลของรายการจริง)
  const account = makeAccount({ currentBalance: 2300 });
  const transactions = [
    makeTx({ id: "old", type: "income", amount: 2000, date: "2026-09-20" }), // ก่อนช่วง
    makeTx({ id: "in", type: "income", amount: 500, date: "2026-10-03" }),
    makeTx({ id: "out", type: "expense", amount: 150, date: "2026-10-05" }),
    makeTx({ id: "out2", type: "expense", amount: 50, date: "2026-10-09" }),
  ];

  it("นับเฉพาะรายการในเดือนนี้ พร้อมเงินเข้า–ออกและสุทธิ", () => {
    const ledger = buildAccountLedger(account, transactions, "month", now);
    assert.equal(ledger.count, 3);
    assert.equal(ledger.inflow, 500);
    assert.equal(ledger.outflow, 200);
    assert.equal(ledger.net, 300);
    assert.equal(ledger.lastEntryDate, "2026-10-09");
  });

  it("ยอดยกมา = ยอดปัจจุบัน − รายการตั้งแต่วันเริ่มช่วงเป็นต้นไป", () => {
    const ledger = buildAccountLedger(account, transactions, "month", now);
    // 2300 − (500 − 150 − 50) = 2300 − 300 = 2000 (ยอด ณ สิ้นเดือน ก.ย.)
    assert.equal(ledger.openingBalance, 2000);
    assert.equal(ledger.closingBalance, 2300);
    assert.equal(ledger.openingBalance + ledger.net, ledger.closingBalance);
  });

  it("บัญชีไม่มีรายการในช่วง: ศูนย์และไม่หารศูนย์", () => {
    const ledger = buildAccountLedger(makeAccount(), [], "month", now);
    assert.equal(ledger.count, 0);
    assert.equal(ledger.inflow, 0);
    assert.equal(ledger.outflow, 0);
    assert.equal(ledger.net, 0);
    assert.equal(ledger.lastEntryDate, null);
  });

  it("ช่วงรายวันเห็นเฉพาะรายการของวันนั้น", () => {
    const ledger = buildAccountLedger(account, transactions, "day", now);
    assert.deepEqual(ledger.entries.map((t) => t.id), []);
  });
});
