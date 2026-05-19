import os
import json
import asyncio
import random
import google.genai as genai
from google.genai import types
from tavily import TavilyClient

_client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
_model = "gemini-2.0-flash"
_tavily = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
_sem = asyncio.Semaphore(2)  # cap concurrent Gemini calls to avoid quota exhaustion


async def _call(prompt_parts: list) -> str:
    max_retries = 7
    base_delay = 5

    for attempt in range(max_retries):
        try:
            async with _sem:
                response = await _client.aio.models.generate_content(
                    model=_model, contents=prompt_parts
                )
            return response.text.strip()
        except Exception as e:
            is_rate_limit = "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e)
            if is_rate_limit and attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                await asyncio.sleep(delay)
            else:
                raise


def _parse_json(text: str) -> any:
    clean = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(clean)


async def ocr_page(image_bytes: bytes, page_num: int) -> dict:
    """Extract structured text from a scanned page image via Gemini Vision."""
    prompt = """You are extracting content from a scanned Class 5 Social Studies textbook page.

Return a JSON object with this exact structure:
{
  "page": """ + str(page_num) + """,
  "heading": "<main section heading on this page, or null if continuation>",
  "subheading": "<sub-section heading if present, or null>",
  "content": "<all readable text on this page, preserving paragraph breaks with \\n\\n>"
}

Rules:
- Extract ALL visible text
- If this page continues a prior section, set heading to null
- For end-of-chapter exercises, use heading "Exercises"
- Return ONLY the JSON object, no markdown"""

    img_part = types.Part.from_bytes(data=image_bytes, mime_type="image/png")
    text = await _call([prompt, img_part])
    result = _parse_json(text)
    result["page"] = page_num
    return result


async def extract_chapters_from_contents_page(contents_text: str) -> list[dict]:
    """Extract authoritative chapter list from a Contents page. Returns [{chapter_number, chapter_name, page_number}]."""
    prompt = f"""This is OCR text from the Contents page of a Class 5 Social Studies textbook.
The chapter number boxes may not appear in the OCR text — assign chapter numbers sequentially (1, 2, 3...) based on the order chapters appear in the list.

Contents page text:
{contents_text}

Return a JSON array:
[
  {{"chapter_number": 1, "chapter_name": "The Imaginary Lines", "page_number": 9}},
  {{"chapter_number": 2, "chapter_name": "Movements of the Earth", "page_number": 16}},
  ...
]

Rules:
- Assign chapter_number sequentially starting from 1, in the order chapters appear
- Include the page_number exactly as shown next to each chapter name (the number at the end of the dotted line)
- Include ONLY main chapter entries — skip: Assessment, Exercises, Map Practice, From Theory to Practice, G20 Summit, Artificial Intelligence, Appendix, and any unnumbered supplementary sections
- Use the EXACT chapter name as printed — do not paraphrase or abbreviate
- Return ONLY the JSON array, no markdown"""

    text = await _call([prompt])
    result = _parse_json(text)
    # Ensure chapter_number is present; fall back to sequential index
    for i, item in enumerate(result):
        if "chapter_number" not in item:
            item["chapter_number"] = i + 1
    return result


async def extract_chapter_list(ocr_pages: list[dict], known_chapters: list[dict] = None) -> list[dict]:
    """Identify chapter boundaries from OCR page headings. Returns [{chapter_number, chapter_name, start_page}]."""
    page_data = [
        {
            "pdf_page": p["page"],
            "heading": p.get("heading"),
            "content_start": (p.get("content") or "")[:150],
        }
        for p in ocr_pages
    ]

    reference_block = ""
    if known_chapters:
        refs = [
            f'{c.get("chapter_number", i + 1)}. {c.get("chapter_name", "")} (textbook page {c["page_number"]})'
            if "page_number" in c
            else f'{c.get("chapter_number", i + 1)}. {c.get("chapter_name", "")}'
            for i, c in enumerate(known_chapters)
        ]
        reference_block = f"""
The definitive chapter list (from the Contents page) with textbook page numbers:
{chr(10).join(refs)}

MATCHING RULES:
- A page is a chapter start ONLY if its heading matches a chapter name from the list above
  AND the printed textbook page number visible in content_start matches that chapter's page number
- Sub-section headings (like "Exercises", "Humidity and Rainfall", topic names within a chapter,
  assessment titles) are NOT in this list and must NEVER be identified as chapters
- Only report chapters that actually appear in this PDF"""

    prompt = f"""You are analyzing OCR data from a Class 5 Social Studies textbook PDF.
Each entry has: "pdf_page" (position in the PDF file), "heading" (detected section heading),
and "content_start" (first 150 characters of the page text, which usually contains the printed
textbook page number).

Pages:
{json.dumps(page_data, indent=2)}
{reference_block}

Identify where each chapter starts by matching BOTH the heading AND the printed textbook page
number in content_start against the reference list above.

Return a JSON array:
[
  {{"chapter_number": 4, "chapter_name": "Weather and Climate", "start_page": <pdf_page>}},
  ...
]

Rules:
- start_page must be the pdf_page value (not the textbook page number)
- Only report chapters that actually appear in this PDF
- Match chapter names exactly to the reference list — do not invent names
- Return ONLY the JSON array, no markdown"""

    text = await _call([prompt])
    return _parse_json(text)


