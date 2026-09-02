import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CaptureBar } from "@/components/capture-bar";
import { Modal } from "@/components/modal";
import { PeriodSwitch } from "@/components/period-switch";
import { SummaryCards } from "@/components/summary-cards";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { summarize, useFinanceStore } from "@/lib/finance/store";
import type { PeriodKey, Transaction, TransactionType } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/finance")({ component: FinancePage });

const FILTERS: Array<{ id: "all" | TransactionType; label: string }> = [
  { id: "all", label: "ทั้งหมด" },
  { id: "income", label: "รายรับ" },
  { id: "expense", label: "รายจ่าย" },
  { id: "transfer", label: "โอน" },
];

function FinancePage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const stats = useMemo(() => summarize(transactions, period), [transactions, period]);
  const list = filter === "all" ? stats.list : stats.list.filter((t) => t.type === filter);

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">การเงิน</h1>
          <p className="mt-1 text-sm text-muted">รายรับ · รายจ่าย · โอนข้ามบัญชี</p>
        </div>
        <CaptureBar
          onNeedForm={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
        <PeriodSwitch value={period} onChange={setPeriod} />
        <SummaryCards income={stats.income} expense={stats.expense} net={stats.net} />
        <div className="flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-10 shrink-0 rounded-full px-4 text-sm font-medium",
                filter === f.id ? "bg-accent text-accent-foreground" : "bg-surface-2 text-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <TransactionList
          items={list}
          onEdit={(tx) => {
            setEditing(tx);
            setFormOpen(true);
          }}
        />
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
