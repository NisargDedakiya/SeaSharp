import { dbConnect } from "@/lib/mongoose";
import { Country, HsCode, TariffRule, ComplianceDocument } from "@/models";
import mongoose from "mongoose";

const COUNTRIES = [
  { code: "IN", name: "India", zone: "INDIA" as const },
  { code: "AE", name: "United Arab Emirates", zone: "UAE" as const },
  { code: "US", name: "United States", zone: "USA" as const },
  { code: "DE", name: "Germany", zone: "EU" as const },
  { code: "CN", name: "China", zone: "CHINA" as const },
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
  tariffPercent: number;
  additionalFeePercent: number;
  notes: string;
}> = [
  { hsCode: "0909.31", originCountry: "IN", destinationCountry: "AE", tariffPercent: 0, additionalFeePercent: 5, notes: "UAE VAT applies; no customs duty under GCC common tariff for raw spices." },
  { hsCode: "0909.31", originCountry: "IN", destinationCountry: "US", tariffPercent: 1.5, additionalFeePercent: 0.3464, notes: "HTS duty + Merchandise Processing Fee." },
  { hsCode: "0909.31", originCountry: "IN", destinationCountry: "DE", tariffPercent: 0, additionalFeePercent: 0, notes: "EU GSP preferential rate for raw spices from India." },
  { hsCode: "0909.31", originCountry: "IN", destinationCountry: "CN", tariffPercent: 8, additionalFeePercent: 9, notes: "MFN duty + VAT." },

  { hsCode: "1207.40", originCountry: "IN", destinationCountry: "AE", tariffPercent: 0, additionalFeePercent: 5, notes: "GCC common tariff exemption on raw oilseeds; VAT applies." },
  { hsCode: "1207.40", originCountry: "IN", destinationCountry: "US", tariffPercent: 0, additionalFeePercent: 0.3464, notes: "Duty-free under HTS; MPF still applies." },
  { hsCode: "1207.40", originCountry: "IN", destinationCountry: "DE", tariffPercent: 0, additionalFeePercent: 0, notes: "EU GSP preferential rate." },
  { hsCode: "1207.40", originCountry: "IN", destinationCountry: "CN", tariffPercent: 3, additionalFeePercent: 9, notes: "MFN duty + VAT." },

  { hsCode: "5201.00", originCountry: "IN", destinationCountry: "AE", tariffPercent: 0, additionalFeePercent: 5, notes: "Raw cotton exempt from customs duty; VAT applies." },
  { hsCode: "5201.00", originCountry: "IN", destinationCountry: "US", tariffPercent: 0, additionalFeePercent: 0.3464, notes: "Duty-free raw cotton fiber." },
  { hsCode: "5201.00", originCountry: "IN", destinationCountry: "DE", tariffPercent: 0, additionalFeePercent: 0, notes: "EU common external tariff-free for raw cotton." },
  { hsCode: "5201.00", originCountry: "IN", destinationCountry: "CN", tariffPercent: 1, additionalFeePercent: 9, notes: "MFN duty + VAT." },

  { hsCode: "0910.30", originCountry: "IN", destinationCountry: "AE", tariffPercent: 0, additionalFeePercent: 5, notes: "GCC exemption; VAT applies." },
  { hsCode: "0910.30", originCountry: "IN", destinationCountry: "US", tariffPercent: 0, additionalFeePercent: 0.3464, notes: "Duty-free spice classification." },
  { hsCode: "0910.30", originCountry: "IN", destinationCountry: "DE", tariffPercent: 0, additionalFeePercent: 0, notes: "EU GSP preferential rate." },
  { hsCode: "0910.30", originCountry: "IN", destinationCountry: "CN", tariffPercent: 10, additionalFeePercent: 9, notes: "MFN duty + VAT." },

  { hsCode: "1006.30", originCountry: "IN", destinationCountry: "AE", tariffPercent: 0, additionalFeePercent: 5, notes: "GCC exemption on food grains; VAT applies." },
  { hsCode: "1006.30", originCountry: "IN", destinationCountry: "US", tariffPercent: 1.4, additionalFeePercent: 0.3464, notes: "HTS duty on milled rice + MPF." },
  { hsCode: "1006.30", originCountry: "IN", destinationCountry: "DE", tariffPercent: 0, additionalFeePercent: 0, notes: "EU GSP preferential rate for basmati rice." },
  { hsCode: "1006.30", originCountry: "IN", destinationCountry: "CN", tariffPercent: 5, additionalFeePercent: 9, notes: "MFN duty + VAT." },
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
  await dbConnect();

  for (const country of COUNTRIES) {
    await Country.findByIdAndUpdate(country.code, { _id: country.code, ...country }, { upsert: true });
  }

  for (const hs of HS_CODES) {
    await HsCode.findByIdAndUpdate(hs.code, { _id: hs.code, ...hs }, { upsert: true });
  }

  for (const rule of TARIFF_RULES) {
    await TariffRule.findOneAndUpdate(
      { hsCode: rule.hsCode, originCountry: rule.originCountry, destinationCountry: rule.destinationCountry },
      rule,
      { upsert: true }
    );
  }

  await ComplianceDocument.deleteMany({});
  for (const doc of GENERAL_DOCS) {
    await ComplianceDocument.create({
      destinationCountry: "*",
      name: doc.name,
      description: doc.description,
      required: true,
    });
  }
  for (const [destinationCountry, docs] of Object.entries(ZONE_SPECIFIC_DOCS)) {
    for (const doc of docs) {
      await ComplianceDocument.create({
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
