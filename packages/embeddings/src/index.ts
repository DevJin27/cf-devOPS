import type { Chunk } from "@cursor-devops/shared-types";

export interface EmbeddingRecord {
  id: string;
  values: number[];
  metadata: Record<string, string>;
}

export async function embedChunks(chunks: Chunk[], ai?: Ai): Promise<EmbeddingRecord[]> {
  if (ai) {
    const response = await ai.run("@cf/baai/bge-base-en-v1.5", {
      text: chunks.map((chunk) => chunk.content)
    }) as { data?: number[][] };

    if (Array.isArray(response.data)) {
      return chunks.map((chunk, index) => ({
        id: chunk.id,
        values: response.data?.[index] ?? deterministicEmbedding(chunk.content),
        metadata: chunk.metadata
      }));
    }
  }

  return chunks.map((chunk) => ({
    id: chunk.id,
    values: deterministicEmbedding(chunk.content),
    metadata: chunk.metadata
  }));
}

export async function upsertEmbeddings(index: VectorizeIndex, records: EmbeddingRecord[]): Promise<void> {
  const batchSize = 500;
  for (let offset = 0; offset < records.length; offset += batchSize) {
    const batch = records.slice(offset, offset + batchSize).map((record) => ({
      id: record.id,
      values: record.values,
      metadata: record.metadata
    }));
    await index.upsert(batch);
  }
}

function deterministicEmbedding(content: string): number[] {
  const dimensions = 768;
  const values = new Array<number>(dimensions).fill(0);
  for (let index = 0; index < content.length; index += 1) {
    const bucket = index % dimensions;
    values[bucket] += (content.charCodeAt(index) % 31) / 31;
  }
  const length = Math.hypot(...values) || 1;
  return values.map((value) => value / length);
}
