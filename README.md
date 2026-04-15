# StackSense

AI-powered knowledge assistant — upload documents, ask questions, get answers with sources.

```
Next.js (frontend) → FastAPI (backend) → Groq LLM + Cohere Embeddings + Qdrant Vector DB
```

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌────────────────┐
│   Next.js    │────▶│   FastAPI    │────▶│   PostgreSQL   │
│  (React 19)  │     │  (async)     │     │   (auth/meta)  │
└──────────────┘     └──────┬───────┘     └────────────────┘
                            │
                 ┌──────────┼──────────┐
                 ▼          ▼          ▼
          ┌──────────┐ ┌────────┐ ┌────────────┐
          │  Groq    │ │ Cohere │ │   Qdrant   │
          │  (LLM)   │ │ (embed)│ │ (vectors)  │
          └──────────┘ └────────┘ └────────────┘
                            │
                         ┌──┴──┐
                         │Redis│
                         └─────┘
```

## Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **Next.js 16** (App Router) | React framework with SSR |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Utility-first styling |
| **ShadCN UI** (Radix primitives) | Accessible component library |
| **TanStack React Query** | Server state management |
| **react-dropzone** | File drag & drop |
| **react-markdown** | Markdown rendering in chat |

### Backend
| Technology | Purpose |
|-----------|---------|
| **FastAPI** | Async Python web framework |
| **PostgreSQL** (asyncpg + SQLAlchemy 2) | Auth & metadata storage |
| **Redis** (hiredis) | Rate limiting, caching, token blacklist |
| **Qdrant** | Vector database for RAG |
| **Groq** (llama3-70b) | LLM inference |
| **Cohere** (embed-english-v3.0) | Text embeddings (1024 dim) |
| **JWT** (PyJWT + bcrypt) | Access + refresh token auth |
| **OpenTelemetry** | Distributed tracing (opt-in) |

---

## Getting Started

### Prerequisites

- **Docker** & **Docker Compose** — required for infrastructure
- **Node.js** 18+ — for the frontend dev server
- **Groq API key** — [console.groq.com](https://console.groq.com)
- **Cohere API key** — [dashboard.cohere.com](https://dashboard.cohere.com)

### 1. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` — set these three values at minimum:

```
GROQ_API_KEY=gsk_...
COHERE_API_KEY=...
JWT_SECRET_KEY=<random string, min 32 chars>
```

> Generate a JWT secret: `python3 -c 'import secrets; print(secrets.token_urlsafe(64))'`

### 2. Start the API + infrastructure

```bash
make up          # starts backend, postgres, redis, qdrant
make logs-api    # tail backend logs
```

This runs `docker compose up -d`, which:
- Builds the FastAPI backend (with hot-reload)
- Starts PostgreSQL 16, Redis 7, and Qdrant
- Waits for healthy DB/Redis before starting the API

API is live at **http://localhost:8000** — OpenAPI docs at [http://localhost:8000/docs](http://localhost:8000/docs).

### 3. Run database migrations

```bash
make migrate
```

### 4. Start the UI

```bash
make ui-install  # first time only
make ui          # starts Next.js on port 3000
```

Or manually:

```bash
cd frontend
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1' > .env.local
npm run dev
```

UI is live at **http://localhost:3000**.

### 5. Verify everything works

```bash
make health      # check API health endpoint

# Create an account
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "StrongPass1", "full_name": "Test User"}'
```

---

## API Reference

Base URL: `http://localhost:8000/api/v1`

### Auth

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/signup` | Create account | No |
| POST | `/auth/login` | Login, get token pair | No |
| POST | `/auth/refresh` | Refresh access token | No |
| POST | `/auth/logout` | Blacklist refresh token | Bearer |
| GET | `/auth/me` | Get current user profile | Bearer |

### RAG Pipeline

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/rag/ingest/text` | Ingest text content | Bearer |
| POST | `/rag/ingest/file` | Upload & ingest a file | Bearer |
| POST | `/rag/query` | RAG query (full response) | Bearer |
| POST | `/rag/query/stream` | RAG query (SSE streaming) | Bearer |
| GET | `/rag/documents` | List ingested chunks | Bearer |
| DELETE | `/rag/documents` | Delete chunks by IDs | Bearer |
| GET | `/rag/stats` | Collection statistics | Bearer |

