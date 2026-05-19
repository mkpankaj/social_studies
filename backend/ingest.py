import os
import json
import asyncio
import fitz  # PyMuPDF

import database as db
import gemini as ai


def _get_pending_docs(content_dir: str) -> list[dict]:
    pdf_files = sorted([f for f in os.listdir(content_dir) if f.lower().endswith(".pdf")])
    if not pdf_files:
        return []

    pending = []
    for filename in pdf_files:
        doc = db.get_document(filename)
        needs_step1 = doc is None or doc["step1_status"] != "success"

        if needs_step1:
            pending.append({"filename": filename, "needs_step1": True, "needs_step2": True, "needs_step3": True})
            continue

        chapters = db.get_chapters_for_doc(filename)
        needs_step2 = not chapters or any(c["step2_status"] != "success" for c in chapters)
        needs_step3 = any(c["step3_status"] != "success" for c in chapters)

        # A doc with no chapters yet always needs step2 (and therefore step3)
        if not chapters:
            needs_step3 = True

        if needs_step2 or needs_step3:
            pending.append({
                "filename": filename,
                "needs_step1": False,
                "needs_step2": needs_step2,
                "needs_step3": needs_step3,
            })

    return pending


async def _step1_ocr(content_dir: str, filename: str):
    """OCR all pages concurrently. Saves ocr_pages + step1_status to documents table."""
    pdf_path = os.path.join(content_dir, filename)
    doc = fitz.open(pdf_path)
    page_count = len(doc)
    page_images = [doc[i].get_pixmap(dpi=150).tobytes("png") for i in range(page_count)]
    doc.close()

    db.upsert_document(filename, page_count)
    with db.get_conn() as conn:
        conn.execute(
            "UPDATE documents SET page_count = ?, step1_status = 'in_progress', step1_pages_done = 0, step1_error = NULL WHERE filename = ?",
            (page_count, filename),
        )

    yield {"step": "ocr", "file": filename, "total": page_count}

    progress = [0]

    async def _ocr_one(img_bytes: bytes, page_num: int) -> dict:
        result = await ai.ocr_page(img_bytes, page_num)
        progress[0] += 1
        with db.get_conn() as conn:
            conn.execute(
                "UPDATE documents SET step1_pages_done = ? WHERE filename = ?",
                (progress[0], filename),
            )
        return result

    results = await asyncio.gather(
        *[_ocr_one(img, i + 1) for i, img in enumerate(page_images)],
        return_exceptions=True,
    )

    ocr_pages = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            ocr_pages.append({"page": i + 1, "heading": None, "subheading": None, "content": ""})
        else:
            ocr_pages.append(r)

    with db.get_conn() as conn:
        conn.execute(
            "UPDATE documents SET ocr_pages = ?, page_count = ?, step1_status = 'success', step1_pages_done = ?, loaded_at = CURRENT_TIMESTAMP WHERE filename = ?",
            (json.dumps(ocr_pages), page_count, page_count, filename),
        )


async def _step2_for_doc(filename: str, ocr_pages: list[dict], global_known_chapters: list[dict] = None):
    """Identify chapters then build PageIndex for each chapter that needs it."""
    chapters = db.get_chapters_for_doc(filename)

    # First-time: call Gemini to identify chapter boundaries
    if not chapters:
        # Look for a Contents page within this doc first
        contents_page = next(
            (p for p in ocr_pages if "contents" in (p.get("heading") or "").lower()),
            None
        )

        known_chapters = None
        if contents_page:
            try:
                known_chapters = await ai.extract_chapters_from_contents_page(contents_page.get("content", ""))
            except Exception:
                known_chapters = None

        # Fall back to global reference (from doc_01's Contents page)
        if not known_chapters:
            known_chapters = global_known_chapters

        chapter_list = await ai.extract_chapter_list(ocr_pages, known_chapters=known_chapters)

        # Fallback: treat whole PDF as one chapter
        if not chapter_list:
            first_heading = next(
                (p.get("heading") for p in ocr_pages
                 if p.get("heading") and "contents" not in p.get("heading", "").lower()),
                filename.replace(".pdf", "").replace("_", " ").title(),
            )
            chapter_list = [{"chapter_number": 1, "chapter_name": first_heading, "start_page": 1}]

        total_pages = len(ocr_pages)
        for i, ch in enumerate(chapter_list):
            end_page = chapter_list[i + 1]["start_page"] - 1 if i + 1 < len(chapter_list) else total_pages
            db.upsert_chapter(filename, ch["chapter_number"], ch["chapter_name"], ch["start_page"], end_page)

        chapters = db.get_chapters_for_doc(filename)

    # Build PageIndex for each chapter that needs it
    for chapter in chapters:
        if chapter["step2_status"] == "success":
            continue

        ch_num = chapter["chapter_number"]
        ch_name = chapter["chapter_name"]
        start_page = chapter["start_page"]
        end_page = chapter["end_page"]

        ch_pages = [p for p in ocr_pages if start_page <= p["page"] <= end_page]

        with db.get_conn() as conn:
            conn.execute(
                "UPDATE chapters SET step2_status = 'in_progress', step2_error = NULL WHERE doc_filename = ? AND chapter_number = ? AND step2_status != 'success'",
                (filename, ch_num),
            )

        try:
            page_index = await ai.build_page_index(ch_name, ch_pages)
            db.update_chapter_step2(filename, ch_num, json.dumps(page_index), "success")
        except Exception as e:
            db.update_chapter_step2(filename, ch_num, None, "failed", str(e))

        db.aggregate_doc_status(filename)
        yield {"step": "index_chapter", "file": filename, "chapter": ch_name}
        await asyncio.sleep(3)


