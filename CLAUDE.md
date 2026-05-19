# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```powershell
# Activate virtualenv and start backend
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

### Frontend
```powershell
cd frontend
npm run dev       # dev server on :5173
npm run build     # production build
npm run lint      # ESLint
```

### Running both (two terminals)
Backend on `:8000`, frontend on `:5173`. Vite proxies `/api/*` → `http://localhost:8000`.

## Architecture

**PageIndex-based hierarchical vectorless RAG** — no embeddings, no vector DB. Gemini routes queries through a 3-step hierarchy:
1. Chapter routing (via chapter summaries)
2. Section routing (via section summaries in PageIndex)
3. Answer generation from section full text

### Backend (`backend/`)

| File | Role |
|---|---|
| `main.py` | FastAPI app — all 6 endpoints, CORS, startup hook |
| `database.py` | sqlite3 helpers; single `chapters` table; `init_db()` called on startup |
| `gemini.py` | All Gemini + Tavily calls: OCR, PageIndex build, summary, quiz, RAG, evaluate |
| `ingest.py` | PDF ingestion pipeline — yields SSE progress events, called by `GET /api/refresh` |

**Database:** single SQLite file `backend/social_studies.db`. The `chapters` table stores everything: `filename`, `chapter_name`, `page_count`, `page_index` (JSON), `summary`, `quiz_json`, `loaded_at`.

**PageIndex JSON structure:**
```json
{
  "chapter": "<name>",
  "sections": [{ "title": "...", "summary": "...", "pages": [1,2], "content": "..." }]
}
```

**LLM:** `google-genai` SDK (NOT `google-generativeai` — that's deprecated). Model: `gemini-2.0-flash-lite`. Rate-limit retry with 30s backoff in `_call()`.

**Refresh flow:** `GET /api/refresh` → SSE stream → `ingest.run()` → per page: PyMuPDF extracts image → Gemini Vision OCR → build PageIndex → generate summary + quiz → INSERT into DB. 2s sleep between pages to stay under free-tier RPM.

### Frontend (`frontend/src/`)

| File | Role |
|---|---|
| `main.jsx` | React 19 entry point |
| `App.jsx` | React Router setup; routes map to page components |
| `api.js` | Axios wrapper; all API calls centralized here |
| `pages/HomePage.jsx` | Chapter list + Refresh button with SSE progress (Phase 5 — complete) |

Pages to be added (Phases 6–9):
- `/chapter/:id` → `ChapterPage.jsx` (summary + nav buttons)
- `/chapter/:id/read` → `ReadPage.jsx` (iframe PDF viewer)
- `/chapter/:id/quiz` → `QuizPage.jsx` (15 Q one-by-one)
- `/ask` → `AskPage.jsx` (AI assistant with conversation history)

**Tailwind:** uses `@tailwindcss/vite` plugin (v4 style) — no `tailwind.config.js` needed.

## Environment

`.env` in `backend/` (not committed):
```
GEMINI_API_KEY=...
TAVILY_API_KEY=...
```
`load_dotenv()` is called at the top of `main.py`.

## Content

PDFs live in `docs/content/`. They are image-scanned (no extractable text), hence OCR via Gemini Vision. New PDFs dropped here are picked up by the next Refresh.

## Build Status

See `docs/Project_Status.md` for the phase checklist. As of last update:
- Phases 1–5: Complete (backend fully written; Phase 5 Homepage done)
- Phases 6–10: Not started (remaining frontend pages + polish)
