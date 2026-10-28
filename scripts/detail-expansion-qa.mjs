#!/usr/bin/env node
/**
 * Detail expansion QA (Playwright) — โหมดดูรายละเอียดของ เป้าหมาย / การเงิน / ปฏิทิน
 *
 * รันกับ dev (8080) หรือ built output (8081):
 *   node scripts/detail-expansion-qa.mjs http://127.0.0.1:8080/ screenshots/detail-expansion-qa
 *
 * ครอบคลุม:
 *  1. เป้าหมาย: seed เป้า + รายการ → กาง "รายละเอียด" เห็นสรุป 6 ช่อง + รายการเดินบัญชี
 *     (ดูทั้งหมด / แก้ไขย้อนหลัง / ลบครบ → empty state)
 *  2. การเงิน: กางรายละเอียดของบัญชี เห็นยอดยกมา–เข้า–ออก–สุทธิ + รายการของบัญชีนั้น
 *     (แก้ไขแล้วยอดคงเหลือขยับ / ลบแล้วยอดคงเหลือคืน)
 *  3. ปฏิทิน: กาง "ประวัติย้อนหลัง" เห็นสรุปเดือน + ไทม์ไลน์ และกดแถวเพื่อเลือกวันได้
 *  4. mobile 390×844 ทั้งสามหน้า: ไม่มี horizontal overflow
 *  5. ไม่มี uncaught page error ตลอดการทดสอบ
 *  6. คืน exit code 0 เมื่อผ่านทั้งหมด
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8080/";
const outBase = process.argv[3] ?? "screenshots/detail-expansion-qa";
mkdirSync("screenshots", { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** seed ทุกสโตร์ก่อนสคริปต์แอปทำงาน (ข้าม about:blank ที่อ่าน localStorage ไม่ได้) */
function seedScript() {
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (offset) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const now = new Date().toISOString();

  // ── เป้าหมาย (ใช้ทั้งหน้าเป้าหมายและไทม์ไลน์ปฏิทิน) ──
  const goal = {
    id: "qa-goal",
    title: "QA เป้าหมายรายวัน",
    type: "savings",
    targetAmount: 1200,
    unit: "฿",
    startDate: iso(-20),
    endDate: iso(3),
    status: "active",
    note: null,
    createdAt: now,
    updatedAt: now,
  };
  const contributionDates = [iso(-2), iso(-1), iso(0)];
  const contributions = [100, 120, 150].map((amount, i) => ({
    id: `qa-c-${i}`,
    goalId: "qa-goal",
    amount,
    date: contributionDates[i],
    note: i === 1 ? "จากโบนัส" : null,
    createdAt: now,
  }));
  // อีก 3 รายการในเดือนเดียวกันเพื่อทดสอบ "ดูทั้งหมด"
  for (let i = 3; i < 6; i += 1) {
    contributions.push({
      id: `qa-c-${i}`,
      goalId: "qa-goal",
      amount: 50,
      date: iso(-(i + 1)),
      note: null,
      createdAt: now,
    });
  }
  localStorage.setItem("mydesk-goals-v1", JSON.stringify({ state: { goals: [goal], contributions }, version: 0 }));

  // ── การเงิน: บัญชีกสิกร = 30,000 (ก่อนเดือนนี้) − 1,000 + 2,000 ──
  const account = (id, name, type, color) => ({
    id, name, type, currentBalance: 0, color, archived: false, createdAt: now,
  });
  const accounts = [
    account("qa-bank", "QA บัญชีกสิกร", "bank", "#1D4E4A"),
    account("qa-cash", "QA เงินสด", "cash", "#3F5B4B"),
  ];
  let n = 0;
  const txs = [];
  const add = (type, title, amount, accountId, category, date) => {
    txs.push({
      id: `qa-tx-${n++}`, type, title, amount, accountId, toAccountId: null,
      category, date, note: null, createdAt: now, updatedAt: now,
    });
    for (const a of accounts) {
      if (type === "income" && a.id === accountId) a.currentBalance += amount;
      else if (type === "expense" && a.id === accountId) a.currentBalance -= amount;
    }
  };
  add("income", "เงินเดือนก่อนหน้า", 30000, "qa-bank", "salary", iso(-40)); // นอกช่วงเดือนนี้
  add("expense", "ค่าน้ำค่าไฟ", 1000, "qa-bank", "utilities", iso(-1));
  add("income", "งานพิเศษ", 2000, "qa-bank", "freelance", iso(0));
  add("expense", "กาแฟ", 65, "qa-cash", "food", iso(0));
  localStorage.setItem("mydesk-finance-v1", JSON.stringify({ state: { accounts, transactions: txs }, version: 0 }));

  // ── ปฏิทิน: นัดหมาย 4 + วันลา 1 ในเดือนนี้ ──
  const event = (id, type, title, date, startTime, leaveType, color) => ({
    id, type, title, date, startTime, endTime: null, allDay: !startTime,
    leaveType: leaveType ?? null, note: null, color, createdAt: now, updatedAt: now,
  });
  const events = [
    event("qa-ev-1", "appointment", "นัดทันตกรรม", iso(0), "10:30", null, "#0f766e"),
    event("qa-ev-2", "appointment", "ประชุมทีม", iso(-1), "14:00", null, "#0f766e"),
    event("qa-ev-3", "leave", "ลาป่วย", iso(-2), null, "sick", "#9a3b2f"),
    event("qa-ev-4", "reminder", "จ่ายบิล", iso(-3), "09:00", null, "#b45309"),
  ];
  localStorage.setItem("mydesk-calendar-v1", JSON.stringify({ state: { events }, version: 0 }));
}

