# Social Studies App — Project Status

**Stack:** FastAPI (Python) + React (Vite) + SQLite + Gemini Vision + Tavily  
**Architecture:** PageIndex-based hierarchical vectorless RAG  
**Last Updated:** 2026-05-16 (Phase 1 complete)

---

## Legend
- [ ] To Do
- [~] In Progress
- [x] Done

---

## Phase 1 — Project Scaffold ✅
- [x] 1.1 Create folder structure (`backend/`, `frontend/`)
- [x] 1.2 Python virtual environment + install backend dependencies
  - fastapi, uvicorn, pymupdf, google-genai, tavily-python, python-dotenv
- [x] 1.3 React + Vite setup (`npm create vite`)
- [x] 1.4 Install frontend dependencies
  - axios, lucide-react, tailwindcss (@tailwindcss/vite plugin)
- [x] 1.5 Create `.env` file with `GEMINI_API_KEY` and `TAVILY_API_KEY`
- [x] 1.6 CORS config in FastAPI to allow React dev server
- [x] **Verified:** FastAPI starts on :8000, React builds cleanly, `/api/chapters` returns `[]`
- Note: Switched from deprecated `google-generativeai` → `google-genai` SDK

---

## Phase 2 — Database ✅
- [x] 2.1 Create `database.py` with sqlite3 connection helper
- [x] 2.2 Create `chapters` table (single table schema)
  ```
  id, filename, chapter_name, page_count,
  page_index (JSON), summary, quiz_json, loaded_at
  ```
- [x] 2.3 `init_db()` function called on app startup
- [x] **Verified:** DB file created on startup, `chapters` table exists

---

## Phase 3 — Ingestion Pipeline (Refresh Feature) ✅
- [x] 3.1 Scan `./docs/content` folder for PDF files
- [x] 3.2 Skip files already loaded (check by filename + step status in DB)
- [x] 3.3 **Pass 1 — Gemini Vision OCR per page** (`ingest.py`)
  - Extract each PDF page as image (PyMuPDF)
  - Send image to Gemini Vision
  - Return structured JSON per page: `{page, heading, subheading, content}`
  - Save `ocr_pages` JSON + `step1_status` immediately on completion
- [x] 3.4 **Pass 2 — Build PageIndex (Gemini text)** (`gemini.py`)
  - Group pages by heading/section
  - Generate section-level summaries
  - Build hierarchical PageIndex JSON
  - Save `page_index` + `step2_status` immediately on completion
- [x] 3.5 Generate chapter summary from PageIndex (Gemini)
- [x] 3.6 Generate 15 quiz questions (10 MCQ + 5 descriptive)
- [x] 3.7 Store all data in `chapters` table; save `step3_status` on completion
- [x] 3.8 `GET /api/refresh` endpoint with SSE progress streaming
- [x] 3.9 **Resilient refresh**: per-file error isolation; resume from exact failed step on next run
  - Added `ocr_pages`, `step1_status`, `step2_status`, `step3_status` columns (with auto-migration)
  - Failed file skipped; next file continues processing
  - On re-run: only failed/incomplete steps are retried per file
- [ ] **Verify:** Run refresh via UI → DB has page_index, summary, quiz_json (pending backend running + PDFs)

---

## Phase 4 — Backend API Endpoints ✅
- [x] 4.1 `GET  /api/chapters` — list all chapters (id, name, page_count)
- [x] 4.2 `GET  /api/chapters/{id}` — chapter summary + metadata
- [x] 4.3 `GET  /api/chapters/{id}/pdf` — stream PDF file for viewer
- [x] 4.4 `GET  /api/chapters/{id}/quiz` — fetch quiz questions (order shuffled)
- [x] 4.5 `POST /api/quiz/evaluate` — grade MCQ + descriptive answers
  - MCQ: exact match
  - Descriptive: Gemini evaluates (85% semantic match threshold)
- [x] 4.6 `POST /api/ask` — vectorless RAG + Tavily internet search
  - Step 1: Route question to relevant chapter (via PageIndex chapter summaries)
  - Step 2: Route to relevant sections (via section summaries)
  - Step 3: Generate answer from section content
  - Step 4: Tavily search for 2 additional internet sources
- [ ] **Verify:** Test all endpoints end-to-end (pending frontend + refresh)

---

## Phase 5 — Frontend: Homepage ✅
- [x] 5.1 Header: "Social Studies – Table of Contents" (dark grey bar)
- [x] 5.2 Numbered chapter list with clickable chapter names
- [x] 5.3 Refresh button — triggers `POST /api/refresh` via SSE (EventSource)
- [x] 5.4 3-step progress indicator during refresh
  - Step 1: Loading files...
  - Step 2: Extracting content...
  - Step 3: Creating summaries...
