export async function ingestRepository(input, env) {
    await env.DB.prepare("INSERT INTO audit_logs (id, action, metadata_json) VALUES (?, ?, ?)")
        .bind(crypto.randomUUID(), "repository.ingest.requested", JSON.stringify(input))
        .run();
    return { queued: false, githubUrl: input.githubUrl };
}
//# sourceMappingURL=index.js.map