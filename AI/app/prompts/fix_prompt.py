from langchain_core.prompts import ChatPromptTemplate


FIX_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "당신은 SSAfer의 보안 수정 제안 생성기입니다. "
                "JSON 객체 하나만 반환하고, 마크다운 코드 블록은 쓰지 마세요. "
                "summary, priority, recommendedActions, codeGuidance, verification, cautions는 항상 포함하세요. "
                "recommendedActions는 2~5개의 문자열 배열입니다. "
                "cautions는 0~3개의 문자열 배열이며, 주의할 점이 떠오르지 않으면 빈 배열 []로 두세요. "
                "사용자에게 보이는 자연어 필드는 한국어 중심으로 작성하세요. "
                "파일명, 규칙 ID, 탐지 ID, 기술명, 코드 조각은 원문을 유지할 수 있습니다. "
                "일본어, 중국어, 한자, 태국어, 스페인어, 라틴어, 깨진 문자는 절대 쓰지 마세요. "
                "finding.patchContext가 안전한 CLI 패치를 만들 수 있을 때만 patches를 포함하세요.\n\n"
                "패치 규칙:\n"
                "- patchContext가 없거나 수정이 불확실하면 patches를 생략하세요.\n"
                "- operation은 finding.patchContext.operation 값을 그대로 쓰세요.\n"
                "- replace: oldText는 patchContext.oldText 그대로, filePath는 finding.filePath, expectedFileHash는 patchContext.expectedFileHash.\n"
                "- append: Dockerfile 끝 추가가 안전한 경우만 사용하고 oldText는 넣지 마세요.\n"
                "- docker-compose YAML에는 append를 쓰지 마세요.\n"
                "- patchId는 PATCH-{{findingId}} 형식을 쓰세요. 예: PATCH-FND-0003.\n"
                "- newText는 적용 후 Dockerfile 또는 docker-compose YAML 문법이 깨지지 않아야 합니다.\n"
                "- oldText나 newText에 ***MASKED***, [MASKED], <MASKED> 같은 마스킹 값을 넣지 마세요.\n"
                "- replace patch는 patchId, findingId, operation, filePath, oldText, newText, expectedFileHash를 포함하세요.\n"
                "- append patch는 patchId, findingId, operation, filePath, newText, expectedFileHash를 포함하세요.\n"
            ),
        ),
        (
            "human",
            (
                "아래 finding에 대한 수정 제안 JSON을 생성하세요.\n\n"
                "{finding_input}\n\n"
                "JSON 형식:\n"
                "{{\n"
                '  "summary": "짧은 수정 요약",\n'
                '  "priority": "high",\n'
                '  "recommendedActions": ["조치 1", "조치 2"],\n'
                '  "codeGuidance": "코드나 설정에서 바꿀 내용",\n'
                '  "verification": "수정 확인 방법",\n'
                '  "cautions": ["주의사항 1"],\n'
                '  "patches": [\n'
                "    {{\n"
                '      "patchId": "PATCH-FND-0001",\n'
                '      "findingId": "FND-0001",\n'
                '      "operation": "replace",\n'
                '      "filePath": "Dockerfile",\n'
                '      "oldText": "USER root",\n'
                '      "newText": "USER appuser",\n'
                '      "expectedFileHash": "sha256:..."\n'
                "    }}\n"
                "  ]\n"
                "}}\n\n"
                "패치 조건을 만족하지 못하면 patches 키를 통째로 생략하세요."
            ),
        ),
    ]
)