async def _step3_for_doc(filename: str):
    """Generate summary + quiz for each chapter that has step2 done but step3 pending/failed."""
    for chapter in db.get_chapters_for_doc(filename):
        if chapter["step2_status"] != "success":
            continue
        if chapter["step3_status"] == "success":
            continue

        ch_num = chapter["chapter_number"]
        ch_name = chapter["chapter_name"]
        page_index = json.loads(chapter["page_index"]) if chapter.get("page_index") else {}

        with db.get_conn() as conn:
            conn.execute(
                "UPDATE chapters SET step3_status = 'in_progress', step3_error = NULL WHERE doc_filename = ? AND chapter_number = ? AND step3_status != 'success'",
                (filename, ch_num),
            )

        try:
            summary = await ai.generate_summary(page_index)
            await asyncio.sleep(3)
            quiz = await ai.generate_quiz(page_index)
            db.update_chapter_step3(filename, ch_num, summary, json.dumps(quiz), "success")
        except Exception as e:
            db.update_chapter_step3(filename, ch_num, None, None, "failed", str(e))

        db.aggregate_doc_status(filename)
        yield {"step": "summary_chapter", "file": filename, "chapter": ch_name}


async def _get_global_known_chapters() -> list[dict] | None:
    """Extract master chapter list (with page numbers) from the doc that has a Contents page."""
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT ocr_pages FROM documents WHERE ocr_pages IS NOT NULL"
        ).fetchall()
    for row in rows:
        pages = json.loads(row["ocr_pages"])
        contents_page = next(
            (p for p in pages if "contents" in (p.get("heading") or "").lower()),
            None,
        )
        if contents_page:
            try:
                return await ai.extract_chapters_from_contents_page(contents_page.get("content", ""))
            except Exception:
                return None
    return None


def _reset_stale_progress():
    """Any 'in_progress' left from a previous crashed run becomes 'failed' so it gets retried cleanly."""
    with db.get_conn() as conn:
        conn.execute("UPDATE documents SET step1_status = 'failed' WHERE step1_status = 'in_progress'")
        conn.execute("UPDATE chapters SET step2_status = 'failed' WHERE step2_status = 'in_progress'")
        conn.execute("UPDATE chapters SET step3_status = 'failed' WHERE step3_status = 'in_progress'")
    db._reaggregate_all_docs()


async def run(content_dir: str):
    """Process all pending PDFs sequentially, yielding SSE progress events."""
    _reset_stale_progress()

    # Extract master chapter list once from whichever doc has the Contents page (doc_01)
    global_known_chapters = await _get_global_known_chapters()

    pending = _get_pending_docs(content_dir)

    if not pending:
        yield {"step": 1, "message": "All files already loaded. Nothing to refresh."}
        return

    earliest = 1
    if all(not item["needs_step1"] for item in pending):
        earliest = 3 if all(not item["needs_step2"] for item in pending) else 2
    yield {"step": 1, "message": f"{len(pending)} file(s) to process.", "current_step": earliest}

    for item in pending:
        filename = item["filename"]
        yield {"file": filename, "step": "start"}

        # ── Step 1: OCR ──────────────────────────────────────────────────────
        if item["needs_step1"]:
            try:
                async for event in _step1_ocr(content_dir, filename):
                    yield event
            except Exception as e:
                with db.get_conn() as conn:
                    conn.execute(
                        "UPDATE documents SET step1_status = 'failed', step1_error = ? WHERE filename = ?",
                        (str(e), filename),
                    )
                yield {"file": filename, "step": "error", "stage": "ocr", "error": str(e)}
                continue

        doc = db.get_document(filename)
        ocr_pages = json.loads(doc["ocr_pages"]) if doc and doc.get("ocr_pages") else []

        # ── Step 2: Chapter identification + PageIndex per chapter ────────────
        if item["needs_step2"]:
            yield {"step": "index", "file": filename}
            try:
                async for event in _step2_for_doc(filename, ocr_pages, global_known_chapters):
                    yield event
            except Exception as e:
                with db.get_conn() as conn:
                    conn.execute(
                        "UPDATE documents SET step2_status = 'failed', step2_error = ? WHERE filename = ?",
                        (str(e), filename),
                    )
                yield {"file": filename, "step": "error", "stage": "index", "error": str(e)}
                continue

        # ── Step 3: Summary + Quiz per chapter ───────────────────────────────
        if item["needs_step3"]:
            yield {"step": "summary", "file": filename}
            try:
                async for event in _step3_for_doc(filename):
                    yield event
            except Exception as e:
                with db.get_conn() as conn:
                    conn.execute(
                        "UPDATE documents SET step3_status = 'failed', step3_error = ? WHERE filename = ?",
                        (str(e), filename),
                    )
                yield {"file": filename, "step": "error", "stage": "summary", "error": str(e)}
                continue

        done_chapters = [c["chapter_name"] for c in db.get_chapters_for_doc(filename) if c["step3_status"] == "success"]
        yield {"step": "done_file", "file": filename, "chapters": done_chapters}
