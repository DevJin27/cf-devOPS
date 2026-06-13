import type { GraphEdge, GraphNode, InfraFact } from "@cursor-devops/shared-types";

export function buildGraph(_facts: InfraFact[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return { nodes: [], edges: [] };
}