### Health

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/health` | Health check (DB + Redis) | No |

---

## API Examples

### Signup

```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "StrongPass1", "full_name": "Jane Doe"}'
```

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### Ingest Text

```bash
curl -X POST http://localhost:8000/api/v1/rag/ingest/text \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "FastAPI is a modern web framework...", "source": "docs"}'
```

```json
{
  "chunks": 3,
  "point_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

### Upload File

```bash
curl -X POST http://localhost:8000/api/v1/rag/ingest/file \
  -H "Authorization: Bearer <token>" \
  -F "file=@document.txt"
```

### Query (Full Response)

```bash
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is FastAPI?"}'
```

```json
{
  "answer": "FastAPI is a modern Python web framework...",
  "sources": [
    {
      "id": "uuid-1",
      "text": "FastAPI is a modern web framework...",
      "score": 0.92,
      "metadata": {"source": "docs", "chunk_index": 0}
    }
  ]
}
```

### Query (Streaming)

```bash
curl -X POST http://localhost:8000/api/v1/rag/query/stream \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is FastAPI?"}'
```

Returns Server-Sent Events:
```
data: {"token": "FastAPI"}
data: {"token": " is"}
data: {"token": " a"}
...
data: [DONE]
```

### List Documents

```bash
curl http://localhost:8000/api/v1/rag/documents?limit=20 \
  -H "Authorization: Bearer <token>"
```

```json
{
  "documents": [
    {"id": "uuid-1", "text": "chunk text...", "metadata": {"source": "docs"}}
  ],
  "total": 42,
  "next_offset": "uuid-20"
}
```

### Delete Documents

```bash
curl -X DELETE http://localhost:8000/api/v1/rag/documents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"point_ids": ["uuid-1", "uuid-2"]}'
```

### Collection Stats

```bash
curl http://localhost:8000/api/v1/rag/stats \
  -H "Authorization: Bearer <token>"
```

```json
{
  "collection": "stacksense_docs",
  "vectors_count": 42,
  "status": "green"
}
```

---

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Email + password authentication |
| `/signup` | Signup | Account creation with password validation |
| `/dashboard` | Dashboard | Stats overview, collection metrics, quick actions |
| `/chat` | Chat | ChatGPT-style interface with streaming responses |
| `/documents` | Documents | File upload (drag & drop), text ingest, chunk browser |

### UI Features

- **Streaming chat** — real-time token-by-token response rendering
- **Markdown support** — assistant responses rendered as rich Markdown
- **Source citations** — each answer shows relevant source chunks with scores
- **Drag & drop upload** — accepts TXT, MD, CSV files up to 10MB
- **Document browser** — lists stored chunks with source tags, inline delete
- **Collection stats** — real-time vector count and collection health
- **Auth-guarded routes** — automatic redirect to login when unauthenticated
- **Responsive sidebar** — persistent navigation with user profile section

---

## Security

- JWT access + refresh tokens with role-based claims
- Token blacklisting on logout (Redis)
- Auth rate limiting (10 req / 5 min on login/signup)
- Global rate limiting (100 req / min)
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Request ID tracing (full UUID in responses and logs)
- Password validation (8+ chars, uppercase, digit)
- JWT secret validation at startup (min 32 chars)
- CORS with explicit methods/headers (no wildcards)

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Async Postgres connection | `postgresql+asyncpg://...` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379/0` |
| `JWT_SECRET_KEY` | Token signing secret (min 32 chars) | — |
| `GROQ_API_KEY` | Groq API key | — |
| `GROQ_MODEL` | LLM model | `llama3-70b-8192` |
| `COHERE_API_KEY` | Cohere API key | — |
| `COHERE_MODEL` | Embedding model | `embed-english-v3.0` |
| `QDRANT_URL` | Qdrant connection | `http://localhost:6333` |
| `QDRANT_COLLECTION` | Collection name | `stacksense_docs` |
| `RAG_CHUNK_SIZE` | Chunk size (chars) | `512` |
| `RAG_TOP_K` | Retrieved chunks per query | `5` |
| `OTEL_ENABLED` | Enable OpenTelemetry | `false` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8000/api/v1` |

---

## Makefile Commands

```
  up              Start all services (detached)
  up-build        Rebuild and start all services
  down            Stop all services
  restart         Restart all services
  logs            Tail logs (all services)
  logs-api        Tail backend logs only
  ps              Show running containers
  migrate         Run Alembic migrations (auto-generate + upgrade)
  migrate-up      Apply pending migrations
  migrate-down    Rollback last migration
  shell           Open a Python shell in the backend container
  bash            Open a bash shell in the backend container
  ui              Start Next.js dev server (local)
  ui-build        Build the Next.js production bundle
  ui-install      Install frontend dependencies
  lint            Lint frontend code
  health          Check API health endpoint
  clean           Stop services and remove volumes
  nuke            Full reset — containers, volumes, images
```

Run `make help` to see this list.

---

## Docker

### Local development (recommended)

```bash
make up          # backend + postgres + redis + qdrant
make logs        # tail all logs
```

The backend container mounts `./backend` as a volume with uvicorn `--reload`, so code changes apply instantly.

### Production build

```bash
# API — multi-stage build with gunicorn (4 workers)
cd backend
docker build --target production -t stacksense-backend .
docker run -d -p 8000:8000 --env-file .env stacksense-backend

# UI
cd frontend
npm run build
npm start
```

## License

MIT
