from autoshorts.captions import Chunk, make_chunks, read_srt, srt_time, time_chunks, write_srt

VOICE = "이단과 삼단 구조로 공간을 넉넉하게 나눠 써요.\n욕실 선반 위에 올려만 두면 정리가 끝나요.\n링크는 프로필이나 고정댓글에서 확인해주세요."


def test_chunks_are_short_and_cover_text():
    chunks = make_chunks(VOICE)
    assert 5 <= len(chunks) <= 8
    assert all(len(c.text) <= 19 for c in chunks)
    assert chunks[0].text.startswith("2단과 3단")
    assert all(not c.text.endswith(".") for c in chunks)
    joined = "".join(c.voice_text for c in chunks).replace(" ", "")
    assert joined == VOICE.replace(" ", "").replace("\n", "")


def test_proportional_timing_is_continuous():
    chunks = make_chunks(VOICE)
    warnings = time_chunks(chunks, VOICE, 12.0)
    assert warnings == []
    assert chunks[0].start == 0
    for a, b in zip(chunks, chunks[1:]):
        assert abs(a.end - b.start) < 1e-6
    assert chunks[-1].end == 12.0
    assert all(c.duration >= 0.6 for c in chunks)


def test_alignment_timing_uses_char_timestamps():
    voice = "안녕하세요 반갑습니다.\n링크는 프로필에서 확인해주세요."
    letters = [ch for ch in voice if not ch.isspace()]
    characters, t = [], 0.0
    for ch in letters:
        characters.append({"text": ch, "start": round(t, 3), "end": round(t + 0.2, 3)})
        t += 0.2
    chunks = make_chunks(voice)
    warnings = time_chunks(chunks, voice, t + 1.0, alignment={"characters": characters, "words": []})
    assert warnings == []
    # 두 번째 문장 첫 조각은 첫 문장 글자 수 * 0.2초 뒤에 시작
    first_sentence_letters = len("안녕하세요반갑습니다.")
    second = [c for c in chunks if c.voice_text.startswith("링크는")][0]
    assert abs(second.start - first_sentence_letters * 0.2) < 1e-6


def test_alignment_mismatch_falls_back():
    chunks = make_chunks(VOICE)
    warnings = time_chunks(chunks, VOICE, 10.0, alignment={"characters": [{"text": "가", "start": 0, "end": 1}], "words": []})
    assert warnings and "비례" in warnings[0]
    assert chunks[-1].end == 10.0


def test_caption_override_replaces_text_when_counts_match():
    voice = "첫 문장이에요.\n둘째 문장이에요."
    chunks = make_chunks(voice, caption_override=["첫 문장 자막", "둘째 문장 자막"])
    assert [c.text for c in chunks] == ["첫 문장 자막", "둘째 문장 자막"]


def test_srt_roundtrip(tmp_path):
    chunks = [Chunk("하나", "하나", 0.0, 1.5), Chunk("둘, 셋", "둘, 셋", 1.5, 3.25)]
    path = tmp_path / "c.srt"
    write_srt(chunks, path)
    assert srt_time(3.25) == "00:00:03,250"
    back = read_srt(path)
    assert [(c.text, c.start, c.end) for c in back] == [("하나", 0.0, 1.5), ("둘, 셋", 1.5, 3.25)]
