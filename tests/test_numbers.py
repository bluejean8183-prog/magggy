import pytest

from autoshorts.numbers import caption_text, restore_numbers, sino_to_number


@pytest.mark.parametrize("word,value", [
    ("이", 2), ("십", 10), ("십오", 15), ("삼십", 30), ("백", 100), ("천이백", 1200), ("이만", 20000),
    ("십오만", 150000), ("이점오", 2.5), ("영점오", 0.5),
])
def test_sino_to_number(word, value):
    assert sino_to_number(word) == value


@pytest.mark.parametrize("src,expected", [
    ("이단과 삼단 구조로", "2단과 3단 구조로"),
    ("삼십 센티 폭이에요", "30센티 폭이에요"),
    ("천이백 밀리리터 들어가요", "1200밀리리터 들어가요"),
    ("이점오 킬로그램", "2.5킬로그램"),
    ("십오만 원대", "15만원대"),
    ("열두 개 세트", "12개 세트"),
    ("세 칸이에요", "3칸이에요"),
    ("두 가지 색상", "2가지 색상"),
])
def test_restore_numbers(src, expected):
    assert restore_numbers(src) == expected


@pytest.mark.parametrize("src", [
    "이 제품은 좋아요", "일상에서 쓰기 좋아요", "일단 써 보니", "사장님이 추천", "사계절 내내",
    "오 분이면 끝", "이도 저도 아니에요", "한 번 써 보세요",
])
def test_no_false_positive(src):
    out = restore_numbers(src)
    # 숫자가 새로 생기면 안 되는 문장 (단, '오 분' -> '5분'은 허용)
    if src == "오 분이면 끝":
        assert out == "5분이면 끝"
    else:
        assert out == src


def test_replacements_attach_symbols():
    assert caption_text("삼십 퍼센트 할인", replacements={"퍼센트": "%"}) == "30% 할인"
    assert caption_text("삼십 센티", replacements={"센티": "cm"}) == "30cm"
    assert caption_text("엘이디 조명", replacements={"엘이디": "LED"}) == "LED 조명"
