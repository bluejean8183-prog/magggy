"""자막 조각 나누기, 타이밍 맞추기, SRT/JSON 읽고 쓰기."""
from __future__ import annotations

import json
import math
import re
from dataclasses import asdict, dataclass
from pathlib import Path

from .numbers import caption_text


@dataclass
class Chunk:
    text: str          # 자막에 보일 글
    voice_text: str    # 음성용 원문 조각
    start: float = 0.0
    end: float = 0.0
    span: tuple[int, int] = (0, 0)  # 음성용 전체 텍스트 안의 [시작, 끝) 인덱스

    @property
    def duration(self) -> float:
        return self.end - self.start


@dataclass
class CharTime:
    char: str
    start: float
    end: float


_SENT_END = re.compile(r"(?<=[.!?。！？…])\s+")


def split_sentences(voice_text: str) -> list[tuple[int, int]]:
    """줄 단위(지침상 한 줄 = 한 문장)로, 줄 안에 문장부호가 더 있으면 다시 나눈다. 인덱스 범위를 돌려준다."""
    spans: list[tuple[int, int]] = []
    pos = 0
    for line in voice_text.split("\n"):
        line_start = pos
        pos += len(line) + 1
        if not line.strip():
            continue
        offset = 0
        for piece in _SENT_END.split(line):
            idx = line.find(piece, offset)
            if idx < 0:
                idx = offset
            offset = idx + len(piece)
            s, e = _trim_span(voice_text, line_start + idx, line_start + idx + len(piece))
            if e > s:
                spans.append((s, e))
    return spans


def _trim_span(text: str, s: int, e: int) -> tuple[int, int]:
    while s < e and text[s].isspace():
        s += 1
    while e > s and text[e - 1].isspace():
        e -= 1
    return s, e


def _strip_caption(piece: str) -> str:
    piece = piece.strip()
    piece = re.sub(r"[.。]+$", "", piece)  # 끝 마침표 제거
    piece = piece.rstrip(",，")
    return piece.strip()


def split_sentence_chunks(text: str, s: int, e: int, target: int = 15, max_len: int = 19) -> list[tuple[int, int]]:
    """한 문장을 target자 안팎 조각으로 나눈다. 띄어쓰기(쉼표 우선) 자리에서만 자른다."""
    sentence = text[s:e]
    n = len(sentence)
    if n <= max_len:
        return [(s, e)]
    k = max(2, round(n / target))
    while math.ceil(n / k) > max_len:
        k += 1

    # 자를 수 있는 자리: 공백 위치 (쉼표 뒤 공백은 가산점)
    candidates = [(i, 2 if sentence[i - 1] in ",，" else 1) for i, ch in enumerate(sentence) if ch == " " and 0 < i < n]
    if not candidates:
        return [(s, e)]

    cuts: list[int] = []
    prev = 0
    for j in range(1, k):
        ideal = round(n * j / k)
        best, best_score = None, None
        for pos, weight in candidates:
            if pos <= prev or pos >= n:
                continue
            score = abs(pos - ideal) - (3 if weight == 2 else 0)
            if best_score is None or score < best_score:
                best, best_score = pos, score
        if best is None or best <= prev:
            break
        cuts.append(best)
        prev = best

    bounds = [0, *cuts, n]
    spans = []
    for a, b in zip(bounds, bounds[1:]):
        ss, ee = _trim_span(text, s + a, s + b)
        if ee > ss:
            spans.append((ss, ee))
    return spans


def make_chunks(voice_text: str, *, target: int = 15, max_len: int = 19, native_numbers: bool = True,
                replacements: dict[str, str] | None = None, caption_override: list[str] | None = None) -> list[Chunk]:
    """음성용 텍스트 -> 자막 조각(타이밍 없음)."""
    chunks: list[Chunk] = []
    for s, e in split_sentences(voice_text):
        for cs, ce in split_sentence_chunks(voice_text, s, e, target, max_len):
            piece = voice_text[cs:ce]
            text = _strip_caption(caption_text(piece, native=native_numbers, replacements=replacements))
            if text:
                chunks.append(Chunk(text=text, voice_text=piece, span=(cs, ce)))

    if caption_override:
        # 클로드코드가 '### 자막용'을 썼으면 그 문장을 같은 수의 조각으로 쓰되, 조각 수가 다르면 문장 단위로 다시 나눈다
        override_chunks: list[str] = []
        for line in caption_override:
            line = line.strip()
            if not line:
                continue
            if len(line) <= max_len:
                override_chunks.append(_strip_caption(line))
            else:
                for cs, ce in split_sentence_chunks(line, 0, len(line), target, max_len):
                    override_chunks.append(_strip_caption(line[cs:ce]))
        if len(override_chunks) == len(chunks):
            for c, t in zip(chunks, override_chunks):
                c.text = t
    return chunks


# ---------------- 타이밍 ----------------

