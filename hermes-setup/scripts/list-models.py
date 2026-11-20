#!/usr/bin/env python3
"""OpenRouter 의 실시간 모델 가격표에서 싼 유료 모델을 골라 보여 준다.

- API 키 없이 공개 가격표만 읽는다 (아무것도 바꾸지 않음).
- :free 모델, Anthropic(Claude) 모델, 도구 호출(tools)을 못 하는 모델은 뺀다.
- 실행: python3 list-models.py          (전체 상위 30개)
        python3 list-models.py gemini   (이름에 gemini 가 들어간 것만)
"""
import json
import sys
import urllib.request

URL = "https://openrouter.ai/api/v1/models"
WATCH = [  # 안내서에 적은 후보들 — 실시간 가격을 따로 보여 줌
    "google/gemini-2.5-flash-lite",
    "openai/gpt-5-nano",
    "deepseek/deepseek-v4-flash",
    "qwen/qwen3.7-flash",
    "openai/gpt-5-mini",
    "qwen/qwen3.7-plus",
    "google/gemini-3.1-flash-lite",
    "google/gemini-3.5-flash",
    "deepseek/deepseek-v4-pro",
]


def per_million(price):
    try:
        return float(price) * 1_000_000
    except (TypeError, ValueError):
        return None


def main():
    keyword = sys.argv[1].lower() if len(sys.argv) > 1 else ""
    with urllib.request.urlopen(URL, timeout=30) as resp:
        models = json.load(resp)["data"]

    rows = []
    for m in models:
        mid = m.get("id", "")
        if mid.endswith(":free") or mid.startswith("anthropic/"):
            continue
        if "tools" not in (m.get("supported_parameters") or []):
            continue
        pin = per_million(m.get("pricing", {}).get("prompt"))
        pout = per_million(m.get("pricing", {}).get("completion"))
        if pin is None or pout is None or (pin == 0 and pout == 0) or pin < 0:
            continue
        if keyword and keyword not in mid.lower():
            continue
        # 대화 한 번 ≈ 입력 3 : 출력 1 로 가정한 대략 비용
        blended = (pin * 3 + pout) / 4
        rows.append((blended, mid, pin, pout, m.get("context_length") or 0))

    rows.sort()
    print(f"{'모델 ID':<48} {'입력$/1M':>9} {'출력$/1M':>9} {'컨텍스트':>10}")
    print("-" * 80)
    for _, mid, pin, pout, ctx in rows[:30]:
        print(f"{mid:<48} {pin:>9.3f} {pout:>9.3f} {ctx:>10,}")

    if not keyword:
        print("\n=== 안내서 후보들의 현재 가격 ===")
        found = {r[1]: r for r in rows}
        for w in WATCH:
            hit = found.get(w) or next((r for k, r in found.items() if k.startswith(w)), None)
            if hit:
                print(f"{hit[1]:<48} {hit[2]:>9.3f} {hit[3]:>9.3f} {hit[4]:>10,}")
            else:
                print(f"{w:<48}  (목록에 없음 — 이름이 바뀌었거나 tools 미지원)")


if __name__ == "__main__":
    main()
