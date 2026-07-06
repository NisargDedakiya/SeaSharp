import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler, AppError } from "@/lib/api-handler";
import {
  calculateLandedCost,
  findHsCodeMatches,
  getComplianceChecklist,
  getTariffRule,
} from "@/lib/compliance";

const lookupSchema = z.object({
  product: z.string().min(2),
  originCountry: z.string().length(2),
  destinationCountry: z.string().length(2),
  productValue: z.coerce.number().positive().optional(),
  estimatedFreight: z.coerce.number().min(0).optional(),
});

// Public, unauthenticated endpoint — this is the "free compliance checker"
// viral wedge from the GTM plan (product + origin + destination -> HS code,
// tariff, landed cost, document checklist). Rate limited since it's public
// and the most likely target of automated abuse.
export const POST = withApiHandler(
  async (request: Request) => {
    const body = await request.json();
    const { product, originCountry, destinationCountry, productValue, estimatedFreight } =
      lookupSchema.parse(body);

    const matches = await findHsCodeMatches(product);
    if (matches.length === 0) {
      throw new AppError(404, "No matching HS code found for that product yet. Try a broader term.");
    }

    const bestMatch = matches[0];
    const tariffRule = await getTariffRule(bestMatch.code, originCountry, destinationCountry);
    const checklist = await getComplianceChecklist(destinationCountry, bestMatch.code);

    const landedCost =
      tariffRule && productValue !== undefined
        ? calculateLandedCost({
            productValue,
            tariffPercent: tariffRule.tariffPercent,
            additionalFeePercent: tariffRule.additionalFeePercent,
            estimatedFreight: estimatedFreight ?? 0,
          })
        : null;

    return NextResponse.json({
      hsCode: bestMatch,
      alternateMatches: matches.slice(1),
      tariff: tariffRule,
      landedCost,
      documentChecklist: checklist,
    });
  },
  { rateLimit: { limit: 30, windowMs: 60_000 } }
);
