# Business Rules

One authoritative implementation per rule. File references are where the rule lives; tests are in `tests/`.

## Finance

### Outstanding balance — `clientBalances()` / `chargeLines()` in `src/finance.ts`
```
Outstanding = Σ Charges − Σ Approved/Processed Discounts − Σ Live (non-voided) Payments      (never below 0)
Revenue     = Σ Live Payments − Σ Processed Refunds
Net result  = Revenue − Σ Approved Expenses
```
- Money is applied to charges in due-date order; a payment tagged with a payment-plan instalment covers that instalment first.
- **Refunds (changed in this audit):** a processed refund is a *credit* — money goes back and that part of the fee is waived. It reduces revenue, not the balance. Previously it re-opened the balance, so a client whose fee was refunded appeared to owe it again. *Confirm (BUSINESS DECISION, low risk):* is a refund ever meant to be re-collected? If yes, that should be a new charge, not a side effect.
- Pending / rejected discounts and refunds have no effect. Voided payments have no effect (kept for audit).
- Every screen (Front Desk, Financials tab, Finance module, dashboards, Super Admin, exports) reads these two functions. Tests: `tests/finance.test.ts`.

### Service fees — `ServiceFeesPanel.tsx`, `STANDARD_FEES` / `CLIENT_SERVICES` in `src/finance.ts`
Current rule (implemented in this audit to close a dead end):
1. The client's **counselor** (or the **Branch Manager**) adds a service to the client (Client Profile → Financials → Service Fees).
2. The fee is the **current standard fee**, read-only, and is **copied onto the charge** (`amount` + `standardFee`) at that moment. A later change to standard fees never changes existing clients.
3. A special price is **not typed in**: the service is added at the standard fee and the counselor raises **Request Discount**, which the Branch Manager approves in the Manager Approval Center (audited).
4. Adding the same service twice requires an explicit "add again as a separate service" confirmation.
5. The charge immediately appears as Outstanding for the Front Desk to collect; payment → receipt → outstanding → reports follow the rules above.
6. V/A Officers add document & processing extras (translation, courier, notary…) separately.
7. Australia's country route: Fee Paid marks the chosen offer Fee Paid and stores the University Client ID (commission matching); it does not create a charge (the charge is the service fee above).

**BUSINESS DECISION REQUIRED — Service Master**
- *Current behaviour:* services and fees are hard-coded in `STANDARD_FEES` (Consultation Rs 2,000; Application Processing Rs 25,000; Visa Processing Rs 35,000; IELTS/PTE Rs 12,000; Translation Rs 3,000; Courier Rs 1,500; Notary Rs 1,000; Legalization Rs 2,500), NPR only, same for every branch and country.
- *Problem:* the business describes services differently (Student Visa, Student + SOWP, SOWP, Visitor Visa…), and fees may differ by country/branch and change over time.
- *Options:* (a) keep the code list, confirm amounts; (b) Service Master table (`services`: name, country, branch, default fee, currency, active, effective dates) managed by Super Admin — recommended; (c) per-branch price lists.
- *Needed from you:* the service list, fees, whether fees vary by country/branch, currency, who may assign services (counselor + Branch Manager today), and who may approve special prices (Branch Manager today — limits?).

### Receipts — `nextReceiptNo()` in `src/finance.ts`
`RCP-<BRANCH>-<YEAR>-<5-digit sequence>`, continuing per branch per year. Correct for a single user; **must move to a database sequence** before concurrent use (P1). Receipts are never edited; voiding requires a reason and keeps the record.

### Discounts, refunds, exceptions — `src/approvals.ts` (Manager Approval Center)
Counselor requests → Branch Manager approves / rejects / returns with a note → effect applies only once Approved (discount) / Processed (refund). Refunds of Rs 50,000+ are flagged to the Super Admin. **BUSINESS DECISION:** discount/refund limits and who approves above them; who approves a Branch Manager's own requests.

### Revenue attribution — **BUSINESS DECISION REQUIRED**
Each ledger row stores the counselor at the time it was written. After a handover or inter-branch transfer, earlier payments stay with the original counselor/branch, new ones go to the new counselor. Confirm this is the intended commission/revenue rule.

### Commission — `commissions`, `partners.commissionRate`
Commission = full fee × partner rate, tracked Receivable → Received. **BUSINESS DECISION:** rates per partner/course, and how University Client ID matching is used in claims.

## Clients
- **Client ID** (`generateClientId` in `src/clientId.ts`, changed in this audit): `CSC-<YEAR>-<sequence from 1001>`, next = highest issued this year + 1. Unique index migration provided. Test in `tests/finance.test.ts`.
- **Lead → client:** intake (`students`) → counselor assignment creates `counselor_students` (same id, new Client ID) → outcome "Proceeding" creates the `applications` record.
- **Country to process:** after an offer is received, the counselor chooses the offer (country) to process; Canada/other → standard Fee Paid → visa steps; Australia/UK/NZ/USA → country route (`src/countryPipeline.ts`). Rules and tests in `tests/pipeline.test.ts`.

## HR
- **Working day:** every day except **Saturday** (weekly off) and branch holidays. `countDays()` in `src/leave.ts`.
- **Shift & lateness** (`src/branchOps.ts`): shift 9:00 AM–6:00 PM; ≤ 10 min after 9:00 = On Time, ≤ 30 min = Late, later = Very Late. Test: `tests/hr.test.ts`.
- **Day status** (`dayView()` in `src/attendance.ts`): check-in → Present/Late/Very Late; else Holiday > approved Leave > Off (Saturday) > Not in yet (before 9:30 today) > Absent. Past day with check-in and no check-out = missing check-out.
- **One attendance record per employee per day** (`handleSaveAttendance`); corrections keep the original punch (`applyCorrection`).
- **Leave:** allowances Annual 15, Sick 8, Casual 5 per year (Emergency, Unpaid unlimited); cost = working days (holidays refunded automatically); overlapping pending/approved leave blocked (`overlapping()`). **BUSINESS DECISION:** allowances, carry-over, half days.
- **Payroll inputs:** data collection only, no tax/salary formulas. **BUSINESS DECISION:** payroll rules.

## Operations
- Visa overdue = open visa file unchanged for 14+ days; application stale = 7+ days; large refund = Rs 50,000+; transfer waiting = 2+ days (`src/superAdmin.ts`). Application overdue on the BM dashboard = 7+ days.
