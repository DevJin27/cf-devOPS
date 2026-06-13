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
export declare function jsonResponse(body: unknown, init?: ResponseInit): Response;
export declare function errorResponse(message: string, status?: number): Response;
export declare const notReadyAnswer: AnswerResponse;
//# sourceMappingURL=index.d.ts.map