"""FFmpeg로 final.mp4 만들기: 1080x1920, 원본 소리 제거, 나레이션 + 배경음, 자막 박스, 시작 제목."""
from __future__ import annotations

import math
import os
from pathlib import Path

from .captions import Chunk
from .config import Config
from .media import font_family_name, probe, run_ffmpeg


def _ass_color(hex_color: str, alpha: float = 1.0) -> str:
    """'#RRGGBB' + 불투명도(1=불투명) -> ASS '&HAABBGGRR'."""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    a = max(0, min(255, round((1.0 - float(alpha)) * 255)))
    return f"&H{a:02X}{b:02X}{g:02X}{r:02X}"


def _ass_time(sec: float) -> str:
    cs = int(round(max(0.0, sec) * 100))
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _ass_text(text: str) -> str:
    return text.replace("{", "｛").replace("}", "｝").replace("\n", "\\N")


def build_ass(chunks: list[Chunk], title_lines: list[str], cfg: Config) -> str:
    """자막(ASS) 파일 내용. 제목 2줄은 시작 title.duration 초 동안, 자막은 조각별로."""
    W, H = int(cfg.get("video.width")), int(cfg.get("video.height"))
    t, c = cfg["title"], cfg["captions"]
    title_font = cfg.path("title.font")
    cap_font = cfg.path("captions.font")
    title_family = font_family_name(title_font) if title_font and title_font.exists() else "Arial"
    cap_family = font_family_name(cap_font) if cap_font and cap_font.exists() else "Arial"

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,{title_family},{int(t['size'])},{_ass_color(t['line1_color'])},&H000000FF,{_ass_color(t['outline_color'])},&H00000000,-1,0,0,0,100,100,0,0,1,{float(t['outline_width'])},0,5,0,0,0,1
Style: Caption,{cap_family},{int(c['size'])},{_ass_color(c['color'])},&H000000FF,{_ass_color(c['box_color'], c['box_alpha'])},{_ass_color(c['box_color'], c['box_alpha'])},0,0,0,0,100,100,0,0,3,{float(c['box_padding'])},0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    if title_lines:
        y = round(H * float(t["position_y"]))
        line1 = _ass_text(title_lines[0])
        text = f"{{\\pos({W // 2},{y})}}{line1}"
        if len(title_lines) > 1:
            text += f"\\N{{\\c{_ass_color(t['line2_color'])}}}{_ass_text(title_lines[1])}"
        events.append(f"Dialogue: 1,{_ass_time(0)},{_ass_time(float(t['duration']))},Title,,0,0,0,,{text}")
    y_cap = round(H * float(c["position_y"]))
    for ch in chunks:
        events.append(
            f"Dialogue: 0,{_ass_time(ch.start)},{_ass_time(ch.end)},Caption,,0,0,0,,{{\\pos({W // 2},{y_cap})}}{_ass_text(ch.text)}"
        )
    return header + "\n".join(events) + "\n"


def _filter_path(path: Path, base: Path) -> str:
    """필터 그래프 안에서 쓸 경로. 가능하면 상대 경로, 아니면 절대 경로를 이스케이프한다."""
    try:
        rel = os.path.relpath(path, base)
        text = rel
    except ValueError:  # 윈도우에서 드라이브가 다를 때
        text = str(path)
    text = text.replace("\\", "/")
    text = text.replace("'", r"'\''").replace(":", r"\:")
    return f"'{text}'"


def render(ep_folder: Path, clean_video: Path, voice: Path, chunks: list[Chunk], title_lines: list[str],
           cfg: Config, out: Path, *, bgm: Path | None = None) -> dict:
    """final.mp4를 만들고 길이 등 정보를 돌려준다."""
    W, H, FPS = int(cfg.get("video.width")), int(cfg.get("video.height")), int(cfg.get("video.fps"))
    ffmpeg, ffprobe = cfg.get("paths.ffmpeg"), cfg.get("paths.ffprobe")

    voice_info = probe(voice, ffprobe)
    total = voice_info.duration + float(cfg.get("video.tail_seconds", 1.0))
    src = probe(clean_video, ffprobe)

    ass_path = ep_folder / "captions.ass"
    ass_path.write_text(build_ass(chunks, title_lines, cfg), encoding="utf-8")

    fonts_dir = (cfg.path("captions.font") or cfg.assets_dir / "fonts").parent
    vf = (
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1,"
        f"ass={_filter_path(ass_path, ep_folder)}:fontsdir={_filter_path(fonts_dir, ep_folder)}[v]"
    )
    nar_vol = float(cfg.get("video.narration_volume", 1.0))
    args: list[str] = ["-stream_loop", "-1", "-i", str(clean_video), "-i", str(voice)]
    if bgm and Path(bgm).exists():
        args += ["-stream_loop", "-1", "-i", str(bgm)]
        af = (
            f"[1:a]volume={nar_vol},apad[nar];[2:a]volume={float(cfg.get('video.bgm_volume', 0.12))}[bgm];"
            f"[nar][bgm]amix=inputs=2:duration=first:normalize=0[a]"
        )
    else:
        af = f"[1:a]volume={nar_vol},apad[a]"

    script_path = ep_folder / "render_filter.txt"
    script_path.write_text(vf + ";\n" + af + "\n", encoding="utf-8")
    args += [
        "-filter_complex_script", str(script_path),
        "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(out),
    ]
    run_ffmpeg(args, ffmpeg, cwd=ep_folder)
    return {
        "duration": total, "voice_duration": voice_info.duration,
        "source": {"duration": src.duration, "width": src.width, "height": src.height},
        "looped": src.duration < total, "trimmed": src.duration > total,
    }


def preview_frames(video: Path, out_dir: Path, cfg: Config, *, columns: int = 5) -> Path:
    """1초 간격 화면을 preview/frame_XX.jpg 로 뽑고 한 장짜리 모음(sheet.jpg)을 만든다."""
    ffmpeg, ffprobe = cfg.get("paths.ffmpeg"), cfg.get("paths.ffprobe")
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("frame_*.jpg"):
        old.unlink()
    run_ffmpeg(["-i", str(video), "-vf", "fps=1,scale=360:-2", "-q:v", "3", str(out_dir / "frame_%02d.jpg")], ffmpeg)
    n = max(1, math.ceil(probe(video, ffprobe).duration))
    rows = max(1, math.ceil(n / columns))
    sheet = out_dir / "sheet.jpg"
    run_ffmpeg(["-i", str(video), "-vf", f"fps=1,scale=216:-2,tile={columns}x{rows}:padding=4:margin=4", "-frames:v", "1",
                "-q:v", "3", str(sheet)], ffmpeg)
    return sheet
