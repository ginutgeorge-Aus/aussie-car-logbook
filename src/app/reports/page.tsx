import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listTrips } from "@/lib/data/trip";
import { listExpenses } from "@/lib/data/expense";
import { getSettings } from "@/lib/data/settings";
import { financialYear } from "@/lib/tax";
import { todayIso } from "@/lib/today";
import { centsToDollars } from "@/lib/logbook/parse";
import { buildFyReport } from "@/lib/reports/build";
import { FySwitcher } from "@/components/FySwitcher";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const vehicle = await getVehicle();
  if (!vehicle) {
    return (
      <main className="w-full max-w-3xl mx-auto p-8 text-center">
        <p className="mb-4 text-zinc-600">Set up your car first.</p>
        <Link href="/vehicle" className="rounded bg-black text-white px-4 py-2">Set up your car</Link>
      </main>
    );
  }

  const [trips, expenses, settings] = await Promise.all([listTrips(), listExpenses(), getSettings()]);
  const currentFy = financialYear(todayIso()).label;
  const sp = await searchParams;
  const activeFy = typeof sp.fy === "string" ? sp.fy : currentFy;

  const fyLabels = Array.from(
    new Set([currentFy, ...trips.map((t) => financialYear(t.date).label), ...expenses.map((e) => financialYear(e.date).label)]),
  ).sort().reverse();

  const report = buildFyReport({ trips, expenses, vehicle, settings, fyLabel: activeFy });

  return (
    <main className="w-full max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4 no-print">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <Link href="/" className="text-sm underline">Dashboard</Link>
      </div>
      <div className="no-print">
        <FySwitcher fyLabels={fyLabels} active={activeFy} basePath="/reports" />
      </div>

      <h2 className="mt-6 text-xl font-semibold">
        {vehicle.make} {vehicle.model} — FY {activeFy}
      </h2>
      <p className="text-sm text-zinc-600">Business use: {Math.round(report.businessPct * 100)}%</p>

      {report.notices.length > 0 && (
        <div className="mt-4 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
          {report.notices.map((n) => <p key={n}>{n}</p>)}
        </div>
      )}

      <section className="mt-6">
        <h3 className="font-medium mb-2">BAS — GST credit by quarter</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-zinc-500">
              <th className="py-2 pr-4">Quarter</th>
              <th className="py-2">GST credit</th>
            </tr>
          </thead>
          <tbody>
            {report.bas.quarters.map((q) => (
              <tr key={q.quarter} className="border-b">
                <td className="py-2 pr-4">{q.label}</td>
                <td className="py-2">${centsToDollars(q.gstCreditCents)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2 pr-4">FY total</td>
              <td className="py-2">${centsToDollars(report.bas.totalGstCreditCents)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h3 className="font-medium mb-2">Annual income-tax deduction</h3>
        <table className="w-full text-left text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-4">Running costs (business share)</td>
              <td className="py-2">${centsToDollars(report.annual.runningCostsDeductionCents)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">Car depreciation (business share)</td>
              <td className="py-2">${centsToDollars(report.annual.depreciationDeductionCents)}</td>
            </tr>
            <tr className="font-semibold">
              <td className="py-2 pr-4">Total deduction</td>
              <td className="py-2">${centsToDollars(report.annual.totalDeductionCents)}</td>
            </tr>
          </tbody>
        </table>

        {report.annual.byCategory.length > 0 && (
          <>
            <h4 className="mt-6 mb-2 text-sm font-medium text-zinc-600">Expenses by category (GST-inclusive)</h4>
            <table className="w-full text-left text-sm">
              <tbody>
                {report.annual.byCategory.map((c) => (
                  <tr key={c.category} className="border-b">
                    <td className="py-2 pr-4 capitalize">{c.category}</td>
                    <td className="py-2">${centsToDollars(c.totalInclCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <p className="mt-6 text-xs text-zinc-400">
        Estimates for record-keeping. Confirm figures with your accountant.
      </p>

      <div className="mt-6"><PrintButton /></div>
    </main>
  );
}
