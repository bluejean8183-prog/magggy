# 쇼핑쇼츠 자동 제작 프로그램 (autoshorts)

타오바오 상품 페이지에서 받은 AiPrice ZIP(상세페이지 이미지 + 판매자 영상)으로 약 15~25초짜리 쇼츠를 만듭니다.
프로그램은 완성 mp4(FFmpeg)와 수정용 캡컷 프로젝트(pyCapCut), 캡션 파일(upload.txt)을 함께 만들어 둡니다.
기획서의 **0단계(캡컷 시험)와 1단계(핵심부)** 구현입니다.

사람이 하는 일은 세 가지입니다.

1. 상품 페이지에서 AiPrice ZIP 다운로드 → 중국어 자막을 지운 영상을 `clean.mp4`로 넣기
2. 대본 A·B·C 중 하나 선택
3. 완성본 확인 후 업로드 (고칠 편만 캡컷에서 열기)

## 설치 (윈도우 기준)

```powershell
# 1) Python 3.10 이상, FFmpeg(ffmpeg/ffprobe가 PATH에 있어야 함), 캡컷 PC 버전
# 2) 파이썬 패키지
pip install -r requirements.txt
# 3) mp4용 무료 글꼴 (SIL OFL, 상업 이용 가능) 내려받기 -> assets/fonts/
python scripts/fetch_fonts.py
# 4) API 키
copy .env.example .env     # TYPECAST_API_KEY= 에 키를 적는다. 코드에는 적지 않는다.
```

`config.yaml`에서 두 가지를 채웁니다.

- `voice.voice_id`: `python -m autoshorts voices` 로 목록을 보고 쓰는 캐릭터의 `tc_...` 값
- `capcut.draft_folder`: 캡컷 설정 > 초안 위치. 보통 `C:/Users/<이름>/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft`

배경음은 상업 이용이 가능한 파일을 `assets/bgm/`에 넣습니다(없으면 배경음 없이 만듭니다).

## 0단계: 캡컷 시험

```powershell
python -m autoshorts capcut-test <아무 영상.mp4>
```

영상 하나와 자막 하나만 든 최소 프로젝트 `autoshorts_test`를 캡컷 초안 폴더에 만듭니다.
캡컷을 열어 목록에 보이고 열리는지 확인하세요.

- 열리면: `config.yaml`의 `output.capcut: true` 그대로. 캡컷 버전을 `capcut.version_note`에 적어 둡니다(업데이트 후 다시 시험).
- 안 열리면: `output.capcut: false` 로 바꾸고 mp4만 만듭니다.

## 1단계: 한 편 만들기

```powershell
# (1) 편 폴더 만들기: work/<날짜>_<상품명>/source/ 에 ZIP을 풀어 넣는다
python -m autoshorts new "감성 원목 선반" --zip C:\Downloads\aiprice.zip
#     중국어 자막을 지운 영상을 work/<편>/clean.mp4 로 넣는다 (Vmake 웹에서 수작업, 3단계에서 자동화 예정)

# (2) 대본: 클로드코드에서 "work/<편> 대본 써 줘" 라고 하면 assets/prompt.md 지침으로
#     상세페이지 이미지를 읽고 scripts.md(대본 A·B·C, 제목 2줄, 공용 캡션)를 쓴다. (CLAUDE.md 참고)
python -m autoshorts scripts <편>          # 형식 확인. 없으면 뼈대와 지시문을 만들어 준다

# (3) 대본 고르기 -> 고른 하나만 음성으로 만든다
python -m autoshorts pick <편> A

# (4) 끝까지 만들기: voice.mp3 -> captions.srt -> final.mp4 + 캡컷 프로젝트 -> upload.txt
python -m autoshorts run <편>
```

`run`이 끝나면 `work/<편>/preview/sheet.jpg`(1초 간격 화면 모음)와 캡컷 프로젝트 이름을 알려 주고 멈춥니다.
사람 손이 필요하면(대본 없음, "확인 필요" 항목, 대본 미선택, clean.mp4 없음) 그 자리에서 멈추고 할 일을 알려 줍니다.

단계를 따로 돌릴 수도 있습니다: `voice`, `captions`, `render`, `capcut`, `upload`.

## 편 폴더 구조

```
work/<날짜>_<상품명>/
  source/               압축 푼 상세페이지 이미지, 판매자 영상
  clean.mp4             중국어 자막을 지운 영상 (사람이 넣음)
  scripts.md            대본 A·B·C와 공용 캡션 (클로드코드가 씀)
  pick.txt              고른 대본 (A, B, C 중 하나)
  voice.mp3             나레이션
  voice_timestamps.json 타입캐스트 글자별 타임스탬프
  captions.srt / .json  자막 조각과 타이밍
  captions.ass          FFmpeg가 쓰는 자막 스타일 파일
  final.mp4             완성본
  preview/              1초 간격 화면 (frame_XX.jpg, sheet.jpg)
  upload.txt            제목, 캡션, 해시태그, 구매 링크 줄
assets/
  prompt.md             강의 지침 전문 (임시 요약본이 들어 있음. 전문으로 바꿔 넣을 것)
  bgm/                  배경음
  fonts/                mp4용 글꼴
config.yaml             보이스, 속도, 자막·제목 위치와 글꼴, 캡컷 폴더, 출력 켜고 끄기
links.csv               상품명,URL (선택. links.csv.example 참고). 없으면 "(여기에 링크 붙여넣기)"
```

