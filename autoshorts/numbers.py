"""음성용 대본의 한글 숫자를 자막용 숫자로 되돌린다.

예) "이단과 삼단 구조" -> "2단과 3단 구조", "삼십 센티" -> "30 센티", "세 칸" -> "3칸"
"""
from __future__ import annotations

import re

SINO_DIGITS = {"영": 0, "공": 0, "일": 1, "이": 2, "삼": 3, "사": 4, "오": 5, "육": 6, "칠": 7, "팔": 8, "구": 9}
SINO_UNITS = {"십": 10, "백": 100, "천": 1000}
SINO_BIG = {"만": 10**4, "억": 10**8}
SINO_CHARS = "".join(SINO_DIGITS) + "".join(SINO_UNITS) + "".join(SINO_BIG)

# 한자어 수사 뒤에 붙는 단위. 긴 것부터 맞춰야 하므로 길이순 정렬.
SINO_COUNTERS = sorted(
    """단 단계 개 개월 센티 센치 센티미터 밀리 밀리미터 밀리리터 미터 리터 킬로 킬로그램 킬로미터 그램 인치 퍼센트 프로 배
    년 월 일 시간 분 초 번 가지 종 종류 장 칸 층 색 색상 컬러 세트 세대 인 인용 인분 와트 볼트 암페어 밀리암페어 헤르츠
    기가 메가 테라 마력 포인트 피스 팩 매 박스 봉 병 캔 롤 켤레 쌍 등급 겹 줄 호 사이즈 평 데시벨 원 달러 위안 엔 회 차 폭 단짜리 인치형 밀리짜리 리터짜리 킬로짜리""".split(),
    key=len,
    reverse=True,
)

# 고유어 수사 + 단위 (보수적으로 단위 목록을 좁게 둔다)
NATIVE_ONES = {"한": 1, "두": 2, "세": 3, "네": 4, "다섯": 5, "여섯": 6, "일곱": 7, "여덟": 8, "아홉": 9}
NATIVE_TENS = {"열": 10, "스무": 20, "스물": 20, "서른": 30, "마흔": 40, "쉰": 50}
NATIVE_COUNTERS = sorted(
    """개 칸 가지 장 단계 종류 켤레 병 잔 봉지 묶음 세트 쌍 마리 겹 층 번째 포기 통 그릇 접시 줄 벌 권 송이 조각 알""".split(),
    key=len,
    reverse=True,
)


def sino_to_number(word: str) -> int | float | None:
    """'삼십이' -> 32, '천이백' -> 1200, '이점오' -> 2.5. 해석 불가면 None."""
    if not word:
        return None
    if "점" in word:
        head, _, tail = word.partition("점")
        whole = sino_to_number(head) if head else 0
        if whole is None or not tail or any(ch not in SINO_DIGITS for ch in tail):
            return None
        frac = "".join(str(SINO_DIGITS[ch]) for ch in tail)
        return float(f"{int(whole)}.{frac}")

    total = 0
    section = 0  # 만/억 아래 부분
    current = 0
    for ch in word:
        if ch in SINO_DIGITS:
            if current:  # '일이' 같이 자릿수 없이 이어진 수 (예: 전화번호)는 나열 숫자로 본다
                return _digit_string(word)
            current = SINO_DIGITS[ch]
        elif ch in SINO_UNITS:
            section += (current or 1) * SINO_UNITS[ch]
            current = 0
        elif ch in SINO_BIG:
            section += current
            total += (section or 1) * SINO_BIG[ch]
            section, current = 0, 0
        else:
            return None
    return total + section + current


def _digit_string(word: str) -> int | None:
    if all(ch in SINO_DIGITS for ch in word):
        return int("".join(str(SINO_DIGITS[ch]) for ch in word))
    return None


def format_number(value: int | float) -> str:
    if isinstance(value, float):
        text = f"{value:.3f}".rstrip("0").rstrip(".")
        return text
    if value >= 10000 and value % 10000 == 0:
        return f"{value // 10000}만"
    return str(value)


