# magggy

## VS Code에서 Claude Code 실행하기

이 저장소는 VS Code에서 [Claude Code](https://code.claude.com/docs)를 바로 사용할 수 있도록 설정되어 있습니다.

### 1. 확장 프로그램 설치

이 폴더를 VS Code로 열면 `.vscode/extensions.json`에 등록된 **Claude Code** 확장(`anthropic.claude-code`) 설치를 자동으로 제안합니다. 알림이 뜨면 **설치(Install)**를 눌러주세요.

수동 설치가 필요하다면:

1. VS Code 왼쪽 사이드바에서 확장(Extensions) 아이콘 클릭
2. `Claude Code` 검색 후 설치

### 2. Claude Code CLI 설치 (터미널에서 실행할 경우)

```bash
npm install -g @anthropic-ai/claude-code
```

### 3. 로그인 및 실행

- 확장 프로그램 사용 시: VS Code 사이드바의 Claude 아이콘을 클릭하거나 명령 팔레트(`Cmd/Ctrl+Shift+P`)에서 `Claude Code: Start` 실행
- 터미널 사용 시: 통합 터미널(`` Ctrl+` ``)을 열고 아래 명령 실행

```bash
claude
```

최초 실행 시 Anthropic 계정으로 로그인하는 절차가 안내됩니다.

### 참고

- 공식 문서: https://code.claude.com/docs/en/claude-code-on-the-web