const browser = await chromium.launch();
const context = await browser.newContext();
const pageErrors = [];
context.on("page", (p) => p.on("pageerror", (err) => pageErrors.push(err.message)));
await context.addInitScript(seedScript);
const page = await context.newPage();

const DESKTOP = { width: 1280, height: 1000 };
const MOBILE = { width: 390, height: 844 };

/** การ์ดใบเดียวจากข้อความในหัวการ์ด */
function cardByText(text) {
  return page.locator("div.rounded-2xl").filter({ hasText: text }).first();
}
async function noOverflow() {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

try {
  // ───────────── 1. เป้าหมาย ─────────────
  await page.setViewportSize(DESKTOP);
  await page.goto(url + "goals", { waitUntil: "networkidle" });
  await page.waitForSelector('button[aria-controls="goal-detail-qa-goal"]');
  check("เป้าหมาย: การ์ด render", await page.getByText("QA เป้าหมายรายวัน").isVisible());

  const goalToggle = page.locator('button[aria-controls="goal-detail-qa-goal"]');
  check("เป้าหมาย: hint บอกจำนวนรายการ", (await goalToggle.innerText()).includes("6 รายการ"), await goalToggle.innerText());
  await goalToggle.click();
  await page.waitForSelector("#goal-detail-qa-goal li");

  const goalPanel = page.locator("#goal-detail-qa-goal");
  const goalTiles = await goalPanel.locator(".grid > div").allInnerTexts();
  check("เป้าหมาย: สรุป 6 ช่อง", goalTiles.length === 6, goalTiles.join(" | "));
  check("เป้าหมาย: ยอดสะสมถูกต้อง", goalTiles[0].includes("฿520"), goalTiles[0]);
  const goalText = await goalPanel.innerText();
  check("เป้าหมาย: มีบรรทัดเทียบแผน", /เร็วกว่าแผน|ช้ากว่าแผน|ตามแผน/.test(goalText));
  check("เป้าหมาย: แสดง 5 แถวล่าสุด", (await goalPanel.locator("li").count()) === 5);
  await page.getByRole("button", { name: "ดูทั้งหมด 6 รายการ" }).click();
  check("เป้าหมาย: กดดูทั้งหมดแล้วครบ 6 แถว", (await goalPanel.locator("li").count()) === 6);

  await page.locator('#goal-detail-qa-goal li:nth-child(1) button[aria-label="แก้ไขรายการ"]').click();
  await page.waitForSelector("#contrib-amount");
  check("เป้าหมาย: โมดัลแก้ไข prefilled", (await page.locator("#contrib-amount").inputValue()) === "150");
  await page.fill("#contrib-amount", "250");
  await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
  await page.waitForFunction(() => document.querySelector("#goal-detail-qa-goal")?.innerText.includes("฿620"));
  check("เป้าหมาย: แก้ไขแล้วยอดสะสมอัปเดต", (await goalPanel.innerText()).includes("฿620"));

  for (let i = 0; i < 6; i += 1) {
    await page.locator('#goal-detail-qa-goal li:nth-child(1) button[aria-label="ลบรายการ"]').click();
  }
  await page.waitForFunction(() => document.querySelector("#goal-detail-qa-goal")?.innerText.includes("ยังไม่มีรายการ"));
  check("เป้าหมาย: ลบครบแล้วเห็น empty state", (await goalPanel.innerText()).includes("ยังไม่มีรายการ"));

  await page.goto(url + "goals", { waitUntil: "networkidle" });
  await page.locator('button[aria-controls="goal-detail-qa-goal"]').click();
  await page.waitForSelector("#goal-detail-qa-goal li");
  await page.screenshot({ path: `${outBase}-goals-desktop.png`, fullPage: true });

  // ───────────── 2. การเงิน ─────────────
  await page.goto(url + "finance", { waitUntil: "networkidle" });
  const bankCard = cardByText("QA บัญชีกสิกร");
  await bankCard.waitFor();
  check("การเงิน: การ์ดบัญชี render พร้อมยอดคงเหลือ", (await bankCard.innerText()).includes("฿31,000"), (await bankCard.innerText()).split("\n").join(" | "));
  check("การเงิน: hint บอกจำนวนรายการของช่วง", (await bankCard.innerText()).includes("2 รายการ"), (await bankCard.innerText()).split("\n").join(" | "));

  await bankCard.getByRole("button", { name: /รายละเอียด/ }).click();
  const bankPanel = bankCard.locator('div[id^="account-detail"]');
  const bankTiles = await bankPanel.locator(".grid > div").allInnerTexts();
  check("การเงิน: สรุป 6 ช่อง (ยกมา/เข้า/ออก/สุทธิ/คงเหลือ/รายการ)", bankTiles.length === 6, bankTiles.join(" | "));
  check("การเงิน: ยอดยกมา ฿30,000", bankTiles[0].includes("฿30,000"), bankTiles[0]);
  check("การเงิน: เงินเข้า ฿2,000", bankTiles[1].includes("฿2,000"), bankTiles[1]);
  check("การเงิน: เงินออก ฿1,000", bankTiles[2].includes("฿1,000"), bankTiles[2]);
  check("การเงิน: แถวของบัญชีเรียงใหม่สุดก่อน", (await bankPanel.locator("li").first().innerText()).includes("งานพิเศษ"));

  await bankPanel.locator('li:nth-child(1) button[aria-label="แก้ไขรายการ"]').click();
  await page.waitForSelector("#amount");
  check("การเงิน: โมดัลแก้ไข prefilled", (await page.locator("#amount").inputValue()) === "2000");
  await page.fill("#amount", "2500");
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(() => document.body.innerText.includes("฿31,500"));
  check("การเงิน: แก้ไขแล้วยอดคงเหลือขยับเป็น ฿31,500", (await bankCard.innerText()).includes("฿31,500"));

  await bankPanel.locator('li:nth-child(2) button[aria-label="ลบรายการ"]').click();
  await page.waitForFunction(() => document.body.innerText.includes("฿32,500"));
  check("การเงิน: ลบแล้วยอดคงเหลือคืนเป็น ฿32,500", (await bankCard.innerText()).includes("฿32,500"));
  check("การเงิน: ลบแล้วเหลือ 1 รายการ", (await bankPanel.locator("li").count()) === 1);

  await page.goto(url + "finance", { waitUntil: "networkidle" });
  await cardByText("QA บัญชีกสิกร").getByRole("button", { name: /รายละเอียด/ }).click();
  await page.screenshot({ path: `${outBase}-finance-desktop.png`, fullPage: true });

  // ───────────── 3. ปฏิทิน ─────────────
  await page.goto(url + "calendar", { waitUntil: "networkidle" });
  const historyCard = cardByText("ประวัติย้อนหลัง");
  await historyCard.waitFor();
  check("ปฏิทิน: การ์ดประวัติ render พร้อม hint", /รายการ · \d+ วัน/.test(await historyCard.innerText()), (await historyCard.innerText()).split("\n").join(" | "));

  await historyCard.getByRole("button", { name: /รายละเอียด/ }).click();
  const historyPanel = historyCard.locator('div[id^="month-history"]');
  const historyTiles = await historyPanel.locator(".grid > div").allInnerTexts();
  check("ปฏิทิน: สรุป 4 ช่อง (นัดหมาย/วันลา/บันทึก/วันที่มีความเคลื่อนไหว)", historyTiles.length === 4, historyTiles.join(" | "));
  check("ปฏิทิน: นับนัดหมาย 4", historyTiles[0].includes("4 รายการ"), historyTiles[0]);
  check("ปฏิทิน: นับวันลา 1", historyTiles[1].includes("1 วัน"), historyTiles[1]);
  check("ปฏิทิน: นับบันทึกเป้าหมาย 6", historyTiles[2].includes("6 ครั้ง"), historyTiles[2]);
  check("ปฏิทิน: แสดง 6 แถวแรก", (await historyPanel.locator("li").count()) === 6);
  await page.getByRole("button", { name: "ดูทั้งหมด 10 รายการ" }).click();
  check("ปฏิทิน: กดดูทั้งหมดแล้วครบ 10 แถว", (await historyPanel.locator("li").count()) === 10);

  const targetRow = historyPanel.locator("li").filter({ hasText: "ประชุมทีม" }).first();
  await targetRow.locator("button").click();
  await page.waitForFunction(() => {
    const header = [...document.querySelectorAll("h3")].find((h) => /ต\.ค\./.test(h.textContent ?? ""));
    return Boolean(header);
  });
  const dayTitle = await page.locator("h3").first().innerText();
  check("ปฏิทิน: กดแถวไทม์ไลน์แล้วเลือกวันนั้น", /\d+ ต\.ค\. \d{4}/.test(dayTitle), dayTitle);

  await page.goto(url + "calendar", { waitUntil: "networkidle" });
  await cardByText("ประวัติย้อนหลัง").getByRole("button", { name: /รายละเอียด/ }).click();
  await page.screenshot({ path: `${outBase}-calendar-desktop.png`, fullPage: true });

  // ───────────── 4. mobile ─────────────
  await page.setViewportSize(MOBILE);
  for (const [name, path, cardText] of [
    ["เป้าหมาย", "goals", "QA เป้าหมายรายวัน"],
    ["การเงิน", "finance", "QA บัญชีกสิกร"],
    ["ปฏิทิน", "calendar", "ประวัติย้อนหลัง"],
  ]) {
    await page.goto(`${url}${path}`, { waitUntil: "networkidle" });
    const card = cardByText(cardText);
    await card.waitFor();
    await card.getByRole("button", { name: /รายละเอียด/ }).click();
    await page.waitForTimeout(150);
    check(`mobile 390×844 (${name}): ไม่มี horizontal overflow`, await noOverflow());
  }
  await cardByText("ประวัติย้อนหลัง").getByRole("button", { name: /รายละเอียด/ }).click();
  await page.screenshot({ path: `${outBase}-mobile.png`, fullPage: true });

  check("ไม่มี uncaught page error", pageErrors.length === 0, pageErrors.join(" / "));
} catch (err) {
  check("สคริปต์ทำงานจนจบ", false, err?.message ?? String(err));
  await page.screenshot({ path: `${outBase}-failure.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: !process.exitCode, checks: results.length }, null, 2));
