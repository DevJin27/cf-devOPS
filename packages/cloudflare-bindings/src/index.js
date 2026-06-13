export function jsonResponse(body, init = {}) {
    return new Response(JSON.stringify(body, null, 2), {
        ...init,
        headers: {
            "content-type": "application/json; charset=utf-8",
            ...init.headers
        }
    });
}
export function errorResponse(message, status = 400) {
    return jsonResponse({ error: message }, { status });
}
export const notReadyAnswer = {
    answer: "No indexed infrastructure evidence is available yet.",
    evidence: [],
    sources: [],
    confidence: 0,
    followUp: ["Ingest a repository before asking infrastructure questions."]
};
//# sourceMappingURL=index.js.map