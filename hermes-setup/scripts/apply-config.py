#!/usr/bin/env python3
"""준비해 둔 설정(overlay)을 헤르메스 프로필의 config.yaml 에 합쳐 넣는다.

사용법 (맥미니 터미널):
  python3 apply-config.py default
  python3 apply-config.py boss  --owner-id 123456789 --model openai/gpt-5-mini
  python3 apply-config.py staff --owner-id 123456789 --model google/gemini-2.5-flash-lite

하는 일
  1. 기존 config.yaml 을 config.yaml.bak-날짜시간 으로 백업
  2. overlay 의 값만 덮어쓰기 (나머지 설정은 그대로 둠)
  3. boss/staff 는 SOUL.md(성격·규칙)도 복사 (기존 것은 백업)
비밀 값(API 키, 봇 토큰)은 이 스크립트가 다루지 않는다 → set-secret.sh 사용.
"""
import argparse
import datetime
import glob
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SETUP = os.path.dirname(HERE)
HERMES = os.environ.get("HERMES_ROOT", os.path.expanduser("~/.hermes"))


def ensure_yaml():
    """PyYAML 이 없으면 헤르메스가 쓰는 파이썬으로 다시 실행한다."""
    try:
        import yaml  # noqa: F401
        return
    except ImportError:
        pass
    if os.environ.get("_APPLY_CONFIG_REEXEC"):
        sys.exit("PyYAML 을 찾지 못했어요. 이 화면을 그대로 보여 주세요.")
    candidates = []
    for pat in ("hermes-agent/venv/bin/python*", "hermes-agent/.venv/bin/python*", "**/bin/python3"):
        candidates += sorted(glob.glob(os.path.join(HERMES, pat), recursive=True))
    for py in candidates:
        if os.access(py, os.X_OK):
            os.environ["_APPLY_CONFIG_REEXEC"] = "1"
            os.execv(py, [py, os.path.abspath(__file__)] + sys.argv[1:])
    sys.exit("헤르메스용 파이썬을 찾지 못했어요. 이 화면을 그대로 보여 주세요.")


def deep_merge(base, extra):
    for key, val in extra.items():
        if isinstance(val, dict) and isinstance(base.get(key), dict):
            deep_merge(base[key], val)
        else:
            base[key] = val
    return base


def backup(path, stamp):
    if os.path.exists(path):
        dst = f"{path}.bak-{stamp}"
        shutil.copy2(path, dst)
        print(f"  백업: {dst}")


def main():
    ensure_yaml()
    import yaml

    ap = argparse.ArgumentParser()
    ap.add_argument("profile", choices=["default", "boss", "staff"])
    ap.add_argument("--owner-id", help="사장님 텔레그램 숫자 ID")
    ap.add_argument("--model", help="OpenRouter 모델 ID")
    args = ap.parse_args()

    if args.profile == "default":
        home = HERMES
        overlay_path = os.path.join(SETUP, "profiles", "default.overlay.yaml")
    else:
        home = os.path.join(HERMES, "profiles", args.profile)
        overlay_path = os.path.join(SETUP, "profiles", args.profile, "overlay.yaml")
        if not os.path.isdir(home):
            sys.exit(f"프로필 폴더가 없어요: {home}\n먼저 'hermes profile create {args.profile}' 를 실행해 주세요.")
        if not args.owner_id or not re.fullmatch(r"\d{5,15}", args.owner_id):
            sys.exit("--owner-id 에 텔레그램 숫자 ID를 넣어 주세요 (예: --owner-id 123456789).")
        if not args.model or ":free" in args.model or args.model.startswith("anthropic/"):
            sys.exit("--model 에 유료 OpenRouter 모델 ID를 넣어 주세요 (:free, Claude 모델 제외).")

    text = open(overlay_path, encoding="utf-8").read()
    text = text.replace("__OWNER_ID__", args.owner_id or "")
    text = text.replace("__BOSS_MODEL__", args.model or "").replace("__STAFF_MODEL__", args.model or "")
    overlay = yaml.safe_load(text) or {}

    cfg_path = os.path.join(home, "config.yaml")
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    print(f"[{args.profile}] {cfg_path}")
    current = {}
    if os.path.exists(cfg_path):
        current = yaml.safe_load(open(cfg_path, encoding="utf-8")) or {}
    backup(cfg_path, stamp)

    merged = deep_merge(current, overlay)
    with open(cfg_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(merged, f, allow_unicode=True, sort_keys=False)
    print("  설정 합치기 완료")

    if args.profile in ("boss", "staff"):
        soul_src = os.path.join(SETUP, "profiles", args.profile, "SOUL.md")
        soul_dst = os.path.join(home, "SOUL.md")
        backup(soul_dst, stamp)
        shutil.copy2(soul_src, soul_dst)
        print("  SOUL.md(성격·규칙) 복사 완료")

    print("\n바뀐 핵심 설정:")
    for key in ("model", "provider_routing", "platform_toolsets", "kanban", "unauthorized_dm_behavior"):
        if key in merged:
            print(f"  {key}: {merged[key]}")
    print("\n다음: hermes doctor 로 설정에 문제가 없는지 확인해 주세요.")


if __name__ == "__main__":
    main()
