import { prisma } from "@/lib/prisma";

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

// Ranks seeded HS codes by simple keyword overlap against the free-text product query.
// This stands in for the "Trade Route Engine" HS classification described in the spec;
// swap for a trained classifier without touching callers.
export async function findHsCodeMatches(productQuery: string, limit = 5) {
  const codes = await prisma.hsCode.findMany();
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
  return prisma.tariffRule.findUnique({
    where: {
      hsCode_originCountry_destinationCountry: {
        hsCode,
        originCountry: origin,
        destinationCountry: destination,
      },
    },
  });
}

export async function getComplianceChecklist(destination: string, hsCode?: string) {
  return prisma.complianceDocument.findMany({
    where: {
      destinationCountry: { in: [destination, "*"] },
      OR: [{ hsCode: null }, ...(hsCode ? [{ hsCode }] : [])],
    },
    orderBy: { required: "desc" },
  });
}
