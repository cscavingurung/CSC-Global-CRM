# Security Audit

## Summary

| Area | State |
|---|---|
| Authentication | ❌ No server-side authentication. Browser compares against the `staff` table (after this audit); previously no password at all. |
| Passwords | ❌ Plain text in `staff.password`, readable by anyone with the site's anon key. |
| Authorization (RLS) | ❌ Every table: `for all using (true) with check (true)`. |
| Deactivated users | ⚠️ Fixed in the app (blocked + signed out) — but the database still accepts their requests. |
| Financial data | ⚠️ Not stored, so not leakable from the DB — but also not protected: all ledger data sits in every browser's memory. |
| Storage | n/a (no files stored). |
| Secrets | ✅ Only the anon key is in the frontend (normal for Supabase) — it must be paired with real RLS. |

## Malicious scenarios (as requested)

| # | Scenario | Result today | Why |
|---|---|---|---|
| 1 | Counselor reads another branch's client | **Possible** | UI filters by branch, but `counselor_students`/`applications` are fully downloaded and the REST API returns every row. |
| 2 | Front Desk reads finance records | **Possible** | Finance ledger is in every browser's memory (not in DB yet). |
| 3 | Marketing reads private client documents | n/a for files (none stored); **possible** for client records via REST. |
| 4 | Employee modifies another's attendance | **Possible** in-browser (memory) — and will be via REST once saved unless RLS is written. |
| 5 | Counselor approves own discount | **Not in the UI** (only Branch Managers see the Approval Center); **possible** by editing state/REST once finance is saved. |
| 6 | Staff modifies a receipt | UI only allows void-with-reason by managers; nothing stops a direct write. |
| 7 | Normal user reaches Super Admin data by changing URL/API params | UI blocks pages by role; **REST returns everything**. |
| 8 | Direct backend call without UI | **Everything readable and writable**, incl. `staff` passwords. |

## Fixed in this pass
- Sign-in requires email + password outside demo mode (`src/components/Login.tsx`); single "incorrect email or password" message (no account probing).
- Inactive employees can't sign in; a signed-in employee is signed out as soon as their record is deactivated or removed (`App.tsx`, realtime `staff`).
- Demo mode (`src/appMode.ts`): the account picker and sample data exist only on the dev server or with `VITE_DEMO_MODE=true`; the production bundle doesn't contain the picker (verified).

## Required before real data (P0)
1. **Supabase Auth** for sign-in (email + password, reset flow, session expiry). Remove `staff.password`.
2. **RLS policies** per table using `auth.uid()` → `staff` (role, branch, status) — design in [ROLE_PERMISSION_AUDIT](ROLE_PERMISSION_AUDIT.md#what-must-happen-rls-design-summary).
3. **Security-definer RPCs** for sensitive state changes (approve/reject, void payment, record payment + receipt number, process refund, override) that check role, branch, requester ≠ approver, and write `audit_log`.
4. Column-restricted **views** for data other roles may see partially (e.g. staff directory without salary; client list without finance for Marketing).
5. Revoke `DELETE` on financial, approval, HR history and agreement tables; void/archive via RPC.
6. Rotate the anon key after RLS is live (the current key has effectively been public with full access).

## Other observations
- Error handling: 53 database writes only `console.error` on failure — the user believes it saved (P1, data integrity).
- Uploaded "files" are names only; if document storage is added, use a private bucket with per-branch policies and signed URLs.
- Audit trail is partial and not persisted except inside client records.
