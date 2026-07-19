# Hackathon Team Repository

This repository is the single shared location for all project work.

Do not send separate ZIP files or build completely separate versions of the project. Everyone works in this repository using their own branch, and completed work is merged regularly.

## Team roles

We will assign four general owners:

- Integration Lead: manages the repository, reviews merges, and keeps the main branch working.
- Frontend/Product Owner: owns the interface and user experience.
- AI/Backend Owner: owns AI workflows, APIs, agents, and backend logic.
- Data/Evaluation Owner: owns data processing, testing, metrics, and demo validation.

People may help each other, but they must communicate before editing files owned by someone else.

## Main rule

Never work directly on the `main` branch.

The `main` branch should always contain the most stable working version of the project.

## How to start working

Before beginning a task:

1. Tell the team what you are working on.
2. Mention which files or part of the project you expect to change.
3. Pull the latest version of `main`.
4. Create a new branch for your task.

Example branch names:

- `feat-frontend`
- `feat-ai-agent`
- `feat-data`
- `feat-evaluation`
- `fix-upload-error`
- `fix-demo`

## Beginner-friendly GitHub Desktop workflow

Everyone may use GitHub Desktop instead of the command line.

1. Clone this repository using GitHub Desktop.
2. Click “Current Branch.”
3. Select “New Branch.”
4. Give the branch a clear name such as `feat-frontend`.
5. Make your changes.
6. Review the changed files in GitHub Desktop.
7. Write a short commit message.
8. Click “Commit to [branch name].”
9. Click “Push origin.”
10. Open GitHub and create a Pull Request.
11. Ask another teammate to review it.
12. Merge only after confirming it does not break the project.

## Pull Request rules

Every Pull Request should briefly explain:

- What did you build or change?
- Which part of the project did you modify?
- How did you test it?
- Does another teammate need to change anything?
- Are there any known problems?

Keep Pull Requests small. Do not work for the entire hackathon on one giant branch.

Merge completed work regularly so everyone stays close to the same version.

## Before starting a new task

After another Pull Request is merged:

1. Return to the `main` branch.
2. Pull the newest changes.
3. Create a new branch for the next task.

Do not continue building new features on an old merged branch.

## Avoiding conflicts

Before changing a major file, tell the team.

Try not to have two people editing the same file at the same time.

Files such as dependency files, database schemas, shared API formats, environment-variable templates, and deployment settings should normally be handled by the Integration Lead.

If GitHub reports a merge conflict, do not randomly choose “accept current” or “accept incoming.” Ask the person who owns that part of the project and resolve it together.

## AI coding agent rules

Anyone using Codex, Claude Code, Cursor, or another coding agent must tell the agent:

- Work only on the assigned branch.
- Do not push directly to `main`.
- Do not merge Pull Requests.
- Do not delete or rewrite unrelated work.
- Do not change another teammate’s files without permission.
- Do not commit API keys or `.env` files.
- Do not make large unrelated refactors.
- Explain which files were changed.
- Test the change before saying it is complete.

## Secrets

Never place API keys, passwords, tokens, or credentials directly inside project files or GitHub.

Do not commit `.env` files.

The Integration Lead will handle shared deployment secrets.

## Merge process

The normal process is:

1. Pull latest `main`.
2. Create a branch.
3. Complete one small task.
4. Commit and push.
5. Open a Pull Request.
6. Another teammate reviews it.
7. Merge it.
8. Everyone pulls the new `main`.

We will integrate continuously. We will not wait until the end to combine everyone’s work.

## Current status

- Challenge: Not selected
- Product idea: Not selected
- Technology stack: Not selected
- Team roles: Not assigned

## Negotiator Phase 2 voice transport

The text and voice transports share `store.ts` and `tools.ts`. `domain.ts`, `policy.ts`,
and the negotiation playbook remain transport-independent. Runtime state is persisted
with owner-only permissions at `.data/current-run.json`; `GET /runs/current` returns the
same shape for the UI.

### Local setup

1. Copy `.env.example` to `.env` and fill the required values. Generate the tool secret
   locally with `openssl rand -hex 32`. Never commit `.env`, `agents.json`, or tunnel keys.
2. Start the tool server: `npm run server` (default port `3000`).
3. Start a public HTTPS tunnel: `ngrok http 3000` or `cloudflared tunnel --url http://localhost:3000`.
4. Set `PUBLIC_BASE_URL` to the HTTPS tunnel origin and configure an ElevenLabs
   `post_call_transcription` webhook at `PUBLIC_BASE_URL/webhooks/elevenlabs`.
   Put its HMAC secret in `ELEVENLABS_WEBHOOK_SECRET`.
5. Provision or update all four agents: `npm run provision`. IDs are saved locally in
   ignored `agents.json`.

The tool endpoint requires `x-tool-secret`; provisioning stores that value in the
ElevenLabs secrets manager and references the secret ID from every webhook tool.

### Calls

Use two imported Twilio numbers for the agent-to-agent simulation: one outbound number
assigned to the buyer (`ELEVENLABS_PHONE_NUMBER_ID`) and one inbound number assigned to
the selected persona (`PERSONA_PHONE_NUMBER_ID`, with its E.164 number passed as `--to`).

```bash
npm run call -- --persona premium_chain --phase QUOTE_COLLECTION --to +15555550123
npm run call:all -- --to +15555550123
```

With only one number, the runner can reassign it for inbound persona mode, but Twilio
generally cannot place a number-to-itself call; two numbers are the reliable mode.
The server must remain reachable throughout calls so mid-call tools and the signed
post-call transcription webhook can update the shared store.

Failure behavior is closed: tool errors instruct the buyer to follow up instead of
inventing data, invalid/stale webhooks receive `401`, initiation failures become
`DROPPED`, partial line items survive, and unmatched provenance emits
`[RECONCILE_WARN]`.

Update this section after the team makes those decisions.
