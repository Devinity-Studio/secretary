#!/usr/bin/env node
/**
 * Context Card prototype — interactive QA (Playwright fallback)
 *
 * รัน: node scripts/context-card-qa.mjs http://127.0.0.1:8080/ screenshots/context-card-qa-dev
 *
 * ครอบคลุม (บน desktop 1280×800 และ mobile 390×844):
 *  1. Route demo render + WorkflowStrip ครบ 4 step
 *  2. Flow พิมพ์: เปิดช่องพิมพ์ → บันทึก → hero card โชว์ข้อความ (step "การ์ด")
 *  3. Flow ปัด/แก้: แก้ข้อความ + เพิ่ม #แท็ก → การ์ดโชว์ฉบับแก้
 *  4. ยืนยันบริบท → chip เปลี่ยนเป็น "ยืนยันแล้ว"
 *  5. Flow เสียง (mock Web Speech): ฟัง → ถอดเสียง → "ใช้ข้อความนี้" → การ์ดจากเสียง
 *  6. Persist ลง localStorage (local-first) + Finance store ไม่ถูกแตะ
 *  7. Console ไม่มี error, mobile ไม่ล้นจอ
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8080/context-card-demo";
const outBase = process.argv[3] ?? "screenshots/context-card-qa";
mkdirSync("screenshots", { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** ยัด Web Speech mock ก่อนสคริปต์แอปโหลด (แบบเดียวกับ context-qa.mjs) */
async function injectSpeechMock(context) {
  await context.addInitScript(() => {
    class MockRecognition {
      constructor() {
        this.lang = "";
        this.continuous = false;
        this.interimResults = false;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
        window.__mockListeners.push(this);
      }
      start() {
        window.__mockActive = this;
        if (this.onstart) this.onstart();
      }
      stop() {
        // Chrome จริงไม่ยิง onend ทันที — จะส่งผล final ทาง onresult ก่อนค่อย onend
        // (hook มี fallback รอ final หลังหยุดอยู่แล้ว) mock จึงเงียบไว้ตรงนี้
        window.__mockStopped = (window.__mockStopped ?? 0) + 1;
      }
      abort() {
        this.stop();
      }
      emitPartial(text) {
        this.onresult?.({
          resultIndex: 0,
          results: { length: 1, 0: { isFinal: false, length: 1, 0: { transcript: text } } },
        });
      }
      emitFinal(text) {
        this.onresult?.({
          resultIndex: 0,
          results: { length: 1, 0: { isFinal: true, length: 1, 0: { transcript: text } } },
        });
      }
    }
    window.__mockListeners = [];
    window.__SpeechMock = { Recognition: MockRecognition };
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      get: () => window.__SpeechMock.Recognition,
    });
  });
}

async function emitFromMock(page, fn) {
  await page.waitForFunction(() => window.__mockActive != null, null, { timeout: 5000 });
  await page.evaluate(fn);
}

/** ย่อหน้า font-hand ของ hero card ที่มีข้อความใด ๆ */
function heroText(page, text) {
  return page.locator("article p.font-hand", { hasText: text });
}

const FINANCE_KEY = "mydesk-finance-v1";

