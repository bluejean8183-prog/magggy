@echo off
chcp 65001 >nul
REM ─────────────────────────────────────────────────────────────
REM  11번가 자동화용 크롬 실행 (원격 디버깅 포트 9222)
REM  이 창으로 뜬 크롬에서 11번가 셀러오피스에 로그인해 주세요.
REM  로그인 정보는 이 전용 프로필에만 저장되고, 평소 쓰시는
REM  크롬 프로필은 건드리지 않습니다.
REM ─────────────────────────────────────────────────────────────

set "PROFILE=%USERPROFILE%\11st-automation-profile"

set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined CHROME (
  if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "CHROME=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "CHROME=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
)

if not defined CHROME (
  echo [오류] 크롬이나 엣지를 찾지 못했습니다.
  echo 크롬 설치 경로를 알려주시면 이 파일을 고쳐 드리겠습니다.
  pause
  exit /b 1
)

echo 실행할 브라우저: %CHROME%
echo 전용 프로필 폴더: %PROFILE%
echo.
echo 브라우저가 열리면 11번가 셀러오피스에 로그인한 뒤,
echo 상품관리 - 판매상품 조회/수정 으로 이동해서
echo 판매상태를 "판매중"으로 놓고 조회해 주세요.
echo.
echo 이 창은 닫지 마세요.
echo.

start "" "%CHROME%" --remote-debugging-port=9222 --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check "https://soffice.11st.co.kr/"

echo 브라우저를 실행했습니다. 이제 Claude Code 창으로 돌아가 주세요.
pause
