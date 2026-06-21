const JSON_HEADERS = { "Content-Type": "application/json" };
const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_ACCESS_CODE_HASH = "a7f5fbabd1624ba763ed037a9b3ed7289cda4e739b06be222f6d3589cdba8a87";

const FANAR_CHAT_URL = "https://api.fanar.qa/v1/chat/completions";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

const ARABIC_RE = /[\u0600-\u06ff]/;

const MODEL_REGISTRY = {
  fanar2: {
    provider: "fanar",
    model: "Fanar",
    display_model: "Fanar-C-2-27B",
    translate_with_fanar: false,
    system_prompt: "You are a careful Arabic-English clinical documentation assistant. Produce faithful SOAP notes from the provided transcript only.",
  },
  allam: {
    provider: "hf",
    model: "humain-ai/ALLaM-7B-Instruct-preview",
    translate_with_fanar: false,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
    system_prompt: "You are a careful Arabic-English clinical documentation assistant. Produce faithful SOAP notes from the provided transcript only.",
  },
  acegpt: {
    provider: "hf",
    model: "FreedomIntelligence/AceGPT-v2-8B-Chat:featherless-ai",
    hf_task: "text-generation",
    translate_with_fanar: false,
    system_prompt: "You are a careful Arabic-English clinical documentation assistant. Produce faithful SOAP notes from the provided transcript only.",
  },
  falcon_h1: {
    provider: "hf",
    model: "tiiuae/Falcon-H1-3B-Instruct",
    translate_with_fanar: false,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
    system_prompt: "You are a careful multilingual clinical documentation assistant. Produce faithful SOAP notes from the provided transcript only.",
  },
  gemma4: {
    provider: "openrouter",
    model: "google/gemma-4-31b-it:free",
    translate_with_fanar: false,
    system_prompt: "You are a careful multilingual clinical documentation assistant. Produce faithful SOAP notes from the provided transcript only.",
  },
  bimedix2_bi: {
    provider: "hf",
    model: "MBZUAI/BiMediX2-8B-Bi",
    translate_with_fanar: false,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
    system_prompt: "You are a careful bilingual Arabic-English medical documentation assistant. Produce faithful clinical notes from the provided transcript only.",
  },
  bimedix2_hf: {
    provider: "hf",
    model: "MBZUAI/BiMediX2-8B-hf",
    translate_with_fanar: true,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
    system_prompt: "You are a careful medical documentation assistant. Produce faithful clinical notes from the provided transcript only.",
  },
  medgemma_4b: {
    provider: "hf",
    model: "google/medgemma-4b-it",
    translate_with_fanar: true,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
    system_prompt: "You are a careful medical documentation assistant. Produce faithful clinical notes from the provided transcript only.",
  },
  openbiollm_8b: {
    provider: "hf",
    model: "aaditya/Llama3-OpenBioLLM-8B:featherless-ai",
    hf_task: "text-generation",
    translate_with_fanar: true,
    system_prompt: "You are an expert healthcare and biomedical assistant. Use precise medical terminology while staying faithful to the transcript.",
  },
  med42_8b: {
    provider: "hf",
    model: "m42-health/Llama3-Med42-8B:featherless-ai",
    hf_task: "chat-completion",
    translate_with_fanar: true,
    system_prompt:
      "You are a helpful, respectful and honest medical assistant. Produce faithful clinical documentation from the provided transcript only. If information is missing, do not invent it.",
  },
  biomistral_7b: {
    provider: "hf",
    model: "BioMistral/BioMistral-7B",
    translate_with_fanar: true,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
    system_prompt: "You are a careful biomedical documentation assistant. Produce faithful clinical notes from the provided transcript only.",
  },
  jsl_medllama_8b: {
    provider: "hf",
    model: "johnsnowlabs/JSL-MedLlama-3-8B-v2.0:featherless-ai",
    hf_task: "text-generation",
    translate_with_fanar: true,
    system_prompt: "You are a careful medical documentation assistant. Produce faithful clinical notes from the provided transcript only.",
  },
  gpt4_1: {
    provider: "openrouter",
    model: "openai/gpt-4.1",
    translate_with_fanar: true,
    system_prompt: "You are a careful medical documentation assistant. Produce faithful clinical notes from the provided transcript only.",
  },
  deepseek_v32: {
    provider: "openrouter",
    model: "deepseek/deepseek-v3.2",
    translate_with_fanar: true,
    system_prompt: "You are a careful medical documentation assistant. Produce faithful clinical notes from the provided transcript only.",
  },
  llama_33_70b: {
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct",
    translate_with_fanar: true,
    system_prompt: "You are a careful medical documentation assistant. Produce faithful clinical notes from the provided transcript only.",
  },
};

