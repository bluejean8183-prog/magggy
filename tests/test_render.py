"""FFmpeg와 pycapcut이 있을 때만 도는 통합 테스트 (합성 영상으로 끝까지)."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from autoshorts import pipeline
from autoshorts.captions import Chunk
from autoshorts.config import Config
from autoshorts.render import _ass_color, _ass_time, _filter_path, build_ass
from autoshorts.workdir import Episode

ROOT = Path(__file__).resolve().parent.parent
HAS_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None

SCRIPTS = """# 대본: 테스트 선반

## 확인 필요
- 없음

## A. 제품 중심 경험담
### 제목
나만 쓰기 아까운
감성 원목 선반
### 음성용
책상 위가 늘 어수선해서 하나 들였어요.
이단과 삼단 구조라 공간이 넉넉하게 나뉘어요.
링크는 프로필이나 고정댓글에서 확인해주세요.

## 공용 캡션
좁은 책상도 넉넉해지는 선반
#원목선반 #책상정리 #수납아이디어 #자취템 #인테리어소품
구매 링크: (여기에 링크 붙여넣기)
"""


def _lavfi(out: Path, *args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args, str(out)], check=True)


@pytest.fixture
def cfg(tmp_path):
    base = Config.load(ROOT / "config.yaml")
    data = json.loads(json.dumps(base.data))
    data["paths"]["work"] = str(tmp_path / "work")
    data["paths"]["links"] = str(tmp_path / "links.csv")
    data["video"]["bgm"] = str(tmp_path / "bgm.mp3")
    data["capcut"]["draft_folder"] = str(tmp_path / "drafts")
    (tmp_path / "drafts").mkdir()
    (tmp_path / "links.csv").write_text("상품명,URL\n테스트 선반,https://example.com/shelf\n", encoding="utf-8")
    return Config(data, ROOT)


@pytest.fixture
def episode(cfg, tmp_path):
    folder = cfg.work_dir / "20260101_테스트_선반"
    (folder / "source").mkdir(parents=True)
    _lavfi(folder / "clean.mp4", "-f", "lavfi", "-i", "testsrc2=size=480x854:rate=30:duration=3",
           "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest")
    _lavfi(folder / "voice.mp3", "-f", "lavfi", "-i", "sine=frequency=220:duration=5", "-c:a", "libmp3lame")
    _lavfi(tmp_path / "bgm.mp3", "-f", "lavfi", "-i", "sine=frequency=110:duration=2", "-c:a", "libmp3lame")
    (folder / "scripts.md").write_text(SCRIPTS, encoding="utf-8")
    (folder / "pick.txt").write_text("A\n", encoding="utf-8")
    return Episode(folder)


def test_ass_helpers():
    assert _ass_color("#87CEEB") == "&H00EBCE87"
    assert _ass_color("#FFFFFF", 0.75) == "&H40FFFFFF"
    assert _ass_time(61.5) == "0:01:01.50"
    assert _filter_path(Path("/a/b/c.ass"), Path("/a/b")) == "'c.ass'"
    assert _filter_path(Path("C:/x/y.ass"), Path("/z")).startswith("'") and "\\:" in _filter_path(Path("C:/x/y.ass"), Path("/z"))


def test_build_ass_contains_title_and_captions():
    cfg = Config.load(ROOT / "config.yaml")
    chunks = [Chunk("2단과 3단", "이단과 삼단", 0.0, 1.2), Chunk("넉넉해요", "넉넉해요", 1.2, 2.5)]
    ass = build_ass(chunks, ["나만 쓰기 아까운", "감성 원목 선반"], cfg)
    assert "PlayResX: 1080" in ass and "PlayResY: 1920" in ass
    assert "Style: Title," in ass and "Style: Caption," in ass
    assert ass.count("Dialogue:") == 3
    assert f"\\pos(540,{round(1920 * cfg.get('title.position_y'))})" in ass  # 제목 위치
    assert "\\pos(540,1075)" in ass  # 자막 56%
    assert "{\\c&H00EBCE87}감성 원목 선반" in ass


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg가 없음")
def test_full_run_creates_outputs(cfg, episode):
    report = pipeline.run(episode, cfg)
    assert episode.final_mp4.exists() and episode.final_mp4.stat().st_size > 10_000
    assert episode.captions_srt.exists() and episode.captions_json.exists()
    assert (episode.preview_dir / "sheet.jpg").exists()
    assert report.capcut_project is not None and (report.capcut_project / "draft_content.json").exists()

    from autoshorts.media import probe

    info = probe(episode.final_mp4)
    assert (info.width, info.height) == (1080, 1920)
    assert abs(info.duration - 6.0) < 0.3  # 나레이션 5초 + 여유 1초 (원본 3초는 반복)
    assert info.has_audio and info.has_video

    upload = episode.upload_txt.read_text(encoding="utf-8")
    assert upload.startswith("제목: 나만 쓰기 아까운 감성 원목 선반")
    assert "구매 링크: https://example.com/shelf" in upload

    draft = json.loads((report.capcut_project / "draft_content.json").read_text(encoding="utf-8"))
    names = {t.get("name") for t in draft["tracks"]}
    assert {"narration", "bgm", "captions", "title1", "title2"} <= names
    assert draft["canvas_config"]["width"] == 1080 and draft["canvas_config"]["height"] == 1920


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg가 없음")
def test_run_stops_without_pick(cfg, episode):
    episode.pick_txt.unlink()
    with pytest.raises(pipeline.StopForHuman):
        pipeline.run(episode, cfg)


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg가 없음")
def test_run_stops_on_needs_check(cfg, episode):
    episode.scripts_md.write_text(SCRIPTS.replace("- 없음", "- 하중 수치 확인"), encoding="utf-8")
    with pytest.raises(pipeline.StopForHuman) as e:
        pipeline.run(episode, cfg)
    assert "확인 필요" in str(e.value)
    assert not episode.captions_srt.exists()


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg가 없음")
def test_capcut_test_draft(cfg, episode):
    from autoshorts.capcut import capcut_test

    path = capcut_test(episode.clean_video, cfg, name="unit_test")
    draft = json.loads((path / "draft_content.json").read_text(encoding="utf-8"))
    kinds = [t["type"] for t in draft["tracks"]]
    assert kinds.count("video") == 1 and kinds.count("text") == 1
