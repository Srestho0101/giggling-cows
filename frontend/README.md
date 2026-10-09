# Frontend development

The frontend is a Next.js App Router project using React, TypeScript, and Tailwind CSS. It is intentionally a clean foundation; implement screens from `../Plans/frontend-plan.md` and use `../Plans/Cow Farm - UI Demo.html` as a visual reference.

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Set `NEXT_PUBLIC_API_URL` in `.env.local` to the FastAPI origin (default `http://localhost:8000`). API routes are versioned under `/api/v1`.

Run the backend separately from `../backend`; its default CORS configuration already allows `http://localhost:3000`.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```
