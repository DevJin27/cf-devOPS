import { WorkflowEntrypoint } from "cloudflare:workers";
export class IngestionWorkflow extends WorkflowEntrypoint {
    async run(event, step) {
        const snapshot = event.payload;
        await step.do("record workflow start", async () => {
            await this.env.DB.prepare("INSERT INTO audit_logs (id, action, metadata_json) VALUES (?, ?, ?)")
                .bind(crypto.randomUUID(), "workflow.started", JSON.stringify({ repoId: snapshot.repoId, commitSha: snapshot.commitSha }))
                .run();
        });
        return { ok: true, repoId: snapshot.repoId };
    }
}
//# sourceMappingURL=index.js.map