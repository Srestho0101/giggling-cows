# Cow Farm Management Web Application

## Summary

Build a bilingual (Bangla/English), BDT-based, single-farm web application using Next.js + TypeScript, FastAPI, Supabase Cloud (PostgreSQL + Auth), and managed hosting (Vercel for web; Dockerized FastAPI on a managed container host such as Render).

The v1 product covers every ER-diagram domain: herd, buying evaluation, feeding and expenses, labor, health, breeding, milk, customers, invoiced sales/payments, dashboards, and operational/profitability reports.

## Architecture and access

- Next.js provides responsive owner/staff dashboards and data-entry workflows; FastAPI exposes a versioned `/api/v1` REST API with generated OpenAPI documentation.
- Supabase Auth provides login and JWTs; FastAPI verifies JWTs and enforces fixed roles:
  - `admin`: users, settings, all records, corrections/deletions, all reports.
  - `manager`: all operational CRUD, sales/payment entry, and reports; cannot manage users.
  - `data_entry`: create/update operational records and view relevant lists; no user management, payment finalization, or sensitive profitability/payroll reports.
- Supabase Postgres is the system of record. Use Alembic migrations, UTC timestamps, UUID primary keys, created/updated/by audit columns, soft archival for master records, and database checks/unique indexes for critical integrity.
- Keep tables inaccessible to anonymous/direct client access; all business operations flow through FastAPI. Store environment secrets only in deployment configuration.

## Data model and workflows

- Implement the diagrammed entities for warehouses, suppliers, cows, tag/movement/weight histories, market prices, purchase evaluations, expense categories, feed types/feeding, expenses, workers/attendance/salary payments/mill charges, health, breeding/pregnancy, milk, customers, and sales.
- Enforce animal lifecycle rules: active tag uniqueness, valid acquisition source, farm-born parentage versus bought supplier data, current warehouse synchronized with movement history, and status transitions for active, sold, deceased, and archived animals.
- Preserve purchase-evaluation price snapshots and calculate estimated net weight, net price/kg, and profitability server-side. A bought evaluation can create/link one cow; returned evaluations remain immutable without a cow.
- Treat feed as direct consumption cost, not inventory: feeding records retain quantity, unit-cost snapshot, and calculated cost. General non-animal costs use expenses. Do not implement stock balances, purchase orders, or inventory movements.
- Record health treatments, vaccination/deworming due dates, breeding attempts, and pregnancy outcomes. A breeding record must use exactly one source: an on-farm sire or purchased semen details (`semen_code` and optional provider). Reports expose due and overdue health/pregnancy items; no notification scheduler or email delivery in v1.
- Keep attendance as daily present/absent records. Salary payments are manually entered with amount, month, deductions, bonus, paid date, and status; do not generate automatic payroll. Mill charges retain substitute name/description and are not linked to an absent worker.
- Replace the flat sale record with `sales_invoices`, `sales_invoice_lines`, and `sale_payments`. Lines support milk, animal, and other items; optional cow attribution remains available. Invoices support draft/issued/partial/paid/void states, partial payments, customer balances, and receipt history. Finalizing an animal-sale line updates that cow’s status.
- Provide overview, searchable lists, detail timelines, create/edit forms, safe archive/void actions, CSV export, date/warehouse/cow/customer filters, bilingual labels, BDT currency formatting, and a configurable interface language preference.

## Reports and interfaces

- Dashboard: herd totals by status/category/warehouse, current milk production, milk revenue, recent costs, unpaid invoices, customer receivables, and due/overdue care or calving items.
- Reports: herd register and movement history; weight trends; purchase evaluation outcomes; feed and expense breakdown; milk production and sales; customer ledger/aging; labor attendance and manual salary payments; health/vaccination and breeding/pregnancy status; and period profitability.
- Define profitability as invoiced revenue less cow acquisition cost, feed consumption cost, expenses, health/breeding costs, labor payments, and mill charges. Show cash collections/receivables separately from accrual-style revenue.
- Resource APIs use pagination, filtering, sorting, validation errors, and role checks. Publish typed frontend API contracts generated from FastAPI OpenAPI so UI forms and API schemas remain aligned.

## Test, delivery, and acceptance plan

- Unit-test calculations, status transitions, breeding-source validation, date/range validation, sale totals/payment balances, role authorization, and all database constraints.
- Add API integration tests for each module, including cow purchase conversion, cow movement/tag history, customer partial payment and voided invoice behavior, milk/cow sale handling, report totals, and cross-role access denial.
- Add end-to-end browser tests for admin login, data-entry workflows, manager reporting, bilingual rendering, and responsive core screens.
- Configure CI for type checks, linting, unit/integration tests, migration validation, and production builds. Deploy preview environments for the web/API, run migrations through a controlled release job, and back up Supabase data before production migration releases.

## Assumptions and exclusions

- The application serves one farm; multi-farm tenancy is intentionally deferred.
- No document/photo uploads, inventory tracking, external reminders, automated payroll, custom permission builder, or full double-entry accounting in v1.
- The ER-diagram PNG is not needed; this plan is based on `ER-diagram/ER-code.eraserdiagram`.
