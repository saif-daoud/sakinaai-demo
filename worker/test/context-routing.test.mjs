import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { testSupport } from "../src/index.js";

const {
  MODEL_REGISTRY,
  callModel,
  deleteHistoryItem,
  publicModelRegistry,
  runGeneration,
  runTranslation,
  splitKeys,
} = testSupport;

const sourceTranscript = `${"المريضة: أشعر بقلق قبل موعد الزواج وأحتاج إلى المساندة. ".repeat(8)}SOURCE-ARABIC-4731`;
const translatedTranscript = `${"Patient: I feel anxious before the wedding and need support. ".repeat(8)}SOURCE-ENGLISH-4731`;
const soapOutput = JSON.stringify({
  conversation_summary: "The patient described anxiety before the wedding.",
  medical_notes_soap: {
    subjective: {},
    objective: {},
    assessment: {},
    plan: {},
  },
});

function testEnv() {
  return {
    FANAR_API: "fanar-test",
    HF_API: "hf-test",
    OPENROUTER_API_KEYS: "sk-first\nsk-second\nsk-third",
    AZURE_OPENAI_API_KEY: "azure-test",
    AZURE_OPENAI_API_VERSION: "2024-12-01-preview",
    AZURE_OPENAI_DEPLOYMENT: "gpt-4.1",
    AZURE_OPENAI_ENDPOINT: "https://azure.example/",
    OPENAI_API_KEY: "openai-test",
    OPENAI_COMPATIBLE_ENDPOINT: "https://models.example/openai/v1/",
    HF_DEDICATED_ENDPOINTS: JSON.stringify({
      allam: "https://allam.endpoints.example",
      falcon_h1: { endpoint: "https://falcon.endpoints.example", task: "chat-completion" },
      bimedix2_bi: { endpoint: "https://bimedix-bi.endpoints.example", task: "chat-completion" },
      bimedix2_hf: { endpoint: "https://bimedix-hf.endpoints.example", task: "completion" },
      medgemma_4b: { endpoint: "https://medgemma.endpoints.example", task: "chat-completion" },
      biomistral_7b: { endpoint: "https://biomistral.endpoints.example", task: "completion" },
    }),
  };
}

test("OpenRouter keys support newline, JSON-array, and bullet-list secrets", () => {
  assert.deepEqual(splitKeys("sk-one\nsk-two\nsk-three"), ["sk-one", "sk-two", "sk-three"]);
  assert.deepEqual(splitKeys('["sk-one", "sk-two"]'), ["sk-one", "sk-two"]);
  assert.deepEqual(splitKeys("- sk-one\n- sk-two\n- sk-one"), ["sk-one", "sk-two"]);
});

test("Gemma rotates through every newline-separated OpenRouter key on 429", async () => {
  const originalFetch = globalThis.fetch;
  const attemptedKeys = [];
  globalThis.fetch = async (_url, options = {}) => {
    attemptedKeys.push(options.headers.Authorization);
    if (attemptedKeys.length < 3) {
      return new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 });
  };

  try {
    const result = await callModel(
      { OPENROUTER_API_KEYS: "sk-first\nsk-second\nsk-third" },
      { provider: "openrouter", model: "google/gemma-4-31b-it" },
      { chatMessages: [{ role: "user", content: "test" }], maxTokens: 2 },
    );
    assert.equal(result, "OK");
    assert.equal(new Set(attemptedKeys).size, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("hidden models are omitted from the public registry", async () => {
  const configured = publicModelRegistry(testEnv());
  for (const key of ["allam", "falcon_h1", "bimedix2_bi", "bimedix2_hf", "medgemma_4b", "biomistral_7b"]) {
    assert.equal(configured[key], undefined, key);
  }
  assert.equal(configured.openbiollm_8b, undefined);
  assert.equal(configured.med42_8b.available, true);
  assert.equal(configured.jsl_medllama_8b.available, true);

  await assert.rejects(
    () => runGeneration(testEnv(), {
      transcript: sourceTranscript,
      inputName: "context-test.txt",
      modelKey: "openbiollm_8b",
    }),
    /not available/,
  );
});

test("dedicated HF endpoint mappings do not unmask hidden models", () => {
  const configured = publicModelRegistry(testEnv());
  for (const key of ["allam", "falcon_h1", "bimedix2_bi", "bimedix2_hf", "medgemma_4b", "biomistral_7b"]) {
    assert.equal(configured[key], undefined, key);
  }
});

test("every model route includes the session content used for generation", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url, options = {}) => {
    const body = JSON.parse(options.body || "{}");
    const serialized = JSON.stringify(body);
    requests.push({ url: String(url), body, serialized });

    const isTranslation = String(url).includes("api.fanar.qa") && serialized.includes("Translate the Arabic transcript");
    const content = isTranslation ? translatedTranscript : soapOutput;
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    for (const [modelKey, config] of Object.entries(MODEL_REGISTRY).filter(([, item]) => !item.hidden)) {
      requests.length = 0;
      const result = await runGeneration(testEnv(), {
        transcript: sourceTranscript,
        inputName: "context-test.txt",
        modelKey,
      });

      const modelRequest = requests.at(-1);
      const expectedContext = config.translate_with_fanar ? translatedTranscript : sourceTranscript;
      assert.ok(modelRequest.serialized.includes(expectedContext), `${modelKey} omitted its expected session context`);
      assert.equal(result.outputJson.metadata.source_character_count, sourceTranscript.length, modelKey);
      assert.equal(result.outputJson.metadata.model_input_character_count, expectedContext.length, modelKey);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("explicit translation returns the full Fanar output with source audit data", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = null;
  globalThis.fetch = async (_url, options = {}) => {
    requestBody = JSON.parse(options.body || "{}");
    return new Response(JSON.stringify({ choices: [{ message: { content: translatedTranscript } }] }), { status: 200 });
  };

  try {
    const result = await runTranslation(testEnv(), sourceTranscript, "translation-test.txt");
    assert.ok(JSON.stringify(requestBody).includes(sourceTranscript));
    assert.equal(result.text, translatedTranscript);
    assert.equal(result.source_character_count, sourceTranscript.length);
    assert.equal(result.translation_character_count, translatedTranscript.length);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reviewed translation is reused without a second Fanar request", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), body: JSON.parse(options.body || "{}") });
    return new Response(JSON.stringify({ choices: [{ message: { content: soapOutput } }] }), { status: 200 });
  };

  try {
    const result = await runGeneration(testEnv(), {
      transcript: sourceTranscript,
      inputName: "reuse-test.txt",
      modelKey: "gpt4_1",
      pretranslatedTranscript: translatedTranscript,
      translationSourceSha256: createHash("sha256").update(sourceTranscript).digest("hex"),
    });
    assert.equal(requests.length, 1);
    assert.ok(requests[0].url.includes("azure.example"));
    assert.ok(JSON.stringify(requests[0].body).includes(translatedTranscript));
    assert.equal(result.outputJson.metadata.reused_pretranslated_input, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("history deletion is scoped to the signed-in expert", async () => {
  const observed = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            observed.push({ sql, args });
            return {
              async run() {
                return { meta: { changes: args[0] === "generation-1" && args[1] === "expert-a" ? 1 : 0 } };
              },
            };
          },
        };
      },
    },
  };

  assert.equal(await deleteHistoryItem(env, "expert-a", "generation-1"), true);
  assert.equal(await deleteHistoryItem(env, "expert-b", "generation-1"), false);
  assert.match(observed[0].sql, /WHERE id = \? AND expert_uid = \?/);
  assert.deepEqual(observed[0].args, ["generation-1", "expert-a"]);
});
