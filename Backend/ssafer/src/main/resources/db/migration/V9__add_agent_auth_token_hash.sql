ALTER TABLE agents
    ADD COLUMN auth_token_hash VARCHAR(64);

CREATE UNIQUE INDEX uq_agents_auth_token_hash
    ON agents (auth_token_hash);

