import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { testSupport } from "../worker/src/index.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PROMPTS_DIR = join(ROOT, "medical_notes_prompts");
const TRANSCRIPT_PATH = join(ROOT, "sakinaai", "M2_plus_medical_models", "simulated_session_arabic.txt");
const SECRETS_PATH = join(ROOT, "sakinaai", "hf.yaml");
const DEFAULT_OUTPUT_ROOT = join(ROOT, "sakinaai", "M2_plus_medical_models");

const {
  MODEL_REGISTRY,
  buildSoapPrompt,
  callModel,
  runTranslation,
} = testSupport;

function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function safeName(value) {
  return String(value || "item").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function parseSecretFile(path) {
  const keys = new Set([
    "HF_API",
    "FANAR_API",
    "API_KEYS",
    "OPENROUTER_API_KEYS",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_API_VERSION",
    "AZURE_OPENAI_DEPLOYMENT",
    "AZURE_OPENAI_ENDPOINT",
    "OPENAI_API_KEY",
    "OPENAI_COMPATIBLE_ENDPOINT",
  ]);
  const values = Object.fromEntries([...keys].map((key) => [key, []]));
  let current = null;

  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!line.startsWith("-") && line.includes(":")) {
      const index = line.indexOf(":");
      const key = line.slice(0, index).trim();
      current = keys.has(key) ? key : null;
      const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (current && value) values[current].push(value);
      continue;
    }
    if (current && line.startsWith("-")) {
      const value = line.slice(1).trim().replace(/^["']|["']$/g, "");
      if (value) values[current].push(value);
    }
  }

  const openRouterKeys = values.OPENROUTER_API_KEYS.length
    ? values.OPENROUTER_API_KEYS
    : values.API_KEYS;

  return {
    HF_API: values.HF_API[0] || "",
    FANAR_API: values.FANAR_API[0] || "",
    OPENROUTER_API_KEYS: openRouterKeys.join("\n"),
    API_KEYS: openRouterKeys.join("\n"),
    AZURE_OPENAI_API_KEY: values.AZURE_OPENAI_API_KEY[0] || "",
    AZURE_OPENAI_API_VERSION: values.AZURE_OPENAI_API_VERSION[0] || "2024-12-01-preview",
    AZURE_OPENAI_DEPLOYMENT: values.AZURE_OPENAI_DEPLOYMENT[0] || "",
    AZURE_OPENAI_ENDPOINT: values.AZURE_OPENAI_ENDPOINT[0] || "",
    OPENAI_API_KEY: values.OPENAI_API_KEY[0] || "",
    OPENAI_COMPATIBLE_ENDPOINT: values.OPENAI_COMPATIBLE_ENDPOINT[0] || "",
  };
}

function repairCommonJsonPunctuation(text) {
  return String(text || "")
    .replace(/("|\]|\}|\btrue\b|\bfalse\b|\bnull\b|\d)\s*،\s*(?=("|\{|\[|\]|\}|\btrue\b|\bfalse\b|\bnull\b|-?\d))/g, "$1, ")
    .replace(/("|\]|\}|\btrue\b|\bfalse\b|\bnull\b|\d)\s*؛\s*(?=("|\{|\[|\]|\}|\btrue\b|\bfalse\b|\bnull\b|-?\d))/g, "$1, ");
}

function extractJsonObject(text) {
  let cleaned = String(text || "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  cleaned = repairCommonJsonPunctuation(cleaned);

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    if (start === -1) throw new Error(`Model output returned non-JSON content: ${cleaned.slice(0, 300)}`);

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i += 1) {
      const char = cleaned[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === "\"") inString = false;
        continue;
      }
      if (char === "\"") inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
          if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
      }
    }
    if (!inString && depth > 0) {
      try {
        return JSON.parse(`${cleaned.slice(start)}${"}".repeat(depth)}`);
      } catch {
        // Fall through to the clearer incomplete-output error below.
      }
    }
    throw new Error(`Model output did not contain a complete JSON object: ${cleaned.slice(0, 300)}`);
  }
}

function readTemplates() {
  const templates = readdirSync(PROMPTS_DIR)
    .filter((name) => name.endsWith(".txt"))
    .sort()
    .map((file) => {
      const key = file.replace(/\.txt$/i, "");
      const text = readFileSync(join(PROMPTS_DIR, file), "utf8");
      return { key, file, text };
    });

  const soapIndex = templates.findIndex((item) => item.key === "soap_notes");
  if (soapIndex > 0) {
    const [soap] = templates.splice(soapIndex, 1);
    templates.unshift(soap);
  }

  return templates;
}

