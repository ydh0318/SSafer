# n8n MR Review Final Workflow

This document records the finalized n8n MR auto-review workflow for `S14P31B105-160`.

## Workflow

Production flow:

```text
Webhook
-> IF
-> Build MR Context
-> Get MR Changes
-> Build Review Summary
-> Build AI Review Prompt
-> Build LLM Request Body
-> Call Review LLM
-> Build GitLab Review Comment
-> Post MR Review Comment
```

The previous intermediate `[TEST]` comment node must be removed or disconnected.
Otherwise the workflow posts both the test summary comment and the final AI review comment.

## GitLab Webhook

Production URL:

```text
https://<LEGACY_DEPLOY_DOMAIN>/n8n/webhook/gitlab-mr-review
```

Trigger:

```text
Merge request events
```

Security:

```text
X-Gitlab-Token == GitLab Webhook Secret token
```

The secret token is generated manually, for example:

```bash
openssl rand -hex 32
```

Do not commit the secret.

## Model

Default automatic review model:

```text
gpt-4o-mini
```

Reason:

- `gpt-5-mini` consumed the whole `max_completion_tokens` budget as reasoning tokens and returned an empty `choices[0].message.content`.
- `gpt-5.2` produced better reasoning, but the credit cost was too high for every MR.
- `gpt-4o-mini` is cheaper and stable enough for first-pass MR review.

Use stronger models only for important manual review runs.

## GMS OpenAI Call

GMS endpoint:

```text
POST https://gms.ssafy.io/gmsapi/api.openai.com/v1/chat/completions
```

The GMS key must be stored in an n8n Header Auth credential, not in workflow JSON or repository files.

Credential:

```text
Header name: Authorization
Header value: Bearer <GMS_KEY>
```

The key exposed during testing was revoked and must not be reused.

## LLM Request Body

Build the request body in a Code node, then pass it to the HTTP Request node as `llm_body`.
This avoids n8n JSON Body expression parsing issues such as `=[object Object]`, invalid JSON, or literal expression strings.

Recommended body shape:

```javascript
return [{
  json: {
    ...$json,
    llm_body: {
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        {
          role: 'developer',
          content: 'You are a thoughtful senior engineer writing a natural Korean GitLab MR review comment. Be concrete, collaborative, and grounded in the diff. Avoid generic checklists and robotic report formatting.',
        },
        {
          role: 'user',
          content: $json.review_prompt,
        },
      ],
    },
  },
}];
```

The HTTP Request node should use JSON Body expression:

```text
{{ $json.llm_body }}
```

## Diff Budget

Filter or trim low-value inputs before calling the LLM:

- skip binary, media, font, archive, and document files
- skip generated/build output directories such as `node_modules/`, `dist/`, `build/`, `.gradle/`, `.next/`, `coverage/`
- omit large lockfile diffs and only mention that the lockfile changed
- skip pure delete and pure rename changes
- trim each file diff
- enforce a total diff character budget
- cap the number of reviewed files

`Build Review Summary` must output `files`.
`Build AI Review Prompt` must read `files`.

If the model says there is no diff, check this field handoff first.

## Prompt Style

The final prompt should produce a natural GitLab MR comment, not a report.

Keep these principles:

- infer the author's intent from the diff first
- use a collaborative Korean senior-reviewer tone
- start directly with a natural greeting
- allow at most one light emoji in the opening or closing sentence
- avoid report titles and markdown headings
- avoid scanner-like words such as `탐지`, `검출`, `위반`, `심각도`
- make only comments supported by the provided diff
- ask a concrete question when intent is unclear
- mention 1-3 high-signal risks or verification points
- do not ask the author to provide more diff
- do not repeat the MR description

The GitLab comment footer such as `_자동 리뷰 · MR !... · time_` is removed.
The final comment body should be only the model's review text.

## Troubleshooting

If `choices[0].message.content` is empty and `finish_reason` is `length`, the model likely spent the output token budget on reasoning tokens.
Use a cheaper non-reasoning model such as `gpt-4o-mini`, or increase the output budget for a stronger manual run.

If `prompt_tokens` is extremely low, the review prompt or diff did not reach the LLM.
Check field names between `Build Review Summary`, `Build AI Review Prompt`, and `Build LLM Request Body`.

Do not run `Call Review LLM` in isolation unless a valid `review_prompt` input is pinned or provided.

## Recovery Template

The sanitized workflow template is stored at:

```text
Infra/n8n/workflows/gitlab-mr-review-orchestrator.template.json
```

Import and secret handling details are documented in:

```text
Infra/docs/n8n-workflow-export.md
```

The template intentionally uses placeholder credential IDs and must be reconnected to real n8n credentials after import.
