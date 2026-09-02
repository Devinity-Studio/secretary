import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { categoryName } from "@/lib/finance/categories";
import { formatThaiDate } from "@/lib/finance/period";
import { useFinanceStore } from "@/lib/finance/store";
import type { Transaction } from "@/lib/finance/types";
import { formatBaht } from "@/lib/utils";

export function TransactionList({
  items,
  onEdit,
}: {
  items: Transaction[];
  onEdit: (tx: Transaction) => void;
}) {
  const accounts = useFinanceStore((s) => s.accounts);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted">
        ยังไม่มีรายการในช่วงนี้ ลองพิมพ์ “กาแฟ 65” ด้านบน
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {items.map((tx) => {
        const from = accounts.find((a) => a.id === tx.accountId);
        const to = accounts.find((a) => a.id === tx.toAccountId);
        const color =
          tx.type === "income" ? "text-income" : tx.type === "expense" ? "text-expense" : "text-foreground";
        const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "−" : "";
        return (
          <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{tx.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span>{formatThaiDate(tx.date)}</span>
                <span>{categoryName(tx.category)}</span>
                <span className="inline-flex items-center gap-1">
                  {from?.name}
                  {to ? (
                    <>
                      <ArrowRight className="size-3" />
                      {to.name}
                    </>
                  ) : null}
                </span>
              </p>
            </div>
            <p className={`tabular shrink-0 text-sm font-semibold ${color}`}>
              {sign}
              {formatBaht(tx.amount)}
            </p>
            <div className="flex shrink-0">
              <button
                type="button"
                className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
                aria-label="แก้ไข"
                onClick={() => onEdit(tx)}
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-expense"
                aria-label="ลบ"
                onClick={() => deleteTransaction(tx.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
