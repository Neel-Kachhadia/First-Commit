export type CardNetwork = "Visa" | "Mastercard" | "American Express" | "Discover";

// Prefix recognition is illustrative, not a BIN lookup or issuer verification.
export function detectCardNetwork(value: string): CardNetwork | null {
  const digits = value.replace(/\D/g, "");
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^4/.test(digits)) return "Visa";
  if (/^5[1-5]/.test(digits)) return "Mastercard";
  if (digits.length >= 6) {
    const firstSix = Number(digits.slice(0, 6));
    if (firstSix >= 222100 && firstSix <= 272099) return "Mastercard";
  }
  if (/^6011|^65|^64[4-9]/.test(digits)) return "Discover";
  return null;
}

export function isCompleteCardNumber(value: string): boolean {
  return /^\d{12,19}$/.test(value);
}

export function formatCardFace(value: string): string {
  const total = /^3[47]/.test(value) ? 15 : 16;
  const shown = value.slice(0, 19);
  const padded = shown.length >= total ? shown : (shown + "•".repeat(total)).slice(0, total);
  const groups = total === 15 ? [4, 6, 5] : [4, 4, 4, 4, 3];
  let index = 0;
  return groups.map((size) => {
    const group = padded.slice(index, index + size);
    index += size;
    return group;
  }).filter(Boolean).join(" ");
}

export function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function isFutureExpiry(value: string, now = new Date()): boolean {
  if (!/^\d{2}\/\d{2}$/.test(value)) return false;
  const month = Number(value.slice(0, 2));
  const year = 2000 + Number(value.slice(3, 5));
  if (month < 1 || month > 12) return false;
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}