- [x] React Router installed; routing skeleton in App.jsx
- [x] api.js helper with all API calls
- [ ] **Verify:** Chapters load from API, Refresh shows live progress (needs backend running + PDFs)

---

## Phase 6 — Frontend: Chapter Summary Page ✅
- [x] 6.1 Header: Home icon + Chapter title (dark bar); home icon navigates to /
- [x] 6.2 "Summary of Chapter" label + "Read Chapter" + "Take Quiz" buttons
- [x] 6.3 Scrollable summary area (bordered white box, pre-line whitespace)
- [x] 6.4 "Ask AI Assistant" bar fixed at bottom (icon + input + send button)
- [x] 6.5 Clicking send → navigate to /ask with {question, chapterId, chapterName} in router state
- [x] Placeholder routes added for /chapter/:id/read, /chapter/:id/quiz, /ask
- [ ] **Verify:** Chapter summary loads, buttons navigate correctly (needs backend running)

---

## Phase 7 — Frontend: Chapter Content Page (PDF Viewer) ✅
- [x] 7.1 Header: Home icon (returns to Chapter Summary) + Chapter title
- [x] 7.2 Render PDF using browser `<iframe>` (served from `/api/chapters/{id}/pdf`)
- [x] 7.3 Full-height scrollable PDF view (`h-screen flex flex-col`, iframe fills remainder)
- [ ] **Verify:** PDF renders and is scrollable on desktop + mobile (needs backend running)

---

## Phase 8 — Frontend: Quiz Page ✅
- [x] 8.1 Progress indicator: "Question X of 15"
- [x] 8.2 MCQ: styled radio button options; selected option highlighted blue
- [x] 8.3 Descriptive: textarea (4 rows), disabled after submit
- [x] 8.4 Submit Answer → evaluateAnswer API → inline feedback (green ✓ / red ✗ + explanation) → Next Question button
- [x] 8.5 Results screen: score banner (X/15), per-question review with correct/wrong indicators and explanation for wrong answers; Back to Chapter button
- [ ] **Verify:** Full quiz flow works, score calculated correctly (needs backend running)

---

## Phase 9 — Frontend: AI Assistant Page ✅
- [x] 9.1 X button top-left → navigates back to /chapter/:id (or / if no chapter context)
- [x] 9.2 Each question displayed in grey rounded box, italic, centered
- [x] 9.3 Chapter-sourced answer in blue-900 text below the question
- [x] 9.4 "Additional Info" section: snippet in orange, source title as orange underline link (ExternalLink icon)
- [x] 9.5 "Ask AI Assistant" bar fixed at bottom for follow-up questions
- [x] 9.6 Session-based history: turns stored in component state; last 3 passed to API; cleared on page close
- [x] Loading state ("Thinking...") and error state per turn
- [x] Auto-scroll to bottom after each new turn
- [ ] **Verify:** Q&A displays correctly, follow-up questions work (needs backend running)

---

## Phase 10 — Polish & Testing ✅ (code complete)
- [x] 10.1 Responsive design — sm: breakpoints on all pages
  - ChapterPage sub-header stacks vertically on mobile (flex-col sm:flex-row)
  - "Ask AI Assistant" label hidden on mobile (hidden sm:inline) on ChapterPage + AskPage
  - Refresh progress steps wrap on narrow screens (flex-wrap)
  - Padding uses px-4 sm:px-6 throughout
- [x] 10.2 Loading spinners — shared Spinner.jsx component used on all pages
  - HomePage: chapter list loading
  - ChapterPage: summary loading
  - ReadPage: iframe overlay spinner until PDF loads
  - QuizPage: quiz load + Submit Answer button spinner
- [x] 10.3 Error states
  - HomePage: chapter load error + SSE onerror banner + per-file error events in stepMsg
  - ChapterPage: chapter load error
  - QuizPage: load error + evaluate error (inline, non-blocking)
  - AskPage: per-turn error (already in Phase 9)
- [ ] 10.4 End-to-end test: Refresh → Summary → Read → Quiz → Ask AI (manual, needs backend + PDFs)
- [ ] 10.5 Test on mobile browser (manual)
- [x] 10.6 Env validation on startup — startup() raises RuntimeError if GEMINI_API_KEY or TAVILY_API_KEY missing

---

## Phase 11 — Ingestion Refactor: Chapter-Level Status Tracking
> **Goal:** One PDF contains multiple chapters. Steps 2 & 3 track status per chapter to avoid reprocessing completed chapters on restart.

