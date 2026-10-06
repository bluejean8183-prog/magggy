"""upload.txt: 제목, 공용 캡션, 해시태그, 구매 링크 줄."""
from __future__ import annotations

import csv
from pathlib import Path

from .scripts_md import Script, Scripts

PLACEHOLDER = "(여기에 링크 붙여넣기)"


def find_link(links_csv: Path | None, product: str) -> str | None:
    """links.csv(상품명,URL)에서 상품 링크를 찾는다. 정확히 같거나 서로 포함하면 맞는 것으로 본다."""
    if not links_csv or not Path(links_csv).exists() or not product:
        return None
    key = product.replace(" ", "").lower()
    with open(links_csv, "r", encoding="utf-8-sig", newline="") as f:
        for row in csv.reader(f):
            if len(row) < 2 or not row[0].strip() or row[0].strip() in ("상품명", "name", "product"):
                continue
            name = row[0].replace(" ", "").lower()
            if name == key or name in key or key in name:
                return row[1].strip()
    return None


def build_upload_text(scripts: Scripts, script: Script, product: str, link: str | None) -> str:
    title = " ".join(script.title_lines) if script.title_lines else product
    body, tags, link_line = [], [], None
    for line in scripts.caption_lines:
        if line.startswith("구매 링크") or PLACEHOLDER in line:
            link_line = line
        elif line.startswith("#"):
            tags.append(line)
        else:
            body.append(line)
    if link:
        link_line = f"구매 링크: {link}"
    elif link_line is None:
        link_line = f"구매 링크: {PLACEHOLDER}"
    elif PLACEHOLDER not in link_line and ":" not in link_line:
        link_line = f"구매 링크: {link_line}"

    parts = [f"제목: {title}", ""]
    parts += body
    if tags:
        parts += ["", *tags]
    parts += ["", link_line, ""]
    return "\n".join(parts)
