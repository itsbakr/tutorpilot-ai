"""
Test scaffolding: fake Supabase client + Gemini stubs.

The real Supabase client is replaced with an in-memory fake before any agent
module is imported. The Gemini wrappers (`call_gemini`, `call_gemini_multimodal`,
`call_gemini_with_images`, `call_perplexity`) are monkeypatched with stubs that
return canned JSON tuned to each agent's expected output shape.
"""

import asyncio
import json
import os
import sys
import types
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional
from uuid import uuid4

import pytest

# Ensure backend/ is on path
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


# ----------------------------------------------------------------------------
# Stub the third-party SDKs that the production code imports at module load.
# ----------------------------------------------------------------------------

def _install_module_stubs() -> None:
    # weave: zero-cost decorator + init
    weave = types.ModuleType("weave")
    def _op_decorator(*args, **kwargs):
        if args and callable(args[0]) and not kwargs:
            return args[0]
        def _wrap(f):
            return f
        return _wrap
    weave.op = _op_decorator
    weave.init = lambda *a, **k: None
    sys.modules["weave"] = weave

    # google.generativeai
    genai = types.ModuleType("google.generativeai")
    class _Model:
        def __init__(self, *a, **k): pass
        def generate_content(self, *a, **k):
            class R: text = ""
            return R()
    class _GC:
        def __init__(self, **k): pass
    genai.GenerativeModel = _Model
    genai.GenerationConfig = _GC
    genai.configure = lambda **k: None
    genai.upload_file = lambda *a, **k: types.SimpleNamespace(uri="fake://uri")
    google_pkg = types.ModuleType("google")
    google_pkg.generativeai = genai
    sys.modules["google"] = google_pkg
    sys.modules["google.generativeai"] = genai

    # openai (only AsyncOpenAI symbol referenced)
    openai_mod = types.ModuleType("openai")
    class _AsyncOpenAI:
        def __init__(self, *a, **k): pass
    openai_mod.AsyncOpenAI = _AsyncOpenAI
    sys.modules["openai"] = openai_mod

    # supabase
    supabase_mod = types.ModuleType("supabase")
    def _create_client(*a, **k):
        return _FakeSupabase()
    supabase_mod.create_client = _create_client
    supabase_mod.Client = object
    sys.modules["supabase"] = supabase_mod

    # dotenv (no-op)
    dotenv_mod = types.ModuleType("dotenv")
    dotenv_mod.load_dotenv = lambda *a, **k: None
    sys.modules["dotenv"] = dotenv_mod

    # httpx (only used inside call_perplexity which we stub anyway)
    if "httpx" not in sys.modules:
        httpx_mod = types.ModuleType("httpx")
        class _AsyncClient:
            def __init__(self, *a, **k): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *a): return None
            async def post(self, *a, **k):
                class _R:
                    status_code = 200
                    def raise_for_status(self): return None
                    def json(self): return {"choices":[{"message":{"content":"{}"}}],"citations":[]}
                return _R()
        class _HTTPStatusError(Exception):
            def __init__(self, *a, **k):
                super().__init__("")
                class _R: status_code = 500
                self.response = _R()
        httpx_mod.AsyncClient = _AsyncClient
        httpx_mod.HTTPStatusError = _HTTPStatusError
        sys.modules["httpx"] = httpx_mod


# ----------------------------------------------------------------------------
# In-memory fake of the Supabase client API surface used by our code.
# ----------------------------------------------------------------------------

class _Result:
    def __init__(self, data: List[Dict[str, Any]] = None):
        self.data = data or []


class _StorageBucket:
    def __init__(self, store: Dict[str, bytes]):
        self._store = store
    def upload(self, path: str, body: bytes, headers: Dict[str, str] = None):
        self._store[path] = body
        return _Result([{"path": path}])
    def download(self, path: str) -> bytes:
        return self._store.get(path, b"")
    def remove(self, paths):
        for p in paths or []:
            self._store.pop(p, None)


class _Storage:
    def __init__(self):
        self._buckets: Dict[str, Dict[str, bytes]] = {}
    def from_(self, bucket: str) -> _StorageBucket:
        return _StorageBucket(self._buckets.setdefault(bucket, {}))


