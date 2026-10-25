# Cow Farm

Cow Farm is a web app for keeping the day-to-day records of a dairy farm in one place. It brings together the herd, milk production, purchases, breeding and health records, expenses, sales, and payroll, with reports for reviewing farm activity and finances.

The project has a Next.js frontend and a FastAPI backend. The backend uses SQLAlchemy and Alembic, and can connect to SQLite for local development or PostgreSQL for a shared deployment. The interface and defaults are set up for BDT (৳).

## What’s here

- **Today:** a daily overview and shortcuts for common entries.
- **Herd:** animal records, status, weights, housing, and history.
- **Purchases and breeding:** evaluate animals before buying, and track breeding attempts and pregnancy checks.
- **Health:** log care and treatment, with follow-up dates.
- **Milk and sales:** record milk, manage customers, create invoices, and track payments.
- **Expenses and payroll:** record farm spending, worker attendance, salary payments, and substitute costs.
- **Reports and masters:** review farm and financial summaries, and maintain shared lists such as suppliers, feed types, and warehouses.

## Run locally

You’ll need Python 3.10 or newer, Node.js, and npm. SQLite is the default database, so PostgreSQL is optional for a local run.

### Backend

From the repository root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend reads settings from a `.env` file at the repository root. With no database setting, it creates and uses `backend/cow_farm.db` when started from the `backend` directory. To use PostgreSQL, set `DATABASE_URL`, for example:

```env
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@localhost:5432/cowfarm
SECRET_KEY=replace-with-a-long-random-value
```

For PostgreSQL, apply the schema migrations from `backend/` before starting the app:

```bash
alembic upgrade head
```

SQLite tables are created automatically at startup. The API docs are at <http://localhost:8000/api/v1/docs>; the health endpoint is <http://localhost:8000/health>.

### Frontend

In another terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. `NEXT_PUBLIC_API_URL` in `frontend/.env.local` should point to the backend origin; the example file uses `http://localhost:8000`.

## Configuration notes

The backend’s local auth setup is intended for development. The settings also include Supabase credentials and JWT options for deployments that use Supabase authentication. Keep secrets in environment variables, and set the allowed frontend origins in `BACKEND_CORS_ORIGINS` when deploying the API.

Docker Compose is available for running the frontend and backend containers. It expects `DATABASE_URL` and `SECRET_KEY` in the environment; configure the frontend’s API URL to reach the backend from its runtime environment.

## Project layout

- `backend/app/api/v1/` — API routes
- `backend/app/models/`, `schemas/`, and `services/` — data models, API schemas, and business logic
- `backend/alembic/` — database migrations
- `frontend/src/app/` — application routes
- `frontend/src/components/` — shared UI and workspaces
- `Plans/` and `Documentation/` — project notes and reference material

## Live deployments

- [Web app](https://giggling-cows.vercel.app/today)
- [API documentation](https://cow-farm-cakg.onrender.com/api/v1/docs)

## License

MIT
