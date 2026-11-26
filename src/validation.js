export function normalizeIndianMobile(value) {
  const input = String(value ?? "").trim();
  if (!input || !/^\+?[\d\s()-]+$/.test(input)) return "";

  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  return /^[6-9]\d{9}$/.test(digits) ? digits : "";
}

export function isValidIndianMobile(value) {
  return Boolean(normalizeIndianMobile(value));
}

export const INDIAN_MOBILE_ERROR = "Enter a valid 10-digit Indian mobile number starting with 6–9.";
