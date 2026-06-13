import type { ClassifiedFile, InfraFact } from "@cursor-devops/shared-types";

export function classifyFiles(files: Array<{ path: string; content: string; size: number; sha?: string }>): ClassifiedFile[] {
  return files.map((file) => ({ ...file, type: "source" }));
}

export function parseInfrastructure(_files: ClassifiedFile[]): InfraFact[] {
  return [];
}