const SOAP_TEMPLATE = {
  conversation_summary: "",
  medical_notes_soap: {
    subjective: {
      chief_complaint_or_reason_for_visit: "",
      history_of_present_issue: {
        onset_or_duration: "",
        course_or_progression: "",
        triggers_or_stressors: [],
        associated_symptoms_or_experiences: [],
        functional_impact: "",
      },
      reported_symptoms_or_experiences: [],
      patient_goals_or_requests: [],
      relevant_personal_social_family_context: [],
      medications_substances_or_treatments_mentioned: [],
      patient_quotes_translated_to_english: [],
    },
    objective: {
      observations_from_session: [],
      mental_status_or_clinical_observations_if_present: {
        appearance_behavior: "",
        speech: "",
        mood_affect: "",
        thought_process_content: "",
        orientation_cognition: "",
        insight_judgment: "",
      },
      tests_scales_or_measurements_mentioned: [],
    },
    assessment: {
      clinical_impression_summary: "",
      possible_diagnoses_or_conditions_mentioned: [],
      severity_or_functional_impact_if_present: "",
      risk_assessment_if_present: {
        risk_or_safety_discussed: false,
        risk_type: [],
        details: "",
        protective_factors_if_present: [],
      },
      strengths_or_resources_if_present: [],
      uncertainties_or_missing_information: [],
    },
    plan: {
      interventions_discussed_or_provided: [],
      homework_or_between_session_tasks: [],
      follow_up_plan: "",
      referrals_or_escalation_if_present: [],
      patient_education_or_advice_given: [],
      items_to_monitor: [],
      documentation_caution: "Generated from a transcript by an LLM; must be reviewed and corrected by a qualified human clinician.",
    },
  },
  metadata: {
    source_file: "uploaded_transcript.txt",
    language_of_source: "Arabic",
    output_language: "English",
    note: "Generated by an LLM from a simulated transcript; requires human clinical review.",
  },
};

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function corsHeaders(env, origin) {
  const allowed = allowedOrigins(env);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    ...JSON_HEADERS,
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(payload, status = 200, headers = JSON_HEADERS) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function cleanText(value, max = 500) {
  const text = String(value ?? "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function base64UrlEncode(bytes) {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64Json(obj) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

function fromB64Json(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

async function makeToken(env, payload) {
  const body = b64Json(payload);
  const signature = await hmacSign(env.TOKEN_SECRET || "local-dev-secret", body);
  return `${body}.${signature}`;
}

async function verifyToken(env, token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) throw new Error("Bad token");
  const expected = await hmacSign(env.TOKEN_SECRET || "local-dev-secret", body);
  if (signature !== expected) throw new Error("Bad token");
  const payload = fromB64Json(body);
  if (payload.exp && Date.now() > payload.exp) throw new Error("Expired token");
  return payload;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function makeExpertUid(email) {
  return `E-${(await sha256Hex(String(email || "").trim().toLowerCase())).slice(0, 12)}`;
}

function accessCodeHashes(env) {
  const configured = String(env.ACCESS_CODE_HASHES || env.ACCESS_CODE_HASH || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length) return configured;
  if (String(env.ALLOW_DEFAULT_ACCESS_CODE || "") === "1") return [DEFAULT_ACCESS_CODE_HASH];
  return [];
}

async function requireAccessCode(env, accessCode) {
  const code = String(accessCode || "").trim();
  if (!code) throw new Error("Missing access code");
  const hashes = accessCodeHashes(env);
  if (!hashes.length) throw new Error("Access code is not configured");
  const hash = await sha256Hex(code);
  if (!hashes.includes(hash)) throw new Error("Invalid access code");
}

async function upsertExpert(env, email) {
  if (!env.DB) throw new Error("D1 database is not configured");
  const now = new Date().toISOString();
  const expertUid = await makeExpertUid(email);

  await env.DB
    .prepare(
      `INSERT INTO experts (expert_uid, email, created_at, last_seen_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET last_seen_at=excluded.last_seen_at`,
    )
    .bind(expertUid, email, now, now)
    .run();

  return expertUid;
}

function containsArabic(text) {
  return ARABIC_RE.test(String(text || ""));
}

function resolveModel(modelKey) {
  const key = cleanText(modelKey, 80);
  const config = MODEL_REGISTRY[key];
  if (!config) throw new Error(`Unknown model: ${modelKey}`);
  if (config.disabled_reason) throw new Error(config.disabled_reason);
  return [key, config];
}

function buildTranslationPrompt(transcript, sourceFile) {
  return `
You are an Arabic-to-English translator for clinical/therapy transcripts.

Task:
Translate the Arabic transcript below into English.

Strict rules:
- Output the translated transcript only.
- Preserve the order of speaker turns.
- Preserve clinically relevant details, emotions, stressors, and next steps.
- Do not summarize.
- Do not add facts that are not in the transcript.
- If a phrase is unclear, translate the best readable meaning without inventing.

Source file: ${sourceFile}

Arabic transcript:

${transcript}
`.trim();
}

function buildSoapPrompt(transcript, sourceFile, transcriptLanguage) {
  const template = structuredClone(SOAP_TEMPLATE);
  template.metadata.source_file = sourceFile;
  template.metadata.language_of_source = transcriptLanguage;
  const schemaText = JSON.stringify(template, null, 2);

  return `
You are a clinical documentation assistant.

TRANSCRIPT_START
${transcript}
TRANSCRIPT_END

Task:
Read the ${transcriptLanguage} transcript above and fill the JSON template below.

Strict JSON rules:
- Return JSON only. No markdown. No explanation.
- The answer must start with { and end with }.
- Keep exactly the same keys as the template.
- Write all values in English, even when the transcript is Arabic.
- Use only facts from the transcript.
- Missing string fields: "Not mentioned".
- Missing list fields: [].
- Every list must contain at most 5 unique items unless the field explicitly requires more.
- For patient_quotes_translated_to_english, include at most 5 unique short quotes. Do not repeat quotes.
- Do not diagnose unless explicitly mentioned.
- Safety/risk fields only if explicitly discussed.
- Use valid JSON syntax only. Use ASCII double quotes " and ASCII comma ,.
- Never use the Arabic comma ، as a JSON separator.

JSON template:
${schemaText}
`.trim();
}

function messages(prompt, systemPrompt = "") {
  const list = [];
  if (systemPrompt.trim()) list.push({ role: "system", content: systemPrompt.trim() });
  list.push({ role: "user", content: prompt });
  return list;
}

function chatPayload({ model, chatMessages, maxTokens, temperature, jsonMode }) {
  const payload = {
    model,
    messages: chatMessages,
    max_tokens: maxTokens,
    temperature,
    stream: false,
  };
  if (jsonMode) payload.response_format = { type: "json_object" };
  return payload;
}

function splitKeys(value) {
  if (!value) return [];
  return String(value)
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitModelProvider(model, defaultProvider = "") {
  const index = String(model).lastIndexOf(":");
  if (index === -1) return [model, defaultProvider];
  return [model.slice(0, index), model.slice(index + 1)];
}

function flattenMessagesForCompletion(chatMessages) {
  return `${chatMessages.map((message) => `${String(message.role || "user").toUpperCase()}:\n${message.content || ""}`).join("\n\n")}\n\nASSISTANT:`;
}

function parseLooseJson(text, label) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    if (start !== -1) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = start; i < raw.length; i += 1) {
        const char = raw[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
          continue;
        }
        if (char === '"') inString = true;
        else if (char === "{") depth += 1;
        else if (char === "}") {
          depth -= 1;
          if (depth === 0) return JSON.parse(raw.slice(start, i + 1));
        }
      }
    }
    throw new Error(`${label} returned non-JSON content: ${raw.slice(0, 500)}`);
  }
}

async function fetchJson(url, options, label) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${label} HTTP ${response.status}: ${text.slice(0, 700)}`);
  }
  return parseLooseJson(text, label);
}

function extractChatContent(payload, label) {
  const choice = payload?.choices?.[0];
  if (!choice) throw new Error(`${label} returned no choices`);
  const content = choice.message?.content ?? choice.text ?? "";
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === "string" ? item : item?.text || ""))
      .join("")
      .trim();
  }
  const text = String(content || "").trim();
  if (!text) throw new Error(`${label} returned empty content`);
  return text;
}

function responseFormatUnsupported(error) {
  const text = String(error?.message || "").toLowerCase();
  return text.includes("response_format") || text.includes("json_object") || text.includes("json schema");
}

function openRouterKeyError(error) {
  const text = String(error?.message || "").toLowerCase();
  return /http (401|402|403|429)/.test(text) || ["rate limit", "quota", "credit", "insufficient", "exhausted", "usage limit"].some((needle) => text.includes(needle));
}

async function callFanar(env, { model, chatMessages, maxTokens = 2048, temperature = 0, jsonMode = false }) {
  if (!env.FANAR_API) throw new Error("FANAR_API Worker secret is missing");
  const headers = {
    Authorization: `Bearer ${env.FANAR_API}`,
    "Content-Type": "application/json",
  };
  const payload = chatPayload({ model, chatMessages, maxTokens, temperature, jsonMode });
  try {
    const data = await fetchJson(FANAR_CHAT_URL, { method: "POST", headers, body: JSON.stringify(payload) }, "Fanar");
    return extractChatContent(data, "Fanar");
  } catch (error) {
    if (jsonMode && responseFormatUnsupported(error)) {
      delete payload.response_format;
      const data = await fetchJson(FANAR_CHAT_URL, { method: "POST", headers, body: JSON.stringify(payload) }, "Fanar");
      return extractChatContent(data, "Fanar");
    }
    throw error;
  }
}

async function callOpenRouter(env, { model, chatMessages, maxTokens = 2048, temperature = 0, jsonMode = false }) {
  const keys = splitKeys(env.OPENROUTER_API_KEYS || env.API_KEYS);
  if (!keys.length) throw new Error("API_KEYS or OPENROUTER_API_KEYS Worker secret is missing");

  const payload = chatPayload({ model, chatMessages, maxTokens, temperature, jsonMode });
  const start = crypto.getRandomValues(new Uint32Array(1))[0] % keys.length;
  let lastError = null;

  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const key = keys[(start + attempt) % keys.length];
    const headers = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://saif-daoud.github.io/sakinaai-demo/",
      "X-OpenRouter-Title": "SakinaAI Demo",
    };

    try {
      const data = await fetchJson(OPENROUTER_CHAT_URL, { method: "POST", headers, body: JSON.stringify(payload) }, "OpenRouter");
      return extractChatContent(data, "OpenRouter");
    } catch (error) {
      if (jsonMode && responseFormatUnsupported(error)) {
        const retryPayload = { ...payload };
        delete retryPayload.response_format;
        const data = await fetchJson(OPENROUTER_CHAT_URL, { method: "POST", headers, body: JSON.stringify(retryPayload) }, "OpenRouter");
        return extractChatContent(data, "OpenRouter");
      }

      if (openRouterKeyError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw new Error(`All configured OpenRouter API keys failed or are exhausted. Last error: ${lastError?.message || "unknown"}`);
}

async function callHf(env, { model, chatMessages, maxTokens = 2048, temperature = 0, jsonMode = false, hfTask = "chat-completion" }) {
  if (!env.HF_API) throw new Error("HF_API Worker secret is missing");
  if (["text-generation", "completion", "completions"].includes(hfTask)) {
    return callHfCompletion(env, { model, chatMessages, maxTokens, temperature });
  }

  const headers = {
    Authorization: `Bearer ${env.HF_API}`,
    "Content-Type": "application/json",
  };
  const payload = chatPayload({ model, chatMessages, maxTokens, temperature, jsonMode });
  try {
    const data = await fetchJson(HF_CHAT_URL, { method: "POST", headers, body: JSON.stringify(payload) }, "Hugging Face");
    return extractChatContent(data, "Hugging Face");
  } catch (error) {
    if (jsonMode && responseFormatUnsupported(error)) {
      delete payload.response_format;
      const data = await fetchJson(HF_CHAT_URL, { method: "POST", headers, body: JSON.stringify(payload) }, "Hugging Face");
      return extractChatContent(data, "Hugging Face");
    }
    throw error;
  }
}

async function callHfCompletion(env, { model, chatMessages, maxTokens = 2048, temperature = 0 }) {
  const [baseModel, provider] = splitModelProvider(model, env.HF_TEXT_GENERATION_PROVIDER || "");
  if (!provider) throw new Error(`HF text-generation model '${model}' needs a provider suffix`);

  const headers = {
    Authorization: `Bearer ${env.HF_API}`,
    "Content-Type": "application/json",
  };
  const payload = {
    model: baseModel,
    prompt: flattenMessagesForCompletion(chatMessages),
    max_tokens: maxTokens,
    temperature,
    stream: false,
  };
  const data = await fetchJson(`https://router.huggingface.co/${provider}/v1/completions`, { method: "POST", headers, body: JSON.stringify(payload) }, "Hugging Face completion");
  return extractChatContent(data, "Hugging Face completion");
}

