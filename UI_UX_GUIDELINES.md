# UI/UX Guidelines

This is the design reference for the CSC Global Management Portal. It documents the patterns already in use across the app so new pages and features stay visually and behaviorally consistent. When adding something new, look here first — and if you establish a new pattern, add it here too.

## Design tokens

Defined in `tailwind.config.js`:

| Token | Value | Use |
|---|---|---|
| `navy` | `#16283D` | Primary brand color — sidebar, primary buttons, headings, active states |
| `navy-light` | `#3B5A78` | Hover state for navy elements, active nav item background |
| `navy-dark` | `#0F1C2E` | Modal/drawer backdrop (`bg-navy-dark/50`) |
| `grey-bg` | `#F9FAFB` | Page background, subtle recessed panels (info boxes inside drawers) |
| `grey-border` | `#E5E7EB` | All hairline borders — cards, table dividers, inputs |

Font: **Inter** (loaded in `index.css`), fallback `IBM Plex Sans, system-ui, sans-serif`.

Beyond these, use plain Tailwind grays/greens/oranges/reds/blues/purples as described below — don't invent new custom colors without adding them to `tailwind.config.js`.

## Layout shell

- `DashboardShell.tsx` is the only page frame. It's `h-screen overflow-hidden`, with a sidebar that is **always `fixed`** to the viewport (never let it sit in normal flow — that lets it stretch with page content, which is a bug we've hit before). Content sits in a `flex-1 flex flex-col lg:ml-64` column so it clears the fixed sidebar on desktop.
- Only `<main>` scrolls (`overflow-y-auto`); the sidebar and top header stay put.
- **Z-index gotcha for anything dropped down from the header** (e.g. `NotificationBell.tsx`): the sidebar is `z-40`, and the header is `sticky ... z-[41]` specifically so the header sits above it. A `position:fixed` "click outside to close" overlay rendered *inside* the header only ever competes for stacking order within the header's own stacking context (sticky + z-index creates one) — raising the overlay's own z-index arbitrarily high does nothing if the header itself is stacked below the sidebar; outside clicks over the sidebar will silently fall through to sidebar nav buttons instead of closing the dropdown. Fix it by raising the ancestor (the header) above the sidebar, not by chasing higher z-index values on the overlay. Keep the header below `z-50` so modals/drawers still render on top of it.
- Page content root is always `<div className="space-y-5">` (or `space-y-6` for overview/dashboard-style pages with a welcome banner) — vertical rhythm between sections is consistent at 5–6.

## Reusable component classes (`index.css`)

- `.stat-card` — white card, `rounded-xl border-grey-border p-6`, hover shadow. Use for dashboard metric tiles and summary tiles at the top of list pages.
- `.nav-item` / `.nav-item-active` / `.nav-item-inactive` — sidebar nav buttons.
- `.role-badge` — navy pill badge for the user's role in the top bar.
- `.animate-fade-in` — used for toasts sliding in from the bottom.

## Status, type & badge colors

Badges are always `text-xs font-medium px-2.5 py-1 rounded-full` (or `px-2 py-0.5` in tighter mobile cards). Color meaning is consistent across the whole app — reuse it, don't invent new mappings for the same concepts:

| Meaning | Classes |
|---|---|
| Success / Complete / Paid / Active / Free (capacity) | `bg-green-100 text-green-700` |
| Pending / In Progress / Awaiting / Receivable | `bg-orange-100 text-orange-700` |
| Refused / Busy (at capacity) / destructive | `bg-red-100 text-red-700` |
| New / informational / secondary role | `bg-blue-100 text-blue-700` |
| Special category tag (e.g. Branch Manager, University) | `bg-purple-100 text-purple-700` |
| Primary / default / lodged | `bg-navy text-white` |

**Counselor availability, not capacity.** Counselors have no maximum caseload — `activeAssignments` is purely informational context (`"{n} assigned students"`, plain `text-gray-400`/`text-xs`, no bar, no ratio, no warning color at any count) and must never block, disable, or de-emphasize a counselor as an assignment option. The only real, live signal is availability — shown as a badge via `AVAILABILITY_STYLES` from `src/counselorStatus.ts`: `Available` → green (`bg-green-100 text-green-700`), `In Session` → navy (`bg-navy text-white` — a deliberate exception to "In Progress = orange" above, scoped to this specific badge), `Away` → grey (`bg-gray-100 text-gray-600`). `ReceptionistOverview.tsx`'s Counselor Status panel, `AssignCounselorPage.tsx`'s roster cards, and `AssignCounselorModal.tsx`'s counselor dropdown all use this — keep them consistent if it changes. Sort rosters Available → In Session → Away via `sortByAvailability`. If a caseload limit is ever reintroduced, treat it as a new, deliberate product decision — don't quietly resurrect the old capacity-bar pattern.

