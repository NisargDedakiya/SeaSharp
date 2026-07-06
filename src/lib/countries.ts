export const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  AE: "United Arab Emirates",
  US: "United States",
  DE: "Germany",
  CN: "China",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}
