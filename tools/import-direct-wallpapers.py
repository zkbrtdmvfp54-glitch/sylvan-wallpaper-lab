"""Import images dropped directly into the deployed wallpaper folders.

The generated gallery normally comes from the source-folder scanner. This small
second pass keeps direct uploads in ``assets/wallpapers`` or
``public/wallpapers`` from being omitted from the front-end data array.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps


PROJECT = Path(__file__).resolve().parents[1]
DATA_FILE = PROJECT / "assets" / "js" / "wallpapers-data.js"
IMPORT_DIRS = (PROJECT / "assets" / "wallpapers", PROJECT / "public" / "wallpapers")
PREFIX = "window.SYLVAN_WALLPAPERS = "
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".avif"}
SAFE_NAME = re.compile(r"wallpaper-(\d{4,})\.(?:jpg|jpeg|png|avif)$", re.IGNORECASE)
DEFAULT_CATEGORY = "涂鸦速写"


def load_items() -> list[dict]:
    text = DATA_FILE.read_text(encoding="utf-8").strip()
    if not text.startswith(PREFIX):
        raise RuntimeError("wallpapers-data.js 格式不正确")
    return json.loads(text[len(PREFIX) :].removesuffix(";"))


def nearest_ratio(width: int, height: int) -> str:
    value = width / height
    ratios = {"16:9": 16 / 9, "21:9": 21 / 9, "32:9": 32 / 9, "9:16": 9 / 16, "3:4": 3 / 4}
    return min(ratios, key=lambda label: abs(ratios[label] - value))


def relative_url(path: Path) -> str:
    return path.relative_to(PROJECT).as_posix()


def next_available_number(items: list[dict]) -> int:
    numbers: list[int] = []
    for item in items:
        match = re.search(r"wallpaper-(\d+)", item.get("src", ""), re.IGNORECASE)
        if match:
            numbers.append(int(match.group(1)))
    for folder in IMPORT_DIRS:
        if folder.exists():
            for path in folder.iterdir():
                match = re.search(r"wallpaper-(\d+)", path.name, re.IGNORECASE)
                if match:
                    numbers.append(int(match.group(1)))
    return max(numbers, default=0) + 1


def main() -> None:
    items = load_items()
    direct_urls = {
        relative_url(path)
        for folder in IMPORT_DIRS
        if folder.exists()
        for path in folder.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
    }
    updated = 0
    for item in items:
        if item.get("src") not in direct_urls:
            continue
        match = re.search(r"wallpaper-(\d+)", item["src"], re.IGNORECASE)
        if not match:
            continue
        number = int(match.group(1))
        item["title"] = f"{DEFAULT_CATEGORY} · {number:02d}"
        item["folder"] = DEFAULT_CATEGORY
        item["categories"] = [DEFAULT_CATEGORY]
        updated += 1
    known_sources = {item.get("src", "") for item in items}
    used_ids = {int(item["id"]) for item in items}
    next_number = next_available_number(items)
    candidates: list[Path] = []

    for folder in IMPORT_DIRS:
        if not folder.exists():
            continue
        for path in folder.iterdir():
            if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES:
                match = SAFE_NAME.fullmatch(path.name)
                if not match:
                    new_path = path.with_name(f"wallpaper-{next_number:04d}{path.suffix.lower()}")
                    while new_path.exists():
                        next_number += 1
                        new_path = path.with_name(f"wallpaper-{next_number:04d}{path.suffix.lower()}")
                    path.rename(new_path)
                    path = new_path
                    next_number += 1
                if relative_url(path) not in known_sources:
                    candidates.append(path)

    candidates.sort(key=lambda path: (path.stat().st_mtime, path.name), reverse=True)
    additions: list[dict] = []
    next_id = max(used_ids, default=0) + 1

    for path in candidates:
        match = SAFE_NAME.fullmatch(path.name)
        assert match is not None
        number = int(match.group(1))
        item_id = number if number not in used_ids else next_id
        while item_id in used_ids:
            item_id += 1
        next_id = max(next_id, item_id + 1)
        used_ids.add(item_id)

        with Image.open(path) as source:
            image = ImageOps.exif_transpose(source)
            width, height = image.size

        additions.append(
            {
                "id": item_id,
                "title": f"{DEFAULT_CATEGORY} · {number:02d}",
                "folder": DEFAULT_CATEGORY,
                "src": relative_url(path),
                "width": width,
                "height": height,
                "updatedAt": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds"),
                "orientation": "landscape" if width >= height else "portrait",
                "ratio": nearest_ratio(width, height),
                "categories": [DEFAULT_CATEGORY],
            }
        )

    if additions or updated:
        items = additions + items
        payload = json.dumps(items, ensure_ascii=False, separators=(",", ":"))
        DATA_FILE.write_text(f"{PREFIX}{payload};\n", encoding="utf-8")

    print(f"直接上传图片：新增 {len(additions)} 张，更新 {updated} 张，展示列表共 {len(items)} 张")


if __name__ == "__main__":
    main()
