import { ArrowRight, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoryName } from "@/lib/finance/categories";
import { parseCapture } from "@/lib/finance/parser";
import { useFinanceStore } from "@/lib/finance/store";
import type { TransactionType } from "@/lib/finance/types";
import { formatBaht } from "@/lib/utils";

const TYPE_LABEL: Record<TransactionType | "unknown", string> = {
  income: "รายรับ",
  expense: "รายจ่าย",
  transfer: "โอนเงิน",
  unknown: "ไม่ชัดเจน",
};

export function CaptureBar({ onNeedForm }: { onNeedForm: () => void }) {
  const accounts = useFinanceStore((s) => s.accounts);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const defaultAccountId = useFinanceStore((s) => s.defaultAccountId);
  const [value, setValue] = useState("");

  const parsed = useMemo(() => parseCapture(value, accounts), [value, accounts]);
  const account = accounts.find((a) => a.id === parsed.accountHint);
  const toAccount = accounts.find((a) => a.id === parsed.toAccountHint);

  function commit() {
    if (!value.trim()) {
      onNeedForm();
      return;
    }
    if (parsed.amount == null || parsed.amount <= 0 || parsed.type === "unknown") {
      onNeedForm();
      return;
    }
    const fromId = defaultAccountId(parsed.accountHint);
    const toId = parsed.toAccountHint;
    if (parsed.type === "transfer" && (!toId || toId === fromId)) {
      toast.error("เลือกบัญชีปลายทางให้ต่างจากบัญชีต้นทาง");
      onNeedForm();
      return;
    }
    addTransaction({
      type: parsed.type,
      title: parsed.title,
      amount: parsed.amount,
      accountId: fromId,
      toAccountId: parsed.type === "transfer" ? toId : null,
      category: parsed.category ?? (parsed.type === "income" ? "other_income" : "other_expense"),
      date: parsed.date,
    });
    toast.success("บันทึกแล้ว");
    setValue("");
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_0_rgba(28,25,23,0.04)] md:p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">บันทึกด่วน</p>
      <p className="mt-1 text-sm text-muted">พิมพ์คำสั้น ๆ เช่น กาแฟ 65 หรือ เงินเดือน 28000</p>
      <div className="mt-3 flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          placeholder="กาแฟ 65 · โอนออม 5000 · เงินเดือน 28k"
          aria-label="ช่องบันทึกด่วน"
        />
        <Button type="button" onClick={commit} className="shrink-0" aria-label="บันทึก">
          <Check className="size-4" />
          บันทึก
        </Button>
      </div>
      {value.trim() ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="rounded-full bg-surface-2 px-2.5 py-1">{TYPE_LABEL[parsed.type]}</span>
          {parsed.amount != null ? (
            <span className="tabular font-medium text-foreground">{formatBaht(parsed.amount)}</span>
          ) : (
            <span>ยังไม่มีจำนวนเงิน</span>
          )}
          <span>{parsed.title}</span>
          {parsed.category ? <span>{categoryName(parsed.category)}</span> : null}
          {account ? (
            <span className="inline-flex items-center gap-1">
              {account.name}
              {toAccount ? (
                <>
                  <ArrowRight className="size-3.5" />
                  {toAccount.name}
                </>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={onNeedForm}
          className="mt-3 text-sm text-accent underline-offset-4 hover:underline"
        >
          เปิดฟอร์มละเอียด
        </button>
      )}
    </section>
  );
}
