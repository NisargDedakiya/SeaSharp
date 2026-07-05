import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { NewRfqForm } from "./NewRfqForm";

export default async function NewRfqPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "IMPORTER") redirect("/marketplace");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-50">Post an RFQ</h1>
      <p className="mt-2 text-slate-400">
        Verified exporters will compete via blind bidding. Funds lock in escrow once you award a bid.
      </p>
      <NewRfqForm />
    </main>
  );
}
