# Giggling Cows — Breeding, Pregnancy & Lineage Architecture

> **Core fix:** Stop treating breeding attempts and pregnancy checks as two disconnected logs. Split `pregnancies` from `pregnancy_checks`, chain every reproductive step through nullable foreign keys (`sire_id` → `breeding_id` → `pregnancy_id` → `calving_id` → `cows.origin_calving_id`), and derive an offspring’s breeding and pregnancy context from that single pointer instead of copying fields onto the calf record.

---

## 1. Six Structural Gaps Found While Testing Cow 208

Live testing on [Cow 208’s profile](https://giggling-cows.vercel.app/herd/41864207-ea03-49c9-873f-84c99c6b1af3) and [/breeding](https://www.google.com/search?q=https://giggling-cows.vercel.app/breeding) (November 28, 2026) exposed six places where the current model breaks down once real farm data hits it:

| Area Tested | What Happened Live | Why It Breaks at Scale |
| :--- | :--- | :--- |
| **Breeding → Pregnancy Link** | Confirmed pregnancy and marked it `Calved` on 28/11/2026, yet `TEST-SEM-001` stayed `Pending` until manually edited on `/breeding`. | No foreign key connects a pregnancy to the breeding attempt that caused it, so conception rates and sire performance are always wrong unless staff update two tables by hand. |
| **Calving → Offspring Link** | Clicking **Confirm calving** resolved the active banner, but `Family & lineage` stayed at `Offspring (0)`. | Staff must leave the calving screen, manually create a new cow, and re-pick Dam and Sire—guaranteeing broken pedigree links and forgotten birth weights. |
| **Pregnancy vs. Check Conflation** | `expected_calving`, `actual_calving`, and `Calved` live on individual `Pregnancy checks` rows. | A cow checked at Day 30 (`Suspected`), Day 60 (`Confirmed`), and Day 120 (`Recheck`) produces three rows competing to represent one pregnancy. |
| **Read-Only Profile Tables** | Cow 208’s Breeding and Pregnancy tables have no Edit, Archive, or History actions, and **Log breeding** omits `Outcome` and `Notes`. | Fixing a typo or marking a failed insemination forces a context switch to `/breeding`, even when the user is already looking at the cow. |
| **Form & Validation Drift** | Profile uses `Result *`, defaults today’s date, and relies on native HTML5 tooltips; `/breeding` uses `Status`, blank dates, and custom red inline errors. | Two separate form implementations for the same entity double your maintenance surface and create inconsistent UX. |
| **Unstructured Semen & Empty Sires** | **On-farm sire** dropdown had zero options; **Purchased semen** is free text (`Semen code`, `Provider`). | Calves conceived via AI cannot link to a structured Sire record, leaving `Sire (Father): —` on their profile and making inbreeding checks impossible. |

---

## 2. The Ideal Relational Model

The biggest mistake in farm apps is storing a cow’s pregnancy state inside the vet check log. A **Pregnancy** is a ~280-day biological episode; a **Pregnancy Check** is just a timestamped observation about that episode.

Separating those two lets you attach multiple vet checks to one pregnancy, link multiple failed inseminations before one successful conception, and connect twins or stillbirths to a single calving event without duplicating data.

### Entity Relationship Diagram

```text
+-----------------------+       1:N       +---------------------------+
| 1. sires (Master)     | --------------> | 2. breeding_attempts      |
| - id                  |                 | - id, cow_id, sire_id     |
| - source_type         |                 | - heat_date, service_date |
|   (ON_FARM |          |                 | - method, doctor, cost    |
|    EXTERNAL_SEMEN)    |                 | - outcome (auto-synced)   |
| - cow_id (nullable)   |                 +-------------+-------------+
| - semen_code, provider|                               |
+-----------+-----------+                               | 0..1
            |                                           v
            | (direct sire_id FK          +---------------------------+
            |  for purchased cows)        | 3. pregnancies            |
            |                             | - id, cow_id              |
            |                             | - breeding_id (null OK)   |
            |                             | - status, expected_due    |
            |                             | - dry_off_date, ended_at  |
            |                             +------+-------------+------+
            |                                    ^             |
            |                            N:1     |             | on live/
            |                            checks  |             | stillborn birth
            |                             +------+------+      |
            |                             | 4. checks   |      |
            |                             | - id, cow_id|      |
            |                             | - preg_id   |      |
            |                             | - result    |      |
            |                             +-------------+      |
            |                                                  v
            |                             +---------------------------+
            |                             | 5. calving_events         |
            |                             | - id, pregnancy_id (1:1)  |
            |                             | - calving_date, ease      |
            |                             | - live_count, stillborn   |
            |                             +-------------+-------------+
            |                                           | 1:N
            v                                           v
+---------------------------------------------------------------------+
| 6. cows (Offspring)                                                 |
| - id, tag_no, dam_id                                                |
| - sire_id (from sires)                                              |
| - origin_calving_id (nullable FK -> calving_events.id)              |
| - birth_weight, dob                                                 |
+---------------------------------------------------------------------+
```

> **Note on nullability:** All foreign keys except `cow_id` should be nullable so historical or purchased-pregnant animals never get blocked by missing upstream records.

### Why Purchased Semen Needs a Sire Registry

In commercial dairy farms across Bangladesh, most conceptions come from purchased AI straws (BRAC, American Dairy, DLS), not on-farm bulls. If `cows.sire_id` only references another row in `cows`, 90% of your calves will have a blank sire.

Create a lightweight `sires` (or `bull_registry`) table with `source_type = ON_FARM | EXTERNAL_SEMEN`:
- **On-farm bulls** link to their `cow_id`.
- **External AI bulls** store `semen_code`, `bull_name`, `breed`, and `provider`.
- Both `breeding_attempts` and `cows` point to `sire_id`, giving every AI calf a real, clickable father and enabling inbreeding warnings.

---

## 3. Eight Real-World Cases Your State Machine Must Handle

Happy-path AI-to-calf is easy. Dairy software fails in the messy middle—repeat breeders, twins, abortions, and cows bought already pregnant.

| Real-World Case | What the User Logs | Automatic Backend Transition |
| :--- | :--- | :--- |
| **Failed Insemination (Repeat Heat)** | Either a `Not pregnant` check, or a new breeding attempt 18–24 days later. | Previous open `breeding_attempt` auto-updates to `Failed`. No pregnancy row is created. Increments *Services per Conception* counter. |
| **Multiple Attempts Before Conception** | Cow bred on Day 1 and Day 22, then confirmed pregnant on Day 60. | UI pre-selects the most plausible breeding attempt (within 25–120 days) for `pregnancy.breeding_id`; user can override. Selected attempt becomes `Successful`; earlier open attempts in that cycle become `Failed`. |
| **Bought-Pregnant Cow** | Farm buys a cow that is already 5 months pregnant (no local breeding record). | Create `pregnancy` with `breeding_id = NULL` and user-entered `expected_due` (or estimated months pregnant). Calving and lineage still work normally. |
| **Twins or Triplets** | Calving form records `live_count = 2`. | One `calving_event` creates two `cows` rows, both sharing the same `origin_calving_id`, `dam_id`, and `sire_id`. (Never store a single `calf_id` column on `pregnancies`.) |
| **Abortion / Early Embryonic Loss** | Vet check or status update marks pregnancy `Aborted` with date and reason. | Closes `pregnancy` (`status = ABORTED`, `ended_at` set), resolves calving alerts, creates **no** calving/calf record, and returns cow to `Open` with an optional health/vet follow-up flag. |
| **Stillbirth** | Full-term calving where the calf is born dead. | Closes `pregnancy` as `Calved`, logs a `calving_event` with `stillborn_count = 1` (counts toward dam’s parity and starts lactation), and skips creating an active herd cow profile. |
| **Dry-Off & Voluntary Waiting Period** | Pregnancy confirmed, and later calving recorded. | Confirmation auto-sets `expected_due` (`service_date + 283d`) and `dry_off_date` (`expected_due - 60d`). Calving auto-sets `next_breeding_eligible` (`calving_date + 50d`) so alerts stop nagging too early. |
| **Early Check (“Suspected”)** | Day-30 check logged as `Suspected`, followed by Day-60 `Confirmed`. | Day-30 creates a `pregnancy` in `Suspected` state; Day-60 attaches a second `pregnancy_check` to the **same** `pregnancy_id` and upgrades it to `Confirmed`. |

---

## 4. UI Consolidation: Cow Profile vs. `/breeding`

Right now, the Cow Profile and the separate `/breeding` page are fighting over the same job with two different forms. Give each screen a clear, non-overlapping purpose backed by one shared form component.

### Cow Profile: Lifecycle-First View for One Animal
- **Single status header with one next action:** Show the cow’s current reproductive state (`Open`, `Bred · Check due in 18d`, `Pregnant · Day 142`, or `Post-calving VWP`) and surface the single logical button for that state (`Log Breeding` → `Log Check` → `Record Calving`).
- **Group by Reproductive Cycle, not two flat tables:** Display Cycle #3 as a unified block: Breeding Attempt(s) → Linked Pregnancy & Vet Checks → Calving Outcome & Born Calf link. Staff immediately see which insemination produced which calf.
- **Full inline Edit & Archive parity:** Use the exact same Edit/Archive/History modal from `/breeding` inside the Cow Profile so nobody has to leave Cow 208 to fix a typo or change an outcome.
- **Guided 2-step Calving Drawer:** Step 1 captures calving date, ease (Normal / Assisted / C-section), and live/stillborn counts. Step 2 renders one mini-row per live calf (Ear Tag, Sex, Birth Weight, Optional Name) and saves the calving + newborn cow profile(s) in a single atomic transaction.

### Separate `/breeding` Page: Herd-Wide Action Queue
- **Lead with an Action Queue tab:** Farm managers open `/breeding` to ask *“Who needs attention today?”*—not to scroll 200 historical rows. Surface four actionable buckets: **Due for Pregnancy Check** (30–45d post-AI), **Due for Dry-Off**, **Calving Due (<14d)**, and **Open >90 Days** (repeat breeders).
- **Keep Breeding Log & Active Pregnancies as clean tabs:** Filter by cow, sire/semen, outcome, and date range, with one-click row actions that open the same shared drawers used on the cow profile.
- **Surface 3 Herd KPIs at the top:** Conception Rate (%), Avg Services per Conception, and Active Pregnant Cows. These only become trustworthy once breeding attempts auto-link to pregnancies.
- **Retire duplicate form code:** One reusable `BreedingFormDrawer` and one `PregnancyCheckDrawer` (accepting an optional pre-filled `cowId`) eliminates the `Result *` vs. `Status` and validation mismatch.

---

## 5. Family & Lineage: Show Origin Data, Never Duplicate It

Making an offspring’s profile carry the breeding and pregnancy data it came from turns `Family & lineage` from two bare links into a real genetic and reproductive dossier. The trap is *how* you store it.

| Approach | How It Works | Trade-Off & Verdict |
| :--- | :--- | :--- |
| **Copy Fields onto Calf Row** | Duplicate `semen_code`, `insemination_date`, `doctor`, and `gestation_days` directly into `cows` on calving. | **Avoid.** The first time a manager fixes a mistyped semen code or date on the mother’s breeding record, the calf’s profile silently lies. |
| **Single Pointer (`origin_calving_id`)** | Store one nullable FK on `cows` pointing to `calving_events` (which links to `pregnancy` → `breeding_attempt` → `sire`). | **Recommended.** Zero duplication, single source of truth, automatic bidirectional links between dam, sire, littermates (twins), and conception details. |
| **Purchased Calf Fallback** | When `origin_calving_id` is `NULL` (calf/cow bought from outside), fall back to manual `dam_id` / `sire_id` and optional `pedigree_notes`. | **Essential companion.** Keeps manual editing in **Edit cow details** working cleanly for foundation herd animals. |

### What to Render Inside `Family & lineage`
1. **Origin & Conception Strip:** On every farm-born cow’s `Family & lineage` card, derive a compact read-only block from `origin_calving_id`: Conception Method (AI / Natural), Insemination Date, Gestation Length (e.g., 281d), Calving Ease, Birth Weight, and Twin/Littermate link—plus a direct jump to the Dam’s cycle.
2. **Two-Generation Pedigree:** Resolve Dam, Sire (including external AI bull from `sires`), Maternal Grand-dam, and Maternal Grand-sire automatically via FKs. When logging a new breeding for this cow later, warn the user if the selected sire matches her Sire or Grand-sire (inbreeding guard).
3. **Enriched Offspring Table:** Replace `Offspring (0)` with a scannable list showing every calf born to this cow (both as Dam and as on-farm Sire): Tag/Name link, Birth Date, Sex, Other Parent (Sire/Dam), Conception Method, and Current Status (Active / Sold / Deceased).

---

## 6. Three-Phase Rollout Plan

1. **Schema & Shared Form Foundation:** Introduce `sires`, split `pregnancies` from `pregnancy_checks`, add `calving_events`, and add nullable `sire_id` + `origin_calving_id` to `cows`. Unify the Breeding and Check modals into shared components so Cow Profile and `/breeding` stop drifting.
2. **Automatic Transitions & Atomic Calving:** Wire backend service logic so confirming a pregnancy links and updates the conception breeding, logging a repeat breeding fails the open attempt, and confirming calving optionally creates and links 1-to-N calf profiles in one transaction.
3. **Action Queue & Enriched Lineage:** Upgrade `/breeding` with the *Action Queue* tab (due for check, dry-off, calving, open >90d) and render the derived Origin/Conception summary, 2-gen pedigree, and inbreeding warning inside `Family & lineage`.
