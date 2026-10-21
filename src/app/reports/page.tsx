import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { listExpenses } from "@/lib/data/expense";
import { getSettings } from "@/lib/data/settings";
import { listLogbookPeriods } from "@/lib/data/logbookPeriod";
import { financialYear, formatBusinessPct, fyLabelOr } from "@/lib/tax";
import { todayIso } from "@/lib/today";
import { formatMoney } from "@/lib/format";
import { categoryLabel } from "@/lib/expenses/categories";
import { logbookFyLabels } from "@/lib/logbook/compute";
import { buildFyReport } from "@/lib/reports/build";
import { FySwitcher } from "@/components/FySwitcher";
import { NeedsVehicle, PageHeader, cardCls, eyebrowCls, pageBase } from "@/components/ui";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

/** A label/amount table row; `total` = bold, `accent` = amber figure. */
function MoneyRow({ label, cents, total = false, accent = false }: { label: string; cents: number; total?: boolean; accent?: boolean }) {
  return (
    <tr className={total ? "font-semibold" : ""}>
      <td className={`px-5 py-3 ${total ? "" : "border-b border-rule"}`}>{label}</td>
      <td
        className={`px-5 py-3 text-right font-mono whitespace-nowrap ${total ? "" : "border-b border-rule"} ${
          accent ? "text-accent-ink text-lg" : ""
        }`}
      >
        {formatMoney(cents)}
      </td>
    </tr>
  );
}

/** Reports: per-FY BAS GST credits by quarter and the annual income-tax deduction (printable). */
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const vehicle = await getVehicle();
  if (!vehicle) return <NeedsVehicle />;

  const [trips, expenses, settings, logbookPeriods] = await Promise.all([
    listTrips(),
    listExpenses(),
    getSettings(),
    listLogbookPeriods(),
  ]);
  const today = todayIso();
  const currentFy = financialYear(today).label;
  const sp = await searchParams;
  const activeFy = fyLabelOr(sp.fy, currentFy);

  const fyLabels = Array.from(
    new Set([currentFy, ...trips.map((t) => financialYear(t.date).label), ...expenses.map((e) => financialYear(e.date).label), ...logbookFyLabels(logbookPeriods, currentFy)]),
  ).sort((a, b) => b.localeCompare(a));

  const report = buildFyReport({ trips, expenses, vehicle, settings, logbookPeriods, fyLabel: activeFy, today });

  return (
    <main className={`${pageBase} max-w-3xl flex flex-col gap-5`}>
      <div className="no-print">
        <PageHeader title="Reports">
          <PrintButton />
        </PageHeader>
        <FySwitcher fyLabels={fyLabels} active={activeFy} basePath="/reports" />
      </div>

      <div>
        <h2 className="text-xl font-semibold">
          {vehicle.make} {vehicle.model}
          {vehicle.rego ? ` · ${vehicle.rego}` : ""} — <span className="font-mono">FY {activeFy}</span>
        </h2>
        <p className="mt-1 text-[15px] text-muted">
          Business use: <span className="font-mono font-semibold text-ink">{formatBusinessPct(report.businessPctBps)}%</span>{" "}
          {report.businessUseSource.kind === "logbook"
            ? `(logbook period ${report.businessUseSource.startDate} to ${report.businessUseSource.endDate}, valid FY ${report.businessUseSource.firstFy} to ${report.businessUseSource.lastFy})`
            : `(estimated from FY ${activeFy} trips — no valid logbook)`}
        </p>
      </div>

      {report.notices.length > 0 && (
        <div role="note" className="rounded-xl border border-accent/60 bg-notice px-4 py-3 text-sm text-ink flex flex-col gap-1">
          {report.notices.map((n) => <p key={n}>{n}</p>)}
        </div>
      )}

      {settings.gstRegistered ? (
        <section aria-labelledby="bas-h" className={`${cardCls} py-2`}>
          <h3 id="bas-h" className={`${eyebrowCls} px-5 py-2`}>BAS — GST credit by quarter</h3>
          <table className="w-full border-collapse text-[15px]">
            <thead className="sr-only">
              <tr><th>Quarter</th><th>GST credit</th></tr>
            </thead>
            <tbody>
              {report.bas.quarters.map((q) => <MoneyRow key={q.quarter} label={q.label} cents={q.gstCreditCents} />)}
              <MoneyRow label="FY total" cents={report.bas.totalGstCreditCents} total />
            </tbody>
          </table>
          {report.bas.purchaseGstCreditCents > 0 && (
            <p className="px-5 pb-2 text-xs text-muted">
              Includes {formatMoney(report.bas.purchaseGstCreditCents)} GST credit on the car purchase (business share,
              capped at 1/11 of the ATO car limit) in the quarter of purchase.
            </p>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted">Not GST-registered — no BAS credits</p>
      )}

      <section aria-labelledby="annual-h" className={`${cardCls} py-2`}>
        <h3 id="annual-h" className={`${eyebrowCls} px-5 py-2`}>Annual income-tax deduction</h3>
        <table className="w-full border-collapse text-[15px]">
          <thead className="sr-only">
            <tr><th>Item</th><th>Amount</th></tr>
          </thead>
          <tbody>
            <MoneyRow label="Running costs (business share)" cents={report.annual.runningCostsDeductionCents} />
            <MoneyRow label="Car depreciation (business share)" cents={report.annual.depreciationDeductionCents} />
            <MoneyRow label="Total deduction" cents={report.annual.totalDeductionCents} total accent />
          </tbody>
        </table>
      </section>

      {report.annual.byCategory.length > 0 && (
        <section aria-labelledby="cat-h" className={`${cardCls} py-2`}>
          <h3 id="cat-h" className={`${eyebrowCls} px-5 py-2`}>Expenses by category ({report.annual.categoryBasis === "ex-gst" ? "GST-exclusive" : "GST-inclusive"})</h3>
          <table className="w-full border-collapse text-[15px]">
            <thead className="sr-only">
              <tr><th>Category</th><th>Total</th></tr>
            </thead>
            <tbody>
              {report.annual.byCategory.map((c) => (
                <MoneyRow key={c.category} label={categoryLabel(c.category)} cents={c.totalCents} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-muted">Estimates for record-keeping. Confirm figures with your accountant.</p>
    </main>
  );
}
