import { MockUser } from '../types';
import { STAFF_ROLE_TO_ROLE } from '../mockData';
import { supabase } from './supabaseClient';
import { fromRow, StaffRow } from './staffApi';

export type StaffUserResult = { user: MockUser } | { error: string };

// Builds the session user from this auth user's own `staff` row — RLS allows a self-read
// (auth_user_id = auth.uid()) once authenticated. Used at sign-in and when restoring a session
// on refresh, so role/branch always come from the database, never from browser storage.
export async function resolveStaffUser(authUserId: string): Promise<StaffUserResult> {
  if (!supabase) return { error: 'Can’t reach the server — check the connection and try again.' };
  const { data: staffRow, error: staffError } = await supabase
    .from('staff')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle<StaffRow>();
  if (staffError) return { error: 'Could not load your staff record. Try again, or contact the Super Admin.' };
  const match = staffRow ? fromRow(staffRow) : undefined;
  if (!match || match.status !== 'Active') {
    return { error: match ? 'This account is inactive. Contact your manager or the Super Admin.' : 'No staff record is linked to this account. Contact the Super Admin.' };
  }
  return {
    user: {
      name: match.name,
      role: STAFF_ROLE_TO_ROLE[match.role],
      branch: match.branch,
      email: match.email,
      authUserId,
      ...(match.role === 'Marketing' ? { marketingRole: match.marketingRole ?? 'Marketing Manager' } : {}),
    },
  };
}
