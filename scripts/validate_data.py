#!/usr/bin/env python3
"""Validate data/*.json against docs/data-schema.md. Stdlib only. Exit 1 on any error."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
MEASURES = {"T", "I", "OE"}
CONCEPT_GROUPS = {"goal-measures", "flow-physics", "constraint-mgmt", "scheduling",
                  "thinking-processes", "change", "later-toc", "adjacent"}
TOOL_KINDS = {"simulator", "calculator", "template", "checklist", "board"}
SOURCE_TYPES = {"book", "paper", "web", "repo", "video", "image", "org", "summary"}
DIAGRAM_KINDS = {"flow", "tree", "cloud", "loop", "series", "triangle"}
OPEN_IMAGE = ("CC", "public-domain")

errors = []


def err(where, msg):
    errors.append(f"{where}: {msg}")


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        err(path.relative_to(ROOT), "missing file")
    except json.JSONDecodeError as e:
        err(path.relative_to(ROOT), f"bad JSON: {e}")
    return None


def words(s):
    return len(str(s).split())


def check_fields(where, obj, spec):
    """spec: key -> (type or tuple of types, required)."""
    if not isinstance(obj, dict):
        err(where, "not an object")
        return False
    for key, (typ, required) in spec.items():
        if key not in obj:
            if required:
                err(where, f"missing key '{key}'")
            continue
        if not isinstance(obj[key], typ) or (typ is int and isinstance(obj[key], bool)):
            err(where, f"key '{key}' has wrong type {type(obj[key]).__name__}")
    for key in obj:
        if key not in spec:
            err(where, f"unknown key '{key}'")
    return True


def str_list(where, obj, key, min_len=0):
    val = obj.get(key)
    if not isinstance(val, list):
        return []
    if len(val) < min_len:
        err(where, f"'{key}' needs at least {min_len} item(s)")
    for v in val:
        if not isinstance(v, str) or not v.strip():
            err(where, f"'{key}' has a non-string or empty item")
    return [v for v in val if isinstance(v, str)]


def ids_of(where, items):
    seen = set()
    for i, it in enumerate(items):
        iid = it.get("id") if isinstance(it, dict) else None
        if not isinstance(iid, str) or not ID_RE.match(iid):
            err(f"{where}[{i}]", f"bad id {iid!r}")
            continue
        if iid in seen:
            err(f"{where}[{i}]", f"duplicate id '{iid}'")
        seen.add(iid)
    return seen


def refs(where, vals, known, kind):
    for v in vals:
        if v not in known:
            err(where, f"broken {kind} ref '{v}'")


def top_list(doc, key, fname):
    if not isinstance(doc, dict) or not isinstance(doc.get(key), list):
        err(fname, f"top-level key '{key}' must be a list")
        return []
    return doc[key]


def main():
    sources_doc = load(DATA / "sources.json")
    concepts_doc = load(DATA / "concepts.json")
    tools_doc = load(DATA / "tools.json")
    chapters_doc = load(DATA / "chapters.json")
    books_doc = load(DATA / "books.json")

    sources = top_list(sources_doc, "sources", "sources.json") if sources_doc is not None else []
    concepts = top_list(concepts_doc, "concepts", "concepts.json") if concepts_doc is not None else []
    tools = top_list(tools_doc, "tools", "tools.json") if tools_doc is not None else []
    chapters = top_list(chapters_doc, "chapters", "chapters.json") if chapters_doc is not None else []
    books = top_list(books_doc, "books", "books.json") if books_doc is not None else []

    src_ids = ids_of("sources", sources)
    con_ids = ids_of("concepts", concepts)
    tool_ids = ids_of("tools", tools)
    book_ids = ids_of("books", books)

    diagram_files = sorted((DATA / "diagrams").glob("*.json"))
    diagrams = {}
    for p in diagram_files:
        d = load(p)
        if d is None:
            continue
        diagrams[p.stem] = d
    dia_ids = set(diagrams)

    # chapters
    ch_count = 0
    if isinstance(chapters_doc, dict):
        ed = chapters_doc.get("edition")
        if check_fields("chapters.edition", ed, {
                "basis": (str, True), "chapter_count": (int, True),
                "notes": (list, True), "refs": (list, True)}):
            ch_count = ed.get("chapter_count", 0) if isinstance(ed.get("chapter_count"), int) else 0
            refs("chapters.edition", str_list("chapters.edition", ed, "refs", 1), src_ids, "source")
        for k in chapters_doc:
            if k not in ("edition", "chapters"):
                err("chapters.json", f"unknown key '{k}'")
    nums = []
    for i, c in enumerate(chapters):
        w = f"chapters[{i}]"
        if not check_fields(w, c, {
                "n": (int, True), "title": (str, True), "concepts": (list, True),
                "events_as_mechanism": (list, True), "jonah_questions": (list, True),
                "measures_touched": (list, True), "diagram": ((str, type(None)), True),
                "refs": (list, True)}):
            continue
        n = c.get("n")
        if isinstance(n, int):
            nums.append(n)
            w = f"chapter {n}"
        if words(c.get("title", "")) > 8:
            err(w, "title over 8 words")
        refs(w, str_list(w, c, "concepts", 1), con_ids, "concept")
        str_list(w, c, "events_as_mechanism", 1)
        str_list(w, c, "jonah_questions")
        m = str_list(w, c, "measures_touched")
        for x in m:
            if x not in MEASURES:
                err(w, f"bad measure '{x}'")
        if len(set(m)) != len(m):
            err(w, "duplicate measure")
        if isinstance(c.get("diagram"), str):
            refs(w, [c["diagram"]], dia_ids, "diagram")
        refs(w, str_list(w, c, "refs", 1), src_ids, "source")
    if sorted(nums) != list(range(1, ch_count + 1)):
        err("chapters", f"chapter numbers must be 1..{ch_count} with no gaps or duplicates")
    ch_nums = set(nums)

    # concepts
    for i, c in enumerate(concepts):
        w = f"concept {c.get('id', i) if isinstance(c, dict) else i}"
        if not check_fields(w, c, {
                "id": (str, True), "name": (str, True), "group": (str, True),
                "one_line": (str, True), "chapters": (list, True), "related": (list, True),
                "formula": ((str, type(None)), True), "misconceptions": (list, True),
                "how_to_apply": (list, True), "tools": (list, True), "refs": (list, True)}):
            continue
        if c.get("group") not in CONCEPT_GROUPS:
            err(w, f"bad group {c.get('group')!r}")
        if words(c.get("one_line", "")) > 15:
            err(w, "one_line over 15 words")
        chs = c.get("chapters", [])
        for n in chs:
            if n not in ch_nums:
                err(w, f"broken chapter ref {n!r}")
        if not chs and c.get("group") not in ("later-toc", "adjacent", "thinking-processes"):
            err(w, "needs at least one chapter")
        rel = str_list(w, c, "related")
        refs(w, rel, con_ids, "concept")
        if c.get("id") in rel:
            err(w, "related to itself")
        str_list(w, c, "misconceptions")
        steps = str_list(w, c, "how_to_apply", 1)
        if len(steps) > 3:
            err(w, "how_to_apply over 3 steps")
        refs(w, str_list(w, c, "tools"), tool_ids, "tool")
        refs(w, str_list(w, c, "refs", 1), src_ids, "source")

    # chapter <-> concept consistency
    con_by_id = {c["id"]: c for c in concepts if isinstance(c, dict) and "id" in c}
    for c in chapters:
        if not isinstance(c, dict):
            continue
        for cid in c.get("concepts", []):
            con = con_by_id.get(cid)
            if con and c.get("n") not in con.get("chapters", []):
                err(f"chapter {c.get('n')}", f"lists concept '{cid}' but concept does not list this chapter")

    # tools
    for i, t in enumerate(tools):
        w = f"tool {t.get('id', i) if isinstance(t, dict) else i}"
        if not check_fields(w, t, {
                "id": (str, True), "name": (str, True), "kind": (str, True),
                "purpose": (str, True), "inputs": (list, True), "outputs": (list, True),
                "logic": (str, True), "concepts": (list, True), "priority": (int, True),
                "reuse": (list, True), "refs": (list, True)}):
            continue
        if t.get("kind") not in TOOL_KINDS:
            err(w, f"bad kind {t.get('kind')!r}")
        if words(t.get("purpose", "")) > 20:
            err(w, "purpose over 20 words")
        if t.get("priority") not in (1, 2, 3):
            err(w, "priority must be 1, 2 or 3")
        str_list(w, t, "inputs")
        str_list(w, t, "outputs")
        refs(w, str_list(w, t, "concepts", 1), con_ids, "concept")
        refs(w, str_list(w, t, "reuse"), src_ids, "source")
        refs(w, str_list(w, t, "refs", 1), src_ids, "source")

    # sources
    for i, s in enumerate(sources):
        w = f"source {s.get('id', i) if isinstance(s, dict) else i}"
        if not check_fields(w, s, {
                "id": (str, True), "title": (str, True), "author": (str, True),
                "year": ((int, type(None)), True), "url": ((str, type(None)), True),
                "type": (str, True), "license": (str, True), "adds": (str, True)}):
            continue
        if s.get("type") not in SOURCE_TYPES:
            err(w, f"bad type {s.get('type')!r}")
        url = s.get("url")
        if isinstance(url, str) and not re.match(r"^https?://", url):
            err(w, "url must start with http:// or https://")
        if not s.get("license", "").strip():
            err(w, "empty license")

    # assets: an image file in assets/ must be original or openly licensed
    src_by_id = {s["id"]: s for s in sources if isinstance(s, dict) and "id" in s}

    # books
    for i, b in enumerate(books):
        w = f"book {b.get('id', i) if isinstance(b, dict) else i}"
        if not check_fields(w, b, {
                "id": (str, True), "title": (str, True), "author": (str, True),
                "year": (int, True), "level": (int, True), "key_concepts": (list, True),
                "concepts": (list, True), "link_to_goal": (str, True), "tools": (list, True),
                "refs": (list, True)}):
            continue
        if b.get("level") not in (1, 2):
            err(w, "level must be 1 or 2")
        if words(b.get("link_to_goal", "")) > 30:
            err(w, "link_to_goal over 30 words")
        str_list(w, b, "key_concepts", 1)
        refs(w, str_list(w, b, "concepts", 1), con_ids, "concept")
        for j, t in enumerate(b.get("tools", [])):
            tw = f"{w}.tools[{j}]"
            if check_fields(tw, t, {"tool": (str, True), "rank": (int, True), "why": (str, True)}):
                refs(tw, [t.get("tool")], tool_ids, "tool")
        refs(w, str_list(w, b, "refs", 1), src_ids, "source")

    # diagrams
    for did, d in diagrams.items():
        w = f"diagram {did}"
        if not check_fields(w, d, {
                "id": (str, True), "title": (str, True), "kind": (str, True),
                "concepts": (list, True), "chapters": (list, True), "nodes": (list, False),
                "edges": (list, False), "series": (list, False), "axes": (dict, False),
                "notes": (list, True), "asset": ((str, type(None)), False),
                "refs": (list, True)}):
            continue
        if d.get("id") != did:
            err(w, f"id '{d.get('id')}' does not match file name")
        kind = d.get("kind")
        if kind not in DIAGRAM_KINDS:
            err(w, f"bad kind {kind!r}")
        refs(w, str_list(w, d, "concepts", 1), con_ids, "concept")
        for n in d.get("chapters", []):
            if n not in ch_nums:
                err(w, f"broken chapter ref {n!r}")
        refs(w, str_list(w, d, "refs", 1), src_ids, "source")
        if kind == "series":
            if not d.get("series") or "axes" not in d:
                err(w, "series diagram needs series and axes")
            for s in d.get("series", []):
                pts = s.get("points") if isinstance(s, dict) else None
                if not isinstance(pts, list) or not all(
                        isinstance(p, list) and len(p) == 2 and all(isinstance(v, (int, float)) for v in p)
                        for p in pts):
                    err(w, f"series {s.get('name') if isinstance(s, dict) else s!r} has bad points")
        else:
            nodes = d.get("nodes") or []
            if not nodes:
                err(w, "needs nodes")
            node_ids = set()
            for n in nodes:
                if not isinstance(n, dict) or not isinstance(n.get("id"), str) or "label" not in n:
                    err(w, f"bad node {n!r}")
                    continue
                if n["id"] in node_ids:
                    err(w, f"duplicate node '{n['id']}'")
                node_ids.add(n["id"])
            for e in d.get("edges", []):
                if not isinstance(e, dict):
                    err(w, "bad edge")
                    continue
                for end in ("from", "to"):
                    if e.get(end) not in node_ids:
                        err(w, f"edge {end} '{e.get(end)}' is not a node")
        asset = d.get("asset")
        if isinstance(asset, str) and not (ROOT / asset).is_file():
            err(w, f"asset '{asset}' not found")

    for p in sorted((ROOT / "assets").rglob("*")) if (ROOT / "assets").is_dir() else []:
        if p.is_file() and p.suffix.lower() in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
            sid = "img-" + p.stem
            s = src_by_id.get(sid)
            if not s or not str(s.get("license", "")).startswith(OPEN_IMAGE):
                err(f"assets/{p.name}", f"raster image needs source '{sid}' with an open license")

    counts = (f"chapters={len(chapters)} concepts={len(concepts)} tools={len(tools)} "
              f"sources={len(sources)} books={len(books)} diagrams={len(diagrams)}")
    if errors:
        for e in errors:
            print("FAIL", e)
        print(f"{len(errors)} error(s); {counts}")
        return 1
    print(f"OK {counts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
