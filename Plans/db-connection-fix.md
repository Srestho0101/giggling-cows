The database is not the thing that is slow. Every save from the app takes a long trip that usually dies on the way, and the browser then reports that death as `Failed to fetch`.

I measured the live API at `cow-farm-cakg.onrender.com` just now.

| Call | Touches Supabase? | Time | Result |
|---|---|---|---|
| `/health`, `/auth/me` | No | ~140ms | Fine |
| Any read, even an empty list (`/herd/suppliers` → `[]`) | Yes | **1.5–3.1s** | Slow |
| `/reports/dashboard` | Yes, ~15 queries in a row | **7.9s** | Slow |
| 8–10 of those reads at once (what a page load does) | Yes | 1.3–3s | **about half returned 500** |

The 500s are the bug you actually feel. They come back as plain text `Internal Server Error` with **no** `Access-Control-Allow-Origin`. The app on `giggling-cows.vercel.app` is not allowed to read that response, so `fetch` throws `TypeError: Failed to fetch`. The row was never committed. Refresh, and it is gone.

## Why

The browser never talks to Supabase. It talks to a FastAPI process on Render, and that process opens Postgres itself:

`your browser (BD)` → `Render` → `Supabase Postgres` → back the same way.

Three things stack.

**1. A new, far-away database connection on every request.** In [backend/app/core/database.py](https://github.com/Srestho0101/giggling-cows/blob/main/backend/app/core/database.py) the engine is a default pool with `pool_pre_ping=True` and no statement-cache settings. A query that returns nothing still takes ~2 seconds, and the no-database routes take 140ms, so that 2 seconds is the connection, not your SQL. Render and the Supabase project are not in the same region, and a full connect (DNS, TLS, auth, ping, query, commit) from across the planet is about 2 seconds. `get_db()` then `COMMIT`s even for reads, so every call pays that again.

**2. Parallel requests blow up the pool.** One screen fires many calls at once (`refetchOnWindowFocus` does it again every time you tab back). The dashboard holds one connection for the whole ~8 seconds while it runs about 15 round trips in [report_service.py](https://github.com/Srestho0101/giggling-cows/blob/main/backend/app/services/report_service.py). Supabase’s free database only allows a handful of real sessions. asyncpg also caches prepared statements, which the transaction pooler (port **6543**) cannot do: under concurrency those collide (`prepared statement does not exist` / duplicate statement / too many clients). I reproduced it: 10 parallel calls to an empty table, 4 of them 500’d. That is a normal page load, not a stress test.

**3. Those crashes skip CORS.** FastAPI’s outer server-error handler sits outside `CORSMiddleware` in [main.py](https://github.com/Srestho0101/giggling-cows/blob/main/backend/app/main.py). So the 500 the pooler just caused has no CORS header, and the UI can only say `Failed to fetch`. Render’s free web service adds the same symptom after ~15 minutes idle: the process is asleep, the first request gets a gateway 502 that also has no CORS, and the POST never lands. Cold start was not what I hit this time; the 500s alone are enough.

`DEBUG` is also still on in production. `/auth/me` with no token answers as `admin@cowfarm.local`. That turns on SQL echo and leaves the API open. Set `DEBUG=false` on Render when you touch the env.

## Eliminate it

Do these in order. A keep-alive ping will not fix it.

1. **Put Render and Supabase in the same region, and keep Render awake.** For you, Singapore (`ap-southeast-1`) on both is the right pair. Mumbai is the other sane Supabase choice, but Render has no Mumbai region. An always-on instance (Render Starter, or any host that does not sleep) removes the 30–60s wake-up 502s. Moving region means a new Supabase project and a data copy; the old project’s region cannot be changed.

2. **Use the session pooler, not the direct host and not port 6543.** In Supabase → Connect, copy the **session pooler** URI (host `aws-0-<region>.pooler.supabase.com`, port **5432**). Direct `db.<ref>.supabase.co` is IPv6-only and caps out around 15 sessions. Port 6543 is what makes prepared statements fail at random. Your URL helper only treats `.supabase.com` and port 6543 as Supabase, so a `db.*.supabase.co` string silently skips TLS setup.

3. **Replace the engine** in `backend/app/core/database.py` with a small pool that does not cache statements:

```python
engine = create_async_engine(
    settings.async_database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=2,
    pool_timeout=10,
    pool_recycle=280,
    connect_args={
        "ssl": "require",
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "command_timeout": 15,
        "timeout": 10,
    },
)
```

Cap the app at 5 sessions so it cannot stampede a free project. `statement_cache_size=0` is what actually stops the random 500s if anything still points at port 6543.

4. **One round trip per screen.** The dashboard should be one SQL statement (or one Postgres function), not 15. The warehouse list runs a separate `COUNT` per shed; that is the same disease. After the region move those queries are cheap, but a page that opens 10 connections will still trip the pool.

5. **Make a failure readable, and retry the save.** Add a FastAPI exception handler that always returns JSON and always sets `Access-Control-Allow-Origin`. Then the UI stops saying `Failed to fetch` and can show the real error. Retry idempotent writes once. Stop calling `commit()` inside the route and again in `get_db()`; one commit, after the work.

After 1–3, an empty read should drop from ~2.5s to well under 100ms, the dashboard from ~8s to a single short query, and a burst of parallel calls should stop returning bare 500s. That is the whole failure mode: slow handshake, pooler crash, browser hides it.