**Fit signal vs. restriction — sort and badge, never disable.** When a list is ranked by how well an option fits the task at hand (e.g. `AssignCounselorModal.tsx` ranking counselors whose specialization matches the student's country of interest), matching options are sorted first and get a small identifying badge — `bg-navy text-white`, e.g. "Australia specialist" — but every option stays fully selectable, equally readable, and identically styled otherwise. Never grey out, disable, or de-emphasize the non-matching group; a fit signal narrows attention, it doesn't gate the choice. If both a matching and non-matching group are non-empty, a plain text divider between them (`bg-grey-bg`, `text-[11px] uppercase tracking-wide text-gray-400`, e.g. "Other counselors") keeps the split legible without treating either side as lesser.

**Selectable-row badges inside a navy-selected list item**: when a dropdown/list option's *own* selected state is a solid navy background (`bg-navy text-white`, e.g. `AssignCounselorModal.tsx`'s counselor options), any badge on that row that would otherwise render `bg-navy text-white` (or any other color low-contrast against navy) must swap to a `bg-white/20 text-white` overlay treatment when the row is selected — otherwise the badge visually disappears into the row's own background. Apply this per-badge (`selected ? 'bg-white/20 text-white' : normalBadgeClasses`), not by hiding the badge.

## Chips vs. buttons

- **Status/type filters above a list** (e.g. All/New/Assigned, All/Pending/Proceeding/Not Proceeding): a dropdown `<select>`, same markup as the branch filter — `relative` wrapper, `appearance-none bg-white border border-grey-border rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium text-navy` with a `ChevronDown` (size 16) absolutely positioned `right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none`. The "show everything" option is always first and labeled `All <Plural Noun>` (e.g. "All Statuses", "All Types", "All Outcomes"), never bare "All". This replaced the older segmented pill-bar for these filters — a dropdown scales better once there are 3+ options and keeps the filter row compact next to search/branch/date controls.
- **Toggle chips inside a form** (e.g. partner Type, commission Receivable/Received): small individual rounded-full pills, not full-width buttons — `px-4 py-1.5 rounded-full border text-sm font-medium`, active fills with a semantic color (see badge table above) + matching border, inactive is `border-grey-border text-gray-500 hover:bg-grey-bg`. Never make these `flex-1`/full-width — that's a modal-era pattern we moved away from.
- **Removable tag chips** (e.g. course list): `inline-flex items-center gap-1.5 bg-grey-bg text-navy text-xs font-medium px-2.5 py-1 rounded-full` with a small `X` button inside.

## Buttons

- **Primary action** (Add X, Save Changes, Submit): `bg-navy text-white font-semibold rounded-lg hover:bg-navy-light transition-colors active:scale-[0.98]`.
- **Secondary / Cancel**: `border border-grey-border rounded-lg text-navy font-medium hover:bg-grey-bg`.
- **Destructive** (Delete/Remove confirm): `bg-red-600 text-white hover:bg-red-700`.
- **Inline text action** (Edit/Assign/Remove links in a table row): icon + label, no border/background, `text-sm font-medium text-navy hover:text-navy-light` (or `text-red-500 hover:text-red-600` for destructive row actions).
- Icons come from `lucide-react` only. Size 15–16px for inline/row actions, 18–24px for nav/header icons.

## Lists: table (desktop) + cards (mobile)

Every list page follows the same responsive split — never build a table-only or card-only list page:

```
<div className="hidden lg:block ..."><table>...</table></div>
<div className="lg:hidden space-y-3">{items.map(card)}</div>
```

- Desktop table: white card wrapper `rounded-xl border-grey-border overflow-hidden`, header row `bg-grey-bg`, `text-xs font-semibold text-gray-500`, body rows `border-b border-grey-border last:border-0 hover:bg-grey-bg/50`.
- Mobile cards: `bg-white rounded-xl border border-grey-border p-4`, primary line bold navy, secondary line `text-xs text-gray-400`.
- Empty state (both breakpoints): `py-12 text-center text-sm text-gray-400`, one line, no icon needed for a simple "No X found."

## Modals vs. drawers — when to use which

This distinction matters and is now consistent across the app:

