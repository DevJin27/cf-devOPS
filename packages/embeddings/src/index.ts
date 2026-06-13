import type { Chunk } from "@cursor-devops/shared-types";

export interface EmbeddingRecord {
  id: string;
  values: number[];
  metadata: Record<string, string>;
}

export async function embedChunks(_chunks: Chunk[]): Promise<EmbeddingRecord[]> {
  return [];
}