async function callModel(env, config, { chatMessages, maxTokens, temperature = 0, jsonMode = false }) {
  if (config.provider === "fanar") {
    return callFanar(env, { model: env.FANAR_MODEL || config.model, chatMessages, maxTokens, temperature, jsonMode });
  }
  if (config.provider === "openrouter") {
    return callOpenRouter(env, { model: config.model, chatMessages, maxTokens, temperature, jsonMode });
  }
  if (config.provider === "hf") {
    return callHf(env, { model: config.model, chatMessages, maxTokens, temperature, jsonMode, hfTask: config.hf_task || "chat-completion" });
  }
  throw new Error(`Unsupported provider: ${config.provider}`);
}

async function translateWithFanar(env, transcript, sourceFile) {
  const prompt = buildTranslationPrompt(transcript, sourceFile);
  return callFanar(env, {
    model: env.FANAR_TRANSLATION_MODEL || "Fanar",
    chatMessages: messages(prompt, "You are a faithful clinical Arabic-to-English translator."),
    maxTokens: Number(env.TRANSLATION_MAX_TOKENS || 4096),
    temperature: 0,
    jsonMode: false,
  });
}

function repairCommonJsonPunctuation(text) {
  return String(text || "")
    .replace(/("|\]|\}|\btrue\b|\bfalse\b|\bnull\b|\d)\s*\u060c\s*(?=("|\{|\[|\]|\}|\btrue\b|\bfalse\b|\bnull\b|-?\d))/g, "$1, ")
    .replace(/("|\]|\}|\btrue\b|\bfalse\b|\bnull\b|\d)\s*\u061b\s*(?=("|\{|\[|\]|\}|\btrue\b|\bfalse\b|\bnull\b|-?\d))/g, "$1, ");
}

