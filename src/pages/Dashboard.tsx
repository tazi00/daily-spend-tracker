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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeftRight,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  dateKey as currentDateKey,
  formatDateKey,
  formatMonthKey,
  formatPaise,
  formatTime,
  monthKey,
} from "@/lib/money";

function todayLabel(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function LedgerRow({
  expense,
  onEdit,
  onDelete,
}: {
  expense: Doc<"expenses">;
  onEdit: (expense: Doc<"expenses">) => void;
  onDelete: (expense: Doc<"expenses">) => void;
}) {
  return (
    <li className="group flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{expense.title}</p>
        <p className="tabular mt-0.5 text-xs text-muted-foreground">
          {formatTime(expense.occurredAt)}
        </p>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <span className="tabular text-[15px] font-semibold tracking-tight">
          {formatPaise(expense.amountPaise)}
        </span>
        <div className="flex opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Edit ${expense.title}`}
            onClick={() => onEdit(expense)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${expense.title}`}
            onClick={() => onDelete(expense)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const todayData = useQuery(api.expenses.today, {});
  const overview = useQuery(api.monthly.overview, {
    selectedMonth: monthKey(new Date()),
  });

  const removeExpense = useMutation(api.expenses.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"expenses"> | null>(null);
  const [deleting, setDeleting] = useState<Doc<"expenses"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (expense: Doc<"expenses">) => {
    setEditing(expense);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting || isDeleting) return;
    setIsDeleting(true);
    try {
      await removeExpense({ id: deleting._id });
      toast.success("Expense deleted");
      setDeleting(null);
    } catch {
      toast.error("Could not delete — try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const monthStats = overview?.selected;

  return (
    <div className="min-h-screen bg-background">
      {/* Masthead */}
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </div>
            <div>
              <p className="font-display text-lg leading-none font-semibold">
                Ledger
              </p>
              <p className="mt-1 text-[11px] leading-none text-muted-foreground">
                {todayLabel()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate("/history")}
            >
              <ArrowLeftRight className="size-3.5" />
              <span className="hidden sm:inline">History</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label="Sign out"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-6">
        {/* Today's total — the one number that matters */}
        <section className="ledger-panel mt-6 overflow-hidden">
          <div className="ledger-grid bg-primary/[0.04] px-5 pt-5 pb-4 sm:px-6">
            <p className="label-caps text-muted-foreground">Spent today</p>
            {todayData === undefined ? (
              <Skeleton className="mt-2 h-12 w-44" />
            ) : (
              <p className="tabular mt-1.5 text-5xl font-semibold tracking-tight text-primary">
                {formatPaise(todayData?.totalPaise ?? 0)}
              </p>
            )}
            <div className="ledger-double-rule mt-4" />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {todayData === undefined
                  ? "Loading entries…"
                  : todayData === null
                    ? "Session expired — refresh the page."
                    : todayData.expenses.length === 0
                      ? "No entries yet today"
                      : `${todayData.expenses.length} ${todayData.expenses.length === 1 ? "entry" : "entries"} · ${formatDateKey(todayData.dateKey)}`}
              </p>
              {monthStats && (
                <p className="tabular text-[11px] text-muted-foreground">
                  {formatMonthKey(monthStats.monthKey)} so far:{" "}
                  <span className="text-foreground">
                    {formatPaise(monthStats.totalExpensePaise)}
                  </span>
                  {monthStats.totalIncomePaise > 0 && (
                    <>
                      {" · "}left{" "}
                      <span className="text-income">
                        {formatPaise(monthStats.remainingPaise)}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Prominent add action */}
          <div className="border-t bg-card px-5 py-4 sm:px-6">
            <Button
              size="lg"
              className="w-full gap-2 text-base font-semibold"
              onClick={openAdd}
            >
              <Plus className="size-5" />
              Spent money
            </Button>
          </div>
        </section>

        {/* Today's expense list */}
        <section className="mt-6">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="label-caps text-muted-foreground">
              Today&apos;s entries
            </h2>
            {todayData !== undefined && todayData !== null && todayData.expenses.length > 0 && (
              <p className="tabular text-xs text-muted-foreground">
                Total {formatPaise(todayData.totalPaise)}
              </p>
            )}
          </div>

          {todayData === undefined ? (
            <div className="ledger-panel mt-2 divide-y">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>            ) : todayData === null ? (
              <div className="ledger-panel mt-2 flex flex-col items-center gap-2 border-dashed px-6 py-12 text-center">
                <p className="font-display text-lg font-medium">Not signed in</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Your session may have expired. Refresh the page to continue.
                </p>
              </div>
            ) : todayData.expenses.length === 0 ? (
            <div className="ledger-panel mt-2 flex flex-col items-center gap-2 border-dashed px-6 py-12 text-center">
              <p className="font-display text-lg font-medium">
                Nothing spent yet today
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Chai, auto fare, lunch — add it as soon as you spend and the
                day stays accounted for.
              </p>
            </div>
          ) : (
            <ul className="ledger-panel ledger-ruled mt-2">
              {todayData.expenses.map((expense) => (
                <LedgerRow
                  key={expense._id}
                  expense={expense}
                  onEdit={openEdit}
                  onDelete={setDeleting}
                />
              ))}
            </ul>
          )}
        </section>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          {user?.email ?? "Your ledger"} · data lives on the server, synced
          across your devices
        </p>
      </main>

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        defaultDateKey={todayData?.dateKey ?? currentDateKey()}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete this expense?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  &ldquo;{deleting.title}&rdquo; ·{" "}
                  <span className="tabular">
                    {formatPaise(deleting.amountPaise)}
                  </span>{" "}
                  will be removed from {formatDateKey(deleting.dateKey)}.
                  This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
