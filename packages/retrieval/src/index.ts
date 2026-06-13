import type { Evidence, IntentResult } from "@cursor-devops/shared-types";

export function classifyIntent(question: string): IntentResult {
  const normalized = question.toLowerCase();
  if (normalized.includes("secret")) return { intent: "secret_lookup", confidence: 0.8 };
  if (normalized.includes("deploy")) return { intent: "deployment_lookup", confidence: 0.75 };
  return { intent: "dependency_lookup", confidence: 0.65 };
}

export async function retrieveEvidence(): Promise<Evidence[]> {
  return [];
}
