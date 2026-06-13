import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { CursorDevOpsEnv } from "@cursor-devops/cloudflare-bindings";
import type { RepositorySnapshot } from "@cursor-devops/shared-types";
export declare class IngestionWorkflow extends WorkflowEntrypoint<CursorDevOpsEnv, RepositorySnapshot> {
    run(event: WorkflowEvent<RepositorySnapshot>, step: WorkflowStep): Promise<{
        ok: true;
        repoId: string;
    }>;
}
//# sourceMappingURL=index.d.ts.map