import { type CursorDevOpsEnv } from "@cursor-devops/cloudflare-bindings";
import { classifyIntent, retrieveEvidence } from "@cursor-devops/retrieval";
import type { AnswerResponse } from "@cursor-devops/shared-types";

export async function answerQuestion(question: string, env: CursorDevOpsEnv): Promise<AnswerResponse> {
  const intent = classifyIntent(question);
  const evidence = await retrieveEvidence(env.DB, question);
  const sources = [...new Set(evidence.map((item) => item.source))];
  const answer = buildGroundedAnswer(question, evidence);
  const confidence = evidence.length ? Math.min(0.95, evidence.reduce((sum, item) => sum + item.score, 0) / evidence.length) : 0;

  await env.DB.prepare(
    "INSERT INTO query_history (id, question, intent, confidence, sources_json) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(crypto.randomUUID(), question, intent.intent, confidence || intent.confidence, JSON.stringify(sources))
    .run();

  return {
    answer,
    evidence,
    sources,
    confidence,
    followUp: evidence.length
      ? ["Open the cited source files to inspect the underlying infrastructure definitions."]
      : ["Ingest a repository with POST /ingest, then retry the question."]
  };
}

function buildGroundedAnswer(question: string, evidence: AnswerResponse["evidence"]): string {
  if (!evidence.length) return "I could not find indexed infrastructure evidence for this question.";

  const dependencyMatches = evidence
    .map((item) => item.content.match(/^(.+) depends on (.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match));

  if (dependencyMatches.length) {
    const services = [...new Set(dependencyMatches.map((match) => match[1]))].join(", ");
    const targets = [...new Set(dependencyMatches.map((match) => match[2]))].join(", ");
    return `${services} ${dependencyMatches.length === 1 ? "talks" : "talk"} to ${targets}, based on graph relationships extracted from the cited infrastructure files.`;
  }

  return `I found ${evidence.length} source-backed result${evidence.length === 1 ? "" : "s"} for: ${question}`;
}