function extractJsonObject(text) {
  let cleaned = String(text || "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  cleaned = repairCommonJsonPunctuation(cleaned);
  return parseLooseJson(cleaned, "Model output");
}

async function runGeneration(env, { transcript, inputName, modelKey }) {
  const [resolvedKey, config] = resolveModel(modelKey);
  const sourceFile = cleanText(inputName || "uploaded_transcript.txt", 260) || "uploaded_transcript.txt";
  const originalHasArabic = containsArabic(transcript);
  const translatedWithFanar = Boolean(config.translate_with_fanar && originalHasArabic);
  const modelInput = translatedWithFanar ? await translateWithFanar(env, transcript, sourceFile) : transcript;
  const transcriptLanguage = translatedWithFanar ? "English" : originalHasArabic ? "Arabic" : "English";
  const prompt = buildSoapPrompt(modelInput, sourceFile, transcriptLanguage);
  const rawOutput = await callModel(env, config, {
    chatMessages: messages(prompt, config.system_prompt || ""),
    maxTokens: Number(env.SOAP_MAX_TOKENS || 4096),
    temperature: Number(env.SOAP_TEMPERATURE || 0),
    jsonMode: true,
  });

  const parsed = extractJsonObject(rawOutput);
  parsed.metadata = {
    ...(parsed.metadata || {}),
    source_file: sourceFile,
    language_of_source: transcriptLanguage,
    output_language: "English",
    model_key: resolvedKey,
    model_name: config.model,
    provider: config.provider,
    translated_with_fanar: translatedWithFanar,
    note: "Generated by an LLM from a simulated transcript; requires human clinical review.",
  };

  return {
    modelKey: resolvedKey,
    provider: config.provider,
    modelName: config.model,
    inputLanguage: transcriptLanguage,
    translatedTranscript: translatedWithFanar ? modelInput : "",
    translatedWithFanar,
    outputJson: parsed,
    rawOutput,
  };
}

async function insertGeneration(env, row) {
  await env.DB
    .prepare(
      `INSERT INTO generations (
        id, expert_uid, expert_email, model_key, provider, model_name, input_name,
        input_language, transcript_text, translated_transcript, translated_with_fanar,
        output_json, raw_output, status, error, user_agent, page_url, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.expert_uid,
      row.expert_email,
      row.model_key,
      row.provider,
      row.model_name,
      row.input_name,
      row.input_language,
      row.transcript_text,
      row.translated_transcript,
      row.translated_with_fanar ? 1 : 0,
      row.output_json,
      row.raw_output,
      row.status,
      row.error,
      row.user_agent,
      row.page_url,
      row.created_at,
      row.completed_at,
    )
    .run();
}

function clientGeneration(row) {
  return {
    id: row.id,
    model_key: row.model_key,
    provider: row.provider,
    model_name: row.model_name,
    input_name: row.input_name,
    input_language: row.input_language,
    transcript_text: row.transcript_text,
    translated_transcript: row.translated_transcript,
    translated_with_fanar: Boolean(row.translated_with_fanar),
    output_json: typeof row.output_json === "string" && row.output_json ? JSON.parse(row.output_json) : row.output_json,
    raw_output: row.raw_output,
    status: row.status,
    error: row.error,
    created_at: row.created_at,
    completed_at: row.completed_at,
  };
}

async function listHistory(env, expertUid) {
  const rows = await env.DB
    .prepare(
      `SELECT id, expert_uid, expert_email, model_key, provider, model_name,
        input_name, input_language, transcript_text, translated_transcript,
        translated_with_fanar, output_json, raw_output, status, error,
        created_at, completed_at
       FROM generations
       WHERE expert_uid = ?
       ORDER BY created_at DESC
       LIMIT 30`,
    )
    .bind(expertUid)
    .all();
  return (rows?.results || []).map((row) => ({
    ...row,
    translated_with_fanar: Boolean(row.translated_with_fanar),
  }));
}

async function stats(env) {
  const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM generations").first();
  const completed = await env.DB.prepare("SELECT COUNT(*) AS n FROM generations WHERE status = 'completed'").first();
  const experts = await env.DB.prepare("SELECT COUNT(*) AS n FROM experts").first();
  const byModel = await env.DB.prepare("SELECT model_key, status, COUNT(*) AS n FROM generations GROUP BY model_key, status ORDER BY model_key").all();
  return {
    total_generations: Number(total?.n || 0),
    completed_generations: Number(completed?.n || 0),
    experts: Number(experts?.n || 0),
    by_model: byModel?.results || [],
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(env, origin);
    const allowed = allowedOrigins(env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (allowed.length && origin && !allowed.includes(origin)) return json({ error: "Origin not allowed" }, 403, headers);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);

    const path = new URL(request.url).pathname;
    const body = await request.json().catch(() => ({}));

    try {
      if (path.endsWith("/api/access")) {
        const email = cleanText(body.email, 320).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
        await requireAccessCode(env, body.access_code);
        const expertUid = await upsertExpert(env, email);
        const token = await makeToken(env, { expert_uid: expertUid, email, exp: Date.now() + TOKEN_TTL_MS });
        return json({ ok: true, expert_id: expertUid, email, token }, 200, headers);
      }

      if (path.endsWith("/api/models")) {
        const payload = await verifyToken(env, body.token);
        return json({ ok: true, expert_id: payload.expert_uid, models: MODEL_REGISTRY }, 200, headers);
      }

      if (path.endsWith("/api/history")) {
        const payload = await verifyToken(env, body.token);
        return json({ ok: true, generations: await listHistory(env, String(payload.expert_uid || "")) }, 200, headers);
      }

      if (path.endsWith("/api/stats")) {
        await verifyToken(env, body.token);
        return json({ ok: true, stats: await stats(env) }, 200, headers);
      }

      if (path.endsWith("/api/generate")) {
        const payload = await verifyToken(env, body.token);
        const transcript = cleanText(body.transcript, Number(env.MAX_TRANSCRIPT_CHARS || 120000));
        const inputName = cleanText(body.input_name || "uploaded_transcript.txt", 260);
        const pageUrl = cleanText(body.page_url, 1000);
        const generationId = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        if (!transcript) throw new Error("Transcript is empty");

        try {
          const result = await runGeneration(env, {
            transcript,
            inputName,
            modelKey: body.model_key,
          });
          const completedAt = new Date().toISOString();
          const row = {
            id: generationId,
            expert_uid: String(payload.expert_uid || ""),
            expert_email: String(payload.email || ""),
            model_key: result.modelKey,
            provider: result.provider,
            model_name: result.modelName,
            input_name: inputName,
            input_language: result.inputLanguage,
            transcript_text: transcript,
            translated_transcript: result.translatedTranscript || null,
            translated_with_fanar: result.translatedWithFanar,
            output_json: JSON.stringify(result.outputJson),
            raw_output: result.rawOutput,
            status: "completed",
            error: null,
            user_agent: cleanText(request.headers.get("user-agent"), 800),
            page_url: pageUrl,
            created_at: createdAt,
            completed_at: completedAt,
          };
          await insertGeneration(env, row);
          return json({ ok: true, generation: clientGeneration(row) }, 200, headers);
        } catch (error) {
          const modelKey = cleanText(body.model_key, 80);
          const config = MODEL_REGISTRY[modelKey] || {};
          const row = {
            id: generationId,
            expert_uid: String(payload.expert_uid || ""),
            expert_email: String(payload.email || ""),
            model_key: modelKey || "unknown",
            provider: config.provider || "unknown",
            model_name: config.model || "unknown",
            input_name: inputName,
            input_language: containsArabic(transcript) ? "Arabic" : "Unknown",
            transcript_text: transcript,
            translated_transcript: null,
            translated_with_fanar: false,
            output_json: null,
            raw_output: null,
            status: "failed",
            error: cleanText(error?.message || "Generation failed", 5000),
            user_agent: cleanText(request.headers.get("user-agent"), 800),
            page_url: pageUrl,
            created_at: createdAt,
            completed_at: new Date().toISOString(),
          };
          await insertGeneration(env, row);
          return json({ error: row.error, generation: clientGeneration(row) }, 500, headers);
        }
      }

      return json({ error: "Not found" }, 404, headers);
    } catch (error) {
      const message = error?.message || "Request failed";
      const status = ["Bad token", "Expired token"].includes(message) ? 401 : 400;
      return json({ error: message }, status, headers);
    }
  },
};
