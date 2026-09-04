# AgriDirect AI

**"Multiple intermediaries reduce farmers' earnings and increase consumer prices."**

AgriDirect AI connects farmers/FPOs directly with consumers and bulk buyers,
with AI-powered demand forecasting, transparent pricing, supply aggregation,
and logistics optimization.

## The one rule everything else follows

**The marketplace only ever shows what a farmer or FPO actually entered.**
Quantities, prices, and earnings are never randomized, hard-coded, or
AI-generated. AI output (demand forecasts, price recommendations, simulated
routes) is always computed separately and labeled `AI Estimation` or
`Demo Simulation` in the UI — never merged into real listing data. This is
enforced in code (see `app/routers/listings.py`, `app/services/ai_service.py`)
and covered by tests (`backend/tests/test_core_flow.py`).

## Architecture

```
AgriDirect-AI/
├── backend/            FastAPI + SQLAlchemy + MySQL, JWT auth, REST API
│   ├── app/
│   │   ├── core/       config, security (JWT/bcrypt), role-based access deps
│   │   ├── db/         SQLAlchemy engine/session
│   │   ├── models/     ORM models (users, listings, orders, ML tables, ...)
│   │   ├── schemas/    Pydantic request/response models
│   │   ├── routers/    auth, listings, marketplace, orders, bulk, ai, dashboard, logistics
│   │   ├── services/   ai_service.py — forecast + price recommendation logic
│   │   └── logistics/  OR-Tools capacitated route/load optimizer
│   ├── scripts/        create_admin.py, seed_demo_data.py
│   └── tests/          pytest suite (in-memory SQLite, isolated from your real DB)
├── ml/
│   ├── preprocessing/  generate_synthetic_demand.py — labeled synthetic training data
│   ├── training/       train_demand_model.py — GradientBoostingRegressor + real metrics
│   ├── data/           generated CSVs (gitignored in practice)
│   └── models/         trained model + metrics JSON
└── frontend/            React + Vite + Tailwind, role-specific routes/pages
```

## Tech stack

- **Frontend:** React, Vite, Tailwind CSS, React Router, Axios, Recharts
- **Backend:** Python, FastAPI, SQLAlchemy, Pydantic, JWT (python-jose), passlib/bcrypt
- **Database:** MySQL (via SQLAlchemy + PyMySQL) — SQLite works too for quick local testing
- **ML:** pandas, numpy, scikit-learn (GradientBoostingRegressor)
- **Logistics:** Google OR-Tools (CP-SAT capacitated load consolidation)

## What's implemented vs. what's scaffolded

