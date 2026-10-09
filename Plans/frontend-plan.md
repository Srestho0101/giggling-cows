# Frontend Plan: Cow Farm Management System (Laptop)

## 1. Overview

The frontend is a laptop-first web app for running daily dairy farm work: milk, attendance, sales, and expenses. It also covers herd records, breeding, health, purchases, payroll, and reports. Mobile is out of scope for now.

Feeding is not part of this phase. Milk is recorded by group, not per cow, and the backend splits the liters across the cows in each group.

## 2. Guiding principles

- **Daily entry comes first.** The most common tasks should take the fewest clicks and keystrokes.
- **Two languages.** Bangla is the default for farm staff, with an English option in the header.
- **The server owns the numbers.** The screen can preview a calculation, but saved values always come from the backend.
- **Nothing is lost.** If a save fails, the typed data stays on screen.
- **Currency and dates are local.** Money shows as ৳, and dates follow Bangladesh time in the format 10 Oct 2026.

## 3. Layout and navigation

The screen has a left sidebar, a top header, and a main content area.

The sidebar lists the sections in this order: Today, Herd, Purchases, Breeding, Health, Expenses, Milk and Sales, Payroll, Reports, and Masters.

The header holds a cow search (opened with Ctrl+K), the current date with arrows to change it, the language toggle, and the user menu.

## 4. Screens

### 4.1 Today (landing page)

This is the screen staff use most. It is split into three areas:

**Milk (wide, left side)**
- Staff type or scan cow tags, pressing Enter after each one to add it as a chip. An unknown tag shows a message right away.
- Enter the total liters for the group and press Enter to save. The row clears for the next group.
- A preview line shows the split before saving, for example "3 cows · 42.60 L · about 14.20 L each."
- Below is the list of today's groups, each showing its cows, total liters, and per-cow share, with edit and delete actions.
- A footer shows total liters, cows milked, and the average per cow.
- A cow can appear in only one group per day. If a cow is already milked today, the screen says so and links to that group.

**Attendance (middle)**
- One row per active worker, all marked present by default.
- Marking a worker absent opens a note field.
- A "Substitute" action records a stand-in worker's name and cost.

**Sales and Expenses (right)**
- Sales: pick a customer or add a new one, choose the item, enter quantity and price. The price fills in from the last sale of that item, and the total updates as you type. Today's sales are listed below.
- Expenses: pick a category (food or miscellaneous), enter the amount, and choose a warehouse. The warehouse remembers the last choice. Today's expenses are listed below.

### 4.2 Herd

- **List:** a table of all cows with search by tag and filters for warehouse, status, category, and sex. Columns include tag, category, age, warehouse, status, and latest weight.
- **Cow profile:** opened by clicking a row. The header shows the cow's tag, category, status, and warehouse. Tabs cover:
  - Overview: acquisition details and parents
  - Weight: a history table and a simple chart, with a button to log a new weight
  - Milk: past milk records for this cow, marked as group-based estimates
  - Breeding, Health, and Expenses: the cow's records in each area
  - History: tag changes and warehouse moves
- **Register a cow:** a full page, not a popup, because the form has many fields.

### 4.3 Purchases

- **Evaluator:** the left side holds the inputs (supplier, live weight, growth potential, offered price, market price). The right side shows the results live: estimated net weight, net price per kg, and a clear "profitable" or "not profitable" marker.
- **Saving** records whether the cow was bought or returned. A bought cow leads straight to the registration form with the details filled in.
- **History:** a list of past evaluations.

### 4.4 Breeding

- A log of breeding events, with filters for checks still pending and calvings due in the next 30 days.
- A new record takes the cow, heat date, insemination date, method, bull or semen code, doctor, and cost.
- A pregnancy check queue lets staff mark each check as confirmed or not pregnant in one click.

### 4.5 Health

- A "Due soon" panel at the top lists items due in the next 14 days. Overdue items are highlighted.
- A table of all health records, showing type, cow, vet, cost, and next due date.
- A new record can apply to several cows at once, which suits vaccination days.

### 4.6 Expenses

- A full expense log with filters for date range, category, warehouse, and cow.
- A bulk entry view for adding several expenses at once.
- Totals by category for the selected range.

### 4.7 Milk and Sales

- **Milk:** daily totals over a chosen date range, with a chart. Past entries can be corrected, and corrections show an audit note.
- **Sales:** the full sales log, a customer list with running balances, and totals by item.

### 4.8 Payroll

- **Workers:** the list of workers with role, salary, status, and join date. Add and edit from here.
- **Monthly salary run:** pick a month and see each worker's base salary, absence deduction, bonus, and net pay. Mark paid with a date once it's settled. The deduction shown on screen is a preview, and the backend makes the final calculation.
- **Substitutes:** the month's substitute charges.

### 4.9 Reports

- Monthly profit and loss: revenue from milk and sales against expenses, salaries, and purchases.
- Herd summary: counts by category and status, and average weight.
- Milk summary: totals and averages, labeled as estimates.
- Each report can be exported to Excel or PDF.

### 4.10 Masters

A single list-and-form layout reused for warehouses, suppliers, customers, expense categories, and market prices. Feed types are kept here but not used until feeding returns.

### 4.11 Login

A simple username or email and password form. Owners see every section. Staff see Today, Breeding, and Health, and can view the herd without editing it.

## 5. Shared patterns

- **Pickers:** a single search box for cows, workers, suppliers, customers, and warehouses. It searches by tag or name, shows both Bangla and English names, and allows adding a new item inline where that makes sense.
- **Dates:** default to today. Staff can type a date or pick it from a calendar.
- **Money:** accepts commas, shows the ৳ sign, and rounds to two decimals when the field loses focus.
- **Deletes:** always confirmed with a dialog. Edits save inline and show an undo option for a few seconds.
- **Empty and loading states:** every list has a clear message in both languages when it has no data or is still loading.

## 6. Keyboard use on a laptop

- Ctrl+K opens cow search from anywhere.
- Number keys with Alt move between sidebar sections.
- In the attendance list, arrow keys move between workers, Space toggles absent, and Enter saves the day.
- In milk and expense forms, Enter saves and Esc clears the form.
- Tables can be sorted and filtered, and they remember the columns the user chose.

## 7. Messages

Messages are short and say what to do next. Examples:

- "Tag 1047 was not found. Check the number or search by name."
- "Cow 1047 is already in today's milk. Edit that group instead."
- "Attendance for today is already saved. You can edit it below."

Messages appear in whichever language is selected.

## 8. Build order

1. **Foundation:** sign-in, the main layout, language switching, and the shared pickers.
2. **Setup data:** workers, suppliers, customers, warehouses, expense categories, and market prices, since the daily screens depend on them.
3. **Today:** milk, attendance, sales, and expenses.
4. **Herd:** cow list, cow profile, and cow registration.
5. **Health and Breeding:** records and due-date alerts.
6. **Purchases:** the evaluator and its history.
7. **Payroll:** monthly salary runs and substitutes.
8. **Reports:** profit and loss, herd, milk summaries, and exports.
9. **Refinement:** Bangla wording review, keyboard checks, role testing, and a timed run of a full day's entry with real staff.