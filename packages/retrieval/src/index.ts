import { redactSensitiveText } from "@cursor-devops/cloudflare-bindings";
import type { Chunk, ClassifiedFile, Evidence, IntentResult } from "@cursor-devops/shared-types";

export function classifyIntent(question: string): IntentResult {
  const normalized = question.toLowerCase();
  if (normalized.includes("secret")) return { intent: "secret_lookup", confidence: 0.8 };
  if (normalized.includes("deploy")) return { intent: "deployment_lookup", confidence: 0.75 };
  return { intent: "dependency_lookup", confidence: 0.65 };
}

export function chunkFiles(files: ClassifiedFile[], repoId: string, commitSha: string): Chunk[] {
  return files.flatMap((file) => {
    if (file.type === "terraform") return chunkTerraform(file, repoId, commitSha);
    if (file.type === "k8s" || file.type === "helm") return chunkByManifest(file, repoId, commitSha);
    if (file.type === "runbook") return chunkMarkdown(file, repoId, commitSha);
    return chunkBySize(file, repoId, commitSha);
  });
}

export async function persistChunks(db: D1Database, repoId: string, commitSha: string, chunks: Chunk[]): Promise<void> {
  const statements = chunks.map((chunk) =>
    db
      .prepare(
        `INSERT OR REPLACE INTO chunks (id, repo_id, commit_sha, source_file, content, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(chunk.id, repoId, commitSha, chunk.metadata.sourceFile, chunk.content, JSON.stringify(chunk.metadata))
  );

  if (statements.length) await db.batch(statements);
}

export async function retrieveEvidence(db: D1Database, question: string): Promise<Evidence[]> {
  const intent = classifyIntent(question);
  if (intent.intent === "dependency_lookup") return retrieveDependencyEvidence(db, question);
  if (intent.intent === "secret_lookup") return retrieveRelationEvidence(db, "uses_secret");
  if (intent.intent === "deployment_lookup") return retrieveRelationEvidence(db, "deployed_to");
  return retrieveTextEvidence(db, question);
}

async function retrieveDependencyEvidence(db: D1Database, question: string): Promise<Evidence[]> {
  const target = extractTarget(question) ?? "%";
  const result = await db
    .prepare(
      `SELECT source.name AS source_name, target.name AS target_name, edge.source_file AS source_file
       FROM graph_edges edge
       JOIN graph_nodes source ON source.id = edge.from_node_id
       JOIN graph_nodes target ON target.id = edge.to_node_id
       WHERE edge.relation = 'depends_on' AND lower(target.name) LIKE ?
       LIMIT 10`
    )
    .bind(`%${target.toLowerCase()}%`)
    .all<{ source_name: string; target_name: string; source_file: string }>();

  return result.results.map((row) => ({
    content: `${row.source_name} depends on ${row.target_name}`,
    source: row.source_file,
    score: 0.95
  }));
}

async function retrieveRelationEvidence(db: D1Database, relation: string): Promise<Evidence[]> {
  const result = await db
    .prepare(
      `SELECT source.name AS source_name, target.name AS target_name, edge.source_file AS source_file
       FROM graph_edges edge
       JOIN graph_nodes source ON source.id = edge.from_node_id
       JOIN graph_nodes target ON target.id = edge.to_node_id
       WHERE edge.relation = ?
       LIMIT 10`
    )
    .bind(relation)
    .all<{ source_name: string; target_name: string; source_file: string }>();

  return result.results.map((row) => ({
    content: `${row.source_name} ${relation} ${row.target_name}`,
    source: row.source_file,
    score: 0.85
  }));
}

async function retrieveTextEvidence(db: D1Database, question: string): Promise<Evidence[]> {
  const term = extractTarget(question) ?? question.split(/\s+/).find((word) => word.length > 3) ?? "";
  const result = await db
    .prepare("SELECT source_file, content FROM chunks WHERE lower(content) LIKE ? LIMIT 5")
    .bind(`%${term.toLowerCase()}%`)
    .all<{ source_file: string; content: string }>();

  return result.results.map((row) => ({
    content: redactSensitiveText(row.content.slice(0, 500)),
    source: row.source_file,
    score: 0.6
  }));
}

function chunkTerraform(file: ClassifiedFile, repoId: string, commitSha: string): Chunk[] {
  const resourceBlocks = [...file.content.matchAll(/resource\s+"[^"]+"\s+"[^"]+"\s*\{/g)];
  if (!resourceBlocks.length) return chunkBySize(file, repoId, commitSha);

  return resourceBlocks.map((match, index) => {
    const start = match.index ?? 0;
    const end = resourceBlocks[index + 1]?.index ?? file.content.length;
    return makeChunk(file, repoId, commitSha, file.content.slice(start, end).trim(), index);
  });
}

function chunkByManifest(file: ClassifiedFile, repoId: string, commitSha: string): Chunk[] {
  return file.content
    .split(/^---\s*$/m)
    .map((content) => content.trim())
    .filter(Boolean)
    .map((content, index) => makeChunk(file, repoId, commitSha, content, index));
}

function chunkMarkdown(file: ClassifiedFile, repoId: string, commitSha: string): Chunk[] {
  const sections = file.content.split(/(?=^#{1,6}\s+)/m).map((content) => content.trim()).filter(Boolean);
  return (sections.length ? sections : [file.content]).map((content, index) => makeChunk(file, repoId, commitSha, content, index));
}

function chunkBySize(file: ClassifiedFile, repoId: string, commitSha: string): Chunk[] {
  const chunks: Chunk[] = [];
  const maxChars = 6000;
  for (let start = 0; start < file.content.length || start === 0; start += maxChars) {
    chunks.push(makeChunk(file, repoId, commitSha, file.content.slice(start, start + maxChars), chunks.length));
    if (file.content.length === 0) break;
  }
  return chunks;
}

function makeChunk(file: ClassifiedFile, repoId: string, commitSha: string, content: string, index: number): Chunk {
  return {
    id: stableId(["chunk", repoId, commitSha, file.path, String(index)]),
    content,
    metadata: {
      repo: repoId,
      commitSha,
      sourceFile: file.path,
      type: file.type
    }
  };
}

function extractTarget(question: string): string | undefined {
  const known = question.match(/\b(redis|postgres|mysql|kafka|rabbitmq|mongodb|mongo|elastic|opensearch)\b/i)?.[1];
  if (known) return known;
  return question.match(/\bto\s+([a-z0-9._-]+)\b/i)?.[1];
}

function stableId(parts: string[]): string {
  return parts.join(":").toLowerCase().replace(/[^a-z0-9:_./-]+/g, "-");
}
