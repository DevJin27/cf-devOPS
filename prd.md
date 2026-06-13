# PRD: Cursor for DevOps — AI-Powered Infrastructure Copilot

## Overview

Build an AI copilot that answers infrastructure questions by reasoning over source code, Kubernetes manifests, Terraform, Helm charts, runbooks, and deployment metadata. Every answer must be traceable to real infrastructure definitions — no hallucinated relationships.

**Core principle: Graph First. AI Second.** Most infrastructure questions are graph traversal problems. Vector search augments explanations; it does not replace structured reasoning.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API & Auth | Cloudflare Workers |
| Durable Pipelines | Cloudflare Workflows |
| Semantic Search | Cloudflare Vectorize |
| Entity & Relationship Storage | Cloudflare D1 |
| Raw Snapshots & Artifacts | Cloudflare R2 |

---

## Repository Layout

```
cursor-devops/
├── apps/
│   ├── api-worker/
│   ├── dashboard/
│   └── workflow-runner/
├── packages/
│   ├── parser/
│   ├── graph-builder/
│   ├── embeddings/
│   ├── retrieval/
│   ├── answer-engine/
│   ├── github-ingestion/
│   ├── cloudflare-bindings/
│   └── shared-types/
├── infrastructure/
│   ├── wrangler/
│   ├── migrations/
│   └── workflows/
└── docs/
```

---

## Modules

### Module 1 — Repository Ingestion

Clone Git repositories, extract files, persist snapshots to R2, and emit ingestion events.

**Input**
```ts
{ githubUrl: string }
```

**Output**
```ts
interface RepositorySnapshot {
  repoId: string
  commitSha: string
  files: RepoFile[]
}
```

**Acceptance criteria**
- Handles repositories up to 2 GB
- Incremental re-sync supported
- Commit SHA stored per snapshot

---

### Module 2 — File Classification

Detect and label infrastructure-relevant files.

**Supported types**

| Category | Patterns |
|---|---|
| Kubernetes | `deployment.yaml`, `service.yaml`, `ingress.yaml`, `statefulset.yaml` |
| Terraform | `*.tf`, `*.tfvars` |
| Helm | `Chart.yaml`, `values.yaml` |
| Documentation | `*.md`, `*.adoc` |

**Output**
```ts
interface ClassifiedFile {
  path: string
  type: "terraform" | "k8s" | "helm" | "runbook" | "source"
}
```

**Acceptance criteria:** ≥95% classification accuracy

---

### Module 3 — Infrastructure Parser

Convert infrastructure definitions into structured facts.

**Extracts:** Services, Deployments, Namespaces, Secrets, ConfigMaps, Endpoints, Ingresses, Terraform Resources, Ownership

**Output**
```ts
interface InfraFact {
  sourceFile: string
  entityType: string
  entityName: string
  relation: string
  target: string
}
```

**Example**
```json
{
  "entityType": "service",
  "entityName": "payments",
  "relation": "depends_on",
  "target": "redis"
}
```

**Acceptance criteria:** Parses Kubernetes manifests, Terraform resources, and Helm templates

---

### Module 4 — Graph Builder

Build and persist an infrastructure relationship graph in D1.

**Node types:** Service, Deployment, Namespace, Secret, ConfigMap, Endpoint, Team, Resource

**Relationship types:** `depends_on`, `owns`, `uses_secret`, `exposes_endpoint`, `deployed_to`, `references`

**Acceptance criteria**
- Graph traversal < 100ms
- Relationship lookup < 50ms

---

### Module 5 — Chunking Engine

Produce retrieval-ready chunks from parsed infrastructure files.

**Chunking rules**

| File type | Strategy |
|---|---|
| Terraform | Per resource block |
| Kubernetes | Per manifest |
| Markdown | Per heading section |
| Source code | Per file section |

**Output**
```ts
interface Chunk {
  id: string
  content: string
  metadata: Record<string, string>
}
```

**Acceptance criteria:** Maximum chunk size 1500 tokens

---

### Module 6 — Embedding Pipeline

Generate and store vector embeddings for semantic retrieval.

**Flow:** Chunk → Generate embedding → Attach metadata → Upsert into Vectorize

