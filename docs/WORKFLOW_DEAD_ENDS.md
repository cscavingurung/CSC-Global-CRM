# Workflow Dead Ends

"After this action, where does the record go?" — every place the answer was "nowhere".

| # | Action | Where it ended | Status |
|---|---|---|---|
| 1 | Client converted (Proceeding) | No service fee could be set → no charge → Front Desk sees "Nothing is due" → payment impossible | **Fixed** — Service Fees panel (Client Profile → Financials, counselor/Branch Manager) creates the charge at the standard fee. |
| 2 | Refund processed | Balance re-opened: client appeared to owe the refunded amount | **Fixed** (credit rule + test). |
| 3 | Branch Manager "Create Content Request" / "Request Marketing Support" | Saved to the BM workspace only; **no Marketing screen shows them**, so Marketing never receives them | **Open** — needs a Marketing inbox (Content Planner "Branch requests") and persistence. |
| 4 | Branch Manager "Request IT Support" | Ticket with no IT role/user to receive or resolve it | **Open** — BUSINESS DECISION: IT role or an external IT email/helpdesk. |
| 5 | Issue escalated to "IT Support" | Same as #4 | Open. |
| 6 | Refund "Approved" | Moves to "Processed" only in seed data; no role/screen performs the payout | **Open** — BUSINESS DECISION: who processes refunds (Finance role?). |
| 7 | Employee onboarding completed | Not connected to Staff Management (account/branch) | Open. |
| 8 | Onboarding "employment agreement" | No agreement feature | Missing (F). |
| 9 | Appointment | No appointment record exists | Missing (F). |
| 10 | Document "requested" | Only tick boxes; no request record with requester/deadline/status | Missing (F). |
| 11 | Approval decided (leave, discount, expense…) | Requester is not notified | Open (notifications). |
| 12 | Any change to a memory-only store | Lost on reload; other users never see it | Open (P0/P1 persistence). |
| 13 | Database write fails | Only a console message; UI shows success | Open (P1 error handling). |

Everything else traced in WORKFLOW_AUDIT has a receiving screen: lead → counselor (bell + list), content request → counselor/Front Desk inbox → Content Planner, designer tasks → review, transfer request → origin BM (Approval Center + workspace), payment → receipt, charge → outstanding, USA interview → counselor task, visa decision → dashboards/marketing tracking.
