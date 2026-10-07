import Link from "next/link";
import { getSettings } from "@/lib/data/settings";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

/** /settings — GST registration and ABN. */
export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <main className="w-full max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <Link href="/" className="text-sm underline">Dashboard</Link>
      </div>
      <SettingsForm settings={settings} />
    </main>
  );
}
