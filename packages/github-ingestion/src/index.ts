import type { CursorDevOpsEnv } from "@cursor-devops/cloudflare-bindings";

export interface IngestRepositoryInput {
  githubUrl: string;
}

export async function ingestRepository(input: IngestRepositoryInput, env: CursorDevOpsEnv): Promise<{ queued: boolean; githubUrl: string }> {
  await env.DB.prepare("INSERT INTO audit_logs (id, action, metadata_json) VALUES (?, ?, ?)")
    .bind(crypto.randomUUID(), "repository.ingest.requested", JSON.stringify(input))
    .run();

  return { queued: false, githubUrl: input.githubUrl };
}
