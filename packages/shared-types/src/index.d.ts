export type InfraFileType = "terraform" | "k8s" | "helm" | "runbook" | "source";
export interface RepoFile {
    path: string;
    content: string;
    size: number;
    sha?: string;
}
export interface RepositorySnapshot {
    repoId: string;
    commitSha: string;
    files: RepoFile[];
}
export interface ClassifiedFile extends RepoFile {
    type: InfraFileType;
}
export interface InfraFact {
    sourceFile: string;
    entityType: string;
    entityName: string;
    relation: string;
    target: string;
    metadata?: Record<string, string>;
}
export interface GraphNode {
    id: string;
    type: string;
    name: string;
    sourceFile?: string;
    metadata?: Record<string, string>;
}
export interface GraphEdge {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    relation: string;
    sourceFile: string;
    metadata?: Record<string, string>;
}
export interface Chunk {
    id: string;
    content: string;
    metadata: Record<string, string>;
}
export interface VectorRecord {
    id: string;
    vector: number[];
    metadata: {
        repo: string;
        service: string;
        environment: string;
        type: string;
    };
}
export type QueryIntent = "dependency_lookup" | "secret_lookup" | "outage_analysis" | "ownership_lookup" | "deployment_lookup" | "service_discovery" | "change_analysis";
export interface IntentResult {
    intent: QueryIntent;
    confidence: number;
}
export interface Evidence {
    content: string;
    source: string;
    score: number;
}
export interface AnswerResponse {
    answer: string;
    evidence: Evidence[];
    sources: string[];
    confidence: number;
    followUp: string[];
}
//# sourceMappingURL=index.d.ts.map