- **Modal** (centered, `fixed inset-0 flex items-center justify-center p-4`, card `max-w-md rounded-2xl shadow-xl p-6`): use for **creating something new** (Add Branch, Add Staff, Add Partner, Add University) and for **confirmation dialogs** (delete, logout). These are short-lived, single-purpose interactions.
- **Drawer** (slide-in from the right, `fixed inset-0 flex justify-end`, panel `w-full sm:max-w-md bg-white shadow-2xl h-full`): use for **viewing or editing an existing record's details** (Branch detail, Staff detail, Student detail, Application detail, Edit Partner, Edit Commission). Drawers keep context (you can see it's *this specific record*) and support longer content without feeling cramped.
- Both share the same dimmed backdrop: `absolute inset-0 bg-navy-dark/50 backdrop-blur-sm`, closable by clicking it.
- **Drawer layout is a fixed 3-row flex column, not one scrolling block**: the panel itself is `flex flex-col h-full` — header `flex-shrink-0`, a middle content region `flex-1 overflow-y-auto`, and (if there are actions) a footer `flex-shrink-0 border-t border-grey-border px-5 py-4`. Only the middle region scrolls; header and action buttons always stay pinned in view, however long the content gets. Do **not** put `overflow-y-auto` on the outer panel itself with a `sticky top-0` header — that was the old pattern and it lets the action buttons scroll out of view on longer forms.
- A drawer's header: `flex items-center justify-between px-5 py-4 border-b border-grey-border flex-shrink-0`, with an icon + title on the left and a close `X` on the right.
- A drawer's action footer (Save/Cancel, or a standalone action) sits in that same `flex-shrink-0` bottom row, pinned to the bottom of the viewport regardless of scroll position.
- If a detail drawer supports deletion, the delete action also lives in that pinned footer, below the Save/Cancel row, as its own outlined red button (`border-red-200 text-red-600 hover:bg-red-50`) — not mixed into the Save/Cancel row. See `AllBranches.tsx` and `PartnersPage.tsx`.

## Confirmation dialogs

Any destructive or session-ending action (delete branch/staff/partner, logout) gets a confirmation modal, never fires immediately on click:

```
icon in a colored rounded-xl circle (red-50/red-500 for destructive, navy/5 + navy for neutral like logout)
centered title: "Delete X?" / "Log out?"
one line of consequence text
[Cancel] [Confirm] — Cancel is the bordered/neutral button, Confirm is red (destructive) or navy (neutral)
```

## Forms

- Every field: `<label className="block text-sm font-medium text-navy mb-1.5">` then a full-width input `px-4 py-2.5 border border-grey-border rounded-lg text-sm focus:outline-none focus:border-navy-light focus:ring-1 focus:ring-navy-light`.
- Icon-prefixed inputs (search, contact fields): icon absolutely positioned `left-3.5 top-1/2 -translate-y-1/2 text-gray-400`, input gets `pl-10`.
- When a form is used for both **Add** and **Edit** (e.g. Partners), extract the shared fields into one sub-component and drive the two entry points (modal for add, drawer for edit) from the same field component — don't duplicate the JSX.
- A read-only "context" block at the top of an edit form (e.g. student/branch/consultant on the Commission edit drawer) is a grey recessed panel: `bg-grey-bg rounded-xl p-4 space-y-2`.
- **Email validation gotcha**: `<input type="email" pattern="...">` does not actually enforce `pattern` in Chrome (and other browsers) — `type="email"` applies its own very permissive built-in check (e.g. it accepts a dot-less, TLD-less address like `user@domain`) and silently ignores `pattern` once that baseline passes, even though `checkValidity()`/`patternMismatch` report no error. `type="password"`/`text`/etc. don't have this problem — `pattern` works normally there. So for a real email-format check, use `isValidEmail()` from `src/validation.ts` (backed by `EMAIL_PATTERN`) in the submit handler instead of relying on the `pattern` attribute: on invalid input call `emailRef.current.setCustomValidity(message)` + `.reportValidity()` and return early; the field's `onChange` should call `e.target.setCustomValidity('')` so a corrected value doesn't still show the stale error next submit. See `Login.tsx` and the Add Staff form in `StaffManagement.tsx`.

## Notifications

