import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "social_studies.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                filename         TEXT PRIMARY KEY,
                page_count       INTEGER,
                ocr_pages        TEXT,
                step1_status     TEXT,
                step1_pages_done INTEGER,
                step1_error      TEXT,
                step2_status     TEXT,
                step2_error      TEXT,
                step3_status     TEXT,
                step3_error      TEXT,
                loaded_at        DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chapters (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_filename   TEXT NOT NULL,
                chapter_number INTEGER NOT NULL,
                chapter_name   TEXT,
                start_page     INTEGER,
                end_page       INTEGER,
                page_index     TEXT,
                summary        TEXT,
                quiz_json      TEXT,
                step2_status   TEXT DEFAULT 'pending',
                step2_error    TEXT,
                step3_status   TEXT DEFAULT 'pending',
                step3_error    TEXT,
                loaded_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (doc_filename, chapter_number)
            )
        """)


def upsert_document(filename: str, page_count: int = None):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO documents (filename, page_count, step1_status)
            VALUES (?, ?, 'pending')
            ON CONFLICT(filename) DO NOTHING
        """, (filename, page_count))


def get_document(filename: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM documents WHERE filename = ?", (filename,)).fetchone()
        return dict(row) if row else None


def get_chapters_for_doc(doc_filename: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM chapters WHERE doc_filename = ? ORDER BY chapter_number",
            (doc_filename,),
        ).fetchall()
        return [dict(r) for r in rows]


def upsert_chapter(doc_filename: str, chapter_number: int, chapter_name: str, start_page: int, end_page: int):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO chapters (doc_filename, chapter_number, chapter_name, start_page, end_page)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(doc_filename, chapter_number) DO NOTHING
        """, (doc_filename, chapter_number, chapter_name, start_page, end_page))


def update_chapter_step2(doc_filename: str, chapter_number: int, page_index: str, status: str, error: str = None):
    with get_conn() as conn:
        conn.execute("""
            UPDATE chapters SET page_index = ?, step2_status = ?, step2_error = ?
            WHERE doc_filename = ? AND chapter_number = ?
        """, (page_index, status, error, doc_filename, chapter_number))


def update_chapter_step3(doc_filename: str, chapter_number: int, summary: str, quiz_json: str, status: str, error: str = None):
    with get_conn() as conn:
        conn.execute("""
            UPDATE chapters
            SET summary = ?, quiz_json = ?, step3_status = ?, step3_error = ?, loaded_at = CURRENT_TIMESTAMP
            WHERE doc_filename = ? AND chapter_number = ?
        """, (summary, quiz_json, status, error, doc_filename, chapter_number))


def _reaggregate_all_docs():
    """Re-run aggregate_doc_status for every document. Called after resetting stale progress."""
    with get_conn() as conn:
        filenames = [r[0] for r in conn.execute("SELECT filename FROM documents").fetchall()]
    for fn in filenames:
        aggregate_doc_status(fn)


def aggregate_doc_status(doc_filename: str):
    """Roll up chapter step2/step3 statuses into the documents table."""
    chapters = get_chapters_for_doc(doc_filename)
    if not chapters:
        return

    def agg(statuses: list[str]) -> str:
        if all(s == "success" for s in statuses):
            return "success"
        if any(s == "failed" for s in statuses):
            return "failed"
        if any(s == "in_progress" for s in statuses):
            return "in_progress"
        return "pending"

    s2 = agg([c["step2_status"] for c in chapters])
    s3 = agg([c["step3_status"] for c in chapters])
    with get_conn() as conn:
        conn.execute(
            "UPDATE documents SET step2_status = ?, step3_status = ? WHERE filename = ?",
            (s2, s3, doc_filename),
        )
