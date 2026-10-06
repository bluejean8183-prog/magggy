"""단계별 처리와 전체 실행(run). 사람이 할 일이 남으면 멈추고 알린다."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from . import captions as cap
from . import capcut as cc_build
from . import render as rend
from . import scripts_md, tts, upload
from .config import Config
from .media import probe
from .workdir import Episode


class StopForHuman(Exception):
    """사람 손이 필요해서 멈출 때."""


@dataclass
class RunReport:
    steps: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    final_mp4: Path | None = None
    preview_sheet: Path | None = None
    capcut_project: Path | None = None
    upload_txt: Path | None = None


def claude_instruction(ep: Episode, cfg: Config) -> str:
    """scripts.md가 없을 때 클로드코드에 붙여넣을 지시문."""
    images = ep.source_images()
    prompt = cfg.assets_dir / "prompt.md"
    lines = [
        f"{ep.folder} 편의 대본을 써 줘.",
        f"- 지침: {prompt} 의 내용을 그대로 따른다 (고치지 않는다).",
        f"- 재료: {ep.source_dir} 의 상세페이지 이미지 {len(images)}장을 직접 읽는다. 중국어 원문도 그대로 반영한다.",
        f"- 결과: {ep.scripts_md} 에 CLAUDE.md의 scripts.md 형식으로 대본 A·B·C, 제목 2줄, 공용 캡션을 쓴다.",
        "- 상세페이지에 없는 기능·수치는 쓰지 말고, 불확실한 것은 '## 확인 필요' 아래 적는다.",
    ]
    return "\n".join(lines)


def step_scripts(ep: Episode, cfg: Config) -> scripts_md.Scripts:
    """scripts.md 확인. 없으면 뼈대를 만들고 멈춘다. '확인 필요'가 있으면 멈춘다."""
    if not ep.scripts_md.exists():
        ep.scripts_md.write_text(scripts_md.template(ep.product_name, ep.source_images()), encoding="utf-8")
        raise StopForHuman(
            f"scripts.md가 없어 뼈대를 만들었습니다: {ep.scripts_md}\n"
            "클로드코드에서 아래 지시문으로 대본을 채운 뒤 다시 실행하세요.\n\n" + claude_instruction(ep, cfg)
        )
    scripts = scripts_md.load(ep.scripts_md)
    if not scripts.scripts or all(not s.voice_lines or s.voice_lines[0].startswith("(") for s in scripts.scripts.values()):
        raise StopForHuman("scripts.md가 아직 비어 있습니다.\n\n" + claude_instruction(ep, cfg))
    if scripts.needs_check:
        items = "\n".join(f"- {x}" for x in scripts.needs_check)
        raise StopForHuman(f"대본에 '확인 필요' 항목이 있어 음성을 만들지 않고 멈춥니다:\n{items}\n확인 후 scripts.md의 '## 확인 필요'를 '- 없음'으로 바꾸고 다시 실행하세요.")
    return scripts


def step_pick(ep: Episode, scripts: scripts_md.Scripts) -> scripts_md.Script:
    pick = ep.read_pick()
    if not pick:
        preview = []
        for kind in "ABC":
            if kind in scripts.scripts:
                s = scripts.scripts[kind]
                preview.append(f"[{kind}] {' / '.join(s.title_lines)}\n    " + "\n    ".join(s.voice_lines))
        raise StopForHuman(
            "대본 A·B·C 중 하나를 고르세요: `python -m autoshorts pick <편> A` (또는 pick.txt에 A/B/C 한 글자)\n\n" + "\n\n".join(preview)
        )
    return scripts.get(pick)


def step_voice(ep: Episode, cfg: Config, script: scripts_md.Script, *, force: bool = False) -> tuple[float, dict | None]:
    """voice.mp3 만들기. 이미 있으면(직접 넣었거나 전에 만들었으면) 그대로 쓴다."""
    ffprobe = cfg.get("paths.ffprobe")
    if ep.voice_mp3.exists() and not force:
        dur = probe(ep.voice_mp3, ffprobe).duration
        return dur, tts.load_alignment(ep.voice_json)
    result = tts.synthesize(script.voice_text, cfg["voice"], ep.voice_mp3, ep.voice_json,
                            probe_duration=lambda p: probe(p, ffprobe).duration)
    return result.duration, result.alignment


def step_captions(ep: Episode, cfg: Config, script: scripts_md.Script, voice_duration: float,
                  alignment: dict | None) -> tuple[list[cap.Chunk], list[str]]:
    c = cfg["captions"]
    chunks = cap.make_chunks(
        script.voice_text, target=int(c["chars_per_chunk"]), max_len=int(c["max_chunk_chars"]),
        native_numbers=bool(c.get("native_numbers", True)), replacements=c.get("replacements") or {},
        caption_override=script.caption_lines,
    )
    warnings = cap.time_chunks(chunks, script.voice_text, voice_duration, alignment=alignment,
                               min_duration=float(c.get("min_chunk_seconds", 0.6)))
    if alignment is None:
        warnings.append("타임스탬프가 없어 자막 타이밍을 글자 수 비례로 나눴습니다 (voice_timestamps.json 없음).")
    cap.write_srt(chunks, ep.captions_srt)
    cap.write_json(chunks, ep.captions_json)
    return chunks, warnings


def load_chunks(ep: Episode) -> list[cap.Chunk]:
    if ep.captions_json.exists():
        return cap.read_json(ep.captions_json)
    if ep.captions_srt.exists():
        return cap.read_srt(ep.captions_srt)
    raise FileNotFoundError("captions.json/captions.srt가 없습니다. 먼저 `captions` 단계를 실행하세요.")


def bgm_path(cfg: Config) -> Path | None:
    explicit = cfg.path("video.bgm")
    if explicit and explicit.exists():
        return explicit
    bgm_dir = cfg.assets_dir / "bgm"
    if bgm_dir.exists():
        for p in sorted(bgm_dir.iterdir()):
            if p.suffix.lower() in (".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"):
                return p
    return None


def step_render(ep: Episode, cfg: Config, chunks: list[cap.Chunk], title_lines: list[str]) -> dict:
    if not ep.clean_video.exists():
        raise StopForHuman(f"clean.mp4가 없습니다: {ep.clean_video}\n중국어 자막을 지운 영상을 이 이름으로 넣어 주세요 (Vmake 수작업).")
    info = rend.render(ep.folder, ep.clean_video, ep.voice_mp3, chunks, title_lines, cfg, ep.final_mp4, bgm=bgm_path(cfg))
    if cfg.get("output.preview_frames", True):
        info["preview_sheet"] = rend.preview_frames(ep.final_mp4, ep.preview_dir, cfg)
    return info


def step_capcut(ep: Episode, cfg: Config, chunks: list[cap.Chunk], title_lines: list[str], voice_duration: float,
                *, draft_folder: str | None = None) -> Path:
    if not ep.clean_video.exists():
        raise StopForHuman(f"clean.mp4가 없습니다: {ep.clean_video}")
    return cc_build.build_project(ep.name, ep.clean_video, ep.voice_mp3, chunks, title_lines, cfg,
                                  bgm=bgm_path(cfg), voice_duration=voice_duration, draft_folder=draft_folder)


def step_upload(ep: Episode, cfg: Config, scripts: scripts_md.Scripts, script: scripts_md.Script) -> Path:
    product = scripts.product or ep.product_name
    link = upload.find_link(cfg.path("paths.links"), product) or upload.find_link(cfg.path("paths.links"), ep.product_name)
    ep.upload_txt.write_text(upload.build_upload_text(scripts, script, product, link), encoding="utf-8")
    return ep.upload_txt


def run(ep: Episode, cfg: Config, *, force_voice: bool = False) -> RunReport:
    """한 편을 끝까지. 사람 손이 필요하면 StopForHuman."""
    report = RunReport()
    scripts = step_scripts(ep, cfg)
    report.warnings += [f"scripts.md: {w}" for w in scripts_md.validate(scripts)]
    script = step_pick(ep, scripts)
    report.steps.append(f"대본 {script.kind} 선택")

    voice_duration, alignment = step_voice(ep, cfg, script, force=force_voice)
    report.steps.append(f"나레이션 {voice_duration:.1f}초 ({'타임스탬프 있음' if alignment else '타임스탬프 없음'})")

    chunks, warns = step_captions(ep, cfg, script, voice_duration, alignment)
    report.warnings += warns
    report.steps.append(f"자막 {len(chunks)}조각 -> captions.srt")

    if cfg.get("output.mp4", True):
        info = step_render(ep, cfg, chunks, script.title_lines)
        report.final_mp4 = ep.final_mp4
        report.preview_sheet = info.get("preview_sheet")
        note = "원본 반복" if info["looped"] else ("원본 뒤 잘라냄" if info["trimmed"] else "")
        report.steps.append(f"final.mp4 {info['duration']:.1f}초 {note}".strip())
    if cfg.get("output.capcut", True):
        try:
            report.capcut_project = step_capcut(ep, cfg, chunks, script.title_lines, voice_duration)
            report.steps.append(f"캡컷 프로젝트: {report.capcut_project.name}")
        except Exception as e:  # 캡컷은 실패해도 mp4는 살린다
            report.warnings.append(f"캡컷 프로젝트 생성 실패: {e}")

    report.upload_txt = step_upload(ep, cfg, scripts, script)
    report.steps.append("upload.txt")
    (ep.folder / "run_report.json").write_text(json.dumps({
        "steps": report.steps, "warnings": report.warnings,
        "final_mp4": str(report.final_mp4) if report.final_mp4 else None,
        "preview_sheet": str(report.preview_sheet) if report.preview_sheet else None,
        "capcut_project": str(report.capcut_project) if report.capcut_project else None,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return report