def char_times_from_alignment(alignment: dict) -> list[CharTime]:
    """타입캐스트 with-timestamps 응답(characters 또는 words)을 글자 단위 시간 목록으로 바꾼다."""
    chars = alignment.get("characters") or []
    if chars:
        return [CharTime(c["text"], float(c["start"]), float(c["end"])) for c in chars]
    out: list[CharTime] = []
    for w in alignment.get("words") or []:
        text, start, end = w["text"], float(w["start"]), float(w["end"])
        letters = [ch for ch in text if not ch.isspace()]
        if not letters:
            continue
        step = (end - start) / len(letters)
        for i, ch in enumerate(letters):
            out.append(CharTime(ch, start + i * step, start + (i + 1) * step))
        out.append(CharTime(" ", end, end))
    return out


def time_chunks(chunks: list[Chunk], voice_text: str, audio_duration: float, *,
                alignment: dict | None = None, min_duration: float = 0.6) -> list[str]:
    """조각마다 start/end를 채운다. 타임스탬프가 없거나 맞지 않으면 글자 수 비례로 나눈다. 경고 목록을 돌려준다."""
    warnings: list[str] = []
    timed = False
    if alignment:
        times = char_times_from_alignment(alignment)
        letters = [t for t in times if not t.char.isspace()]
        voice_letters = [i for i, ch in enumerate(voice_text) if not ch.isspace()]
        if letters and len(letters) == len(voice_letters):
            if "".join(t.char for t in letters) != "".join(voice_text[i] for i in voice_letters):
                warnings.append("타임스탬프 글자가 대본과 조금 다릅니다. 위치 기준으로 맞춥니다.")
            index_time = {idx: t for idx, t in zip(voice_letters, letters)}
            for c in chunks:
                inside = [index_time[i] for i in range(c.span[0], c.span[1]) if i in index_time]
                if inside:
                    c.start, c.end = inside[0].start, inside[-1].end
            timed = all(c.end > c.start for c in chunks)
        else:
            warnings.append(
                f"타임스탬프 글자 수({len(letters)})와 대본 글자 수({len(voice_letters)})가 달라 글자 수 비례로 나눕니다."
            )
    if not timed:
        _proportional(chunks, audio_duration)

    _tidy(chunks, audio_duration, min_duration)
    return warnings


def _proportional(chunks: list[Chunk], audio_duration: float) -> None:
    weights = [max(1, len(c.voice_text.replace(" ", ""))) + 1.5 for c in chunks]  # 조각 사이 숨 고르기 가중
    total = sum(weights)
    t = 0.0
    for c, w in zip(chunks, weights):
        c.start = t
        t += audio_duration * w / total
        c.end = t


def _tidy(chunks: list[Chunk], audio_duration: float, min_duration: float) -> None:
    """겹침 제거, 빈틈 메우기(앞 조각을 다음 조각 시작까지 늘림), 마지막 조각은 오디오 끝까지."""
    for i, c in enumerate(chunks):
        if i + 1 < len(chunks):
            c.end = max(c.start + 0.05, chunks[i + 1].start)
        else:
            c.end = max(c.end, min(audio_duration, c.end + 0.3))
    # 너무 짧은 조각은 앞으로 당겨 최소 길이를 확보
    for i in range(len(chunks) - 1, 0, -1):
        c = chunks[i]
        if c.duration < min_duration:
            c.start = max(chunks[i - 1].start + 0.05, c.end - min_duration)
            chunks[i - 1].end = c.start
    for c in chunks:
        c.start, c.end = round(c.start, 3), round(c.end, 3)


# ---------------- 파일 ----------------

def srt_time(sec: float) -> str:
    ms = int(round(sec * 1000))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(chunks: list[Chunk], path: Path) -> None:
    lines = []
    for i, c in enumerate(chunks, 1):
        lines += [str(i), f"{srt_time(c.start)} --> {srt_time(c.end)}", c.text, ""]
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_json(chunks: list[Chunk], path: Path) -> None:
    Path(path).write_text(json.dumps([asdict(c) for c in chunks], ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: Path) -> list[Chunk]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return [Chunk(text=d["text"], voice_text=d.get("voice_text", d["text"]), start=d["start"], end=d["end"],
                  span=tuple(d.get("span", (0, 0)))) for d in data]


def read_srt(path: Path) -> list[Chunk]:
    text = Path(path).read_text(encoding="utf-8-sig")
    chunks = []
    for block in re.split(r"\n\s*\n", text.strip()):
        rows = [r for r in block.splitlines() if r.strip()]
        if len(rows) < 2:
            continue
        m = re.match(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)", rows[1] if "-->" in rows[1] else rows[0])
        if not m:
            continue
        v = [int(x) for x in m.groups()]
        start = v[0] * 3600 + v[1] * 60 + v[2] + v[3] / 1000
        end = v[4] * 3600 + v[5] * 60 + v[6] + v[7] / 1000
        body = rows[2:] if "-->" in rows[1] else rows[1:]
        chunks.append(Chunk(text=" ".join(body), voice_text=" ".join(body), start=start, end=end))
    return chunks
