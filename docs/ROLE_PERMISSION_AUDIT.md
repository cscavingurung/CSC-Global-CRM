# Role & Permission Audit

## The one fact that matters most

**No permission in this CRM is enforced by the backend.** The browser connects to Supabase with the public anon key, and every table's policy is `for all using (true) with check (true)`. Every rule below is enforced only by what the React app shows and by checks inside `App.tsx` handlers — both run on the user's own computer and can be bypassed by calling the Supabase REST API directly with the key that ships in the page. Hiding a button is not security; this table documents *intended* behaviour, which still has to be moved into RLS policies ([SECURITY_AUDIT](SECURITY_AUDIT.md)).

## Roles that exist

| Requested role | In the CRM? |
|---|---|
| Super Admin | ✅ `super_admin` |
| Branch Manager | ✅ `branch_manager` |
| Counselor | ✅ `counselor` |
| Front Desk | ✅ `receptionist` ("Front Desk Officer") |
| Application Officer / Visa Officer | ⚠️ one combined role: `application_officer` ("V/A Officer") |
| Marketing Manager, Content Planner, Graphics Designer, Leads Specialist | ✅ `marketing` + `marketingRole` |
| Finance | ❌ none. Branch Managers run branch finance; seed data mentions "Finance — Head Office" processing refunds, but no role exists. |
| IT | ❌ none. IT tickets are raised but no IT user resolves them. |
| Customer Service | ❌ none |
| Partner / Business Development | ❌ none (Super Admin manages Partners) |

**BUSINESS DECISION REQUIRED:** whether Finance, IT, Customer Service, Partner/BD and a separate Visa Officer role are needed. Each needs a nav, a data scope and RLS policies.

## Per-role matrix (intended, UI-enforced)

"Branch" = the user's own branch only. "✕" = no access in the UI.

| | View | Create | Edit | Delete | Approve | Assign | Export | Branches | Client data | Financial | Sensitive |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Super Admin** | Everything | Branches, staff, partners | Everything via pages; overrides (audited) | Branches, staff, partners | — (Approval Center is per branch) | — | Every dataset (xlsx), monthly report | All | All | All (company) | Staff incl. passwords (P0) |
| **Branch Manager** | Branch clients, applications, staff, HR, finance, marketing requests, transfers | Tasks, notices, leave decisions, content/support/IT requests, transfer requests, service fees | Client profile, tasks, staff status, handovers | Tasks; staff (remove) | Leave, attendance corrections, discounts, refunds, payment exceptions, expenses, transfers out of branch | Counselors to leads, tasks, content to staff, handovers | CSV/xlsx on several pages | Own | Own branch | Own branch incl. salary (payroll inputs) | Staff records of branch |
| **Counselor** | Own clients, own marketing requests, own financials (read-only ledger for own clients) | Clients (self-assigned), notes, discount/exception requests, service fees (own clients), leave, issues | Own clients' profile & status tracker | ✕ | ✕ | ✕ (handover own client to another counselor) | Enrolled / Visa Approved CSV | Own | Own assigned clients | Own clients' ledger (read) | — |
| **Front Desk** | Branch leads, clients (read-only profile), visitors, payments | Leads/intake, payments + receipts, visits, issues, leave | Lead details before assignment | ✕ | ✕ | Counselor to lead | ✕ | Own | Branch leads & clients | Can record payments; can't edit/void/refund/discount | — |
| **V/A Officer** | Branch applications (offer & visa queues) | Offer attempts, document charges | Application/visa status, checklists, University Client ID at Fee Paid | ✕ | ✕ | ✕ | Sheets on queues | Own | Branch applications | Can add document charges | — |
| **Marketing Manager** | Marketing store, lead tracking incl. revenue attribution | Leads, campaigns, content, requests | All marketing | Marketing items | Content/design review | Leads to branches, content to designers | Reports | All (marketing view) | Marketing-generated leads only | Marketing revenue only | — |
| **Leads Specialist / Content Planner** | Their part of marketing | Leads / content requests | Their items | — | — | Leads / content requests | — | All | Marketing leads only | ✕ | — |
| **Graphics Designer** | Design/video production queue only | — | Own tasks' progress & files | ✕ | ✕ | ✕ | ✕ | — | ✕ | ✕ | — |

### Checks that *are* enforced in `App.tsx` handlers (client-side only)
Handover (only the client's own counselor, or the Branch Manager within branch); inter-branch transfer decisions (only the origin branch's manager); content-request delegation and submission (only the addressee, only while waiting); Branch Manager workspace actions (role + branch); task reassignment (branch + role match); Super Admin overrides (role + reason ≥ 10 chars); country-route steps (sequence, locks, mandatory University Client ID); discounts/refunds only apply once status is Approved/Processed.

### Missing actions / gaps
- **Self-approval:** nothing prevents a Branch Manager from approving their own leave or expense (they are the approver for their branch). **BUSINESS DECISION:** who approves the Branch Manager's own requests (Super Admin?).
- **Discount limits:** a Branch Manager can approve any discount amount. **BUSINESS DECISION:** thresholds for Super Admin approval.
- **Refund processing:** refunds move to "Processed" with a name "Finance — Head Office" but no role performs it.
- **Counselor data scope:** counselors only see their own clients in the UI, but the full `counselor_students` and `applications` tables are downloaded to every browser.
- **Front Desk financial restriction:** enforced by which components render; the ledger is in browser memory for everyone.
- **Marketing boundary:** Marketing never mounts branch pages, but branch tables are downloaded for everyone.

## What must happen (RLS design summary)
1. Move sign-in to **Supabase Auth**; store `auth.uid()` on `staff` (`user_id`), plus role, marketing role, branch **id**, status.
2. A `current_staff()` SQL function returning the caller's role/branch; `status = 'Active'` required by every policy (deactivation = instant loss of access).
3. Per-table policies (example targets):
   - `students`, `counselor_students`, `applications`: SELECT/UPDATE where `branch_id = current_staff().branch_id` (counselors: `assigned_counselor_id = current_staff().id`), Super Admin all; Marketing only rows it created, restricted columns via a view.
   - Finance tables: SELECT by branch; INSERT payment allowed for Front Desk/BM; UPDATE only via approval RPCs; **no DELETE** (void via RPC with reason).
   - `staff`: users read their own row + branch colleagues' non-sensitive columns (view); only Super Admin / Branch Manager (own branch, non-admin roles) write; no one reads passwords (Supabase Auth owns them).
   - HR tables: employee reads/writes own attendance check-in/out via RPC; managers approve; payroll visible to Branch Manager + Super Admin only.
4. Approval decisions via `security definer` RPCs that check the approver ≠ requester and write an audit row.
