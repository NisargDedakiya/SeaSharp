import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";

const { countries, hsCodes, tariffs, complianceDocuments } = schema;

const COUNTRIES = [
  { code: "IN", name: "India", region: "INDIA" },
  { code: "AE", name: "United Arab Emirates", region: "UAE" },
  { code: "US", name: "United States", region: "USA" },
  { code: "DE", name: "Germany", region: "EU" },
  { code: "CN", name: "China", region: "CHINA" },
];

const HS_CODES = [
  { code: "0909.31", description: "Cumin seeds, whole", category: "Spices" },
  { code: "1207.40", description: "Sesame seeds, whether or not broken", category: "Oilseeds" },
  { code: "5201.00", description: "Cotton, not carded or combed", category: "Textiles - Raw Fiber" },
  { code: "0910.30", description: "Turmeric (curcuma)", category: "Spices" },
  { code: "1006.30", description: "Semi-milled or wholly milled rice (basmati)", category: "Grains" },
];

// Tariff rules: origin India -> destination zone, per HS code. Illustrative
// Phase 1 rates covering the 5 launch zones from the product spec.
const TARIFF_RULES: Array<{
  hsCode: string;
  originCountry: string;
  destinationCountry: string;
  dutyRatePercent: number;
  additionalFeePercent: number;
  notes: string;
}> = [
  { hsCode: "0909.31", originCountry: "IN", destinationCountry: "AE", dutyRatePercent: 0, additionalFeePercent: 5, notes: "UAE VAT applies; no customs duty under GCC common tariff for raw spices." },
  { hsCode: "0909.31", originCountry: "IN", destinationCountry: "US", dutyRatePercent: 1.5, additionalFeePercent: 0.3464, notes: "HTS duty + Merchandise Processing Fee." },
  { hsCode: "0909.31", originCountry: "IN", destinationCountry: "DE", dutyRatePercent: 0, additionalFeePercent: 0, notes: "EU GSP preferential rate for raw spices from India." },
  { hsCode: "0909.31", originCountry: "IN", destinationCountry: "CN", dutyRatePercent: 8, additionalFeePercent: 9, notes: "MFN duty + VAT." },

  { hsCode: "1207.40", originCountry: "IN", destinationCountry: "AE", dutyRatePercent: 0, additionalFeePercent: 5, notes: "GCC common tariff exemption on raw oilseeds; VAT applies." },
  { hsCode: "1207.40", originCountry: "IN", destinationCountry: "US", dutyRatePercent: 0, additionalFeePercent: 0.3464, notes: "Duty-free under HTS; MPF still applies." },
  { hsCode: "1207.40", originCountry: "IN", destinationCountry: "DE", dutyRatePercent: 0, additionalFeePercent: 0, notes: "EU GSP preferential rate." },
  { hsCode: "1207.40", originCountry: "IN", destinationCountry: "CN", dutyRatePercent: 3, additionalFeePercent: 9, notes: "MFN duty + VAT." },

  { hsCode: "5201.00", originCountry: "IN", destinationCountry: "AE", dutyRatePercent: 0, additionalFeePercent: 5, notes: "Raw cotton exempt from customs duty; VAT applies." },
  { hsCode: "5201.00", originCountry: "IN", destinationCountry: "US", dutyRatePercent: 0, additionalFeePercent: 0.3464, notes: "Duty-free raw cotton fiber." },
  { hsCode: "5201.00", originCountry: "IN", destinationCountry: "DE", dutyRatePercent: 0, additionalFeePercent: 0, notes: "EU common external tariff-free for raw cotton." },
  { hsCode: "5201.00", originCountry: "IN", destinationCountry: "CN", dutyRatePercent: 1, additionalFeePercent: 9, notes: "MFN duty + VAT." },

  { hsCode: "0910.30", originCountry: "IN", destinationCountry: "AE", dutyRatePercent: 0, additionalFeePercent: 5, notes: "GCC exemption; VAT applies." },
  { hsCode: "0910.30", originCountry: "IN", destinationCountry: "US", dutyRatePercent: 0, additionalFeePercent: 0.3464, notes: "Duty-free spice classification." },
  { hsCode: "0910.30", originCountry: "IN", destinationCountry: "DE", dutyRatePercent: 0, additionalFeePercent: 0, notes: "EU GSP preferential rate." },
  { hsCode: "0910.30", originCountry: "IN", destinationCountry: "CN", dutyRatePercent: 10, additionalFeePercent: 9, notes: "MFN duty + VAT." },

  { hsCode: "1006.30", originCountry: "IN", destinationCountry: "AE", dutyRatePercent: 0, additionalFeePercent: 5, notes: "GCC exemption on food grains; VAT applies." },
  { hsCode: "1006.30", originCountry: "IN", destinationCountry: "US", dutyRatePercent: 1.4, additionalFeePercent: 0.3464, notes: "HTS duty on milled rice + MPF." },
  { hsCode: "1006.30", originCountry: "IN", destinationCountry: "DE", dutyRatePercent: 0, additionalFeePercent: 0, notes: "EU GSP preferential rate for basmati rice." },
  { hsCode: "1006.30", originCountry: "IN", destinationCountry: "CN", dutyRatePercent: 5, additionalFeePercent: 9, notes: "MFN duty + VAT." },
];

