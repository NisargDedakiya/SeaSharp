import "server-only";
import { eq, or, inArray, desc } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { shipments, workflowInstances } from "@/db/schema";
import type { CurrentOrganization } from "@/core/identity/session";

// Real data only: shipments this org is a party to (either side of the
// trade), with the workflow engine's `currentNode` where a workflow
// instance exists for that RFQ (Task 1's unified trade workflow — see
// src/db/schema/workflow.ts). Not every shipment has a workflow instance
// yet (the engine was introduced after shipments/transportStage already
// existed and instances are only created going forward), so this falls
// back to the legacy `shipments.transportStage` column when there's no
// instance, rather than hiding the shipment or fabricating a node.
export async function ShipmentsWidget({ organization }: { organization: CurrentOrganization }) {
  const orgShipments = await serviceDb.query.shipments.findMany({
    where: or(eq(shipments.exporterOrganizationId, organization.id), eq(shipments.importerOrganizationId, organization.id)),
    orderBy: [desc(shipments.createdAt)],
    limit: 10,
  });

  const rfqIds = orgShipments.map((s) => s.rfqId);
  const instances = rfqIds.length
    ? await serviceDb.query.workflowInstances.findMany({ where: inArray(workflowInstances.rfqId, rfqIds) })
    : [];
  const instanceByRfqId = new Map(instances.map((i) => [i.rfqId, i]));

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-premium">
      <h2 className="font-semibold text-ink-900">Shipments</h2>
      {orgShipments.length === 0 ? (
        <p className="mt-2 text-sm text-ink-400">No shipments yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {orgShipments.map((shipment) => {
            const instance = instanceByRfqId.get(shipment.rfqId);
            const stage = instance ? instance.currentNode : shipment.transportStage;
            return (
              <li key={shipment.id} className="text-sm text-ink-700">
                {shipment.mode} · {shipment.originLocation} → {shipment.destinationLocation}
                <span className="ml-2 text-ink-400">
                  {stage}
                  {!instance && " (legacy stage)"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
