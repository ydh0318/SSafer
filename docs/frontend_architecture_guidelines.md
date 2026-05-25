# Frontend Architecture Guidelines

## 목적

이 문서는 SSAfer 프론트엔드에서 컴포넌트, 상태, API, 화면 구조를 일관되게 설계하기 위한 팀 기준입니다.

핵심 목표는 아래와 같습니다.

- 페이지가 비대해지지 않도록 책임을 분리한다.
- 재사용 가능한 컴포넌트와 훅을 우선 설계한다.
- 화면 구현 속도보다 유지보수성과 확장성을 우선한다.
- 팀원이 바뀌어도 비슷한 방식으로 코드를 읽고 수정할 수 있게 한다.

---

## 기본 원칙

### 1. `pages`는 조합, `features`는 동작

- `pages`는 화면 조합, 라우트 진입, 상위 레이아웃 연결에 집중한다.
- 실제 도메인 동작은 `features/<domain>` 아래에서 처리한다.
- 페이지 파일에서 API 호출, 상태 가공, 삭제/생성/갱신 흐름까지 모두 처리하지 않는다.

좋은 예시:

- `ProjectListPage`는 목록 UI와 이동 처리만 담당
- `useProjectOverviewData`는 프로젝트 목록 조회와 상태 조합 담당

피해야 할 예시:

- 페이지 안에서 여러 API를 직접 호출
- 페이지 안에서 `loading / error / data / filter / delete / compare`를 모두 관리

### 2. 컴포넌트는 표현과 상호작용 중심

- 컴포넌트는 가능한 한 “무엇을 보여줄지”에 집중한다.
- 도메인 데이터 조회나 복잡한 파생 계산은 훅으로 분리한다.
- props가 지나치게 많아지면 데이터 구조 또는 책임 분리를 다시 검토한다.

권장 기준:

- 단순 UI: `components/common`
- 도메인 UI: `features/<domain>/components`
- 데이터/상태 흐름: `features/<domain>/hooks`
- 표현 유틸: `features/<domain>/utils`

### 3. 파생 상태는 계산하고, 원본 상태만 저장한다

- 화면에서 계산 가능한 값은 `useMemo` 또는 일반 계산으로 처리한다.
- effect 안에서 파생 상태를 다시 `setState`하는 패턴은 최소화한다.
- `selected`, `filtered`, `grouped`, `summary` 같은 값은 원본 데이터로부터 계산 가능한지 먼저 본다.

좋은 예시:

- `const filteredItems = useMemo(() => ..., [items, filter])`

피해야 할 예시:

- `useEffect(() => setFilteredItems(...), [items, filter])`

### 4. effect는 외부 시스템 동기화에만 사용한다

`useEffect`는 아래 용도에 우선 사용한다.

- API 요청 시작
- 타이머 구독/해제
- SSE, WebSocket, 이벤트 리스너 연결
- 브라우저 API 동기화

아래 용도는 되도록 피한다.

- 단순 값 계산
- props를 다른 state로 복사
- 렌더 직후 즉시 `setState`

### 5. 중복 로직은 페이지가 아니라 훅에서 제거한다

반복되는 패턴이 보이면 아래 순서로 분리한다.

1. 조회 로직 분리
2. 액션 로직 분리
3. 파생 데이터 계산 분리
4. 공통 메시지/포맷 유틸 분리

예시:

- `useHistoryData`
- `useHistoryCompare`
- `useScanStatusDetail`
- `useTypingGameSession`

---

## 폴더 구조 기준

### 권장 구조

```text
src/
  app/
  api/
  components/
    common/
  constants/
  features/
    auth/
      api/
      components/
      hooks/
      utils/
    projects/
    results/
    scans/
  pages/
  store/
  types/
  utils/
```

### 배치 원칙

- 여러 도메인에서 재사용되는 UI만 `components/common`으로 올린다.
- 특정 도메인에서만 쓰는 UI는 `features/<domain>/components`에 둔다.
- API 함수는 도메인별 `features/<domain>/api`에 둔다.
- 전역 공통 API 보조 함수는 `src/api`에 둔다.
- 도메인 타입은 가능하면 `src/types` 기준으로 통일한다.

---

## 컴포넌트 설계 규칙

### 공통 컴포넌트

공통 컴포넌트는 아래 조건을 만족할 때만 만든다.

- 서로 다른 화면에서 2회 이상 반복된다.
- 이름이 도메인에 묶이지 않는다.
- props 설계가 지나치게 복잡해지지 않는다.

공통화하지 말아야 할 경우:

- 겉으로만 비슷하고 실제 동작 맥락이 다른 경우
- 분기 props가 너무 많아지는 경우
- 재사용보다 읽기 어려움이 커지는 경우

### 도메인 컴포넌트

- 도메인 의미가 이름에 드러나야 한다.
- 페이지 전용 UI라도 page 내부에 두기보다 feature 아래 분리하는 편이 낫다.
- 단, 아주 짧고 재사용 계획이 없는 경우는 page 내부 유지도 가능하다.

예시:

- `ProjectDetailHero`
- `ProjectScanTimeline`
- `ScanProgressPanel`

### props 설계

