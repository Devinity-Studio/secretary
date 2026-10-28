import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CaptureBar } from "@/components/capture-bar";
import { ContextInput } from "@/components/context-input";
import { ContextFeed } from "@/components/context-feed";
import { VoiceHome } from "@/components/voice-home";
import { Modal } from "@/components/modal";
import { PeriodSwitch } from "@/components/period-switch";
import { SummaryCards } from "@/components/summary-cards";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { summarize, useFinanceStore } from "@/lib/finance/store";
import { useContextStore } from "@/lib/context/store";
import type { PeriodKey, Transaction } from "@/lib/finance/types";
import { formatBaht } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const transactions = useFinanceStore((s) => s.transactions);
  const accounts = useFinanceStore((s) => s.accounts);
  const contextsRecord = useContextStore((s) => s.contexts);
  const evidence = useContextStore((s) => s.evidence);
  const [period, setPeriod] = useState<PeriodKey>("day");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const stats = useMemo(() => summarize(transactions, period), [transactions, period]);
  const cashLike = accounts
    .filter((a) => !a.archived && a.type !== "credit")
    .reduce((s, a) => s + a.currentBalance, 0);
  const debt = accounts.filter((a) => a.type === "credit").reduce((s, a) => s + a.currentBalance, 0);

  return (
    <AppShell>
      {/* ══ Mobile: voice-first home ตาม Guide + สรีระมือ ══ */}
      <div className="md:hidden">
        <VoiceHome contextsRecord={contextsRecord} evidenceById={evidence} />
      </div>

      {/* ══ Desktop: แดชบอร์ดแบบเดิม (ปรับลด QuotaCard ออก — มีหน้า /quota แล้ว) ══ */}
      <div className="hidden space-y-5 md:block">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">วันนี้</h1>
          <p className="mt-1 text-sm text-muted">
            เงินที่ใช้ได้ {formatBaht(cashLike)}
            {debt > 0 ? ` · หนี้บัตร ${formatBaht(debt)}` : ""}
          </p>
        </div>
        <CaptureBar onNeedForm={() => { setEditing(null); setFormOpen(true); }} />
        <ContextInput />
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">บริบทล่าสุด</h2>
          <ContextFeed limit={5} />
        </section>
        <PeriodSwitch value={period} onChange={setPeriod} />
        <SummaryCards income={stats.income} expense={stats.expense} net={stats.net} />
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted">รายการ</h2>
          <TransactionList
            items={stats.list}
            onEdit={(tx) => {
              setEditing(tx);
              setFormOpen(true);
            }}
          />
        </div>
      </div>

      <Modal
        title={editing ? "แก้ไขรายการ" : "เพิ่มรายการ"}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      >
        <TransactionForm
          initial={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      </Modal>
    </AppShell>
  );
}