**Fully implemented and tested:**
- Role-specific registration/login (farmer, FPO, buyer, transporter; secure admin auto-provisioning, no public admin signup) with role-mismatch rejection
- Farmer/FPO listing CRUD — verified to save and return values unchanged
- Buyer marketplace with search/filter, real-DB-only results, proper empty states
- Cart → order flow with row-locked, transaction-safe inventory decrement and overselling prevention
- Transparent pricing breakdown (farmer price + logistics + platform fee, all server-computed)
- Bulk procurement with real greedy supplier matching and honest supply-gap reporting
- Demand forecasting ML pipeline (synthetic labeled training data → trained model → real held-out metrics)
- AI price recommendation (heuristic range based on comparable real listings + forecast signal), always shown separately from the actual farmer price
- OR-Tools logistics load-consolidation optimizer
- **Transport & live tracking (fully automatic)**: farmers, buyers, and transporters all register with real coordinates (GPS, place-name search via free OpenStreetMap Nominatim, or manual entry — no paid maps API). The moment a buyer places an order, transport requests are created and assigned automatically — no manual "request transport" step for farmers or buyers. An order is split into one transport request **per seller**, so if a buyer orders from two farmers far apart, each gets matched independently to whichever registered vehicle is actually closest (real Haversine distance, with best-fit-by-capacity as an honest fallback when location data isn't available). Transporters report live GPS location via the browser's Geolocation API; requesters track status and last-known location on an OpenStreetMap embed, auto-refreshing every 15s, with strict ownership checks. A shipment can't be marked Delivered until a real, distance-based estimated transit time has actually elapsed since it started (blocks marking something delivered the instant it starts). Manual transport booking (`POST /api/transport`) is reserved for FPO/admin bulk logistics not tied to a specific buyer order.
- **AI price recommendation is genuinely market-trained**: a second ML model (`ml/training/train_price_model.py`, same GradientBoostingRegressor approach as demand forecasting) predicts the current market rate for a product/location from historical price patterns — verified to ignore a farmer's own listed price entirely, even when that price is unrealistic, rather than just averaging the platform's own thin listing data.
- Farmer/buyer/FPO/admin dashboards computing real aggregates, ₹0 when empty
- Deterministic demo data seed script
- Admin account auto-provisioned on every backend startup from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars — no shell access needed (works on Render's free tier)

**Scaffolded / left as a clear next step for you to extend:**
- Notifications UI (backend `Notification` model + rows are created on order events; no bell/inbox component yet)
- AI Farmer Assistant chat interface (spec section 34) — the underlying data (listings, orders, earnings, forecasts) is all queryable via the existing endpoints; add a small router that takes a question, does simple intent matching, and calls those endpoints
- Admin-visible fleet-wide map (today, tracking is per-shipment; an admin view showing every active vehicle at once would reuse the same OSM embed pattern)
- Alembic migrations (currently uses `Base.metadata.create_all` on startup, fine for a hackathon, not for production schema evolution)

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set DATABASE_URL, SECRET_KEY, ADMIN_EMAIL/PASSWORD
```

**MySQL setup** (skip this and use the SQLite line in `.env.example` if you just want to try it locally):

```sql
CREATE DATABASE agridirect CHARACTER SET utf8mb4;
CREATE USER 'agridirect'@'localhost' IDENTIFIED BY 'agridirect';
GRANT ALL PRIVILEGES ON agridirect.* TO 'agridirect'@'localhost';
```

Create the admin account and (optionally) seed deterministic demo data:

```bash
python -m scripts.create_admin
python -m scripts.seed_demo_data     # optional — creates fixed demo farmer/FPO/buyer accounts + listings
```

Run the API:

```bash
uvicorn app.main:app --reload --port 8000
```

API docs at `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev
```

App at `http://localhost:5173`.

### 3. Train the ML demand model

```bash
cd ml
python preprocessing/generate_synthetic_demand.py   # writes labeled synthetic data to ml/data/
python training/train_demand_model.py                # trains model, prints real MAE/RMSE/R²
```

The API's `/api/ai/demand-prediction` endpoint automatically picks up the
trained model from `ml/models/demand_model.joblib`. If it hasn't been
trained yet, the endpoint returns `"Not enough historical data to generate
a forecast"` rather than fabricating a number.

### 4. Run backend tests

```bash
cd backend
pytest -q
```

Tests use an isolated in-memory SQLite database — they never touch your
real `DATABASE_URL`. They specifically verify: listing values pass through
unchanged, the marketplace is empty (not fake data) with no listings,
overselling is rejected, inventory decrements correctly on order, and
login rejects a role mismatch.

## Demo login credentials (after running `seed_demo_data.py`)

| Role   | Email                          | Password    |
|--------|---------------------------------|-------------|
| Farmer | ravi.farmer@example.com         | Farmer@123  |
| FPO    | southtn.fpo@example.com         | Fpo@12345   |
| Buyer  | spice.restaurant@example.com    | Buyer@123   |
| Admin  | (set via `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env`, then run `create_admin.py`) |

## API overview

See `http://localhost:8000/docs` for the full interactive spec. Key routes:

```
POST /api/auth/register/{farmer|fpo|buyer}
POST /api/auth/login

POST   /api/listings              (farmer/fpo)
GET    /api/listings/mine
PUT    /api/listings/{id}
DELETE /api/listings/{id}

GET  /api/marketplace             (search/filter, buyer-facing)
GET  /api/marketplace/{id}

POST /api/orders
GET  /api/orders/mine
PUT  /api/orders/{id}/status

POST /api/bulk-requirements

GET /api/ai/demand-prediction?product_name=...&location=...
GET /api/ai/price-recommendation/{listing_id}

POST /api/logistics/optimize?vehicle_capacity_kg=1000

GET /api/dashboard/{farmer|buyer|fpo|admin}

POST /api/auth/register/transporter
POST /api/transport                              (create a transport request; auto-assigns a vehicle)
GET  /api/transport/requests/mine                 (farmer/buyer/FPO — their own requests)
GET  /api/transport/requests/assigned              (transporter — requests assigned to their vehicle)
PUT  /api/transport/requests/{id}/status           (transporter — progress a shipment)
PUT  /api/transport/vehicle/location               (transporter — report live GPS)
GET  /api/transport/requests/{id}/track            (owner/assigned transporter/admin — status + location)
```

## Business model

Configurable via `.env`:
- `PLATFORM_FEE_PERCENT` — marketplace transaction fee (default 2%)
- `LOGISTICS_BASE_RATE_PER_KG` — logistics service margin input

Admin analytics compute actual GMV and revenue from real `Transaction` rows;
both are ₹0 until real orders exist.

## Known limitations / recommended next steps for a hackathon demo

1. Farmer order-management UI needs a `GET /api/orders/farmer` endpoint + accept/reject buttons (backend status-update endpoint already exists).
2. No image upload handling yet — `image_url` is a plain string field; wire to S3/local storage if needed.
3. Logistics optimizer uses load-based bin-packing (OR-Tools CP-SAT); true distance-based routing needs real lat/lon (OSRM integration point is `estimate_route_order` in `app/logistics/optimizer.py`).
4. No Alembic migrations — fine for a hackathon demo, add before any real production use.
5. Notification rows are created but there's no frontend inbox/bell yet.
