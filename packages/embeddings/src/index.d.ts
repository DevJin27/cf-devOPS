import type { Chunk } from "@cursor-devops/shared-types";
export interface EmbeddingRecord {
    id: string;
    values: number[];
    metadata: Record<string, string>;
}
export declare function embedChunks(_chunks: Chunk[]): Promise<EmbeddingRecord[]>;
//# sourceMappingURL=index.d.ts.map