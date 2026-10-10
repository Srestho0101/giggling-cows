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

## App foundation

- The workspace shell contains the planned section navigation, date controls, language toggle, and Ctrl+K cow-search dialog.
- Each section has its own route. Today combines dashboard indicators with daily milk, attendance, invoice, and expense entry; Reports includes dashboard summaries and period profitability; Masters manages reference lists supported by the API.
- `src/lib/api.ts` provides `apiRequest<T>()`, `ApiError`, and route constants matching the FastAPI `/api/v1` endpoints. It accepts an optional bearer token; local requests work with the backend's development auth default. Production sign-in/token wiring remains a separate step.

Operational pages include cow registration, status changes, weight and warehouse history; server-calculated purchase evaluations and conversion to cows; breeding and pregnancy records; health records with due alerts; filtered expenses; milk entries, customers and invoice payments; plus worker attendance, salary payments, and substitute charges.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```
