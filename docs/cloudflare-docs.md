# Cloudflare Documentation Notes

Implementation decisions are aligned to Cloudflare's current documentation:

- Workers use Wrangler configuration files with service bindings declared in `wrangler.jsonc`.
- D1, R2, Vectorize, Workers AI, and Workflows are accessed as Worker bindings on `env`, avoiding REST calls from Workers.
- Local development can use Wrangler/Miniflare-managed local data for D1 and R2.
- Workflows are modeled as durable, retryable pipeline steps and triggered from a Worker binding.

Primary references:

- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/
- https://developers.cloudflare.com/vectorize/reference/client-api/
- https://developers.cloudflare.com/workflows/build/workers-api/
- https://developers.cloudflare.com/workflows/get-started/guide/
- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
