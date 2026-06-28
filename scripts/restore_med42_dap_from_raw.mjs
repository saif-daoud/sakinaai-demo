import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = process.argv[2];
if (!outputDir) {
  throw new Error("Usage: node scripts/restore_med42_dap_from_raw.mjs <output-dir>");
}

function parseLooseJson(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    if (start === -1) throw new Error("Cannot find a JSON object in raw output.");

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < raw.length; index += 1) {
      const char = raw[index];
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
        if (depth === 0) return JSON.parse(raw.slice(start, index + 1));
      }
    }
    if (!inString && depth > 0) return JSON.parse(`${raw.slice(start)}${"}".repeat(depth)}`);
    throw new Error("Cannot parse a JSON object from raw output.");
  }
}

const rawPath = join(outputDir, "raw", "med42_8b__dap_notes.txt");
const transcriptPath = "E:\\QCRI-env\\sakinaai\\M2_plus_medical_models\\simulated_session_arabic.txt";
const transcript = readFileSync(transcriptPath, "utf8");
const parsed = parseLooseJson(readFileSync(rawPath, "utf8"));

parsed.metadata = {
  ...(parsed.metadata && typeof parsed.metadata === "object" ? parsed.metadata : {}),
  source_file: "simulated_session_arabic.txt",
  source_sha256: createHash("sha256").update(transcript).digest("hex"),
  template_key: "dap_notes",
  template_file: "dap_notes.txt",
  model_key: "med42_8b",
  model_name: "m42-health/Llama3-Med42-8B:featherless-ai",
  provider: "hf",
  language_of_model_input: "English",
  translated_with_fanar: true,
  output_language: "English",
  restored_from_raw_after_hf_402: true,
  generated_at: new Date().toISOString(),
  note: "Generated from the corrected Fanar translation; wrapper restored because a later HF 402 retry overwrote the JSON status.",
};

const payload = {
  ok: true,
  model_key: "med42_8b",
  provider: "hf",
  model_name: "m42-health/Llama3-Med42-8B:featherless-ai",
  template_key: "dap_notes",
  template_file: "dap_notes.txt",
  translated_with_fanar: true,
  language_of_model_input: "English",
  elapsed_ms: null,
  raw_output_file: rawPath,
  output_json: parsed,
  summary: { top_keys: Object.keys(parsed), top_key_count: Object.keys(parsed).length },
  restored_from_raw_after_hf_402: true,
};

writeFileSync(join(outputDir, "med42_8b__dap_notes.json"), JSON.stringify(payload, null, 2), "utf8");
console.log("restored med42_8b__dap_notes.json");
