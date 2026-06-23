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
  },
  allam: {
    provider: "hf",
    model: "humain-ai/ALLaM-7B-Instruct-preview",
    compact_default: true,
    translate_with_fanar: false,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
  },
  acegpt: {
    provider: "hf",
    model: "FreedomIntelligence/AceGPT-v2-8B-Chat:featherless-ai",
    hf_task: "text-generation",
    translate_with_fanar: false,
  },
  falcon_h1: {
    provider: "hf",
    model: "tiiuae/Falcon-H1-3B-Instruct",
    compact_default: true,
    translate_with_fanar: false,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
  },
  gemma4: {
    provider: "openrouter",
    model: "google/gemma-4-31b-it",
    compact_default: true,
    translate_with_fanar: false,
  },
  bimedix2_bi: {
    provider: "hf",
    model: "MBZUAI/BiMediX2-8B-Bi",
    compact_default: true,
    translate_with_fanar: false,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
    system_prompt: "You are a careful bilingual Arabic-English medical documentation assistant. Produce faithful clinical notes from the transcript only.",
  },
  bimedix2_hf: {
    provider: "hf",
    model: "MBZUAI/BiMediX2-8B-hf",
    compact_default: true,
    translate_with_fanar: true,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
    system_prompt: "You are a careful medical documentation assistant. Produce faithful clinical notes from the transcript only.",
  },
  medgemma_4b: {
    provider: "hf",
    model: "google/medgemma-4b-it",
    compact_default: true,
    translate_with_fanar: true,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
    system_prompt: "You are a careful medical documentation assistant. Produce faithful clinical notes from the transcript only.",
  },
  openbiollm_8b: {
    provider: "hf",
    model: "aaditya/Llama3-OpenBioLLM-8B:featherless-ai",
    hf_task: "text-generation",
    chat_template: "llama3_instruct",
    compact_default: true,
    translate_with_fanar: true,
    system_prompt: "You are an expert healthcare and biomedical assistant. Use precise medical terminology while staying faithful to the transcript.",
  },
  med42_8b: {
    provider: "hf",
    model: "m42-health/Llama3-Med42-8B:featherless-ai",
    hf_task: "chat-completion",
    chat_template: "llama3_instruct",
    compact_default: true,
    translate_with_fanar: true,
    system_prompt:
      "You are a helpful, respectful and honest medical assistant. Always answer as helpfully as possible while staying safe. For this task, produce faithful clinical documentation from the provided transcript only. If information is missing, do not invent it.",
  },
  biomistral_7b: {
    provider: "hf",
    model: "BioMistral/BioMistral-7B",
    compact_default: true,
    translate_with_fanar: true,
    disabled_reason: "The exact Hugging Face repo is not currently served by an enabled Inference Provider.",
    system_prompt: "You are a careful biomedical documentation assistant. Produce faithful clinical notes from the transcript only.",
  },
  jsl_medllama_8b: {
    provider: "hf",
    model: "johnsnowlabs/JSL-MedLlama-3-8B-v2.0:featherless-ai",
    hf_task: "text-generation",
    chat_template: "llama3_instruct",
    compact_default: true,
    translate_with_fanar: true,
    system_prompt: "You are a careful medical documentation assistant. Produce faithful clinical notes from the transcript only.",
  },
  gpt4_1: {
    provider: "azure",
    model: "gpt-4.1",
    min_smoke_tokens: 16,
    translate_with_fanar: true,
  },
  deepseek_v32: {
    provider: "openai_compatible",
    model: "DeepSeek-V3.2",
    translate_with_fanar: true,
  },
  llama_33_70b: {
    provider: "openai_compatible",
    model: "Llama-3.3-70B-Instruct",
    translate_with_fanar: true,
  },
};

