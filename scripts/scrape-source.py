#!/usr/bin/env python3
"""Archive ignyteyoga.com pages and Squarespace CDN originals.

Reads sitemap.xml plus primary navigation, saves raw HTML, full-size images,
and plain-text page copy. Safe to re-run; skips files already downloaded.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "source"
HTML_DIR = ASSET_DIR / "html"
IMAGE_DIR = ASSET_DIR / "images"
CONTENT_DIR = ROOT / "content"
ORIGIN = "https://www.ignyteyoga.com"
UA = "IgnyteYogaSiteArchive/1.0 (owner migration; hello@ignyteyoga.com)"

NAV_PATHS = [
    "/",
    "/schedule",
    "/classes",
    "/rates",
    "/ourteam",
    "/about",
    "/schedule-1",
    "/policy-procedures",
    "/blog",
    "/cart",
]

SKIP_PREFIXES = (
    "/cart",
    "/account",
    "/search",
    "/config",
    "/api/",
    "/commerce/",
    "/static/",
)


def fetch(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "*/*",
            "Referer": ORIGIN + "/",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read()


def abs_url(url: str, base: str = ORIGIN) -> str:
    url = unescape(url).strip().strip("\"'")
    if not url or url.startswith(("data:", "mailto:", "tel:", "javascript:")):
        return ""
    if url.startswith("//"):
        return "https:" + url
    return urllib.parse.urljoin(base, url)


def original_image_url(url: str) -> str:
    url = abs_url(url)
    if not url:
        return ""
    parts = urllib.parse.urlsplit(url)
    host = parts.netloc.lower()
    if "squarespace-cdn.com" not in host and "squarespace.com" not in host:
        return url
    path = parts.path
    if path.lower().endswith((".svg", ".ico", ".woff", ".woff2")):
        return urllib.parse.urlunsplit((parts.scheme, parts.netloc, path, "", ""))
    query = urllib.parse.parse_qs(parts.query)
    # Drop size transforms. format=original asks Squarespace for the uploaded file.
    return urllib.parse.urlunsplit(
        (parts.scheme or "https", parts.netloc, path, "format=original", "")
    )


def slug_from_url(url: str) -> str:
    path = urllib.parse.urlsplit(url).path
    name = urllib.parse.unquote(path.rstrip("/").split("/")[-1] or "index")
    name = re.sub(r"[^A-Za-z0-9._+-]+", "-", name).strip("-")
    return name or "file"


def page_slug(url: str) -> str:
    path = urllib.parse.urlsplit(url).path.strip("/")
    if not path:
        return "home"
    return re.sub(r"[^a-z0-9]+", "-", path.lower()).strip("-")


def extract_urls(html: str, page_url: str) -> list[str]:
    found: list[str] = []
    patterns = [
        r'(?:src|href|data-src|data-image|content)\s*=\s*"([^"]+)"',
        r"(?:src|href|data-src|data-image|content)\s*=\s*'([^']+)'",
        r'url\(([^)]+)\)',
        r'srcset="([^"]+)"',
    ]
    for pat in patterns:
        for match in re.findall(pat, html, flags=re.I):
            if "srcset" in pat:
                for part in match.split(","):
                    bit = part.strip().split(" ")[0]
                    found.append(bit)
            else:
                found.append(match)
    out = []
    for raw in found:
        url = abs_url(raw, page_url)
        if url:
            out.append(url)
    return out


def is_image_url(url: str) -> bool:
    path = urllib.parse.urlsplit(url).path.lower()
    host = urllib.parse.urlsplit(url).netloc.lower()
    if any(path.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".ico", ".svg", ".avif")):
        return True
    if "images.squarespace-cdn.com" in host or "/content/v1/" in path:
        return True
    return False


def is_content_asset(url: str) -> bool:
    host = urllib.parse.urlsplit(url).netloc.lower()
    path = urllib.parse.urlsplit(url).path.lower()
    if not is_image_url(url):
        return False
    # Universal Squarespace UI sprites are not studio assets.
    if "assets.squarespace.com/universal" in url or "/universal/images/" in path:
        return False
    if "squarespace-cdn.com" in host or "static1.squarespace.com" in host:
        return True
    if host.endswith("ignyteyoga.com"):
        return True
    return False


def visible_text(html: str) -> str:
    html = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.I)
    html = re.sub(r"<svg[\s\S]*?</svg>", " ", html, flags=re.I)
    html = re.sub(r"<noscript[\s\S]*?</noscript>", " ", html, flags=re.I)
    html = re.sub(r"</(h1|h2|h3|h4|p|li|blockquote|figcaption|tr|div|section|article|br)>", "\n", html, flags=re.I)
    html = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    html = re.sub(r"<[^>]+>", " ", html)
    html = unescape(html)
    lines = []
    for line in html.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if not line:
            continue
        if lines and lines[-1] == line:
            continue
        lines.append(line)
    # Drop repeated header/menu chrome by starting at the first unique heading-ish line
    # after the third "Open Menu" if present, else keep all and trim known chrome later.
    return "\n".join(lines)


def meta_content(html: str, name: str) -> str:
    patterns = [
        rf'<meta[^>]+name="{name}"[^>]+content="([^"]*)"',
        rf'<meta[^>]+content="([^"]*)"[^>]+name="{name}"',
        rf'<meta[^>]+property="{name}"[^>]+content="([^"]*)"',
        rf'<meta[^>]+content="([^"]*)"[^>]+property="{name}"',
    ]
    for pat in patterns:
        m = re.search(pat, html, flags=re.I)
        if m:
            return unescape(m.group(1)).strip()
    return ""


def title_of(html: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.I | re.S)
    return unescape(re.sub(r"\s+", " ", m.group(1))).strip() if m else ""


def internal_links(html: str) -> list[str]:
    links = []
    for href in re.findall(r'href="([^"]+)"', html, flags=re.I):
        url = abs_url(href)
        if not url.startswith(ORIGIN):
            continue
        path = urllib.parse.urlsplit(url).path
        if any(path.startswith(p) for p in SKIP_PREFIXES):
            continue
        if path.startswith("/universal"):
            continue
        clean = ORIGIN + path
        if path == "/":
            clean = ORIGIN + "/"
        links.append(clean.rstrip("/") if path != "/" else ORIGIN + "/")
    return links


def main() -> None:
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)

    sitemap_xml = fetch(ORIGIN + "/sitemap.xml").decode("utf-8", "replace")
    (ASSET_DIR / "sitemap.xml").write_text(sitemap_xml, encoding="utf-8")
    robots = fetch(ORIGIN + "/robots.txt").decode("utf-8", "replace")
    (ASSET_DIR / "robots.txt").write_text(robots, encoding="utf-8")

    page_urls = []
    for loc in re.findall(r"<loc>(.*?)</loc>", sitemap_xml):
        if loc.startswith(ORIGIN) and "squarespace-cdn" not in loc:
            page_urls.append(loc.rstrip("/") if urllib.parse.urlsplit(loc).path != "/" else ORIGIN + "/")
    for path in NAV_PATHS:
        url = ORIGIN + (path if path != "/" else "/")
        page_urls.append(url if path != "/" else ORIGIN + "/")

    # Preserve order, drop dupes.
    seen = set()
    ordered = []
    for url in page_urls:
        if url not in seen:
            seen.add(url)
            ordered.append(url)

    pages = []
    asset_map: dict[str, dict] = {}

    # First pass: download HTML and discover more internal pages + images.
    queue = list(ordered)
    queued = set(ordered)
    while queue:
        url = queue.pop(0)
        slug = page_slug(url)
        dest = HTML_DIR / f"{slug}.html"
        print(f"PAGE {url}")
        try:
            raw = fetch(url)
        except Exception as exc:  # noqa: BLE001
            print(f"  FAIL {exc}")
            pages.append({"url": url, "slug": slug, "error": str(exc)})
            continue
        dest.write_bytes(raw)
        html = raw.decode("utf-8", "replace")
        for link in internal_links(html):
            if link not in queued and link.count("/") <= 4:
                # one extra hop for pages linked from sitemap/nav pages
                path = urllib.parse.urlsplit(link).path
                if path not in ("/",) and path.strip("/").count("/") > 2:
                    continue
                queued.add(link)
                queue.append(link)
                print(f"  + discovered {link}")
        title = title_of(html)
        description = meta_content(html, "description")
        text = visible_text(html)
        (CONTENT_DIR / f"{slug}.txt").write_text(
            f"URL: {url}\nTITLE: {title}\nDESCRIPTION: {description}\n\n{text}\n",
            encoding="utf-8",
        )
        pages.append(
            {
                "url": url,
                "slug": slug,
                "title": title,
                "description": description,
                "html": str(dest.relative_to(ROOT)),
                "text": str((CONTENT_DIR / f"{slug}.txt").relative_to(ROOT)),
                "bytes": len(raw),
            }
        )
        for found in extract_urls(html, url):
            if not is_content_asset(found):
                continue
            original = original_image_url(found)
            if not original:
                continue
            entry = asset_map.setdefault(
                original,
                {"source_url": original, "seen_on": [], "references": []},
            )
            if url not in entry["seen_on"]:
                entry["seen_on"].append(url)
            if found not in entry["references"]:
                entry["references"].append(found)

    # Sitemap image:loc entries.
    for loc in re.findall(r"<image:loc>(.*?)</image:loc>", sitemap_xml):
        original = original_image_url(unescape(loc))
        entry = asset_map.setdefault(
            original,
            {"source_url": original, "seen_on": [], "references": []},
        )
        if "sitemap" not in entry["seen_on"]:
            entry["seen_on"].append("sitemap.xml")
        if loc not in entry["references"]:
            entry["references"].append(loc)

    print(f"ASSETS {len(asset_map)}")
    used_names: dict[str, str] = {}
    inventory = []
    for original, entry in asset_map.items():
        base = slug_from_url(original)
        if "." not in base:
            base += ".img"
        name = base
        # Avoid collisions between different CDN paths that share a filename.
        digest = hashlib.sha1(original.encode()).hexdigest()[:8]
        if name in used_names and used_names[name] != original:
            stem, dot, ext = name.rpartition(".")
            name = f"{stem}-{digest}.{ext}" if dot else f"{name}-{digest}"
        used_names[name] = original
        dest = IMAGE_DIR / name
        if not dest.exists() or dest.stat().st_size < 64:
            print(f"GET {name}")
            data = b""
            last_err = ""
            for attempt_url in (original, original.split("?")[0] + "?format=2500w", original.split("?")[0]):
                try:
                    data = fetch(attempt_url)
                    if len(data) > 64:
                        entry["downloaded_from"] = attempt_url
                        break
                except Exception as exc:  # noqa: BLE001
                    last_err = str(exc)
                    time.sleep(0.2)
            if len(data) < 64:
                entry["error"] = last_err or "empty response"
                print(f"  FAIL {last_err}")
            else:
                dest.write_bytes(data)
                time.sleep(0.05)
        entry["file"] = str(dest.relative_to(ROOT)) if dest.exists() else ""
        entry["bytes"] = dest.stat().st_size if dest.exists() else 0
        inventory.append(entry)

    manifest = {"pages": pages, "assets": inventory}
    (ASSET_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    lines = [
        "# Ignyte Yoga source inventory",
        "",
        "Archived from the live Squarespace site for the owner migration.",
        "Image files are the Squarespace CDN original (`format=original`) when the CDN returned one.",
        "",
        f"- Pages saved: {len(pages)}",
        f"- Image assets saved: {sum(1 for a in inventory if a.get('bytes', 0) > 64)}",
        "",
        "## Pages",
        "",
        "| Slug | URL | Title |",
        "| --- | --- | --- |",
    ]
    for page in pages:
        title = (page.get("title") or page.get("error") or "").replace("|", "/")
        lines.append(f"| `{page['slug']}` | {page['url']} | {title} |")
    lines += [
        "",
        "## Images",
        "",
        "| File | Bytes | Source URL | Seen on |",
        "| --- | ---: | --- | --- |",
    ]
    for asset in sorted(inventory, key=lambda a: a.get("file") or ""):
        seen = ", ".join(asset.get("seen_on") or [])
        file_name = asset.get("file") or "(missing)"
        lines.append(
            f"| `{file_name}` | {asset.get('bytes', 0)} | {asset.get('source_url','')} | {seen} |"
        )
    (ASSET_DIR / "inventory.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("DONE", len(pages), "pages", len(inventory), "assets")


if __name__ == "__main__":
    main()
