/** India is the store's home market, so +91 is the default dial code. */
export const DEFAULT_DIAL_CODE = "+91";

export const DIAL_CODES = [
  { code: "+91", label: "IN +91" },
  { code: "+1", label: "US +1" },
  { code: "+44", label: "UK +44" },
  { code: "+971", label: "AE +971" },
  { code: "+65", label: "SG +65" },
];

/** Digits only, so paste-ins like "93846 26894" or "(938) 462-6894" work. */
export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/** Supabase requires E.164 — dial code plus national number, no spaces. */
export function toE164(dialCode: string, national: string) {
  return `${dialCode}${digitsOnly(national)}`;
}

export function isValidNationalNumber(dialCode: string, national: string) {
  const digits = digitsOnly(national);
  if (dialCode === "+91") return /^[6-9]\d{9}$/.test(digits);
  return digits.length >= 6 && digits.length <= 14;
}

/** "+919384626894" -> "+91 93846 26894" for display. */
export function formatPhoneForDisplay(e164: string) {
  const match = /^(\+91)(\d{5})(\d{5})$/.exec(e164);
  if (match) return `${match[1]} ${match[2]} ${match[3]}`;
  return e164;
}
