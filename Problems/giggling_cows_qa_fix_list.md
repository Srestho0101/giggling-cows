# Giggling Cows — Pre-Handover QA & Fix List

**Application:** [https://giggling-cows.vercel.app/today](https://giggling-cows.vercel.app/today)  
**Target Context:** Dairy & cattle farm daily operations in Thakurgaon, Bangladesh  
**Audit Date:** 2026-11-26  
**Scope:** End-to-end live workflow testing (create, edit, archive/void, validation, calculations, localization, and domain fit) across all modules.

## Summary by Priority

| Priority | Category | Count | Handover Gate |
| :--- | :--- | :---: | :--- |
| **P0** | Critical Handover Blockers (Broken CRUD, Stubs, i18n) | 6 | Must fix before client handover |
| **P1** | Data, State, Cache & Validation Bugs | 6 | Must fix before client handover |
| **P2** | Thakurgaon Farm Workflow & Domain Gaps | 7 | High-impact client usability (decide v1 vs. v2) |
| **P3** | UI Layout, Dialogs, Formatting & Typos | 6 | Fix before handover for client trust |

## P0 — Critical Handover Blockers

### 1. [ ] Sales invoice editing is completely broken
* **Route:** [`/milk-sales`](https://giggling-cows.vercel.app/milk-sales) (Sales invoices tab)
* **Observed:** Clicking **Edit** on an existing invoice (e.g., `INV-202611-0002`) fails to pre-populate `Item` (resets to `Choose item`), `Description`, `Quantity`, and `Unit price` (all blank; only `Discount` populated as `100.00`). Even after manually re-filling every required field, clicking **Save changes** fails with an API validation error: `Field required`.
* **Fix:** Hydrate all line-item fields from the selected invoice payload when opening the Edit modal, and inspect the `PATCH`/`PUT` request payload against the backend schema so all required fields are serialized and accepted.

### 2. [ ] Purchase evaluation editing renders an empty form & creation does not refresh list
* **Route:** [`/purchases`](https://giggling-cows.vercel.app/purchases)
* **Observed:**
  1. Clicking **Edit** on a saved purchase evaluation opens an **"Edit Purchase evaluation"** card with zero input fields — only **Cancel** and **Save changes**. Clicking **Save changes** is a no-op that still displays `"Changes saved."`
  2. Submitting a new purchase evaluation shows `"Evaluation saved."` but neither auto-refreshes the `Purchase evaluations` table below nor resets the form inputs.
* **Fix:** Render the full editable fields inside the Edit form and bind them to the selected record. On create/edit success, invalidate/refetch the evaluations table query and reset the creation form.

### 3. [ ] Global cow search (`Search cows... Ctrl K`) is an unimplemented stub
* **Route:** Global top bar (tested from [`/today`](https://giggling-cows.vercel.app/today))
* **Observed:** Clicking the search input opens a modal displaying static placeholder text: `"Cow search will be connected here."` Typing a valid cow tag (e.g., `208`) returns no results.
* **Fix:** Connect the command palette/search modal to the herd search API (matching tag number, name, breed, and shed/warehouse) and navigate directly to `/herd/[id]` on selection. If search will not ship in v1, remove or hide the bar rather than shipping placeholder text.

### 4. [ ] Cow archiving fails to persist and confirmation modal is unreadable
* **Route:** [`/herd`](https://giggling-cows.vercel.app/herd) → Cow detail page (`/herd/[id]`)
* **Observed:** Clicking **Archive** on a cow (tested with Cow `999`) opens a confirmation modal with broken contrast (dark text on dark background in Dark mode; white text on white background in Light mode). Confirming did not persist — returning to `/herd` still showed Cow `999` in the active list.
* **Fix:** Fix theme/contrast tokens for the confirmation modal in both Light and Dark modes, verify the archive API call succeeds and mutates status server-side, and invalidate the `/herd` list cache upon success.

### 5. [ ] Breeding form leaks a raw backend Pydantic validation error
* **Route:** [`/breeding`](https://giggling-cows.vercel.app/breeding)
* **Observed:** `Semen code` is not marked required in the UI and there is no on-farm `sire_id` selector on the form. Submitting without `Semen code` fails with the raw backend error: `Value error, Exactly one source must be provided: either an on-farm sire_id OR purchased semen_code.`
* **Fix:** Add an explicit source selector (**On-farm bull/sire** vs. **Purchased semen**) so the user can pick either a `sire_id` or enter `semen_code` (depending on natural service vs. artificial insemination), enforce client-side validation before submit, and map backend validation errors to human-readable messages.

### 6. [ ] Bangla (`বাংলা`) localization is incomplete and dates use US format
* **Route:** App-wide (tested on [`/today`](https://giggling-cows.vercel.app/today))
* **Observed:** Switching the language toggle to `বাংলা` translates only the left sidebar, top bar date (`বৃহস্পতি, ২৬ নভে, ২০২৬`), search placeholder (`গরু খুঁজুন...`), and page heading (`আজ`). All dashboard cards, form labels, buttons, alerts, and table headers remain in English, numerals remain Latin, and date inputs use US `MM/DD/YYYY` (`11/26/2026`) instead of Bangladesh's standard `DD/MM/YYYY`.
* **Fix:** Either complete full i18n coverage across all pages, forms, alerts, and table headers (plus `DD/MM/YYYY` date formatting and optional Bangla numeral formatting), or hide the `বাংলা` toggle until translation is complete so clients do not hit a half-translated interface.

## P1 — Data, State, Cache & Validation Bugs

### 7. [ ] Stale calving alerts & missing date-order validation
* **Route:** [`/today`](https://giggling-cows.vercel.app/today) & [`/breeding`](https://giggling-cows.vercel.app/breeding)
* **Observed:**
  1. `/today` Herd alerts still display `"Expected Calving for 208 (Status: suspected) 6d overdue"` even though `/breeding` already records `Actual calving: 2026-11-23` and `Notes: Done` for Cow `208`.
  2. `/breeding` allowed `Expected calving (2026-11-20)` to be earlier than `Check date (2026-11-23)`.
* **Fix:** Exclude breeding records with a populated `actual_calving_date` (or completed status) from overdue calving alerts on `/today`. Add frontend and backend date-order validation (`check_date >= insemination_date`, `expected_calving_date > insemination_date`).

### 8. [ ] Stale list cache after issuing invoices and logging payments
* **Route:** [`/milk-sales`](https://giggling-cows.vercel.app/milk-sales) (`Customers` and `Sales invoices` tabs)
* **Observed:** After issuing `INV-202611-0002` (`৳3,900`) and recording a `৳1,500` partial payment on the invoice detail page, navigating back to `/milk-sales` still showed `0 / 0 / 0` in `Customers` and `draft` / `Paid: 0` / `Balance: 3,900` in `Sales invoices` until clicking **Refresh** manually.
* **Fix:** Invalidate both the `customers` and `sales-invoices` caches/queries whenever an invoice is created, issued, edited, voided, or receives a payment.

### 9. [ ] Hardcoded 30-day divisor in salary deduction math
* **Route:** [`/payroll`](https://giggling-cows.vercel.app/payroll) (`Salary payments` tab)
* **Observed:** Salary payments explicitly computes `Daily salary: monthly salary ÷ 30 days in the selected month`. This miscalculates daily absence deductions in 28-, 29-, and 31-day months.
* **Fix:** Divide by the actual number of calendar days in the selected month (or make the payroll divisor configurable in farm settings if the client intentionally uses a 30-day convention).

### 10. [ ] Missing Customer Archive action despite archive UI hooks
* **Route:** [`/milk-sales`](https://giggling-cows.vercel.app/milk-sales) (`Customers` tab)
* **Observed:** The page includes a `Show archived and voided` checkbox and an `Archive and void history` modal, but there is no **Archive** button on customer rows and no `Archived` toggle inside the Edit Customer form.
* **Fix:** Add an **Archive / Restore** action to customer rows (with confirmation) or inside the Edit Customer form so inactive dairy shops/buyers can be archived.

### 11. [ ] Inconsistent negative and zero milk input validation
* **Route:** [`/today`](https://giggling-cows.vercel.app/today) & [`/milk-sales`](https://giggling-cows.vercel.app/milk-sales) (`Milk records` tab)
* **Observed:**
  1. On `/today`, entering `-5` in `Total liters` silently disables **Save group** without showing an inline validation message, while the summary renders `"1 cow · -5.00 L · about 0.00 L each"`.
  2. On `/milk-sales`, **Save session total** remains enabled at `0.00 L`.
* **Fix:** Enforce `total_liters > 0` consistently across both `/today` and `/milk-sales`, block negative input (`min="0.01"`), show a clear inline error message, and avoid misleading `"about 0.00 L each"` math on invalid inputs.

### 12. [ ] Inconsistent `Days on farm` calculation for same-day acquisitions
* **Route:** [`/herd`](https://giggling-cows.vercel.app/herd) vs. `/herd/[id]`
* **Observed:** A cow created with today's acquisition date (`2026-11-26`) displays `Days on farm: —` in the `/herd` table, whereas its detail page displays `0 days`.
* **Fix:** Unify the `days_on_farm` display formatter across list and detail views so `0` renders as `0 days` (checking `value !== null && value !== undefined` rather than falsy `!value`).

## P2 — Thakurgaon Cow Farm Workflow & Domain Gaps

### 13. [ ] No daily feed, ration, or feed-stock tracking module
* **Routes:** [/expenses](https://www.google.com/search?q=https://giggling-cows.vercel.app/expenses), [`/masters`](https://giggling-cows.vercel.app/masters) (`Feed types` tab)
* **Problem:** Feed accounts for 60–70% of daily dairy operating costs. Although `Feed types` exists under `/masters`, there is no module to record daily feed rations, track stock levels (silage, straw/*kher*, concentrate/*dana*, bran/*bhushi*), or calculate feed-cost-per-liter. Feed is currently collapsed into a single generic `Cow Food` expense category.
* **Recommendation:** Add a Feed Inventory & Daily Feeding Log linked to `Feed types`, or clearly scope it as Phase 2 and remove the unused `Feed types` master from v1 if it is not wired to anything yet.

### 14. [ ] Sales invoices restricted to a single line item
* **Route:** [`/milk-sales`](https://giggling-cows.vercel.app/milk-sales) (`Sales invoices` tab)
* **Problem:** Invoice creation enforces `"Create an invoice with one line item"`. A farm selling morning and evening milk at different rates, or selling milk plus manure/calves to the same customer, must create multiple separate invoices.
* **Recommendation:** Support dynamic multi-line invoice items (`+ Add line item`) with per-line quantity, unit price, and subtotal aggregation.

### 15. [ ] Payroll missing worker advances (*ogrim*) and overtime/bonuses
* **Route:** [`/payroll`](https://giggling-cows.vercel.app/payroll) (`Salary payments` tab)
* **Problem:** Farm caretakers in Thakurgaon routinely take mid-month cash advances (*ogrim* / *baki*) that are deducted from month-end salary, plus Eid bonuses or overtime pay. Without advance/deduction and bonus fields, payroll records will not match actual cash disbursements.
* **Recommendation:** Add **Advance / Loan Deduction** and **Bonus / Overtime** fields (with a simple running advance ledger per worker) feeding into `Net salary`.

### 16. [ ] Non-farm terminology hurts operator comprehension
* **Routes:** [`/herd`](https://giggling-cows.vercel.app/herd), [`/masters`](https://giggling-cows.vercel.app/masters), [`/purchases`](https://giggling-cows.vercel.app/purchases)
* **Problem:**
  1. `"Warehouse"` (`All warehouses`, `Current warehouse`) is used instead of `"Shed"` / `"Barn"` / `"Khamar"`.
  2. `"Growth potential (%)"` on `/purchases` is actually used as carcass/dressing meat yield percentage (`350 kg × 61% = 213.5 kg`).
* **Recommendation:** Rename `"Warehouse"` → `"Shed"` (or `"Shed / Khamar"`) and `"Growth potential (%)"` → `"Meat yield / Dressing (%)"`.

### 17. [ ] Milking roster does not align with cow lifecycle/status
* **Route:** [`/today`](https://giggling-cows.vercel.app/today) & [`/milk-sales`](https://giggling-cows.vercel.app/milk-sales)
* **Problem:** Heifers (`208`, `322`) appear in the milking roster while `321` (`Milking Cow`) and `205` (`Gaavi`) do not.
* **Recommendation:** Derive the default milking roster automatically from cow category/lactation status (e.g., active lactating cows) with a manual override toggle, rather than allowing non-lactating animals to drift out of sync.

### 18. [ ] Reports missing CSV exports and showing misleading date filters
* **Route:** [`/reports`](https://giggling-cows.vercel.app/reports) (`Herd summary` and `Milk summary` tabs)
* **Problem:**
  1. Only **Profitability** has **Export CSV**; **Herd summary** and **Milk summary** have no export option.
  2. **Herd summary** leaves `From` / `To` date pickers visible at the top even though the tab shows current snapshot counts rather than a date-filtered range.
* **Recommendation:** Add **Export CSV** to `Herd summary` and `Milk summary`, and hide (or disable with a `"Current snapshot"` label) the date range pickers on `Herd summary`.

### 19. [ ] Minimal default seed data and flat market pricing
* **Route:** [`/masters`](https://giggling-cows.vercel.app/masters) (`Expense categories` and `Market prices` tabs)
* **Problem:**
  1. `Expense categories` only ships with `Cow Food`, missing everyday farm categories (`Veterinary & Medicine`, `Electricity & Diesel`, `Shed Maintenance`, `Transport & Haat`, `Bedding / Straw`).
  2. `Market prices` tracks a single flat `Net ৳/kg` rate (`৳700.00` at `Road Bazar`) without distinguishing live-weight vs. dressed-weight or breed/grade.
* **Recommendation:** Pre-seed standard Bangladeshi dairy farm expense categories before handover and add a weight-basis selector (`Live weight` vs. `Dressed meat`) to Market prices.

## P3 — UI Layout, Dialogs, Formatting & Typos

### 20. [ ] Sticky `Actions` column overlaps `Status` column in Herd table
* **Route:** [`/herd`](https://giggling-cows.vercel.app/herd)
* **Observed:** The sticky `Actions` column overlaps the `Status` column (`active` badge collides with the `Edit` link, and the `Status` header is clipped to `St`).
* **Fix:** Add explicit `min-width` to the `Status` column, give the sticky `Actions` column an opaque background and subtle left border/shadow, and ensure horizontal scroll padding prevents overlap.

### 21. [ ] Clipped button and table header on Payroll
* **Route:** [`/payroll`](https://giggling-cows.vercel.app/payroll) (`Attendance` and `Salary payments` tabs)
* **Observed:** On `Attendance`, the **Load day** button wraps onto two lines (`Load / day`). On `Salary payments`, the `Void reason` column header clips to `Void r...`.
* **Fix:** Add `whitespace-nowrap` to action buttons and increase column width or enable horizontal scrolling on the `Salary payments` table.

### 22. [ ] `Archived` dropdown exposed inside new-record creation forms
* **Routes:** [`/breeding`](https://giggling-cows.vercel.app/breeding), [/health](https://www.google.com/search?q=https://giggling-cows.vercel.app/health), [/expenses](https://www.google.com/search?q=https://giggling-cows.vercel.app/expenses)
* **Observed:** `New Breeding record`, `New Health record`, and `New Expense` all render an editable `Archived` (`Choose archived`) dropdown during record creation.
* **Fix:** Remove the `Archived` field from all creation forms (default to `false` on create) and only expose archive/restore controls on existing records.

### 23. [ ] Native browser `window.confirm()` / `window.prompt()` used for Archive & Void
* **Routes:** [`/milk-sales`](https://giggling-cows.vercel.app/milk-sales), [`/breeding`](https://giggling-cows.vercel.app/breeding), [/health](https://www.google.com/search?q=https://giggling-cows.vercel.app/health), [/expenses](https://www.google.com/search?q=https://giggling-cows.vercel.app/expenses), [`/purchases`](https://giggling-cows.vercel.app/purchases)
* **Observed:** Inline **Archive** and **Void** buttons rely on unstyled native browser dialogs (`window.confirm` / `window.prompt`), which break visual consistency, block i18n/Bangla translation, and lack reason validation.
* **Fix:** Replace all native browser dialogs with a shared, themed, translatable in-app confirmation modal (with a required reason input for Void actions, matching `/today`'s milk-void modal).

### 24. [ ] Inconsistent number formatting and raw enum strings
* **Route:** [`/milk-sales`](https://giggling-cows.vercel.app/milk-sales) (`Customers` tab & Invoice detail page)
* **Observed:**
  1. On `Customers`, `Invoiced` renders unformatted decimals (`3900.00`, `119900.00`), while `Paid` and `Balance` render comma-formatted integers (`1,500`, `2,400`).
  2. Customer `Type` renders in lowercase (`individual`, `dairy shop`).
  3. Invoice detail status badge renders a raw enum with an underscore: `Partially_paid`.
* **Fix:** Route all currency values through one shared `৳` formatter (consistent grouping and decimals), title-case display labels, and map enum statuses (`partially_paid` → `Partially Paid`).

### 25. [ ] UI typos and naive string singularization
* **Routes:** [`/herd`](https://giggling-cows.vercel.app/herd), [`/masters`](https://giggling-cows.vercel.app/masters)
* **Observed:**
  1. Herd Category dropdown spells `"Duel-purpose"` instead of `"Dual-purpose"`.
  2. `/masters` strips the trailing `s` naively from `"Expense categories"`, rendering `"+ Add Expense categorie"` and `"Edit Expense categorie"`.
* **Fix:** Correct `"Duel-purpose"` → `"Dual-purpose"` and use explicit singular labels per master entity instead of `.slice(0, -1)`.

## Verified Working Workflows (Baseline)

* **Daily milk logging ([`/today`](https://giggling-cows.vercel.app/today)):** Creating, editing, and voiding a milk group (with audit reason) updated summary cards and the `120 L` daily target meter accurately.
* **Health care alerts ([/health](https://www.google.com/search?q=https://giggling-cows.vercel.app/health)):** Creating and editing a vaccination record with a `Next due` date immediately updated the 14-day **Due and overdue care** alert banner.
* **Expenses CRUD & totals ([/expenses](https://www.google.com/search?q=https://giggling-cows.vercel.app/expenses)):** Creating, editing, and archiving expenses updated **Total in filtered results** automatically.
* **Purchase calculator math ([`/purchases`](https://giggling-cows.vercel.app/purchases)):** Live meat-yield (`350 kg × 61% = 213.50 kg`), cost/kg (`৳585.48/kg`), profit margin (`৳24,450.02`), and auto-decision (`Bought`) calculated accurately.
* **Profitability report & CSV export ([`/reports`](https://giggling-cows.vercel.app/reports)):** Accrual vs. cash figures reconciled cleanly across invoices, payments, cow acquisition, expenses, and health/breeding costs, and `profitability_2026-11-01_2026-11-26.csv` exported cleanly.
* **Bangladeshi localization foundation:** Currency uses `৳` (BDT) throughout, and local terms (`Deshi`, `Gaavi`, `Bought from bazar`, `Dairy Khamar`) are supported.

## Testing Notes & Coverage Caveats

* Inline **Archive** / **Void** buttons on `/health`, `/expenses`, and `/purchases` triggered native browser `window.confirm()` / `window.prompt()` dialogs that were auto-dismissed in the automated browser session; archiving persistence was verified via the **Edit → Archived: Yes** path on `/expenses` and `/masters` instead (note: `/health` and `/purchases` lack that fallback).
* Under `/masters`, full create/edit/archive cycles were executed on **Expense categories** (other tabs — `Warehouses`, `Suppliers`, `Feed types`, `Customers`, `Market prices` — and Payroll `Substitutes` were inspected visually without running individual CRUD cycles on each).
