"""타입캐스트(Typecast) API로 나레이션 만들기.

- POST /v1/text-to-speech/with-timestamps?granularity=char : base64 오디오 + 글자별 타임스탬프
- POST /v1/text-to-speech                                   : 오디오만 (타임스탬프 실패 시 대체)
- GET  /v2/voices?model=...                                  : 보이스 목록
- GET  /v1/users/me/subscription                             : 크레딧 확인
API 키는 환경변수 TYPECAST_API_KEY (.env) 에서 읽는다.
"""
from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from pathlib import Path

import requests


class TTSError(RuntimeError):
    pass


@dataclass
class VoiceResult:
    audio_path: Path
    duration: float
    alignment: dict | None  # {"characters": [...], "words": [...]} 또는 None
    used_timestamps: bool


def _api_key() -> str:
    key = (os.environ.get("TYPECAST_API_KEY") or "").strip()
    if not key:
        raise TTSError("TYPECAST_API_KEY가 비어 있습니다. .env 파일에 적어 주세요 (.env.example 참고).")
    return key


def _headers() -> dict[str, str]:
    return {"X-API-KEY": _api_key(), "User-Agent": "autoshorts/0.1"}


def _raise_for(resp: requests.Response, what: str) -> None:
    if resp.status_code == 200:
        return
    hints = {
        401: "API 키가 틀렸습니다.",
        402: "크레딧이 부족하거나 요금제에서 막힌 기능입니다.",
        404: "이 엔드포인트를 쓸 수 없습니다 (요금제 또는 모델 확인).",
        422: "요청 값이 잘못되었습니다 (voice_id, model, speed 범위 0.5~2.0 확인).",
        429: "요청이 너무 잦습니다. 잠시 뒤 다시 시도하세요.",
    }
    raise TTSError(f"{what} 실패 ({resp.status_code}) {hints.get(resp.status_code, '')}\n{resp.text[:500]}")


def build_request(text: str, voice_cfg: dict) -> dict:
    model = voice_cfg.get("model", "ssfm-v30")
    speed = float(voice_cfg.get("speed", 1.0))
    if not 0.5 <= speed <= 2.0:
        raise TTSError(f"voice.speed={speed} 는 허용 범위(0.5~2.0)를 벗어납니다.")
    emotion = voice_cfg.get("emotion") or "normal"
    intensity = float(voice_cfg.get("emotion_intensity", 1.0))
    if str(model).startswith("ssfm-v3"):
        prompt = {"emotion_type": "preset", "emotion_preset": emotion, "emotion_intensity": intensity}
    else:
        prompt = {"emotion_preset": emotion, "emotion_intensity": intensity}
    body = {
        "voice_id": voice_cfg.get("voice_id") or "",
        "text": text,
        "model": model,
        "language": voice_cfg.get("language") or "kor",
        "prompt": prompt,
        "output": {"audio_format": voice_cfg.get("format") or "mp3", "audio_tempo": speed},
    }
    if not body["voice_id"]:
        raise TTSError("config.yaml의 voice.voice_id가 비어 있습니다. `python -m autoshorts voices` 로 목록을 보고 골라 적어 주세요.")
    return body


def synthesize(text: str, voice_cfg: dict, out_audio: Path, out_json: Path | None = None, *,
               probe_duration=None) -> VoiceResult:
    """대본 하나를 음성으로 만든다. 가능하면 타임스탬프도 함께 받는다."""
    host = (voice_cfg.get("api_host") or "https://api.typecast.ai").rstrip("/")
    body = build_request(text, voice_cfg)
    out_audio = Path(out_audio)
    alignment: dict | None = None
    used_ts = False
    duration = 0.0

    if voice_cfg.get("timestamps", True):
        resp = requests.post(f"{host}/v1/text-to-speech/with-timestamps", params={"granularity": "char"},
                             json=body, headers=_headers(), timeout=(10, 300))
        if resp.status_code == 200:
            data = resp.json()
            out_audio.write_bytes(base64.b64decode(data["audio"]))
            duration = float(data.get("audio_duration") or 0.0)
            alignment = {"characters": data.get("characters") or [], "words": data.get("words") or []}
            used_ts = True
        elif resp.status_code in (401, 422, 429):
            _raise_for(resp, "타임스탬프 음성 합성")
        # 그 밖(402/404/500 등)은 일반 합성으로 넘어간다

    if not used_ts:
        resp = requests.post(f"{host}/v1/text-to-speech", json=body, headers=_headers(), timeout=(10, 300))
        _raise_for(resp, "음성 합성")
        out_audio.write_bytes(resp.content)
        try:
            duration = float(resp.headers.get("X-Audio-Duration") or 0.0)
        except ValueError:
            duration = 0.0

    if (not duration) and probe_duration is not None:
        duration = float(probe_duration(out_audio))

    if out_json is not None:
        Path(out_json).write_text(json.dumps({
            "duration": duration, "used_timestamps": used_ts, "request": {k: v for k, v in body.items() if k != "text"},
            "text": text, **(alignment or {}),
        }, ensure_ascii=False, indent=2), encoding="utf-8")
    return VoiceResult(out_audio, duration, alignment, used_ts)


def load_alignment(path: Path) -> dict | None:
    """voice_timestamps.json 에서 타임스탬프를 읽는다. 없으면 None."""
    p = Path(path)
    if not p.exists():
        return None
    data = json.loads(p.read_text(encoding="utf-8"))
    if data.get("characters") or data.get("words"):
        return {"characters": data.get("characters") or [], "words": data.get("words") or []}
    return None


def list_voices(voice_cfg: dict, *, model: str | None = None) -> list[dict]:
    host = (voice_cfg.get("api_host") or "https://api.typecast.ai").rstrip("/")
    params = {"model": model} if model else {}
    resp = requests.get(f"{host}/v2/voices", params=params, headers=_headers(), timeout=60)
    _raise_for(resp, "보이스 목록")
    return resp.json()


def subscription(voice_cfg: dict) -> dict:
    host = (voice_cfg.get("api_host") or "https://api.typecast.ai").rstrip("/")
    resp = requests.get(f"{host}/v1/users/me/subscription", headers=_headers(), timeout=60)
    _raise_for(resp, "구독 정보")
    return resp.json()
