import type { ClassifiedFile, InfraFact } from "@cursor-devops/shared-types";
export declare function classifyFiles(files: Array<{
    path: string;
    content: string;
    size: number;
    sha?: string;
}>): ClassifiedFile[];
export declare function parseInfrastructure(_files: ClassifiedFile[]): InfraFact[];
//# sourceMappingURL=index.d.ts.map