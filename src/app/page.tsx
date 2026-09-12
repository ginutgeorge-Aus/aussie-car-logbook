export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-4 py-32 px-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Ginoo&apos;s Log Book
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          An Australian car logbook PWA for the ATO logbook method. Under
          construction — trip tracking and tax reports are coming soon.
        </p>
      </main>
    </div>
  );
}
