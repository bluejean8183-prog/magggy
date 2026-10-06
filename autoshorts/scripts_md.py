"""scripts.md (대본 A·B·C와 공용 캡션) 읽고 쓰기.

형식은 CLAUDE.md에 적힌 것과 같다. 대본은 클로드코드가 assets/prompt.md 지침으로 쓴다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

SCRIPT_KINDS = {"A": "제품 중심 경험담", "B": "상황 중심 스토리", "C": "담백한 제품 소개"}
NEEDS_CHECK = "확인 필요"
LAST_SENTENCE = "링크는 프로필이나 고정댓글에서 확인해주세요"


@dataclass
class Script:
    kind: str
    title_lines: list[str] = field(default_factory=list)
    voice_lines: list[str] = field(default_factory=list)
    caption_lines: list[str] | None = None  # '### 자막용'이 있으면 그대로 쓴다

    @property
    def voice_text(self) -> str:
        return "\n".join(self.voice_lines)


@dataclass
class Scripts:
    product: str = ""
    scripts: dict[str, Script] = field(default_factory=dict)
    caption_lines: list[str] = field(default_factory=list)  # 공용 캡션 (해시태그·링크 줄 포함)
    needs_check: list[str] = field(default_factory=list)

    def get(self, kind: str) -> Script:
        kind = kind.upper()
        if kind not in self.scripts:
            raise KeyError(f"scripts.md에 대본 {kind}가 없습니다 (있는 것: {', '.join(self.scripts) or '없음'})")
        return self.scripts[kind]

    @property
    def hashtags(self) -> list[str]:
        tags: list[str] = []
        for line in self.caption_lines:
            tags += re.findall(r"#\S+", line)
        return tags

    @property
    def link_line(self) -> str | None:
        for line in self.caption_lines:
            if line.startswith("구매 링크") or "링크 붙여넣기" in line:
                return line
        return None


_H2 = re.compile(r"^##\s+(.*?)\s*$")
_H3 = re.compile(r"^###\s+(.*?)\s*$")
_KIND = re.compile(r"^([ABC])\s*[.．:：\-]?\s*(.*)$")


def _clean_lines(lines: list[str]) -> list[str]:
    out = []
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        line = re.sub(r"^(\d+[.)]|[-*•])\s+", "", line)  # 번호·불릿 제거
        out.append(line)
    return out


def parse(text: str) -> Scripts:
    result = Scripts()
    lines = text.splitlines()

    for line in lines:
        if line.startswith("# "):
            title = line[2:].strip()
            result.product = re.sub(r"^대본\s*[:：]\s*", "", title).strip()
            break

    sections: list[tuple[str, list[str]]] = []
    current: tuple[str, list[str]] | None = None
    for line in lines:
        m = _H2.match(line)
        if m:
            current = (m.group(1), [])
            sections.append(current)
        elif current is not None:
            current[1].append(line)

    for heading, body in sections:
        if heading.startswith(NEEDS_CHECK):
            items = [l for l in _clean_lines(body) if l not in ("없음", "없음.", "-", "없습니다", "없습니다.")]
            result.needs_check += items
            continue
        if heading.startswith("공용 캡션") or heading.startswith("캡션"):
            result.caption_lines = _clean_lines(body)
            continue
        km = _KIND.match(heading)
        if km:
            script = Script(kind=km.group(1))
            sub: str | None = None
            buckets: dict[str, list[str]] = {}
            for line in body:
                hm = _H3.match(line)
                if hm:
                    sub = hm.group(1)
                    buckets[sub] = []
                elif sub is not None:
                    buckets[sub].append(line)
                else:
                    buckets.setdefault("_", []).append(line)
            for sub, sub_lines in buckets.items():
                if sub.startswith("제목"):
                    script.title_lines = _clean_lines(sub_lines)[:2]
                elif sub.startswith("음성"):
                    script.voice_lines = _clean_lines(sub_lines)
                elif sub.startswith("자막"):
                    script.caption_lines = _clean_lines(sub_lines)
            if not script.voice_lines and buckets.get("_"):
                script.voice_lines = _clean_lines(buckets["_"])
            result.scripts[script.kind] = script

    # 본문 어디든 '확인 필요:' 로 시작하는 줄이 있으면 역시 멈춘다
    for line in lines:
        s = line.strip().lstrip("-* ")
        if s.startswith(NEEDS_CHECK + ":") or s.startswith(NEEDS_CHECK + "："):
            item = s.split(":", 1)[-1].split("：", 1)[-1].strip()
            if item and item not in ("없음", "없음.") and item not in result.needs_check:
                result.needs_check.append(item)
    return result


def load(path: Path) -> Scripts:
    return parse(Path(path).read_text(encoding="utf-8-sig"))


def validate(scripts: Scripts) -> list[str]:
    """지침과 어긋나는 점을 경고 문자열로 돌려준다 (막지는 않는다)."""
    warnings: list[str] = []
    for kind in "ABC":
        if kind not in scripts.scripts:
            warnings.append(f"대본 {kind}가 없습니다.")
            continue
        s = scripts.scripts[kind]
        if len(s.title_lines) != 2:
            warnings.append(f"대본 {kind}: 제목은 2줄이어야 합니다 (현재 {len(s.title_lines)}줄).")
        n = len(s.voice_lines)
        if not 5 <= n <= 7:
            warnings.append(f"대본 {kind}: 문장 수 {n} (지침 5~7문장).")
        total = len(s.voice_text.replace("\n", ""))
        if not 160 <= total <= 230:
            warnings.append(f"대본 {kind}: 공백 포함 {total}자 (지침 160~230자).")
        for i, line in enumerate(s.voice_lines, 1):
            if len(line) > 25:
                warnings.append(f"대본 {kind} {i}번 문장 {len(line)}자 (지침 25자 이내).")
            if re.search(r"[0-9A-Za-z]", line):
                warnings.append(f"대본 {kind} {i}번 문장에 숫자/영어가 있습니다. 음성용은 한글 발음으로 적습니다.")
        if s.voice_lines and LAST_SENTENCE.rstrip(".") not in s.voice_lines[-1]:
            warnings.append(f"대본 {kind}: 마지막 문장은 '{LAST_SENTENCE}'로 통일합니다.")
    if not scripts.caption_lines:
        warnings.append("공용 캡션이 없습니다.")
    else:
        if len(scripts.hashtags) != 5:
            warnings.append(f"해시태그 {len(scripts.hashtags)}개 (지침 5개).")
        if not scripts.link_line:
            warnings.append("공용 캡션에 구매 링크 줄이 없습니다.")
    return warnings


def template(product: str, images: list[Path]) -> str:
    """클로드코드가 채울 scripts.md 뼈대."""
    img_list = "\n".join(f"- {p.name}" for p in images) or "- (source/ 폴더에 상세페이지 이미지가 없습니다)"
    blocks = []
    for kind, label in SCRIPT_KINDS.items():
        blocks.append(
            f"## {kind}. {label}\n### 제목\n(1줄 수식어)\n(2줄 제품명)\n### 음성용\n(5~7문장, 문장마다 줄바꿈, 숫자·영어는 한글 발음)\n{LAST_SENTENCE}.\n"
        )
    return (
        f"# 대본: {product}\n\n"
        f"<!-- 참고한 상세페이지 이미지 -->\n{img_list}\n\n"
        "## 확인 필요\n- 없음\n\n" + "\n".join(blocks) + "\n## 공용 캡션\n(2~3줄 설명)\n#태그1 #태그2 #태그3 #태그4 #태그5\n구매 링크: (여기에 링크 붙여넣기)\n"
    )
