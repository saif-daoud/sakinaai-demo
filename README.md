# SakinaAI SOAP Demo

Interactive demo for generating a SOAP-style clinical note from an Arabic
transcript. The frontend runs on GitHub Pages. All secrets, model calls, access
checks, and D1 tracking run in the Cloudflare Worker.

## Local frontend

```bash
npm install
npm run dev
```

The frontend needs a deployed or local Worker URL in `public/data/runtime-config.json`
or `VITE_API_BASE`.

## Local Worker

```bash
npm --prefix worker install
npm run worker:migrate:local
npm run worker:dev
```

Create `worker/.dev.vars` locally when testing inference:

```text
TOKEN_SECRET=local-random-token-secret
ACCESS_CODE_HASHES=<sha256-access-code>
FANAR_API=<fanar-key>
HF_API=<hugging-face-key>
OPENROUTER_API_KEYS=<key1>,<key2>,<key3>
```

For quick local-only testing you may set `ALLOW_DEFAULT_ACCESS_CODE=1` and
`ALLOW_DEFAULT_TOKEN_SECRET=1`, which enables development fallbacks embedded in
the Worker source. Do not use those flags for the deployed demo.

## GitHub Secrets

Add these repository secrets before the final deployed demo is expected to run
inference:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
TOKEN_SECRET
ACCESS_CODE_HASHES
FANAR_API
HF_API
OPENROUTER_API_KEYS
```

Optional aliases:

```text
ACCESS_CODE_HASH
API_KEYS
VITE_API_BASE
```

`ACCESS_CODE_HASHES` accepts one or more SHA-256 hashes separated by commas.
`OPENROUTER_API_KEYS` accepts one or more OpenRouter keys separated by commas or
newlines. The Worker rotates through OpenRouter keys when a key is rate-limited,
out of credits, or rejected.

## Data Tracking

The D1 database stores:

- expert email and stable expert id
- imported transcript text
- selected model
- translated transcript when Fanar translation is used
- parsed SOAP JSON
- raw model output
- failed generation attempts and error messages

## Smoke Testing

After signing in, the Worker accepts authenticated low-token smoke checks at
`POST /api/smoke`:

```json
{
  "token": "session-token",
  "model_key": "fanar2",
  "max_tokens": 2
}
```

This uses the same deployed provider routing as `/api/generate`, but it does
not create a SOAP note or database generation row.

## Model Routes

Working API routes are enabled for:

```text
fanar2, gemma4, acegpt, openbiollm_8b, med42_8b,
jsl_medllama_8b, gpt4_1, deepseek_v32, llama_33_70b
```

The UI lists but disables exact Hugging Face repos that are not currently served
by enabled HF Inference Providers.
