# Giggling Cows — Client-Readiness QA & Engineering Audit

**Audit Date:** 25 Nov 2026  
**App URL:** [giggling-cows.vercel.app/today](https://giggling-cows.vercel.app/today)  
**Cow Profile Demo:** [Cow 208 (`41864207-ea03-49c9-873f-84c99c6b1af3`)](https://giggling-cows.vercel.app/herd/41864207-ea03-49c9-873f-84c99c6b1af3)

**Verdict:** Four data contradictions block client delivery. The underlying layout and several operator flows are solid, but mismatched accounting totals, broken KPI math, and stale alerts will break a farm owner's trust within ten minutes. Fix the `৳ 100` reports drift, the 30-day milk formula, the calving alert state machine, and the Dark Mode tag popover before putting this in front of a client.

## Summary by Severity

- **P0 — Trust-Breakers (4):** Accounting drift, broken 30-day milk math, zombie calving alert, and misrouted Health sidebar badge.
- **P1 — Logic & Workflow Bugs (4):** Broken Dark Mode tag autocomplete/focus trap, impossible cow dates/prices, unguarded unscheduled milking, and silent Void failure with native `window.prompt()`.
- **P2 — UX & Layout Friction (4):** Backwards weight history with nested scrolling, desktop table clipping on `/herd`, misleading Breeding tab count + duplicate active tags, and mixed Bengali/English localization.
- **P3 — Polish & Defaults (2):** Raw UUIDs, clipped placeholders/selects, inconsistent decimal formatting, and wrong default decision on positive-margin purchases.

---

## 1. Ranked Problem Register (Ordered by Client-Trust Impact)

| Rank | Severity | Primary Route | Problem & Observed Behavior |
| :--- | :--- | :--- | :--- |
| **#1** | **P0** | [/reports](https://giggling-cows.vercel.app/reports) | **৳ 100 revenue & receivables mismatch:** [/today](https://giggling-cows.vercel.app/today) shows Sales this month `৳ 119,900`, Receivables `৳ 0`, and `INV-202611-0001` marked `paid` (`119,900 / 119,900`). Meanwhile `/reports` (Profitability, `11/01/2026–11/25/2026`) reports Total invoiced `৳ 120,000`, Cash collected `৳ 119,900`, and Uncollected receivables `৳ 100`. |
| **#2** | **P0** | [/herd/[id]](https://giggling-cows.vercel.app/herd/41864207-ea03-49c9-873f-84c99c6b1af3) | **30-day milk KPI math contradiction:** Cow 208's **30-day milk (est.)** card displays `5.25 L` and `5.25 L/day` simultaneously—using today's single-day sum (`2.65 + 1.10 + 1.50 = 5.25 L`) as both the 30-day total and the daily average. |
| **#3** | **P0** | [/breeding](https://giggling-cows.vercel.app/breeding) | **Stale "5d overdue" calving alert after actual calving:** Cow 208 has `Actual calving: 2026-11-23` (Notes: `Done`), yet `Result` stays `suspected`. Both `/today` and Cow 208's profile still flag an overdue expected calving (`20 Nov 2026`) with no action to resolve it. |
| **#4** | **P0** | [/health](https://giggling-cows.vercel.app/health) | **Misrouted sidebar alert badge:** The left sidebar shows a red `1` badge on **Health**, even though `/health` displays *"No care due in the next 14 days"* and *"No records yet"*. The alert actually belongs to Breeding/Calving. |
| **#5** | **P1** | [/today](https://giggling-cows.vercel.app/today) | **Broken Dark Mode tag autocomplete & focus trap:** In Record Milk, typing a cow tag opens a bright white popover that clashes with Dark Mode and covers **Total liters**. Clicking Total liters dismisses the popover without focusing the field, dumping `1.50` into **Cow tags** and creating an unvalidated `1.50 ×` tag pill on blur. |
| **#6** | **P1** | [/herd/[id]](https://giggling-cows.vercel.app/herd/41864207-ea03-49c9-873f-84c99c6b1af3) | **Impossible date & acquisition invariants:** Cow 208 is `Born on farm` with Acquired date `12 Dec 2022`—9 days before Birth date `21 Dec 2022`. **Purchase price (৳)** remains editable for `Born on farm` cows, and latest weight is dated in the future (`26 Nov 2026` vs `25 Nov 2026`). |
| **#7** | **P1** | [/today](https://giggling-cows.vercel.app/today) | **Unscheduled milking logged without warning:** Cow 208's schedule only enables `Morning` and `Noon` (`Evening` is unchecked), yet `/today` saved an `Evening` entry (`1.50 L`) for Cow 208 with zero confirmation or guard. |
| **#8** | **P1** | [/today](https://giggling-cows.vercel.app/today) | **Silent Void failure & native `window.prompt()`:** Edit and Void rely on browser `window.prompt()` dialogs that break Dark Mode. Submitting an empty Void reason silently aborts the void without showing any validation error. |
| **#9** | **P2** | [/herd/[id]](https://giggling-cows.vercel.app/herd/41864207-ea03-49c9-873f-84c99c6b1af3) | **Backwards weight history & nested scroll friction:** **Weight history (18)** sorts oldest-first (`03 Nov 2026` at top) and paginates at 10 rows inside a nested scrollable container, burying current weights on page 2 and causing double-scrolling. |
| **#10** | **P2** | [/herd](https://giggling-cows.vercel.app/herd) | **Desktop table overflow & mixed filter controls:** The Herd table overflows horizontally on wide desktop screens, clipping the **Actions** column (`Edit`, `A...`). **Category** is a free-text input while the other four filters are dropdowns. |
| **#11** | **P2** | [/herd/[id]](https://giggling-cows.vercel.app/herd/41864207-ea03-49c9-873f-84c99c6b1af3) | **Misleading Breeding count & duplicate active tags:** Tab reads `Breeding (1)` while the Breeding history table shows `0` (because the badge counts the pregnancy-check banner). Tag history lists two simultaneous `Current` tags (`Ear tag` and `Neck band`) for `208`. |
| **#12** | **P2** | [/today](https://giggling-cows.vercel.app/today) | **Mixed Bengali/English localization leak:** With **English** selected in the sidebar language toggle, `/today` still renders its subtitle in Bengali (`"আজকের খামারের কাজ এবং দৈনিক এন্ট্রি"`). |
| **#13** | **P3** | [/herd/[id]](https://giggling-cows.vercel.app/herd/41864207-ea03-49c9-873f-84c99c6b1af3) | **Raw UUIDs, clipped copy & decimal inconsistency:** History modal exposes `cows · 41864207-ea03-49c9-873f-84c99c6b1af3`; placeholders/selects clip (`Type a tag, press Enter or con`, `e.g. Replacement for los`, `Artificial inseminatio`); liters format as `1.1 L` on profile vs `1.10 L` on `/today`; **+ Add Cow** uses native HTML5 tooltips. |
| **#14** | **P3** | [/purchases](https://giggling-cows.vercel.app/purchases) | **Wrong default decision on positive margin:** The live purchase evaluator calculates net weight, meat price/kg, and projected margin accurately, but **Decision** defaults to `Return` even when projected margin is positive. |

---

## 2. Core Business Logic That Must Be Fixed

Most P0 and P1 defects are missing invariants between database writes, KPI aggregators, and frontend forms. Fix these at the query and validation layer so screens cannot drift out of sync.

### Invoice & Receivables Math (`/today` vs `/reports`)
* **Current bug:** `/today` sums net/discounted invoice totals (`৳ 119,900`), while `/reports` appears to sum gross pre-discount subtotal (`৳ 120,000`), creating a phantom `৳ 100` receivable on a `paid` invoice.
* **Required fix:** Derive both views from one shared SQL view or backend service using net payable total (`subtotal - discount + tax`). Enforce `receivable = max(0, net_total - paid_amount)` and ensure `status = 'paid'` guarantees `receivable === 0`.

### 30-Day Milk KPI Formula (`/herd/[id]`)
* **Current bug:** Displays `5.25 L` as 30-day total and `5.25 L/day` as daily average when only 1 day has data.
* **Required fix:** Compute `total_30d = SUM(liters)` over the last 30 calendar days, and `daily_avg = total_30d / active_milking_days` (or `/ 30`, labeling the denominator explicitly). Never display a single-day sum as a 30-day total without multiplying and marking it as projected.

### Calving Alert State Machine (`/breeding`, `/today`, `/herd/[id]`)
* **Current bug:** Alert queries filter only on `result IN ('suspected', 'confirmed')` and ignore `actual_calving_date IS NOT NULL`.
* **Required fix:** When `actual_calving_date` is saved, atomically transition status to `calved` (or `resolved`) in the same database transaction, and add `AND actual_calving_date IS NULL` to all overdue-calving queries.

### Sidebar Badge Aggregation (Global Nav)
* **Current bug:** Breeding/calving overdue counts are wired to the **Health** nav badge.
* **Required fix:** Split alert counters strictly by domain: `healthDueCount` (vaccinations, treatments, checkups due in 14 days) on `/health`, and `breedingDueCount` (overdue/upcoming calvings, heat checks) on `/breeding`.

### Cow Date & Price Invariants (`/herd/[id]`, `/herd`)
* **Current bug:** Allows `acquired_date < birth_date`, future weight dates, and editable purchase prices on `Born on farm` cows.
* **Required fix:** Enforce both client and server schema checks (e.g., Zod + DB check constraints): `acquired_date >= birth_date`, `log_date <= today()`, and when `acquisition_type === 'born_on_farm'`, lock `acquired_date = birth_date` and force `purchase_price = 0` (disabled or hidden).

### Tag & Milking Schedule Guards (`/today`)
* **Current bug:** Allows invalid free-text tag strings (`1.50`) into milk entry and silently logs unscheduled sessions.
* **Required fix:** Restrict the **Cow tags** input to validated active cow IDs from the fetched roster (block arbitrary text pills). When logging a session outside a cow's checked schedule, surface a non-blocking warning (*"Cow 208 isn't scheduled for Evening—log anyway?"*).

---

## 3. Cow Profile Deep Dive (`/herd/41864207-ea03-49c9-873f-84c99c6b1af3`)

The profile header (`Active`, `Milking · Morning, Noon`, `Heifer · Female · Friesian · Fattening Farm`) gives a fast snapshot, but the tabs underneath need tightening before a client demo:

1. **Flip Weight History to newest-first and remove the nested scroll box:** Sort descending by date so today's weight and recent gain/loss are visible immediately. Remove the fixed-height inner scroll container and paginate cleanly on the page flow, or show the latest 5 rows with a "Show all 18" expansion.
2. **Clarify Tag History ownership rules:** Decide whether a cow can hold one active tag per physical type (one `Ear tag` + one `Neck band`) or only one primary tag overall. If multi-type active tags are intentional, label them `Active (Ear)` and `Active (Neck)`; otherwise, auto-retire the previous tag when assigning a replacement.
3. **Align Breeding tab badge with table contents:** Either include Pregnancy Checks inside the unified Breeding timeline so `Breeding (1)` actually shows 1 row, or label the sub-sections explicitly (`Breeding events (0)` and `Pregnancy checks (1)`).
4. **Add inline resolution actions on alert banners:** When the profile displays `20 Nov 2026 · Expected calving (suspected)`, place a direct **Record calving / Mark resolved** button on that banner instead of forcing navigation to `/breeding`.
5. **Sanitize the History audit modal:** Replace the raw UUID header (`cows · 41864207-ea03-49c9-873f-84c99c6b1af3`) with a human-readable identifier like `Cow #208 · Archive & Void History`.
6. **Standardize numeric precision:** Use a shared formatter (`val.toFixed(2) + ' L'`) across both **Milk & costs** and `/today` so `1.10 L` never renders as `1.1 L`.

---

## 4. UI & UX Improvements

* **Replace the `/today` tag-pill input with a roster selector:** Your [/milk-sales](https://giggling-cows.vercel.app/milk-sales) checkbox roster is noticeably cleaner and less error-prone than `/today`'s tag-pill input. At minimum, theme the autocomplete popover for Dark Mode, position it without obscuring **Total liters**, handle outside-click without swallowing focus, and reject any tag not in the active milking roster.
* **Replace all `window.prompt()` calls with in-app modals:** Using browser prompts for **Edit** and **Void** on `/today` breaks Dark Mode and hides validation errors. Build one reusable confirmation modal with inline error feedback (e.g., *"Reason is required to void an entry"*).
* **Fix desktop horizontal overflow on [/herd](https://giggling-cows.vercel.app/herd):** Tighten cell padding, combine secondary metadata (e.g., Breed + Sex) into stacked sub-lines, or pin the **Actions** column sticky-right so `Edit` and `Archive` aren't clipped. Convert the **Category** free-text filter into a dropdown matching the other four filters.
* **Audit i18n keys, input widths, and form validation:** Move the hardcoded Bengali subtitle on `/today` (`"আজকের খামারের কাজ এবং দৈনিক এন্ট্রি"`) into your i18n dictionary. Widen or shorten clipped placeholders/selects (`Type a tag, press Enter or con`, `e.g. Replacement for los`, `Artificial inseminatio`), and replace native HTML5 `required` tooltips in **+ Add Cow** with inline field-level error states.

---

## 5. Features & Workflows Still Needed for Real Farm Use

| Capability to Implement | Why It Matters to the Client | Priority |
| :--- | :--- | :--- |
| **Cross-Screen Accounting Reconciliation Test** | Automated integration tests asserting that `/today`, `/milk-sales`, and `/reports` always agree on invoiced total, collected cash, and receivables for the same date range. | **High (P0)** |
| **One-click Calving → Calf Onboarding** | When a cow calves, prompt *"Register newborn calf now?"* pre-filled with dam ID, birth date, farm location, and `Born on farm` instead of forcing manual re-entry in `/herd`. | **High (P1)** |
| **Quick-Log Actions on Cow Profile** | Let operators log a new weight, milk reading, health treatment, or calving resolution directly from the cow profile header without bouncing back to `/today` or `/health`. | **High (P1)** |
| **Weight Trend Sparkline & ADG Metric** | For a `Fattening Farm` cow like #208 (with 18 weight logs), raw paginated rows hide the key business metric: **Average Daily Gain (kg/day)** and a 30/90-day trend line. | **Medium (P2)** |
| **Smart Purchase Decision Suggestion** | On [/purchases](https://giggling-cows.vercel.app/purchases), auto-default **Decision** to `Buy / Keep` when projected margin exceeds a configurable threshold, and `Return` only when margin is negative or below target. | **Medium (P2)** |
| **Empty-State Onboarding & Guided CTAs** | [/payroll](https://giggling-cows.vercel.app/payroll) and [/health](https://giggling-cows.vercel.app/health) currently show empty states with no records. Add direct *"Add first staff member"* / *"Schedule vaccination"* CTAs. | **Medium (P3)** |

---

## 6. Recommended Pre-Delivery Execution Sequence

1. **Phase 1 — Stop the Trust Bleed (Demo-Blocking):** Fix #1 through #4 first: reconcile the `৳ 100` invoice/report drift, correct the 30-day milk formula on the cow profile, auto-resolve calving alerts when `actual_calving_date` is set, and route the sidebar badge to Breeding instead of Health. Delete the `1.50 L` Evening test entry left on Cow 208.
2. **Phase 2 — Harden Daily Entry:** Fix #5 through #8: overhaul the `/today` Dark Mode tag autocomplete (or port the `/milk-sales` checkbox roster), replace `window.prompt()` with validated modals, enforce birth/acquired/future date checks, and warn on unscheduled milking sessions.
3. **Phase 3 — Polish & Value-Add:** Fix #9 through #14 and ship the high-impact additions: reverse-sort weight history with an Average Daily Gain metric, fix `/herd` table overflow, close the Bengali/English i18n leak, hide raw UUIDs, and add one-click Calving → Calf onboarding.

---

## 7. What Already Works Well (Keep Intact)

* **Milking roster checkboxes on [/milk-sales](https://giggling-cows.vercel.app/milk-sales):** Fast, unambiguous, and error-proof—the exact interaction pattern `/today` should adopt.
* **Live purchase margin calculator on [/purchases](https://giggling-cows.vercel.app/purchases):** Instant net weight, meat price/kg, and margin feedback as you type gives genuine decision value (just fix the default `Return` dropdown).
* **Clean layouts on [/expenses](https://giggling-cows.vercel.app/expenses), [/payroll](https://giggling-cows.vercel.app/payroll), and [/masters](https://giggling-cows.vercel.app/masters):** Consistent tab hierarchy and calm visual density.
* **Cow profile header summary:** Compact status pills, milking schedule badges, and farm classification give immediate orientation at the top of the page.

---

## Pages Audited

1. [Today Dashboard](https://giggling-cows.vercel.app/today)
2. [Herd Directory](https://giggling-cows.vercel.app/herd)
3. [Cow 208 Profile](https://giggling-cows.vercel.app/herd/41864207-ea03-49c9-873f-84c99c6b1af3)
4. [Purchases & Evaluator](https://giggling-cows.vercel.app/purchases)
5. [Breeding & Pregnancy Checks](https://giggling-cows.vercel.app/breeding)
6. [Health Records](https://giggling-cows.vercel.app/health)
7. [Expenses](https://giggling-cows.vercel.app/expenses)
8. [Milk Sales](https://giggling-cows.vercel.app/milk-sales)
9. [Payroll](https://giggling-cows.vercel.app/payroll)
10. [Financial & Profitability Reports](https://giggling-cows.vercel.app/reports)
11. [Masters & Reference Data](https://giggling-cows.vercel.app/masters)
