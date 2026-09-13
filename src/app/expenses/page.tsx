import Link from "next/link";
import { getVehicle } from "@/lib/data/vehicle";
import { listExpenses } from "@/lib/data/expense";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ExpenseRow } from "@/components/ExpenseRow";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const vehicle = await getVehicle();
  if (!vehicle) {
    return (
      <main className="w-full max-w-4xl mx-auto p-8 text-center">
        <p className="mb-4 text-zinc-600">Set up your car first.</p>
        <Link href="/vehicle" className="rounded bg-black text-white px-4 py-2">Set up your car</Link>
      </main>
    );
  }

  const expenses = await listExpenses();

  return (
    <main className="w-full max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <Link href="/" className="text-sm underline">Dashboard</Link>
      </div>
      <ExpenseForm />
      {expenses.length === 0 ? (
        <p className="mt-6 text-zinc-600">No expenses yet.</p>
      ) : (
        <table className="mt-6 w-full text-left">
          <thead>
            <tr className="border-b text-sm text-zinc-500">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2 pr-4">GST</th>
              <th className="py-2 pr-4">Vendor</th>
              <th className="py-2 pr-4">Receipt</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => <ExpenseRow key={e.id} expense={e} />)}
          </tbody>
        </table>
      )}
    </main>
  );
}
