# Cow Farm

An opinionated full-stack example for managing a small dairy/cattle operation. The project includes:

- A FastAPI backend (API, database models, services, and tests).
- A Next.js frontend (React + TypeScript) that consumes the backend APIs.
- Database migrations with Alembic and seed data utilities.

This README explains how to run, test, and develop the application locally.

**Tech stack**

- Backend: FastAPI, SQLAlchemy, Pydantic, Alembic, Uvicorn
- Frontend: Next.js, TypeScript
- Database: PostgreSQL (development), configured via SQLAlchemy

Quick links

- Backend entry: [backend/app/main.py](backend/app/main.py)
- Backend dependencies: [backend/requirements.txt](backend/requirements.txt)
- Frontend app: [frontend/src/app/page.tsx](frontend/src/app/page.tsx)
- OpenAPI spec (generated): [backend/openapi.json](backend/openapi.json)

Prerequisites

- Python 3.10+ (recommended) and Node.js 18+ / npm or yarn
- PostgreSQL running locally (or a remote connection)

Local development — Backend

1. Open a terminal and change to the backend directory:

```bash
cd backend
```

2. Create and activate a virtual environment, then install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Configure environment variables. Create a `.env` file in `backend/` with at minimum:

```env
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@localhost:5432/cowfarm
SECRET_KEY=supersecret
```

See `backend/core/config.py` for other settings and optional variables.

4. Run database migrations and seed the DB (Alembic is configured already):

```bash
alembic upgrade head
python backend/db/seed.py
```

5. Start the backend in development mode:

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. API docs (Swagger UI) are at `http://localhost:8000/api/v1/docs`.

Local development — Frontend

1. In a second terminal, change to the frontend directory and install dependencies:

```bash
cd frontend
npm install
# or: yarn
```

2. Start the Next.js development server:

```bash
npm run dev
```

Open the frontend at `http://localhost:3000`. The frontend reads/writes to the API endpoints on the backend—keep both servers running.

Running tests

- Backend unit tests are in `backend/tests`. Run them with:

```bash
cd backend
source .venv/bin/activate
pytest -q
```

Project structure (important files)

- [backend/app](backend/app) — FastAPI application and API routers
- [backend/core](backend/core) — configuration, database utilities, security helpers
- [backend/models](backend/models) — SQLAlchemy models and domain entities
- [backend/schemas](backend/schemas) — Pydantic request/response schemas
- [backend/services](backend/services) — business logic and use-case implementations
- [backend/alembic](backend/alembic) — database migrations
- [frontend/src](frontend/src) — Next.js app, pages, and components

Deployment notes

- For production, build the frontend (`npm run build`) and serve statically (Vercel, Netlify, or a CDN).
- Run the backend behind a production ASGI server (e.g., Uvicorn + Gunicorn or similar) and point it to a managed PostgreSQL instance.
- Make sure to set secure `SECRET_KEY` and appropriate CORS / security settings in `backend/core/config.py`.

Contributing

Feel free to open issues or pull requests. When contributing:

- Follow the existing code style and tests.
- Add tests for new business logic and API endpoints.
- Run `pytest` and ensure migrations apply cleanly.

Useful commands summary

```bash
# Backend
cd backend
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev

# Tests
cd backend
pytest -q
```

# Live URLs
[Render Server](https://cow-farm-cakg.onrender.com/api/v1/docs#/Authentication%20%26%20Profile/get_current_user_profile_api_v1_auth_me_get)
[Vercel Deployment](https://giggling-cows.vercel.app/today)

MIT License

Happy hacking!
