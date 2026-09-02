import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES } from "@/lib/finance/categories";
import { useFinanceStore } from "@/lib/finance/store";
import type { Transaction, TransactionType } from "@/lib/finance/types";
import { todayISO } from "@/lib/utils";

const TYPES: Array<{ id: TransactionType; label: string }> = [
  { id: "expense", label: "รายจ่าย" },
  { id: "income", label: "รายรับ" },
  { id: "transfer", label: "โอนเงิน" },
];

export function TransactionForm({
  initial,
  onClose,
}: {
  initial?: Transaction | null;
  onClose: () => void;
}) {
  const accountsAll = useFinanceStore((s) => s.accounts);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const defaultAccountId = useFinanceStore((s) => s.defaultAccountId);
  const accounts = accountsAll.filter((a) => !a.archived);

  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? defaultAccountId());
  const [toAccountId, setToAccountId] = useState(
    initial?.toAccountId ?? accounts.find((a) => a.type === "savings")?.id ?? "",
  );
  const [category, setCategory] = useState(initial?.category ?? "other_expense");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("กรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    if (type === "transfer" && (!toAccountId || toAccountId === accountId)) {
      toast.error("เลือกบัญชีปลายทางคนละบัญชี");
      return;
    }
    const payload = {
      type,
      title: title.trim() || (type === "income" ? "รายรับ" : type === "transfer" ? "โอนเงิน" : "รายจ่าย"),
      amount: n,
      accountId,
      toAccountId: type === "transfer" ? toAccountId : null,
      category: type === "transfer" ? "transfer" : category,
      date,
      note: note.trim() || null,
    };
    if (initial) {
      updateTransaction(initial.id, payload);
      toast.success("แก้ไขแล้ว");
    } else {
      addTransaction(payload);
      toast.success("บันทึกแล้ว");
    }
    onClose();
  }

  const cats = CATEGORIES.filter((c) => c.type === type || c.type === "both");

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setType(t.id);
              if (t.id === "income") setCategory("salary");
              if (t.id === "expense") setCategory("food");
              if (t.id === "transfer") setCategory("transfer");
            }}
            className={
              type === t.id
                ? "h-10 rounded-lg bg-surface text-sm font-medium text-foreground shadow-sm"
                : "h-10 rounded-lg text-sm text-muted"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        <Label htmlFor="amount">จำนวนเงิน</Label>
        <Input
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="mt-1.5 tabular text-lg"
          required
        />
      </div>

      <div>
        <Label htmlFor="title">รายละเอียด</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === "expense" ? "กาแฟมื้อเช้า" : "รายการ"}
          className="mt-1.5"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="account">{type === "transfer" ? "จากบัญชี" : "บัญชี"}</Label>
          <select
            id="account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        {type === "transfer" ? (
          <div>
            <Label htmlFor="to">ไปบัญชี</Label>
            <select
              id="to"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <Label htmlFor="cat">หมวดหมู่</Label>
            <select
              id="cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="date">วันที่</Label>
        <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
      </div>

      <div>
        <Label htmlFor="note">หมายเหตุ</Label>
        <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button type="submit">{initial ? "บันทึกการแก้ไข" : "บันทึกรายการ"}</Button>
      </div>
    </form>
  );
}
