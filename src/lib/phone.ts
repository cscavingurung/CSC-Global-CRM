// Phone rules shared by Add Client (NewIntakeForm) and Marketing's quick Add Lead form.

// +1 (Canada/US, 10-digit NANP number) or +977 (Nepal, 10-digit mobile starting with 9).
export const PHONE_REGEX = /^(?:\+1[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}|\+977[\s-]?9\d{9})$/;

export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.trim());
}

// The "+1"/"+977" country code we prepend is synthetic, not typed by the user — since the
// input is controlled, our own formatted output becomes next keystroke's raw value, so the
// digit(s) inside that prefix ("1", or "977") must never be re-counted as dialed digits.
function staticPrefixLength(value: string): number {
  if (value.startsWith('+977')) return 4;
  if (value.startsWith('+1')) return 2;
  return 0;
}

// Live-formats digits as they're typed — a 9-leading number becomes a Nepal +977 mobile
// number, anything else is treated as a NANP +1 number, matching the input on
// cscglobalcanada.ca/contact so staff never have to type the country code or punctuation.
export function formatPhoneInput(raw: string): string {
  const digits = raw.slice(staticPrefixLength(raw)).replace(/\D/g, '').slice(0, 10);
  if (!digits) return '';
  if (digits[0] === '9') return `+977 ${digits}`;

  const area = digits.slice(0, 3);
  const mid = digits.slice(3, 6);
  const last = digits.slice(6, 10);
  let out = `+1 (${area}`;
  if (area.length === 3) out += ')';
  if (mid) out += ` ${mid}`;
  if (last) out += `-${last}`;
  return out;
}

// How many real (dialed) digits sit before the caret in the raw, pre-format input value.
export function dialedDigitsBeforeCaret(raw: string, caretIndex: number): number {
  const prefixLen = staticPrefixLength(raw);
  if (caretIndex <= prefixLen) return 0;
  return raw.slice(prefixLen, caretIndex).replace(/\D/g, '').length;
}

// Re-formatting on every keystroke changes the string length (adding "(", ")", "-", "+977 "),
// which resets the browser's cursor to the wrong spot unless we restore it ourselves — this
// finds where the caret belongs in the new formatted string by counting real dialed digits,
// skipping the synthetic country-code prefix so its digit(s) don't throw the count off.
export function caretPositionForDigitCount(formatted: string, digitCount: number): number {
  const prefixLen = staticPrefixLength(formatted);
  if (digitCount <= 0) return prefixLen;
  let seen = 0;
  for (let i = prefixLen; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}
