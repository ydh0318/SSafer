# n8n Workflow Export and Secret Separation

Task: `S14P31B105-273`

## Goal

The production n8n workflow is stored in the n8n PostgreSQL database.
To make the workflow recoverable after server or volume failure, keep a sanitized workflow template in the repository.

The repository must never contain real tokens or API keys.

## Repository Template

Sanitized template path:

```text
Infra/n8n/workflows/gitlab-mr-review-orchestrator.template.json
```

This template documents the production node layout:

```text
Webhook
-> Build Event Gate
-> Should Review?
-> Build MR Context
-> Get MR Changes
-> Build Review Summary
-> Build AI Review Prompt
-> Build LLM Request Body
-> Call Review LLM
-> Build GitLab Review Comment
-> Post MR Review Comment
```

The template is not expected to run immediately after import.
After import, select the real n8n credentials and configure the GitLab Webhook Secret safely.

## Secrets

Do not commit these values:

- GitLab Webhook Secret token
- GitLab Personal Access Token
- GMS key
- Jira token
- any n8n credential export containing secret material

Credentials should stay in n8n:

| Credential | Purpose |
| --- | --- |
| `GitLab account` | MR metadata/diff lookup and MR comment creation |
| `GMS OpenAI Header` | GMS OpenAI API call with `Authorization: Bearer <GMS_KEY>` |

`GMS OpenAI Header` must be a Header Auth credential:

```text
Header name: Authorization
Header value: Bearer <GMS_KEY>
```

## GitLab Webhook Secret

Current hotfix verifies the GitLab Webhook Secret in `Build Event Gate`.

Before exporting a production workflow, ensure the real secret is not present in the exported JSON.
Use one of these approaches:

1. Replace the real value with `<SET_FROM_CREDENTIAL_OR_ENV>` before committing.
2. Move secret validation to a credential/env-backed mechanism.
3. Use a separate sanitized template rather than committing the raw production export.

The current repository file uses a placeholder and must not be replaced with the real secret.

## Export Procedure

1. Open n8n.
2. Open `GitLab MR Review Orchestrator`.
3. Export the workflow JSON.
4. Save a temporary local copy outside the repository.
5. Inspect the JSON for secret-like values:

```text
Bearer
S14P
GMS
token
secret
x-gitlab-token
PRIVATE-TOKEN
Authorization
```

6. Remove or replace any real secret.
7. Compare the production export with the repository template.
8. Update the template only with safe structural changes.

## Import Procedure

1. Import `Infra/n8n/workflows/gitlab-mr-review-orchestrator.template.json`.
2. Re-select the real `GitLab account` credential on:
   - `Get MR Changes`
   - `Post MR Review Comment`
3. Re-select the real `GMS OpenAI Header` credential on:
   - `Call Review LLM`
4. Configure GitLab Webhook Secret validation without committing the real secret.
5. Publish the workflow.
6. In GitLab, configure the Webhook URL:

```text
https://<LEGACY_DEPLOY_DOMAIN>/n8n/webhook/gitlab-mr-review
```

7. Trigger `Merge request events` test.

## Validation

Successful validation:

- MR open/reopen/code update triggers review.
- Approve/label/title-only changes are skipped by `Build Event Gate`.
- `Call Review LLM` receives a non-empty `review_prompt`.
- `choices[0].message.content` is non-empty.
- Exactly one final review comment is posted to the MR.
- No real secret exists in repository files.

## Backup Notes

The workflow template is not a replacement for operational backups.
Keep PostgreSQL `n8n` DB and n8n data volume backup strategy under review.

At minimum, back up:

- PostgreSQL data volume used by `ssafer-postgres`
- n8n workflow export template
- `N8N_ENCRYPTION_KEY`

If `N8N_ENCRYPTION_KEY` is lost or changed, existing encrypted credentials cannot be decrypted.
