import { describe, expect, it } from "vitest";
import { buildGraph } from "./index";

describe("graph builder", () => {
  it("turns facts into stable nodes and edges", () => {
    const graph = buildGraph([
      {
        sourceFile: "deployment.yaml",
        entityType: "deployment",
        entityName: "payments",
        relation: "depends_on",
        target: "redis"
      }
    ]);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ relation: "depends_on", sourceFile: "deployment.yaml" });
  });
});
