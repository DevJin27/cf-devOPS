import type { CursorDevOpsEnv } from "@cursor-devops/cloudflare-bindings";
export interface IngestRepositoryInput {
    githubUrl: string;
}
export declare function ingestRepository(input: IngestRepositoryInput, env: CursorDevOpsEnv): Promise<{
    queued: boolean;
    githubUrl: string;
}>;
//# sourceMappingURL=index.d.ts.map