`NotificationBell.tsx` (in the header, before the user's name/role badge) is the one shared entry point for all roles — don't build a second bell or a role-specific variant. Bell icon: plain `text-gray-400 hover:text-navy`, `Bell` from lucide, no border/background. Unread count badge: small solid circle overlaid top-right of the icon, `bg-navy text-white text-[10px] font-semibold`, caps at `9+`. Dropdown: same shape as every other header/table dropdown in the app — `absolute right-0 mt-2 ... bg-white border border-grey-border rounded-lg shadow-lg` with a `fixed inset-0` click-outside overlay (see the z-index gotcha above), header row with a title and a "Mark all as read" action (only rendered when there's something unread), rows divided by `border-b border-grey-border last:border-0`. Unread rows get both a `bg-navy/5` tint and a small `bg-navy` dot on the left (read rows get a transparent dot of the same size, so nothing reflows) — belt-and-suspenders unread signaling, consistent with how this app has favored "do both" over picking one subtle cue elsewhere (e.g. the In Queue panel's overdue-row highlight). Row click marks that notification read and navigates via the `navigateTo` nav key stored on it, then closes the dropdown. New notification types go through the factories in `src/notifications.ts`, not ad-hoc object literals in a component.

## Toasts

Bottom-centered, auto-dismissing after ~2.5s: `fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-fade-in`. Always paired with a checkmark icon. Used for successful add/update/delete actions — not for errors (there's no error-toast pattern yet; form validation relies on native `required`/`type` HTML validation).

## Search & filter bar

Standard header row above any list: `flex flex-col sm:flex-row gap-3` containing (in order) a search input (`flex-1`, icon-prefixed, with a clear `X` when non-empty), then any segmented filter chip-bar, then the primary "Add X" button pinned to the right on desktop (wraps below on mobile).

Even with several controls (search + status dropdown + branch dropdown + date range), keep them on one row: `flex flex-col sm:flex-row sm:flex-wrap gap-3`, search gets `flex-1 min-w-[200px]` so it doesn't get squeezed out, every other control is fixed-width and wraps onto a new line together if the viewport is too narrow (never wrap search alone). This only stays legible because status/type filters are dropdowns, not pill-bars — see `StudentList.tsx` / `ApplicationsList.tsx`.

A date-range filter (`DateRangeFilter.tsx`, filtering via `matchesDateRange` in `src/dateFilter.ts`) is a `<input type="date">` pair in a bordered pill alongside the other filters: `flex items-center gap-2 rounded-lg border px-3 py-2`. It picks up the same states other filter/search inputs use — `focus-within:border-navy-light focus-within:ring-1 focus-within:ring-navy-light`, plus a subtle `hover:border-navy-light/60` on the idle pill — and adds one of its own: once either date is set it becomes visually "active" (`bg-navy/5 border-navy-light`, `Calendar` icon turns navy) so it reads as a live filter at a glance, same idea as a filled badge. The clear `X` only renders once a date is set; an invisible spacer of the same width sits in its place the rest of the time so the pill doesn't change width when the filter activates/clears.

These date inputs are **picker-only, not typable**: each input's native calendar-picker icon is hidden (`[&::-webkit-calendar-picker-indicator]:hidden`) — there's already one `Calendar` icon for the whole control, two more per-input icons was redundant — and `onClick` calls `e.currentTarget.showPicker()` so clicking anywhere in the field (not just a tiny icon) opens the native calendar dropdown. `onKeyDown` blocks every key except `Tab`, so the segments can't be typed into (this also fully closes off the year-overflow keyboard quirk noted below, since a picker can only ever produce a valid date). Both inputs still carry hard absolute `min`/`max` bounds (`1990-01-01`–`2099-12-31`) as a second layer of defense, and `sanitizeDate` rejects anything that isn't a clean in-range `YYYY-MM-DD` before it reaches state — filtering elsewhere assumes that exact shape. Don't set `max={to}` on the from-input or `min={from}` on the to-input to enforce from/to ordering — that makes the *other* field's current value block entry on this one. Instead each input only bounds itself, and `onChange` resolves range conflicts after the value lands: if picking a new value would invert the range, the *other* field is cleared rather than the pick being blocked or silently producing a zero-result filter. Use it wherever a list has a natural date field to filter by (submitted, assigned, completed, consultation date).

## Responsive rules

- `lg` (1024px) is the one breakpoint that matters for layout switches (sidebar fixed vs. drawer-over-content, table vs. card list). Don't introduce new custom breakpoints.
- Side gutters and stacking below `lg` are handled by the existing flex/grid + `flex-col sm:flex-row` patterns — follow the nearest existing page rather than inventing new responsive logic.

## Icons

`lucide-react` only, per project convention. Pick one icon per concept and reuse it everywhere that concept appears (e.g. `Landmark` for partners/universities, `Trash2` for delete, `Edit` for edit, `Building2` for branches, `GraduationCap` for students). Check `DashboardShell.tsx`'s `ICON_MAP` before introducing a new nav icon.
