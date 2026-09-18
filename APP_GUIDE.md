# FinMatrix — Complete App Guide

FinMatrix is an ERP for a **warehouse / distribution business**: it tracks inventory,
the full sales (Accounts Receivable) and purchase (Accounts Payable) cycle,
customers & vendors, taxes, and an end‑to‑end **delivery operation** with live GPS
tracking. Every financial report is generated automatically from the transactions
you record — you never type a report by hand.

This guide explains, for a real warehouse, **what each part does and how the pieces
connect**.

---

## 1. Roles

| Role | Where they work | What they do |
|------|-----------------|--------------|
| **Admin / Staff** | Main app (5 bottom tabs) | Run the whole business: inventory, invoices, bills, customers, vendors, deliveries, reports. |
| **Delivery Personnel (rider)** | Separate "Delivery" app view | See assigned deliveries, navigate to customers, capture proof, mark deliveries done. Their phone streams live GPS to the admin. |
| **Super Admin** | Super‑admin tabs | Platform owner: manage companies, plans, revenue analytics. |

The app decides which view to show at login based on the account's role.

---

## 2. The 5 main tabs (Admin / Staff)

```
Dashboard   Transactions   Reports   Inventory   More
```

- **Dashboard** — KPIs and today's snapshot (sales, outstanding, deliveries, low stock).
- **Transactions** — the money in/out: Invoices, Receive Payments, Bills, Pay Bills, Purchase Orders.
- **Reports** — financial & operational reports, all derived from your data.
- **Inventory** — your stock: items, quantities, adjustments, counts, transfers.
- **More** — everything else: Chart of Accounts, Customers, Vendors, Tax, Delivery, Agencies, Settings.

---

## 3. Inventory — your stock

Open the **Inventory** tab.

### Add an item
1. Tap **+ / Add** on the Inventory list.
2. Fill in name, SKU, category, unit price/cost, opening quantity, reorder point, agency/warehouse.
3. Save. The item now appears in the list with its **on‑hand** quantity.

### Keep stock accurate
From an item (or the Inventory menu) you can:
- **Adjustment** — manually increase/decrease a quantity (damage, theft, found stock) with a reason.
- **Physical Count** — reconcile the system quantity against a real shelf count; the difference posts as an adjustment.
- **Stock Transfer** — move quantity between agencies/warehouses.

### How inventory moves automatically
- **Selling** an item on an **Invoice** reduces available/committed stock.
- **Receiving** goods (via a **Bill**/PO) increases stock.
- **Deliveries**: when a rider completes a delivery, the delivered quantities flow back through the **Inventory Approval** queue (admin reviews "shadow inventory" before it commits to real stock).

> Reorder point: when on‑hand drops below it, the item is flagged **low stock** on the dashboard and in the Inventory Valuation report.

---

## 4. Transactions — the AR / AP cycle

Open the **Transactions** tab. This is where money is recorded; reports read from here.

### Sales (Accounts Receivable)
1. **Invoice** → bill a customer. Pick the customer, add line items (pulls price from inventory), set tax & discount, issue.
   - Statuses: `draft → sent → partial → paid` (plus `overdue`, `void`).
2. **Receive Payment** → record money a customer paid; allocate it to one or more invoices. The invoice's balance and status update automatically.

### Purchases (Accounts Payable)
3. **Purchase Order (PO)** → order goods from a vendor.
4. **Bill** → a vendor's invoice to you (can be created from a PO). Records what you owe.
5. **Pay Bills** → record money you paid a vendor; the bill's balance updates.

### Why this matters for reports
Every invoice, payment, bill, and PO is a **transaction record**. The reports below
simply read and aggregate these records — so if the numbers in a report look wrong,
the fix is always in the underlying transaction, not the report.

---

## 5. Reports — generated from your transactions

Open the **Reports** tab. Nothing here is typed manually; each report is computed live
from the data you entered.

| Report | What it shows | Built from |
|--------|---------------|-----------|
| **Analytics Dashboard** | Business intelligence: revenue trends, top metrics over recent months | Invoices, payments, bills |
| **Profit & Loss (P&L)** | Income − expenses over a period | Invoices (income) + Bills/expenses |
| **Balance Sheet** | Assets, liabilities & equity at a point in time | Inventory value, receivables, payables, cash |
| **A/R Aging** | Who owes you and how overdue (30/60/90 days) | Unpaid/partial invoices by due date |
| **Inventory Valuation** | Stock on hand × cost = money sitting in inventory | Inventory quantities & costs |
| **Delivery Daily Report** | Operational summary of the day's deliveries | Delivery records |
| **Delivery Performance** | Rider productivity (on‑time, completed, etc.) | Delivery records + status history |

**Example:** Create an invoice → it appears in P&L (as income) and in A/R Aging (until
paid). Record the payment → A/R Aging drops it and cash rises on the Balance Sheet.

