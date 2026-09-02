import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCOUNT_TYPE_LABEL } from "@/lib/finance/categories";
import { useFinanceStore } from "@/lib/finance/store";
import type { AccountType } from "@/lib/finance/types";
import { formatBaht } from "@/lib/utils";

export const Route = createFileRoute("/accounts")({ component: AccountsPage });

const TYPES: AccountType[] = ["cash", "bank", "credit", "savings", "ewallet", "other"];

function AccountsPage() {
  const accountsAll = useFinanceStore((s) => s.accounts);
  const addAccount = useFinanceStore((s) => s.addAccount);
  const accounts = accountsAll.filter((a) => !a.archived);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("ใส่ชื่อบัญชี");
      return;
    }
    addAccount({ name, type });
    setName("");
    toast.success("เพิ่มบัญชีแล้ว");
  }

  const usable = accounts
    .filter((a) => a.type !== "credit")
    .reduce((s, a) => s + a.currentBalance, 0);
  const debt = accounts.filter((a) => a.type === "credit").reduce((s, a) => s + a.currentBalance, 0);

  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">บัญชี</h1>
          <p className="mt-1 text-sm text-muted">
            ใช้ได้ {formatBaht(usable)}
            {debt > 0 ? ` · หนี้บัตร ${formatBaht(debt)}` : ""}
          </p>
        </div>
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4"
            >
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted">{ACCOUNT_TYPE_LABEL[a.type]}</p>
              </div>
              <p className="tabular text-base font-semibold">{formatBaht(a.currentBalance)}</p>
            </li>
          ))}
        </ul>
        <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">เพิ่มบัญชี</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="acc-name">ชื่อ</Label>
              <Input
                id="acc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ไทยพาณิชย์"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="acc-type">ประเภท</Label>
              <select
                id="acc-type"
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit">เพิ่มบัญชี</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
