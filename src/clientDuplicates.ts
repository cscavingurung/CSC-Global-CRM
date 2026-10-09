import { IntakeStudent } from './types';

/** Phone numbers are typed with and without country codes and spacing ("+977 98XXXXXXXX",
 * "98XXXXXXXX"), so they're compared on their last 10 digits. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

export function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

/** An existing client/lead in `branch` with the same phone or email, if any. An empty email
 * never matches, and a phone needs at least 7 digits to count. */
export function findBranchDuplicate(
  students: IntakeStudent[],
  branch: string,
  phone: string,
  email: string,
): IntakeStudent | null {
  if (!branch) return null;
  const phoneMatch = phoneKey(phone);
  const emailMatch = emailKey(email);
  return (
    students.find(
      (s) =>
        s.branch === branch &&
        ((phoneMatch.length >= 7 && phoneKey(s.phone ?? '') === phoneMatch) ||
          (emailMatch !== '' && emailKey(s.email ?? '') === emailMatch)),
    ) ?? null
  );
}