캡컷 프로젝트는 캡컷 초안 폴더에 편 폴더와 같은 이름으로 생깁니다.

## 화면 구성 (기본값 = 샘플 2)

| 요소 | 기본값 | 설정 키 |
|---|---|---|
| 화면 | 1080×1920, 30fps, 나레이션 길이 + 1초. 원본이 길면 뒤를 자르고 짧으면 처음부터 반복, 원본 소리 제거 | `video.*` |
| 제목 | 2줄, 굵은 고딕(Black Han Sans), 1줄 흰색·2줄 하늘색, 검은 외곽선, 가운데, 시작 1초 | `title.*` |
| 자막 | 한 줄, 손글씨체(Nanum Pen), 검은 글씨, 흰 반투명 박스, 위에서 56% | `captions.*` |
| 자막 조각 | 문장을 15자 안팎으로 나누고 한글 숫자를 숫자로 되돌림 ("이단과 삼단" → "2단과 3단") | `captions.chars_per_chunk`, `captions.replacements` |
| 타이밍 | 타입캐스트 글자별 타임스탬프. 없으면 글자 수 비례 | `voice.timestamps` |
| 배경음 | `assets/bgm/` 첫 파일을 낮은 음량으로 | `video.bgm_volume` |

고딕 자막(샘플 1)으로 바꾸려면 `captions.font: assets/fonts/NotoSansKR-Bold.ttf`, 제목을 상단에 두려면 `title.position_y: 0.15`.

## 타입캐스트 API 확인 결과

공식 파이썬 SDK(`typecast-python` 0.5.2) 기준으로 확인한 내용입니다. 프로그램은 SDK 없이 `requests`로 같은 엔드포인트를 부릅니다.

- 인증: 헤더 `X-API-KEY`. 기본 주소 `https://api.typecast.ai`.
- 보이스 목록: `GET /v2/voices?model=ssfm-v30` → `python -m autoshorts voices`. 웹에서 쓰는 캐릭터가 API 목록에도 있는지 여기서 확인합니다.
- 속도: 요청 본문 `output.audio_tempo` (0.5~2.0). 가이드 권장 1.3~1.5는 범위 안입니다. `config.yaml`의 `voice.speed`.
- 타임스탬프: `POST /v1/text-to-speech/with-timestamps?granularity=char` → base64 오디오 + 글자별 `start/end`(초). 요금제에서 막히면(402/404) 자동으로 일반 합성(`POST /v1/text-to-speech`)으로 넘어가고 자막 타이밍은 글자 수 비례로 나눕니다.
- 모델: `ssfm-v30`(기본) / `ssfm-v21`. 감정 프리셋 normal·happy·sad·angry (v30은 whisper·toneup·tonedown 추가).
- 크레딧: `GET /v1/users/me/subscription` (요금제, 사용/전체 크레딧). `voices` 명령 끝에 함께 보여 줍니다.
- 무료 한도(월 30,000자)와 월 90편×230자 ≈ 20,700자는 기획서 수치이며, 실제 차감 방식은 위 구독 조회로 확인하세요.

## 만들기 전에 확인할 것 (기획서 체크리스트와 이 구현의 관계)

- 캡컷: `capcut-test`로 확인. pyCapCut이 아는 글꼴 목록에 한글 글꼴이 없어 캡컷 프로젝트는 캡컷 기본 글꼴을 씁니다(`capcut.font`로 시험 가능). 프로젝트는 윈도우 캡컷에서만 내보낼 수 있습니다.
- Vmake: 이 단계에서는 연결하지 않습니다. 자막 지운 영상을 `clean.mp4`로 직접 넣습니다.
- 타입캐스트: 위 확인 결과 참고. 실제 키로 `voices`를 돌려 보이스와 크레딧을 확인합니다.
- AiPrice ZIP: `new --zip`이 ZIP 안 파일을 `source/`에 평평하게 풉니다. 영상 여러 개 중 고르는 일은 2단계에서 합니다.
- 배경음·글꼴: 글꼴은 `scripts/fetch_fonts.py`(OFL). 배경음은 직접 준비.

## 개발

```powershell
python -m pytest -q        # 단위 테스트 + FFmpeg·pycapcut 통합 테스트(합성 영상)
```

- 코드는 `autoshorts/` 패키지. 단계별 모듈: `scripts_md`(대본 파서) → `tts`(타입캐스트) → `captions`(조각·타이밍) → `render`(FFmpeg) / `capcut`(pyCapCut) → `upload`.
- 클로드코드 작업 규칙은 `CLAUDE.md`에 있습니다.
