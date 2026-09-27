import { supabase } from './supabaseClient';

// Thin wrapper around the `admin-staff` Edge Function — the only place allowed to create,
// reset the password of, change the login email of, or delete another staff member's Auth
// account (the browser only ever holds the anon key, which can't do any of this directly).

export async function createStaffAccount(email: string, password: string, branch: string): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke<{ authUserId: string; error?: string }>('admin-staff', {
    body: { action: 'create', email, password, branch },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data!.authUserId;
}

export async function resetStaffPassword(targetAuthUserId: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('admin-staff', {
    body: { action: 'resetPassword', targetAuthUserId, password },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function updateStaffEmail(targetAuthUserId: string, email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('admin-staff', {
    body: { action: 'updateEmail', targetAuthUserId, email },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function deleteStaffAccount(targetAuthUserId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('admin-staff', {
    body: { action: 'delete', targetAuthUserId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
