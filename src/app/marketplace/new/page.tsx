import { redirect } from "next/navigation";
import { getSessionActor } from "@/core/identity/session";
import { NewRfqForm } from "./NewRfqForm";

export default async function NewRfqPage() {
  const actor = await getSessionActor();
  if (!actor) redirect("/login");
  if (actor.organization.type !== "IMPORTER") redirect("/marketplace");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-ink-900">Post an RFQ</h1>
      <p className="mt-2 text-ink-500">
        Verified exporters will compete via blind bidding. Funds lock in escrow once you award a bid.
      </p>
      <NewRfqForm />
    </main>
  );
}
