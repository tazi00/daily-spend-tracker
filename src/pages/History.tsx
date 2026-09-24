import { ExpenseDialog } from "@/components/finance/ExpenseDialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CalendarPlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  dateKey as currentDateKey,
  formatDateKey,
  formatMonthKey,
  formatPaise,
  monthKey as toMonthKey,
  parseAmountToPaise,
} from "@/lib/money";

function friendly(message: string): string {
  return message.replace(/\s*\([A-Z_]+\)\s*$/, "");
}

/** Last calendar day of a "YYYY-MM" month, as a YYYY-MM-DD key. */
function lastDayOfMonth(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m, 0).getDate();
  return `${mk}-${String(d).padStart(2, "0")}`;
}

function firstDayOfMonth(mk: string): string {
  return `${mk}-01`;
}

const INCOME_SOURCES = ["Salary", "Freelance", "Other"] as const;

/* ------------------------------------------------------------------ */
/* Income dialog                                                       */
/* ------------------------------------------------------------------ */

function IncomeDialog({
  open,
  onOpenChange,
  entry,
  defaultMonthKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: Doc<"income"> | null;
  defaultMonthKey: string;
}) {
  const create = useMutation(api.income.create);
  const update = useMutation(api.income.update);

  const [source, setSource] = useState<string>("Salary");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(firstDayOfMonth(defaultMonthKey));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reset = () => {
    setError(null);
    if (entry) {
      setSource(entry.source);
      setAmount(formatPaise(entry.amountPaise).replace("₹", ""));
      setDate(entry.dateKey);
    } else {
      setSource("Salary");
      setAmount("");
      setDate(firstDayOfMonth(defaultMonthKey));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const paise = parseAmountToPaise(amount);
    if (paise === null) {
      return setError("Enter a valid amount, like 30000 or 30000.50.");
    }
    setPending(true);
    setError(null);
    try {
      const occurredAt = new Date(`${date}T12:00`).getTime();
      if (entry) {
        await update({ id: entry._id, source, amountPaise: paise, dateKey: date, occurredAt });
        toast.success("Income updated");
      } else {
        await create({ source, amountPaise: paise, dateKey: date, occurredAt });
        toast.success("Income added");
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? friendly(err.message) : "Something went wrong.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" key={`${open}-${entry?._id ?? "new"}`}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {entry ? "Edit income" : "Add income"}
          </DialogTitle>
          <DialogDescription>Money that came in — salary, freelance, other.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="grid gap-1.5">
            <span className="label-caps text-muted-foreground">Source</span>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                {INCOME_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="label-caps text-muted-foreground">Amount (₹)</span>
              <div className="relative">
                <span className="tabular absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  ₹
                </span>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="tabular pl-8"
                  disabled={pending}
                />
              </div>
            </label>
            <label className="grid gap-1.5">
              <span className="label-caps text-muted-foreground">Date</span>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="tabular"
                disabled={pending}
              />
            </label>
          </div>
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {entry ? "Save changes" : "Add income"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Summary-only month dialog                                           */
/* ------------------------------------------------------------------ */

function SummaryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const upsert = useMutation(api.monthly.upsertSummary);
  const [month, setMonth] = useState("");
  const [income, setIncome] = useState("");
  const [expenses, setExpenses] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    if (!/^\d{4}-\d{2}$/.test(month)) return setError("Pick a month.");

    const parse = (value: string) => {
      const v = value.trim().replace(/[₹,\s]/g, "");
      if (v === "") return 0;
      if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
      return Math.round(Number(v) * 100);
    };
    const incomePaise = parse(income);
    const expensePaise = parse(expenses);
    if (incomePaise === null || expensePaise === null) {
      return setError("Enter valid amounts, like 30000 or 30000.50.");
    }

    setPending(true);
    setError(null);
    try {
      await upsert({
        monthKey: month,
        totalIncomePaise: incomePaise,
        totalExpensePaise: expensePaise,
        note: note.trim() || undefined,
      });
      toast.success("Month summary saved");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? friendly(err.message) : "Something went wrong.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Summary-only month</DialogTitle>
          <DialogDescription>
            For past months where you only know the totals — no need to
            reconstruct every transaction.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="grid gap-1.5">
            <span className="label-caps text-muted-foreground">Month</span>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="tabular"
              disabled={pending}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="label-caps text-muted-foreground">Income (₹)</span>
              <Input
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                inputMode="decimal"
                placeholder="30000"
                className="tabular"
                disabled={pending}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="label-caps text-muted-foreground">Expenses (₹)</span>
              <Input
                value={expenses}
                onChange={(e) => setExpenses(e.target.value)}
                inputMode="decimal"
                placeholder="29700"
                className="tabular"
                disabled={pending}
              />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="label-caps text-muted-foreground">Note (optional)</span>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Festival month"
              maxLength={120}
              disabled={pending}
            />
          </label>
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Save summary
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function History() {
  const navigate = useNavigate();
  const currentMonth = toMonthKey(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const overview = useQuery(api.monthly.overview, { selectedMonth });
  const expenses = useQuery(api.expenses.list, {
    from: firstDayOfMonth(selectedMonth),
    to: lastDayOfMonth(selectedMonth),
  });
  const income = useQuery(api.income.list, {
    from: firstDayOfMonth(selectedMonth),
    to: lastDayOfMonth(selectedMonth),
  });

  const removeExpense = useMutation(api.expenses.remove);
  const removeIncome = useMutation(api.income.remove);
  const removeSummary = useMutation(api.monthly.removeSummary);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Doc<"expenses"> | null>(null);
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Doc<"income"> | null>(null);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: "expense"; entry: Doc<"expenses"> }
    | { kind: "income"; entry: Doc<"income"> }
    | { kind: "summary"; monthKey: string }
    | null
  >(null);

  // Day groups for the selected month, newest day first.
  const dayGroups = useMemo(() => {
    if (!expenses?.expenses.length) return [];
    const map = new Map<string, Doc<"expenses">[]>();
    for (const e of expenses.expenses) {
      const list = map.get(e.dateKey) ?? [];
      list.push(e);
      map.set(e.dateKey, list);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([dateKey, list]) => ({
        dateKey,
        entries: list.sort((a, b) => b.occurredAt - a.occurredAt),
        totalPaise: list.reduce((sum, e) => sum + e.amountPaise, 0),
      }));
  }, [expenses]);

  const monthChips = useMemo(() => {
    const months = overview?.months.map((m) => m.monthKey) ?? [];
    return months.includes(selectedMonth) ? months : [selectedMonth, ...months];
  }, [overview, selectedMonth]);

  const selectedSummary = overview?.selected ?? null;
  const isSummaryOnly = selectedSummary?.source === "summary";

  const runDelete = async () => {
    if (!confirm || pendingDelete) return;
    setPendingDelete(true);
    try {
      if (confirm.kind === "expense") {
        await removeExpense({ id: confirm.entry._id });
        toast.success("Expense deleted");
      } else if (confirm.kind === "income") {
        await removeIncome({ id: confirm.entry._id });
        toast.success("Income deleted");
      } else {
        await removeSummary({ monthKey: confirm.monthKey });
        toast.success("Month summary removed");
      }
      setConfirm(null);
    } catch {
      toast.error("Could not delete — try again.");
    } finally {
      setPendingDelete(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Back to today"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </div>
            <div>
              <p className="font-display text-lg leading-none font-semibold">Ledger</p>
              <p className="mt-1 text-[11px] leading-none text-muted-foreground">History</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setSummaryDialogOpen(true)}
          >
            <CalendarPlus className="size-3.5" />
            <span className="hidden sm:inline">Add summary month</span>
            <span className="sm:hidden">Summary</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        {/* Month chips */}
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {monthChips.map((mk) => (
            <button
              key={mk}
              type="button"
              onClick={() => setSelectedMonth(mk)}
              className={`tabular shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                mk === selectedMonth
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {formatMonthKey(mk)}
            </button>
          ))}
        </div>

        {/* Month statement */}
        {overview === undefined ? (
          <Skeleton className="mt-4 h-40 w-full" />
        ) : isSummaryOnly && selectedSummary ? (
          <section className="ledger-panel mt-4 px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between">
              <p className="label-caps text-muted-foreground">
                {formatMonthKey(selectedSummary.monthKey)} · summary only
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                aria-label="Remove month summary"
                onClick={() => setConfirm({ kind: "summary", monthKey: selectedSummary.monthKey })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            {selectedSummary.note && (
              <p className="mt-1 text-sm text-muted-foreground">{selectedSummary.note}</p>
            )}
            <dl className="mt-4 space-y-2.5 text-[15px]">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Income</dt>
                <dd className="tabular font-semibold text-income">
                  {formatPaise(selectedSummary.totalIncomePaise)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Expenses</dt>
                <dd className="tabular font-semibold">
                  {formatPaise(selectedSummary.totalExpensePaise)}
                </dd>
              </div>
            </dl>
            <div className="ledger-double-rule mt-4" />
            <div className="mt-3 flex items-center justify-between">
              <p className="label-caps text-muted-foreground">Remaining</p>
              <p
                className={`tabular text-2xl font-semibold ${
                  selectedSummary.remainingPaise < 0 ? "text-destructive" : "text-income"
                }`}
              >
                {formatPaise(selectedSummary.remainingPaise)}
              </p>
            </div>
          </section>
        ) : (
          <section className="ledger-panel mt-4 px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between">
              <p className="label-caps text-muted-foreground">
                {formatMonthKey(selectedMonth)}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditingIncome(null);
                  setIncomeDialogOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Income
              </Button>
            </div>
            <dl className="mt-4 space-y-2.5 text-[15px]">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Income</dt>
                <dd className="tabular font-semibold text-income">
                  {formatPaise(income?.totalPaise ?? selectedSummary?.totalIncomePaise ?? 0)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Expenses</dt>
                <dd className="tabular font-semibold">
                  {formatPaise(expenses?.totalPaise ?? selectedSummary?.totalExpensePaise ?? 0)}
                </dd>
              </div>
            </dl>
            <div className="ledger-double-rule mt-4" />
            <div className="mt-3 flex items-center justify-between">
              <p className="label-caps text-muted-foreground">Remaining</p>
              <p
                className={`tabular text-2xl font-semibold ${
                  (income?.totalPaise ?? 0) - (expenses?.totalPaise ?? 0) < 0
                    ? "text-destructive"
                    : "text-income"
                }`}
              >
                {formatPaise((income?.totalPaise ?? 0) - (expenses?.totalPaise ?? 0))}
              </p>
            </div>
          </section>
        )}

        {/* Detailed entries for the selected month */}
        {!isSummaryOnly && (
          <section className="mt-6">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="label-caps text-muted-foreground">Entries</h2>
              <p className="text-xs text-muted-foreground">
                Editing a past entry moves it to the right day automatically.
              </p>
            </div>

            {expenses === undefined ? (
              <div className="ledger-panel mt-2 space-y-3 px-5 py-5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : expenses !== null && expenses.expenses.length === 0 && (income?.income.length ?? 0) === 0 ? (
              <div className="ledger-panel mt-2 flex flex-col items-center gap-2 border-dashed px-6 py-12 text-center">
                <p className="font-display text-lg font-medium">
                  Nothing recorded in {formatMonthKey(selectedMonth)}
                </p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Add income or expenses for this month — or save it as a
                  summary-only month if you only know the totals.
                </p>
              </div>
            ) : (
              <div className="mt-2 space-y-4">
                {/* Income records */}
                {income !== undefined && income !== null && income.income.length > 0 && (
                  <div className="ledger-panel">
                    <p className="label-caps border-b px-5 pt-4 pb-2 text-muted-foreground">
                      Income
                    </p>
                    <ul className="ledger-ruled">
                      {income.income.map((row) => (
                        <li key={row._id} className="group flex items-center gap-3 px-5 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-medium">{row.source}</p>
                            <p className="tabular mt-0.5 text-xs text-muted-foreground">
                              {formatDateKey(row.dateKey)}
                            </p>
                          </div>
                          <span className="tabular text-[15px] font-semibold text-income">
                            +{formatPaise(row.amountPaise)}
                          </span>
                          <div className="flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              aria-label={`Edit ${row.source}`}
                              onClick={() => {
                                setEditingIncome(row);
                                setIncomeDialogOpen(true);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${row.source}`}
                              onClick={() => setConfirm({ kind: "income", entry: row })}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Expenses grouped by day */}
                {dayGroups.map(({ dateKey, entries, totalPaise }) => (
                  <div key={dateKey} className="ledger-panel">
                    <div className="flex items-baseline justify-between border-b px-5 pt-4 pb-2">
                      <p className="label-caps text-muted-foreground">
                        {formatDateKey(dateKey, true)}
                      </p>
                      <p className="tabular text-xs font-medium text-muted-foreground">
                        {formatPaise(totalPaise)}
                      </p>
                    </div>
                    <ul className="ledger-ruled">
                      {entries.map((entry) => (
                        <li key={entry._id} className="group flex items-center gap-3 px-5 py-3">
                          <p className="min-w-0 flex-1 truncate text-[15px] font-medium">
                            {entry.title}
                          </p>
                          <span className="tabular text-[15px] font-semibold">
                            {formatPaise(entry.amountPaise)}
                          </span>
                          <div className="flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              aria-label={`Edit ${entry.title}`}
                              onClick={() => {
                                setEditingExpense(entry);
                                setExpenseDialogOpen(true);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${entry.title}`}
                              onClick={() => setConfirm({ kind: "expense", entry })}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <p className="mt-10 text-center text-[11px] text-muted-foreground">
          Each month stands on its own — remaining money is not carried forward.
        </p>
      </main>

      <ExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        entry={editingExpense}
        defaultDateKey={currentDateKey()}
      />
      <IncomeDialog
        open={incomeDialogOpen}
        onOpenChange={setIncomeDialogOpen}
        entry={editingIncome}
        defaultMonthKey={selectedMonth}
      />
      <SummaryDialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen} />

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "expense" && (
                <>
                  &ldquo;{confirm.entry.title}&rdquo; ·{" "}
                  <span className="tabular">{formatPaise(confirm.entry.amountPaise)}</span>{" "}
                  from {formatDateKey(confirm.entry.dateKey, true)} will be removed. This
                  cannot be undone.
                </>
              )}
              {confirm?.kind === "income" && (
                <>
                  &ldquo;{confirm.entry.source}&rdquo; ·{" "}
                  <span className="tabular">{formatPaise(confirm.entry.amountPaise)}</span>{" "}
                  from {formatDateKey(confirm.entry.dateKey, true)} will be removed. This
                  cannot be undone.
                </>
              )}
              {confirm?.kind === "summary" && (
                <>
                  The summary for {formatMonthKey(confirm.monthKey)} will be removed. This
                  cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingDelete}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pendingDelete}
              onClick={(e) => {
                e.preventDefault();
                void runDelete();
              }}
            >
              {pendingDelete ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
