#!/usr/bin/env node
/**
 * Context overview page QA (/context)
 *
 * ครอบคลุม:
 *  1. เข้าถึงหน้าผ่าน nav "บริบท" (desktop) และลิงก์ตรง (mobile)
 *  2. แสดงรายการ + นับชิปตรงกับจำนวนการ์ด
 *  3. ค้นหากรองเหลือเฉพาะที่ตรง / ล้างคำค้น
 *  4. กรอง lifecycle ทั้งสองทิศ / กรองช่องทาง voice
 *  5. ปุ่มยืนยัน: tentative → ยืนยันแล้ว และปุ่มหายไป
 *  6. ตัวกรองที่ไม่ตรงใคร → empty state "ไม่มีบริบทที่ตรงกับตัวกรอง"
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8080/";
const outBase = process.argv[3] ?? "screenshots/context-overview";
mkdirSync("screenshots", { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  for (const vp of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    page.on("pageerror", (e) => consoleErrors.push(String(e)));

    // seed ข้อมูลผ่านหน้าแรก (ทางการสุด — ผ่าน UI จริง)
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1000);
    const input = page.getByLabel("ช่องพิมพ์บริบท");
    await input.fill("ลูกค้า A ขอใบเสนอราคา");
    await input.press("Enter");
    await page.waitForTimeout(250);
    await input.fill("ประชุมทีมวันศุกร์");
    await input.press("Enter");
    await page.waitForTimeout(400);

    // 1) เข้าหน้า /context
    if (vp.name === "desktop") {
      await page.getByRole("link", { name: "บริบท", exact: true }).click();
    } else {
      // mobile มี bottom nav — ลิงก์ "บริบท" ก็อยู่ในนั้น
      await page.getByRole("link", { name: "บริบท", exact: true }).click();
    }
    await page.waitForTimeout(600);
    check(`[${vp.name}] เปิดหน้า /context ผ่าน nav`, page.url().includes("/context"));

    // 2) รายการ + ชิปนับ
    const chips = await page.getByRole("button", { name: /^ทั้งหมด/ }).innerText();
    check(`[${vp.name}] ชิป "ทั้งหมด" มีตัวเลข 2`, chips.includes("2"), chips.replace(/\s+/g, " "));
    const cards = await page.locator("article").count();
    check(`[${vp.name}] แสดงการ์ดครบ 2`, cards === 2, `count=${cards}`);

    // 5) ยืนยันรายการแรก (tentative → confirmed)
    await page.getByRole("button", { name: /ยืนยันบริบท/ }).first().click();
    await page.waitForTimeout(300);
    const confirmedBadge = await page.locator("article").first().getByText("ยืนยันแล้ว").first().isVisible();
    const confirmButtonsLeft = await page.getByRole("button", { name: /ยืนยันบริบท/ }).count();
    check(`[${vp.name}] ยืนยันสำเร็จ → ป้ายเปลี่ยน + ปุ่มหาย`, confirmedBadge && confirmButtonsLeft === 1);

    // 3) ค้นหา
    await page.getByLabel("ช่องค้นหาบริบท").fill("ใบเสนอราคา");
    await page.waitForTimeout(250);
    const searchHit = await page.locator("article").count();
    check(`[${vp.name}] ค้นหากรองเหลือ 1`, searchHit === 1, `count=${searchHit}`);
    await page.getByRole("button", { name: "ล้างคำค้นหา" }).click();
    await page.waitForTimeout(200);
    const cleared = await page.locator("article").count();
    check(`[${vp.name}] ล้างคำค้นกลับมา 2`, cleared === 2, `count=${cleared}`);

    // 4) กรอง lifecycle / source
    await page.getByRole("button", { name: /^รอยืนยัน/ }).click();
    await page.waitForTimeout(200);
    const tentativeOnly = await page.locator("article").count();
    check(`[${vp.name}] กรอง "รอยืนยัน" เหลือ 1`, tentativeOnly === 1, `count=${tentativeOnly}`);

    await page.getByRole("button", { name: /^ทั้งหมด/ }).click();
    await page.getByRole("button", { name: "เสียง", exact: true }).click();
    await page.waitForTimeout(200);
    const voiceEmpty = await page.getByText("ไม่มีบริบทที่ตรงกับตัวกรอง").isVisible();
    check(`[${vp.name}] กรอง "เสียง" ไม่ตรงใคร → empty state`, voiceEmpty);

    await page.screenshot({ path: `${outBase}-${vp.name}.png`, fullPage: false });
    check(`[${vp.name}] ไม่มี console errors`, consoleErrors.length === 0, consoleErrors[0] ?? "");
    await context.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nสรุป: ${results.length - failed}/${results.length} ผ่าน`);
}

run().catch((err) => {
  console.error("QA crashed:", err);
  process.exit(1);
});
