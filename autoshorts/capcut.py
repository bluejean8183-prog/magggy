"""pyCapCut으로 캡컷 프로젝트(draft) 만들기.

0단계: 영상 하나 + 자막 하나만 든 최소 프로젝트 (capcut_test)
1단계: final.mp4와 같은 구성의 프로젝트 (build_project)
"""
from __future__ import annotations

from pathlib import Path

from .captions import Chunk
from .config import Config

SEC = 1_000_000  # 캡컷 초 단위(마이크로초)


def _cc():
    try:
        import pycapcut as cc  # noqa: WPS433
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("pycapcut이 설치되어 있지 않습니다: pip install pycapcut") from e
    return cc


def _rgb(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))  # type: ignore[return-value]


def _draft_folder(cfg: Config, override: str | None = None):
    cc = _cc()
    folder = override or cfg.get("capcut.draft_folder")
    if not folder:
        raise RuntimeError(
            "config.yaml의 capcut.draft_folder가 비어 있습니다. 캡컷 설정 > 초안 위치(Draft location) 경로를 적어 주세요."
        )
    return cc.DraftFolder(str(folder))


def _cover_scale(mat_w: int, mat_h: int, W: int, H: int) -> float:
    """캡컷은 기본으로 소재를 화면 안에 '맞춤'(contain)한다. 화면을 꽉 채우려면(cover) 이 배율만큼 키운다."""
    if not mat_w or not mat_h:
        return 1.0
    contain = min(W / mat_w, H / mat_h)
    cover = max(W / mat_w, H / mat_h)
    return cover / contain


def _fill(script, cc, track_name: str, material, total_us: int, *, volume: float = 1.0, clip_settings=None) -> None:
    """소재가 짧으면 반복해서, 길면 앞부분만 잘라 total_us 만큼 트랙을 채운다."""
    pos = 0
    is_video = isinstance(material, cc.VideoMaterial)
    while pos < total_us:
        seg_len = min(material.duration, total_us - pos)
        if seg_len <= 0:
            break
        target = cc.Timerange(pos, seg_len)
        source = cc.Timerange(0, seg_len)
        if is_video:
            seg = cc.VideoSegment(material, target, source_timerange=source, volume=volume, clip_settings=clip_settings)
        else:
            seg = cc.AudioSegment(material, target, source_timerange=source, volume=volume)
        script.add_segment(seg, track_name)
        pos += seg_len


def _font(cfg: Config):
    name = cfg.get("capcut.font")
    if not name:
        return None
    cc = _cc()
    try:
        return getattr(cc.FontType, str(name))
    except AttributeError:
        raise RuntimeError(f"capcut.font='{name}' 은 pycapcut FontType에 없습니다. 비워 두면 캡컷 기본 글꼴을 씁니다.")


def capcut_test(video: Path, cfg: Config, *, draft_folder: str | None = None, name: str = "autoshorts_test") -> Path:
    """0단계: 영상 하나와 자막 하나만 든 최소 프로젝트를 만든다. 만들어진 프로젝트 폴더를 돌려준다."""
    cc = _cc()
    folder = _draft_folder(cfg, draft_folder)
    W, H, FPS = int(cfg.get("video.width")), int(cfg.get("video.height")), int(cfg.get("video.fps"))
    script = folder.create_draft(name, W, H, FPS, allow_replace=True)
    mat = cc.VideoMaterial(str(video))
    length = min(mat.duration, 5 * SEC)
    script.add_track(cc.TrackType.video)
    script.add_segment(cc.VideoSegment(mat, cc.Timerange(0, length), source_timerange=cc.Timerange(0, length), volume=0.0))
    script.add_track(cc.TrackType.text)
    script.add_segment(cc.TextSegment(
        "캡컷 연결 테스트", cc.Timerange(0, min(length, 3 * SEC)),
        style=cc.TextStyle(size=float(cfg.get("capcut.caption_size", 8.0)), color=(0.0, 0.0, 0.0), align=1),
        background=cc.TextBackground(color="#FFFFFF", alpha=0.75, style=1),
        clip_settings=cc.ClipSettings(transform_y=-0.12),
    ))
    script.save()
    return Path(folder.folder_path) / name


