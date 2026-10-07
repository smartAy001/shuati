"""SQLite 数据库连接与建表。"""
import sqlite3

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS question_set (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    file_name TEXT,
    has_answers INTEGER DEFAULT 0,
    answer_location TEXT DEFAULT 'auto',
    source_type TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS question (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL,
    number INTEGER,
    type TEXT,
    stem TEXT,
    options TEXT,
    answer TEXT,
    explanation TEXT,
    score REAL DEFAULT 0,
    FOREIGN KEY(set_id) REFERENCES question_set(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS practice_session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL,
    mode TEXT DEFAULT 'order',
    status TEXT DEFAULT 'in_progress',
    question_order TEXT,
    answers TEXT,
    scores TEXT,
    results TEXT,
    total_score REAL DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    created_at TEXT,
    submitted_at TEXT,
    FOREIGN KEY(set_id) REFERENCES question_set(id) ON DELETE CASCADE
);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
