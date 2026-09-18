# FinMatrix — Warehouse Feature & Testing Guide

**For:** anyone who needs to drive every feature of the warehouse build end to end — testers, auditors,
new team members, and demo operators.
**Build:** warehouse-only (`WAREHOUSE_ONLY_BUILD = true`). **Written:** 14 Aug 2026.
**You do not need to know accounting to use this guide.** Every step explains the concept first, then
what the app does about it, then exactly what to click, then exactly where the result shows up.

> **The one rule of this guide:** a feature is not "working" because the screen looked right. It is
> working when the **ledger** proves it. Every test below tells you which report to open and which
> number must move.

---

## Table of contents

| Part | What's in it |
|---|---|
| [A — Before you start](#part-a--before-you-start) | Logins, the app map, the five accounts, the snapshot method |
| [B — The warehouse lifecycle](#part-b--the-warehouse-lifecycle-in-one-picture) | How stock becomes money, in one diagram |
| [C — The main test script](#part-c--the-main-test-script) | 14 steps, in order, with exact data |
| [D — Reports tie-out & reconciliation](#part-d--reports-tie-out--reconciliation) | The maths that proves it all worked |
| [E — Security & permissions](#part-e--security--permissions) | Rider restrictions, tenancy, plan limits |
| [F — Everything else in the app](#part-f--everything-else-in-the-app) | The remaining features, compactly |
| [G — Known gaps in this build](#part-g--known-gaps-in-this-build) | Don't file these as new bugs |
| [H — Bug template & sign-off](#part-h--bug-reporting--sign-off) | How to report, when to sign off |

---

# Part A — Before you start

## A1. What FinMatrix actually is

FinMatrix is a **double-entry accounting system with a warehouse and a delivery fleet bolted onto the
same ledger**. That last part is what makes it different from a normal stock app.

In a normal stock app, "delivered" is a status flag. In FinMatrix, every physical event — receiving
goods, loading a van, handing a box to a customer, taking a return — writes a **journal entry**: two
or more lines, debits equal to credits, that permanently change the financial statements. Nothing is
ever edited or deleted; corrections post *offsetting* entries so the audit trail survives.

So when you test this app you are really testing two things at once:

1. **Does the operation work?** (the van gets assigned, the photo uploads, the status advances)
2. **Did the books move correctly?** (inventory dropped, the right account was hit, the totals balance)

This guide always tests both.

## A2. Logins

| Role | Email | Password | What they see |
|---|---|---|---|
| **Warehouse admin** | `warehouse@gmail.com` | `123456` | The full app — accounting, inventory, purchasing, delivery, reports |
| **Rider 1** (Saim Raza) | `rider1@warehouseco.com` | `123456` | Rider app only — their own deliveries |
| **Rider 2** (Haseeb Ali) | `rider2@warehouseco.com` | `123456` | Rider app only — their own deliveries |
| **Platform super-admin** | `waleedhassansfd@gmail.com` | `Waleed@104` (prod) · `123456` (local QA) | Company approvals, payment verification, feature kill switch |


> **The super-admin password differs between environments.** `Waleed@104` is the real one, but on the
> **local QA database** the demo seed overwrites it with `123456` — confirmed by testing the stored
> bcrypt hash directly. If a script that needs super-admin (`test:delivery-ledger` creates a company
> and then approves it) fails at setup with `COMPANY_NOT_ACTIVE`, this is why: the sign-in silently
> failed, so the approve step never ran. Pass `SUPER_PASSWORD=123456` when running locally.

**You need two devices (or a device + an emulator/web) to test the delivery flow properly** — one
logged in as admin, one as a rider. Logging out and back in works too, it is just slower.

## A3. Two apps in one binary

There is **no separate rider download**. The same app decides which interface to mount from the
signed-in user's role ([AppContainer.tsx](src/components/app-container/AppContainer.tsx)):

| Role | Interface mounted | Bottom tabs |
|---|---|---|
| Company admin/owner | `AdminTabNavigator` | Dashboard · Transactions · Reports · Inventory · More |
| `delivery` (rider) | `DeliveryTabNavigator` | Dashboard · Deliveries · Inventory · Profile |
| Platform super-admin | `SuperAdminNavigator` | Company approvals, payments, overrides |

A rider **cannot navigate to an accounting screen** — those routes are not registered in their
navigator at all, and the server answers 403 even if the request is made directly. You will verify
both directions in [Part E](#part-e--security--permissions).

> **Note on tiers.** This build ships warehouse-only: every new company registers as `warehouse` and
> every admin gets the full navigator ([featureGates.ts](src/utils/featureGates.ts)). The
> small-business / large-organisation tier code still exists but is switched off. If someone hands
> you an older script that says "warehouse has everything the other tiers have" — that is still true,
> there just aren't other tiers to compare against right now.

## A4. Where everything lives

Learn this table once and you will never hunt for a screen again.

### Admin — bottom tabs

| Tab | Contains |
|---|---|
| **Dashboard** | KPIs, charts, quick actions, global search |
| **Transactions** | Estimates · Sales Orders · Invoices · Receive Payments · Credit Memos · Bills · Pay Bills · **Purchase Orders** · Vendor Credits · General Journal |
| **Reports** | Financial (P&L, Balance Sheet, Trial Balance, Cash Flow, General Ledger, Budgets, Analytics) · A/R Aging · **Inventory Valuation** · **Delivery Daily Report & Performance** |
| **Inventory** | Item list · Add/Edit item · Item detail · Stock Adjustment · Physical Count · Stock Transfer |
| **More** | Everything else — see below |

### Admin — the More tab

| Section | Rows |
|---|---|
| **ACCOUNTING** | Chart of Accounts · Bank Reconciliation |
| **PEOPLE** | Customers · Vendors · Employees & Payroll |
| **MONEY** | Tax Management (rates, liability, payments) |
| **OPERATIONS** | **Delivery Management** · **Delivery Personnel** · **Warehouse Agencies** |
| **SYSTEM** | Settings (company profile, users, subscription, company switcher) |

**Delivery Management** is the operations hub. It opens on a three-tab screen:

| Tab | What it does |
|---|---|
| **Assign** | Lists unassigned deliveries with checkboxes → *Assign Selected (n)* → pick a rider. Also links to the full **Create Delivery** form and the three-panel **Assign Work** screen. |
| **Monitor** | Live status counts and the list of active deliveries → links to the full **Delivery Monitor** (map, filters, sort). |
| **Approvals** | **Open Inventory Approval Queue (n pending)** — this is where deliveries become sales. Also lists failed/returned deliveries. |

### Rider — bottom tabs

| Tab | Contains |
|---|---|
| **Dashboard** | Today's assigned load, quick stats |
| **Deliveries** | My deliveries → delivery detail → status buttons → Capture Signed Bill → Customer Confirm → Complete |
| **Inventory** | Van stock ("shadow inventory") — the rider's local copy of what they're carrying |
| **Profile** | History, settings, logout |

## A5. The five accounts you must understand

Everything in Part C moves one or more of these. Read this once — the rest of the guide assumes it.

| Account | Type | Plain English | When it goes UP | When it goes DOWN |
|---|---|---|---|---|
| **Inventory** | Asset | Value of stock physically on your shelves | You receive goods from a supplier; a customer returns goods; a rejected delivery comes back | You load a van; you return goods to a supplier |
| **GRNI** *(Goods Received Not Invoiced)* | Liability | "We have the goods but the supplier hasn't billed us yet" | You receive a PO | The vendor bill arrives |
| **Goods in Transit** | Asset | Stock that has left the shelf on a van but hasn't been sold yet | A delivery is assigned to a rider | The delivery is approved (sold) or rejected (returned) |
| **COGS** *(Cost of Goods Sold)* | Expense | What the goods you actually sold cost you | A delivery is approved | A customer return is credited back |
| **Sales / Revenue** | Income | What you charged the customer | A delivery is approved | A credit memo is issued |

**Two ideas do all the work in this app:**

**① GRNI is a clearing account.** Goods and invoices arrive at different times. GRNI holds the gap.
Receive goods → GRNI goes up. Bill arrives → GRNI comes back down to zero. **If GRNI is not zero
after a complete purchase cycle, something was received twice, billed twice, or never billed.** That
single number is your purchasing integrity check.

**② Goods in Transit is the same trick, for the van.** Stock that has left the building isn't on your
shelves, but it isn't sold either — you still own it. Goods in Transit holds it. Assign → it goes up.
Approve or reject → it comes back to zero. **If Goods in Transit is not zero for a finished delivery,
stock has vanished from your books.** That is your delivery integrity check.

**③ Revenue is recognised at approval, not at dispatch.** Putting a box on a van is not a sale. This
is the single most important accounting rule in the app, and Step [C4](#c4--delivery-1--cash-sale-the-full-loop)
is designed to prove it.

## A6. The snapshot-then-delta method

Warehouse Co is a seeded demo company that already has balances. You do **not** need to know them.
Instead:

1. **Before you start**, open Reports → Trial Balance and write down today's balance for each account below.
2. Work Part C in order, with the exact data given.
3. After each step, check the **delta** (the change), not the absolute number.
4. At the end, confirm: `ending balance = your snapshot + total delta from the table in Part D`.

Any mismatch is a bug.

### STEP 0 — Snapshot (fill this in before doing anything else)

| Account | Balance right now |
|---|---|
| Bank | |
| Cash | |
| Accounts Receivable | |
| Inventory | |
| Goods in Transit | |
| GRNI | |
| Accounts Payable | |
| GST / Tax Payable | |
| Sales / Revenue | |
| COGS | |
| **Inventory Valuation report — total** | |
| **Trial Balance — total debits** | |
| **Trial Balance — total credits** | |

Also note: on-hand quantity of `SKU-OIL` and `SKU-FLR` — both should be **0** (they don't exist yet).

> If total debits ≠ total credits **before you start**, stop. The ledger is already broken and nothing
> you test afterwards will mean anything.

---

# Part B — The warehouse lifecycle in one picture

```
   SUPPLIER SIDE                                          CUSTOMER SIDE
   ─────────────                                          ─────────────

   Purchase Order  ──────────►  no entry (a commitment, not a transaction)
        │
        ▼
   Receive Items   ──────────►  Dr Inventory        Cr GRNI
        │                       (stock arrives, we owe "something")
        ▼
   Convert to Bill ──────────►  Dr GRNI             Cr Accounts Payable
        │                       (GRNI nets to ZERO ✓  — now we owe money)
        ▼
   Pay Bill        ──────────►  Dr Accounts Payable Cr Bank
        │
        │
   ═════╪══════════ stock is now sitting on your shelf ══════════════════
        │
        ▼
   Create Delivery ──────────►  no entry (a plan, not a transaction)
        │
        ▼
   Assign to Rider ──────────►  Dr Goods in Transit Cr Inventory   (AT COST)
        │                       + a Sales Order is created (non-posting)
        │                       ⚠ NO revenue, NO COGS — nothing is sold yet
        ▼
   Rider delivers  ──────────►  no entry
   (picked up → in transit →    (status machine + proof photo + PAID/NOT PAID flag;
    arrived → signed bill)       queues for admin approval)
        │
        ▼
   Admin APPROVES  ──────────►  Dr Cash *or* A/R    Cr Sales     ← revenue recognised
        │                       Dr COGS             Cr Goods in Transit
        │                       (Goods in Transit nets to ZERO ✓)
        │
        ├── if NOT PAID ────►   later: Dr Bank      Cr Accounts Receivable
        │                       (payment only — P&L does NOT move again)
        │
        └── if REJECTED ────►   Dr Inventory        Cr Goods in Transit
                                (stock back on the shelf, no sale ever happened)

   AFTER a sale is posted, a return needs a CREDIT MEMO:
                                Dr Sales            Cr A/R (or Cash)
                                Dr Inventory        Cr COGS
   AFTER a purchase is billed, a return needs a VENDOR CREDIT:
                                Dr Accounts Payable Cr Inventory
```

Keep this open in a second window while you work through Part C.

---

# Part C — The main test script

**How each step is written:**

- **Concept** — the accounting idea, in plain English
- **How FinMatrix does it** — the screen, the mechanism, what posts
- **Do this** — the exact clicks and data
- **Expected result** — what must happen, as a *delta*
- **Where it shows up** — the screens/reports that must reflect it
- **🚩 Red flags** — what would be a bug

Use the exact numbers given. They are chosen so the final reconciliation is a clean, checkable total.

---

## C1 — Master data (items, customer, vendor)

### Concept
Items, customers and vendors are **reference data**, not transactions. Creating them describes the
world; it doesn't change your financial position. A brand-new item with zero stock is worth zero, so
**nothing posts to the ledger.**

### How FinMatrix does it
Three separate registers, all non-posting. Inventory items carry both a **unit cost** (what you pay —
drives Inventory value and COGS) and a **selling price** (what you charge — drives Revenue). Keeping
those two apart is what lets the app compute gross profit per delivery.

### Do this

**1a. Two inventory items** — Inventory tab → **+ / Add Item**:

| Field | Item 1 | Item 2 |
|---|---|---|
| Item Name * | `5L Cooking Oil` | `10kg Flour Bag` |
| SKU * | `SKU-OIL` | `SKU-FLR` |
| Category * | (any) | (any) |
| Unit Cost * | `800` | `1200` |
| Selling Price * | `1000` | `1600` |
| Quantity on Hand * | `0` | `0` |
| Reorder Point | `20` | `15` |
| Cost Method | leave default | leave default |

> **There is no Quantity on Hand field any more, and that is deliberate.** New items start at zero.
> Creating an item is reference data; it posts nothing. Stock only arrives through a path that writes a
> journal entry, because inventory is an asset and an asset cannot appear without a matching credit.
>
> There are exactly three such paths:
>
> | Route | When | Entry |
> |---|---|---|
> | **Purchase Order → Receive** ([C2](#c2--the-purchase-cycle-po--receive--bill)) | Buying stock | `Dr Inventory / Cr GRNI` |
> | **Opening Stock** (item detail, one-time) | Stock you already owned on day one | `Dr Inventory / Cr Opening Balance Equity 3900` |
> | **Stock Adjustment** ([C11](#c11--stock-adjustment--correcting-the-shelf)) | Correcting a count | `Dr/Cr Inventory ↔ Shrinkage 6400` |
>
> Use **Opening Stock** for migration, never an adjustment: an adjustment credits expense 6400, so
> loading your opening shelf that way would report the whole lot as **profit**. Opening Balance Equity
> touches neither the P&L nor a supplier, and an accountant clears it to owner equity afterwards.
>
> The old editable field was worse than a shortcut — the API never accepted a quantity on create, so it
> was **silently discarded**: you typed 100, were told the item was created, and got 0.

**1b. One customer** — More → Customers → Add:
`Ahmed Store` · `ahmed@store.pk` · `0300-1112223` · give it a shipping address with a city (the city
decides the delivery Zone — Lahore/Gujranwala = Zone A, Karachi/Rawalpindi = Zone B,
Islamabad/Faisalabad = Zone C, anything else = Zone D).

**1c. One vendor** — More → Vendors → Add:
`Metro Wholesale` · `billing@metro.pk`.

### Expected result
**Zero ledger movement.** Trial Balance identical to your Step 0 snapshot.

### Where it shows up
- Inventory tab: both items listed, on-hand **0**, flagged low/out of stock
- Reports → Inventory Valuation: both items at value **0**
- More → Customers / Vendors: new rows
- Create Delivery screen: items appear in the dropdown as `5L Cooking Oil · stock 0`

### 🚩 Red flags
- Any Trial Balance movement from creating master data
- An item saving without a SKU, or with a duplicate SKU
- Selling price silently overwriting unit cost (or vice versa) — check the saved item detail

---

## C2 — The purchase cycle: PO → Receive → Bill

### Concept
Buying stock is **three separate events**, and confusing them is the classic accounting error:

1. **Ordering** — you promise to buy. Nothing has happened financially. **No entry.**
2. **Receiving** — the goods are physically yours. You have an asset and an obligation, but no invoice
   yet. Inventory up, **GRNI** up.
3. **Billing** — the supplier's invoice arrives. The obligation becomes a real, dated payable. GRNI
   down, Accounts Payable up.

This is the **three-way match** (order ↔ receipt ↔ invoice). It's how you catch a supplier billing you
for 100 units when they shipped 90.

**The trap this design avoids:** if receiving *and* billing both increased Inventory, you'd count the
same goods twice and your balance sheet would be inflated by the value of every unbilled receipt.
GRNI exists precisely so that only *one* of the two events touches Inventory.

### How FinMatrix does it
Transactions → Purchase Orders. A PO moves `draft → sent → partially_received → fully_received →
closed`. Receiving is per-line (you type the quantity actually delivered, which is what makes partial
receipts and short shipments testable). "Convert to Bill" carries the received lines into a vendor
bill so you can't accidentally bill for something you never received.

### Do this

**2a. Create the PO** — Transactions → Purchase Orders → New, vendor `Metro Wholesale`:

| Line | Item | Qty | Unit cost | Line total |
|---|---|---|---|---|
| 1 | 5L Cooking Oil | 100 | 800 | 80,000 |
| 2 | 10kg Flour Bag | 50 | 1,200 | 60,000 |

Total **140,000**. Save as draft, then tap **Send to Vendor**.

**2b. Receive the goods** — open the PO → **Receive Items** → enter the full quantity on each line
(100 and 50) → **Save Received**. You should see *"All items have been fully received. You can now
Convert to Bill."*

**2c. Bill it** — tap **Convert to Bill** → confirm vendor `Metro Wholesale`, total 140,000 → save.

### Expected result

| Step | Journal entry | Trial Balance |
|---|---|---|
| 2a Create PO | **none** | unchanged |
| 2a Send to Vendor | **none** | unchanged |
| 2b Receive | `Dr Inventory 140,000` / `Cr GRNI 140,000` | balanced |
| 2c Convert to Bill | `Dr GRNI 140,000` / `Cr Accounts Payable 140,000` | balanced |

**Running deltas after C2:** Inventory **+140,000** · GRNI **0** · Accounts Payable **+140,000**.

### Where it shows up
- **Inventory tab:** Oil on-hand `100`, Flour `50`; both now above their reorder points
- **Reports → Inventory Valuation:** total **+140,000** (80,000 oil + 60,000 flour)
- **Reports → Balance Sheet:** Inventory +140,000; GRNI back to its opening value; A/P +140,000
- **Reports → Trial Balance:** still balanced to the rupee
- **Vendor detail / A/P Aging:** Metro Wholesale owed 140,000
- **PO list:** PO shows `Fully Received`, linked to the bill

### 🚩 Red flags
- **Anything posting at 2a.** A purchase order is a commitment, not a transaction.
- **Inventory moving again at 2c.** This is the double-count check. Receiving raises Inventory;
  billing must not. If Inventory is +280,000, that is a critical bug.
- **GRNI not returning to its opening balance** after 2c.
- Being able to receive **more** than the ordered quantity without a warning.
- Being able to Convert to Bill **before** receiving anything.

### Optional variant worth running (partial receipt)
Instead of receiving 100/50, receive **60 oil and 50 flour**. Expect: PO status `Partially Received`,
Inventory `+108,000`, GRNI `+108,000`, and the remaining 40 oil still showing as outstanding. Then
receive the last 40 and confirm GRNI totals 140,000 across the two receipts. This is the most common
real-world case and the one most likely to be wrong.

---

## C3 — Delivery personnel (riders)

### Concept
A rider is not a "record" like a customer — it is a **real user account with a login**. That is why
riders are the one thing FinMatrix meters: creating one provisions a login, a mobile session,
GPS tracking, photo uploads and delivery assignments. (Customers, vendors and employees are
unlimited; **active riders** are the plan limit: 2 / 5 / 10.)

Creating a rider posts **nothing** to the ledger.

### How FinMatrix does it
More → **Delivery Personnel** → Add. The form provisions a `users` row with `role: 'delivery'` plus a
delivery profile (vehicle, capacity). On success the app shows the generated credentials with a
**Share** button so you can hand them over.

### Do this
1. More → Delivery Personnel — confirm **Saim Raza** and **Haseeb Ali** exist and are `active`.
2. Add one more to test the form: Full Name `Rider Test`, Phone `+92-300-1234567`, Login Password
   `123456`, Vehicle Type (any), Vehicle Number `LHR-1234`. Save and copy the credentials.
3. **Plan-limit check:** keep adding riders until the app refuses. It must fail with a clear message
   naming your plan and its allowance — not a generic error, and not silently succeed.
4. **Concurrency check:** deactivate a rider and confirm the freed slot lets you add another (the
   limit counts *active* riders, not lifetime).

### Expected result
No ledger movement. New rider appears in the list as `active` with `0/maxLoad`.

### Where it shows up
- More → Delivery Personnel: the list, with live load per rider
- Delivery Management → Assign → the rider picker modal (shows `vehicle • current/max load • %`)
- The new rider can log in and lands in the **rider app**, not the admin app

### 🚩 Red flags
- Rider limit not enforced, or enforced with an unhelpful error
- A newly created rider seeing another rider's deliveries
- A rider landing on the admin navigator

---

## C4 — Delivery 1 — cash sale, the full loop

**This is the centrepiece of the whole app.** Take your time here.

### Concept
A delivery is a sale that happens in **two stages separated in time**, and the accounting has to
respect that gap:

- **Stage 1 (dispatch):** goods leave the warehouse. You still own them — they're on a van, not sold.
  Their *cost* moves from Inventory to Goods in Transit. **No revenue.** Recognising revenue here
  would be a serious misstatement: you'd book income for goods the customer may refuse, and your P&L
  would improve every time you loaded a truck.
- **Stage 2 (approval):** the customer has the goods and the admin has verified the proof. *Now* it's
  a sale. Revenue is recognised, and simultaneously the cost moves out of Goods in Transit into COGS —
  so revenue and its matching cost land in the same period. That's the **matching principle**.

### How FinMatrix does it
- **Create Delivery** builds the order (non-posting).
- **Assign** calls `POST /deliveries/assign`, which creates a **Sales Order** (a confirmed order —
  still non-posting) and posts the Goods in Transit entry at **cost**. The success alert tells you the
  SO number and the transit value, so the dispatcher can see the accounting happened.
- **The rider** advances a strict status machine and uploads proof. Nothing the rider does posts to
  the ledger — riders cannot touch the books by design.
- **The admin approves** in the Inventory Approval Queue. *That* is the posting event, and the
  approval dialog states exactly what it is about to post before you confirm it.

### Do this

**4a. Create** — Delivery Management → Assign tab → **Open Full Create Delivery Form**:
- Customer: `Ahmed Store`
- Item: `5L Cooking Oil` → Qty `20` → **Add item** (line = 20 × 1,000 = 20,000)
- Priority: `High` · Notes: `Test delivery 1 — cash`
- Leave **Pre-paid sale UNCHECKED**
- **Create Delivery**

Read the confirmation: *"a Sales Order is created (non-posting) and the stock moves to Goods in
Transit — revenue posts only after you approve the completed delivery."* That sentence is the
contract this step verifies.

**Check now, before assigning:** Trial Balance must be **completely unchanged**. Creating a delivery
posts nothing.

**4b. Assign** — back on the Assign tab, tick the new delivery → **Assign Selected (1)** → pick
**Saim Raza**.

Read the success alert — it should name a **Sales Order number** and report
`Stock moved to Goods in Transit at cost (Rs 16,000)`.

**4c. Rider** — log in as `rider1@warehouseco.com` on the second device:
- Deliveries tab → open the delivery
- **Pick Up Items** → status `picked_up`
- **Start Delivery** → `in_transit`
- **Mark as Arrived** → `arrived`
- **Capture Signed Bill** → take/pick a photo, type the customer name in *Signed by*, choose
  **PAID** (cash collected), add an optional note → **Submit**
- You should see **"Sent for Admin Review"** → continue to Customer Confirm → Delivery Complete

**Test the state machine while you're here:**
- Try to skip a step (there is only ever one action button — you shouldn't be able to)
- Double-tap the action button — it must advance **once**, not twice (the button locks while the
  request is in flight)
- Try to submit the bill photo **twice** — must be refused with *"Already submitted"*
- Try to submit with no photo / no name / no payment status — each must be blocked with a specific message

**Check now:** as admin, the Trial Balance must show **only** the Goods in Transit entry from 4b.
The rider's whole journey posted **nothing**.

**4d. Approve** — back as admin: Delivery Management → **Approvals** → **Open Inventory Approval
Queue**. Open the pending request. Confirm it shows:
- the **PAID** badge, the customer, and the sale amount `Rs 20,000`
- the hint *"Posts the sale (Rs 20,000) as CASH received, plus COGS."*
- the item table: `Item | Before | Delivered | Returned | After`
- the signed bill photo (tap to view) and who signed it
- shadow status and submitted timestamp

Tap **Approve** and read the confirmation dialog before confirming — it restates the posting.

### Expected result

| Step | Journal entry |
|---|---|
| 4a Create | **none** |
| 4b Assign | `Dr Goods in Transit 16,000` / `Cr Inventory 16,000` *(20 × 800 cost)* |
| 4c Rider (all of it) | **none** |
| 4d Approve | `Dr Cash 20,000` / `Cr Sales 20,000` **and** `Dr COGS 16,000` / `Cr Goods in Transit 16,000` |

**Running deltas after C4:** Inventory **+124,000** · Goods in Transit **0** · Cash **+20,000** ·
Sales **+20,000** · COGS **+16,000** · gross profit on this delivery **4,000**.

### Where it shows up
- **Inventory tab:** Oil `100 → 80` at assignment (not at approval — the stock left at dispatch)
- **Reports → Inventory Valuation:** −16,000 at assignment
- **Reports → Balance Sheet:** at assignment, Inventory −16,000 and Goods in Transit +16,000 —
  **total assets unchanged** (value changed *location*, not amount). At approval, Cash +20,000 and
  Goods in Transit −16,000.
- **Reports → Profit & Loss:** nothing until approval, then Sales +20,000 and COGS +16,000 together
- **Transactions → Sales Orders:** the SO created at assignment
- **Transactions → Invoices:** the invoice created at approval
- **Delivery Monitor:** status transitions live, rider location if tracking is on
- **Reports → Delivery Daily Report / Performance:** the completed delivery

### 🚩 Red flags — the important ones
- **Sales or COGS moving at 4a or 4b.** Revenue recognised before delivery is the most serious bug
  this app can have.
- **Anything at all posting during 4c.** Riders must never be able to move the ledger.
- **Goods in Transit not returning to zero** after approval.
- Inventory dropping at *approval* instead of *assignment* (double-drop = it dropped at both).
- COGS ≠ 16,000 — if it equals 20,000, the app is costing goods at selling price.
- The approval dialog describing a posting different from what actually posts.

---

## C5 — Delivery 2 — credit sale, then payment

### Concept
Same sale, different settlement. When the customer doesn't pay on delivery, the revenue is **still
earned** — you delivered — so Sales is recognised exactly as before. What changes is the debit: instead
of Cash you get **Accounts Receivable**, a promise to pay.

When the money arrives later, that is **not a second sale**. It's an asset swap: A/R turns into Bank.
**The P&L must not move at all.** Booking revenue again at payment time is the classic double-count,
and it's what this step exists to catch.

### How FinMatrix does it
Identical flow to C4; the only difference is the rider taps **NOT PAID** on the bill capture screen.
The approval queue shows a `NOT PAID` badge and the hint *"Posts the sale on CREDIT (open invoice in
A/R), plus COGS."* Settlement later goes through Transactions → Receive Payments.

### Do this

**5a.** Create a delivery for `Ahmed Store`: **10 × 10kg Flour Bag @ 1,600 = 16,000**. Assign to
**Haseeb Ali (Rider 2)**.

**5b.** As Rider 2: advance `picked_up → in_transit → arrived` → Capture Signed Bill → choose
**NOT PAID** → submit.

**5c.** As admin: approve it from the Inventory Approval Queue. Verify the badge says **NOT PAID** and
the hint says CREDIT before you approve.

**5d.** Transactions → **Receive Payments** → customer `Ahmed Store` → amount `16,000` → account
`Bank` → save.

### Expected result

| Step | Journal entry |
|---|---|
| 5a Assign | `Dr Goods in Transit 12,000` / `Cr Inventory 12,000` *(10 × 1,200)* |
| 5c Approve | `Dr Accounts Receivable 16,000` / `Cr Sales 16,000` **and** `Dr COGS 12,000` / `Cr Goods in Transit 12,000` |
| 5d Payment | `Dr Bank 16,000` / `Cr Accounts Receivable 16,000` |

**Running deltas after C5:** Inventory **+112,000** · Goods in Transit **0** · A/R **0** ·
Bank **+16,000** · Sales **+36,000** · COGS **+28,000**.

### Where it shows up
- **Inventory tab:** Flour `50 → 40` at assignment
- **Reports → A/R Aging:** after 5c, an open 16,000 for Ahmed Store; after 5d, **gone**
- **Transactions → Invoices:** the invoice flips `Open → Paid`
- **Reports → Profit & Loss:** moves at 5c only — **identical before and after 5d**
- **Reports → Balance Sheet:** at 5d, Bank +16,000 and A/R −16,000, total assets unchanged
- **Customer detail (Ahmed Store):** balance returns to zero

### 🚩 Red flags
- **P&L changing at 5d.** Revenue was already recognised. If Sales moves again, revenue is
  double-counted.
- The invoice staying `Open` after full payment, or A/R Aging still showing it
- Payment allowed to exceed the invoice without an explicit over-payment/credit handling
- A/R not appearing at all at 5c (i.e. it posted to Cash for an unpaid delivery)

---

## C6 — Delivery 3 — rejection and reversal

### Concept
Not every dispatch becomes a sale. If the goods come back, the *only* correct outcome is: stock
returns to the shelf, Goods in Transit clears, and **no revenue and no COGS are ever recorded** —
because nothing was sold. The books should end up exactly where they were before the dispatch.

### How FinMatrix does it
The admin **rejects** the request in the Inventory Approval Queue. Rejection reverts the rider's
shadow inventory and notifies them. The dialog warns you before it happens.

> **Important, and worth knowing before you test:** the app's rejection confirmation only mentions
> *shadow inventory*. Whether the **ledger** reversal (Inventory back up, Goods in Transit back down)
> also fires is exactly what this step is checking. This is the single most likely place in the
> warehouse flow for value to leak, so record your numbers carefully.

### Do this
1. Create a delivery for `Ahmed Store`: **5 × 5L Cooking Oil**. Assign to **Saim Raza**.
2. **Write down** Inventory, Goods in Transit and on-hand Oil right now.
3. As the rider: advance to `arrived`, capture the signed bill, mark it **NOT PAID**, submit.
4. As admin: open the Inventory Approval Queue → **Reject** (give a reason).
5. Re-check the same three numbers.

### Expected result

| Step | Journal entry |
|---|---|
| Assign | `Dr Goods in Transit 4,000` / `Cr Inventory 4,000` *(5 × 800)* |
| Reject | `Dr Inventory 4,000` / `Cr Goods in Transit 4,000` |

**Net effect of the whole step: zero.** On-hand Oil `80 → 75 → 80`. No Sales. No COGS. P&L untouched.

### Where it shows up
- Inventory tab: Oil back to `80`
- Reports → Inventory Valuation: back to its pre-step total
- Reports → Balance Sheet: Goods in Transit back to zero for this delivery
- Reports → P&L: **completely unchanged by this step**
- Approval queue → **Rejected** filter: the request, with your reason and reviewer stamp
- Delivery Management → Approvals tab: the delivery appears in the failed/returned list

### 🚩 Red flags
- **Goods in Transit still holding 4,000 after rejection** — value stranded, balance sheet wrong
- Inventory not restored (stock silently destroyed)
- **Any** Sales or COGS from a rejected delivery
- The rejection succeeding on screen but not surviving a pull-to-refresh

---

## C7 — Controls: idempotency, reversal, over-allocation

### Concept
Financial software is judged as much on what it *refuses* to do as on what it does. Four controls
matter here:

- **Idempotency** — approving twice must not post twice. Networks retry; users double-tap. If each
  attempt posts, revenue inflates silently and the error is nearly impossible to find later.
- **Reversal, not deletion** — a mistaken approval must be *undone by an offsetting entry*, never by
  erasing the original. The audit trail has to survive corrections.
- **Stock cannot go negative** — you cannot dispatch what you do not have.
- **In-flight protection** — a slow network must not turn one action into three.

### How FinMatrix does it
The delivery status and photo endpoints are built to be replay-safe (the client retries only on true
network failures, and a replayed submission is answered with a conflict rather than being applied
twice). The approval queue offers **Undo Approval** on approved rows, which returns the request to
Pending for re-review. The queue also blocks actions on requests that haven't finished syncing, with
a *"Please refresh"* message.

### Do this

**7a. Double approval.** Reopen the C4 delivery (already approved) and try to approve it again.
→ Must be impossible, or refused. **It must never post a second set of entries.** Verify by comparing
Sales/COGS before and after the attempt.

**7b. Undo Approval.** On an approved row, tap **Undo Approval**. Confirm the dialog explains that
inventory is restored and the request returns to Pending. Then check that:
- the ledger effects reverse (or an offsetting entry appears — either is acceptable, silent deletion
  is not)
- the request is back in **Pending** and can be approved or rejected again
- re-approving posts the sale exactly **once** more, not twice

**7c. Over-allocation.** Try to create and assign a delivery for **90 units of Cooking Oil** when only
80 are on hand. → Must be **rejected with a clear "insufficient stock" message**. Inventory must not
go negative and no entry may post.

> Note: the Create Delivery item dropdown shows live stock (`5L Cooking Oil · stock 80`) but does not
> itself block an over-quantity. The real guard is server-side at assignment. Test it by *assigning*,
> not just by creating.

**7d. Double-tap and flaky network.** On the rider app, enable airplane mode mid-action, then restore
it. The status must end up advanced **exactly one step**, with either a success or a clear retry
prompt — never a silent loss and never a double advance.

### 🚩 Red flags
- A second approval producing a second invoice or a second set of journal lines
- Undo deleting the original entry rather than reversing it
- Negative on-hand quantity anywhere, ever
- Over-allocation succeeding
- A status jumping two steps after a retry

---

## C8 — Credit memo: a customer return **after** the sale

### Concept
C6 handled a return *before* any sale existed — just unwind the dispatch. This is the harder case:
the sale is already invoiced and in your P&L, and the customer sends goods back.

You must **never edit or delete the original invoice.** Instead you issue a **credit memo**: a
separate, linked document that posts the mirror image of the original sale for the returned portion
only. The invoice stays on record; the credit memo offsets it. That's what keeps the audit trail
intact — anyone can later see both what was sold and what came back.

A goods return has **two halves**, and forgetting either is a classic bug:
1. **Revenue side** — reverse the sale value (and any tax charged on it)
2. **Cost side** — the goods physically return, so Inventory goes back up and COGS comes back down

### How FinMatrix does it
Transactions → **Credit Memos** → New, referencing the original invoice.

> ⚠️ **This module has never been exercised in production** (see
> [ACCOUNTING_QA_GUIDE.md](ACCOUNTING_QA_GUIDE.md) gap G3 — credit memos, vendor credits, inventory
> adjustments and tax payments all have zero rows). Test it carefully and expect to find defects.
> Corrections mechanisms that don't work are worse than missing features, because they fail exactly
> when someone is trying to fix a mistake.

### Do this
Ahmed Store returns **5 of the 20 units** from the C4 delivery (a partial return).

Transactions → Credit Memos → New → customer `Ahmed Store`, referencing the C4 invoice:

| Line | Item | Qty returned | Price | Total |
|---|---|---|---|---|
| 1 | 5L Cooking Oil | 5 | 1,000 | 5,000 |

Number it `CM-001`. Match the tax treatment of the original invoice (if the sale had no GST, keep this
untaxed).

**Settlement — pick ONE and note which:**
- **(A) Leave it as a credit on the customer's account** ← *use this one to keep the Part D
  reconciliation numbers valid*
- (B) Refund it in cash — then also expect `Dr Accounts Receivable 5,000 / Cr Cash 5,000` and adjust
  the Part D table by 5,000 on Cash and A/R

### Expected result

```
Revenue reversal:   Dr Sales 5,000        Cr Accounts Receivable 5,000   (+ Dr Tax if the sale was taxed)
Cost reversal:      Dr Inventory 4,000    Cr COGS 4,000                  (5 × 800 cost, back on the shelf)
```

**Deltas from this step:** Sales **−5,000** · COGS **−4,000** · Inventory **+4,000** · A/R **−5,000**
(a credit balance for the customer) · gross profit **−1,000** — exactly the profit that was on the
returned units.

### Where it shows up
- Inventory tab: Oil `80 → 85`
- Reports → Inventory Valuation: **+4,000**
- Reports → P&L: Sales down 5,000, COGS down 4,000
- Customer detail / A/R Aging: Ahmed Store shows a **5,000 credit** (they owe nothing and hold credit)
- Transactions → Invoices: the original C4 invoice **still there, unmodified**, now linked to CM-001
- Transactions → Credit Memos: CM-001 listed

### 🚩 Red flags
- The original invoice being **edited or deleted** instead of offset
- **Inventory not restocked** — a goods return that doesn't restock means you sold stock you still own
- COGS not reversed (gross profit stays overstated)
- Tax not reversed proportionally when the original sale was taxed — very common bug
- A full reversal for a partial return (5,000 returned reversing the whole 20,000)
- Trial Balance no longer balancing

---

## C9 — Vendor credit: returning stock **to** a supplier

### Concept
The mirror image of C8, on the buying side. You already received and billed 100 units. You send 10
back (damaged, over-ordered). Two things must change: you owe the supplier less (**A/P down**), and
you hold less stock (**Inventory down**).

**There is no P&L impact.** Returning purchased stock is not income and not an expense — it never went
through your P&L in the first place. It just shrinks an asset and shrinks a liability. If a vendor
credit touches revenue or expense on a straight goods return, that's a bug.

### How FinMatrix does it
Transactions → **Vendor Credits** → New, referencing the original bill. Same G3 caveat as C8 — this
module is unproven; test it deliberately.

### Do this
Return **10 × 5L Cooking Oil** to `Metro Wholesale`:

| Line | Item | Qty returned | Unit cost | Total |
|---|---|---|---|---|
| 1 | 5L Cooking Oil | 10 | 800 | 8,000 |

Number it `VC-001`, referencing the bill from C2. The Metro bill is still unpaid, so the credit should
reduce the open bill.

### Expected result

```
Dr Accounts Payable 8,000    Cr Inventory 8,000
```

**Deltas:** Accounts Payable **−8,000** (now 132,000 owed) · Inventory **−8,000** · **no P&L movement**.

### Where it shows up
- Inventory tab: Oil `85 → 75`
- Reports → Inventory Valuation: **−8,000**
- Reports → A/P Aging: Metro Wholesale drops from 140,000 to **132,000**
- Transactions → Bills: the original bill **preserved**, now linked to VC-001
- Reports → P&L: **completely unchanged**

### 🚩 Red flags
- Any revenue or expense line moving
- A/P reduced but Inventory untouched (you'd be claiming free stock)
- Inventory reduced but A/P untouched (you'd be giving goods away)
- The original bill edited instead of offset

---

## C10 — Pre-paid delivery (optional variant)

### Concept
Sometimes the customer pays *before* dispatch. Then the sale is already settled at assignment time,
and the only thing left to recognise at approval is the **cost** — because the revenue and the cash
were booked up front.

### How FinMatrix does it
Tick **Pre-paid sale** on the Create Delivery form. The app tells you plainly:
*"because it is pre-paid, the invoice and cash payment are recorded immediately."* At approval, the
queue shows a **PRE-PAID** badge and the hint *"Posts COGS and relieves Goods in Transit (sale was
pre-paid)."*

### Do this
> Run this **after** you've completed the Part D reconciliation, or take a fresh snapshot first — it
> adds numbers outside the main script's totals.

Create a delivery for `Ahmed Store`: **2 × 10kg Flour Bag @ 1,600 = 3,200**, tick **Pre-paid sale**,
assign to any rider, complete it as the rider, approve it.

### Expected result

| Step | Journal entry |
|---|---|
| Assign | `Dr Goods in Transit 2,400` / `Cr Inventory 2,400` **plus** the invoice and its cash payment |
| Approve | `Dr COGS 2,400` / `Cr Goods in Transit 2,400` — **cost only, no revenue** |

### 🚩 Red flags
- **Revenue posting twice** (once at assignment, again at approval) — the single biggest risk in this
  variant
- The approval queue showing PAID instead of PRE-PAID
- No invoice created at assignment despite the confirmation text promising one

### The pre-paid partial return — worth understanding properly

A pre-paid delivery is invoiced for the **whole order** before the van leaves. So what happens if the
customer then refuses half of it? The cost side is easy — the goods come back and Goods in Transit
clears. The **revenue** side is the interesting part: you have already charged for goods the customer
never received.

FinMatrix answers this with a **credit memo** raised automatically at approval, for the undelivered
value at selling price. Run it: pre-paid delivery of **4 × 10kg Flour Bag @ 1,600**, rider delivers
**2** and returns **2**, approve it.

| Step | What posts |
|---|---|
| Assign | `Dr Goods in Transit 4,800` / `Cr Inventory 4,800` **plus** invoice 6,400 + tax, paid in cash |
| Approve | `Dr COGS 2,400` + `Dr Inventory 2,400` / `Cr Goods in Transit 4,800` |
| Approve | **plus a credit memo** for the 2 returned: `Dr Sales 3,200` `Dr Tax Payable` / `Cr A/R` |

**Net revenue recognised = 3,200 — exactly the 2 bags the customer kept.** The credit memo lands in
Transactions → Credit Memos as an **open** credit, which the customer can either apply to a future
invoice or take as a refund. It is not applied automatically, because deciding that is a commercial
call, not an accounting one.

> **Two things this deliberately does not do.** It does not restock the goods a second time — the
> delivery approval already did that, and a credit memo that also restocked would double your stock.
> And it does not raise a memo when the returned goods were **free** (a zero-priced sample): nothing
> was charged, so there is nothing to credit.

**🚩 Red flag:** revenue staying at the full order value after a pre-paid partial return. That is the
overstatement this mechanism exists to prevent — check the P&L, not just the delivery screen.

---

## C11 — Stock Adjustment — correcting the shelf

### Concept
Sometimes the shelf and the system disagree, and the shelf is right. Stock is damaged, stolen, found,
or was simply miscounted. An adjustment is how you tell the books the truth.

The key idea: **an adjustment is not a free edit.** Inventory is an asset, so changing the quantity
changes what the company is worth, and that difference has to land somewhere in the P&L. Writing 5
units off does not just reduce stock — it records a **5-unit expense**. If a system let you change a
quantity without an offsetting entry, the balance sheet would silently stop balancing.

### How FinMatrix does it
Inventory → Adjustment. You pick the item, enter the **new total quantity** (not the difference), and
choose a reason. The screen shows you the computed ±delta for sanity, but what it sends is the
absolute figure — the server works out the variance itself, which is what stops two people adjusting
the same item at once from compounding each other's deltas.

The variance is valued at the item's **weighted-average unit cost** and posted:

- **Decrease** → `Dr Inventory Adjustment / Shrinkage (6400)` / `Cr Inventory (1200)`
- **Increase** → `Dr Inventory (1200)` / `Cr Inventory Adjustment (6400)`

The six reasons map to codes the API accepts: Physical Count, Damage, Theft, Correction,
Obsolescence, Other. A seventh, *Reversal*, exists but is written only by the server when you reverse
an adjustment — you can't pick it, which is what stops a reversal being reversed forever.

### Do this
1. Note on-hand Oil and the Inventory Valuation total.
2. Inventory → Adjustment. Item **5L Cooking Oil**, new quantity **five fewer than current**, reason
   **Damage**, note "crushed in transit".
3. Save, then re-check on-hand and valuation.
4. Now run one **upward**: same item, five *more* than current, reason **Correction**.

### Expected result

| Step | Journal entry |
|---|---|
| Write-down 5 | `Dr Shrinkage 4,000` / `Cr Inventory 4,000` *(5 × 800)* |
| Write-up 5 | `Dr Inventory 4,000` / `Cr Shrinkage 4,000` |

**Net effect of both: zero.** That round trip is the cleanest proof the mechanism is symmetric.

### Where it shows up
- Inventory → item detail → movements: two new rows, typed `adjustment`, signed `-5` and `+5`
- Reports → Inventory Valuation: down 4,000, then back
- Reports → P&L: a Shrinkage expense appears, then nets to zero
- Reports → General Ledger: both entries, each balanced

### 🚩 Red flags
- **Entering an absolute quantity and getting a delta applied** — adjust 80 → 75 and land on 5, not
  75. This was a real bug: the app used to send the difference to an endpoint expecting the total.
- Stock changing with **no** journal entry — the balance sheet is now wrong
- A zero-variance adjustment posting an entry (it shouldn't — there is nothing to record)
- The reason dropdown being empty, or a saved adjustment showing a journal entry ID that opens nothing

---

## C12 — Physical Count — reconciling the whole shelf at once

### Concept
An adjustment fixes one item. A **physical count** is the periodic discipline of counting everything
and reconciling it in one go — the stocktake. The output is not "the system now says what I counted";
it is a **variance report** plus the adjustments that explain it. The discrepancy is the valuable
part, because it is the only evidence you have of shrinkage.

### How FinMatrix does it
Inventory → Physical Count, a three-step wizard: choose a scope (all items, or by category/location),
enter counted quantities, then review variances before committing.

Committing sends the **whole count as one request**. The server records a count header and a line per
item, raises an adjustment only where the variance is non-zero, and posts each journal entry — all in
a single transaction. That atomicity matters: an earlier version looped one call per line, so a
failure halfway through left the count half-applied with no way back.

### Do this
1. Inventory → Physical Count → scope **All Items** → Next.
2. Enter counted quantities. Make **two** of them disagree with the system, leave the rest matching.
3. Review: only your two should show as variances.
4. **Adjust All**, then check the item movements and the P&L.

### Expected result
- One adjustment per **varying** line; matching lines record a count line but post nothing
- Each variance valued at that item's unit cost and posted like C11
- On-hand for every counted item now equals what you typed

### Where it shows up
- Item detail → movements: an `adjustment` row per variance, sourced to the count
- Reports → Inventory Valuation: moved by the net variance value
- Reports → P&L: the net shrinkage or gain

### 🚩 Red flags
- **Quantities changing with no adjustment and no journal entry** — a silent overwrite, which defeats
  the entire purpose of counting
- Matching lines generating adjustments (noise that hides real shrinkage)
- A failure partway leaving some items adjusted and others not

---

## C13 — Partial delivery — when the customer takes some

### Concept
C4 is all-or-nothing and C6 is nothing-at-all. Real deliveries land in between: the customer takes 8
of 10 and sends 2 back on the van. Both outcomes have to be recorded from **one** proof of delivery,
because there is only one visit.

The accounting has to split cleanly: you sold 8, so 8 units of revenue and 8 units of COGS; the other
2 never sold, so they go back on the shelf at cost and never touch the P&L.

### How FinMatrix does it
On the rider's bill-capture screen, each line now carries a **returned quantity** box. The rider types
what came back; delivered is the remainder, shown live on the line. The entry is bounded by what was
dispatched — you cannot return 3 of 2 — and Submit stays disabled until every line is valid.

The rider sends **quantities only, never a status**. The outcome is the admin's: approving means the
delivered part sold, rejecting reverses the whole dispatch. This is deliberate — a rider marking a
delivery "returned" on the handset while the server disagreed would be a lie the books then inherit.

At approval the server splits each line, invoices only the delivered part, restocks the remainder and
relieves Goods in Transit **in full** across both.

### Do this
1. Create a delivery for `Ahmed Store`: **10 × 5L Cooking Oil**. Assign to **Saim Raza**.
2. Note Inventory, Goods in Transit, A/R and on-hand Oil.
3. As the rider: advance to `arrived`, capture the bill, and in **Delivered quantities** enter
   **2** returned on the Oil line. Confirm the line reads *"10 dispatched · delivering 8"*.
4. Mark **NOT PAID**, submit.
5. As admin: open the Inventory Approval Queue. **The Returned column must read 2** — not 0.
6. Approve, then re-check every number.

### Expected result

| Step | Journal entry |
|---|---|
| Assign | `Dr Goods in Transit 8,000` / `Cr Inventory 8,000` *(10 × 800)* |
| Approve | `Dr A/R 8,000+tax` / `Cr Sales 8,000` *(8 × 1,000 — delivered only)* |
| Approve | `Dr COGS 6,400` + `Dr Inventory 1,600` / `Cr Goods in Transit 8,000` |

On-hand Oil: `80 → 70 → 72`. Goods in Transit nets to **zero**. Revenue reflects **8**, not 10.

### Where it shows up
- Approval queue: Delivered 8, Returned 2, and the after-quantity arithmetic
- Item movements: a `-10` dispatch and a `+2` return, two separate rows
- Reports → P&L: revenue and COGS for 8 units only
- Reports → Inventory Valuation: net down 8 units, not 10

### 🚩 Red flags
- **The Returned column reading 0 when the rider typed 2** — the quantity never left the handset
- Revenue for all 10 (over-billing the customer for goods they refused)
- The 2 returned units not restocked, or restocked **twice** (check on-hand is 72, not 74)
- Goods in Transit left holding the value of the returned part

---

## C14 — Reassign and Cancel — and why persistence is the whole test

### Concept
Two admin actions on a delivery in flight: hand it to a different rider, or call it off. Cancelling is
the one with teeth — a cancelled delivery is stock sitting on a van that must come back to the shelf,
and its value must come out of Goods in Transit. A cancel that only changes a label leaves that value
stranded on the balance sheet forever.

`cancelled` and `failed` are **different terminal states**. Failed means the delivery was attempted
and didn't work; cancelled means it was called off deliberately. They route differently in the admin
queues, so recording one as the other quietly corrupts your operational reporting.

### How FinMatrix does it
Admin → Delivery Management → open a delivery → **Re-assign** or **Cancel** in the bottom bar.

Reassign posts to the assign endpoint, which swaps the rider without re-committing stock (the goods
were already dispatched) and notifies the new rider. Cancel sets status `cancelled`, records your
reason, and triggers the restock and ledger reversal server-side.

Both are gated on the delivery not already being finished — you cannot reassign a delivered one.

### Do this
1. Create and assign a delivery: **3 × 10kg Flour Bag** to **Saim Raza**. Note Inventory, Goods in
   Transit and on-hand Flour.
2. Open it → **Re-assign** → pick **Haseeb Ali** → confirm.
3. **Pull to refresh.** The new rider must still be there. *This is the actual test.*
4. Now **Cancel** it, confirm, and re-check the three numbers.

### Expected result

| Step | Journal entry |
|---|---|
| Assign | `Dr Goods in Transit 3,600` / `Cr Inventory 3,600` *(3 × 1,200)* |
| Reassign | **none** — the goods didn't move, only who is carrying them |
| Cancel | `Dr Inventory 3,600` / `Cr Goods in Transit 3,600` + stock restored |

Status reads **Cancelled**, not Failed. On-hand Flour returns to its pre-assign figure.

### Where it shows up
- Delivery detail: the new rider, and afterwards a **Cancelled** badge with your reason
- Item movements: a `return` row for the restock
- Reports → Balance Sheet: Goods in Transit back to zero for this delivery
- Delivery Monitor: the delivery under Cancelled — **not** in the Approvals list, which is for
  failed and returned

### 🚩 Red flags
- **The change vanishing on pull-to-refresh** — the classic symptom of a UI-only action that never
  reached the server. Always refresh before believing a success message.
- Cancel producing status **failed** instead of cancelled
- Stock not restored, or Goods in Transit still holding value after cancelling
- A success alert appearing when the server actually refused — try cancelling an already-delivered
  delivery: you should get a real error, not a green message

---

---

## C-steps — what already proves each one

Every 🚩 red flag in Part C is a **condition that would indicate a bug**, not a bug that exists.
Most are asserted automatically by the acceptance suites, which is why you can treat a
disagreement between this guide and what you see on screen as a real finding worth reporting.

Run a suite with `npm run test:<name>` from the backend repo. **Space them ~60s apart** —
`/auth/signin` is throttled at 5 per minute, and suites run back-to-back fail on `429` rather
than on merit. That is a harness trap, not a product defect; it cost me a full misdiagnosis.

| Step | Proven by | Key assertions |
|---|---|---|
| C1 master data | *manual* | Non-posting; Trial Balance unchanged |
| C2 purchase cycle | `chunk2` | PO posts nothing; receipt `Dr Inventory / Cr GRNI`; bill `Dr GRNI / Cr A/P`; **GRNI returns to zero** |
| C3 riders | `chunk1`, `tiering` | Status machine; rider plan limit |
| C4 cash sale | `delivery-ledger` | **No revenue at assignment**; rider POD posts nothing; approval posts revenue + COGS; GIT → 0 |
| C5 credit sale | `delivery-ledger` | A/R carries the invoice; later payment moves Bank/A/R with **no P&L change** |
| C6 rejection | `delivery-ledger` | Reversal + restock, sales order cancelled, **no revenue either way** |
| C7 controls | `delivery-ledger`, `voids` | Double-approve → 409; undo reverses rather than deletes; stock never negative |
| C8 credit memo | `corrections`, `voids` | Restock, COGS + tax reversed, original invoice intact |
| C9 vendor credit | `corrections` | A/P and Inventory both move; no P&L impact |
| C10 pre-paid | `delivery-ledger` | Invoice + payment at dispatch; approval posts **COGS only** |
| C1 opening stock | *manual* | `Dr Inventory / Cr Opening Balance Equity 3900`; P&L unmoved; refused a second time |
| C11 stock adjustment | `voids` + manual | Absolute quantity applied; balanced shrinkage entry; reversal symmetric |
| C12 physical count | *manual* | Only varying lines adjust; atomic commit |
| C13 partial delivery | `delivery-ledger` | 2 of 4 returned → delivered part invoiced, remainder restocked, GIT → 0 |
| C14 reassign / cancel | *manual* | Persists across refresh; cancel restocks and reverses GIT |
| D invariants | `qa/run-qa.sh` | All 14 SQL invariants return zero rows |
| E security | `authgate`, `chunk1` | Rider 403s; tenancy; deactivated company blocked from business endpoints |
| F4 accounting core | `five-features`, `bankrec`, `period-close` | Chart of Accounts, Payroll, Budgets, Bank Reconciliation, closed-period refusal |

*manual* means there is no automated assertion yet — those are the steps where **your** testing
carries the most weight.

---

# Part D — Reports tie-out & reconciliation

## D1 — Report by report

Open each and confirm it reflects everything from Part C (steps C1–C9, excluding the optional C10).

| Report | Where | What must be true |
|---|---|---|
| **Trial Balance** | Reports → Trial Balance | Total debits = total credits, **to the rupee** |
| **Profit & Loss** | Reports → P&L | Sales +31,000 · COGS +24,000 · gross profit **+7,000** |
| **Balance Sheet** | Reports → Balance Sheet | Assets = Liabilities + Equity; the Inventory line equals the Inventory Valuation total |
| **Inventory Valuation** | Reports → Inventory Valuation | Total delta **+108,000**; matches on-hand × cost |
| **A/R Aging** | Reports → A/R Aging | Nothing owed by Ahmed Store; a **5,000 credit** if you chose settlement (A) in C8 |
| **A/P Aging** | Vendor detail / A/P | Metro Wholesale **132,000** (140,000 bill − 8,000 vendor credit) |
| **General Ledger** | Reports → General Ledger | Every entry above is present, dated, and traceable to its document |
| **Cash Flow** | Reports → Cash Flow | Cash +20,000 and Bank +16,000 appear as operating inflows |
| **Delivery Daily Report** | Reports → Delivery | The completed deliveries for today |
| **Delivery Performance** | Reports → Delivery | Per-rider completion stats |
| **Analytics Dashboard** | Reports → Analytics | Totals consistent with P&L and Balance Sheet |

## D2 — The reconciliation table

`Your Step 0 snapshot + this delta = the balance showing now.` Check every row.

| Account | Where it came from | Cumulative delta |
|---|---|---|
| **Inventory** | +140,000 (C2b receipt) −16,000 (C4b) −12,000 (C5a) −4,000 (C6 assign) +4,000 (C6 reject) +4,000 (C8 restock) −8,000 (C9 return) | **+108,000** |
| **GRNI** | +140,000 (C2b) −140,000 (C2c) | **0** |
| **Goods in Transit** | +16,000 −16,000 · +12,000 −12,000 · +4,000 −4,000 | **0** |
| **Accounts Payable** | +140,000 (C2c) −8,000 (C9) | **+132,000** |
| **Cash** | +20,000 (C4d) | **+20,000** |
| **Bank** | +16,000 (C5d) | **+16,000** |
| **Accounts Receivable** | +16,000 (C5c) −16,000 (C5d) −5,000 (C8) | **−5,000** *(customer credit)* |
| **Sales / Revenue** | +20,000 (C4d) +16,000 (C5c) −5,000 (C8) | **+31,000** |
| **COGS** | +16,000 (C4d) +12,000 (C5c) −4,000 (C8) | **+24,000** |

**On-hand quantities:**
- Oil = 100 − 20 (C4) − 5 (C6) + 5 (C6 reject) + 5 (C8) − 10 (C9) = **75**
- Flour = 50 − 10 (C5) = **40**

**Inventory value = 75 × 800 + 40 × 1,200 = 60,000 + 48,000 = 108,000.**

Three numbers must agree exactly:
1. the **Inventory delta** in the table above
2. the **Balance Sheet** Inventory line movement
3. the **Inventory Valuation** report total movement

**Proof that it balances:**
```
Assets Δ      = 108,000 (Inventory) + 20,000 (Cash) + 16,000 (Bank) − 5,000 (A/R) + 0 (GIT) = 139,000
Liabilities Δ = 132,000 (A/P) + 0 (GRNI)                                                    = 132,000
Equity Δ      = net income = 31,000 − 24,000                                                =   7,000
                                                             132,000 + 7,000                = 139,000 ✓
```

## D3 — The warehouse invariants

These five must hold **after every session**, forever. They are not "nice to have" — a failure in any
of them means the books are wrong.

| # | Invariant | Why it matters |
|---|---|---|
| **1** | Total debits = total credits, to the rupee | If this fails, nothing else is meaningful |
| **2** | Assets = Liabilities + Equity | The accounting equation. Non-negotiable |
| **3** | **GRNI = 0** after every completed purchase cycle | Proves goods were received and billed exactly once |
| **4** | **Goods in Transit = 0** for every finished delivery (approved *or* rejected) | Proves no stock value is stranded on a van |
| **5** | Inventory (ledger) = Inventory Valuation report = on-hand × cost | Proves the stock subledger and the ledger agree |

Plus the operational ones:
- Inventory quantity is **never negative**
- Revenue is **never** recognised before delivery **and** approval
- No document is ever edited or deleted — only offset

---

# Part E — Security & permissions

## E1 — What a rider must never be able to do

Log in as `rider1@warehouseco.com` and verify **all** of these:

| Check | Expected |
|---|---|
| Deliveries visible | **Only their own.** Rider 2's deliveries must be invisible |
| Accounting screens | Not present in navigation at all — no Transactions tab, no Reports tab, no More tab |
| Inventory tab | Shows only **their van stock** (shadow inventory), not the warehouse's full inventory |
| Approvals | Not reachable. A rider must never approve their own delivery |
| Direct API call to an accounting endpoint | **403** — not a 200, not an empty list, not a crash |
| Posting to the ledger | Impossible through every path |

**How to test the API directly:** grab the rider's auth token from the session and call an admin
endpoint (`GET /reports/trial-balance`, `GET /inventory/items`, `PATCH /inventory-approvals/:id/review`).
Every one must return **403 Forbidden**. A 200 with an empty body is a *failure*, not a pass — it means
the guard isn't there, only the data happened to be empty.

## E2 — Tenancy

Warehouse Co must never see another company's data. Check:
- Customer, vendor, item and delivery lists contain only Warehouse Co records
- Global Search returns nothing from other companies
- Direct fetch of another company's document id returns 403/404, not the document

## E3 — Plan limits

Only **active delivery personnel** is metered (2 / 5 / 10 by plan). Confirmed enforcement point:
creating a rider beyond the allowance is rejected with a message naming the plan and its limit.
Everything else — customers, vendors, employees, invoices, items, deliveries — is unlimited by design.

---

# Part F — Everything else in the app

The warehouse build ships the complete accounting system alongside the warehouse features. Test these
the same way: do the action, then check the ledger.

## F1 — Inventory tools

| Feature | Where | Concept & expected effect |
|---|---|---|
| **Item list & filters** | Inventory tab | Filter by in stock / low stock / out of stock; low-stock flag driven by Reorder Point. Non-posting |
| **Item detail & movements** | Inventory → tap an item | Full movement history — every receipt, dispatch, return. Each row should trace to a document |
| **Stock Adjustment** | Inventory → Adjustment | Write-down: `Dr Shrinkage/Loss Expense / Cr Inventory`. Write-up reverses it. Full walkthrough: **[C11](#c11--stock-adjustment--correcting-the-shelf)** |
| **Physical Count** | Inventory → Physical Count | Count the shelf, enter actuals; the variance **posts an adjustment**. It must never silently overwrite the quantity — the discrepancy is the point. Full walkthrough: **[C12](#c12--physical-count--reconciling-the-whole-shelf-at-once)** |
| **Stock Transfer** | Inventory → Stock Transfer | Moves quantity between locations. **No P&L impact** and no change to total inventory value — verify total valuation is identical before and after |
| **Cost method** | Item form → Cost Method | **Weighted average only** — FIFO/LIFO were removed from the form and the API rejects them, so the app can no longer offer a method it does not honour. Verify: buy 10@100 then 10@120, sell 1 → COGS **110**, not 100 (FIFO) or 120 (LIFO). Asserted by `corrections` |

## F2 — Warehouse agencies

More → **Warehouse Agencies**. Agencies are secondary stock locations with their own inventory and a
sync flow (Agency Detail → Inventory Sync). Items can be tagged to an agency on the item form
(*Warehouse / Agency* field). Test: create an agency, tag an item to it, run a sync, confirm quantities
reconcile and that syncing **does not** create or destroy value.

## F3 — Sales orders & estimates

| Feature | Concept | Expected |
|---|---|---|
| **Estimates** | A quote. Not a commitment by either party | **Non-posting.** Convert to Invoice or Sales Order |
| **Sales Orders** | A confirmed order, not yet fulfilled | **Non-posting.** Created automatically when you assign a delivery; also creatable directly. Converts to an invoice on fulfilment |

Key check: neither ever touches the ledger on its own. Revenue appears only when an **invoice** exists.

## F4 — The accounting core

| Feature | Where | Expected journal entry |
|---|---|---|
| **Invoice** (service or goods) | Transactions → Invoices | `Dr A/R / Cr Sales (+ Cr Tax Payable)`; for stocked goods also `Dr COGS / Cr Inventory` |
| **Receive Payment** | Transactions → Receive Payments | `Dr Bank/Cash / Cr A/R`. **P&L must not move** |
| **Bill** | Transactions → Bills | `Dr Expense or Inventory / Cr A/P (+ Dr Recoverable Tax)` |
| **Pay Bills** | Transactions → Pay Bills | `Dr A/P / Cr Bank`. **P&L must not move** |
| **General Journal** | Transactions → General Journal | Manual double-entry. Must **reject** an unbalanced entry, require ≥2 lines, and refuse a line with both a debit and a credit |
| **Chart of Accounts** | More → Chart of Accounts | Create/edit accounts. An account with activity must not be deletable |
| **Tax** | More → Tax Management | Rates, liability report, tax payments. Tax collected on sales accumulates as a liability; paying it `Dr Tax Payable / Cr Bank` |
| **Bank Reconciliation** | More → Bank Reconciliation | Match ledger lines to a statement. Reconciling is **non-posting** — it marks lines cleared. Unreconciled difference must reach zero |
| **Payroll** | More → Employees & Payroll | Gross pay to expense, deductions to liabilities, net pay to Bank. Verify gross = net + deductions |
| **Budgets** | Reports → Budgets | Budget vs actual. **Non-posting** — a reporting overlay only |
| **Period close** | Settings | Locks the books to a date; postings before it must be **refused**. ⚠️ Never exercised in production — test deliberately |

## F5 — Dashboards, search, settings

| Feature | What to check |
|---|---|
| **Admin Dashboard** | KPI cards and charts agree with the reports they summarise. A dashboard that disagrees with the P&L is a bug |
| **Global Search** | Finds invoices, customers, vendors, items, deliveries. Returns nothing from other companies |
| **Company Profile / Users** | Edits persist; team member roles are enforced |
| **Subscription** | Renew / change plan, payment submission → super-admin verification → status flows |
| **Delivery Monitor** | Stats (Total/Pending/Transit/Done/Failed/Tracking), filters (All/Pending/In Transit/Delivered/Failed/Returned), sort (Time/Status/Priority), map with rider locations |
| **Rider GPS** | With tracking enabled, the rider's position appears on the monitor map; location history is retrievable per delivery |

---

# Part G — Known gaps in this build

**Verified in the current code. Do not file these as new bugs — reference this section instead.**

## Fixed since the last revision ✅

The three UI gaps below are **closed**. They are kept here, briefly, because knowing what was wrong is
the fastest way to know what to check when you test the replacements — and because any older script or
screenshot you have will still describe the broken behaviour.

| Was | Now | Test it with |
|---|---|---|
| **Stock Adjustment couldn't be saved** — the reason dropdown was empty, so validation never passed | Six reasons, and the screen sends the **absolute** new quantity the API expects | [C11](#c11--stock-adjustment--correcting-the-shelf) |
| **Riders couldn't record returns or partial deliveries** — every line was hard-coded to fully delivered | A per-line returned-quantity box; the approval queue's Returned column reflects it | [C13](#c13--partial-delivery--when-the-customer-takes-some) |
| **Reassign and Cancel didn't persist** — local-only, and Cancel wrote `failed` | Both call the API; Cancel writes `cancelled` and triggers the restock and ledger reversal | [C14](#c14--reassign-and-cancel--and-why-persistence-is-the-whole-test) |

Two related fixes worth knowing about, because they change what you should expect to see:

- **Physical Count** now commits as a single atomic request instead of one call per line, so a failure
  can no longer leave a count half-applied ([C12](#c12--physical-count--reconciling-the-whole-shelf-at-once)).
- **Pre-paid partial returns** now raise a credit memo for the undelivered value. Before, revenue and
  tax stayed at 100% of the order while the goods came back — see
  [C10](#c10--pre-paid-delivery-optional-variant).

Also closed since the original audit: the ledger now has **database-level CHECK constraints** (not
just application checks), the **audit trail has a writer**, **period close** is implemented, and there
are **13 acceptance suites** covering accounting behaviour, plus a 14-invariant SQL gate
(`qa/invariants.sql`). The line in older docs saying "no automated test covers any accounting
behaviour" is out of date.

<details>
<summary>The original gap descriptions, for reference</summary>

### G1 — Stock Adjustment cannot be saved from the UI 🔴 — <strong>FIXED</strong>
The *Reason* dropdown on Inventory → Adjustment is populated from `ADJUSTMENT_REASONS`, which is an
**empty array** ([adjustmentModel.ts:17](src/models/adjustmentModel.ts#L17)), while the screen requires
a reason before saving ([AdjustmentScreen.tsx:79](src/screens/Inventory/Adjustment/AdjustmentScreen.tsx#L79)).
Result: the dropdown shows no options and **Save always fails validation**. Stock adjustments are
untestable through the UI until the reason list is restored.

*Related, worth verifying against the API:* the adjustment thunk posts a **delta** as a bare value
([inventoryListSlice.ts:145](src/screens/Inventory/InventoryList/inventoryListSlice.ts#L145)), while the
network layer also accepts a `{ newQuantity, reason, reference, notes }` object. Confirm which shape
the backend expects — if it wants an absolute `newQuantity`, sending a delta will set stock to the
wrong number.

### G2 — Riders cannot record returns or partial deliveries 🟠 — <strong>FIXED</strong>
The bill-capture screen submits `returnedQty: 0` hard-coded for every line
([BillPhotoCaptureScreen.tsx:202](src/screens/Delivery/Personnel/BillPhotoCapture/BillPhotoCaptureScreen.tsx#L202)),
and **no screen anywhere sets the `returned` status** — it exists only as a filter and a badge. So:
- a rider cannot say "the customer took 8 of 10"
- a rider cannot mark a delivery *Returned*

The approval queue's Returned column will therefore always read 0. **Test returns via
[C6](#c6--delivery-3--rejection-and-reversal) (admin rejection) instead.** Any older script telling
you to "mark it Returned as the rider" describes a flow that doesn't exist in this build.

### G3 — Admin Reassign and Cancel are local-only 🟠 — <strong>FIXED</strong>
On the Admin Delivery Detail screen, **Reassign** and **Cancel** are plain Redux reducers with **no API
call** ([deliverySlice.ts:282](src/screens/Delivery/Admin/AssignDeliveries/deliverySlice.ts#L282) and
[:307](src/screens/Delivery/Admin/AssignDeliveries/deliverySlice.ts#L307)). They update the screen and
show a success alert, but nothing is persisted — **pull to refresh and the change is gone.** Cancel
also sets status to `failed`, not `cancelled`. Don't trust either action, and don't chase the missing
ledger effect.

### G4 — Unproven correction modules 🔴
Per [ACCOUNTING_QA_GUIDE.md](ACCOUNTING_QA_GUIDE.md) (gap G3), **credit memos, vendor credits,
inventory adjustments and tax payments have never had a single production transaction.** The code
paths and ledger wiring exist but are entirely unexercised. Steps [C8](#c8--credit-memo-a-customer-return-after-the-sale)
and [C9](#c9--vendor-credit-returning-stock-to-a-supplier) may be the first real use — expect defects
and report anything you find in detail.

### G5 — Other documented gaps
From the same audit: no database-level `CHECK` constraints (balance is enforced in application code
only); the `audit_trail` table exists but has no writer; period close has never been run; and there is
no automated test covering any accounting behaviour. These are architectural and out of scope for
manual testing, but they explain **why manual verification of the ledger matters so much here** — the
app's own code is the only thing standing between you and an unbalanced database.

</details>

## Still open

### Correction paths are proven by tests, not by production use 🟠
Credit memos, vendor credits, inventory adjustments and tax payments now have acceptance coverage and
a reversal path for each, and the adjustment and credit-memo flows are exercised by the suites. But
the original audit point stands in a narrower form: **very little of this has been run by a real user
on real data.** [C8](#c8--credit-memo-a-customer-return-after-the-sale),
[C9](#c9--vendor-credit-returning-stock-to-a-supplier) and [C11](#c11--stock-adjustment--correcting-the-shelf)
may still be among the first genuine uses. Report anything you find in detail.

### A refund owed to a customer sits in Accounts Receivable 🟡
When a credit memo is raised for someone who already paid — a pre-paid partial return, for instance —
the credit lands as a negative balance in A/R rather than as a liability. That is standard behaviour
for small-business accounting packages and the books still balance, but on a formal balance sheet a
net credit in A/R belongs on the liability side. Worth knowing before you present statements to
anyone; not a blocker for testing.

### Returned and damaged goods are indistinguishable on a delivery 🟡
When a rider returns units, everything that wasn't delivered goes back on the shelf as good stock. If
the goods came back **damaged**, the books will say you still own sellable inventory that you don't.
The workaround is deliberate and correct: accept the return, then write the damage off with a Stock
Adjustment ([C11](#c11--stock-adjustment--correcting-the-shelf), reason **Damage**) so the loss is
recorded as shrinkage rather than hidden.

---

## Three traps in the test harness — read before running any suite

These are not product defects. They are ways the **acceptance suites themselves** will mislead or
damage you, all three found the hard way while verifying this build.

### 1. `auth-gate` points at PRODUCTION by default 🔴
`API_BASE` defaults to the live Heroku URL, and the suite **deactivates and reactivates a real
company** as part of its run. Always export `API_BASE=http://localhost:3000/api/v1` before running
it. Never run it without setting that.

### 2. `bankrec` runs unscoped UPDATEs 🔴
Before it does anything else it executes, with **no WHERE clause**:

```sql
UPDATE users     SET is_email_verified = true;
UPDATE companies SET status = 'approved';
```

That verifies **every** user and approves **every** company in whatever `DATABASE_URL` points at.
Only ever point it at a throwaway database. It also needs `npm run seed:demo` first, or it dies with
`acctList.map is not a function`.

### 3. The sign-in throttle makes back-to-back suites fail on nothing 🟠
`/auth/signin` is capped at **5 per minute**. Run suites in a tight loop and later ones fail to log
in and report failures that have nothing to do with the code — in one run, 38 sign-ins returned
`429`. **Space suites ~60 seconds apart** and treat any unexplained cluster of failures as suspect
until you have re-run the suite in isolation.

### 4. `chunk1` permanently breaks invariant I13 on whatever database it touches 🔴
It stocks its test item with raw SQL, straight past the API and therefore past the ledger:

```ts
await pg.query(`UPDATE inventory_items SET quantity_on_hand = 50 WHERE id = $1`, [itemId]);
```

That is 50 × 100 = **5,000 of inventory value with no journal entry** — precisely the shortcut
[C1](#c1--master-data-items-customer-vendor) warns you never to take. The company it creates
then fails I13 **forever**, so `qa/run-qa.sh` reads red afterwards and looks like an accounting
bug when the books are fine.

If the gate fails after a battery run, check *which* company drifted before chasing it. Scope
I13 to exclude the suite's throwaway companies and it comes back clean — that is the difference
between a real defect and test residue. `bankrec` has a milder version of the same problem: it
is **not re-runnable** against a database it has already reconciled (its "beginning balance
starts at 0" precondition is false the second time), which is why it scores 41/41 on a clean
database and 32/9 on a dirty one.

Also worth knowing: the suites do **not** all print the same summary. Most use
`=== N passed, M failed ===`, but `auth-gate` prints a bare `N passed, M failed` and `bankrec`
prints `✓ ALL PASS: N passed, M failed`. A results script grepping only for `===` will silently
report nothing for those two and look like they never ran.

### And one suite that no longer describes this build
`tiering` asserts a three-tier plan catalogue — `warehouse_3mo`, `small_business_6mo` and so on.
This build ships **warehouse-only** with a redesigned catalogue (`starter` / `growth` / `scale`,
each 6-month and 1-year), and the other two tiers have no plans at all. Its 17 failures are that
mismatch, not defects. Treat `tiering` as out of scope until the tier model returns.

---

# Part H — Bug reporting & sign-off

## H1 — Bug template

```
TITLE:        [Module] Short description of the wrong behaviour

LOGIN:        warehouse@gmail.com  /  rider1@warehouseco.com
STEP:         Guide step (e.g. C4d — approving a PAID delivery)
DEVICE:       Android / iOS / Web, app version

WHAT I DID:   1. …
              2. …
              3. …

EXPECTED:     Dr COGS 16,000 / Cr Goods in Transit 16,000
ACTUAL:       Dr COGS 20,000 / Cr Goods in Transit 20,000  (costed at selling price)

LEDGER EVIDENCE
  Before:  Inventory 140,000 · GIT 16,000 · COGS 0
  After:   Inventory 140,000 · GIT 0      · COGS 20,000
  Trial Balance: debits 1,234,567 vs credits 1,234,567 (balanced / UNBALANCED)

SCREENSHOT:   Trial Balance + the report showing the wrong number
```

**Always include the ledger evidence.** "The approval screen looked wrong" is a UI report. "COGS
posted at 20,000 instead of 16,000 and here is the Trial Balance" is an accounting bug report, and it
is the kind that gets fixed.

## H2 — Sign-off checklist

The warehouse build is signed off when every line is ticked:

- [ ] **Step 0 snapshot** taken and the Trial Balance balanced **before** testing
- [ ] C1 — master data creates **zero** ledger movement
- [ ] C2 — PO posts nothing; receipt posts `Dr Inventory / Cr GRNI`; bill posts `Dr GRNI / Cr A/P`; **GRNI = 0**; Inventory did **not** move twice
- [ ] C2 variant — partial receipt behaves correctly across two receipts
- [ ] C3 — rider created; plan limit enforced with a clear message; deactivation frees a slot
- [ ] C4 — dispatch moves cost to Goods in Transit with **no revenue**; rider actions post **nothing**; approval posts revenue **and** COGS; **GIT = 0**
- [ ] C5 — credit sale lands in A/R; later payment moves Bank/A/R with **no P&L change**
- [ ] C6 — rejection restores Inventory, clears Goods in Transit, and creates **no** Sales or COGS
- [ ] C7 — double approval cannot double-post; Undo reverses rather than deletes; over-allocation rejected; stock never negative
- [ ] C8 — credit memo posts the mirror of the sale, **restocks inventory**, reverses COGS and tax, and leaves the original invoice intact
- [ ] C9 — vendor credit reduces A/P **and** Inventory with **no P&L impact**; original bill intact
- [ ] C10 — pre-paid books revenue **once** (at assignment, not again at approval); a pre-paid partial return raises a credit memo so net revenue equals what was actually delivered
- [ ] C11 — adjustment lands on the **absolute** quantity entered, posts a balanced shrinkage entry, and a write-down + write-up round trip nets to zero
- [ ] C12 — physical count adjusts **only** varying lines, posts an entry for each, and never silently overwrites a quantity
- [ ] C13 — rider records 8 of 10; the approval queue's **Returned column shows 2**; revenue covers 8 only; the 2 restock exactly once
- [ ] C14 — reassign **survives a pull-to-refresh**; cancel yields status `cancelled` (not failed), restores stock and clears Goods in Transit
- [ ] D1 — every report reconciles
- [ ] D2 — every account matches `snapshot + delta`; Inventory = Valuation = 108,000 delta
- [ ] D3 — all five invariants hold
- [ ] E — riders see only their own deliveries; every accounting endpoint returns **403**; tenancy holds
- [ ] Known gaps in Part G confirmed as still-known (not silently worsened)

---

## Appendix — quick reference

**The four numbers that catch almost every warehouse bug:**

| Number | Must be | If it isn't |
|---|---|---|
| Trial Balance debits − credits | **0** | Stop everything. The ledger is broken |
| GRNI after a complete purchase cycle | **0** | Goods received twice, billed twice, or never billed |
| Goods in Transit for a finished delivery | **0** | Stock value stranded on a van |
| Inventory ledger − Inventory Valuation report | **0** | The stock subledger and the ledger disagree |

**The three things that must never happen:**
1. Revenue recognised before delivery **and** approval
2. A rider posting anything to the ledger
3. Any document edited or deleted instead of offset by a correcting entry

---

*Related documents:* [ACCOUNTING_QA_GUIDE.md](ACCOUNTING_QA_GUIDE.md) (ledger audit, SQL invariants,
feature-by-feature accounting protocol) · [APP_GUIDE.md](APP_GUIDE.md) (app overview)
