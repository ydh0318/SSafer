-- 회원 프로젝트는 user_id 범위 안에서 정규화된 이름이 유일해야 한다.
CREATE UNIQUE INDEX uk_projects_member_normalized_name
    ON projects (user_id, lower(regexp_replace(trim(name), '[[:space:]]+', ' ', 'g')))
    WHERE deleted_at IS NULL
      AND user_id IS NOT NULL;

-- 게스트 프로젝트도 guest_owner_key_hash 범위 안에서 정규화된 이름이 유일해야 한다.
CREATE UNIQUE INDEX uk_projects_guest_normalized_name
    ON projects (guest_owner_key_hash, lower(regexp_replace(trim(name), '[[:space:]]+', ' ', 'g')))
    WHERE deleted_at IS NULL
      AND guest_owner_key_hash IS NOT NULL;
