# Ollama 설치 및 실행 가이드

이 문서는 Ollama가 전혀 설치되어 있지 않은 컴퓨터에서 시작해 `qwen2.5:3b` 모델 설치와 실행 확인까지 완료하는 방법을 정리한 가이드입니다.

우리 AI 서버는 이후 LangChain을 통해 로컬 Ollama 모델을 호출할 예정입니다.

## 1. Ollama란?

Ollama는 LLM을 로컬 컴퓨터에서 실행할 수 있게 해주는 도구입니다.

이 프로젝트에서는 아래 모델을 기준으로 진행합니다.

```text
qwen2.5:3b
```

## 2. Ollama CLI 설치

먼저 사용하는 운영체제에 맞게 Ollama를 설치합니다.

### Linux 또는 WSL

Linux, Ubuntu, WSL 환경에서는 아래 명령어를 실행합니다.

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows

1. 브라우저에서 공식 다운로드 페이지로 이동합니다.

```text
https://ollama.com/download
```

2. Windows 설치 파일을 다운로드합니다.
3. 다운로드한 설치 파일을 실행합니다.
4. 설치가 끝난 뒤 새 터미널을 엽니다.

### macOS

1. 브라우저에서 공식 다운로드 페이지로 이동합니다.

```text
https://ollama.com/download
```

2. macOS용 Ollama를 다운로드합니다.
3. 다운로드한 앱을 `Applications` 폴더로 이동합니다.
4. Ollama 앱을 한 번 실행합니다.
5. 터미널을 엽니다.

## 3. 설치 확인

설치가 끝나면 새 터미널에서 아래 명령어를 실행합니다.

```bash
ollama --version
```

아래처럼 버전이 출력되면 설치가 완료된 것입니다.

```text
ollama version is 0.21.0
```

만약 아래와 비슷한 메시지가 나오면 Ollama가 설치되지 않았거나 PATH에 등록되지 않은 상태입니다.

```text
ollama: command not found
```

이 경우 운영체제에 맞는 설치 단계를 다시 진행한 뒤 터미널을 새로 열고 확인합니다.

## 4. Ollama 서버 실행

Ollama 모델을 사용하려면 Ollama 서버가 실행 중이어야 합니다.

터미널 하나를 열고 아래 명령어를 실행합니다.

```bash
ollama serve
```

정상 실행되면 Ollama 서버가 아래 주소에서 실행됩니다.

```text
http://127.0.0.1:11434
```

이 터미널은 서버 실행용입니다. 개발 중에는 닫지 말고 그대로 둡니다.

## 5. 모델 설치

새 터미널을 하나 더 열고, 설치된 모델 목록을 확인합니다.

```bash
ollama list
```

`qwen2.5:3b`가 없다면 아래 명령어로 모델을 설치합니다.

```bash
ollama pull qwen2.5:3b
```

모델 다운로드는 네트워크와 컴퓨터 성능에 따라 시간이 걸릴 수 있습니다.

설치가 끝나면 다시 확인합니다.

```bash
ollama list
```

아래처럼 보이면 모델 설치가 완료된 것입니다.

```text
NAME           ID              SIZE      MODIFIED
qwen2.5:3b     ...             ...       ...
```

## 6. 모델 실행 확인

아래 명령어로 모델이 실제 응답하는지 확인합니다.

```bash
ollama run qwen2.5:3b "Say OK"
```

정상이라면 아래처럼 응답합니다.

```text
OK
```

처음 실행할 때는 모델을 메모리에 올리기 때문에 몇 초 이상 걸릴 수 있습니다.

## 7. 실행 중인 모델 확인

현재 로드된 모델은 아래 명령어로 확인합니다.

```bash
ollama ps
```

모델이 실행 중이면 `qwen2.5:3b`가 표시됩니다.

예시:

```text
NAME           ID              SIZE      PROCESSOR    CONTEXT    UNTIL
qwen2.5:3b     ...             ...       ...          ...        ...
```

## 8. 매번 개발할 때 실행 순서

개발을 시작할 때는 보통 아래 순서로 진행합니다.

첫 번째 터미널:

```bash
ollama serve
```

두 번째 터미널:

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
uvicorn app.main:app --reload
```

모델 동작 확인이 필요할 때:

```bash
ollama run qwen2.5:3b "Say OK"
```

## 9. 자주 발생하는 문제

### `ollama: command not found`

Ollama가 설치되지 않았거나 PATH에 등록되지 않은 상태입니다.

Linux 또는 WSL에서는 다시 설치합니다.

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

설치 후 터미널을 새로 열고 다시 확인합니다.

```bash
ollama --version
```

### `could not connect to ollama server`

Ollama 서버가 실행 중이 아닙니다.

다른 터미널에서 아래 명령어를 실행합니다.

```bash
ollama serve
```

그 다음 다시 시도합니다.

```bash
ollama list
```

### `model not found`

모델이 아직 설치되지 않은 상태입니다.

```bash
ollama pull qwen2.5:3b
```

설치 후 다시 실행합니다.

```bash
ollama run qwen2.5:3b "Say OK"
```

## 10. 공식 문서

자세한 내용은 Ollama 공식 문서를 참고합니다.

```text
https://docs.ollama.com/
https://ollama.com/download
```