const GENERAL_DOCS = [
  { name: "Commercial Invoice", description: "Itemized invoice stating value, HS code, and terms of sale." },
  { name: "Packing List", description: "Detailed listing of package contents, weights, and dimensions." },
  { name: "Certificate of Origin", description: "Certifies the country of manufacture/production for tariff-preference eligibility." },
  { name: "Bill of Lading / Airway Bill", description: "Transport document issued by the carrier evidencing shipment." },
];

const ZONE_SPECIFIC_DOCS: Record<string, Array<{ name: string; description: string; hsCode?: string }>> = {
  AE: [
    { name: "UAE Certificate of Conformity", description: "Required for regulated food and agricultural imports into the UAE." },
    { name: "Halal Certificate", description: "Required for food-category exports where applicable.", hsCode: "0909.31" },
  ],
  US: [
    { name: "FDA Prior Notice", description: "Required for food imports under the FDA Food Safety Modernization Act." },
    { name: "USDA Phytosanitary Certificate", description: "Required for agricultural commodities entering the United States." },
  ],
  DE: [
    { name: "EU Common Health Entry Document (CHED)", description: "Required for agri-food consignments entering the EU via border control posts." },
    { name: "EUR.1 Movement Certificate", description: "Supports GSP preferential tariff treatment claims." },
  ],
  CN: [
    { name: "CIQ Inspection Certificate", description: "China Inspection and Quarantine clearance for agricultural imports." },
    { name: "China Customs Declaration Form", description: "Standard import declaration required by China Customs." },
  ],
};

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    for (const country of COUNTRIES) {
      await db
        .insert(countries)
        .values(country)
        .onConflictDoUpdate({ target: countries.code, set: { name: country.name, region: country.region } });
    }

    for (const hs of HS_CODES) {
      await db
        .insert(hsCodes)
        .values(hs)
        .onConflictDoUpdate({ target: hsCodes.code, set: { description: hs.description, category: hs.category } });
    }

    for (const rule of TARIFF_RULES) {
      const { hsCode, originCountry, destinationCountry, dutyRatePercent, additionalFeePercent, notes } = rule;
      await db
        .insert(tariffs)
        .values({
          hsCode,
          originCountry,
          destinationCountry,
          dutyRatePercent: dutyRatePercent.toString(),
          additionalFeePercent: additionalFeePercent.toString(),
          notes,
        })
        .onConflictDoUpdate({
          target: [tariffs.hsCode, tariffs.originCountry, tariffs.destinationCountry],
          set: { dutyRatePercent: dutyRatePercent.toString(), additionalFeePercent: additionalFeePercent.toString(), notes },
        });
    }

    await db.delete(complianceDocuments);
    for (const doc of GENERAL_DOCS) {
      await db.insert(complianceDocuments).values({
        destinationCountry: "*",
        name: doc.name,
        description: doc.description,
        required: true,
      });
    }
    for (const [destinationCountry, docs] of Object.entries(ZONE_SPECIFIC_DOCS)) {
      for (const doc of docs) {
        await db.insert(complianceDocuments).values({
          destinationCountry,
          hsCode: doc.hsCode,
          name: doc.name,
          description: doc.description,
          required: true,
        });
      }
    }

    console.log("Seed complete:", {
      countries: COUNTRIES.length,
      hsCodes: HS_CODES.length,
      tariffRules: TARIFF_RULES.length,
    });
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
