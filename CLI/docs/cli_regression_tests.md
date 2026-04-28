# SSAfer CLI 회귀 테스트 기준

## 목적

CLI 기능 변경 후 `scan_result` 생성, Custom Rule, Trivy finding 정규화, report 출력이 기존 동작을 깨뜨리지 않았는지 확인한다.

## 사전 준비

CLI는 `pyproject.toml`의 `dev` optional dependency에 `pytest`를 포함한다.

```powershell
cd CLI
pip install -e ".[dev]"
```

`python -m pytest` 실행 시 `No module named pytest`가 발생하면 테스트 코드 문제가 아니라 현재 Python 환경에 dev 의존성이 설치되지 않은 상태다.

## 전체 회귀 테스트

```powershell
cd CLI
python -m pytest
```

## 최소 문법 검증

pytest를 바로 설치하거나 실행할 수 없는 환경에서는 최소한 아래 문법 검사를 먼저 수행한다.

```powershell
cd CLI
python -m py_compile ssafer\main.py ssafer\core\result_store.py ssafer\rules\engine.py
```

## 기능별 우선 테스트

| 변경 영역 | 우선 실행 테스트 |
| --- | --- |
| scan_result JSON 스키마, findings 정규화 | `python -m pytest tests\test_scan_schema.py` |
| Custom Rule, RuleEngine | `python -m pytest tests\test_rules.py` |
| .env 파싱, BOM/key 정규화 | `python -m pytest tests\test_env_parser.py` |
| 마스킹 패턴, maskedEvidence | `python -m pytest tests\test_masking_patterns.py` |
| report 출력 | `python -m pytest tests\test_report.py` |

## MR 작성 시 기록할 내용

- 실행한 테스트 명령
- pytest 실행 가능 여부
- pytest를 실행하지 못한 경우 대체 검증 명령
- 백엔드/프론트 스키마와 연결되는 필드 변경 여부

