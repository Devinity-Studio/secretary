#!/usr/bin/env node
/**
 * Context sync E2E — login → pull → create → push → reload → cross-device
 *
 * ครอบคลุม (ข้อ 4 ของแผน sync):
 *   A. Login (session cookie ของ @supabase/ssr — password grant)
 *   B. Create context ผ่าน UI จริง → push ขึ้นตาราง contexts + context_evidence
 *   C. Update lifecycle (ยืนยัน) บน "อุปกรณ์ที่สอง" → push
 *   D. Reload อุปกรณ์แรก → LWW merge ดึงเวอร์ชันที่ใหม่กว่ากลับมา
 *   E. RLS: anon อ่านไม่เจอ / user เห็นเฉพาะแถวตัวเอง / เขียน user_id คนอื่นโดน RLS บล็อก
 *   G. Outbox: ออฟไลน์ → สร้างบริบท → push พังเข้าคิว → กลับออนไลน์ → flush ขึ้นคลาวด์อัตโนมัติ
 *
 * ใช้: node scripts/context-sync-e2e.mjs [url]
 * ต้องตั้ง E2E_EMAIL / E2E_PASSWORD (หรือใช้ default ของผู้ทดสอบ)
 */
import { mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

// ── env (อ่าน .env เอง เพราะสคริปต์นี้รันนอก npm script) ──
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const URL = process.argv[2] ?? "http://127.0.0.1:8080/";
const EMAIL = process.env.E2E_EMAIL ?? "e2e.probe.secretary@gmail.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "E2eTest#2026x";
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const REF = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!REF || !ANON_KEY) {
  console.error("ต้องมี SUPABASE_URL + SUPABASE_ANON_KEY ใน .env");
  process.exit(2);
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}
function skip(name, detail = "") {
  results.push({ name, ok: true });
  console.log(`SKIP  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** ตาราง contexts พร้อมหรือยัง (PGRST205 = migration ยังไม่ถูก apply) */
async function tableReady() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contexts?select=id&limit=1`, {
    headers: { apikey: ANON_KEY },
  });
  return res.status === 200;
}

