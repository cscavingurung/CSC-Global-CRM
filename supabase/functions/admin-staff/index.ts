// Admin-only staff account actions (create / reset password / update email / delete).
//
// This function exists because the browser only ever holds the Supabase anon key — creating or
// resetting another person's login needs the service-role key, which must never reach the
// client. The service-role key lives only in this function's environment (set once via
// `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`), never in the app bundle or .env.
//
// Deploy: supabase functions deploy admin-staff
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type StaffRow = { auth_user_id: string | null; role: string; status: string; branch: string };

type CreatePayload = { action: 'create'; email: string; password: string };
type ResetPasswordPayload = { action: 'resetPassword'; targetAuthUserId: string; password: string };
type UpdateEmailPayload = { action: 'updateEmail'; targetAuthUserId: string; email: string };
type DeletePayload = { action: 'delete'; targetAuthUserId: string };
type Payload = CreatePayload | ResetPasswordPayload | UpdateEmailPayload | DeletePayload;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Verify the caller: must be a signed-in, Active Super Admin or Branch Manager.
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Missing Authorization header' }, 401);

  const { data: callerAuth, error: callerAuthError } = await admin.auth.getUser(jwt);
  if (callerAuthError || !callerAuth.user) return json({ error: 'Invalid session' }, 401);

  const { data: caller, error: callerLookupError } = await admin
    .from('staff')
    .select('auth_user_id, role, status, branch')
    .eq('auth_user_id', callerAuth.user.id)
    .maybeSingle<StaffRow>();
  if (callerLookupError) return json({ error: callerLookupError.message }, 500);
  if (!caller || caller.status !== 'Active' || (caller.role !== 'Super Admin' && caller.role !== 'Branch Manager')) {
    return json({ error: 'Not authorized to manage staff accounts' }, 403);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // A Branch Manager may only manage accounts in their own branch. For `create`, the caller
  // must pass the intended branch so this can be checked up front; for the others, the target
  // staff row's branch is looked up first.
  async function assertBranchScope(targetBranch: string) {
    if (caller!.role === 'Branch Manager' && targetBranch !== caller!.branch) {
      throw new Response(JSON.stringify({ error: 'Branch Managers may only manage staff in their own branch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  async function findAuthUserByEmail(email: string): Promise<string | null> {
    const wanted = email.trim().toLowerCase();
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const match = data.users.find((u) => u.email?.toLowerCase() === wanted);
      if (match) return match.id;
      if (data.users.length < 1000) return null;
    }
  }

  try {
    if (payload.action === 'create') {
      const branchPayload = payload as CreatePayload & { branch?: string };
      if (branchPayload.branch) await assertBranchScope(branchPayload.branch);
      const { data, error } = await admin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
      });
      if (!error) return json({ authUserId: data.user!.id });

      // The email may already have a login left behind with no staff row (e.g. a staff member
      // removed before the login was cleaned up). Such a login grants no access, so reuse it
      // with the new password instead of refusing the email forever.
      const existing = await findAuthUserByEmail(payload.email);
      if (!existing) return json({ error: error.message }, 400);
      const { data: linked, error: linkedError } = await admin
        .from('staff')
        .select('auth_user_id')
        .eq('auth_user_id', existing)
        .maybeSingle();
      if (linkedError) return json({ error: linkedError.message }, 500);
      if (linked) return json({ error: 'This email is already used by another staff account' }, 409);
      const { error: reuseError } = await admin.auth.admin.updateUserById(existing, {
        password: payload.password,
        email_confirm: true,
      });
      if (reuseError) return json({ error: reuseError.message }, 400);
      return json({ authUserId: existing });
    }

    // For the remaining actions, resolve the target staff row to enforce branch scope.
    const targetAuthUserId = (payload as ResetPasswordPayload | UpdateEmailPayload | DeletePayload).targetAuthUserId;
    const { data: target, error: targetError } = await admin
      .from('staff')
      .select('auth_user_id, role, status, branch')
      .eq('auth_user_id', targetAuthUserId)
      .maybeSingle<StaffRow>();
    if (targetError) return json({ error: targetError.message }, 500);
    if (!target) return json({ error: 'No staff record for this account' }, 404);
    await assertBranchScope(target.branch);

    if (payload.action === 'resetPassword') {
      const { error } = await admin.auth.admin.updateUserById(targetAuthUserId, { password: payload.password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (payload.action === 'updateEmail') {
      const { error } = await admin.auth.admin.updateUserById(targetAuthUserId, { email: payload.email, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (payload.action === 'delete') {
      const { error } = await admin.auth.admin.deleteUser(targetAuthUserId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    return json({ error: String(thrown) }, 500);
  }
});
