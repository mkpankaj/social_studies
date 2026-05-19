"""
Run once to clear all chapter rows and reset step2/step3 so Refresh re-detects
chapter names correctly (from the Contents page).

OCR data (step1) is preserved — you won't need to re-scan pages.

Usage:
  cd backend
  venv/Scripts/python.exe reset_chapters.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "social_studies.db")

if not os.path.exists(DB_PATH):
    print("DB not found — nothing to reset.")
    exit()

conn = sqlite3.connect(DB_PATH)
conn.execute("DELETE FROM chapters")
conn.execute("""
    UPDATE documents
    SET step2_status = NULL,
        step2_error  = NULL,
        step3_status = NULL,
        step3_error  = NULL
    WHERE step1_status = 'success'
""")
conn.commit()
conn.close()
print("Done. All chapter rows cleared; step1 OCR data preserved.")
print("Click Refresh in the app to re-detect chapters from Contents pages.")
