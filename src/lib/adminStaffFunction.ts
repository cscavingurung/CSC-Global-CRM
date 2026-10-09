import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

// Thin wrapper around the `admin-staff` Edge Function — the only place allowed to create,
// reset the password of, change the login email of, or delete another staff member's Auth
// account (the browser only ever holds the anon key, which can't do any of this directly).

/** A non-2xx reply surfaces as a generic "Edge Function returned a non-2xx status code";
 * the function's own `{ error }` body says what actually went wrong. */
async function toReadableError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return new Error(body.error);
    } catch {
      // Body wasn't JSON — fall through to the generic error.
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

export async function createStaffAccount(email: string, password: string, branch: string): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke<{ authUserId: string; error?: string }>('admin-staff', {
    body: { action: 'create', email, password, branch },
  });
  if (error) throw await toReadableError(error);
  if (data?.error) throw new Error(data.error);
  return data!.authUserId;
}

export async function resetStaffPassword(targetAuthUserId: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('admin-staff', {
    body: { action: 'resetPassword', targetAuthUserId, password },
  });
  if (error) throw await toReadableError(error);
  if (data?.error) throw new Error(data.error);
}

export async function updateStaffEmail(targetAuthUserId: string, email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('admin-staff', {
    body: { action: 'updateEmail', targetAuthUserId, email },
  });
  if (error) throw await toReadableError(error);
  if (data?.error) throw new Error(data.error);
}

export async function deleteStaffAccount(targetAuthUserId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('admin-staff', {
    body: { action: 'delete', targetAuthUserId },
  });
  if (error) throw await toReadableError(error);
  if (data?.error) throw new Error(data.error);
}
