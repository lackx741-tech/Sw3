import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">SW3 Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Next-generation ERC20 sweeping platform
          </p>
        </header>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold">Total Swept</h2>
            <p className="mt-2 text-3xl font-bold">$0.00</p>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold">Active Batches</h2>
            <p className="mt-2 text-3xl font-bold">0</p>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold">Connected Wallets</h2>
            <p className="mt-2 text-3xl font-bold">0</p>
          </div>
        </div>
      </div>
    </main>
  );
}
