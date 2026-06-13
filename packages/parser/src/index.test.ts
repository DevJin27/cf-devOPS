import { describe, expect, it } from "vitest";
import { classifyFiles, parseInfrastructure } from "./index";

describe("parser", () => {
  it("extracts Kubernetes dependencies and secret references", () => {
    const files = classifyFiles([
      {
        path: "services/payments/deployment.yaml",
        size: 0,
        content: `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments
  namespace: staging
spec:
  template:
    spec:
      containers:
        - name: api
          env:
            - name: REDIS_URL
              value: redis://redis:6379
            - name: API_TOKEN
              valueFrom:
                secretKeyRef:
                  name: payments-secret
                  key: token
`
      }
    ]);

    const facts = parseInfrastructure(files);
    expect(facts).toContainEqual(expect.objectContaining({ entityName: "payments", relation: "depends_on", target: "redis" }));
    expect(facts).toContainEqual(expect.objectContaining({ entityName: "payments", relation: "uses_secret", target: "payments-secret" }));
  });

  it("extracts Terraform resources and dependencies", () => {
    const files = classifyFiles([
      {
        path: "infra/main.tf",
        size: 0,
        content: `
resource "aws_security_group" "api" {}
resource "aws_instance" "api" {
  depends_on = [aws_security_group.api]
  vpc_security_group_ids = [aws_security_group.api.id]
}
`
      }
    ]);

    const facts = parseInfrastructure(files);
    expect(facts).toContainEqual(expect.objectContaining({ entityName: "aws_instance.api", relation: "depends_on", target: "aws_security_group.api" }));
    expect(facts).toContainEqual(expect.objectContaining({ entityName: "aws_instance.api", relation: "references", target: "aws_security_group.api" }));
  });
});