async function run() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  for (const vp of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await injectSpeechMock(context);
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    page.on("pageerror", (e) => consoleErrors.push(String(e)));

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1200);

    // 1) Render
    const headingOk = await page.getByRole("heading", { name: "Context Card" }).isVisible();
    const stripOk = await page
      .locator('nav[aria-label="ขั้นตอนการทำงานของ Context Card"]')
      .isVisible();
    check(
      `[${vp.name}] demo render + WorkflowStrip`,
      headingOk && stripOk,
      consoleErrors.length ? `console: ${consoleErrors[0]}` : "",
    );

    if (vp.name === "mobile") {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      check(`[${vp.name}] ไม่มี horizontal overflow`, !overflow);
    }

    const financeBefore = await page.evaluate((key) => localStorage.getItem(key), FINANCE_KEY);

    // 2) Flow พิมพ์ → step "การ์ด"
    await page.getByRole("button", { name: "พิมพ์บันทึก" }).click();
    await page.getByLabel("ช่องพิมพ์บริบท").fill("ซื้อกาแฟ 65 บาท");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForTimeout(400);
    const cardShown = await heroText(page, "ซื้อกาแฟ 65 บาท").isVisible();
    check(`[${vp.name}] พิมพ์ → hero card โชว์ข้อความ`, cardShown);
    await page.screenshot({ path: `${outBase}-${vp.name}-card.png` });

    // 3) ปัด/แก้ → แก้ข้อความ + เพิ่มแท็ก
    await page.getByRole("button", { name: "ปัด / แก้ก่อน" }).click();
    await page.waitForTimeout(300);
    await page.locator("#draft-text").fill("ซื้อกาแฟ 65 บาท ที่ร้านใหม่");
    await page.getByLabel("เพิ่มแท็ก").fill("กาแฟ");
    await page.getByLabel("เพิ่มแท็ก").press("Enter");
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "ได้แล้ว ไปยืนยัน" }).click();
    await page.waitForTimeout(400);

    const editedShown = await heroText(page, "ที่ร้านใหม่").isVisible();
    const tagShown = await page.locator("span", { hasText: "#กาแฟ" }).first().isVisible();
    check(`[${vp.name}] แก้ข้อความ + #แท็ก ขึ้นบนการ์ด`, editedShown && tagShown);

    // 4) ยืนยัน
    const confirmVisible = await page.getByRole("button", { name: "ยืนยันบริบท" }).isVisible();
    if (confirmVisible) {
      await page.getByRole("button", { name: "ยืนยันบริบท" }).click();
      await page.waitForTimeout(400);
    }
    const confirmed = await page.locator("span", { hasText: "ยืนยันแล้ว" }).first().isVisible();
    check(`[${vp.name}] ยืนยันบริบท → chip "ยืนยันแล้ว"`, confirmed);
    await page.screenshot({ path: `${outBase}-${vp.name}-confirmed.png` });

    // 5) Flow เสียง (mock) — กลับไป step อินพุตผ่าน WorkflowStrip
    await page
      .locator('nav[aria-label="ขั้นตอนการทำงานของ Context Card"]')
      .getByRole("button", { name: "อินพุต" })
      .click();
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "เริ่มฟังเสียง" }).click();
    await emitFromMock(page, () => window.__mockActive.emitPartial("นัดหมอสัปดาห์หน้า"));
    await page.waitForTimeout(150);
    const listening = await page.getByText("กำลังฟัง…").first().isVisible();
    check(`[${vp.name}] ไมค์: สถานะ "กำลังฟัง" + interim`, listening);

    await page.getByRole("button", { name: "หยุดฟังเสียง" }).click();
    await page.waitForTimeout(200);
    await emitFromMock(page, () => window.__mockActive.emitFinal("นัดหมอสัปดาห์หน้าค่ะ"));
    await page.waitForTimeout(250);
    const doneBox = await page.getByText("ถอดเสียงแล้ว").first().isVisible();
    check(`[${vp.name}] ไมค์: ถอดเสียงเสร็จ มีปุ่มตรวจก่อนบันทึก`, doneBox);

    await page.getByRole("button", { name: "ใช้ข้อความนี้" }).click();
    await page.waitForTimeout(400);
    const voiceCard = await heroText(page, "นัดหมอสัปดาห์หน้าค่ะ").isVisible();
    check(`[${vp.name}] "ใช้ข้อความนี้" → hero card จากเสียง`, voiceCard);
    await page.screenshot({ path: `${outBase}-${vp.name}-voice.png` });

    // 6) Persist + isolation
    const persisted = await page.evaluate(() => {
      const raw = localStorage.getItem("secretary-context-v1");
      if (!raw) return false;
      return (
        raw.includes("ที่ร้านใหม่") &&
        raw.includes("นัดหมอสัปดาห์หน้าค่ะ") &&
        raw.includes('"กาแฟ"')
      );
    });
    check(`[${vp.name}] บันทึกลง localStorage (local-first)`, persisted);

    const voiceEvidence = await page.evaluate(() => {
      const raw = localStorage.getItem("secretary-context-v1");
      if (!raw) return false;
      const data = JSON.parse(raw).state;
      return Object.values(data.evidence).some((e) => e.sourceType === "voice");
    });
    check(`[${vp.name}] evidence sourceType = "voice"`, voiceEvidence);

    const financeAfter = await page.evaluate((key) => localStorage.getItem(key), FINANCE_KEY);
    check(
      `[${vp.name}] Finance store ไม่ถูกแตะตลอด flow`,
      financeBefore === financeAfter,
      financeBefore === null ? "(โปรไฟล์ใหม่ ไม่มีคีย์)" : "",
    );

    // 7) Console สะอาด
    check(`[${vp.name}] console ไม่มี error`, consoleErrors.length === 0, consoleErrors[0] ?? "");

    await context.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nสรุป: ${results.length - failed}/${results.length} ผ่าน${failed ? " — มีตัวที่ยังไม่ผ่าน" : ""}`);
}

run().catch((err) => {
  console.error("QA crashed:", err);
  process.exit(1);
});
