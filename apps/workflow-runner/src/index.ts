import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { CursorDevOpsEnv } from "@cursor-devops/cloudflare-bindings";
import type { RepositorySnapshot } from "@cursor-devops/shared-types";

export class IngestionWorkflow extends WorkflowEntrypoint<CursorDevOpsEnv, RepositorySnapshot> {
  async run(event: WorkflowEvent<RepositorySnapshot>, step: WorkflowStep): Promise<{ ok: true; repoId: string }> {
    const snapshot = event.payload;

    await step.do("record workflow start", async () => {
      await this.env.DB.prepare(
        "INSERT INTO audit_logs (id, action, metadata_json) VALUES (?, ?, ?)"
      )
        .bind(crypto.randomUUID(), "workflow.started", JSON.stringify({ repoId: snapshot.repoId, commitSha: snapshot.commitSha }))
        .run();
    });

    return { ok: true, repoId: snapshot.repoId };
  }
}
