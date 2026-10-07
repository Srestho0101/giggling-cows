## Main project context files

### Project overview
- README.md — High-level project description, setup, and what the system does overall.
- codex-complete-plan.md — Detailed implementation plan and architecture notes for the app.

### Backend core
- main.py — FastAPI app entry point that wires up the app, middleware, and API routes.
- config.py — App settings, environment variables, and configuration for database/security.
- database.py — SQLAlchemy connection/session setup and database initialization.
- router.py — Central router that includes the main API endpoint groups.
- auth.py — Authentication and user/session logic.
- __init__.py — Model package export file for the ORM layers.
- herd.py — Core cow/herd data model and relationships.
- feeding.py — Feeding records and livestock feed tracking.
- health.py — Cow health checks, treatments, and monitoring.
- sales.py — Sales and revenue-related records.
- labor.py — Labor tracking and workforce operations.
- evaluation.py — Evaluation criteria and scoring data.

### Business logic / validation
- evaluation_service.py — Evaluation business logic and rules for scoring/processing.
- invoice_service.py — Invoice generation and billing-related logic.
- report_service.py — Report generation and analytics service.
- test_domain_rules.py — Key domain validation and business rule checks that define expected behavior.

### Frontend entry
- page.tsx — Main landing page and app shell entry.
- api.ts — Central API client used by the UI to talk to the backend.
- AuthContext.tsx — Authentication state and user/session context.
- Navigation.tsx — App navigation and routing structure.
- layout.tsx — Global layout, styling hooks, and root app wrapper.