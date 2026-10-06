from pathlib import Path

from autoshorts import scripts_md

SAMPLE = """# 대본: 감성 원목 선반

## 확인 필요
- 없음

## A. 제품 중심 경험담
### 제목
나만 쓰기 아까운
감성 원목 선반
### 음성용
책상 위가 늘 어수선해서 하나 들였어요.
이단과 삼단 구조라 공간이 넉넉하게 나뉘어요.
폭은 삼십 센티라 좁은 자리에도 들어가요.
원목 느낌이라 어디에 둬도 잘 어울려요.
조립은 나사 네 개만 조이면 끝이에요.
링크는 프로필이나 고정댓글에서 확인해주세요.

## B. 상황 중심 스토리
### 제목
퇴근 후 책상이
달라 보이는 이유
### 음성용
한 문장.
링크는 프로필이나 고정댓글에서 확인해주세요.
### 자막용
한 문장
링크는 프로필이나 고정댓글에서 확인해주세요

## 공용 캡션
좁은 책상도 넉넉해지는 선반
#원목선반 #책상정리 #수납아이디어 #자취템 #인테리어소품
구매 링크: (여기에 링크 붙여넣기)
"""


def test_parse_sections():
    s = scripts_md.parse(SAMPLE)
    assert s.product == "감성 원목 선반"
    assert s.needs_check == []
    assert set(s.scripts) == {"A", "B"}
    a = s.get("a")
    assert a.title_lines == ["나만 쓰기 아까운", "감성 원목 선반"]
    assert len(a.voice_lines) == 6
    assert a.voice_text.startswith("책상 위가")
    assert s.scripts["B"].caption_lines == ["한 문장", "링크는 프로필이나 고정댓글에서 확인해주세요"]
    assert len(s.hashtags) == 5
    assert s.link_line.startswith("구매 링크")


def test_needs_check_detected():
    text = SAMPLE.replace("## 확인 필요\n- 없음", "## 확인 필요\n- 선반 하중이 상세페이지에 없음")
    s = scripts_md.parse(text)
    assert s.needs_check == ["선반 하중이 상세페이지에 없음"]
    inline = SAMPLE.replace("### 음성용\n한 문장.", "### 음성용\n한 문장.\n- 확인 필요: 색상 종류")
    assert scripts_md.parse(inline).needs_check == ["색상 종류"]


def test_validate_reports_guideline_issues():
    s = scripts_md.parse(SAMPLE)
    warnings = scripts_md.validate(s)
    assert any("대본 C가 없습니다" in w for w in warnings)
    assert any(w.startswith("대본 B") and "문장 수" in w for w in warnings)


def test_template_parses_back():
    t = scripts_md.template("테스트 상품", [Path("a.jpg")])
    s = scripts_md.parse(t)
    assert set(s.scripts) == {"A", "B", "C"}
    assert s.needs_check == []