def native_to_number(word: str) -> int | None:
    for tens_word, tens in sorted(NATIVE_TENS.items(), key=lambda kv: -len(kv[0])):
        if word.startswith(tens_word):
            rest = word[len(tens_word):]
            if not rest:
                return tens
            if rest in NATIVE_ONES:
                return tens + NATIVE_ONES[rest]
            return None
    return NATIVE_ONES.get(word)


_SINO_RE = re.compile(
    rf"(?<![{SINO_CHARS}점])([{SINO_CHARS}]+(?:점[{''.join(SINO_DIGITS)}]+)?)( ?)({'|'.join(SINO_COUNTERS)})"
)
_NATIVE_PATTERN = (
    "(?:" + "|".join(sorted(NATIVE_TENS, key=len, reverse=True)) + ")?"
    "(?:" + "|".join(sorted(NATIVE_ONES, key=len, reverse=True)) + ")?"
)
_NATIVE_RE = re.compile(
    rf"(?<![가-힣])({_NATIVE_PATTERN})( ?)({'|'.join(NATIVE_COUNTERS)})"
)

# 단위 뒤에 바로 이어져도 숫자로 봐도 되는 조사·접미사
PARTICLES = tuple(
    """과 와 이 가 은 는 을 를 으로 로 에 의 도 만 까지 부터 씩 짜리 이나 이에요 이라 입니다 인데 이고 이면 대 쯤 정도 짜리 형 용 식 짜리 이상 이하 이내 중 당 마다 째 째로""".split()
)
# 숫자+단위 꼴이지만 숫자가 아닌 흔한 낱말
STOPWORDS = {"일단", "일부", "이상", "이하", "이내", "이번", "사장", "이장", "구장", "사단", "오장", "일장", "이색", "일색", "삼색"}


def _tail_ok(text: str, end: int) -> bool:
    """단위 뒤가 문장 끝/기호/공백이거나 조사로 이어지면 True."""
    rest = text[end:]
    if not rest or not ("가" <= rest[0] <= "힣"):
        return True
    return rest.startswith(PARTICLES)


def restore_numbers(text: str, *, native: bool = True) -> str:
    """한글로 적힌 숫자를 아라비아 숫자로 바꾼다. 단위가 뒤따를 때만 바꾼다."""

    def sino_sub(m: re.Match) -> str:
        word, space, counter = m.group(1), m.group(2), m.group(3)
        # '이 제품', '이 단계' 처럼 지시어 '이'가 띄어쓰기로 떨어져 있으면 숫자로 보지 않는다
        if word == "이" and space:
            return m.group(0)
        if (word + counter) in STOPWORDS or not _tail_ok(text, m.end()):
            return m.group(0)
        value = sino_to_number(word)
        if value is None:
            return m.group(0)
        return f"{format_number(value)}{counter}"

    out = _SINO_RE.sub(sino_sub, text)

    if native:

        def native_sub(m: re.Match) -> str:
            word, space, counter = m.group(1), m.group(2), m.group(3)
            if not word or not _tail_ok(out, m.end()):
                return m.group(0)
            value = native_to_number(word)
            if value is None:
                return m.group(0)
            return f"{value}{counter}"

        out = _NATIVE_RE.sub(native_sub, out)
    return out


def apply_replacements(text: str, replacements: dict[str, str] | None) -> str:
    """설정의 치환표를 적용한다. 치환 결과가 기호(%, cm 등)로 시작하면 앞 공백을 붙여 쓴다."""
    for src, dst in (replacements or {}).items():
        src, dst = str(src), str(dst)
        if dst and not ("가" <= dst[0] <= "힣"):
            text = re.sub(r"[ ]*" + re.escape(src), dst.replace("\\", "\\\\"), text)
        else:
            text = text.replace(src, dst)
    return text


def caption_text(voice_text: str, *, native: bool = True, replacements: dict[str, str] | None = None) -> str:
    """음성용 문장 -> 자막용 문장."""
    return apply_replacements(restore_numbers(voice_text, native=native), replacements)