def build_project(name: str, clean_video: Path, voice: Path, chunks: list[Chunk], title_lines: list[str],
                  cfg: Config, *, bgm: Path | None = None, voice_duration: float, draft_folder: str | None = None) -> Path:
    """1단계: 완성본과 같은 구성의 캡컷 프로젝트."""
    cc = _cc()
    folder = _draft_folder(cfg, draft_folder)
    W, H, FPS = int(cfg.get("video.width")), int(cfg.get("video.height")), int(cfg.get("video.fps"))
    total_us = int(round((voice_duration + float(cfg.get("video.tail_seconds", 1.0))) * SEC))
    t, c, k = cfg["title"], cfg["captions"], cfg["capcut"]
    font = _font(cfg)

    script = folder.create_draft(name, W, H, FPS, allow_replace=True)

    # 영상: 원본 소리 끔, 화면 꽉 채움
    video_mat = cc.VideoMaterial(str(clean_video))
    scale = _cover_scale(video_mat.width, video_mat.height, W, H)
    script.add_track(cc.TrackType.video)
    _fill(script, cc, "video", video_mat, total_us, volume=0.0,
          clip_settings=cc.ClipSettings(scale_x=scale, scale_y=scale) if abs(scale - 1.0) > 1e-3 else None)

    # 나레이션
    voice_mat = cc.AudioMaterial(str(voice))
    script.add_track(cc.TrackType.audio, "narration")
    script.add_segment(cc.AudioSegment(voice_mat, cc.Timerange(0, voice_mat.duration),
                                       volume=float(cfg.get("video.narration_volume", 1.0))), "narration")

    # 배경음
    if bgm and Path(bgm).exists():
        script.add_track(cc.TrackType.audio, "bgm", relative_index=1)
        _fill(script, cc, "bgm", cc.AudioMaterial(str(bgm)), total_us, volume=float(cfg.get("video.bgm_volume", 0.12)))

    # 자막: 검은 글씨, 흰 반투명 박스, 위에서 position_y
    script.add_track(cc.TrackType.text, "captions")
    cap_ty = (0.5 - float(c["position_y"])) * 2
    for ch in chunks:
        dur = int(round((ch.end - ch.start) * SEC))
        if dur <= 0:
            continue
        script.add_segment(cc.TextSegment(
            ch.text, cc.Timerange(int(round(ch.start * SEC)), dur), font=font,
            style=cc.TextStyle(size=float(k.get("caption_size", 8.0)), color=_rgb(c["color"]), align=1),
            background=cc.TextBackground(color=str(c["box_color"]).upper(), alpha=float(c["box_alpha"]), style=1,
                                         height=float(k.get("caption_box_height", 0.14)), width=float(k.get("caption_box_width", 0.14))),
            clip_settings=cc.ClipSettings(transform_y=cap_ty),
        ), "captions")

    # 제목 2줄: 1줄 흰색, 2줄 하늘색, 검은 외곽선, 시작 duration 동안
    if title_lines:
        # 같은 시간에 겹치는 두 줄이므로 줄마다 트랙을 하나씩 쓴다
        title_us = int(round(float(t["duration"]) * SEC))
        base_ty = (0.5 - float(t["position_y"])) * 2
        gap = float(k.get("title_line_gap", 0.07))
        colors = [t["line1_color"], t["line2_color"]]
        offsets = [gap, -gap] if len(title_lines) > 1 else [0.0]
        for i, (line, color, off) in enumerate(zip(title_lines[:2], colors, offsets), 1):
            track = f"title{i}"
            script.add_track(cc.TrackType.text, track, relative_index=i)
            script.add_segment(cc.TextSegment(
                line, cc.Timerange(0, title_us), font=font,
                style=cc.TextStyle(size=float(k.get("title_size", 15.0)), bold=True, color=_rgb(color), align=1),
                border=cc.TextBorder(color=_rgb(t["outline_color"]), width=float(k.get("title_outline", 40.0))),
                clip_settings=cc.ClipSettings(transform_y=base_ty + off),
            ), track)

    script.save()
    return Path(folder.folder_path) / name
