"""config.yaml 읽기와 기본값 병합."""
from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

import yaml

DEFAULTS: dict[str, Any] = {
    "paths": {
        "work": "work",
        "inbox": "inbox",
        "assets": "assets",
        "links": "links.csv",
        "ffmpeg": "ffmpeg",
        "ffprobe": "ffprobe",
    },
    "voice": {
        "voice_id": "",
        "model": "ssfm-v30",
        "language": "kor",
        "speed": 1.4,
        "emotion": "normal",
        "emotion_intensity": 1.0,
        "format": "mp3",
        "timestamps": True,
        "api_host": "https://api.typecast.ai",
    },
    "video": {
        "width": 1080,
        "height": 1920,
        "fps": 30,
        "tail_seconds": 1.0,
        "narration_volume": 1.0,
        "bgm_volume": 0.12,
        "bgm": "",
    },
    "title": {
        "font": "assets/fonts/BlackHanSans-Regular.ttf",
        "size": 96,
        "line1_color": "#FFFFFF",
        "line2_color": "#87CEEB",
        "outline_color": "#000000",
        "outline_width": 6,
        "position_y": 0.42,
        "duration": 1.0,
    },
    "captions": {
        "font": "assets/fonts/NanumPenScript-Regular.ttf",
        "size": 72,
        "color": "#000000",
        "box_color": "#FFFFFF",
        "box_alpha": 0.75,
        "box_padding": 16,
        "position_y": 0.56,
        "chars_per_chunk": 15,
        "max_chunk_chars": 19,
        "min_chunk_seconds": 0.6,
        "native_numbers": True,
        "replacements": {"퍼센트": "%"},
    },
    "output": {
        "mp4": True,
        "capcut": True,
        "preview_frames": True,
    },
    "capcut": {
        "draft_folder": "",
        "font": "",
        "title_size": 15.0,
        "caption_size": 8.0,
        "caption_box_height": 0.14,
        "caption_box_width": 0.14,
    },
}


def _merge(base: dict, override: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


class Config:
    """설정 값과 기준 폴더(config.yaml이 있는 곳)를 함께 가진다."""

    def __init__(self, data: dict[str, Any], root: Path):
        self.data = data
        self.root = Path(root)

    @classmethod
    def load(cls, path: str | Path | None = None) -> "Config":
        cfg_path = Path(path) if path else find_config()
        if cfg_path and cfg_path.exists():
            with open(cfg_path, "r", encoding="utf-8") as f:
                loaded = yaml.safe_load(f) or {}
            root = cfg_path.resolve().parent
        else:
            loaded, root = {}, Path.cwd()
        return cls(_merge(DEFAULTS, loaded), root)

    def __getitem__(self, section: str) -> dict[str, Any]:
        return self.data[section]

    def get(self, dotted: str, default: Any = None) -> Any:
        node: Any = self.data
        for part in dotted.split("."):
            if not isinstance(node, dict) or part not in node:
                return default
            node = node[part]
        return node

    def path(self, dotted: str) -> Path | None:
        """설정에 적힌 경로를 기준 폴더 기준 절대 경로로 바꾼다. 비어 있으면 None."""
        value = self.get(dotted)
        if not value:
            return None
        p = Path(str(value)).expanduser()
        return p if p.is_absolute() else (self.root / p)

    @property
    def work_dir(self) -> Path:
        return self.path("paths.work") or (self.root / "work")

    @property
    def assets_dir(self) -> Path:
        return self.path("paths.assets") or (self.root / "assets")


def find_config(start: Path | None = None) -> Path | None:
    """현재 폴더에서 위로 올라가며 config.yaml을 찾는다."""
    here = (start or Path.cwd()).resolve()
    for folder in [here, *here.parents]:
        candidate = folder / "config.yaml"
        if candidate.exists():
            return candidate
    return None
