# 윈도우 PC를 OpenClaw 노드로 등록하는 스크립트 (헤드리스 CLI 방식)
# 사용법 (PowerShell):
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   .\scripts\windows-node-setup.ps1 -GatewayHost 100.x.y.z -Token <토큰> -DisplayName win-pc
# GUI가 더 편하면 Windows Hub 앱을 쓰세요:
#   https://github.com/openclaw/openclaw-windows-node/releases/latest
param(
  [Parameter(Mandatory = $true)] [string] $GatewayHost,   # 맥미니 Tailscale IP 또는 LAN IP
  [Parameter(Mandatory = $true)] [string] $Token,         # 맥미니 gateway.auth.token 값
  [int]    $Port = 18789,
  [string] $DisplayName = "win-pc",
  [switch] $InstallService                                 # 지정하면 부팅 시 자동 실행되도록 등록
)

$ErrorActionPreference = "Stop"

Write-Host "== 1/3 OpenClaw CLI 설치 =="
if (Get-Command openclaw -ErrorAction SilentlyContinue) {
  Write-Host "이미 설치됨: $(openclaw --version)"
} else {
  & ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -NoOnboard
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";" + [Environment]::GetEnvironmentVariable("Path", "Machine")
  if (-not (Get-Command openclaw -ErrorAction SilentlyContinue)) {
    throw "openclaw 명령을 찾을 수 없습니다. PowerShell을 다시 열고 재실행하세요."
  }
}

Write-Host "== 2/3 Gateway 토큰을 사용자 환경변수로 저장 =="
[Environment]::SetEnvironmentVariable("OPENCLAW_GATEWAY_TOKEN", $Token, "User")
$env:OPENCLAW_GATEWAY_TOKEN = $Token

if ($InstallService) {
  Write-Host "== 3/3 노드 서비스 등록 (작업 스케줄러) =="
  openclaw node install --host $GatewayHost --port $Port --display-name $DisplayName
  openclaw node status
  Write-Host "`n맥미니에서 승인하세요:  openclaw nodes pending  →  openclaw nodes approve <requestId>"
} else {
  Write-Host "== 3/3 노드 포그라운드 실행 (Ctrl+C 로 종료) =="
  Write-Host "맥미니에서 승인하세요:  openclaw nodes pending  →  openclaw nodes approve <requestId>"
  Write-Host "정상 동작 확인 후 -InstallService 옵션으로 다시 실행하면 자동 시작으로 등록됩니다.`n"
  openclaw node run --host $GatewayHost --port $Port --display-name $DisplayName
}
