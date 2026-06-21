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
HF_DEDICATED_ENDPOINTS={"medgemma_4b":{"endpoint":"https://YOUR-ENDPOINT.endpoints.huggingface.cloud","task":"chat-completion"}}
HF_DEDICATED_API_KEY=<optional-dedicated-endpoint-key>
OPENROUTER_API_KEYS=<key1>,<key2>,<key3>
AZURE_OPENAI_API_KEY=<azure-key>
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4.1
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.cognitiveservices.azure.com/
OPENAI_API_KEY=<openai-compatible-key>
OPENAI_COMPATIBLE_ENDPOINT=https://YOUR-RESOURCE.services.ai.azure.com/openai/v1/
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
HF_DEDICATED_ENDPOINTS
HF_DEDICATED_API_KEY
OPENROUTER_API_KEYS
AZURE_OPENAI_API_KEY
AZURE_OPENAI_API_VERSION
AZURE_OPENAI_DEPLOYMENT
AZURE_OPENAI_ENDPOINT
OPENAI_API_KEY
OPENAI_COMPATIBLE_ENDPOINT
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
by enabled HF Inference Providers. GPT-4.1 is routed through the Azure OpenAI
deployment, while DeepSeek V3.2 and Llama 3.3 70B use the configured
OpenAI-compatible endpoint. Gemma remains on OpenRouter and uses the standard
paid route because the free route is frequently limited by its shared upstream
quota.

### Models without a serverless provider

ALLaM, Falcon H1, both BiMediX2 variants, MedGemma, and BioMistral currently
have no Hugging Face serverless Inference Provider mapping and are not listed by
OpenRouter. They can be deployed as dedicated Hugging Face Inference Endpoints
and enabled without another code change by setting `HF_DEDICATED_ENDPOINTS` to
a JSON object keyed by the Sakina model key:

```json
{
  "allam": "https://YOUR-ALLAM-ENDPOINT.endpoints.huggingface.cloud",
  "bimedix2_hf": {
    "endpoint": "https://YOUR-BIMEDIX-ENDPOINT.endpoints.huggingface.cloud",
    "task": "completion"
  },
  "medgemma_4b": {
    "endpoint": "https://YOUR-MEDGEMMA-ENDPOINT.endpoints.huggingface.cloud",
    "task": "chat-completion"
  }
}
```

Values may be endpoint URL strings or objects with `endpoint`, optional `model`,
and optional `task` (`chat-completion` or `completion`). The Worker uses
`HF_DEDICATED_API_KEY`, falling back to `HF_API`. After deployment, `/api/models`
automatically enables only cards with a configured endpoint.
