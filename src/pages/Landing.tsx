import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarRange,
  IndianRupee,
  Pencil,
  Plus,
  Wallet,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.45, ease: "easeOut" as const },
};

/** Static replica of the app's Today card — the product shown, not described. */
function TodayCardMock() {
  const rows = [
    { title: "Auto fare", time: "09:15", amount: "₹120" },
    { title: "Chai", time: "08:40", amount: "₹30" },
    { title: "Groceries", time: "20:05", amount: "₹300" },
  ];
  return (
    <div className="ledger-panel shadow-sm">
      <div className="bg-primary/[0.04] px-6 pt-6 pb-5">
        <p className="label-caps text-muted-foreground">Spent today</p>
        <p className="tabular mt-2 text-5xl font-semibold tracking-tight text-primary">
          ₹450
        </p>
        <div className="ledger-double-rule mt-5" />
        <p className="mt-3 text-xs text-muted-foreground">
          3 entries · Wednesday, 24 September
        </p>
      </div>
      <ul className="ledger-ruled px-2 py-2 sm:px-3">
        {rows.map((row) => (
          <li key={row.title} className="flex items-center gap-3 px-3 py-3">
            <div className="flex-1">
              <p className="text-[15px] font-medium">{row.title}</p>
              <p className="tabular mt-0.5 text-xs text-muted-foreground">
                {row.time}
              </p>
            </div>
            <span className="tabular text-[15px] font-semibold">{row.amount}</span>
          </li>
        ))}
      </ul>
      <div className="border-t bg-card px-4 py-4">
        <div className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          <Plus className="size-4" />
          Spent money
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    icon: IndianRupee,
    title: "Today, front and centre",
    body: "One number — what you've spent today — with every entry listed underneath. No dashboard to decode.",
  },
  {
    icon: Plus,
    title: "Add an expense in seconds",
    body: "A title and an amount. The date and time are filled in for you; change them only when it matters.",
  },
  {
    icon: Pencil,
    title: "Fix mistakes honestly",
    body: "Edit or delete any entry. Totals are recalculated from the records, so the books always add up.",
  },
  {
    icon: CalendarRange,
    title: "Months that add up",
    body: "Browse previous months, add income, and see what remained. Summary-only months are welcome too.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Masthead */}
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </div>
            <div>
              <p className="font-display text-lg leading-none font-semibold">
                Ledger
              </p>
              <p className="mt-1 text-[11px] leading-none text-muted-foreground">
                Personal finance tracker
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="ledger-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto grid w-full max-w-5xl gap-10 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-20 lg:pb-20">
          <div>
            <p className="label-caps text-muted-foreground">
              Simple · Fast · Yours
            </p>
            <h1 className="font-display mt-4 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Where did today&apos;s
              <span className="text-primary"> money</span> go?
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-muted-foreground sm:text-base">
              Ledger answers one question well: what you spent today, and on
              what. Open it, see the total, add the next expense in seconds.
              No charts, no jargon, no spreadsheets.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="gap-2 text-base font-semibold">
                <Link to="/auth">
                  Start your ledger
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                Free · works on phone and desktop
              </p>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="mx-auto w-full max-w-sm"
          >
            <TodayCardMock />
          </motion.div>
        </div>
      </section>

      {/* The daily loop */}
      <section className="border-b bg-card">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
          <motion.div {...fadeUp}>
            <p className="label-caps text-muted-foreground">The whole ritual</p>
            <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Three steps. That&apos;s the app.
            </h2>
          </motion.div>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Open",
                body: "Today's total is the first thing you see — bigger than everything else.",
              },
              {
                step: "02",
                title: "See where it went",
                body: "Each expense listed with its amount and time, like a page in a ledger book.",
              },
              {
                step: "03",
                title: "Add the next one",
                body: "One tap, title and amount, done. The total updates instantly.",
              },
            ].map((item) => (
              <motion.div key={item.step} {...fadeUp}>
                <div className="border-t-2 border-primary pt-4">
                  <p className="tabular text-xs font-semibold text-primary">
                    {item.step}
                  </p>
                  <p className="font-display mt-1.5 text-lg font-semibold">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
          <motion.div {...fadeUp}>
            <p className="label-caps text-muted-foreground">What&apos;s inside</p>
            <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Small set, done properly.
            </h2>
          </motion.div>
          <div className="mt-9 grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {features.map((feature) => (
              <motion.div key={feature.title} {...fadeUp} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card text-primary">
                  <feature.icon className="size-4" />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold">
                    {feature.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {feature.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles strip */}
      <section className="border-b bg-card">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
          <motion.div {...fadeUp} className="text-center">
            <div className="ledger-double-rule mx-auto max-w-xs" />
            <p className="font-display mx-auto mt-6 max-w-2xl text-xl leading-8 font-medium tracking-tight text-foreground/90 sm:text-2xl sm:leading-9">
              &ldquo;Every amount is stored in whole paise and computed on the
              server — your books stay exact, from the first chai to the last
              day of the month.&rdquo;
            </p>
            <p className="label-caps mt-5 text-muted-foreground">
              Built on real accounting habits
            </p>
          </motion.div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-primary">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
            Keep today accounted for.
          </h2>
          <p className="max-w-md text-sm leading-6 text-primary-foreground/80">
            Sign in, add your first expense, and end the day knowing exactly
            where the money went.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="gap-2 text-base font-semibold"
          >
            <Link to="/auth">
              Open your ledger
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6">
          <p className="text-xs text-muted-foreground">
            Ledger — a personal finance tracker. Data lives on the server,
            synced across your devices.
          </p>
          <p className="tabular text-xs text-muted-foreground">
            ₹ stored in paise · totals never rounded wrong
          </p>
        </div>
      </footer>
    </div>
  );
}
