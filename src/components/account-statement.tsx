import { ArrowRight, Pencil, ReceiptText, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  DetailToggle,
  LedgerEmpty,
  LedgerFrame,
  LedgerMoreButton,
  LedgerRows,
  StatTile,
} from "@/components/detail-panel";
import { ACCOUNT_TYPE_LABEL, categoryName } from "@/lib/finance/categories";
import { accountEffect, buildAccountLedger } from "@/lib/finance/ledger";
import { formatThaiDate } from "@/lib/finance/period";
import { useFinanceStore } from "@/lib/finance/store";
import type { Account, PeriodKey, Transaction } from "@/lib/finance/types";
import { cn, formatBaht } from "@/lib/utils";

const PREVIEW_COUNT = 5;

export function AccountStatement({
  account,
  transactions,
  period,
  onEdit,
}: {
  account: Account;
  transactions: Transaction[];
  period: PeriodKey;
  onEdit: (tx: Transaction) => void;
}) {
  const accounts = useFinanceStore((s) => s.accounts);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const ledger = useMemo(
    () => buildAccountLedger(account, transactions, period),
    [account, transactions, period],
  );

  // useId (ไม่ใช้ account.id) เพราะบัญชี seed มาพร้อม uuid คนละชุดบน server/client
  // แล้วเกิด hydration mismatch ของ id/aria-controls
  const detailId = `account-detail-${useId()}`;
  const lastEntryLabel = ledger.lastEntryDate ? formatThaiDate(ledger.lastEntryDate) : null;
  const visible = showAll ? ledger.entries : ledger.entries.slice(0, PREVIEW_COUNT);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 md:p-5">
      {/* หัวบัญชี */}
      <div className="flex items-center gap-3">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: account.color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{account.name}</p>
          <p className="text-xs text-muted">{ACCOUNT_TYPE_LABEL[account.type]}</p>
        </div>
        <p className="tabular shrink-0 text-base font-semibold">
          {formatBaht(ledger.closingBalance)}
        </p>
      </div>

      <DetailToggle
        open={open}
        onToggle={() => setOpen(!open)}
        controlsId={detailId}
        hint={
          ledger.count > 0 && lastEntryLabel
            ? `${ledger.count} รายการ · ล่าสุด ${lastEntryLabel}`
            : "ไม่มีรายการในช่วงนี้"
        }
      />

      <div id={detailId}>
        {open && (
          <div className="mt-4 border-t border-border/70 pt-4">
            {/* สรุปการเดินบัญชีของช่วงที่เลือก */}
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="ยอดยกมา" value={formatBaht(ledger.openingBalance)} />
              <StatTile label="เงินเข้า" value={formatBaht(ledger.inflow)} tone="income" />
              <StatTile label="เงินออก" value={formatBaht(ledger.outflow)} tone="expense" />
              <StatTile
                label="สุทธิ"
                value={formatBaht(ledger.net)}
                tone={ledger.net === 0 ? undefined : ledger.net > 0 ? "income" : "expense"}
              />
              <StatTile label="ยอดคงเหลือ" value={formatBaht(ledger.closingBalance)} />
              <StatTile label="รายการ" value={`${ledger.count} รายการ`} />
            </div>

            <LedgerFrame
              title="รายการเดินบัญชี"
              icon={ReceiptText}
              countLabel={`${ledger.count} รายการ`}
              footer={
                ledger.entries.length > PREVIEW_COUNT ? (
                  <LedgerMoreButton
                    expanded={showAll}
                    hiddenCount={ledger.count}
                    onToggle={() => setShowAll(!showAll)}
                  />
                ) : undefined
              }
            >
              {ledger.entries.length === 0 ? (
                <LedgerEmpty>ยังไม่มีรายการของบัญชีนี้ในช่วงเวลานี้</LedgerEmpty>
              ) : (
                <LedgerRows>
                  {visible.map((tx) => {
                    const effect = accountEffect(tx, account);
                    const from = accounts.find((a) => a.id === tx.accountId);
                    const to = accounts.find((a) => a.id === tx.toAccountId);
                    const isTransfer = tx.type === "transfer";
                    return (
                      <li key={tx.id} className="flex items-center gap-2 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{tx.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                            <span className="tabular">{formatThaiDate(tx.date)}</span>
                            <span>{categoryName(tx.category)}</span>
                            {isTransfer ? (
                              <span className="inline-flex items-center gap-1">
                                {from?.name}
                                <ArrowRight className="size-3" />
                                {to?.name}
                              </span>
                            ) : null}
                            {tx.note ? <span className="truncate">{tx.note}</span> : null}
                          </p>
                        </div>
                        <p
                          className={cn(
                            "tabular shrink-0 text-sm font-semibold",
                            isTransfer
                              ? "text-muted"
                              : effect >= 0
                                ? "text-income"
                                : "text-expense",
                          )}
                        >
                          {effect >= 0 ? "+" : "−"}
                          {formatBaht(Math.abs(effect))}
                        </p>
                        <div className="flex shrink-0">
                          <button
                            type="button"
                            aria-label="แก้ไขรายการ"
                            onClick={() => onEdit(tx)}
                            className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="ลบรายการ"
                            onClick={() => deleteTransaction(tx.id)}
                            className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-expense"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </LedgerRows>
              )}
            </LedgerFrame>
          </div>
        )}
      </div>
    </div>
  );
}
