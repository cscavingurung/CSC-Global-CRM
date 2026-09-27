# Workflow Audit

Each workflow was traced through the code end to end (handlers in `App.tsx`, the components, and the data they write). "Saved" = written to Supabase; "memory" = browser only (lost on reload, not shared). Status uses the A–F scale from CRM_SYSTEM_AUDIT.

| # | Workflow | Path in the CRM | Status | Gaps |
|---|---|---|---|---|
| 1 | **New lead** | Front Desk "Add New Lead" / Counselor "Add Client" / Marketing lead → assign to branch → `students` row → Assign Counselor → `counselor_students` → consultation → follow-up → outcome | D (saved) | Source ✅ (`referredThrough`/`platformSource`), campaign ✅ (marketing leads), preferred branch ✅. No duplicate-lead check (same phone/email). Marketing store itself is memory. |
| 2 | **Client creation** | Outcome "Proceeding" → `applications` row, Client ID → counselor & branch carried over | D | **Service fee was never set (fixed — Service Fees panel).** Client ID collisions (fixed). No timeline entry for the fee. |
| 3 | **Finance** | Service fee → discount request → approval → payment (Front Desk) → receipt → outstanding → plan → refund → reports | B (memory) | Refund re-opened balances (fixed). Ledger not saved (P0). Receipt numbers browser-side (P1). |
| 4 | **Applications** | Enrolment checklist → Applied → Further info → Offer / Rejected → re-apply → multiple institutions → country choice → Fee Paid / country route | D (saved) | Multiple institutions ✅, different intakes ✅ (defer), one client = one application record with many offers ✅ (not counted twice in reports — tested). No application-level deadlines or assigned V/A officer field (branch queue model). Withdrawn ✅; deferred intake ✅. |
| 5 | **Visa** | Preparing Documents (checklist) → File Ready → Visa Applied → Approved / Refused → re-apply / refund; or country route steps writing the same fields | D (saved) | Decisions flow automatically to dashboards, Marketing lead tracking (`trackMarketingLeads`) and reports — nobody re-marks "Visa Approved". |
| 6 | **Content** | Marketing request → counselor / Front Desk (or BM delegates) → submit files → Content Planner → designer task → review → scheduled → published | B (memory) | Complete path exists. BM-originated requests ("Create Content Request") reach **no Marketing screen** — see dead ends. |
| 7 | **HR onboarding** | Onboarding case (tasks by owner) → My Onboarding → complete | B | Not linked to Staff Management account creation or branch assignment. **Staff agreements missing (F).** |
| 8 | **Attendance** | Check-in/out (Time & Attendance) → late calc → correction request → Approval Center → amended record (original kept) | B | One record/day enforced in the handler; missing check-out flagged; leave & holidays integrated; timezone = browser clock. |
| 9 | **Leave** | Request → Approval Center → attendance shows "On Leave" automatically | B | Working days exclude Saturdays & holidays ✅; overlap blocked ✅; balances ✅ (tested). Cancellation of approved leave not available. |
| 10 | **Tasks** | Daily Task Board (BM creates; staff update) + Task Oversight + system tasks (USA interview prep) | B | One engine for daily tasks ✅, but design/video/SEO tasks, onboarding tasks, IT tickets and content requests are separate engines. No comments/history per task. |
| 11 | **Requests / approvals** | Manager Approval Center (leave, corrections, discount, refund, payment exception, expense, branch transfer) | B/D | Requester, type, record, reason, amount, approver, status, decision, timestamp ✅. Stored with the source record, not a central table. |
| 12 | **Issues** | Help Desk → Issue & Escalation Management (assign, escalate to BM/IT, resolve, confirm, close) | B | Categories match the brief. "IT Support" escalations have no IT user to receive them. |
| 13 | **Appointments** | — | **F** | No booking model, no conflict detection. Dashboards show visits/follow-ups instead. |
| 14 | **Documents** | Enrolment checklist, visa checklist, route checklists (tick boxes) | D | No per-document request/received/rejected/expired tracking with requester & deadline (F). |
| 15 | **Search** | Super Admin Global Search | D | Searches clients, leads, applications, visa, people, issues, tasks, ledger (incl. receipt no., University Client ID). No search for other roles. |
| 16 | **Notifications** | `notifications` table; bell per role | D | Lead broadcast, assignment, consultation ready, status updates, content requests, transfers, handovers, USA interview task. Not yet: task overdue, approval decisions to requester, payment received, leave decision. |
| 17 | **Dashboards & reports** | BM Dashboard, Super Admin Command Center, Finance dashboard, HR reports | D | Numbers come from the same records they link to (clickable); double-counting tested for clients, payments, visa. Accuracy is limited by memory-only stores. |

## Employee journeys (as requested)

- **Front Desk:** create lead ✅ → assign counselor ✅ → appointment ❌ (no booking) → payment ✅ (now possible once the counselor adds the service fee) → receipt ✅.
- **Counselor:** open lead ✅ → consult ✅ → convert (Proceeding) ✅ → assign service ✅ (new) → request discount ✅ → follow-up ✅ → hand to V/A ✅ (shared application record; no explicit hand-off notification).
- **V/A Officer:** enrolled queue ✅ → documents ✅ → applied ✅ → offer ✅ → choose country ✅ → Fee Paid / route ✅ → visa ✅.
- **Branch Manager:** dashboard ✅ → exceptions ✅ → attendance ✅ → approve leave ✅ → finance ✅ → assign task ✅ → content request ✅ (delegate) / create request ⚠️ (Marketing can't see it).
- **Super Admin:** company → branch → client → application → visa → payment ✅ (Command Center drill-downs) → audit history ⚠️ (override log only; memory).
