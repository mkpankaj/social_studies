import os
import json
import asyncio
import fitz  # PyMuPDF
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from database import init_db, get_conn, cache_lookup, cache_store
import ingest
import gemini as ai

app = FastAPI(title="Social Studies App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CONTENT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "content")

_refresh_lock = asyncio.Lock()


@app.on_event("startup")
def startup():
    missing = [k for k in ("GEMINI_API_KEY", "TAVILY_API_KEY") if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}. Add them to backend/.env")
    init_db()


# ── Refresh ──────────────────────────────────────────────────────────────────

@app.get("/api/refresh")
async def refresh():
    if _refresh_lock.locked():
        async def already_running():
            yield 'data: {"step": 1, "message": "Refresh already in progress. Please wait."}\n\n'
            yield 'data: {"done": true}\n\n'
        return StreamingResponse(already_running(), media_type="text/event-stream")

    async def stream():
        async with _refresh_lock:
            async for msg in ingest.run(CONTENT_DIR):
                yield f"data: {json.dumps(msg)}\n\n"
            yield 'data: {"done": true}\n\n'

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── Ingestion Status ─────────────────────────────────────────────────────────

@app.get("/api/status")
def get_status():
    pdf_files = sorted([f for f in os.listdir(CONTENT_DIR) if f.lower().endswith(".pdf")])
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT filename, page_count,
                      step1_status, step1_error, step1_pages_done,
                      step2_status, step2_error,
                      step3_status, step3_error
               FROM documents"""
        ).fetchall()
    db_state = {r["filename"]: dict(r) for r in rows}

    result = []
    for f in pdf_files:
        entry = db_state.get(f) or {
            "filename": f,
            "page_count": None,
            "step1_status": None, "step1_error": None, "step1_pages_done": None,
            "step2_status": None, "step2_error": None,
            "step3_status": None, "step3_error": None,
        }
        result.append(entry)
    return result


# ── Chapters ──────────────────────────────────────────────────────────────────

@app.get("/api/chapters")
def list_chapters():
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT id, chapter_name, (end_page - start_page + 1) AS page_count, loaded_at
               FROM chapters WHERE step3_status = 'success'
               ORDER BY doc_filename, chapter_number"""
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/chapters/{chapter_id}")
def get_chapter(chapter_id: int):
    with get_conn() as conn:
        row = conn.execute(
            """SELECT id, chapter_name, (end_page - start_page + 1) AS page_count, summary, loaded_at
               FROM chapters WHERE id = ?""",
            (chapter_id,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return dict(row)


@app.get("/api/chapters/{chapter_id}/pdf")
def get_pdf(chapter_id: int):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT doc_filename, start_page, end_page FROM chapters WHERE id = ?", (chapter_id,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Chapter not found")
    pdf_path = os.path.join(CONTENT_DIR, row["doc_filename"])
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found")
    # Extract only the chapter's pages (start_page/end_page are 1-indexed)
    src = fitz.open(pdf_path)
    out = fitz.open()
    out.insert_pdf(src, from_page=row["start_page"] - 1, to_page=row["end_page"] - 1)
    pdf_bytes = out.tobytes()
    return Response(content=pdf_bytes, media_type="application/pdf")


# ── Quiz ──────────────────────────────────────────────────────────────────────

import random

@app.get("/api/chapters/{chapter_id}/quiz")
def get_quiz(chapter_id: int):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT quiz_json FROM chapters WHERE id = ?", (chapter_id,)
        ).fetchone()
    if not row or not row["quiz_json"]:
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = json.loads(row["quiz_json"])
    random.shuffle(questions)
    return questions


class EvaluateRequest(BaseModel):
    chapter_id: int
    question: str
    question_type: str  # "mcq" or "descriptive"
    correct_answer: str
    user_answer: str


@app.post("/api/quiz/evaluate")
async def evaluate_answer(req: EvaluateRequest):
    if req.question_type == "mcq":
        correct = req.user_answer.strip().lower() == req.correct_answer.strip().lower()
        return {"correct": correct, "explanation": None if correct else f"Correct answer: {req.correct_answer}"}

    # Descriptive — ask Gemini
    with get_conn() as conn:
        row = conn.execute(
            "SELECT page_index FROM chapters WHERE id = ?", (req.chapter_id,)
        ).fetchone()
    page_index = json.loads(row["page_index"]) if row and row["page_index"] else {}
    result = await ai.evaluate_descriptive(req.question, req.correct_answer, req.user_answer, page_index)
    return result


# ── Ask AI ────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str
    chapter_id: int | None = None
    history: list[dict] = []


@app.post("/api/ask")
async def ask(req: AskRequest):
    # Always check cache first — persists across sessions
    cached = cache_lookup(req.question, req.chapter_id)
    if cached:
        return cached

    with get_conn() as conn:
        if req.chapter_id:
            rows = conn.execute(
                "SELECT id, chapter_name, page_index, summary FROM chapters WHERE id = ?",
                (req.chapter_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, chapter_name, page_index, summary FROM chapters"
            ).fetchall()

    chapters = [dict(r) for r in rows]
    if not chapters:
        raise HTTPException(status_code=404, detail="No chapters loaded yet. Please refresh first.")

    result = await ai.ask_with_rag(req.question, chapters, req.history)

    # Store in cache only for standalone questions (not mid-conversation)
    if not req.history:
        cache_store(req.question, req.chapter_id, result)

    return result


# ── Serve React frontend (production) ────────────────────────────────────────

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
