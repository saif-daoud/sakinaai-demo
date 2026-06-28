import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = process.argv[2];
if (!outputDir) {
  throw new Error("Usage: node scripts/summarize_template_outputs.mjs <output-dir>");
}

const models = [
  "fanar2",
  "acegpt",
  "gemma4",
  "med42_8b",
  "jsl_medllama_8b",
  "gpt4_1",
  "deepseek_v32",
  "llama_33_70b",
];

const templates = [
  "soap_notes",
  "4p_case_formulation",
  "biopsychosocial",
  "birp_note",
  "cbt_formulation",
  "dap_notes",
  "discharge_summaries",
  "girp_note",
  "psychiatry_hix_and_examination",
  "risk_assessment",
  "treatment_plan",
];

const rows = [];
const suspicious = [];

for (const model of models) {
  for (const template of templates) {
    const file = join(outputDir, `${model}__${template}.json`);
    if (!existsSync(file)) {
      rows.push({ model, template, ok: false, missing: true, file });
      continue;
    }

    const payload = JSON.parse(readFileSync(file, "utf8"));
    const row = {
      model,
      template,
      ok: Boolean(payload.ok),
      error: payload.error || "",
      file,
      translated_with_fanar: Boolean(payload.translated_with_fanar),
      restored_from_raw_after_hf_402: Boolean(payload.restored_from_raw_after_hf_402),
    };
    rows.push(row);

    if (payload.ok) {
      const outputText = JSON.stringify(payload.output_json || {});
      if (/\b(machine learning|artificial intelligence)\b/i.test(outputText)) {
        suspicious.push({
          model,
          template,
          file,
          reason: "Successful output mentions machine learning/artificial intelligence.",
        });
      }
    }
  }
}

const byModel = Object.fromEntries(
  models.map((model) => {
    const subset = rows.filter((row) => row.model === model);
    return [model, {
      ok: subset.filter((row) => row.ok).length,
      failed: subset.filter((row) => !row.ok).length,
    }];
  }),
);

const byTemplate = Object.fromEntries(
  templates.map((template) => {
    const subset = rows.filter((row) => row.template === template);
    return [template, {
      ok: subset.filter((row) => row.ok).length,
      failed: subset.filter((row) => !row.ok).length,
    }];
  }),
);

const summary = {
  generated_at: new Date().toISOString(),
  output_dir: outputDir,
  total_expected: rows.length,
  ok: rows.filter((row) => row.ok).length,
  failed: rows.filter((row) => !row.ok).length,
  by_model: byModel,
  by_template: byTemplate,
  failures: rows
    .filter((row) => !row.ok)
    .map(({ model, template, error, missing, file }) => ({ model, template, error, missing: Boolean(missing), file })),
  suspicious_successes: suspicious,
};

writeFileSync(join(outputDir, "final_output_summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
