import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { projectRoot } from "./with-app-env.mjs";

/**
 * Migration idempotency — ทำไมต้องมี test นี้
 *
 * Cloud Supabase ปัจจุบันไม่มีตาราง `_migrations` (migration ถูก apply มือผ่าน
 * Dashboard) ดังนั้น deploy ครั้งถัดไป `scripts/migrate.mjs` จะมองทุกไฟล์ว่า
 * "pending" แล้วรันซ้ำตั้งแต่ 0002 — ไฟล์ที่ไม่ idempotent (create policy/trigger
 * ล้วน ๆ, drop publication) จะพัง deploy ทันที หรือแย่กว่านั้นคือทำ realtime
 * ของตารางอื่นหายเงียบ ๆ
 *
 * ทดสอบบน PGLite (Postgres จริง embedded) ทั้งหมด — ไม่แตะ cloud เลย
 */

const MIGRATIONS = [
  "0002_supabase_sync.sql",
  "0003_context_sync.sql",
  "0004_realtime_contexts.sql",
];

function migrationText(name) {
  return readFileSync(join(projectRoot(), "migrations", name), "utf8");
}

/** PGLite ใหม่ + auth stub — copy ตรงจาก src/lib/db.ts (createPgliteSql) */
async function freshDb() {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(
    "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  await pg.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
    create or replace function auth.uid() returns uuid
    language sql stable
    as $$ select '00000000-0000-0000-0000-000000000000'::uuid $$;
    insert into auth.users (id, email) values
      ('00000000-0000-0000-0000-000000000000', 'dev@preview.local')
    on conflict (id) do nothing;
  `);
  return pg;
}

async function apply(pg, name) {
  await pg.transaction(async (tx) => {
    await tx.exec(migrationText(name));
    await tx.query("insert into _migrations (name) values ($1)", [name]);
  });
}

test("migrations 0002–0004 apply เรียงลำดับบน Postgres จริง (PGLite)", async () => {
  const pg = await freshDb();
  try {
    for (const name of MIGRATIONS) await apply(pg, name);
    const done = await pg.query("select name from _migrations order by name");
    assert.deepEqual(
      done.rows.map((r) => r.name),
      MIGRATIONS,
    );
  } finally {
    await pg.close();
  }
});

test("ทุก migration รันซ้ำได้ — deploy ที่ไม่มี _migrations ต้องไม่พัง", async () => {
  const pg = await freshDb();
  try {
    for (const name of MIGRATIONS) await apply(pg, name);
    // Re-run ทั้งหมดแบบไม่ record — ต้องผ่านทุกไฟล์ (drop-if-exists /
    // if not exists / DO block จัดการ duplicate เอง)
    for (const name of MIGRATIONS) await pg.exec(migrationText(name));
  } finally {
    await pg.close();
  }
});

test("0004 additive เสมอ — สมาชิกเดิมของ publication ต้องรอด (ห้าม drop publication)", async () => {
  const pg = await freshDb();
  try {
    await apply(pg, "0002_supabase_sync.sql");
    await apply(pg, "0003_context_sync.sql");
    // เลียนแบบ Supabase จริง: publication มีอยู่ก่อนแล้ว พร้อมตารางของคนอื่น
    await pg.exec(`
      create table public.preexisting (id int);
      create publication supabase_realtime;
      alter publication supabase_realtime add table public.preexisting;
    `);
    await apply(pg, "0004_realtime_contexts.sql");
    // รันซ้ำ — duplicate_object path ต้องข้ามอย่างเงียบ ๆ
    await pg.exec(migrationText("0004_realtime_contexts.sql"));

    const members = await pg.query(
      "select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename",
    );
    const names = members.rows.map((r) => r.tablename);
    assert.ok(
      names.includes("preexisting"),
      "สมาชิกเดิมต้องไม่หาย — drop publication จะทำ realtime ของตารางอื่นพังเงียบ ๆ",
    );
    assert.ok(names.includes("contexts"), "contexts ต้องอยู่ใน publication");
    assert.ok(names.includes("context_evidence"), "context_evidence ต้องอยู่ใน publication");
  } finally {
    await pg.close();
  }
});

test("RLS + policies + triggers ครบตามดีไซน์ (7 ตาราง / 28 policies / 4 triggers)", async () => {
  const pg = await freshDb();
  try {
    for (const name of MIGRATIONS) await apply(pg, name);
    const pol = await pg.query("select count(*)::int as n from pg_policies where schemaname='public'");
    assert.equal(pol.rows[0].n, 28, "20 policies จาก 0002 + 8 จาก 0003");
    const trg = await pg.query(
      "select count(*)::int as n from pg_trigger where not tgisinternal and tgname='set_updated_at'",
    );
    assert.equal(trg.rows[0].n, 4, "updated_at trigger บน 4 ตารางของ 0002");
    const rls = await pg.query(
      "select count(*)::int as n from pg_class where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity",
    );
    assert.equal(rls.rows[0].n, 7, "ทุกตาราง sync ต้องเปิด RLS");
  } finally {
    await pg.close();
  }
});
