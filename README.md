# Sudan Marketplace

A production-focused, bilingual (Arabic-first) cash-on-delivery marketplace prototype tailored for Sudan. The stack is dependency-light (vanilla Node.js + browser-native web app) to respect limited connectivity while still modeling core marketplace operations, AI guardrails, and admin oversight.

## Key capabilities

- 🇸🇩 **Arabic default UI with English toggle**. All user-facing text lives in `/public/locales/{ar,en}.json` and the layout flips RTL/LTR automatically.
- 🛍️ **Listings life cycle** with AI-assisted creation (auto category suggestion, smart pricing range, quality checklist) and AI moderation to quarantine forbidden items.
- 💵 **Buy-now COD flow** that records escrow expectations, OTP-confirmed delivery, and dispute escalation. Ledger entries keep a clean audit trail.
- 🚚 **Promotional bumps** for single listings (5% fee, 72 h) and whole stores (USD-based 7‑day boost) with wallet deduction.
- 📊 **Seller center** to manage inventory, bump promotions, and watch AI tips.
- 📦 **Orders hub** for buyers & sellers with state machine controls, OTP confirmation, and dispute filing (photo evidence links).
- 👛 **Wallet** with manual top-up (proof upload link) and transparent ledger including COD expected settlements.
- 🛡️ **Admin/operations console** for reviewers (flag queue, disputes, GMV, COD lag, exchange-rate management).
- 🔔 **Notifications feed** capturing system events (order updates, promos, disputes).
- ⚙️ **Configurable economics** (`USD_SDG_RATE`, bump fees) editable via API/Admin UI.

## Project structure

```
server/
  index.js           # HTTP server & static file hosting
  routes.js          # REST API router
  data/              # JSON persistence (seed + runtime database)
  services/          # Domain logic (listings, orders, wallet, AI, admin)
public/
  index.html         # Responsive web client (hero, listings, dashboard views)
  styles.css         # RTL-aware styling & mobile FAB
  js/app.js          # Client-side SPA logic, i18n, API calls
  locales/           # Translations (ar/en)
README.md
package.json
```

The database is a single JSON document (`server/data/database.json`) written via helper utilities. Use `npm run seed` to reset to the curated seed state.

## Running locally

```
npm run seed   # optional: reset data to the curated seed
npm run dev    # starts HTTP server on http://localhost:3000
```

No external dependencies are required; Node.js ≥ 18 ships with everything used here.

## API overview

All endpoints live under `/api`. Supply `X-User-Id` header for authenticated actions.

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/config` | GET/PATCH | Read or update global configuration (`usdSdgRate`, fees, forbidden keywords). |
| `/api/users` | GET | List seeded users (includes role assignments and store profile). |
| `/api/listings` | GET/POST | Search/filter listings or publish a new listing (AI moderation + suggestions run server-side). |
| `/api/listings/{id}?action=buy` | POST | Create COD order (generates OTP, ledger entry). |
| `/api/listings/{id}?action=bump` | POST | Deduct bump fee and boost item for 72h. |
| `/api/orders` | GET | Orders for the acting user (`role=buyer` or `seller`). |
| `/api/orders/{id}/status` | POST | Progress order through state machine (OTP required for delivery). |
| `/api/orders/{id}/dispute` | POST | Open a dispute with reason + evidence links. |
| `/api/wallet` | GET | Wallet balance + ledger history. |
| `/api/wallet/topup` | POST | Record manual top-up request. |
| `/api/promotions/store` | POST | Whole-store bump (USD fee converted to SDG). |
| `/api/notifications` | GET | Notifications for the acting user. |
| `/api/admin/dashboard` | GET | Admin metrics + queues (requires ADMIN or REVIEWER role). |
| `/api/admin/disputes/{id}/resolve` | POST | Close dispute, optionally mark COD as cancelled. |
| `/api/ai/listing-suggestions` | POST | AI helper for pricing, category, moderation preview. |

See `server/services` for business logic, guardrails, and ledger handling.

## Seed data highlights

- **Users**: seller (`سارة عبدالله`), seller/buyer (`محمد خالد`), and multi-role admin (`نهى عثمان`).
- **Listings**: curated sample inventory plus one intentionally forbidden entry to validate moderation.
- **Orders**: One delivered (OTP settled) and one awaiting handover with an open dispute.
- **Ledger**: Bump deductions, COD expected credits, and manual top-up example.
- **Disputes & moderation queue** ready for admin workflows.

## Extending

- Plug in real AI services by replacing `services/aiModerationService.js` & `aiPricingService.js` logic.
- Swap JSON persistence with a proper database by re-implementing `utils/dataStore.js`.
- Integrate SMS for OTP delivery and courier webhooks where placeholders exist.

The goal is to demonstrate the full COD-first marketplace experience, optimized for Arabic-first audiences and Sudanese market realities, while remaining easy to reason about and extend.
