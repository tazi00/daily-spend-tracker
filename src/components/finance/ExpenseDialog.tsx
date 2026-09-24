import { formatPaise, parseAmountToPaise } from "@/lib/money";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/** Strip the trailing "(CODE)" from server messages before showing them. */
function friendly(message: string): string {
  return message.replace(/\s*\([A-Z_]+\)\s*$/, "");
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Add/edit expense. One dialog for both jobs: prefilling from `entry` turns it
 * into the edit form, so add and edit can never drift apart.
 */
export function ExpenseDialog({
  open,
  onOpenChange,
  entry,
  defaultDateKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present → edit mode; null → add mode. */
  entry: Doc<"expenses"> | null;
  defaultDateKey: string;
}) {
  const create = useMutation(api.expenses.create);
  const update = useMutation(api.expenses.update);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDateKey);
  const [time, setTime] = useState(nowTime());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // (Re)initialize the form whenever the dialog opens for a given entry.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (entry) {
      setTitle(entry.title);
      setAmount(formatPaise(entry.amountPaise).replace("₹", ""));
      setDate(entry.dateKey);
      setTime(nowTime());
      const d = new Date(entry.occurredAt);
      if (entry.dateKey === defaultDateKey) {
        setTime(
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        );
      }
    } else {
      setTitle("");
      setAmount("");
      setDate(defaultDateKey);
      setTime(nowTime());
    }
  }, [open, entry, defaultDateKey]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return; // no duplicate submissions

    // Client validation is UX only — the server re-validates everything.
    if (!title.trim()) return setError("Give it a short title, e.g. \"Auto fare\".");
    const paise = parseAmountToPaise(amount);
    if (paise === null) {
      return setError("Enter a valid amount, like 120 or 120.50.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Pick a date.");

    const occurredAt = new Date(`${date}T${time || "00:00"}`).getTime();
    if (!Number.isFinite(occurredAt)) return setError("Pick a valid time.");

    setPending(true);
    setError(null);
    try {
      if (entry) {
        await update({
          id: entry._id,
          title,
          amountPaise: paise,
          dateKey: date,
          occurredAt,
          notes: entry.notes,
        });
        toast.success("Expense updated");
      } else {
        await create({ title, amountPaise: paise, dateKey: date, occurredAt });
        toast.success("Expense added");
      }
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? friendly(err.message) : "Something went wrong.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {entry ? "Edit expense" : "Add expense"}
          </DialogTitle>
          <DialogDescription>
            {entry
              ? "Correct the entry — today's total updates immediately."
              : "Where did today's money go?"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="grid gap-1.5">
            <span className="label-caps text-muted-foreground">Title</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto fare, chai, groceries…"
              maxLength={80}
              autoFocus
              disabled={pending}
            />
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

          <label className="grid gap-1.5">
            <span className="label-caps text-muted-foreground">Time</span>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="tabular"
              disabled={pending}
            />
          </label>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {entry ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
