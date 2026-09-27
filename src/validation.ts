// Requires a proper local-part@domain.tld shape, not just "contains an @ and a dot".
export const EMAIL_PATTERN = '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}';

// Chrome (and other browsers) apply their own permissive built-in check for
// <input type="email"> — which allows a dot-less, TLD-less domain like "user@domain" —
// and ignore the `pattern` attribute once that baseline passes. So `pattern` alone
// cannot enforce EMAIL_PATTERN on a type="email" field; this must be checked in JS
// (e.g. at submit time via setCustomValidity) for the stricter shape to actually apply.
const EMAIL_REGEX = new RegExp(`^(?:${EMAIL_PATTERN})$`);

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

// More than 8 and fewer than 16 characters (9–15), with at least one letter and one number.
// type="password" (unlike type="email") does respect `pattern` natively, so this can be used
// directly as an <input pattern> value.
export const PASSWORD_PATTERN = '(?=.*[A-Za-z])(?=.*\\d).{9,15}';
