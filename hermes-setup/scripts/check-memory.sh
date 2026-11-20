#!/bin/zsh
# 헤르메스가 메모리를 얼마나 쓰는지 확인 (읽기만 함)
# 실행: zsh check-memory.sh

echo "=== 헤르메스 관련 프로세스 ==="
# hermes 명령으로 시작된 프로세스(사장봇, 직원봇 게이트웨이 포함)
ps -axo pid,rss,etime,command | grep -i "[h]ermes" | grep -v check-memory \
  | awk '{ printf "PID %-7s  %6.0f MB  실행시간 %-12s ", $1, $2/1024, $3; $1=$2=$3=""; print substr($0,4) }'

total_kb=$(ps -axo rss,command | grep -i "[h]ermes" | grep -v check-memory | awk '{s+=$1} END {print s+0}')
echo
echo "=== 합계 ==="
echo "헤르메스 전체: 약 $(( total_kb / 1024 )) MB  (16GB = 16384 MB 중)"
echo
echo "=== 맥 전체 메모리 상태 ==="
memory_pressure | tail -1
echo
echo "참고: 보통 봇 하나당 수백 MB 정도면 정상이에요. 1~2GB를 넘으면 알려 주세요."
