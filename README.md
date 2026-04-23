# SSafer - 설명형 보안 코파일럿

> 당신의 코드가 세상에 안전하게 닿도록, SSafer

배포 전 보안 설정을 자동 점검하고, 위험 원인과 해결 방법을 설명하며, 승인 기반으로 실제 수정까지 연결하는 보안 자동화 코파일럿

---

## 프로젝트 구조

```
S14P31B105/
├── AI/          # LLM 어댑터, 보안 분석 AI 모듈
├── Backend/     # FastAPI 기반 REST API 서버
├── Frontend/    # React + TypeScript 대시보드
├── Infra/       # Docker, EC2, 배포 설정
└── docs/        # 기획서, 와이어프레임 등 문서
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React, TypeScript |
| Backend | FastAPI, PostgreSQL |
| AI | LLM Adapter, Trivy |
| Infra | EC2, Docker, Nginx |

## 주요 기능

- EC2 + Docker 환경 보안 점검 (포트, 이미지, 설정, Secret)
- Trivy 기반 취약점 분석
- AI 기반 위험 원인 및 해결 방법 자연어 설명
- 수정 제안 및 승인 기반 자동 적용
- 보안 상태 이력 관리 및 대시보드 시각화
