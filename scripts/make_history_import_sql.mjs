import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const outputDir = process.argv[2];
const email = String(process.argv[3] || "saif.sedaoud@gmail.com").trim().toLowerCase();
if (!outputDir) {
  throw new Error("Usage: node scripts/make_history_import_sql.mjs <output-dir> [expert-email]");
}

const batchId = "20260628-template-model-outputs";
const summaryPath = join(outputDir, "final_output_summary.json");
const transcriptPath = "E:\\QCRI-env\\sakinaai\\M2_plus_medical_models\\simulated_session_arabic.txt";
const translationPath = join(outputDir, "translation.txt");
const importSqlPath = join(outputDir, "import_saif_history.sql");
const transcript = readFileSync(transcriptPath, "utf8");
const translation = existsSync(translationPath) ? readFileSync(translationPath, "utf8") : "";
const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
const expertUid = `E-${createHash("sha256").update(email).digest("hex").slice(0, 12)}`;

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function templateLabel(key) {
  return String(key || "template")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stableId(model, template) {
  return `seed-${batchId}-${model}-${template}`.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}

const successfulRows = [];
for (const modelSummary of Object.keys(summary.by_model || {})) {
  const files = summary.failures || [];
  void files;
  const modelFiles = [];
  for (const template of Object.keys(summary.by_template || {})) {
    const file = join(outputDir, `${modelSummary}__${template}.json`);
    if (existsSync(file)) modelFiles.push({ template, file });
  }
  for (const item of modelFiles) {
    const payload = JSON.parse(readFileSync(item.file, "utf8"));
    if (!payload.ok || !payload.output_json) continue;
    successfulRows.push({ template: item.template, payload, file: item.file });
  }
}

successfulRows.sort((a, b) => {
  const aKey = `${a.payload.model_key}__${a.template}`;
  const bKey = `${b.payload.model_key}__${b.template}`;
  return aKey.localeCompare(bKey);
});

const baseTime = Date.now();
const lines = [
  `INSERT INTO experts (expert_uid, email, created_at, last_seen_at)
VALUES (${sql(expertUid)}, ${sql(email)}, datetime('now'), datetime('now'))
ON CONFLICT(email) DO UPDATE SET last_seen_at = excluded.last_seen_at;`,
  `DELETE FROM generations WHERE expert_uid = ${sql(expertUid)} AND id LIKE ${sql(`seed-${batchId}-%`)};`,
];

successfulRows.forEach(({ template, payload }, index) => {
  const outputJson = payload.output_json;
  const modelKey = payload.model_key;
  const rowId = stableId(modelKey, template);
  const rawPath = payload.raw_output_file || join(outputDir, "raw", `${modelKey}__${template}.txt`);
  const rawOutput = existsSync(rawPath) ? readFileSync(rawPath, "utf8") : "";
  const translatedWithFanar = Boolean(payload.translated_with_fanar);
  const createdAt = new Date(baseTime - index * 1000).toISOString();
  const inputName = `${templateLabel(template)} - ${basename(transcriptPath)}`;

  lines.push(`INSERT INTO generations (
  id, expert_uid, expert_email, model_key, provider, model_name, input_name,
  input_language, transcript_text, translated_transcript, translated_with_fanar,
  output_json, raw_output, status, error, user_agent, page_url, created_at, completed_at
) VALUES (
  ${sql(rowId)}, ${sql(expertUid)}, ${sql(email)}, ${sql(modelKey)}, ${sql(payload.provider)}, ${sql(payload.model_name)}, ${sql(inputName)},
  ${sql(payload.language_of_model_input)}, ${sql(transcript)}, ${translatedWithFanar ? sql(translation) : "NULL"}, ${translatedWithFanar ? 1 : 0},
  ${sql(JSON.stringify(outputJson))}, ${sql(rawOutput)}, 'completed', NULL, 'Codex batch import', ${sql(`batch-import://${batchId}`)}, ${sql(createdAt)}, ${sql(createdAt)}
);`);
});

writeFileSync(importSqlPath, `${lines.join("\n\n")}\n`, "utf8");

console.log(JSON.stringify({
  email,
  expert_uid: expertUid,
  output_sql: importSqlPath,
  completed_rows: successfulRows.length,
}, null, 2));
