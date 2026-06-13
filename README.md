# Cursor DevOps

Graph-first infrastructure copilot for Cloudflare Workers, D1, R2, Vectorize, Workers AI, and Workflows.

## What is implemented

- Worker API with `POST /ingest`, `POST /chat`, `GET /health`, and `GET /status`.
- GitHub repository ingestion through the GitHub API.
- R2 snapshot persistence.
- D1 schema for repositories, files, graph nodes, graph edges, chunks, query history, and audit logs.
- Kubernetes and Terraform parsing into source-backed facts.
- D1 graph persistence and graph-first dependency answers.
- Chunking plus optional Workers AI embeddings and Vectorize upserts.
- Secret/token redaction before text evidence is returned from the API.

## Local setup

```bash
npm install
npm run check
npm test
npm run db:migrate:local
npm run dev:api
```

Create Cloudflare resources before remote deploy:

```bash
npx wrangler d1 create cursor_devops
npx wrangler r2 bucket create cursor-devops-snapshots
npx wrangler vectorize create cursor-devops --dimensions=768 --metric=cosine
npx wrangler vectorize create-metadata-index cursor-devops --property-name=repo --type=string
npx wrangler vectorize create-metadata-index cursor-devops --property-name=type --type=string
```

Replace `database_id` in `apps/api-worker/wrangler.jsonc` with the D1 database ID returned by Cloudflare.

## API

```bash
curl -X POST http://localhost:8787/ingest \
  -H 'content-type: application/json' \
  -d '{"githubUrl":"https://github.com/owner/repo"}'

curl -X POST http://localhost:8787/chat \
  -H 'content-type: application/json' \
  -d '{"question":"Which services talk to Redis?"}'
```

For private repositories, set `GITHUB_TOKEN` as a Worker secret.