**Metadata shape**
```json
{
  "repo": "platform",
  "service": "payments",
  "environment": "staging"
}
```

**Acceptance criteria:** 100k chunks indexed within 30 minutes

---

### Module 7 — Vector Index

Provide semantic search over indexed infrastructure knowledge.

**Schema**
```ts
interface VectorRecord {
  id: string
  vector: number[]
  metadata: {
    repo: string
    service: string
    environment: string
    type: string
  }
}
```

**Required features:** Metadata filtering, semantic retrieval, similarity ranking

---

### Module 8 — Query Router

Classify user intent before retrieval.

**Supported intents:** `dependency_lookup`, `secret_lookup`, `outage_analysis`, `ownership_lookup`, `deployment_lookup`, `service_discovery`, `change_analysis`

**Output**
```ts
interface IntentResult {
  intent: string
  confidence: number
}
```

**Acceptance criteria:** ≥90% routing accuracy

---

### Module 9 — Retrieval Engine

Collect and rank evidence for answer generation.

**Pipeline:** Intent Classification → Graph Lookup → Vector Search → Context Ranking → Evidence Selection

**Output**
```ts
interface Evidence {
  content: string
  source: string
  score: number
}
```

**Acceptance criteria:** Top 5 results are relevant to the query

---

### Module 10 — Answer Engine

Generate grounded, source-backed responses.

**Every response must include**

| Field | Description |
|---|---|
| `answer` | Direct response to the question |
| `evidence` | Supporting findings |
| `sources` | Referenced files |
| `confidence` | Numerical confidence score (0–1) |
| `followUp` | Suggested next actions |

**Example**

> **Question:** Why is staging down?
>
> **Answer:** Payments service cannot connect to Redis.
>
> **Evidence:** `deployment.yaml` references a missing `REDIS_URL` secret.
>
> **Source:** `services/payments/deployment.yaml`

**Acceptance criteria:** Every answer includes sources, confidence score, and supporting evidence

---

### Module 11 — Workflow Orchestration

Durable ingestion and indexing pipelines via Cloudflare Workflows.

**Pipeline**
```
Repository Imported
  → Classify Files
  → Parse Infrastructure
  → Build Graph
  → Generate Chunks
  → Generate Embeddings
  → Vectorize Upsert
  → Mark Ready
```

**Requirements:** Retries, checkpointing, resumability, workflow status visibility, error reporting

**Acceptance criteria:** Failed jobs resume automatically without data loss

---

### Module 12 — Security Layer

Prevent infrastructure data leakage.

**Never expose:** Secret values, environment credentials, access tokens

**Allow:** Secret names, secret references, secret locations

**Implement:** RBAC, audit logs, query history, source tracking

**Acceptance criteria:** Zero secret value leakage in any API response

---

## API Contract

### `POST /chat`

**Request**
```json
{
  "question": "Which services talk to Redis?"
}
```

**Response**
```json
{
  "answer": "...",
  "sources": [],
  "confidence": 0.92
}
```

---

## Build Phases

### Phase 1 — Foundation
Cloudflare Worker API, D1 schema, Vectorize setup, GitHub integration

### Phase 2 — Knowledge Graph
Infrastructure parsers, relationship extraction, graph builder

### Phase 3 — Retrieval
Chunking, embeddings, vector search, context ranking

### Phase 4 — Answering
Query router, answer engine, source citations

### Phase 5 — Productionization
Workflows, monitoring, security, dashboard

---

## MVP Scope

**Must have**
- GitHub repository ingestion
- Kubernetes and Terraform parsing
- Infrastructure graph
- Vector search
- Chat interface with source citations

**Nice to have**
- Slack bot
- Incident summaries
- Ownership detection
- MCP server
- Change timeline analysis

**Out of scope**
- Auto-remediation
- Infrastructure writes
- Automatic rollbacks
- Production mutations

---

## Definition of Done

A user connects a repository and asks:

> *Which services talk to Redis?*

The system returns — within **10 seconds** — the correct services, supporting manifests, relevant source files, a confidence score, and source citations. The answer is fully traceable to real infrastructure definitions and contains no hallucinated relationships.
