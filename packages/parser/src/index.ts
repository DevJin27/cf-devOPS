import { parseAllDocuments } from "yaml";
import type { ClassifiedFile, InfraFact, RepoFile } from "@cursor-devops/shared-types";

const K8S_KINDS = new Set(["Deployment", "Service", "Ingress", "StatefulSet", "Secret", "ConfigMap", "Namespace"]);
const K8S_FILE_RE = /(deployment|service|ingress|statefulset|secret|configmap|namespace)\.ya?ml$/i;

export function classifyFiles(files: RepoFile[]): ClassifiedFile[] {
  return files.map((file) => {
    const path = file.path.toLowerCase();
    if (path.endsWith(".tf") || path.endsWith(".tfvars")) return { ...file, type: "terraform" };
    if (path.endsWith("chart.yaml") || path.endsWith("values.yaml")) return { ...file, type: "helm" };
    if (K8S_FILE_RE.test(path) || path.endsWith(".yaml") || path.endsWith(".yml")) return { ...file, type: "k8s" };
    if (path.endsWith(".md") || path.endsWith(".adoc")) return { ...file, type: "runbook" };
    return { ...file, type: "source" };
  });
}

export function parseInfrastructure(files: ClassifiedFile[]): InfraFact[] {
  return files.flatMap((file) => {
    if (file.type === "k8s" || file.type === "helm") return parseKubernetesLikeFile(file);
    if (file.type === "terraform") return parseTerraformFile(file);
    return [];
  });
}

function parseKubernetesLikeFile(file: ClassifiedFile): InfraFact[] {
  const facts: InfraFact[] = [];

  for (const document of parseAllDocuments(file.content)) {
    const manifest = document.toJSON() as Record<string, unknown> | null;
    if (!manifest || typeof manifest !== "object") continue;

    const kind = stringValue(manifest.kind);
    const metadata = objectValue(manifest.metadata);
    const name = stringValue(metadata.name);
    if (!kind || !name || !K8S_KINDS.has(kind)) continue;

    const entityType = kind.toLowerCase();
    facts.push({
      sourceFile: file.path,
      entityType,
      entityName: name,
      relation: "defined_in",
      target: file.path
    });

    const namespace = stringValue(metadata.namespace);
    if (namespace) {
      facts.push({ sourceFile: file.path, entityType, entityName: name, relation: "deployed_to", target: namespace });
    }

    if (kind === "Deployment" || kind === "StatefulSet") {
      facts.push(...parseWorkloadFacts(file.path, entityType, name, manifest));
    }

    if (kind === "Service") {
      facts.push(...parseServiceFacts(file.path, name, manifest));
    }

    if (kind === "Ingress") {
      facts.push(...parseIngressFacts(file.path, name, manifest));
    }
  }

  return facts;
}

function parseWorkloadFacts(sourceFile: string, entityType: string, entityName: string, manifest: Record<string, unknown>): InfraFact[] {
  const facts: InfraFact[] = [];
  const spec = objectValue(manifest.spec);
  const template = objectValue(spec.template);
  const podSpec = objectValue(template.spec);
  const containers = arrayValue(podSpec.containers);

  for (const container of containers) {
    const containerObject = objectValue(container);
    for (const env of arrayValue(containerObject.env)) {
      const envObject = objectValue(env);
      const value = stringValue(envObject.value);
      const envName = stringValue(envObject.name);
      const valueFrom = objectValue(envObject.valueFrom);
      const secretRef = objectValue(valueFrom.secretKeyRef);
      const configMapRef = objectValue(valueFrom.configMapKeyRef);

      if (value && looksLikeDependency(value)) {
        facts.push({ sourceFile, entityType, entityName, relation: "depends_on", target: normalizeDependency(value), metadata: metadata({ env: envName }) });
      }
      if (secretRef.name) {
        facts.push({ sourceFile, entityType, entityName, relation: "uses_secret", target: String(secretRef.name), metadata: metadata({ env: envName }) });
      }
      if (configMapRef.name) {
        facts.push({ sourceFile, entityType, entityName, relation: "references", target: String(configMapRef.name), metadata: metadata({ env: envName, targetType: "configmap" }) });
      }
    }

    for (const envFrom of arrayValue(containerObject.envFrom)) {
      const envFromObject = objectValue(envFrom);
      const secretRef = objectValue(envFromObject.secretRef);
      const configMapRef = objectValue(envFromObject.configMapRef);
      if (secretRef.name) facts.push({ sourceFile, entityType, entityName, relation: "uses_secret", target: String(secretRef.name) });
      if (configMapRef.name) facts.push({ sourceFile, entityType, entityName, relation: "references", target: String(configMapRef.name), metadata: { targetType: "configmap" } });
    }
  }

  return facts;
}