const JSON_SCHEMA_EXAMPLE = {
  conversation_summary:
    "Plain-text English summary of the conversation in 1 to 2 concise paragraphs. Include the reason for the visit, main concerns, clinically relevant context, what the clinician did, and any agreed next steps. Do not use bullet points here.",
  medical_notes_soap: {
    subjective: {
      chief_complaint_or_reason_for_visit: "Patient/client's main stated reason for the visit, in English. Use 'Not mentioned' if absent.",
      history_of_present_issue: {
        onset_or_duration: "When the issue started or how long it has been present. Use 'Not mentioned' if absent.",
        course_or_progression: "Whether symptoms improved, worsened, fluctuated, etc. Use 'Not mentioned' if absent.",
        triggers_or_stressors: ["Only explicitly mentioned triggers/stressors; otherwise empty list."],
        associated_symptoms_or_experiences: ["Symptoms/experiences reported by the patient/client."],
        functional_impact: "Impact on sleep, study, work, relationships, daily life, etc. Use 'Not mentioned' if absent.",
      },
      reported_symptoms_or_experiences: ["symptom or experience 1"],
      patient_goals_or_requests: ["goal or request 1"],
      relevant_personal_social_family_context: ["Only explicitly mentioned context; otherwise empty list."],
      medications_substances_or_treatments_mentioned: ["Only if mentioned; otherwise empty list."],
      patient_quotes_translated_to_english: ["Short translated quote if useful and explicitly present."],
    },
    objective: {
      observations_from_session: [
        "Observable behavior, affect, speech, engagement, or clinician-observed information only. Do not infer beyond the transcript.",
      ],
      mental_status_or_clinical_observations_if_present: {
        appearance_behavior: "Only if present; otherwise Not mentioned.",
        speech: "Only if present; otherwise Not mentioned.",
        mood_affect: "Only if present; otherwise Not mentioned.",
        thought_process_content: "Only if present; otherwise Not mentioned.",
        orientation_cognition: "Only if present; otherwise Not mentioned.",
        insight_judgment: "Only if present; otherwise Not mentioned.",
      },
      tests_scales_or_measurements_mentioned: ["Only if mentioned; otherwise empty list."],
    },
    assessment: {
      clinical_impression_summary: "Brief clinical impression supported only by the transcript. Do not invent diagnoses or clinical labels.",
      possible_diagnoses_or_conditions_mentioned: [
        "Only diagnoses/conditions explicitly mentioned in the transcript; otherwise empty list.",
      ],
      severity_or_functional_impact_if_present: "Only if supported by transcript; otherwise Not mentioned.",
      risk_assessment_if_present: {
        risk_or_safety_discussed: false,
        risk_type: ["Only explicitly discussed risk types; otherwise empty list."],
        details: "Only include details if explicitly present. Otherwise write: Not mentioned.",
        protective_factors_if_present: ["Only if mentioned; otherwise empty list."],
      },
      strengths_or_resources_if_present: ["Only if mentioned; otherwise empty list."],
      uncertainties_or_missing_information: ["Important missing information that would be needed for a real clinical note."],
    },
    plan: {
      interventions_discussed_or_provided: ["intervention 1"],
      homework_or_between_session_tasks: ["homework 1, only if explicitly mentioned"],
      follow_up_plan: "Follow-up timing or next steps if mentioned; otherwise Not mentioned.",
      referrals_or_escalation_if_present: ["Only if mentioned; otherwise empty list."],
      patient_education_or_advice_given: ["advice 1"],
      items_to_monitor: ["item 1"],
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

function buildEmptyJsonTemplate(sourceFile, sourceLanguage) {
  return {
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
      source_file: sourceFile,
      language_of_source: sourceLanguage,
      output_language: "English",
      note: "Generated by an LLM from a simulated transcript; requires human clinical review.",
    },
  };
}

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

function tokenSecret(env) {
  const secret = String(env.TOKEN_SECRET || "");
  if (secret) return secret;
  if (String(env.ALLOW_DEFAULT_TOKEN_SECRET || "") === "1") return "local-dev-secret";
  throw new Error("TOKEN_SECRET is not configured");
}

async function makeToken(env, payload) {
  const body = b64Json(payload);
  const signature = await hmacSign(tokenSecret(env), body);
  return `${body}.${signature}`;
}

async function verifyToken(env, token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) throw new Error("Bad token");
  const expected = await hmacSign(tokenSecret(env), body);
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

function parseDedicatedHfRoutes(env) {
  const raw = String(env.HF_DEDICATED_ENDPOINTS || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error("HF_DEDICATED_ENDPOINTS must be a JSON object keyed by model key");
  }
}

function dedicatedHfRoute(env, modelKey) {
  const value = parseDedicatedHfRoutes(env)[modelKey];
  if (!value) return null;
  if (typeof value === "string") return { endpoint: value };
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const endpoint = String(value.endpoint || value.url || "").trim();
  return endpoint
    ? {
        endpoint,
        model: String(value.model || "").trim(),
        task: String(value.task || "").trim(),
      }
    : null;
}

function providerLabel(provider) {
  return {
    fanar: "Fanar API",
    openrouter: "OpenRouter",
    hf: "Hugging Face",
    hf_dedicated: "Hugging Face Endpoint",
    azure: "Azure OpenAI",
    openai_compatible: "OpenAI",
  }[provider] || provider;
}

function publicModelRegistry(env) {
  return Object.fromEntries(
    Object.entries(MODEL_REGISTRY).map(([key, config]) => {
      const dedicated = config.disabled_reason ? dedicatedHfRoute(env, key) : null;
      const provider = dedicated ? "hf_dedicated" : config.provider;
      const dedicatedHasCredentials = Boolean(String(env.HF_DEDICATED_API_KEY || env.HF_API || "").trim());
      const dedicatedAvailable = Boolean(dedicated && dedicatedHasCredentials);
      return [
        key,
        {
          available: !config.disabled_reason || dedicatedAvailable,
          provider,
          provider_label: providerLabel(provider),
          unavailable_reason: dedicatedAvailable
            ? ""
            : dedicated && !dedicatedHasCredentials
              ? "A dedicated endpoint is configured, but HF_DEDICATED_API_KEY/HF_API is missing."
              : config.disabled_reason || "",
        },
      ];
    }),
  );
}

function resolveModel(modelKey, env) {
  const key = cleanText(modelKey, 80);
  const config = MODEL_REGISTRY[key];
  if (!config) throw new Error(`Unknown model: ${modelKey}`);
  if (config.disabled_reason) {
    const dedicated = dedicatedHfRoute(env, key);
    if (!dedicated) throw new Error(config.disabled_reason);
    return [
      key,
      {
        ...config,
        provider: "hf_dedicated",
        model: dedicated.model || config.model,
        endpoint: dedicated.endpoint,
        hf_task: dedicated.task || config.hf_task || "chat-completion",
        disabled_reason: undefined,
      },
    ];
  }
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

function buildSoapPrompt(transcript, sourceFile, transcriptLanguage = "Arabic", compact = false) {
  transcriptLanguage = String(transcriptLanguage || "").trim() || "Arabic";

  if (compact) {
    const schemaText = JSON.stringify(buildEmptyJsonTemplate(sourceFile, transcriptLanguage), null, 2);
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

  const schemaText = JSON.stringify(JSON_SCHEMA_EXAMPLE, null, 2);

  return `
    You are a careful clinical documentation assistant.

    Task:
    Read the ${transcriptLanguage} transcript below and produce a structured JSON object in English.
    The JSON must contain:
    1. A clear English summary of the conversation.
    2. Medical/clinical notes using a SOAP template: Subjective, Objective, Assessment, Plan.

    Strict rules:
    - Read every turn between TRANSCRIPT_START and TRANSCRIPT_END before writing the note.
    - Output valid JSON only. Do not include markdown, comments, or extra text.
    - Use English in the output.
    - Do not invent facts that are not present in the transcript.
    - If information is missing, write "Not mentioned" or use an empty list [].
    - Do not make a definitive diagnosis unless the transcript explicitly states one.
    - Risk/safety information must only be included if explicitly mentioned in the transcript.
    - Use ASCII double quotes " and ASCII comma , for JSON syntax.
    - The note is for human clinician review, not a replacement for professional judgment.

    Use this exact JSON structure as the target schema:
    ${schemaText}

    Source file: ${sourceFile}

    ${transcriptLanguage} transcript (${transcript.length} characters):

    TRANSCRIPT_START
    ${transcript}
    TRANSCRIPT_END
    
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
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];

  const raw = String(value).trim();
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return splitKeys(parsed);
    } catch {
      // Fall through to newline/comma parsing for a hand-written list.
    }
  }

  return [...new Set(raw
    .split(/[\n,;]+/)
    .map((item) => item.trim().replace(/^[-*]\s+/, "").replace(/^["']|["']$/g, ""))
    .filter(Boolean))];
}

function splitModelProvider(model, defaultProvider = "") {
  const index = String(model).lastIndexOf(":");
  if (index === -1) return [model, defaultProvider];
  return [model.slice(0, index), model.slice(index + 1)];
}

function messageContentText(content) {
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === "string" ? item : item?.text || ""))
      .join("\n")
      .trim();
  }
  return String(content || "");
}

function llama3InstructPrompt(chatMessages) {
  return `${chatMessages
    .map((message) => {
      const role = ["system", "assistant"].includes(message.role) ? message.role : "user";
      const prefix = role === "system" ? "<|begin_of_text|>" : "";
      return `${prefix}<|start_header_id|>${role}<|end_header_id|>\n\n${messageContentText(message.content)}<|eot_id|>`;
    })
    .join("")}<|start_header_id|>assistant<|end_header_id|>\n\n`;
}

function flattenMessagesForCompletion(chatMessages, chatTemplate = "") {
  if (chatTemplate === "llama3_instruct") return llama3InstructPrompt(chatMessages);
  return `${chatMessages.map((message) => `${String(message.role || "user").toUpperCase()}:\n${messageContentText(message.content)}`).join("\n\n")}\n\nASSISTANT:`;
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

function expertFacingGenerationError(error) {
  const text = String(error?.message || "");
  const lower = text.toLowerCase();

  if (lower.includes("transcript is empty")) {
    return "Please add a transcript before generating the SOAP note.";
  }
  if (lower.includes("generation queue") || lower.includes("start the soap generation")) {
    return "We could not start the SOAP generation. Please try again.";
  }
  if (lower.includes("unknown model") || lower.includes("unsupported provider") || lower.includes("not currently served") || lower.includes("not available")) {
    return "This model is not available in the demo right now. Please choose another model.";
  }
  if (lower.includes("model output") || lower.includes("non-json") || lower.includes("json")) {
    return "The selected model did not produce a complete SOAP note. Please try again, or choose another model.";
  }
  if (lower.includes("fanar") || lower.includes("translation")) {
    return "The transcript could not be translated right now. Please try again, or choose a model that accepts Arabic directly.";
  }
  if (lower.includes("rate limit") || lower.includes("quota") || lower.includes("credit") || lower.includes("exhausted") || lower.includes("usage limit")) {
    return "This model is temporarily busy or has reached its usage limit. Please try another model or try again later.";
  }
  if (lower.includes("timeout") || lower.includes("network") || lower.includes("fetch")) {
    return "The selected model took too long to respond. Please try again, or choose another model.";
  }

  return "We could not generate the SOAP note with the selected model. Please try again, or choose another model.";
}

function expertFacingTranslationError(error) {
  const text = String(error?.message || "");
  const lower = text.toLowerCase();

  if (lower.includes("transcript is empty")) {
    return "Please add a transcript before requesting the English translation.";
  }
  if (lower.includes("does not contain arabic")) {
    return "This transcript does not appear to contain Arabic text, so a Fanar translation is not needed.";
  }
  if (lower.includes("rate limit") || lower.includes("quota") || lower.includes("credit") || lower.includes("exhausted") || lower.includes("usage limit")) {
    return "The translation service is temporarily busy or has reached its usage limit. Please try again later.";
  }

  return "The transcript could not be translated right now. Please try again, or choose a model that accepts Arabic directly.";
}

function expertFacingRequestError(error, path) {
  const message = String(error?.message || "Request failed");
  if (["Bad token", "Expired token"].includes(message)) {
    return "Your session has expired. Please enter the demo again.";
  }
  if (path.endsWith("/api/translate")) return expertFacingTranslationError(error);
  if (path.endsWith("/api/generate")) return expertFacingGenerationError(error);
  return message;
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

    let requestError = null;
    try {
      const data = await fetchJson(OPENROUTER_CHAT_URL, { method: "POST", headers, body: JSON.stringify(payload) }, "OpenRouter");
      return extractChatContent(data, "OpenRouter");
    } catch (error) {
      if (jsonMode && responseFormatUnsupported(error)) {
        const retryPayload = { ...payload };
        delete retryPayload.response_format;
        try {
          const data = await fetchJson(OPENROUTER_CHAT_URL, { method: "POST", headers, body: JSON.stringify(retryPayload) }, "OpenRouter");
          return extractChatContent(data, "OpenRouter");
        } catch (retryError) {
          requestError = retryError;
        }
      } else {
        requestError = error;
      }

      if (openRouterKeyError(requestError)) {
        lastError = requestError;
        continue;
      }
      throw requestError;
    }
  }

  throw new Error(`All ${keys.length} configured OpenRouter API keys failed or are exhausted. Last error: ${lastError?.message || "unknown"}`);
}

function chatCompletionsUrl(endpoint) {
  const base = String(endpoint || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

function azureChatCompletionsUrl(endpoint, deployment, apiVersion) {
  const base = String(endpoint || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  const path = /\/openai\/deployments\//i.test(base)
    ? base
    : `${base}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions`;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}api-version=${encodeURIComponent(apiVersion)}`;
}

function dedicatedHfUrl(endpoint, hfTask) {
  const base = String(endpoint || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  const completionTask = ["text-generation", "completion", "completions"].includes(hfTask);
  if (completionTask && /\/completions$/i.test(base) && !/\/chat\/completions$/i.test(base)) return base;
  if (!completionTask && /\/chat\/completions$/i.test(base)) return base;
  const suffix = completionTask ? "completions" : "chat/completions";
  return /\/v1$/i.test(base) ? `${base}/${suffix}` : `${base}/v1/${suffix}`;
}

async function callAzureOpenAI(env, { model, chatMessages, maxTokens = 2048, temperature = 0, jsonMode = false }) {
  if (!env.AZURE_OPENAI_ENDPOINT) throw new Error("AZURE_OPENAI_ENDPOINT Worker secret is missing");
  if (!env.AZURE_OPENAI_API_KEY) throw new Error("AZURE_OPENAI_API_KEY Worker secret is missing");

  const deployment = String(env.AZURE_OPENAI_DEPLOYMENT || model || "").trim();
  if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT Worker secret is missing");

  const apiVersion = String(env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview").trim();
  const url = azureChatCompletionsUrl(env.AZURE_OPENAI_ENDPOINT, deployment, apiVersion);
  const headers = {
    "api-key": env.AZURE_OPENAI_API_KEY,
    "Content-Type": "application/json",
  };
  const payload = chatPayload({ model: deployment, chatMessages, maxTokens, temperature, jsonMode });

  try {
    const data = await fetchJson(url, { method: "POST", headers, body: JSON.stringify(payload) }, "Azure OpenAI");
    return extractChatContent(data, "Azure OpenAI");
  } catch (error) {
    if (jsonMode && responseFormatUnsupported(error)) {
      delete payload.response_format;
      const data = await fetchJson(url, { method: "POST", headers, body: JSON.stringify(payload) }, "Azure OpenAI");
      return extractChatContent(data, "Azure OpenAI");
    }
    throw error;
  }
}

async function callOpenAICompatible(env, { model, chatMessages, maxTokens = 2048, temperature = 0, jsonMode = false }) {
  if (!env.OPENAI_COMPATIBLE_ENDPOINT) throw new Error("OPENAI_COMPATIBLE_ENDPOINT Worker secret is missing");
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY Worker secret is missing");

  const url = chatCompletionsUrl(env.OPENAI_COMPATIBLE_ENDPOINT);
  const headers = {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  };
  const payload = chatPayload({ model, chatMessages, maxTokens, temperature, jsonMode });

  try {
    const data = await fetchJson(url, { method: "POST", headers, body: JSON.stringify(payload) }, "OpenAI-compatible endpoint");
    return extractChatContent(data, "OpenAI-compatible endpoint");
  } catch (error) {
    if (jsonMode && responseFormatUnsupported(error)) {
      delete payload.response_format;
      const data = await fetchJson(url, { method: "POST", headers, body: JSON.stringify(payload) }, "OpenAI-compatible endpoint");
      return extractChatContent(data, "OpenAI-compatible endpoint");
    }
    throw error;
  }
}

async function callDedicatedHf(env, config, { chatMessages, maxTokens = 2048, temperature = 0, jsonMode = false }) {
  const apiKey = String(env.HF_DEDICATED_API_KEY || env.HF_API || "").trim();
  if (!apiKey) throw new Error("HF_DEDICATED_API_KEY or HF_API Worker secret is missing");

  const hfTask = config.hf_task || "chat-completion";
  const completionTask = ["text-generation", "completion", "completions"].includes(hfTask);
  const url = dedicatedHfUrl(config.endpoint, hfTask);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const payload = completionTask
    ? {
        model: config.model,
        prompt: flattenMessagesForCompletion(chatMessages, config.chat_template || ""),
        max_tokens: maxTokens,
        temperature,
        stream: false,
      }
    : chatPayload({ model: config.model, chatMessages, maxTokens, temperature, jsonMode });

  try {
    const data = await fetchJson(url, { method: "POST", headers, body: JSON.stringify(payload) }, "Hugging Face dedicated endpoint");
    return extractChatContent(data, "Hugging Face dedicated endpoint");
  } catch (error) {
    if (!completionTask && jsonMode && responseFormatUnsupported(error)) {
      delete payload.response_format;
      const data = await fetchJson(url, { method: "POST", headers, body: JSON.stringify(payload) }, "Hugging Face dedicated endpoint");
      return extractChatContent(data, "Hugging Face dedicated endpoint");
    }
    throw error;
  }
}

async function callHf(env, { model, chatMessages, maxTokens = 2048, temperature = 0, jsonMode = false, hfTask = "chat-completion", chatTemplate = "" }) {
  if (!env.HF_API) throw new Error("HF_API Worker secret is missing");
  if (["text-generation", "completion", "completions"].includes(hfTask)) {
    return callHfCompletion(env, { model, chatMessages, maxTokens, temperature, chatTemplate });
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

async function callHfCompletion(env, { model, chatMessages, maxTokens = 2048, temperature = 0, chatTemplate = "" }) {
  const [baseModel, provider] = splitModelProvider(model, env.HF_TEXT_GENERATION_PROVIDER || "");
  if (!provider) throw new Error(`HF text-generation model '${model}' needs a provider suffix`);

  const headers = {
    Authorization: `Bearer ${env.HF_API}`,
    "Content-Type": "application/json",
  };
  const payload = {
    model: baseModel,
    prompt: flattenMessagesForCompletion(chatMessages, chatTemplate),
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
  if (config.provider === "azure") {
    return callAzureOpenAI(env, { model: config.model, chatMessages, maxTokens, temperature, jsonMode });
  }
  if (config.provider === "openai_compatible") {
    return callOpenAICompatible(env, { model: config.model, chatMessages, maxTokens, temperature, jsonMode });
  }
  if (config.provider === "hf") {
    return callHf(env, { model: config.model, chatMessages, maxTokens, temperature, jsonMode, hfTask: config.hf_task || "chat-completion", chatTemplate: config.chat_template || "" });
  }
  if (config.provider === "hf_dedicated") {
    return callDedicatedHf(env, config, { chatMessages, maxTokens, temperature, jsonMode });
  }
  throw new Error(`Unsupported provider: ${config.provider}`);
}

async function translateWithFanar(env, transcript, sourceFile) {
  const prompt = buildTranslationPrompt(transcript, sourceFile);
  return callFanar(env, {
    model: env.FANAR_TRANSLATION_MODEL || "Fanar",
    chatMessages: messages(prompt),
    maxTokens: Number(env.TRANSLATION_MAX_TOKENS || 4096),
    temperature: 0,
    jsonMode: false,
  });
}

function validateGeneratedTranslation(transcript, translation) {
  const translatedText = String(translation || "").trim();
  if (!translatedText) throw new Error("Fanar returned an empty translation.");
  if (transcript.length >= 200) {
    const minimumTranslationLength = Math.min(200, Math.ceil(transcript.length * 0.08));
    if (translatedText.length < minimumTranslationLength) {
      throw new Error(
        `Fanar translation appears incomplete (${translatedText.length} characters for a ${transcript.length}-character transcript).`,
      );
    }
  }
  return translatedText;
}

async function runTranslation(env, transcript, sourceFile) {
  const translation = validateGeneratedTranslation(
    transcript,
    await translateWithFanar(env, transcript, sourceFile),
  );
  return {
    text: translation,
    source_sha256: await sha256Hex(transcript),
    source_character_count: transcript.length,
    translation_character_count: translation.length,
  };
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

async function runGeneration(
  env,
  { transcript, inputName, modelKey, pretranslatedTranscript = "", translationSourceSha256 = "" },
) {
  const [resolvedKey, config] = resolveModel(modelKey, env);
  const sourceFile = cleanText(inputName || "uploaded_transcript.txt", 260) || "uploaded_transcript.txt";
  const originalHasArabic = containsArabic(transcript);
  const translatedWithFanar = Boolean(config.translate_with_fanar && originalHasArabic);
  const sourceSha256 = await sha256Hex(transcript);
  const canReuseTranslation = Boolean(
    translatedWithFanar
      && pretranslatedTranscript.trim()
      && translationSourceSha256
      && translationSourceSha256 === sourceSha256,
  );
  const modelInput = translatedWithFanar
    ? canReuseTranslation
      ? validateGeneratedTranslation(transcript, pretranslatedTranscript)
      : (await runTranslation(env, transcript, sourceFile)).text
    : transcript;
  if (!modelInput.trim()) throw new Error("The model input is empty; generation was stopped before calling the selected model.");
  const transcriptLanguage = translatedWithFanar ? "English" : originalHasArabic ? "Arabic" : "English";
  const prompt = buildSoapPrompt(modelInput, sourceFile, transcriptLanguage, Boolean(config.compact_default));
  if (!prompt.includes(modelInput)) throw new Error("Internal context check failed: the transcript was not included in the model prompt.");
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
    reused_pretranslated_input: canReuseTranslation,
    source_character_count: transcript.length,
    model_input_character_count: modelInput.length,
    source_sha256: sourceSha256,
    model_input_sha256: await sha256Hex(modelInput),
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

async function runSmoke(env, modelKey, requestedMaxTokens = 2) {
  const [resolvedKey, config] = resolveModel(modelKey, env);
  const maxTokens = Math.max(Number(requestedMaxTokens || 2), Number(config.min_smoke_tokens || 0));
  const text = await callModel(env, config, {
    chatMessages: messages("Reply with OK.", "You are a concise assistant."),
    maxTokens,
    temperature: 0,
    jsonMode: false,
  });
  return {
    model_key: resolvedKey,
    provider: config.provider,
    model_name: config.model,
    max_tokens: maxTokens,
    preview: String(text || "").replace(/\s+/g, " ").trim().slice(0, 180),
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

async function getGeneration(env, generationId) {
  const id = cleanText(generationId, 80);
  if (!id) return null;
  return env.DB
    .prepare(
      `SELECT id, expert_uid, expert_email, model_key, provider, model_name,
        input_name, input_language, transcript_text, translated_transcript,
        translated_with_fanar, output_json, raw_output, status, error,
        user_agent, page_url, created_at, completed_at
       FROM generations
       WHERE id = ?`,
    )
    .bind(id)
    .first();
}

async function updateGenerationCompleted(env, generationId, result) {
  await env.DB
    .prepare(
      `UPDATE generations
       SET model_key = ?, provider = ?, model_name = ?, input_language = ?,
           translated_transcript = ?, translated_with_fanar = ?, output_json = ?,
           raw_output = ?, status = 'completed', error = NULL, completed_at = ?
       WHERE id = ?`,
    )
    .bind(
      result.modelKey,
      result.provider,
      result.modelName,
      result.inputLanguage,
      result.translatedTranscript || null,
      result.translatedWithFanar ? 1 : 0,
      JSON.stringify(result.outputJson),
      result.rawOutput,
      new Date().toISOString(),
      generationId,
    )
    .run();
}

async function updateGenerationFailed(env, generationId, error) {
  await env.DB
    .prepare(
      `UPDATE generations
       SET status = 'failed', error = ?, completed_at = ?
       WHERE id = ?`,
    )
    .bind(cleanText(error?.message || "Generation failed", 5000), new Date().toISOString(), generationId)
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
    error: row.status === "failed" && row.error ? expertFacingGenerationError({ message: row.error }) : row.error,
    created_at: row.created_at,
    completed_at: row.completed_at,
  };
}

async function processQueuedGeneration(env, job) {
  const generationId = cleanText(job?.generation_id, 80);
  if (!generationId) return;

  const row = await getGeneration(env, generationId);
  if (!row || row.status !== "running") return;

  try {
    const result = await runGeneration(env, {
      transcript: row.transcript_text,
      inputName: row.input_name || "uploaded_transcript.txt",
      modelKey: row.model_key,
      pretranslatedTranscript: row.translated_transcript || "",
      translationSourceSha256: cleanText(job.translation_source_sha256, 128),
    });
    await updateGenerationCompleted(env, generationId, result);
  } catch (error) {
    await updateGenerationFailed(env, generationId, error);
  }
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
    error: row.status === "failed" && row.error ? expertFacingGenerationError({ message: row.error }) : row.error,
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

export const testSupport = {
  MODEL_REGISTRY,
  buildSoapPrompt,
  buildTranslationPrompt,
  callModel,
  publicModelRegistry,
  runGeneration,
  runTranslation,
  processQueuedGeneration,
  splitKeys,
};

export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      await processQueuedGeneration(env, message.body || {});
    }
  },

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
        return json({ ok: true, expert_id: payload.expert_uid, models: publicModelRegistry(env) }, 200, headers);
      }

      if (path.endsWith("/api/history")) {
        const payload = await verifyToken(env, body.token);
        return json({ ok: true, generations: await listHistory(env, String(payload.expert_uid || "")) }, 200, headers);
      }

      if (path.endsWith("/api/stats")) {
        await verifyToken(env, body.token);
        return json({ ok: true, stats: await stats(env) }, 200, headers);
      }

      if (path.endsWith("/api/smoke")) {
        await verifyToken(env, body.token);
        const result = await runSmoke(env, body.model_key, body.max_tokens);
        return json({ ok: true, smoke: result }, 200, headers);
      }

      if (path.endsWith("/api/translate")) {
        await verifyToken(env, body.token);
        const transcript = cleanText(body.transcript, Number(env.MAX_TRANSCRIPT_CHARS || 120000));
        const inputName = cleanText(body.input_name || "uploaded_transcript.txt", 260) || "uploaded_transcript.txt";
        if (!transcript) throw new Error("Transcript is empty");
        if (!containsArabic(transcript)) throw new Error("The transcript does not contain Arabic text");
        return json({ ok: true, translation: await runTranslation(env, transcript, inputName) }, 200, headers);
      }

      if (path.endsWith("/api/generate")) {
        const payload = await verifyToken(env, body.token);
        const transcript = cleanText(body.transcript, Number(env.MAX_TRANSCRIPT_CHARS || 120000));
        const inputName = cleanText(body.input_name || "uploaded_transcript.txt", 260);
        const pageUrl = cleanText(body.page_url, 1000);
        const pretranslatedTranscript = cleanText(
          body.translated_transcript,
          Number(env.MAX_TRANSLATION_CHARS || 240000),
        );
        const translationSourceSha256 = cleanText(body.translation_source_sha256, 128);
        const generationId = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        if (!transcript) throw new Error("Transcript is empty");
        const [resolvedKey, config] = resolveModel(body.model_key, env);
        const sourceHasArabic = containsArabic(transcript);
        const row = {
          id: generationId,
          expert_uid: String(payload.expert_uid || ""),
          expert_email: String(payload.email || ""),
          model_key: resolvedKey,
          provider: config.provider || "unknown",
          model_name: config.model || "unknown",
          input_name: inputName,
          input_language: config.translate_with_fanar && sourceHasArabic ? "English" : sourceHasArabic ? "Arabic" : "English",
          transcript_text: transcript,
          translated_transcript: pretranslatedTranscript || null,
          translated_with_fanar: Boolean(pretranslatedTranscript),
          output_json: null,
          raw_output: null,
          status: "running",
          error: null,
          user_agent: cleanText(request.headers.get("user-agent"), 800),
          page_url: pageUrl,
          created_at: createdAt,
          completed_at: null,
        };

        try {
          await insertGeneration(env, row);
          if (!env.GENERATION_QUEUE) throw new Error("Generation queue is not configured");
          await env.GENERATION_QUEUE.send({
            generation_id: generationId,
            translation_source_sha256: translationSourceSha256,
          });
          return json({ ok: true, queued: true, generation: clientGeneration(row) }, 202, headers);
        } catch (error) {
          await updateGenerationFailed(env, generationId, error);
          const failedRow = (await getGeneration(env, generationId)) || { ...row, status: "failed", error: cleanText(error?.message || "Generation failed", 5000) };
          return json({ error: expertFacingGenerationError(error), generation: clientGeneration(failedRow) }, 500, headers);
        }
      }

      return json({ error: "Not found" }, 404, headers);
    } catch (error) {
      const message = error?.message || "Request failed";
      const status = ["Bad token", "Expired token"].includes(message) ? 401 : 400;
      return json({ error: expertFacingRequestError(error, path) }, status, headers);
    }
  },
};