class _Query:
    def __init__(self, table: "_Table", op: str, payload: Any = None):
        self.table = table
        self.op = op
        self.payload = payload
        self._filters: List[Callable[[Dict[str, Any]], bool]] = []
        self._or_filters: Optional[Callable[[Dict[str, Any]], bool]] = None
        self._select: str = "*"
        self._order: List[tuple] = []
        self._limit: Optional[int] = None
        self._single: bool = False
        self._upsert_on_conflict: Optional[str] = None

    # ----- filters -----
    def eq(self, col: str, val: Any) -> "_Query":
        self._filters.append(lambda r, c=col, v=val: r.get(c) == v)
        return self
    def neq(self, col: str, val: Any) -> "_Query":
        self._filters.append(lambda r, c=col, v=val: r.get(c) != v)
        return self
    def gte(self, col: str, val: Any) -> "_Query":
        self._filters.append(lambda r, c=col, v=val: (r.get(c) or "") >= v)
        return self
    def lte(self, col: str, val: Any) -> "_Query":
        self._filters.append(lambda r, c=col, v=val: (r.get(c) or "") <= v)
        return self
    def in_(self, col: str, vals: List[Any]) -> "_Query":
        s = set(vals or [])
        self._filters.append(lambda r, c=col: r.get(c) in s)
        return self
    def is_(self, col: str, val: Any) -> "_Query":
        v = None if val == "null" else val
        self._filters.append(lambda r, c=col, v=v: r.get(c) is v)
        return self
    def contains(self, col: str, val: Dict[str, Any]) -> "_Query":
        def _check(r, c=col, v=val):
            payload = r.get(c) or {}
            return all(payload.get(k) == vv for k, vv in (v or {}).items())
        self._filters.append(_check)
        return self
    def or_(self, expr: str) -> "_Query":
        # Best-effort: handle 'a.eq.X,b.eq.Y' shape
        clauses = []
        for part in expr.split(","):
            part = part.strip()
            if ".eq." in part:
                col, val = part.split(".eq.")
                clauses.append((col, val))
        def _check(r, clauses=clauses):
            return any(r.get(c) == v for c, v in clauses)
        self._or_filters = _check
        return self
    # ----- terminal builders -----
    def select(self, fields: str = "*") -> "_Query":
        self._select = fields
        return self
    def order(self, col: str, desc: bool = False, nullsfirst: bool = False, nulls_first: bool = False) -> "_Query":
        self._order.append((col, desc, nullsfirst or nulls_first))
        return self
    def limit(self, n: int) -> "_Query":
        self._limit = n
        return self
    def single(self) -> "_Query":
        self._single = True
        return self
    # ----- terminal executors -----
    def execute(self) -> _Result:
        if self.op == "select":
            return self._execute_select()
        if self.op == "insert":
            return self._execute_insert()
        if self.op == "update":
            return self._execute_update()
        if self.op == "delete":
            return self._execute_delete()
        if self.op == "upsert":
            return self._execute_upsert()
        raise RuntimeError(f"Unknown op {self.op}")

    def _matches(self, r: Dict[str, Any]) -> bool:
        if self._or_filters and not self._or_filters(r):
            return False
        for f in self._filters:
            if not f(r):
                return False
        return True

    def _execute_select(self) -> _Result:
        rows = [r for r in self.table.rows if self._matches(r)]
        for col, desc, nulls_first in reversed(self._order):
            def _key(r, col=col, nulls_first=nulls_first):
                v = r.get(col)
                if v is None:
                    return (0 if nulls_first else 2, "")
                return (1, v)
            rows.sort(key=_key, reverse=desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        return _Result(rows)

    def _execute_insert(self) -> _Result:
        payload = self.payload
        items = payload if isinstance(payload, list) else [payload]
        out = []
        for it in items:
            row = dict(it)
            row.setdefault("id", str(uuid4()))
            self.table.rows.append(row)
            out.append(row)
        return _Result(out)

    def _execute_upsert(self) -> _Result:
        payload = self.payload
        items = payload if isinstance(payload, list) else [payload]
        out = []
        keys = (self._upsert_on_conflict or "").split(",") if self._upsert_on_conflict else []
        for it in items:
            row = dict(it)
            existing = None
            if keys:
                for r in self.table.rows:
                    if all(r.get(k) == row.get(k) for k in keys):
                        existing = r
                        break
            if existing is not None:
                existing.update(row)
                out.append(existing)
            else:
                row.setdefault("id", str(uuid4()))
                self.table.rows.append(row)
                out.append(row)
        return _Result(out)

    def _execute_update(self) -> _Result:
        out = []
        for r in self.table.rows:
            if self._matches(r):
                r.update(self.payload or {})
                out.append(r)
        return _Result(out)

    def _execute_delete(self) -> _Result:
        kept = []
        out = []
        for r in self.table.rows:
            if self._matches(r):
                out.append(r)
            else:
                kept.append(r)
        self.table.rows = kept
        return _Result(out)


class _Table:
    def __init__(self, name: str):
        self.name = name
        self.rows: List[Dict[str, Any]] = []
    def select(self, fields: str = "*") -> _Query:
        q = _Query(self, "select")
        q._select = fields
        return q
    def insert(self, payload: Any) -> _Query:
        return _Query(self, "insert", payload)
    def update(self, payload: Any) -> _Query:
        return _Query(self, "update", payload)
    def delete(self) -> _Query:
        return _Query(self, "delete")
    def upsert(self, payload: Any, on_conflict: str = None) -> _Query:
        q = _Query(self, "upsert", payload)
        q._upsert_on_conflict = on_conflict
        return q


class _FakeSupabase:
    def __init__(self):
        self._tables: Dict[str, _Table] = {}
        self.storage = _Storage()
    def table(self, name: str) -> _Table:
        return self._tables.setdefault(name, _Table(name))


# ----------------------------------------------------------------------------
# Bootstrap order matters: install module stubs first, then import production.
# ----------------------------------------------------------------------------

_install_module_stubs()

# Force env vars so any "must be set" guards pass under tests.
os.environ.setdefault("GOOGLE_GEMINI_API_KEY", "test")
os.environ.setdefault("PERPLEXITY_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "test")
os.environ.setdefault("TUTORPILOT_SCHEDULER_DISABLED", "1")


# Now import the supabase_client module so its `supabase` is our fake.
from db import supabase_client as _sb_mod  # noqa: E402

# Replace the module-level `supabase` everywhere it has already been imported
@pytest.fixture(scope="session")
def fake_db() -> _FakeSupabase:
    return _sb_mod.supabase


@pytest.fixture(autouse=True)
def reset_db(fake_db: _FakeSupabase):
    """Clear all tables + storage between tests."""
    for t in list(fake_db._tables.values()):
        t.rows.clear()
    fake_db.storage._buckets.clear()
    yield


# ----------------------------------------------------------------------------
# Gemini stubbing
# ----------------------------------------------------------------------------

class GeminiStub:
    """Per-test queue of canned responses, matched in order."""

    def __init__(self):
        self.responses: List[str] = []
        self.calls: List[Dict[str, Any]] = []

    def push(self, payload: Any) -> None:
        self.responses.append(payload if isinstance(payload, str) else json.dumps(payload))

    async def call_gemini(self, prompt: str, temperature: float = 0.7, max_tokens: int = 2000) -> str:
        self.calls.append({"kind": "text", "prompt": prompt, "temperature": temperature})
        return self._next()

    async def call_gemini_multimodal(self, prompt: str, **kw) -> str:
        self.calls.append({"kind": "multimodal", "prompt": prompt, **kw})
        return self._next()

    async def call_gemini_with_images(self, prompt: str, images=None, **kw) -> str:
        self.calls.append({"kind": "images", "prompt": prompt, "image_count": len(images or []), **kw})
        return self._next()

    async def call_perplexity(self, prompt: str, **kw):
        self.calls.append({"kind": "perplexity", "prompt": prompt})
        return {"content": self._next(), "sources": [{"url": "https://example.org/std", "title": "Sample"}]}

    async def upload_gemini_file(self, *a, **k) -> str:
        return "fake://uri"

    def _next(self) -> str:
        if not self.responses:
            return "{}"
        return self.responses.pop(0)


@pytest.fixture
def gemini(monkeypatch) -> GeminiStub:
    stub = GeminiStub()
    # Patch in services.ai_service
    from services import ai_service
    monkeypatch.setattr(ai_service, "call_gemini", stub.call_gemini)
    monkeypatch.setattr(ai_service, "call_gemini_multimodal", stub.call_gemini_multimodal)
    monkeypatch.setattr(ai_service, "call_gemini_with_images", stub.call_gemini_with_images)
    monkeypatch.setattr(ai_service, "call_perplexity", stub.call_perplexity)
    monkeypatch.setattr(ai_service, "upload_gemini_file", stub.upload_gemini_file)
    # Also patch the references that agent modules already imported at module-load
    # (Python binds names at import time)
    for mod_name in [
        "agents.session_assessor",
        "agents.feedback_generator",
        "agents.standards_aligner",
        "agents.briefing_agent",
        "agents.voice_memo_agent",
        "agents.homework_generator",
        "agents.homework_checker",
        "agents.misconception_detector",
        "agents.difficulty_calibrator",
        "agents.language_adapter",
        "agents.integrity_check",
        "services.transcription_service",
    ]:
        if mod_name in sys.modules:
            mod = sys.modules[mod_name]
            for sym in ("call_gemini", "call_gemini_multimodal", "call_gemini_with_images",
                         "call_perplexity", "upload_gemini_file"):
                if hasattr(mod, sym):
                    monkeypatch.setattr(mod, sym, getattr(stub, sym))
    return stub


# ----------------------------------------------------------------------------
# Helpers for seeding state
# ----------------------------------------------------------------------------

@pytest.fixture
def seed(fake_db: _FakeSupabase):
    """Convenient seeded entities — use directly or extend in tests."""
    tutor_id = str(uuid4())
    student_id = str(uuid4())
    fake_db.table("tutors").insert({
        "id": tutor_id, "name": "Dr. Test", "email": "test@example.com",
        "education_system": "IGCSE", "teaching_style": "Socratic",
        "timezone": "UTC", "preferred_language": "en",
    }).execute()
    fake_db.table("students").insert({
        "id": student_id, "tutor_id": tutor_id, "name": "Alex Chen",
        "grade": "10", "subject": "Physics", "learning_style": "Visual",
        "languages": ["English"], "interests": ["space", "robotics"],
        "objectives": ["Ace IGCSE Physics"],
    }).execute()
    return {"tutor_id": tutor_id, "student_id": student_id}
