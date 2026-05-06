ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN NOT NULL DEFAULT FALSE;

-- 프로젝트당 Agent를 1개로 제한하기 위해 중복 Agent를 먼저 정리한다.
-- 삭제 대상 Agent를 참조하는 task는 가장 오래된 Agent(id 최소)로 재매핑한다.
WITH ranked_agents AS (
    SELECT
        id,
        project_id,
        ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY id ASC) AS row_num,
        MIN(id) OVER (PARTITION BY project_id) AS keep_id
    FROM agents
),
duplicate_agents AS (
    SELECT id, keep_id
    FROM ranked_agents
    WHERE row_num > 1
)
UPDATE agent_tasks task
SET agent_id = duplicate_agents.keep_id
FROM duplicate_agents
WHERE task.agent_id = duplicate_agents.id;

WITH ranked_agents AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY id ASC) AS row_num
    FROM agents
)
DELETE FROM agents target
USING ranked_agents ranked
WHERE target.id = ranked.id
  AND ranked.row_num > 1;

ALTER TABLE agents
    ADD CONSTRAINT uk_agents_project_id UNIQUE (project_id);
