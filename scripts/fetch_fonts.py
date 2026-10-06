"""mp4용 무료 글꼴(SIL Open Font License, 상업 이용 가능)을 assets/fonts/ 에 내려받는다.

    python scripts/fetch_fonts.py
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

FONTS = {
    # 제목용 굵은 고딕
    "BlackHanSans-Regular.ttf": "https://fonts.gstatic.com/s/blackhansans/v24/ea8Aad44WunzF9a-dL6toA8r8nqV.ttf",
    # 자막용 손글씨체 (샘플 2)
    "NanumPenScript-Regular.ttf": "https://fonts.gstatic.com/s/nanumpenscript/v25/daaDSSYiLGqEal3MvdA_FOL_3FkN2z4.ttf",
    # 자막용 고딕 (샘플 1)
    "NotoSansKR-Bold.ttf": "https://fonts.gstatic.com/s/notosanskr/v40/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzg01eLQ.ttf",
}


def main() -> int:
    out_dir = Path(__file__).resolve().parent.parent / "assets" / "fonts"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, url in FONTS.items():
        target = out_dir / name
        if target.exists() and target.stat().st_size > 10_000:
            print(f"있음: {target.name}")
            continue
        print(f"받는 중: {name}")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as resp, open(target, "wb") as f:
            f.write(resp.read())
        print(f"저장: {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
