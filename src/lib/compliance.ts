import "server-only";
import { dbConnect } from "@/lib/mongoose";
import { HsCode, TariffRule, ComplianceDocument } from "@/models";
import { serialize } from "@/lib/serialize";

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

function toHsCodeResult(hs: { _id: string; description: string; category: string }): HsCodeResult {
  return { code: hs._id, description: hs.description, category: hs.category };
}

// Ranks seeded HS codes by simple keyword overlap against the free-text product query.
// This stands in for the "Trade Route Engine" HS classification described in the spec;
// swap for a trained classifier without touching callers.
export async function findHsCodeMatches(productQuery: string, limit = 5): Promise<HsCodeResult[]> {
  await dbConnect();
  const codes = await HsCode.find();
  const query = productQuery.trim().toLowerCase();
  if (!query) return codes.slice(0, limit).map(toHsCodeResult);

  const queryTokens = query.split(/\s+/).filter(Boolean);

  const scored = codes
    .map((hs) => {
      const haystack = `${hs.description} ${hs.category} ${hs._id}`.toLowerCase();
      let score = 0;
      if (haystack.includes(query)) score += 10;
      for (const token of queryTokens) {
        if (haystack.includes(token)) score += 1;
      }
      return { hs, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => toHsCodeResult(s.hs));
}

export async function getTariffRule(hsCode: string, origin: string, destination: string) {
  await dbConnect();
  const rule = await TariffRule.findOne({
    hsCode,
    originCountry: origin,
    destinationCountry: destination,
  });
  if (!rule) return null;
  return {
    tariffPercent: rule.tariffPercent,
    additionalFeePercent: rule.additionalFeePercent,
    notes: rule.notes ?? null,
  };
}

export async function getComplianceChecklist(destination: string, hsCode?: string) {
  await dbConnect();
  const docs = await ComplianceDocument.find({
    destinationCountry: { $in: [destination, "*"] },
    $or: [{ hsCode: null }, ...(hsCode ? [{ hsCode }] : [])],
  }).sort({ required: -1 });

  return serialize(docs) as Array<{
    id: string;
    destinationCountry: string;
    hsCode: string | null;
    name: string;
    description: string;
    required: boolean;
  }>;
}
