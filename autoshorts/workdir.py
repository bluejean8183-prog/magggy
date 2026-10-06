"""편별 작업 폴더(work/<날짜>_<상품명>/) 다루기."""
from __future__ import annotations

import datetime as dt
import re
import shutil
import zipfile
from dataclasses import dataclass
from pathlib import Path

from .config import Config

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"}


@dataclass
class Episode:
    """한 편의 모든 경로."""

    folder: Path

    @property
    def name(self) -> str:
        return self.folder.name

    @property
    def product_name(self) -> str:
        """폴더 이름에서 날짜 접두어를 뗀 상품명."""
        return re.sub(r"^\d{8}[_\-]?", "", self.name) or self.name

    @property
    def source_dir(self) -> Path:
        return self.folder / "source"

    @property
    def clean_video(self) -> Path:
        return self.folder / "clean.mp4"

    @property
    def scripts_md(self) -> Path:
        return self.folder / "scripts.md"

    @property
    def pick_txt(self) -> Path:
        return self.folder / "pick.txt"

    @property
    def voice_mp3(self) -> Path:
        return self.folder / "voice.mp3"

    @property
    def voice_json(self) -> Path:
        return self.folder / "voice_timestamps.json"

    @property
    def captions_srt(self) -> Path:
        return self.folder / "captions.srt"

    @property
    def captions_json(self) -> Path:
        return self.folder / "captions.json"

    @property
    def captions_ass(self) -> Path:
        return self.folder / "captions.ass"

    @property
    def final_mp4(self) -> Path:
        return self.folder / "final.mp4"

    @property
    def upload_txt(self) -> Path:
        return self.folder / "upload.txt"

    @property
    def preview_dir(self) -> Path:
        return self.folder / "preview"

    def source_images(self) -> list[Path]:
        if not self.source_dir.exists():
            return []
        return sorted(p for p in self.source_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS)

    def source_videos(self) -> list[Path]:
        if not self.source_dir.exists():
            return []
        return sorted(p for p in self.source_dir.iterdir() if p.suffix.lower() in VIDEO_EXTS)

    def read_pick(self) -> str | None:
        if not self.pick_txt.exists():
            return None
        value = self.pick_txt.read_text(encoding="utf-8").strip().upper()[:1]
        return value if value in ("A", "B", "C") else None


def resolve_episode(cfg: Config, name_or_path: str) -> Episode:
    """폴더 이름(work/ 아래) 또는 경로로 편을 찾는다."""
    p = Path(name_or_path)
    if p.exists() and p.is_dir():
        return Episode(p.resolve())
    candidate = cfg.work_dir / name_or_path
    if candidate.is_dir():
        return Episode(candidate.resolve())
    raise FileNotFoundError(f"편 폴더를 찾을 수 없습니다: {name_or_path} (work 폴더: {cfg.work_dir})")


def create_episode(cfg: Config, product_name: str, *, zip_path: Path | None = None,
                   video_path: Path | None = None, date: dt.date | None = None) -> Episode:
    """새 편 폴더를 만든다. ZIP이 있으면 source/에 풀고, 영상은 가장 크고 긴 것을 안내한다."""
    date = date or dt.date.today()
    safe = re.sub(r"[\\/:*?\"<>|\s]+", "_", product_name.strip()).strip("_") or "untitled"
    folder = cfg.work_dir / f"{date:%Y%m%d}_{safe}"
    ep = Episode(folder)
    ep.source_dir.mkdir(parents=True, exist_ok=True)

    if zip_path:
        with zipfile.ZipFile(zip_path) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                name = Path(info.filename).name  # 하위 폴더는 평평하게
                if not name or name.startswith("._") or name.startswith("__MACOSX"):
                    continue
                target = ep.source_dir / name
                with zf.open(info) as src, open(target, "wb") as dst:
                    shutil.copyfileobj(src, dst)
    if video_path:
        shutil.copy2(video_path, ep.source_dir / Path(video_path).name)
    return ep