---

## 6. The "More" section — everything else

Open the **More** tab. It is grouped into sections:

### ACCOUNTING
- **Chart of Accounts** — the list of financial accounts (assets, liabilities, income,
  expenses) that organize your books and feed the Balance Sheet / P&L.

### PEOPLE
- **Customers** — who you sell to. Holds contact + **shipping/billing address** (used to
  geocode delivery destinations), credit limit, and outstanding balance.
- **Vendors** — who you buy from. Holds bills, payments and balances owed.

### MONEY
- **Tax Management** — tax rates, the tax liability report, and recording tax payments.

### OPERATIONS
- **Delivery Management** — create/assign/monitor deliveries (see §7).
- **Delivery Personnel** — add riders, give them login credentials, set availability,
  and **Track on Map**.
- **Warehouse Agencies** — manage agencies/warehouses, their inventory and sync.

### SYSTEM
- **Settings** — company profile, user management, preferences (date/number/currency
  format, default payment terms) and notification toggles.

---

## 7. Delivery Management (the core operations feature)

There are **two sides**: the **Admin** side (in the main app) and the **Rider** side
(the separate Delivery app view).

### A. Admin: create → assign → monitor
1. **Create Delivery** — pick a customer and items. The customer's shipping address is
   **geocoded** into map coordinates automatically (see §8).
2. **Assign** — assign one or many deliveries to a rider (manual or **auto‑assign**).
3. **Delivery Monitor** (the live map) — shows:
   - **Destination pins** (hollow, status‑colored) = where each delivery must go.
   - **Truck pins** (filled) = each rider's **live GPS** position.
   - **Dashed lines** connecting a rider to their destination.
   - A list view, status filters, and a 30‑second auto‑refresh.
4. **Track a specific rider** — Delivery Personnel → open a rider → **Track on Map**.

### B. Rider: execute → prove → complete
In the Delivery app the rider sees their assigned deliveries and moves each through:
```
pending → picked_up → in_transit → arrived → (bill photo) → customer confirms → delivered
```
- **Navigate** opens Google Maps turn‑by‑turn to the exact geocoded coordinates.
- **Bill Photo** captures proof of delivery.
- **Customer Confirm** marks the delivery **delivered** on the server.
- Once delivered, it **leaves the rider's active list**, is **recorded in history**, and
  the delivered quantities go to the admin's **Inventory Approval** queue.

> The rider's phone streams GPS to the server continuously (even in the background /
> screen locked) while they're on a route — that is what powers the admin's live map.

---

## 8. Maps & live tracking — production setup

The maps and tracking are real (Google Maps + GPS), and need a few one‑time setup steps.

### Google Cloud (one time)
1. Enable these APIs on the project that owns the key in `app.json`:
   **Maps SDK for Android**, **Geocoding API**, **Directions API**.
2. Make sure **billing** is enabled on that Google Cloud project.
3. Restrict the key: Android key → your app's package (`com.finmatrix`) + signing SHA‑1.
4. Backend geocoding: set `GOOGLE_MAPS_API_KEY` in the **backend** environment and enable
   the **Geocoding API** (a separate, IP‑restricted server key is best practice).

### Backend (one time)
- Run the database migration (adds delivery destination coordinates):
  deploy with `DB_MIGRATIONS_RUN=true` (or run `node dist/database/run-migrations.js`).
- Backfill existing deliveries' coordinates: call `POST /deliveries/geocode-pending`
  (admin auth) until it returns `updated: 0`. New deliveries geocode automatically.

### Mobile build (important)
- **Background GPS tracking and Google Maps do NOT work in Expo Go.** You must run a
  **dev or production build**: `npx expo prebuild` then `eas build` (or `npx expo run:android`).
- On first rider login, choose **"Allow all the time"** for location so tracking
  continues when the phone is locked.

If the admin map is empty: confirm a rider is logged in on a **real build**, is **on a
route**, granted background location, and that deliveries have been geocoded.

---

## 9. A typical end‑to‑end warehouse day

1. **Stock in** — receive goods: create a **PO** → convert to a **Bill** → inventory rises.
2. **Sell** — create an **Invoice** for a customer → inventory commits, A/R rises.
3. **Dispatch** — **Create Delivery** for that order → **Assign** to a rider.
4. **Deliver** — rider navigates, captures the bill photo, customer confirms → **delivered**.
5. **Get paid** — **Receive Payment** against the invoice → A/R clears, cash rises.
6. **Reconcile stock** — approve the rider's delivered quantities in **Inventory Approval**;
   run a **Physical Count** if needed.
7. **Review** — open **Reports**: P&L for profit, A/R Aging for who owes you, Inventory
   Valuation for stock value, Delivery Performance for rider productivity.

Everything above is connected: a single sale flows from **Inventory → Invoice →
Delivery → Payment → Reports** without re‑entering data.