function parseServiceFacts(sourceFile: string, entityName: string, manifest: Record<string, unknown>): InfraFact[] {
  const spec = objectValue(manifest.spec);
  const selector = objectValue(spec.selector);
  const selectorValue = Object.values(selector).find((value) => typeof value === "string");
  const facts: InfraFact[] = [];

  if (selectorValue) {
    facts.push({ sourceFile, entityType: "service", entityName, relation: "references", target: String(selectorValue), metadata: { selector: JSON.stringify(selector) } });
  }

  for (const port of arrayValue(spec.ports)) {
    const portObject = objectValue(port);
    const portValue = stringValue(portObject.port) ?? numberString(portObject.port);
    if (portValue) facts.push({ sourceFile, entityType: "service", entityName, relation: "exposes_endpoint", target: `${entityName}:${portValue}` });
  }

  return facts;
}

function parseIngressFacts(sourceFile: string, entityName: string, manifest: Record<string, unknown>): InfraFact[] {
  const spec = objectValue(manifest.spec);
  const facts: InfraFact[] = [];

  for (const rule of arrayValue(spec.rules)) {
    const ruleObject = objectValue(rule);
    const host = stringValue(ruleObject.host);
    if (host) facts.push({ sourceFile, entityType: "ingress", entityName, relation: "exposes_endpoint", target: host });

    const http = objectValue(ruleObject.http);
    for (const path of arrayValue(http.paths)) {
      const pathObject = objectValue(path);
      const backend = objectValue(pathObject.backend);
      const service = objectValue(backend.service);
      const serviceName = stringValue(service.name);
      if (serviceName) facts.push({ sourceFile, entityType: "ingress", entityName, relation: "references", target: serviceName, metadata: { targetType: "service" } });
    }
  }

  return facts;
}

function parseTerraformFile(file: ClassifiedFile): InfraFact[] {
  const facts: InfraFact[] = [];
  const resourceRe = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = resourceRe.exec(file.content))) {
    const [, resourceType, resourceName] = match;
    const entityName = `${resourceType}.${resourceName}`;
    facts.push({ sourceFile: file.path, entityType: "resource", entityName, relation: "defined_in", target: file.path });

    const block = readBalancedBlock(file.content, match.index + match[0].length - 1);
    const dependsOn = block.match(/depends_on\s*=\s*\[([^\]]+)\]/m)?.[1];
    if (dependsOn) {
      for (const dependency of dependsOn.split(",").map((value) => value.trim().replaceAll('"', "")).filter(Boolean)) {
        facts.push({ sourceFile: file.path, entityType: "resource", entityName, relation: "depends_on", target: dependency });
      }
    }

    for (const ref of block.matchAll(/\b([a-zA-Z][\w]*\.[a-zA-Z][\w-]*)\./g)) {
      const target = ref[1];
      if (target !== entityName) {
        facts.push({ sourceFile: file.path, entityType: "resource", entityName, relation: "references", target });
      }
    }
  }

  return facts;
}

function readBalancedBlock(content: string, openBraceIndex: number): string {
  let depth = 0;
  for (let index = openBraceIndex; index < content.length; index += 1) {
    const char = content[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return content.slice(openBraceIndex, index + 1);
  }
  return content.slice(openBraceIndex);
}

function looksLikeDependency(value: string): boolean {
  return /:\/\/|redis|postgres|mysql|kafka|rabbit|mongo|http|grpc/i.test(value);
}

function normalizeDependency(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname || value;
  } catch {
    return value.replace(/^.*@/, "").replace(/:\d+.*$/, "").replace(/^\/\//, "");
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberString(value: unknown): string | undefined {
  return typeof value === "number" ? String(value) : undefined;
}

function metadata(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}
