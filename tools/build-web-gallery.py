"""将完整图库转换为适合 GitHub Pages 的本地 WebP 资源。"""

from __future__ import annotations

import json
import hashlib
import re
from pathlib import Path

from PIL import Image, ImageOps


PROJECT = Path(__file__).resolve().parents[1]
DATA_FILE = PROJECT / "assets" / "js" / "wallpapers-data.js"
OUTPUT_DIR = PROJECT / "assets" / "wallpapers"
MAP_FILE = PROJECT / "tools" / "wallpaper-file-map.json"
PREFIX = "window.SYLVAN_WALLPAPERS = "


def load_items() -> list[dict]:
    text = DATA_FILE.read_text(encoding="utf-8").strip()
    if not text.startswith(PREFIX):
        raise RuntimeError("wallpapers-data.js 格式不正确")
    return json.loads(text[len(PREFIX) :].removesuffix(";"))


def main() -> None:
    items = load_items()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    desired_files: set[str] = set()
    converted = 0
    reused = 0
    if MAP_FILE.exists():
        file_map: dict[str, str] = json.loads(MAP_FILE.read_text(encoding="utf-8"))
    else:
        file_map = {}
    used_numbers = [
        int(match.group(1))
        for name in file_map.values()
        if (match := re.fullmatch(r"wallpaper-(\d+)\.webp", name))
    ]
    next_number = max(used_numbers, default=0) + 1

    total = len(items)
    for index, item in enumerate(items, start=1):
        source = (PROJECT / item["src"]).resolve()
        source_key = item["src"].replace("\\", "/")
        if source_key not in file_map:
            file_map[source_key] = f"wallpaper-{next_number:04d}.webp"
            next_number += 1
        output_name = file_map[source_key]
        output = OUTPUT_DIR / output_name
        desired_files.add(output_name)
        limit = (1600, 900) if item["orientation"] == "landscape" else (720, 1280)

        # 从旧版哈希文件名无损迁移到数字文件名，避免重复压缩。
        source_hash = hashlib.sha1(source_key.encode("utf-8")).hexdigest()[:16]
        legacy_output = OUTPUT_DIR / f"wallpaper-{source_hash}.webp"
        if not output.exists() and legacy_output.exists():
            legacy_output.replace(output)

        if output.exists() and output.stat().st_mtime >= source.stat().st_mtime:
            with Image.open(output) as image:
                item["width"], item["height"] = image.size
            reused += 1
        else:
            with Image.open(source) as image:
                image = ImageOps.exif_transpose(image).convert("RGB")
                image.thumbnail(limit, Image.Resampling.LANCZOS)
                image.save(output, "WEBP", quality=78, method=4, optimize=True)
                item["width"], item["height"] = image.size
            converted += 1

        item["src"] = f"assets/wallpapers/{output_name}"
        if index % 25 == 0 or index == total:
            print(f"已处理 {index}/{total}", flush=True)

    for old_file in OUTPUT_DIR.glob("wallpaper-*.webp"):
        if old_file.name not in desired_files:
            old_file.unlink()

    payload = json.dumps(items, ensure_ascii=False, separators=(",", ":"))
    DATA_FILE.write_text(f"{PREFIX}{payload};\n", encoding="utf-8")
    MAP_FILE.write_text(json.dumps(file_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    size_mb = sum(path.stat().st_size for path in OUTPUT_DIR.glob("*.webp")) / 1024 / 1024
    print(f"完成：{total} 张，新转换 {converted} 张，复用 {reused} 张，WebP 总计 {size_mb:.1f} MB", flush=True)


if __name__ == "__main__":
    main()
