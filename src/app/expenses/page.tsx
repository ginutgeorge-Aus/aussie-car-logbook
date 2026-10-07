import { getVehicle } from "@/lib/data/vehicle";
import { listExpenses } from "@/lib/data/expense";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ExpenseRow } from "@/components/ExpenseRow";
import { EmptyState, NeedsVehicle, PageHeader, cardCls, pageCls } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Expenses: add/scan form, then every expense as cards (phone) / table (desktop). */
export default async function ExpensesPage() {
  const vehicle = await getVehicle();
  if (!vehicle) return <NeedsVehicle />;

  const expenses = await listExpenses();

  return (
    <main className={`${pageCls} flex flex-col gap-5`}>
      <PageHeader title="Expenses" />
      <ExpenseForm />
      {expenses.length === 0 ? (
        <EmptyState title="No expenses yet" body="Scan a fuel or service receipt above — the details fill in for you to check." />
      ) : (
        <section aria-label="Expenses">
          <ul className="md:hidden">
            {expenses.map((e) => <ExpenseRow key={e.id} expense={e} variant="card" />)}
          </ul>
          <div className={`${cardCls} hidden md:block overflow-x-auto py-2`}>
            <table className="w-full min-w-190 border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.05em] text-muted">
                  <th className="border-b border-line px-5 py-2.5 font-medium">Date</th>
                  <th className="border-b border-line px-3 py-2.5 font-medium">Category</th>
                  <th className="border-b border-line px-3 py-2.5 font-medium">Vendor</th>
                  <th className="border-b border-line px-3 py-2.5 font-medium text-right">Amount</th>
                  <th className="border-b border-line px-3 py-2.5 font-medium text-right">GST</th>
                  <th className="border-b border-line px-3 py-2.5 font-medium">Receipt</th>
                  <th className="border-b border-line px-3 py-2.5 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => <ExpenseRow key={e.id} expense={e} variant="row" />)}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
