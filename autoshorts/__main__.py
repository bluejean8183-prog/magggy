"""명령줄: python -m autoshorts <명령> ..."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

from . import __version__, pipeline, scripts_md, tts
from .config import Config
from .workdir import create_episode, resolve_episode


def _say(*parts: object) -> None:
    print(*parts, flush=True)


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # 윈도우 콘솔 한글
    p = argparse.ArgumentParser(prog="autoshorts", description="쇼핑쇼츠 자동 제작 (0단계·1단계)")
    p.add_argument("--config", help="config.yaml 경로 (기본: 현재 폴더에서 위로 찾기)")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("capcut-test", help="0단계: 영상 하나+자막 하나 최소 캡컷 프로젝트 만들기")
    s.add_argument("video", help="시험용 영상 파일")
    s.add_argument("--draft-folder", help="캡컷 초안 폴더 (config의 capcut.draft_folder 대신)")
    s.add_argument("--name", default="autoshorts_test")

    s = sub.add_parser("new", help="새 편 폴더 만들기 (work/<날짜>_<상품명>/source/)")
    s.add_argument("product", help="상품명")
    s.add_argument("--zip", help="AiPrice ZIP 파일 (source/에 풀기)")
    s.add_argument("--video", help="판매자 영상 파일 (source/에 복사)")

    for name, help_ in [
        ("scripts", "scripts.md 확인(없으면 뼈대 생성, 클로드코드 지시문 출력)"),
        ("voice", "고른 대본을 타입캐스트로 음성 합성 -> voice.mp3"),
        ("captions", "자막 조각과 타이밍 -> captions.srt"),
        ("render", "FFmpeg로 final.mp4 + preview/ 만들기"),
        ("capcut", "캡컷 프로젝트 만들기"),
        ("upload", "upload.txt 쓰기"),
        ("run", "위 단계를 차례로 (사람 손이 필요하면 멈춤)"),
    ]:
        s = sub.add_parser(name, help=help_)
        s.add_argument("episode", help="work/ 아래 폴더 이름 또는 경로")
        if name in ("voice", "run"):
            s.add_argument("--force-voice", action="store_true", help="voice.mp3가 있어도 다시 합성")
        if name == "capcut":
            s.add_argument("--draft-folder")

    s = sub.add_parser("pick", help="대본 고르기 (A/B/C) -> pick.txt")
    s.add_argument("episode")
    s.add_argument("choice", choices=["A", "B", "C", "a", "b", "c"])

    s = sub.add_parser("voices", help="타입캐스트 보이스 목록 (API 키 필요)")
    s.add_argument("--model", help="ssfm-v30 / ssfm-v21")
    s.add_argument("--all", action="store_true", help="한국어 외 보이스도 모두")

    args = p.parse_args(argv)
    cfg = Config.load(args.config)
    load_dotenv(cfg.root / ".env")

    try:
        return _dispatch(args, cfg)
    except pipeline.StopForHuman as stop:
        _say("\n[멈춤] " + str(stop))
        return 2
    except (FileNotFoundError, RuntimeError, KeyError, ValueError, tts.TTSError) as e:
        _say(f"\n[오류] {e}")
        return 1
    except Exception as e:  # pycapcut 등 바깥 라이브러리 예외
        _say(f"\n[오류] {type(e).__name__}: {e}")
        return 1


def _dispatch(args: argparse.Namespace, cfg: Config) -> int:
    if args.cmd == "capcut-test":
        from .capcut import capcut_test

        path = capcut_test(Path(args.video), cfg, draft_folder=args.draft_folder, name=args.name)
        _say(f"캡컷 프로젝트를 만들었습니다: {path}")
        _say("캡컷을 열어 프로젝트 목록에서 이 이름이 보이고 열리는지 확인하세요.")
        _say("열리면 config.yaml의 output.capcut을 true로 두고, 열리지 않으면 false로 바꿔 mp4만 만듭니다.")
        _say("캡컷 버전도 config.yaml의 capcut.version_note에 적어 두세요 (업데이트 후 다시 시험).")
        return 0

    if args.cmd == "new":
        ep = create_episode(cfg, args.product, zip_path=Path(args.zip) if args.zip else None,
                            video_path=Path(args.video) if args.video else None)
        _say(f"편 폴더: {ep.folder}")
        vids = ep.source_videos()
        if vids:
            _say("source/ 영상: " + ", ".join(v.name for v in vids))
            _say(f"중국어 자막을 지운 영상을 {ep.clean_video} 로 넣어 주세요.")
        _say(f"상세페이지 이미지 {len(ep.source_images())}장")
        return 0

    if args.cmd == "voices":
        voices = tts.list_voices(cfg["voice"], model=args.model or cfg.get("voice.model"))
        rows = []
        for v in voices:
            models = ", ".join(m.get("version", "") for m in v.get("models", []))
            rows.append((v.get("voice_id", ""), v.get("voice_name", ""), v.get("gender", "") or "", v.get("age", "") or "", models))
        _say(f"보이스 {len(rows)}개 (config.yaml voice.voice_id에 적을 값 = 첫 열)")
        for r in rows:
            _say("  ".join(str(x) for x in r))
        try:
            sub_info = tts.subscription(cfg["voice"])
            cr = sub_info.get("credits", {})
            _say(f"\n요금제: {sub_info.get('plan')}  크레딧 {cr.get('used_credits')}/{cr.get('plan_credits')} 사용")
        except tts.TTSError as e:
            _say(f"(구독 정보 조회 실패: {e})")
        return 0

    ep = resolve_episode(cfg, args.episode)

    if args.cmd == "pick":
        ep.pick_txt.write_text(args.choice.upper() + "\n", encoding="utf-8")
        _say(f"대본 {args.choice.upper()} 선택 -> {ep.pick_txt}")
        return 0

    if args.cmd == "scripts":
        scripts = pipeline.step_scripts(ep, cfg)
        for w in scripts_md.validate(scripts):
            _say(f"[경고] {w}")
        _say(f"scripts.md 확인됨: 대본 {', '.join(scripts.scripts)} / 공용 캡션 {len(scripts.caption_lines)}줄")
        if not ep.read_pick():
            _say("다음: `python -m autoshorts pick <편> A|B|C`")
        return 0

    if args.cmd == "run":
        report = pipeline.run(ep, cfg, force_voice=args.force_voice)
        _say("\n완료:")
        for step in report.steps:
            _say(f"  - {step}")
        for w in report.warnings:
            _say(f"  [경고] {w}")
        if report.final_mp4:
            _say(f"\nfinal.mp4: {report.final_mp4}")
        if report.preview_sheet:
            _say(f"1초 간격 화면 모음: {report.preview_sheet}  (낱장: {ep.preview_dir}/frame_XX.jpg)")
        if report.capcut_project:
            _say(f"캡컷 프로젝트 이름: {report.capcut_project.name}  ({report.capcut_project})")
        _say(f"upload.txt: {report.upload_txt}")
        return 0

    # 개별 단계
    scripts = pipeline.step_scripts(ep, cfg)
    script = pipeline.step_pick(ep, scripts)
    if args.cmd == "voice":
        dur, alignment = pipeline.step_voice(ep, cfg, script, force=args.force_voice)
        _say(f"voice.mp3 {dur:.1f}초, 타임스탬프 {'있음' if alignment else '없음'}")
        return 0
    if args.cmd == "captions":
        dur, alignment = pipeline.step_voice(ep, cfg, script)
        chunks, warns = pipeline.step_captions(ep, cfg, script, dur, alignment)
        for w in warns:
            _say(f"[경고] {w}")
        for c in chunks:
            _say(f"{c.start:6.2f} - {c.end:6.2f}  {c.text}")
        _say(f"-> {ep.captions_srt}")
        return 0
    if args.cmd == "render":
        chunks = pipeline.load_chunks(ep)
        info = pipeline.step_render(ep, cfg, chunks, script.title_lines)
        _say(f"final.mp4 {info['duration']:.1f}초 -> {ep.final_mp4}")
        if info.get("preview_sheet"):
            _say(f"1초 간격 화면 모음: {info['preview_sheet']}")
        return 0
    if args.cmd == "capcut":
        chunks = pipeline.load_chunks(ep)
        from .media import probe

        dur = probe(ep.voice_mp3, cfg.get("paths.ffprobe")).duration
        path = pipeline.step_capcut(ep, cfg, chunks, script.title_lines, dur, draft_folder=args.draft_folder)
        _say(f"캡컷 프로젝트: {path.name}  ({path})")
        return 0
    if args.cmd == "upload":
        path = pipeline.step_upload(ep, cfg, scripts, script)
        _say(path.read_text(encoding="utf-8"))
        _say(f"-> {path}")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
