#!/bin/zsh
# 맥미니 기본 상태 확인 (읽기만 함 — 아무것도 바꾸지 않음)
# 실행: zsh check-mac.sh

echo "=== 칩 ==="
sysctl -n machdep.cpu.brand_string
echo
echo "=== macOS 버전 ==="
sw_vers -productVersion
echo
echo "=== 메모리(RAM) ==="
echo "$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 )) GB"
echo
echo "=== 남은 디스크 공간 ==="
df -h / | tail -1 | awk '{print $4 " 남음"}'
echo
echo "=== 현재 메모리 압박 수준 (낮을수록 좋음) ==="
memory_pressure | tail -1
echo
echo "=== FileVault(디스크 암호화) 상태 ==="
fdesetup status
echo
echo "=== Docker 실행 여부 (실행 중이면 메모리를 많이 먹어요) ==="
if pgrep -qx "com.docker.backend" || pgrep -qf "Docker Desktop"; then
  echo "Docker 실행 중"
else
  echo "Docker 꺼져 있음 (좋음)"
fi
echo
echo "=== Ollama 실행 여부 (이번 설치에서는 쓰지 않아요) ==="
if pgrep -qx ollama; then echo "Ollama 실행 중"; else echo "Ollama 꺼져 있음 (좋음)"; fi
