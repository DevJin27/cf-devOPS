import type { GraphEdge, GraphNode, InfraFact } from "@cursor-devops/shared-types";

export function buildGraph(_facts: InfraFact[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const fact of _facts) {
    const from = ensureNode(nodes, fact.entityType, fact.entityName, fact.sourceFile);
    const targetType = fact.metadata?.targetType ?? inferTargetType(fact.relation);
    const to = ensureNode(nodes, targetType, fact.target, fact.relation === "defined_in" ? fact.target : undefined);
    const edgeId = stableId(["edge", from.id, fact.relation, to.id, fact.sourceFile]);

    edges.set(edgeId, {
      id: edgeId,
      fromNodeId: from.id,
      toNodeId: to.id,
      relation: fact.relation,
      sourceFile: fact.sourceFile,
      metadata: fact.metadata
    });
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export async function persistGraph(db: D1Database, repoId: string, commitSha: string, graph: { nodes: GraphNode[]; edges: GraphEdge[] }): Promise<void> {
  const nodeStatements = graph.nodes.map((node) =>
    db
      .prepare(
        `INSERT OR REPLACE INTO graph_nodes (id, repo_id, commit_sha, type, name, source_file, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(node.id, repoId, commitSha, node.type, node.name, node.sourceFile ?? null, JSON.stringify(node.metadata ?? {}))
  );

  const edgeStatements = graph.edges.map((edge) =>
    db
      .prepare(
        `INSERT OR REPLACE INTO graph_edges (id, repo_id, commit_sha, from_node_id, to_node_id, relation, source_file, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(edge.id, repoId, commitSha, edge.fromNodeId, edge.toNodeId, edge.relation, edge.sourceFile, JSON.stringify(edge.metadata ?? {}))
  );

  if (nodeStatements.length) await db.batch(nodeStatements);
  if (edgeStatements.length) await db.batch(edgeStatements);
}

function ensureNode(nodes: Map<string, GraphNode>, type: string, name: string, sourceFile?: string): GraphNode {
  const id = stableId(["node", type, name]);
  const existing = nodes.get(id);
  if (existing) return existing;

  const node = { id, type, name, sourceFile };
  nodes.set(id, node);
  return node;
}

function inferTargetType(relation: string): string {
  if (relation === "uses_secret") return "secret";
  if (relation === "deployed_to") return "namespace";
  if (relation === "exposes_endpoint") return "endpoint";
  if (relation === "defined_in") return "source_file";
  return "resource";
}

function stableId(parts: string[]): string {
  return parts.join(":").toLowerCase().replace(/[^a-z0-9:_./-]+/g, "-");
}
