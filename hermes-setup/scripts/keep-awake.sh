#!/bin/zsh
# 6단계: 맥미니가 잠자기에 들어가지 않게 설정
# 실행: sudo zsh keep-awake.sh   (맥 비밀번호를 물어요)
#
# 하는 일
#  - 컴퓨터 잠자기 끔 (sleep 0)
#  - 디스크 잠자기 끔 (disksleep 0)
#  - 화면만 10분 뒤 꺼짐 (displaysleep 10)  ← 화면은 꺼져도 봇은 계속 돌아요
#  - 정전 뒤 전기가 들어오면 자동으로 켜짐 (autorestart 1)
#  - 네트워크로 깨우기 켬 (womp 1)
#  - 맥이 먹통이 되면 자동 재시작 (restartfreeze 1)
#
# 되돌리기: sudo pmset restoredefaults

if [[ $EUID -ne 0 ]]; then
  echo "sudo 를 붙여서 실행해 주세요:  sudo zsh keep-awake.sh"
  exit 1
fi

echo "변경 전 설정:"
pmset -g | egrep " sleep| disksleep| displaysleep| autorestart| womp"
echo

pmset -a sleep 0
pmset -a disksleep 0
pmset -a displaysleep 10
pmset -a autorestart 1
pmset -a womp 1
pmset -a restartfreeze 1 2>/dev/null

echo "변경 후 설정:"
pmset -g | egrep " sleep| disksleep| displaysleep| autorestart| womp"
echo
echo "확인: 위에 'sleep 0' 이 보이면 성공이에요."
echo "(System Settings > Energy 화면에서도 '디스플레이가 꺼져 있을 때 자동으로 잠자기 방지'가 켜져 있는지 봐 주세요.)"
