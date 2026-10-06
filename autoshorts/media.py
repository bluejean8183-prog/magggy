"""ffprobe/ffmpeg 호출 도우미."""
from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass
class MediaInfo:
    duration: float
    width: int = 0
    height: int = 0
    fps: float = 0.0
    has_audio: bool = False
    has_video: bool = False


def _tool(name_or_path: str) -> str:
    found = shutil.which(name_or_path)
    if found:
        return found
    if Path(name_or_path).exists():
        return str(name_or_path)
    raise FileNotFoundError(
        f"'{name_or_path}' 실행 파일을 찾지 못했습니다. FFmpeg를 설치하고 PATH에 넣거나 config.yaml의 paths.ffmpeg/ffprobe에 경로를 적어 주세요."
    )


def probe(path: Path, ffprobe: str = "ffprobe") -> MediaInfo:
    cmd = [_tool(ffprobe), "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)]
    out = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if out.returncode != 0:
        raise RuntimeError(f"ffprobe 실패: {path}\n{out.stderr}")
    data = json.loads(out.stdout or "{}")
    info = MediaInfo(duration=float(data.get("format", {}).get("duration") or 0.0))
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video" and not info.has_video:
            info.has_video = True
            info.width = int(stream.get("width") or 0)
            info.height = int(stream.get("height") or 0)
            num, _, den = str(stream.get("avg_frame_rate") or "0/1").partition("/")
            try:
                info.fps = float(num) / float(den or 1) if float(den or 1) else 0.0
            except ValueError:
                info.fps = 0.0
            if not info.duration and stream.get("duration"):
                info.duration = float(stream["duration"])
        elif stream.get("codec_type") == "audio":
            info.has_audio = True
            if not info.duration and stream.get("duration"):
                info.duration = float(stream["duration"])
    return info


def run_ffmpeg(args: list[str], ffmpeg: str = "ffmpeg", *, cwd: Path | None = None) -> None:
    cmd = [_tool(ffmpeg), "-hide_banner", "-loglevel", "error", "-y", *args]
    out = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=str(cwd) if cwd else None)
    if out.returncode != 0:
        raise RuntimeError("ffmpeg 실패:\n" + " ".join(cmd) + "\n" + out.stderr)


def font_family_name(font_path: Path) -> str:
    """TTF/OTF 파일의 글꼴 패밀리 이름(ASS 자막에서 쓰는 이름)."""
    try:
        from PIL import ImageFont

        family, _style = ImageFont.truetype(str(font_path), 20).getname()
        return family
    except Exception:  # Pillow가 없거나 읽기 실패 시 파일 이름으로 대체
        return font_path.stem.split("-")[0]
