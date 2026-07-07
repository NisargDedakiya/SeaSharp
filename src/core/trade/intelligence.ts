import "server-only";
import { and, eq, or, isNull, inArray } from "drizzle-orm";
import { serviceDb } from "@/db/client";
import { tariffs, complianceDocuments } from "@/db/schema";

export type LandedCostBreakdown = {
  productValue: number;
  tariffPercent: number;
  tariffAmount: number;
  additionalFeePercent: number;
  additionalFeeAmount: number;
  estimatedFreight: number;
  landedCost: number;
};

export function calculateLandedCost(params: {
  productValue: number;
  tariffPercent: number;
  additionalFeePercent: number;
  estimatedFreight: number;
}): LandedCostBreakdown {
  const tariffAmount = Math.round(params.productValue * (params.tariffPercent / 100) * 100) / 100;
  const additionalFeeAmount =
    Math.round(params.productValue * (params.additionalFeePercent / 100) * 100) / 100;
  const landedCost =
    Math.round(
      (params.productValue + tariffAmount + additionalFeeAmount + params.estimatedFreight) * 100
    ) / 100;

  return {
    productValue: params.productValue,
    tariffPercent: params.tariffPercent,
    tariffAmount,
    additionalFeePercent: params.additionalFeePercent,
    additionalFeeAmount,
    estimatedFreight: params.estimatedFreight,
    landedCost,
  };
}

export type HsCodeResult = { code: string; description: string; category: string };

// Ranks seeded HS codes by simple keyword overlap against the free-text product query.
// This stands in for the "Trade Route Engine" HS classification described in the spec;
// swap for a trained classifier without touching callers.
export async function findHsCodeMatches(productQuery: string, limit = 5): Promise<HsCodeResult[]> {
  const codes = await serviceDb.query.hsCodes.findMany();
  const query = productQuery.trim().toLowerCase();
  if (!query) return codes.slice(0, limit);

  const queryTokens = query.split(/\s+/).filter(Boolean);

  const scored = codes
    .map((hs) => {
      const haystack = `${hs.description} ${hs.category} ${hs.code}`.toLowerCase();
      let score = 0;
      if (haystack.includes(query)) score += 10;
      for (const token of queryTokens) {
        if (haystack.includes(token)) score += 1;
      }
      return { hs, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.hs);
}

export async function getTariffRule(hsCode: string, origin: string, destination: string) {
  const rule = await serviceDb.query.tariffs.findFirst({
    where: and(
      eq(tariffs.hsCode, hsCode),
      eq(tariffs.originCountry, origin),
      eq(tariffs.destinationCountry, destination)
    ),
  });
  if (!rule) return null;
  return {
    tariffPercent: Number(rule.dutyRatePercent),
    additionalFeePercent: Number(rule.additionalFeePercent),
    notes: rule.notes ?? null,
  };
}

export async function getComplianceChecklist(destination: string, hsCode?: string) {
  const docs = await serviceDb.query.complianceDocuments.findMany({
    where: and(
      inArray(complianceDocuments.destinationCountry, [destination, "*"]),
      hsCode ? or(isNull(complianceDocuments.hsCode), eq(complianceDocuments.hsCode, hsCode)) : isNull(complianceDocuments.hsCode)
    ),
    orderBy: (d, { desc }) => [desc(d.required)],
  });

  return docs.map((d) => ({
    id: d.id,
    destinationCountry: d.destinationCountry,
    hsCode: d.hsCode,
    name: d.name,
    description: d.description,
    required: d.required,
  }));
}
