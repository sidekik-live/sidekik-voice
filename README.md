# sidekik-voice
## Run locally

```bash
cp .env.example .env          # fill in ElevenLabs key + agent IDs; .env is git-ignored
pnpm install
pnpm dev                      # http://localhost:8085/healthz
pnpm test && pnpm typecheck
```

## Endpoints (so far)

- `GET /healthz` → `{ok, version, deps}`
- `POST /internal/token` (header `X-Internal-Token`) → `{conversation_token, agent_id}`.
  Body is `VoiceTokenRequest` from `@sidekik/contracts`. Phase `debrief` uses
  `EL_INTERVIEWER_DEBRIEF_AGENT_ID` (a separate agent with the debrief prompt), because
  ElevenLabs conversation tokens can't carry prompt overrides. 502 if ElevenLabs fails.

## Deploy

Docker image `node:22-slim` (see `Dockerfile`), listens on `::` and `PORT`. Set every
variable from `.env.example` in the host's environment. Public host: `hooks.sidekik.live`.
