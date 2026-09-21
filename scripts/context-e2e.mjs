#!/usr/bin/env node
/**
 * Context UX — full end-to-end pass (ข้อ 1)
 *
 * ขยายจาก context-qa.mjs: ครอบ flow ที่ผู้ใช้เจอจริงครบวง
 *   A. พิมพ์ 2 โน้ต → เรียงใหม่บนสุด
 *   B. reload → persist ยังอยู่
 *   C. ไมค์ (mock): ฟัง → หยุด → done → "แก้ไขก่อน" → แก้ข้อความ → บันทึกเป็น user
 *   D. ไมค์: error (not-allowed) → ข้อความ error + กดเริ่มใหม่ได้
 *   E. ป้าย lifecycle บนการ์ด
 *   F. empty state
 *   G. Finance isolation + console สะอาด
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8080/";
const outBase = process.argv[3] ?? "screenshots/context-e2e";
mkdirSync("screenshots", { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

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
        window.__mockInstances.push(this);
      }
      start() {
        window.__mockActive = this;
      }
      stop() {
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
      emitError(code) {
        this.onerror?.({ error: code });
      }
    }
    window.__mockInstances = [];
    window.__mockActive = null;
    window.__SpeechMock = { Recognition: MockRecognition };
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      get: () => window.__SpeechMock.Recognition,
    });
  });
}

const FINANCE_KEY = "mydesk-finance-v1";

async function run() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await injectSpeechMock(context);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  const input = page.getByLabel("ช่องพิมพ์บริบท");
  const micButton = page.getByRole("button", { name: "เริ่มฟังเสียง" });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);

  // F) Empty state ก่อนบันทึกอะไร
  const emptyState = await page.getByText("ยังไม่มีบริบทที่บันทึกไว้").isVisible();
  check("F: empty state ก่อนมีบริบท", emptyState);

  // A) พิมพ์สองโน้ต
  const financeBefore = await page.evaluate((k) => localStorage.getItem(k), FINANCE_KEY);

  await input.fill("โน้ตแรกสำหรับทดสอบเรียงลำดับ");
  await input.press("Enter");
  await page.waitForTimeout(300);
  await input.fill("โน้ตที่สองควรอยู่บนสุด");
  await input.press("Enter");
  await page.waitForTimeout(400);

  const firstCard = page.locator("article").first();
  const firstCardText = await firstCard.innerText();
  check("A: โน้ตใหม่สุดเรียงบนการ์ดแรก", firstCardText.includes("โน้ตที่สอง"));

  // B) Reload → persist
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const persistedFirst = await page.locator("article").first().innerText();
  check("B: reload แล้วบริบทยังอยู่ (persist)", persistedFirst.includes("โน้ตที่สอง"));
  const persistedCount = await page.locator("article").count();
  check("B: มีครบ 2 การ์ดหลัง reload", persistedCount === 2, `count=${persistedCount}`);

  // C) ไมค์ → แก้ไขก่อน → บันทึกเป็น user
  await page.getByRole("button", { name: "เริ่มฟังเสียง" }).click();
  await page.waitForFunction(() => window.__mockActive != null, null, { timeout: 5000 });
  await page.evaluate(() => window.__mockActive.emitPartial("นัดส่งเอกสารที่ธนาคาร"));
  await page.waitForTimeout(150);
  const listening = await page.getByText("กำลังฟัง…").first().isVisible();
  check("C: สถานะกำลังฟัง + interim", listening);

  await page.getByRole("button", { name: "หยุดฟังเสียง" }).click();
  await page.evaluate(() => window.__mockActive?.emitFinal("นัดส่งเอกสารที่ธนาคารครับ"));
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "แก้ไขก่อน" }).click();
  await page.waitForTimeout(200);

  const editValue = await input.inputValue();
  check("C: \"แก้ไขก่อน\" ดึง transcript กลับช่องพิมพ์", editValue.includes("นัดส่งเอกสาร"));

  await input.fill("นัดส่งเอกสารที่ธนาคารแก้ไขแล้ว");
  await page.getByRole("button", { name: "บันทึกบริบท" }).click();
  await page.waitForTimeout(400);

  const editedOrigin = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("secretary-context-v1") ?? "{}").state;
    const hit = Object.values(data.evidence).find((e) =>
      (e.content?.text ?? "").includes("แก้ไขแล้ว"),
    );
    return hit?.sourceType ?? "not-found";
  });
  check("C: หลังแก้แล้วบันทึกเป็น source user (ไม่ใช่ voice)", editedOrigin === "user", editedOrigin);

  // D) ไมค์ error → ข้อความอ่านง่าย + เริ่มใหม่ได้
  await micButton.click();
  await page.waitForFunction(() => window.__mockActive != null, null, { timeout: 5000 });
  await page.evaluate(() => window.__mockActive.emitError("not-allowed"));
  await page.waitForTimeout(200);
  const errorMsg = await page.getByText(/ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน/).first().isVisible();
  check("D: error ไมโครโฟนแสดงข้อความอ่านง่าย", errorMsg);

  // หลัง error กดไมค์ซ้ำต้องเริ่มใหม่ได้ (state machine กลับ listening)
  await micButton.click();
  await page.waitForTimeout(200);
  const relistening = await page.getByText("กำลังฟัง…").first().isVisible();
  check("D: หลัง error กดไมค์ใหม่ฟังต่อได้", relistening);

  // E) ป้าย lifecycle แสดงบนการ์ด (การยืนยันจะมาพร้อมหน้ารวมบริบท — รอบถัดไป)
  const badge = await page.locator("article").first().getByText("รอยืนยัน").first().isVisible();
  check("E: การ์ดแสดง lifecycle 'รอยืนยัน'", badge);

  // G) Finance isolation + console สะอาด
  const financeAfter = await page.evaluate((k) => localStorage.getItem(k), FINANCE_KEY);
  check("G: Finance store ไม่ถูกแตะ", financeBefore === financeAfter);
  check("G: ไม่มี console/page errors ตลอดเซสชัน", consoleErrors.length === 0, consoleErrors[0] ?? "");

  await page.screenshot({ path: `${outBase}-mobile.png`, fullPage: false });
  await context.close();
  await browser.close();

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nสรุป E2E: ${results.length - failed}/${results.length} ผ่าน`);
}

run().catch((err) => {
  console.error("E2E crashed:", err);
  process.exit(1);
});
