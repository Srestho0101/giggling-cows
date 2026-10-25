# Giggling Cows

Records for one dairy farm. The herd, the morning milk, buying decisions, health and breeding, feed, other expenses, workers, and invoices all sit in the same app. There is a page for the stuff you enter every day, and a profitability report for when you want to know if the month worked.

It is one farm on purpose. No second farm, no feed warehouse with stock levels, no payslip generator. Money is taka (৳). The shell can switch between English and Bangla, and it has a light/dark toggle.

The UI is a Next.js app. The API is FastAPI, with SQLAlchemy and Alembic. SQLite is enough to try it. PostgreSQL, including Supabase, is what you use when the data has to stay. Login, when you actually turn it on, is a Supabase JWT. Out of the box `DEBUG` is on, so the API treats you as a local admin and gets out of the way.

Running now:

- App: [giggling-cows.vercel.app](https://giggling-cows.vercel.app)
- API: [giggling-cows.onrender.com](https://giggling-cows.onrender.com) — docs at [`/api/v1/docs`](https://giggling-cows.onrender.com/api/v1/docs)

## Pages

- **Today** — herd snapshot plus the entries that happen daily: milk, attendance, an invoice, an expense.
- **Herd** — tag, breed, sex, status, weight, which shed the cow is in. Old tags and shed moves stay as history.
- **Purchases** — live weight against the market price per kg, before the animal is bought. A bought evaluation can be turned into a cow.
- **Breeding and health** — heat, AI or the farm bull, pregnancy checks, treatments, vaccines, next due date.
- **Milk and sales** — morning and evening yield, milking batches, customers, invoices, partial payments, voids. An animal line on an invoice marks that cow sold.
- **Expenses** — feed is what the herd ate that day, not stock on a shelf. Rope, vet, electricity, and the rest are ordinary expenses.
- **Payroll** — attendance, a salary you type in, substitute and mill charges. Nothing is calculated for you.
- **Reports** — dashboard, and a period profitability sheet with a CSV download.
- **Masters** — sheds, suppliers, feed types, expense categories.

Important records are soft-deleted and written to an audit trail instead of being removed.

## Run it on your machine

Python 3.11 or newer (the Docker image is 3.13) and Node 22.

### API

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

With no `DATABASE_URL`, the first start creates `backend/cow_farm.db` and builds the tables. Alembic is not required for SQLite.

- Docs: http://localhost:8000/api/v1/docs
- Health: http://localhost:8000/health

Demo data (a small herd, recent milk, invoices, workers) from `backend/` with the venv active:

```bash
python -m app.db.seed
```

Start the API once before seeding so the SQLite file exists. Running the seed again does nothing if cow `GC-001` is already there.

```bash
pytest
```

### UI

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

http://localhost:3000 redirects to `/today`. `frontend/.env.example` sets `NEXT_PUBLIC_API_URL` to `http://localhost:8000`.

Before pushing frontend changes: `npm run lint`, `npm run typecheck`, `npm run build`.

## Docker

Images on Docker Hub, tag `1.0`, linux/amd64:

- [srestho/giggling-cows-backend:1.0](https://hub.docker.com/r/srestho/giggling-cows-backend)
- [srestho/giggling-cows-frontend:1.0](https://hub.docker.com/r/srestho/giggling-cows-frontend)

On an Apple Silicon Mac, Docker Desktop will emulate them. They run, just slower.

The published frontend was built without `NEXT_PUBLIC_API_URL`, so the page calls `http://localhost:8000` from the browser. That is correct when you open the UI on the same computer that has port 8000 published. It is wrong from a phone, because that phone's localhost is the phone.

### Pull and run

```bash
docker pull srestho/giggling-cows-backend:1.0
docker pull srestho/giggling-cows-frontend:1.0

docker volume create giggling-cows-data

docker run -d --name giggling-cows-backend \
  --restart unless-stopped \
  -p 8000:8000 \
  -e DATABASE_URL=sqlite+aiosqlite:////data/cow_farm.db \
  -v giggling-cows-data:/data \
  srestho/giggling-cows-backend:1.0

docker run -d --name giggling-cows-frontend \
  --restart unless-stopped \
  -p 3000:3000 \
  srestho/giggling-cows-frontend:1.0
```

UI: http://localhost:3000
API docs: http://localhost:8000/api/v1/docs

The volume matters. Skip it and the SQLite file lives only inside the container.

Demo data in that container:

```bash
docker exec giggling-cows-backend python -m app.db.seed
```

Stop and remove, keeping the database:

```bash
docker rm -f giggling-cows-backend giggling-cows-frontend
# the volume giggling-cows-data is still there
```

### Postgres

The container does not migrate on startup, and it does not create tables when the URL is Postgres. Run Alembic yourself, then start the API with the same URL.

`postgres://` and `postgresql://` are rewritten to the asyncpg driver, so a normal Supabase string is fine.

```bash
docker run --rm \
  -e DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/cowfarm' \
  srestho/giggling-cows-backend:1.0 \
  alembic upgrade head

docker run -d --name giggling-cows-backend \
  --restart unless-stopped \
  -p 8000:8000 \
  -e DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/cowfarm' \
  -e DEBUG=false \
  -e SUPABASE_JWT_SECRET='the-same-secret-supabase-uses' \
  srestho/giggling-cows-backend:1.0
```

If the database host is not `localhost` or `127.0.0.1`, the client forces SSL. Supabase expects that. A Postgres container on the same Docker network usually does not speak TLS, and the hostname (`db`, `postgres`, …) is not localhost, so the connection fails. For a database next to the API, use the SQLite volume. Use Postgres when the server already wants SSL.

### A different API URL

`NEXT_PUBLIC_API_URL` is fixed when the frontend image is built. Passing it to `docker run` does nothing, and the Hub tag `1.0` will keep calling `http://localhost:8000`.

The Dockerfiles do not take a build arg for it. Next reads `frontend/.env.production` during `npm run build`, and that file is gitignored, so write it locally and then build:

```
NEXT_PUBLIC_API_URL=https://giggling-cows.onrender.com
```

```bash
docker build -t giggling-cows-frontend ./frontend
docker run -d --name giggling-cows-frontend -p 3000:3000 giggling-cows-frontend
```

Put the UI's real origin in `BACKEND_CORS_ORIGINS` on the API. The default list is localhost on ports 3000 and 8000, plus `https://giggling-cows.vercel.app`. Set the variable as a comma-separated string.

### Compose, from this repo

`docker-compose.yml` builds `backend/Dockerfile` and `frontend/Dockerfile`. It does not pull the Hub images.

It substitutes `DATABASE_URL` and `SECRET_KEY` from the environment or from a `.env` file next to the compose file. If `DATABASE_URL` is unset, Compose passes an empty string and the API will not start. `SECRET_KEY` is not read by anything in the backend. The compose file asks for it anyway. Any value is fine.

```
DATABASE_URL=sqlite+aiosqlite:///./cow_farm.db
SECRET_KEY=unused
```

```bash
docker compose up --build
```

That SQLite file is inside the container, not on a volume. Recreate the container and it is gone. Use the `docker run` commands above when you want the data kept. Same build-time rule for the API URL: without `frontend/.env.production`, the UI calls `http://localhost:8000`.

## Configuration

From a checkout, the API loads a `.env` at the repo root no matter which directory you started it from. The Docker image has no `.env`. Pass variables in.

| Variable | What it does |
| --- | --- |
| `DATABASE_URL` | Defaults to `sqlite+aiosqlite:///./cow_farm.db`. Postgres URL for a shared database. |
| `DEBUG` | Defaults to `true`. No `Authorization` header means you are `admin@cowfarm.local`. Set `false` before the port is reachable by anyone else. |
| `SUPABASE_JWT_SECRET` | Checks Supabase access tokens. The default is a placeholder. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | For a Supabase project. Each request is checked locally against the JWT secret. The API does not call Supabase to do that. |
| `BACKEND_CORS_ORIGINS` | Comma-separated origins. |
| `NEXT_PUBLIC_API_URL` | Frontend only, and only at build time. |

With `DEBUG=true`, these bearer tokens also work: `dev-user:admin`, `dev-user:manager`, `dev-user:data_entry`. Profitability wants `admin` or `manager`. Day-to-day entry does not.

Roles on a real token are read from `user_metadata.role` or `app_metadata.role`. The three values are `admin`, `manager`, and `data_entry`.

## Layout

```
backend/app/api/v1/endpoints/   routes
backend/app/models/             tables
backend/app/schemas/            request and response shapes
backend/app/services/           evaluations, invoices, reports, soft delete
backend/alembic/                migrations, for Postgres
backend/tests/                  domain rules and the delete/restore behavior
frontend/src/app/               routes (today, herd, purchases, breeding, health, milk-sales, expenses, payroll, reports, masters)
frontend/src/lib/api.ts         fetch wrapper and the path list
ER-diagram/                     the schema drawing
Plans/                          the original spec
```

## Left out

Photos, stock balances, purchase orders, email reminders, generated payslips, more than one farm, double-entry books. Those were skipped, not forgotten.
