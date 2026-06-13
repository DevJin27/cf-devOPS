import type { AnswerResponse, RepositorySnapshot } from "@cursor-devops/shared-types";

export interface CursorDevOpsEnv {
  DB: D1Database;
  SNAPSHOTS: R2Bucket;
  VECTOR_INDEX: VectorizeIndex;
  AI?: Ai;
  INGESTION_WORKFLOW?: Workflow<RepositorySnapshot>;
  ENVIRONMENT?: string;
  GITHUB_TOKEN?: string;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers
    }
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, { status });
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/([?&](?:token|key|secret|password)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/\b([A-Za-z0-9._%+-]+):([^@\s]+)@/g, "$1:[REDACTED]@")
    .replace(/\b(?:ghp|github_pat|glpat|xox[baprs])-?[A-Za-z0-9_:-]{16,}\b/g, "[REDACTED_TOKEN]")
    .replace(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g, "[REDACTED_SECRET]");
}

export const notReadyAnswer: AnswerResponse = {
  answer: "No indexed infrastructure evidence is available yet.",
  evidence: [],
  sources: [],
  confidence: 0,
  followUp: ["Ingest a repository before asking infrastructure questions."]
};