/** Sign in via Supabase password grant → session object */
async function passwordGrant() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`password grant failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Inject Supabase session ผ่าน cookie รูปแบบ @supabase/ssr
 * (base64url + "base64-" prefix; chunk ที่ 3180 ตัวอักษร)
 */
async function injectSessionCookie(browserContext, session) {
  const payload = JSON.stringify(session);
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  const encoded = "base64-" + b64;
  const key = `sb-${REF}-auth-token`;
  const cookies = [];
  if (encoded.length <= 3180) {
    cookies.push({ name: key, value: encoded, domain: "127.0.0.1", path: "/" });
  } else {
    // chunk แบบเดียวกับ createChunks(): encodeURIComponent เพื่อหาขอบเขต แต่เก็บ raw value
    const parts = [];
    let rest = encoded;
    while (rest.length > 0) {
      parts.push(rest.slice(0, 3180));
      rest = rest.slice(3180);
    }
    parts.forEach((value, i) => {
      cookies.push({ name: `${key}.${i}`, value, domain: "127.0.0.1", path: "/" });
    });
  }
  await browserContext.addCookies(cookies);
}

/** REST helper ด้วย access token ของ user (ผ่าน PostgREST) — retry 3 ครั้งเมื่อเครือข่ายหลุดชั่วขณะ */
async function rest(token, method, path, body) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, json: await res.json().catch(() => null) };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function run() {
  mkdirSync("screenshots", { recursive: true });
  const session = await passwordGrant();
  const token = session.access_token;
  const uid = session.user.id;
  const ready = await tableReady();
  console.log(`ตาราง contexts: ${ready ? "พร้อม ✓" : "ยังไม่ถูกสร้าง (migration 0003 ยังไม่ apply) — รันโหมด resilience"}\n`);

  // ── เก็บกวาดแถวเก่าของ user ทดสอบ (ให้ผลรันซ้ำได้) — ตารางยังไม่มีก็ข้ามได้
  if (ready) {
    await rest(token, "DELETE", `contexts?user_id=eq.${uid}`);
    await rest(token, "DELETE", `context_evidence?user_id=eq.${uid}`);
  }

  // ══ A. Login (session cookie) → app เห็น signed-in state ══
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const device1 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await injectSessionCookie(device1, session);
  const page = await device1.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  async function trackFailures(pg) {
    pg.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    pg.on("pageerror", (e) => consoleErrors.push(String(e)));
    pg.on("response", async (res) => {
      if (res.status() >= 400) {
        let body = "";
        try {
          body = (await res.text()).slice(0, 250);
        } catch {}
        failedRequests.push({ status: res.status(), url: res.url(), body });
      }
    });
  }
  await trackFailures(page);

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  const input = page.getByLabel("ช่องพิมพ์บริบท");
  check("A: เห็นช่องพิมพ์บริบทหลัง login", await input.isVisible());

  // ══ B. Create context ผ่าน UI จริง → push ขึ้นคลาวด์ ══
  const noteText = `บริบททดสอบ sync ${Date.now()}`;
  await input.fill(noteText);
  await input.press("Enter");
  await page.waitForTimeout(2500); // รอ fire-and-forget push

  if (!ready) {
    // โหมด pre-migration: push ต้อง fail แบบมีผู้รับผิดชอบ — toast เตือนต้องโผล่
    const toast = page.getByText("บันทึกขึ้นคลาวด์ไม่สำเร็จ").first();
    const toastShown = await toast.isVisible().catch(() => false);
    check("B0: push ล้มเหลวแบบ fail-loud — toast แจ้งผู้ใช้ทันที (ข้อมูลยังอยู่ในเครื่อง)", toastShown);
  }

  const { json: pushedCtxs } = await rest(token, "GET", `contexts?select=id,type,lifecycle,archived&user_id=eq.${uid}`);
  const pushed = Array.isArray(pushedCtxs) ? pushedCtxs.find((c) => c.archived === false) : null;
  if (ready) {
    check("B: context ถูก push ขึ้นตาราง contexts", Boolean(pushed), JSON.stringify(pushedCtxs)?.slice(0, 120));
  } else {
    skip("B: context ถูก push ขึ้นตาราง contexts", "ตารางยังไม่มี — push ต้องโดน toast เตือน ไม่พัง (ดู F)");
  }

  const { json: pushedEvs } = await rest(token, "GET", `context_evidence?select=id,source_type,content&user_id=eq.${uid}`);
  const evidenceRows = Array.isArray(pushedEvs) ? pushedEvs : [];
  const evTexts = evidenceRows
    .filter((e) => e.content?.text)
    .map((e) => e.content.text);
  const evidencePushed = evTexts.some((t) => t.includes(noteText));
  if (ready) {
    check("B: evidence (ข้อความดิบ) ถูก push ขึ้น context_evidence", evidencePushed, evTexts.join(" | ").slice(0, 120));
  } else {
    skip("B: evidence (ข้อความดิบ) ถูก push ขึ้น context_evidence");
  }

  // ══ B2. Reload → ข้อมูลยังอยู่ (localStorage persist) ══
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const feedAfterReload = page.locator("article").filter({ hasText: noteText });
  const stillVisible = (await feedAfterReload.count()) > 0;
  check("B2: reload แล้วบริบทยังอยู่ (local-first persist)", stillVisible);

  // ══ C. อุปกรณ์ที่สอง: session ใหม่ + pull + update lifecycle ══
  const device2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await injectSessionCookie(device2, session);
  const page2 = await device2.newPage();
  await trackFailures(page2);
  await page2.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page2.waitForTimeout(3500); // รอ useSyncOnLogin pull

  const card2 = page2.locator("article").filter({ hasText: noteText });
  if (ready) {
    check("C: อุปกรณ์ที่สอง pull บริบทจากคลาวด์ได้", (await card2.count()) > 0);
  } else {
    skip("C: อุปกรณ์ที่สอง pull บริบทจากคลาวด์ได้", "pull ต้อง fail-loud + toast ไม่ overwrite local (ดู F)");
  }

  if ((await card2.count()) > 0 && ready) {
    // ปุ่มยืนยันอยู่บนหน้ารวมบริบท (/context) — ไม่ใช่หน้าแรก
    // (URL เป็น string constant ของสคริปต์ — ห้ามใช้ global URL constructor)
    const contextPageUrl = URL.replace(/\/?$/, "/") + "context";
    await page2.goto(contextPageUrl, { waitUntil: "domcontentloaded" });
    await page2.waitForTimeout(1500);
    // ปุ่มยืนยันเป็น "พี่น้อง" ของ <article> (wrapper div.relative > Card + Button)
    // จึงหาผ่าน aria-label ที่มี context id ตรงตัวแทนการ scope ใน article
    const confirmBtn = page2.getByRole("button", { name: `ยืนยันบริบท ${pushed.id}` });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page2.waitForTimeout(2500);
      const { json: afterConfirm } = await rest(token, "GET", `contexts?select=lifecycle&user_id=eq.${uid}&id=eq.${pushed.id}`);
      check(
        "C: ยืนยันบนอุปกรณ์ที่สอง → lifecycle confirmed push ขึ้นคลาวด์",
        afterConfirm?.[0]?.lifecycle === "confirmed",
        JSON.stringify(afterConfirm),
      );
    } else {
      check("C: ไม่พบปุ่มยืนยันบนหน้า /context (บริบทไม่ได้อยู่ในสถานะ tentative หรือการ์ดไม่แสดง)", false, `cards=${await page2.locator("article").filter({ hasText: noteText }).count()}`);
    }
  }

  // ══ D. อุปกรณ์แรก reload → LWW merge ดึงเวอร์ชันใหม่ ══
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000); // รอ pull + merge
  const card1 = page.locator("article").filter({ hasText: noteText });
  const badge1 = await card1.getByText("ยืนยันแล้ว").first().isVisible().catch(() => false);
  if (ready) {
    if (!badge1) {
      // debug: ดูสถานะจริงใน localStorage หลัง reload + merge ว่า merge ไม่ apply หรือ UI ไม่อัปเดต
      const dump = await page.evaluate(() => {
        try {
          const raw = JSON.parse(localStorage.getItem("secretary-context-v1") ?? "{}");
          const ctxs = Object.values(raw?.state?.contexts ?? {});
          return ctxs
            .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
            .slice(0, 3)
            .map((c) => ({ id: String(c.id).slice(0, 8), lifecycle: c.lifecycle, updatedAt: c.updatedAt }));
        } catch (e) {
          return [{ error: String(e) }];
        }
      });
      console.log("DEBUG local store หลัง reload:", JSON.stringify(dump));
      console.log("DEBUG console errors ทั้งหมด:", JSON.stringify(consoleErrors, null, 1));
    }
    check("D: อุปกรณ์แรก merge เอา lifecycle ล่าสุด (ยืนยันแล้ว) กลับมา", badge1);
  } else {
    skip("D: อุปกรณ์แรก merge เอา lifecycle ล่าสุด (ยืนยันแล้ว) กลับมา");
  }

  // ══ E. RLS — ต้องบล็อกจริงทุกกรณี ══
  const anon = await fetch(`${SUPABASE_URL}/rest/v1/contexts?select=id&limit=5`, {
    headers: { apikey: ANON_KEY },
  });
  const anonJson = await anon.json();
  if (ready) {
    check("E1: anon (ไม่มี token) อ่านตาราง contexts ไม่ได้", anon.status === 401 || (Array.isArray(anonJson) && anonJson.length === 0), `HTTP ${anon.status}`);
  } else {
    skip("E1: anon (ไม่มี token) อ่านตาราง contexts ไม่ได้", "ยังไม่มีตารางให้ทดสอบ RLS");
  }

  const { json: allRowsJson } = await rest(token, "GET", "contexts?select=id,user_id&limit=100");
  const allRows = Array.isArray(allRowsJson) ? allRowsJson : [];
  if (ready) {
    check("E2: user เห็นเฉพาะแถวตัวเอง (RLS scoping)", allRows.every((r) => r.user_id === uid), `${allRows.length} rows`);
  } else {
    skip("E2: user เห็นเฉพาะแถวตัวเอง (RLS scoping)");
  }

  const { status: forgedStatus } = await rest(token, "POST", "contexts", {
    id: "forged-row-should-fail",
    user_id: "00000000-0000-0000-0000-000000000000",
    type: "user.note",
  });

  if (ready) {
    check("E3: ออก user_id คนอื่น → insert โดน RLS บล็อก", forgedStatus >= 400, `HTTP ${forgedStatus}`);
  } else {
    skip("E3: ออก user_id คนอื่น → insert โดน RLS บล็อก");
  }

  // ══ G. Outbox — offline → create → online → flush ══
  // push ที่พังตอนออฟไลน์ต้องถูกเก็บในคิว (localStorage) แล้วถูกส่งใหม่เองเมื่อออนไลน์กลับมา
  const readOutboxCount = () =>
    page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("secretary-sync-outbox-v1") ?? "[]").length;
      } catch {
        return -1;
      }
    });

  if (ready) {
    // G1: ตัดเน็ต → สร้างบริบท → ต้องใช้ได้ทันที (local-first)
    await device1.setOffline(true);
    const offlineNote = `บริบทออฟไลน์ ${Date.now()}`;
    await input.fill(offlineNote);
    await input.press("Enter");
    await page.waitForTimeout(1500);
    const offlineCard = page.locator("article").filter({ hasText: offlineNote });
    check("G1: ออฟไลน์ — สร้างบริบทได้ทันที (local-first ไม่โดนบล็อก)", (await offlineCard.count()) > 0);

    // G2: push ที่พังต้องลง outbox ไม่ใช่หายเงียบ
    await page.waitForTimeout(1000); // รอ fire-and-forget push reject + enqueue
    const queued = await readOutboxCount();
    check("G2: push ที่พังถูกเก็บใน outbox (รอส่งใหม่)", queued > 0, `queued=${queued}`);

    // G3: ระหว่างออฟไลน์ คลาวด์ต้องยังไม่มีข้อมูล
    const { json: evBefore } = await rest(token, "GET", `context_evidence?select=id,content&user_id=eq.${uid}`);
    const evBeforeMatch = Array.isArray(evBefore) && evBefore.some((e) => e.content?.text?.includes(offlineNote));
    check("G3: ระหว่างออฟไลน์ คลาวด์ยังไม่มีข้อมูล", !evBeforeMatch);

    // G4: กลับออนไลน์ → online event → flush → ข้อมูลขึ้นคลาวด์เอง
    await device1.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForTimeout(6000); // debounce + replay (context + evidence)

    const { json: evAfter } = await rest(token, "GET", `context_evidence?select=id,content&user_id=eq.${uid}`);
    const evAfterMatch = Array.isArray(evAfter) && evAfter.some((e) => e.content?.text?.includes(offlineNote));
    check("G4: กลับออนไลน์ — outbox flush ส่งข้อมูลขึ้นคลาวด์อัตโนมัติ", evAfterMatch);

    // G5: flush สำเร็จแล้วคิวต้องว่าง
    const queuedAfter = await readOutboxCount();
    check("G5: outbox ว่างหลัง flush สำเร็จ", queuedAfter === 0, `queued=${queuedAfter}`);
  } else {
    skip("G1: ออฟไลน์ — สร้างบริบทได้ทันที (local-first ไม่โดนบล็อก)", "โหมด pre-migration");
    skip("G2: push ที่พังถูกเก็บใน outbox (รอส่งใหม่)");
    skip("G3: ระหว่างออฟไลน์ คลาวด์ยังไม่มีข้อมูล");
    skip("G4: กลับออนไลน์ — outbox flush ส่งข้อมูลขึ้นคลาวด์อัตโนมัติ");
    skip("G5: outbox ว่างหลัง flush สำเร็จ");
  }

  // ══ H. Realtime — อุปกรณ์หนึ่งสร้าง อุปกรณ์สองเห็นทันที (ไม่ reload) ══
  // ต้อง apply migrations/0004_realtime_contexts.sql (publication) ก่อน —
  // ไม่งั้น subscribe สำเร็จแต่ event ไม่เคยมา จึ่ skip อย่างซื่อสัตย์
  // จนกว่าจะรันด้วย E2E_EXPECT_REALTIME=1 หลัง apply แล้ว
  const expectRealtime = process.env.E2E_EXPECT_REALTIME === "1";
  if (ready && expectRealtime) {
    const realtimeNote = `บริบท realtime ${Date.now()}`;
    await input.fill(realtimeNote);
    await input.press("Enter");

    // H1: อุปกรณ์ที่สอง (page2 ไม่เคย reload) ต้องเห็นการ์ดใหม่เองภายใน ~8 วินาที
    let seen = false;
    for (let i = 0; i < 16 && !seen; i++) {
      await page2.waitForTimeout(500);
      seen = (await page2.locator("article").filter({ hasText: realtimeNote }).count()) > 0;
    }
    check("H1: realtime — อุปกรณ์ที่สองเห็นบริบทใหม่ทันทีโดยไม่ reload", seen);

    // H2: soft-delete จาก "อีกอุปกรณ์" (PATCH deleted_at ผ่าน API) → การ์ดหายเอง
    const { json: rtEvs } = await rest(token, "GET", `context_evidence?select=id,content&user_id=eq.${uid}`);
    const rtEv = Array.isArray(rtEvs) ? rtEvs.find((e) => e.content?.text?.includes(realtimeNote)) : null;
    const { json: rtCtxs } = await rest(token, "GET", `contexts?select=id,evidence_ids&user_id=eq.${uid}`);
    const rtCtx =
      Array.isArray(rtCtxs) && rtEv ? rtCtxs.find((c) => Array.isArray(c.evidence_ids) && c.evidence_ids.includes(rtEv.id)) : null;
    if (rtCtx) {
      await rest(token, "PATCH", `contexts?id=eq.${rtCtx.id}`, { deleted_at: new Date().toISOString() });
      let gone = false;
      for (let i = 0; i < 16 && !gone; i++) {
        await page2.waitForTimeout(500);
        gone = (await page2.locator("article").filter({ hasText: realtimeNote }).count()) === 0;
      }
      check("H2: realtime soft-delete — การ์ดหายจากอุปกรณ์ที่สองเอง", gone);
    } else {
      check("H2: realtime soft-delete — การ์ดหายจากอุปกรณ์ที่สองเอง", false, "หา context ของโน้ต realtime ไม่เจอ");
    }
  } else {
    skip("H1: realtime — อุปกรณ์ที่สองเห็นบริบทใหม่ทันทีโดยไม่ reload", "ต้อง apply migrations/0004_realtime_contexts.sql แล้วรันใหม่ด้วย E2E_EXPECT_REALTIME=1");
    skip("H2: realtime soft-delete — การ์ดหายจากอุปกรณ์ที่สองเอง");
  }

  // F: console ต้องไม่มี uncaught/hard errors — sync failure (toast + console.error
  // ของ notify*) เป็นพฤติกรรมที่ออกแบบไว้แล้วเมื่อตารางยังไม่มี จึงแยกออกจาก hard error
  const syncNoiseRe = /\[sync\]|\[realtime\]|PGRST|Could not find the table|supabase/i;
  // โหมด pre-migration: PostgREST คืน HTTP 404 สำหรับตารางที่ยังไม่มี ซึ่งโผล่ใน console
  // เป็นข้อความ generic ของ browser — จัดเป็น sync noise เฉพาะเมื่อ !ready เท่านั้น
  const resourceNoiseRe = /Failed to load resource/i;
  // ส่วน G (ทดสอบ outbox) ตัดเน็ตจริง — browser log resource failure ตอน offline โดยดีไซน์
  const offlineNoiseRe = /net::ERR_INTERNET_DISCONNECTED/i;
  const isSyncNoise = (e) => syncNoiseRe.test(e) || offlineNoiseRe.test(e) || (!ready && resourceNoiseRe.test(e));
  const syncNoise = consoleErrors.filter(isSyncNoise);
  if (syncNoise.length > 0) {
    console.log("DEBUG sync-noise:", JSON.stringify(syncNoise.slice(0, 6), null, 1));
  }
  const hardErrors = consoleErrors.filter((e) => !isSyncNoise(e));
  check(
    "F: ไม่มี hard console/page errors (sync failure แจ้งเป็น toast เท่านั้น)",
    hardErrors.length === 0,
    hardErrors[0] ?? `sync-noise ${syncNoise.length} รายการ (คาดหมายได้)`,
  );
  if (!ready) {
    check(
      "F2: ไม่มี request ที่โดน 4xx นอกเหนือจาก sync noise (โหมด pre-migration)",
      failedRequests.length === 0,
      JSON.stringify(failedRequests.slice(0, 2)),
    );
  } else {
    check(
      "F2: ไม่มี request ใดโดน 4xx เลย (ตารางพร้อมแล้ว — ทุก request ต้องสำเร็จ)",
      failedRequests.length === 0,
      JSON.stringify(failedRequests.slice(0, 3)),
    );
  }

  await page.screenshot({ path: "screenshots/context-sync-e2e-device1.png" });
  await page2.screenshot({ path: "screenshots/context-sync-e2e-device2.png" });
  await device1.close();
  await device2.close();
  await browser.close();

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nสรุป E2E sync: ${results.length - failed}/${results.length} ผ่าน`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("E2E crashed:", err);
  process.exit(1);
});
