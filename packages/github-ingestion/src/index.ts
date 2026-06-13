import type { CursorDevOpsEnv } from "@cursor-devops/cloudflare-bindings";
import { embedChunks, upsertEmbeddings } from "@cursor-devops/embeddings";
import { buildGraph, persistGraph } from "@cursor-devops/graph-builder";
import { classifyFiles, parseInfrastructure } from "@cursor-devops/parser";
import { chunkFiles, persistChunks } from "@cursor-devops/retrieval";
import type { RepoFile, RepositorySnapshot } from "@cursor-devops/shared-types";

export interface IngestRepositoryInput {
  githubUrl: string;
}

export async function ingestRepository(input: IngestRepositoryInput, env: CursorDevOpsEnv): Promise<{ queued: boolean; repoId: string; commitSha: string; files: number; facts: number; chunks: number }> {
  const snapshot = await fetchGitHubSnapshot(input.githubUrl, env.GITHUB_TOKEN);
  const classified = classifyFiles(snapshot.files);
  const facts = parseInfrastructure(classified);
  const graph = buildGraph(facts);
  const chunks = chunkFiles(classified, snapshot.repoId, snapshot.commitSha);
  const r2Key = `snapshots/${snapshot.repoId}/${snapshot.commitSha}.json`;

  if (env.SNAPSHOTS) {
    await env.SNAPSHOTS.put(r2Key, JSON.stringify(snapshot));
  }

  await env.DB.prepare("INSERT OR REPLACE INTO repository_snapshots (repo_id, commit_sha, r2_key) VALUES (?, ?, ?)")
    .bind(snapshot.repoId, snapshot.commitSha, r2Key)
    .run();

  await persistFiles(env.DB, snapshot, classified);
  await persistGraph(env.DB, snapshot.repoId, snapshot.commitSha, graph);
  await persistChunks(env.DB, snapshot.repoId, snapshot.commitSha, chunks);

  if (chunks.length) {
    const embeddings = await embedChunks(chunks, env.AI);
    await upsertEmbeddings(env.VECTOR_INDEX, embeddings);
  }

  let queued = false;
  if (env.INGESTION_WORKFLOW) {
    await env.INGESTION_WORKFLOW.create({
      id: `ingest-${snapshot.repoId.replaceAll("/", "-")}-${snapshot.commitSha.slice(0, 12)}`,
      params: snapshot
    });
    queued = true;
  }

  await env.DB.prepare("INSERT INTO audit_logs (id, action, metadata_json) VALUES (?, ?, ?)")
    .bind(crypto.randomUUID(), "repository.ingested", JSON.stringify({ ...input, repoId: snapshot.repoId, commitSha: snapshot.commitSha }))
    .run();

  return { queued, repoId: snapshot.repoId, commitSha: snapshot.commitSha, files: snapshot.files.length, facts: facts.length, chunks: chunks.length };
}

async function fetchGitHubSnapshot(githubUrl: string, token?: string): Promise<RepositorySnapshot> {
  const repo = parseGitHubUrl(githubUrl);
  const headers = githubHeaders(token);
  const repoResponse = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, { headers });
  if (!repoResponse.ok) throw new Error(`GitHub repository lookup failed: ${repoResponse.status}`);

  const repoData = await repoResponse.json<{ default_branch: string }>();
  const branchResponse = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/branches/${repoData.default_branch}`, { headers });
  if (!branchResponse.ok) throw new Error(`GitHub branch lookup failed: ${branchResponse.status}`);

  const branchData = await branchResponse.json<{ commit: { sha: string } }>();
  const treeResponse = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/git/trees/${branchData.commit.sha}?recursive=1`, { headers });
  if (!treeResponse.ok) throw new Error(`GitHub tree lookup failed: ${treeResponse.status}`);

  const treeData = await treeResponse.json<{ tree: Array<{ path: string; type: string; size?: number; sha: string; url: string }> }>();
  const candidates = treeData.tree.filter((item) => item.type === "blob" && isRelevantPath(item.path) && (item.size ?? 0) <= 512_000).slice(0, 500);
  const files: RepoFile[] = [];

  for (const item of candidates) {
    const rawResponse = await fetch(`https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${branchData.commit.sha}/${item.path}`, { headers });
    if (!rawResponse.ok) continue;
    files.push({
      path: item.path,
      content: await rawResponse.text(),
      size: item.size ?? 0,
      sha: item.sha
    });
  }

  return {
    repoId: `${repo.owner}/${repo.name}`,
    commitSha: branchData.commit.sha,
    files
  };
}

async function persistFiles(db: D1Database, snapshot: RepositorySnapshot, files: ReturnType<typeof classifyFiles>): Promise<void> {
  const statements = files.map((file) =>
    db
      .prepare(
        `INSERT OR REPLACE INTO files (id, repo_id, commit_sha, path, type, content_hash)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(`${snapshot.repoId}:${snapshot.commitSha}:${file.path}`, snapshot.repoId, snapshot.commitSha, file.path, file.type, file.sha ?? null)
  );

  if (statements.length) await db.batch(statements);
}

function parseGitHubUrl(githubUrl: string): { owner: string; name: string } {
  const url = new URL(githubUrl);
  if (url.hostname !== "github.com") throw new Error("Only github.com repository URLs are supported.");
  const [owner, rawName] = url.pathname.replace(/^\/+/, "").split("/");
  const name = rawName?.replace(/\.git$/, "");
  if (!owner || !name) throw new Error("GitHub URL must include owner and repository name.");
  return { owner, name };
}

function githubHeaders(token?: string): HeadersInit {
  return {
    "accept": "application/vnd.github+json",
    "user-agent": "cursor-devops-worker",
    ...(token ? { authorization: `Bearer ${token}` } : {})
  };
}

function isRelevantPath(path: string): boolean {
  return /\.(ya?ml|tf|tfvars|md|adoc)$/i.test(path) || /(^|\/)(Chart\.yaml|values\.yaml)$/i.test(path);
}
