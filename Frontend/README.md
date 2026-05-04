# Frontend

SSAFER 프론트엔드입니다. 현재 `Vite + React + TypeScript + Tailwind CSS v4` 기반으로 구성되어 있고, 인증 UI는 `Storybook`으로 함께 관리합니다.

## Scripts

```bash
npm.cmd run dev
npm.cmd run build
npm.cmd run typecheck
npm.cmd run storybook
npm.cmd run build-storybook
```

## Storybook

Storybook은 공용 인증 UI를 빠르게 확인하고 문서화하기 위한 용도로 사용합니다.

현재 구조:

- `Auth/Base`
  - `AuthButton`
  - `AuthField`
  - `AuthShell`
  - `AuthPanelHeading`
- `Auth/Feedback`
  - `AuthToast`
- `Auth/Flows`
  - `LoginPanel`
  - `SignupEmailPanel`
  - `SignupProfilePanel`

운영 규칙:

- 성공/안내 알림은 `AuthToast`로 표현합니다.
- 실패 메시지는 가능하면 토스트보다 입력 필드 아래 `인라인 에러`를 우선 사용합니다.
- 재사용 가능한 UI는 먼저 Storybook에 상태별 스토리를 추가한 뒤 화면에 연결합니다.
- 새 컴포넌트를 추가할 때는 가능하면 `Base`, `Feedback`, `Flows` 중 하나에 맞춰 분류합니다.

## Notes

- Storybook preview는 `MemoryRouter`로 감싸져 있어서 `react-router-dom` 의존 컴포넌트도 바로 확인할 수 있습니다.
- 상태가 있는 컴포넌트는 Storybook에서 mock props와 local state로 먼저 검증한 뒤 실제 API 연결을 붙이는 방식을 권장합니다.
