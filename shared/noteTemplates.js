export const DEFAULT_NOTE_TEMPLATE_KEY = "soap_notes";

export const NOTE_TEMPLATE_OPTIONS = [
  { key: "soap_notes", label: "SOAP Notes", file: "soap_notes.txt" },
  { key: "4p_case_formulation", label: "4P Case Formulation", file: "4p_case_formulation.txt" },
  { key: "biopsychosocial", label: "Biopsychosocial", file: "biopsychosocial.txt" },
  { key: "birp_note", label: "BIRP Note", file: "birp_note.txt" },
  { key: "cbt_formulation", label: "CBT Formulation", file: "cbt_formulation.txt" },
  { key: "dap_notes", label: "DAP Notes", file: "dap_notes.txt" },
  { key: "discharge_summaries", label: "Discharge Summaries", file: "discharge_summaries.txt" },
  { key: "girp_note", label: "GIRP Note", file: "girp_note.txt" },
  { key: "psychiatry_hix_and_examination", label: "Psychiatry History & Examination", file: "psychiatry_hix_and_examination.txt" },
  { key: "risk_assessment", label: "Risk Assessment", file: "risk_assessment.txt" },
  { key: "treatment_plan", label: "Treatment Plan", file: "treatment_plan.txt" },
];

export function noteTemplateByKey(key) {
  return NOTE_TEMPLATE_OPTIONS.find((template) => template.key === key) || NOTE_TEMPLATE_OPTIONS[0];
}
