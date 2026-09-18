# FinMatrix — PRODUCTION_CHECKLIST.md

Operational checklist for running FinMatrix in production (FinMatrixGuide §6, §9).

## Deployment
- **Backend:** NestJS on Heroku app `finmatrix-api-prod` (Basic dyno, no sleep).
  Deploy = `git push heroku main` from `FinMatrix-Backend/FinMatrix-Backend`.
  Base URL `https://finmatrix-api-prod-665c6b5cb6a1.herokuapp.com/api/v1`.
- **DB:** Heroku Postgres (essential-0). `DATABASE_URL` auto-set.
- **Frontend:** Expo / React Native; `src/network/apiHelpers.ts` → the base URL.

## Migrations
- Versioned in `src/database/migrations`, auto-run on boot (`DB_MIGRATIONS_RUN=true`).
- All idempotent (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`).
- Phase 1–6 migrations: InvoiceLineItemId, CompanySetupCompleted, CompanyBooksLock,
  OptimisticLockVersions, IdempotencyRecords.

## Secrets & config (Heroku config vars — never in repo)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `DATABASE_URL`.
- `SMTP_*` (email), `GOOGLE_MAPS_API_KEY` (delivery geocoding).
- `CORS_ORIGINS`, `SWAGGER` (false in prod). `herokuapikey.md`/`.env*` are gitignored.

## Accounting integrity (verified)
- ✅ Atomicity — every document + JE + inventory move in one transaction.
- ✅ Money exact — Decimal.js, 4-dp strings; round-half-up; no floats.
- ✅ Double-entry — `PostingService` asserts debits = credits before posting.
- ✅ Reports ledger-derived — TB / Balance Sheet / P&L from `general_ledger`.
- ✅ Cross-report invariants — TB balanced; Assets = Liabilities + Equity.

## Hardening
- ✅ **Period locking** — `companies.books_locked_until`; postings on/before it rejected.
- ✅ **Idempotency** — `Idempotency-Key` header on POSTs; `idempotency_records` store.
- ✅ **Optimistic locking** — `@VersionColumn` on invoices & bills (no concurrent overpay).
- ✅ **Multi-tenant isolation** — every query scoped by `@CurrentCompany` (token-derived).
- ✅ **Role enforcement** — `RolesGuard` on all financial controllers; rider tokens 403.
- ✅ **Observability** — pino structured logging; `/health` readiness endpoint.
- ⬜ Audit-log surface for every mutation (partial; postings carry created/posted-by).
- ⬜ Sentry / error tracking wiring.
- ⬜ Automated DB backups (enable Heroku PG scheduled backups).

## Acceptance
- Run `npm run test:acceptance` (configurable `API_BASE`, `ADMIN_*`, `RIDER_*`).
- **Last run: 32/32 passed** against prod — opening balances, invoice COGS + stock,
  payment, void + restock, tax payment, idempotency, period lock, role enforcement,
  concurrent-payment no-overpay; TB + Balance Sheet balanced throughout.

## Demo data
- `npm run seed:metromatrix:ledger:prod` (via `heroku run`) rebuilds ~1 year of
  MetroMatrix activity **through the services** (so it posts to the ledger). Keeps the
  company, admin (`metromatrix@gmail.com`/`123456`) and riders; resets txn + master data.

## Maps / delivery (if used)
- Real dev/standalone build (not Expo Go) for background location.
- Google Maps SDK + Geocoding + Directions enabled with billing; restrict keys.
- Backfill existing deliveries: `POST /deliveries/geocode-pending`.

## Follow-ups (non-blocking)
- Credit-memo return-to-inventory (needs `itemId` on credit-memo lines).
- `RolesGuard` on operational controllers (deliveries/agencies/settings/etc.).
- Cash-flow & aging reports could move fully onto the GL (currently consistent sub-ledgers).