async def build_page_index(chapter_name: str, pages: list[dict]) -> dict:
    """Group OCR'd pages into a hierarchical PageIndex structure."""
    prompt = f"""Organize these textbook pages into a structured chapter index.

Chapter: "{chapter_name}"
Pages:
{json.dumps(pages, indent=2)}

Return a JSON object:
{{
  "chapter": "<chapter name>",
  "sections": [
    {{
      "title": "<section title>",
      "summary": "<2-3 sentence summary for search routing>",
      "pages": [<page numbers>],
      "content": "<combined full text of all pages in this section>"
    }}
  ]
}}

Rules:
- Group consecutive pages under the same heading into one section
- Infer section title from heading or content if heading is null
- Summaries must be specific enough to route search queries
- Return ONLY the JSON object"""

    text = await _call([prompt])
    return _parse_json(text)


async def generate_summary(page_index: dict) -> str:
    """Generate a 150-200 word chapter summary for Class 5 students."""
    all_content = "\n\n".join(s["content"] for s in page_index.get("sections", []))
    prompt = f"""Write a clear, engaging summary of this Social Studies chapter for Class 5 students.
Keep it 150-200 words covering the key concepts.

Chapter: {page_index.get('chapter', '')}

Content:
{all_content[:8000]}

Return only the summary text, no headings."""

    return await _call([prompt])


async def generate_quiz(page_index: dict) -> list[dict]:
    """Generate 15 quiz questions: 10 MCQ + 5 descriptive."""
    all_content = "\n\n".join(s["content"] for s in page_index.get("sections", []))
    prompt = f"""Create exactly 15 quiz questions for Class 5 students on this chapter.
First 10 must be MCQ, last 5 must be descriptive.

Chapter: {page_index.get('chapter', '')}
Content:
{all_content[:10000]}

Return a JSON array of 15 objects.

MCQ format:
{{
  "type": "mcq",
  "question": "<question>",
  "options": ["A. <opt>", "B. <opt>", "C. <opt>", "D. <opt>"],
  "correct_answer": "<full correct option, e.g. A. option text>",
  "explanation": "<why this is correct>"
}}

Descriptive format:
{{
  "type": "descriptive",
  "question": "<question requiring 2-3 sentence answer>",
  "correct_answer": "<model answer in 2-3 sentences>",
  "explanation": "<key points expected in answer>"
}}

Return ONLY the JSON array."""

    text = await _call([prompt])
    return _parse_json(text)


async def evaluate_descriptive(question: str, correct_answer: str, user_answer: str, page_index: dict) -> dict:
    """Evaluate a descriptive answer. Returns correct (bool), score (0-100), explanation."""
    prompt = f"""Evaluate a Class 5 student's answer.

Question: {question}
Model Answer: {correct_answer}
Student's Answer: {user_answer}

Return JSON:
{{
  "correct": <true if score >= 85, else false>,
  "score": <0-100 percentage match>,
  "explanation": "<brief helpful feedback>"
}}
Return ONLY the JSON object."""

    text = await _call([prompt])
    result = _parse_json(text)
    result["correct"] = result.get("score", 0) >= 85
    return result


async def ask_with_rag(question: str, chapters: list[dict], history: list[dict]) -> dict:
    """3-step hierarchical RAG: chapter routing → section routing → answer generation."""

    # Step 1: Route to best chapter
    chapter_index = [
        {"id": c["id"], "name": c["chapter_name"], "summary": c["summary"]}
        for c in chapters
    ]
    route_text = await _call([
        f"""Question: "{question}"

Pick the most relevant chapter:
{json.dumps(chapter_index, indent=2)}

Return JSON: {{"chapter_id": <id>}}
Return ONLY JSON."""
    ])
    route = _parse_json(route_text)
    chosen = next((c for c in chapters if c["id"] == route.get("chapter_id")), chapters[0])

    page_index = json.loads(chosen["page_index"]) if chosen.get("page_index") else {}
    sections = page_index.get("sections", [])

    # Step 2: Route to best 1-2 sections
    section_index = [{"title": s["title"], "summary": s["summary"]} for s in sections]
    section_text = await _call([
        f"""Question: "{question}"

Pick the 1-2 most relevant sections:
{json.dumps(section_index, indent=2)}

Return JSON: {{"titles": ["<title>"]}}
Return ONLY JSON."""
    ])
    section_route = _parse_json(section_text)
    chosen_titles = section_route.get("titles", [])

    relevant_content = "\n\n".join(
        s["content"] for s in sections if s["title"] in chosen_titles
    ) or "\n\n".join(s["content"] for s in sections[:2])

    # Step 3: Generate answer
    history_text = ""
    if history:
        history_text = "Previous conversation:\n" + "\n".join(
            f"Q: {h['question']}\nA: {h['answer']}" for h in history[-3:]
        ) + "\n\n"

    answer = await _call([
        f"""You are a helpful Social Studies teacher for Class 5 students.
Answer using ONLY the chapter content below. Be clear and age-appropriate.

{history_text}Question: {question}

Chapter content:
{relevant_content[:6000]}

Give a clear factual answer in 3-5 sentences."""
    ])

    # Step 4: Tavily internet search for additional info
    internet_sources = []
    try:
        results = _tavily.search(question, max_results=2, search_depth="basic")
        for r in results.get("results", []):
            internet_sources.append({
                "title": r.get("title"),
                "url": r.get("url"),
                "snippet": r.get("content", "")[:300],
            })
    except Exception:
        pass

    return {
        "question": question,
        "chapter_name": chosen["chapter_name"],
        "answer": answer,
        "internet_sources": internet_sources,
    }