function buildTemplatePrompt(template, transcript, transcriptLanguage) {
  if (template.key === "soap_notes") {
    return buildSoapPrompt(transcript, "simulated_session_arabic.txt", transcriptLanguage);
  }
  return template.text
    .replaceAll("{{TRANSCRIPT_LANGUAGE}}", transcriptLanguage)
    .replaceAll("{{SESSION_TRANSCRIPT}}", transcript)
    .replaceAll("{{SESSION_TRANSCRIPTS}}", transcript);
}

function visibleModels() {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, config]) => !config.hidden && !config.disabled_reason)
    .map(([key, config]) => ({ key, config }));
}

function envFilter(name) {
  return new Set(
    String(process.env[name] || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function applyFilter(items, filterName, keyName = "key") {
  const filter = envFilter(filterName);
  if (!filter.size) return items;
  return items.filter((item) => filter.has(item[keyName]));
}

function summarizeParsed(parsed) {
  if (!parsed || typeof parsed !== "object") return {};
  return {
    top_keys: Object.keys(parsed),
    top_key_count: Object.keys(parsed).length,
  };
}

async function main() {
  const env = {
    ...parseSecretFile(SECRETS_PATH),
    SOAP_MAX_TOKENS: process.env.TEMPLATE_MAX_TOKENS || "4096",
    SOAP_TEMPERATURE: process.env.TEMPLATE_TEMPERATURE || "0",
  };
  const transcript = readFileSync(TRANSCRIPT_PATH, "utf8");
  const transcriptSha = sha256(transcript);
  const templates = applyFilter(readTemplates(), "TEMPLATE_FILTER");
  const models = applyFilter(visibleModels(), "MODEL_FILTER");
  const outputDir = resolve(process.env.OUTPUT_DIR || join(DEFAULT_OUTPUT_ROOT, `template_model_outputs_${nowStamp()}`));
  const reportPath = join(outputDir, process.env.REPORT_FILE || "run_report.json");
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(join(outputDir, "raw"), { recursive: true });

  const report = {
    started_at: new Date().toISOString(),
    output_dir: outputDir,
    transcript_path: TRANSCRIPT_PATH,
    transcript_sha256: transcriptSha,
    transcript_characters: transcript.length,
    templates: templates.map(({ key, file }) => ({ key, file })),
    models: models.map(({ key, config }) => ({
      key,
      provider: config.provider,
      model: config.model,
      translate_with_fanar: Boolean(config.translate_with_fanar),
    })),
    results: [],
  };

  console.log(`Output directory: ${outputDir}`);
  console.log(`Models: ${models.map((item) => item.key).join(", ")}`);
  console.log(`Templates: ${templates.map((item) => item.key).join(", ")}`);

  let translatedTranscript = "";
  const needsTranslation = models.some(({ config }) => config.translate_with_fanar);
  if (needsTranslation) {
    const translationPath = join(outputDir, "translation.json");
    if (existsSync(translationPath) && process.env.FORCE_TRANSLATION !== "1") {
      const savedTranslation = JSON.parse(readFileSync(translationPath, "utf8"));
      translatedTranscript = String(savedTranslation.translated_transcript || "");
      console.log("Reusing saved Fanar translation for English-routed models...");
    }
    if (!translatedTranscript) {
      console.log("Translating transcript with Fanar once for English-routed models...");
      const translation = await runTranslation(env, transcript, basename(TRANSCRIPT_PATH));
      translatedTranscript = translation.text;
      writeFileSync(join(outputDir, "translation.json"), JSON.stringify({
        ok: true,
        source_path: TRANSCRIPT_PATH,
        source_sha256: transcriptSha,
        source_character_count: transcript.length,
        translation_character_count: translatedTranscript.length,
        translated_transcript: translatedTranscript,
      }, null, 2), "utf8");
      writeFileSync(join(outputDir, "translation.txt"), translatedTranscript, "utf8");
    }
  }

  for (const { key: modelKey, config } of models) {
    const modelInput = config.translate_with_fanar ? translatedTranscript : transcript;
    const transcriptLanguage = config.translate_with_fanar ? "English" : "Arabic";

    for (const template of templates) {
      const started = Date.now();
      const filenameBase = `${safeName(modelKey)}__${safeName(template.key)}`;
      const outputPath = join(outputDir, `${filenameBase}.json`);
      const rawPath = join(outputDir, "raw", `${filenameBase}.txt`);

      if (existsSync(outputPath) && process.env.FORCE !== "1") {
        console.log(`SKIP ${modelKey} / ${template.key}`);
        const previous = JSON.parse(readFileSync(outputPath, "utf8"));
        report.results.push({
          model_key: modelKey,
          template_key: template.key,
          skipped_existing: true,
          ok: Boolean(previous.ok),
          output_file: outputPath,
        });
        continue;
      }

      console.log(`RUN ${modelKey} / ${template.key}`);
      const prompt = buildTemplatePrompt(template, modelInput, transcriptLanguage);
      const promptSha = sha256(prompt);

      try {
        const rawOutput = await callModel(env, config, {
          chatMessages: [
            ...(config.system_prompt ? [{ role: "system", content: config.system_prompt }] : []),
            { role: "user", content: prompt },
          ],
          maxTokens: Number(process.env.TEMPLATE_MAX_TOKENS || 4096),
          temperature: Number(process.env.TEMPLATE_TEMPERATURE || 0),
          jsonMode: true,
        });
        writeFileSync(rawPath, rawOutput, "utf8");
        const parsed = extractJsonObject(rawOutput);
        if (!parsed.metadata || typeof parsed.metadata !== "object" || Array.isArray(parsed.metadata)) {
          parsed.metadata = {};
        }
        parsed.metadata = {
          ...parsed.metadata,
          source_file: basename(TRANSCRIPT_PATH),
          source_sha256: transcriptSha,
          template_key: template.key,
          template_file: template.file,
          model_key: modelKey,
          model_name: config.model,
          provider: config.provider,
          language_of_model_input: transcriptLanguage,
          translated_with_fanar: Boolean(config.translate_with_fanar),
          output_language: "English",
          prompt_sha256: promptSha,
          generated_at: new Date().toISOString(),
          note: "Generated by an LLM from a simulated transcript; requires human clinical review.",
        };

        const payload = {
          ok: true,
          model_key: modelKey,
          provider: config.provider,
          model_name: config.model,
          template_key: template.key,
          template_file: template.file,
          translated_with_fanar: Boolean(config.translate_with_fanar),
          language_of_model_input: transcriptLanguage,
          elapsed_ms: Date.now() - started,
          raw_output_file: rawPath,
          output_json: parsed,
          summary: summarizeParsed(parsed),
        };
        writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
        report.results.push({
          ok: true,
          model_key: modelKey,
          template_key: template.key,
          elapsed_ms: payload.elapsed_ms,
          output_file: outputPath,
          raw_output_file: rawPath,
          ...payload.summary,
        });
        console.log(`OK ${modelKey} / ${template.key} (${payload.elapsed_ms} ms)`);
      } catch (error) {
        const rawOutput = String(error?.rawOutput || "");
        if (rawOutput) writeFileSync(rawPath, rawOutput, "utf8");
        const payload = {
          ok: false,
          model_key: modelKey,
          provider: config.provider,
          model_name: config.model,
          template_key: template.key,
          template_file: template.file,
          translated_with_fanar: Boolean(config.translate_with_fanar),
          language_of_model_input: transcriptLanguage,
          elapsed_ms: Date.now() - started,
          error: String(error?.message || error),
          raw_output_file: rawOutput ? rawPath : null,
          raw_preview: rawOutput.slice(0, 1200),
        };
        writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
        report.results.push({
          ok: false,
          model_key: modelKey,
          template_key: template.key,
          elapsed_ms: payload.elapsed_ms,
          output_file: outputPath,
          raw_output_file: payload.raw_output_file,
          error: payload.error,
          raw_preview: payload.raw_preview,
        });
        console.log(`FAIL ${modelKey} / ${template.key}: ${payload.error.slice(0, 240)}`);
      }

      writeFileSync(reportPath, JSON.stringify({
        ...report,
        completed_at: new Date().toISOString(),
        counts: {
          total: report.results.length,
          ok: report.results.filter((item) => item.ok).length,
          failed: report.results.filter((item) => !item.ok).length,
        },
      }, null, 2), "utf8");
    }
  }

  const finalReport = {
    ...report,
    completed_at: new Date().toISOString(),
    counts: {
      total: report.results.length,
      ok: report.results.filter((item) => item.ok).length,
      failed: report.results.filter((item) => !item.ok).length,
    },
  };
  writeFileSync(reportPath, JSON.stringify(finalReport, null, 2), "utf8");
  console.log(`Done. OK=${finalReport.counts.ok} failed=${finalReport.counts.failed}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
