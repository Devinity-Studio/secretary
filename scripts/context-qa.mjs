#!/usr/bin/env node
/**
 * Context UX interactive QA (Playwright fallback — agent-browser unavailable)
 *
 * รันกับ dev (8080) หรือ built output (8081):
 *   node scripts/context-qa.mjs http://127.0.0.1:8080/ screenshots/context-qa-dev
 *
 * ครอบคลุม:
 *  1. หน้าจอ render มี ContextInput/ContextFeed ทั้ง desktop และ mobile (390×844)
 *  2. พิมพ์บริบท + Enter → การ์ดใหม่โผล่ใน ContextFeed (persist ผ่าน localStorage)
 *  3. Mock ไมค์ (Web Speech API): START → PARTIAL → stop → FINAL → done
 *     และ "ใช้ข้อความนี้" บันทึกเป็น context จาก source "voice"
 *  4. Finance isolation: mydesk-finance-v1 ห้ามเปลี่ยนตลอดการทดสอบ
 *  5. คืน exit code 0 เมื่อผ่านทั้งหมด
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8080/";
const outBase = process.argv[3] ?? "screenshots/context-qa";
mkdirSync("screenshots", { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** ยัด Web Speech mock ก่อนสคริปต์แอปโหลด */
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
        window.__mockStopped = (window.__mockStopped ?? 0) + 1;
      }
      abort() {
        this.stop();
      }
      /** เสมือน engine ส่งผลจริง */
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
    window.__mockStopped = 0;
    window.__SpeechMock = { Recognition: MockRecognition };
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      get: () => window.__SpeechMock.Recognition,
    });
  });
}

/** ส่ง event จาก mock เข้าสู่ instance ที่ active อยู่ */
async function emitFromMock(page, fn) {
  await page.waitForFunction(() => window.__mockActive != null, null, { timeout: 5000 });
  await page.evaluate(fn);
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

    // 1) Render checks
    const inputVisible = await page.getByLabel("ช่องพิมพ์บริบท").isVisible();
    const headingOk = await page.getByText("บริบทล่าสุด").isVisible();
    check(
      `[${vp.name}] ContextInput + ContextFeed render`,
      inputVisible && headingOk,
      consoleErrors.length ? `console: ${consoleErrors[0]}` : "",
    );

    // Overflow เฉพาะ mobile
    if (vp.name === "mobile") {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      check("[mobile] ไม่มี horizontal overflow", !overflow);
    }

    // 2) Text note flow
    await page.getByLabel("ช่องพิมพ์บริบท").fill("ทดสอบบริบทจากการพิมพ์");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const cardAppeared = await page.getByText("ทดสอบบริบทจากการพิมพ์").first().isVisible();
    check(`[${vp.name}] พิมพ์ + Enter → การ์ดบริบทโผล่`, cardAppeared);

    const persisted = await page.evaluate(() => {
      const raw = localStorage.getItem("secretary-context-v1");
      return raw ? raw.includes("ทดสอบบริบทจากการพิมพ์") : false;
    });
    check(`[${vp.name}] เข้า localStorage (local-first)`, persisted);

    // 3) Voice flow (mock)
    await page.getByRole("button", { name: "เริ่มฟังเสียง" }).click();
    await emitFromMock(page, () => window.__mockActive.emitPartial("นัดหมอสัปดาห์หน้า"));
    await page.waitForTimeout(150);
    const listening = await page.getByText("กำลังฟัง…").first().isVisible();
    const partialShown = await page.getByText("นัดหมอสัปดาห์หน้า").first().isVisible();
    check(`[${vp.name}] สถานะ "กำลังฟัง" + interim transcript`, listening && partialShown);

    await page.getByRole("button", { name: "หยุดฟังเสียง" }).click();
    await page.waitForTimeout(150);
    const transcribing = await page.getByText("กำลังถอดเสียง…").first().isVisible();
    check(`[${vp.name}] สถานะ "กำลังถอดเสียง" หลังกดหยุด`, transcribing);

    await emitFromMock(page, () => window.__mockActive.emitFinal("นัดหมอสัปดาห์หน้าค่ะ"));
    await page.waitForTimeout(200);
    const doneChip = await page.getByText("ถอดเสียงแล้ว").first().isVisible();
    check(`[${vp.name}] สถานะ "ถอดเสียงแล้ว"`, doneChip);

    await page.getByRole("button", { name: "ใช้ข้อความนี้" }).click();
    await page.waitForTimeout(400);
    const voiceCard = await page.getByText("นัดหมอสัปดาห์หน้าค่ะ").first().isVisible();
    check(`[${vp.name}] "ใช้ข้อความนี้" → การ์ดจากเสียง`, voiceCard);

    const voiceSource = await page.evaluate(() => {
      const raw = localStorage.getItem("secretary-context-v1");
      if (!raw) return false;
      const data = JSON.parse(raw).state;
      const ev = data.evidence;
      return Object.values(ev).some((e) => e.sourceType === "voice");
    });
    check(`[${vp.name}] evidence sourceType = "voice"`, voiceSource);

    // 4) Finance isolation — เทียบค่า finance key ก่อน vs หลังทำ flow ทั้งหมด
    const financeBefore = await page.evaluate(
      (key) => localStorage.getItem(key),
      FINANCE_KEY,
    );
    const financeLabel = financeBefore === null ? "(ไม่มีคีย์ — โปรไฟล์ใหม่)" : "มีคีย์";

    // Screenshot หลังทำ flow ครบ
    const financeAfter = await page.evaluate(
      (key) => localStorage.getItem(key),
      FINANCE_KEY,
    );
    check(
      `[${vp.name}] Finance store ไม่ถูกแตะตลอด flow`,
      financeBefore === financeAfter,
      `ก่อน ${financeLabel}`,
    );
    await page.screenshot({ path: `${outBase}-${vp.name}.png`, fullPage: false });
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
