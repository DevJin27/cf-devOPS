import { notReadyAnswer, type CursorDevOpsEnv } from "@cursor-devops/cloudflare-bindings";
import { classifyIntent } from "@cursor-devops/retrieval";
import type { AnswerResponse } from "@cursor-devops/shared-types";

export async function answerQuestion(question: string, env: CursorDevOpsEnv): Promise<AnswerResponse> {
  const intent = classifyIntent(question);
  await env.DB.prepare(
    "INSERT INTO query_history (id, question, intent, confidence, sources_json) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(crypto.randomUUID(), question, intent.intent, intent.confidence, "[]")
    .run();

  return {
    ...notReadyAnswer,
    followUp: ["Ingest a repository with POST /ingest, then retry the question."]
  };
}