- `string | null | undefined` 혼용을 줄인다.
- 이벤트는 `onSomething` 이름으로 통일한다.
- boolean props는 의미가 분명해야 한다.
- 하나의 객체로 묶는 편이 더 자연스러우면 분해하지 않는다.

나쁜 예시:

- `isOpen`, `show`, `visible`가 같은 의미로 혼재
- `data1`, `data2`, `extraInfo`처럼 의미가 불분명한 props

---

## 훅 설계 규칙

### 커스텀 훅은 아래 중 하나를 해결해야 한다

- 도메인 데이터 조회
- 사용자 액션 흐름 처리
- 복잡한 상태 전이 관리
- 외부 시스템 구독 처리
- 파생 계산 캡슐화

### 훅 반환 형태 기준

권장:

- `data`
- `isLoading`
- `error`
- `actions`
- `derived values`

예시:

```ts
const {
  projects,
  totalCount,
  isLoading,
  errorMessage,
  refresh,
} = useProjectOverviewData();
```

### 훅 분리 기준

아래 중 2개 이상 해당하면 분리를 검토한다.

- 같은 파일 안에서 effect가 2개 이상 반복된다.
- 같은 API 흐름이 초기 로드와 새로고침에 중복된다.
- 페이지 길이가 300줄 이상으로 커진다.
- 같은 도메인 데이터를 여러 화면에서 쓴다.

---

## API 계층 규칙

### API 함수는 최대한 얇게 유지한다

- 요청 URL
- params/body 구성
- 응답 `data` 추출
- 에러 래핑

여기까지만 맡고, 화면별 가공은 훅 또는 util에서 처리한다.

### 에러 처리 기준

- 사용자 메시지는 일관된 한국어 문구를 사용한다.
- `createApiError` 같은 공통 래퍼를 사용해 원본 cause를 보존한다.
- 특수 케이스 분기만 API 파일에서 처리한다.

예시:

- `AGENT_NOT_FOUND`
- `FORBIDDEN`
- `SCAN_STATUS_CONFLICT`

### API 파일이 과도하게 커지면

- 요청 성격별 파일 분리
- upload / detail / compare / status 등으로 세분화 검토

---

## 상태 관리 기준

### 로컬 state

아래는 컴포넌트 또는 훅 내부 state로 둔다.

- input 값
- 탭 상태
- 모달 열림/닫힘
- 일시적인 UI 토글

### 전역 state

아래만 전역 store에 둔다.

- 로그인 사용자
- access/refresh token
- 앱 전역에서 공유되는 세션 정보

원칙:

- 전역 store를 “편해서 쓰는 상태 저장소”로 사용하지 않는다.
- 특정 페이지에서만 필요한 데이터는 store에 올리지 않는다.

---

## UI와 문구 기준

### UI 일관성

- 버튼 variant, 패널 여백, 상태 배지 스타일은 가능한 한 통일한다.
- 비슷한 역할의 섹션 헤더는 패턴을 맞춘다.
- loading, empty, error 상태의 표현도 화면마다 크게 달라지지 않게 한다.

### 사용자 문구

- 화면 문구는 한국어 기준으로 통일한다.
- 동일한 의미의 메시지는 같은 표현을 사용한다.
- 추후 i18n 가능성을 고려해 하드코딩 문구를 과도하게 흩뿌리지 않는다.

권장 예시:

- “불러오는 중입니다.”
- “다시 시도해 주세요.”
- “권한이 없습니다.”

---

## 코드 리뷰 시 보는 기준

### 구조

- 페이지가 너무 많은 책임을 가지지 않는가
- API 호출이 컴포넌트 깊숙이 박혀 있지 않은가
- 도메인 훅으로 분리할 수 있는가

### 재사용성

- 공통화가 필요한 반복 UI가 있는가
- 반대로 공통화가 과한 컴포넌트는 아닌가
- props가 이해하기 쉬운가

### 상태

- 파생 상태를 굳이 state로 저장하고 있지 않은가
- effect가 계산용으로 남용되지 않았는가
- 비동기 흐름이 중복되지 않는가

### 사용자 경험

- 로딩, 실패, 빈 상태가 모두 처리되어 있는가
- 버튼 중복 클릭, 중복 요청을 막고 있는가
- 토스트/오류 문구가 일관적인가

---

## 현재 프로젝트 기준 총평

현재 SSAfer 프론트엔드는 핵심 화면 기준으로 아래 구조가 잘 잡혀 있습니다.

- `page -> feature hook -> feature component`
- 도메인별 `features` 분리
- lint/typecheck 통과 가능한 품질 상태

즉, 구조적으로는 “리팩토링이 꼭 필요한 위험 상태”는 벗어났습니다.

다음 고도화 우선순위는 아래입니다.

1. 공통 메시지 체계 정리
2. 공통 UI variant 기준 정리
3. 훅/컴포넌트 테스트 보강
4. 장기적으로 서버 상태 관리 전략 검토

---

## 한 줄 기준

새 화면을 만들 때는 아래 질문에 모두 “예”가 나와야 합니다.

- 페이지는 화면 조합만 하고 있는가
- 도메인 로직은 훅으로 분리됐는가
- 컴포넌트는 재사용 가능하거나, 최소한 책임이 명확한가
- 파생 상태를 불필요하게 저장하지 않았는가
- 로딩/에러/빈 상태까지 구현했는가