### Step 11.1 — `database.py` rewrite
- [x] 11.1.1 Create `documents` table (one row per PDF: filename, ocr_pages, step1_status, step1_pages_done, step2_status, step3_status)
- [x] 11.1.2 Restructure `chapters` table (one row per chapter: doc_filename, chapter_number, chapter_name, start_page, end_page, page_index, summary, quiz_json, step2_status, step3_status)
- [x] 11.1.3 Add helper functions: upsert_document, get_document, get_chapters_for_doc, upsert_chapter, update_chapter_step2, update_chapter_step3, aggregate_doc_status
- [ ] **Test:** Delete DB → start backend → verify both tables created → `GET /api/chapters` returns `[]`

### Step 11.2 — `gemini.py` — add `extract_chapter_list()`
- [x] 11.2.1 Add `extract_chapter_list(ocr_pages)` — reads page headings to identify chapter boundaries; returns `[{chapter_number, chapter_name, start_page}]`
- [ ] **Test:** Run test script against real OCR data → verify chapter names + page numbers match PDF contents

### Step 11.3 — `ingest.py` — Step 1 (OCR → `documents` table)
- [x] 11.3.1 `_get_pending_docs()` queries `documents` table
- [x] 11.3.2 `_step1_ocr()` saves to `documents` (not `chapters`)
- [ ] **Test:** Trigger Refresh → verify `documents` row created with ocr_pages + step1_status="success" → `chapters` table still empty

### Step 11.4 — `ingest.py` — Step 2 (chapter identification + PageIndex per chapter)
- [x] 11.4.1 If no chapter rows exist for doc: call `extract_chapter_list()` → compute end_pages → insert chapter rows
- [x] 11.4.2 For each chapter with step2_status != "success": slice OCR pages → build PageIndex → save + aggregate doc status
- [x] 11.4.3 On chapter failure: mark "failed", continue to next chapter
- [ ] **Test:** Verify chapter rows created with correct names/page ranges → spot-check page_index JSON → test restart skips completed chapters

### Step 11.5 — `ingest.py` — Step 3 (per-chapter summary + quiz)
- [x] 11.5.1 For each chapter: run Step 3 immediately after that chapter's Step 2 = "success"
- [x] 11.5.2 On chapter failure: mark "failed", continue
- [ ] **Test:** Verify all chapters get summary + quiz_json → check 15 questions (10 MCQ + 5 descriptive) → test restart skips completed chapters

### Step 11.6 — `main.py` — update endpoints
- [x] 11.6.1 `GET /api/status` — query `documents` table (same response shape, no frontend changes)
- [x] 11.6.2 `GET /api/chapters/{id}/pdf` — use `doc_filename` from chapters table
- [x] 11.6.3 `GET /api/chapters` + `GET /api/chapters/{id}` — page_count computed as end_page - start_page + 1
- [ ] **Test:** All 6 API endpoints respond correctly with new schema

### Step 11.7 — Bug Fixes (concurrent refresh & stale progress)
- [x] Prevent concurrent Refresh runs: `asyncio.Lock` in `main.py` — EventSource reconnects see "already in progress" and stop
- [x] Reset stale `in_progress` at start of each run: previous crashed runs left steps as `in_progress`; now reset to `failed` so they retry cleanly
- [x] DB-level guard in step2 + step3: `AND step2_status != 'success'` / `AND step3_status != 'success'` in UPDATE — prevents overwriting a success even if called unexpectedly
- [x] `_reaggregate_all_docs()`: re-syncs document-level status after stale progress reset

### Step 11.8 — Integration Test
- [ ] 11.8.1 Full Refresh cycle (clean DB) → all chapters load with summary + quiz
- [ ] 11.8.2 Kill mid-refresh → restart → only incomplete chapters reprocessed
- [ ] 11.8.3 Homepage shows all chapters; Summary, Read, Quiz, Ask AI all work
- [ ] 11.8.4 Test on mobile viewport

---

## Decisions & Notes

| Topic | Decision |
|---|---|
| Frontend | React 18 + Vite |
| Backend | FastAPI + Python |
| Database | SQLite (single `chapters` table, no ORM) |
| LLM | Google Gemini 2.0 Flash Lite |
| OCR | Gemini Vision (per-page image extraction) |
| Search | Vectorless PageIndex RAG (hierarchical, 3-step Gemini routing) |
| Internet Search | Tavily API |
| PDF Viewer | Browser native `<iframe>` |
| Auth | None (single user, personal app) |
| Quiz Storage | Not persisted (generated once, stored in DB; scores not saved) |
| Conversation | Session-only (no persistence) |
| Hosting | Local for now |

---

## Content Files

| File | Pages | Status |
|---|---|---|
| doc_01.pdf | 31 | [ ] Not loaded |
| doc_02.pdf | 19 | [ ] Not loaded |
