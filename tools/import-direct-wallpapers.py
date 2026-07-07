"""Import images dropped directly into the deployed wallpaper folders.

The generated gallery normally comes from the source-folder scanner. This small
second pass keeps direct uploads in ``assets/wallpapers`` or
``public/wallpapers`` from being omitted from the front-end data array.
"""

from __future__ import annotations

import json
import re
import argparse
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps


PROJECT = Path(__file__).resolve().parents[1]
DATA_FILE = PROJECT / "assets" / "js" / "wallpapers-data.js"
DIRECT_MAP_FILE = PROJECT / "tools" / "direct-wallpaper-categories.json"
IMPORT_DIRS = (PROJECT / "assets" / "wallpapers", PROJECT / "public" / "wallpapers")
PREFIX = "window.SYLVAN_WALLPAPERS = "
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".avif"}
SAFE_NAME = re.compile(r"wallpaper-(\d{4,})\.(?:jpg|jpeg|png|avif)$", re.IGNORECASE)
DEFAULT_CATEGORY = "骑士特摄"


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
    parser = argparse.ArgumentParser(description="导入直接放入网站目录的新壁纸")
    parser.add_argument("--category", default=DEFAULT_CATEGORY, help="只应用于本次新增图片的栏目名称")
    args = parser.parse_args()
    category = args.category
    items = load_items()
    if DIRECT_MAP_FILE.exists():
        direct_categories: dict[str, str] = json.loads(DIRECT_MAP_FILE.read_text(encoding="utf-8"))
    else:
        direct_categories = {}
    for item in items:
        src = item.get("src", "")
        if Path(src).suffix.lower() in IMAGE_SUFFIXES and item.get("categories"):
            direct_categories.setdefault(src, item["categories"][0])
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
        source_url = relative_url(path)
        item_category = direct_categories.setdefault(source_url, category)
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
                "title": f"{item_category} · {number:02d}",
                "folder": item_category,
                "src": source_url,
                "width": width,
                "height": height,
                "updatedAt": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds"),
                "orientation": "landscape" if width >= height else "portrait",
                "ratio": nearest_ratio(width, height),
                "categories": [item_category],
            }
        )

    if additions:
        items = additions + items
        payload = json.dumps(items, ensure_ascii=False, separators=(",", ":"))
        DATA_FILE.write_text(f"{PREFIX}{payload};\n", encoding="utf-8")

    DIRECT_MAP_FILE.write_text(
        json.dumps(direct_categories, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"直接上传图片：新增 {len(additions)} 张，栏目：{category}，展示列表共 {len(items)} 张")


if __name__ == "__main__":
    main()
