import { answerQuestion } from "@cursor-devops/answer-engine";
import { errorResponse, jsonResponse, type CursorDevOpsEnv } from "@cursor-devops/cloudflare-bindings";
import { ingestRepository } from "@cursor-devops/github-ingestion";
export { IngestionWorkflow } from "@cursor-devops/workflow-runner";

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Expected a JSON request body.");
  }
}

export default {
  async fetch(request: Request, env: CursorDevOpsEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "cursor-devops-api",
        environment: env.ENVIRONMENT ?? "development"
      });
    }

    if (request.method === "POST" && url.pathname === "/chat") {
      const body = await readJson<{ question?: string }>(request);
      if (!body.question?.trim()) {
        return errorResponse("question is required");
      }

      const answer = await answerQuestion(body.question, env);
      return jsonResponse(answer);
    }

    if (request.method === "POST" && url.pathname === "/ingest") {
      const body = await readJson<{ githubUrl?: string }>(request);
      if (!body.githubUrl?.trim()) {
        return errorResponse("githubUrl is required");
      }

      const result = await ingestRepository({ githubUrl: body.githubUrl }, env);
      return jsonResponse(result, { status: 202 });
    }

    return errorResponse("Not found", 404);
  }
};
