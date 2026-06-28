import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Cloud,
  Database,
  Download,
  FileText,
  FileJson,
  KeyRound,
  Languages,
  LockKeyhole,
  LogOut,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiEnabled, postJSON, setApiBase } from "./api.js";
import { SoapViewer, TranscriptPreview } from "./renderers.jsx";
import { DEFAULT_NOTE_TEMPLATE_KEY, NOTE_TEMPLATE_OPTIONS, noteTemplateByKey } from "../shared/noteTemplates.js";
import { containsArabic, copyText, downloadJson, downloadText, filenameSafe, formatTime, nowUtc, prettify } from "./utils.js";

const STORAGE_KEYS = {
  token: "sakina_demo_token",
  expert: "sakina_demo_expert",
  lastModel: "sakina_demo_last_model",
  lastTemplate: "sakina_demo_last_template",
  activeGeneration: "sakina_demo_active_generation",
};

const HIDDEN_MODEL_KEYS = new Set([
  "allam",
  "falcon_h1",
  "bimedix2_bi",
  "bimedix2_hf",
  "medgemma_4b",
  "openbiollm_8b",
  "biomistral_7b",
]);

const ALL_MODEL_OPTIONS = [
  { key: "fanar2", label: "Fanar C-2 27B", category: "non-medical", provider: "Fanar API", language: "Arabic direct", enabled: true },
  { key: "gemma4", label: "Gemma 4 31B", category: "non-medical", provider: "OpenRouter", language: "Arabic direct", enabled: true },
  { key: "acegpt", label: "AceGPT v2 8B", category: "non-medical", provider: "Hugging Face", language: "Arabic direct", enabled: true },
  { key: "gpt4_1", label: "GPT-4.1", category: "non-medical", provider: "Azure OpenAI", language: "Fanar to English", enabled: true },
  { key: "deepseek_v32", label: "DeepSeek V3.2", category: "non-medical", provider: "OpenAI", language: "Fanar to English", enabled: true },
  { key: "llama_33_70b", label: "Llama 3.3 70B", category: "non-medical", provider: "OpenAI", language: "Fanar to English", enabled: true },
  { key: "allam", label: "ALLaM 7B", category: "non-medical", provider: "Hugging Face", language: "Arabic direct", enabled: false },
  { key: "falcon_h1", label: "Falcon H1 3B", category: "non-medical", provider: "Hugging Face", language: "Arabic direct", enabled: false },
  { key: "openbiollm_8b", label: "OpenBioLLM 8B", category: "medical", provider: "Hugging Face", language: "Fanar to English", enabled: true },
  { key: "med42_8b", label: "Med42 8B", category: "medical", provider: "Hugging Face", language: "Fanar to English", enabled: true },
  { key: "jsl_medllama_8b", label: "JSL MedLlama 8B", category: "medical", provider: "Hugging Face", language: "Fanar to English", enabled: true },
  { key: "bimedix2_bi", label: "BiMediX2 8B Bi", category: "medical", provider: "Hugging Face", language: "Arabic direct", enabled: false },
  { key: "bimedix2_hf", label: "BiMediX2 8B HF", category: "medical", provider: "Hugging Face", language: "Fanar to English", enabled: false },
  { key: "medgemma_4b", label: "MedGemma 4B", category: "medical", provider: "Hugging Face", language: "Fanar to English", enabled: false },
  { key: "biomistral_7b", label: "BioMistral 7B", category: "medical", provider: "Hugging Face", language: "Fanar to English", enabled: false },
];

const MODEL_OPTIONS = ALL_MODEL_OPTIONS.filter((model) => !HIDDEN_MODEL_KEYS.has(model.key));

const MODEL_GROUPS = [
  { key: "medical", label: "Medical models" },
  { key: "non-medical", label: "Non-medical models" },
];

function loadJson(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function modelLabel(key) {
  return ALL_MODEL_OPTIONS.find((item) => item.key === key)?.label || key;
}

function templateLabelFromOutput(output) {
  const metadata = output?.metadata || {};
  const rawKey = metadata.template_key || String(metadata.template_file || "").replace(/\.txt$/i, "");
  if (rawKey) return noteTemplateByKey(rawKey).label || prettify(rawKey);
  return output?.medical_notes_soap ? "SOAP Notes" : "Generated Note";
}

function templateLabelFromGeneration(item) {
  const outputLabel = templateLabelFromOutput(parseHistoryOutput(item));
  if (outputLabel !== "Generated Note") return outputLabel;
  return item?.template_label || noteTemplateByKey(item?.template_key || DEFAULT_NOTE_TEMPLATE_KEY).label;
}

function mergeRuntimeModels(runtimeModels) {
  return MODEL_OPTIONS.map((model) => {
    const runtime = runtimeModels?.[model.key];
    if (!runtime) return model;
    return {
      ...model,
      enabled: Boolean(runtime.available),
      provider: runtime.provider_label || model.provider,
      unavailableReason: runtime.unavailable_reason || "",
    };
  });
}

const GENERATION_FRIENDLY_ERROR = "We could not generate the selected clinical note with this model. Please try again, or choose another model.";
const TRANSLATION_FRIENDLY_ERROR = "The transcript could not be translated right now. Please try again, or choose a model that accepts Arabic directly.";

function isProblemStatus(text) {
  const lower = String(text || "").toLowerCase();
  return [
    "failed",
    "unavailable",
    "could not",
    "did not",
    "invalid",
    "expired",
    "not available",
    "please add",
    "try again",
    "usage limit",
  ].some((needle) => lower.includes(needle));
}

function isProgressStatus(text) {
  const lower = String(text || "").toLowerCase();
  return ["generating", "translating", "running", "has started", "still running"].some((needle) => lower.includes(needle));
}

function friendlyGenerationStatus(error) {
  const message = String(error?.message || "").trim();
  const lower = message.toLowerCase();
  if (!message) return GENERATION_FRIENDLY_ERROR;
  if (
    lower.includes("soap note")
    || lower.includes("clinical note")
    || lower.includes("transcript")
    || lower.includes("session")
    || lower.includes("not available")
    || lower.includes("usage limit")
    || lower.includes("try again")
  ) {
    return message;
  }
  return GENERATION_FRIENDLY_ERROR;
}

function friendlyTranslationStatus(error) {
  const message = String(error?.message || "").trim();
  const lower = message.toLowerCase();
  if (!message) return TRANSLATION_FRIENDLY_ERROR;
  if (
    lower.includes("translation")
    || lower.includes("transcript")
    || lower.includes("session")
    || lower.includes("usage limit")
    || lower.includes("try again")
  ) {
    return message;
  }
  return TRANSLATION_FRIENDLY_ERROR;
}

function parseHistoryOutput(item) {
  if (!item?.output_json) return null;
  if (typeof item.output_json !== "string") return item.output_json;
  try {
    return JSON.parse(item.output_json);
  } catch {
    return null;
  }
}

function statusText(status) {
  return status === "running" ? "running" : status || "";
}

function statusClass(status) {
  if (status === "completed") return "okText";
  if (status === "running") return "warningText";
  return "dangerText";
}

function App() {
  const fileInputRef = useRef(null);
  const historyPanelRef = useRef(null);
  const responseStreamTimerRef = useRef(null);
  const streamingResponseRef = useRef(null);
  const [runtimeLoaded, setRuntimeLoaded] = useState(false);
  const [apiStatus, setApiStatus] = useState("Checking API connection...");
  const [expert, setExpert] = useState(() => loadJson(STORAGE_KEYS.expert, null));
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEYS.token) || "");
  const [access, setAccess] = useState({ email: expert?.email || "", access_code: "" });
  const [accessStatus, setAccessStatus] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => {
    const storedModel = localStorage.getItem(STORAGE_KEYS.lastModel) || "";
    return MODEL_OPTIONS.some((model) => model.key === storedModel) ? storedModel : "fanar2";
  });
  const [selectedTemplate, setSelectedTemplate] = useState(() => {
    const storedTemplate = localStorage.getItem(STORAGE_KEYS.lastTemplate) || "";
    return NOTE_TEMPLATE_OPTIONS.some((template) => template.key === storedTemplate) ? storedTemplate : DEFAULT_NOTE_TEMPLATE_KEY;
  });
  const [transcript, setTranscript] = useState("");
  const [inputName, setInputName] = useState("pasted-transcript.txt");
  const [generation, setGeneration] = useState(null);
  const [history, setHistory] = useState([]);
  const [modelOptions, setModelOptions] = useState(MODEL_OPTIONS);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [showSourceTranscript, setShowSourceTranscript] = useState(false);
  const [preparedTranslation, setPreparedTranslation] = useState(null);
  const [showPreparedTranslation, setShowPreparedTranslation] = useState(false);
  const [translationBusy, setTranslationBusy] = useState(false);
  const [responseStreaming, setResponseStreaming] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState("");
  const [activeGenerationId, setActiveGenerationId] = useState(() => localStorage.getItem(STORAGE_KEYS.activeGeneration) || "");
  const [deletingHistoryId, setDeletingHistoryId] = useState("");
  const selectedModelInfo = useMemo(() => modelOptions.find((item) => item.key === selectedModel), [modelOptions, selectedModel]);
  const selectedTemplateInfo = useMemo(() => noteTemplateByKey(selectedTemplate), [selectedTemplate]);
  const transcriptHasArabic = containsArabic(transcript);
  const requiresTranslation = selectedModelInfo?.language === "Fanar to English" && transcriptHasArabic;
  const canGenerate = apiEnabled() && token && transcript.trim() && selectedModelInfo?.enabled && !busy && !translationBusy;
  const canGenerateTranslation = apiEnabled() && token && transcript.trim() && requiresTranslation && !busy && !translationBusy;
  const runningHistoryCount = history.filter((item) => item.status === "running").length;

  useEffect(() => {
    document.title = "SakinaAI SOAP Demo";
    localStorage.removeItem("sakina_demo_last_transcript");
    return () => window.clearInterval(responseStreamTimerRef.current);
  }, []);

  useEffect(() => {
    if (streamingResponseRef.current) {
      streamingResponseRef.current.scrollTop = streamingResponseRef.current.scrollHeight;
    }
  }, [streamedResponse]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/runtime-config.json`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((config) => {
        if (cancelled) return;
        setApiBase(config?.apiBase || config?.api_base || "");
        setApiStatus(apiEnabled() ? "API ready" : "API not configured");
        setRuntimeLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (expert) saveJson(STORAGE_KEYS.expert, expert);
  }, [expert]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.lastModel, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.lastTemplate, selectedTemplate);
  }, [selectedTemplate]);

  useEffect(() => {
    if (!modelOptions.some((model) => model.key === selectedModel)) {
      setSelectedModel(modelOptions[0]?.key || "fanar2");
    }
  }, [modelOptions, selectedModel]);

  useEffect(() => {
    if (activeGenerationId) {
      localStorage.setItem(STORAGE_KEYS.activeGeneration, activeGenerationId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.activeGeneration);
    }
  }, [activeGenerationId]);

  useEffect(() => {
    if (runtimeLoaded && token && apiEnabled()) {
      void refreshModels();
      void refreshHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeLoaded, token]);

  useEffect(() => {
    if (!runtimeLoaded || !token || !apiEnabled() || runningHistoryCount === 0) return undefined;

    let cancelled = false;
    const poll = async () => {
      const nextHistory = await refreshHistory();
      if (cancelled || !Array.isArray(nextHistory)) return;
      const active = activeGenerationId
        ? nextHistory.find((item) => item.id === activeGenerationId)
        : nextHistory.find((item) => item.status === "running");
      if (!active) return;

      if (active.status === "completed") {
        setActiveGenerationId("");
        showGeneration(active, { stream: true });
      } else if (active.status === "failed") {
        setActiveGenerationId("");
        showGeneration(active);
      }
    };

    const timer = window.setInterval(() => void poll(), 5000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeLoaded, token, activeGenerationId, runningHistoryCount]);

  async function submitAccess(event) {
    event.preventDefault();
    const email = normalizeEmail(access.email);
    setAccessStatus("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAccessStatus("Enter a valid expert email.");
      return;
    }
    if (!access.access_code.trim()) {
      setAccessStatus("Enter the access code.");
      return;
    }
    if (!apiEnabled()) {
      setAccessStatus("API is not configured yet.");
      return;
    }

    try {
      setAccessBusy(true);
      const payload = await postJSON("/api/access", { email, access_code: access.access_code.trim() });
      const nextExpert = {
        email,
        expert_id: payload.expert_id,
        entered_at_utc: nowUtc(),
      };
      setExpert(nextExpert);
      setToken(String(payload.token || ""));
      localStorage.setItem(STORAGE_KEYS.token, String(payload.token || ""));
      setAccessStatus("");
      setApiStatus("Session ready");
      await Promise.all([
        refreshModels(String(payload.token || "")),
        refreshHistory(String(payload.token || "")),
      ]);
    } catch (error) {
      setAccessStatus(error?.message || "Access failed.");
    } finally {
      setAccessBusy(false);
    }
  }

  function logout() {
    window.clearInterval(responseStreamTimerRef.current);
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.expert);
    setExpert(null);
    setToken("");
    setGeneration(null);
    setShowTranslation(false);
    setShowSourceTranscript(false);
    setPreparedTranslation(null);
    setShowPreparedTranslation(false);
    setResponseStreaming(false);
    setStreamedResponse("");
    setHistory([]);
    setModelOptions(MODEL_OPTIONS);
    setActiveGenerationId("");
    setTranscript("");
    setInputName("pasted-transcript.txt");
  }

  function showGeneration(item, options = {}) {
    if (!item) return;
    stopResponseStream();
    const outputJson = parseHistoryOutput(item);
    const nextGeneration = {
      ...item,
      output_json: outputJson,
    };

    setShowTranslation(false);
    setShowSourceTranscript(Boolean(item.transcript_text));
    setPreparedTranslation(
      item.translated_transcript
        ? {
            text: item.translated_transcript,
            source_sha256: outputJson?.metadata?.source_sha256 || "",
            source_character_count: outputJson?.metadata?.source_character_count || item.transcript_text?.length || 0,
            translation_character_count: item.translated_transcript.length,
          }
        : null,
    );
    setShowPreparedTranslation(false);
    if (modelOptions.some((model) => model.key === item.model_key)) {
      setSelectedModel(item.model_key);
    }
    const historyTemplateKey = outputJson?.metadata?.template_key || item.template_key || DEFAULT_NOTE_TEMPLATE_KEY;
    if (NOTE_TEMPLATE_OPTIONS.some((template) => template.key === historyTemplateKey)) {
      setSelectedTemplate(historyTemplateKey);
    }

    if (item.status === "running") {
      setGeneration(nextGeneration);
      setActiveGenerationId(item.id || "");
      setStatus(`${templateLabelFromGeneration(item)} generation is still running. You can leave this page and return later.`);
      return;
    }

    if (item.status === "failed") {
      setGeneration(nextGeneration);
      setStatus(item.error || GENERATION_FRIENDLY_ERROR);
      return;
    }

    if (options.stream && outputJson) {
      streamCompletedGeneration(nextGeneration);
    } else {
      setGeneration(nextGeneration);
      setStatus("Generation complete");
    }
  }

  async function openHistory() {
    await refreshHistory();
    historyPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    historyPanelRef.current?.focus({ preventScroll: true });
  }

  async function refreshModels(explicitToken = token) {
    if (!explicitToken || !apiEnabled()) return;
    try {
      const payload = await postJSON("/api/models", { token: explicitToken }, { timeoutMs: 30000 });
      setModelOptions(mergeRuntimeModels(payload.models));
    } catch (error) {
      setStatus(`Model availability unavailable: ${error?.message || "request failed"}`);
    }
  }

  async function refreshHistory(explicitToken = token) {
    if (!explicitToken || !apiEnabled()) return null;
    try {
      const payload = await postJSON("/api/history", { token: explicitToken }, { timeoutMs: 30000 });
      const nextHistory = Array.isArray(payload.generations) ? payload.generations : [];
      setHistory(nextHistory);
      return nextHistory;
    } catch (error) {
      setStatus(`History unavailable: ${error?.message || "request failed"}`);
      return null;
    }
  }

  async function deleteHistoryItem(event, item) {
    event.stopPropagation();
    if (!item?.id || !token || deletingHistoryId) return;
    if (!window.confirm("Remove this saved run from your history?")) return;

    try {
      setDeletingHistoryId(item.id);
      await postJSON("/api/history/delete", { token, generation_id: item.id }, { timeoutMs: 30000 });
      setHistory((current) => current.filter((entry) => entry.id !== item.id));
      if (activeGenerationId === item.id) setActiveGenerationId("");
      if (generation?.id === item.id) {
        setGeneration(null);
        setShowTranslation(false);
        setShowSourceTranscript(false);
        setPreparedTranslation(null);
        stopResponseStream();
      }
      setStatus("History item removed.");
    } catch (error) {
      setStatus(error?.message || "Could not remove the history item.");
    } finally {
      setDeletingHistoryId("");
    }
  }

  async function importFile(file) {
    if (!file) return;
    const text = await file.text();
    setTranscript(text);
    setInputName(file.name || "uploaded-transcript.txt");
    setGeneration(null);
    setPreparedTranslation(null);
    setShowPreparedTranslation(false);
    setShowSourceTranscript(false);
  }

  function stopResponseStream() {
    window.clearInterval(responseStreamTimerRef.current);
    responseStreamTimerRef.current = null;
    setResponseStreaming(false);
    setStreamedResponse("");
  }

  function streamCompletedGeneration(nextGeneration) {
    window.clearInterval(responseStreamTimerRef.current);
    const text = JSON.stringify(nextGeneration?.output_json || {}, null, 2);
    const intervalMs = 30;
    const durationMs = Math.min(12000, Math.max(3500, Math.round(text.length * 0.7)));
    const chunkSize = Math.max(2, Math.ceil(text.length / (durationMs / intervalMs)));
    let cursor = 0;

    setGeneration(nextGeneration);
    setStreamedResponse("");
    setResponseStreaming(true);
    setStatus("Generation complete - streaming response...");

    responseStreamTimerRef.current = window.setInterval(() => {
      cursor = Math.min(text.length, cursor + chunkSize);
      setStreamedResponse(text.slice(0, cursor));
      if (cursor >= text.length) {
        window.clearInterval(responseStreamTimerRef.current);
        responseStreamTimerRef.current = null;
        setResponseStreaming(false);
        setStatus("Generation complete");
      }
    }, intervalMs);
  }

  async function generateTranslation() {
    if (preparedTranslation) {
      setShowPreparedTranslation((current) => !current);
      return;
    }
    if (!canGenerateTranslation) return;

    setTranslationBusy(true);
    setStatus("Generating English translation with Fanar...");
    try {
      const payload = await postJSON(
        "/api/translate",
        { token, transcript, input_name: inputName },
        { timeoutMs: 240000 },
      );
      setPreparedTranslation(payload.translation || null);
      setShowPreparedTranslation(true);
      setStatus(`English translation ready. Review it, then generate ${selectedTemplateInfo.label}.`);
    } catch (error) {
      setStatus(friendlyTranslationStatus(error));
    } finally {
      setTranslationBusy(false);
    }
  }

  async function generateSoap() {
    if (!canGenerate) return;
    setBusy(true);
    stopResponseStream();
    setStatus(
      requiresTranslation
        ? preparedTranslation
          ? `Generating ${selectedTemplateInfo.label} from the reviewed English translation...`
          : `Generating English translation with Fanar, then ${selectedTemplateInfo.label}...`
        : `Generating ${selectedTemplateInfo.label}...`,
    );
    setGeneration(null);
    setShowTranslation(false);
    setShowSourceTranscript(false);

    try {
      const payload = await postJSON(
        "/api/generate",
        {
          token,
          model_key: selectedModel,
          template_key: selectedTemplate,
          transcript,
          input_name: inputName,
          page_url: window.location.href,
          translated_transcript: requiresTranslation ? preparedTranslation?.text || "" : "",
          translation_source_sha256: requiresTranslation ? preparedTranslation?.source_sha256 || "" : "",
        },
        { timeoutMs: 240000 },
      );
      const nextGeneration = payload.generation;
      if (nextGeneration?.status === "running") {
        setActiveGenerationId(nextGeneration.id || "");
        setGeneration(nextGeneration);
        setStatus(`${selectedTemplateInfo.label} generation has started. You can leave this page and return later.`);
        await refreshHistory();
        return;
      }

      if (nextGeneration?.translated_transcript) {
        setPreparedTranslation({
          text: nextGeneration.translated_transcript,
          source_sha256: nextGeneration.output_json?.metadata?.source_sha256 || "",
          source_character_count: nextGeneration.output_json?.metadata?.source_character_count || transcript.length,
          translation_character_count: nextGeneration.translated_transcript.length,
        });
      }
      streamCompletedGeneration(nextGeneration);
      await refreshHistory();
    } catch (error) {
      setStatus(friendlyGenerationStatus(error));
    } finally {
      setBusy(false);
    }
  }

  function exportCurrent() {
    if (!generation?.output_json) return;
    const templateKey = generation.template_key || generation.output_json?.metadata?.template_key || DEFAULT_NOTE_TEMPLATE_KEY;
    downloadJson(`${filenameSafe(generation.model_key)}-${filenameSafe(templateKey)}-${generation.id || "note"}.json`, {
      exported_at_utc: nowUtc(),
      expert,
      generation,
    });
  }

  async function copyCurrent() {
    if (!generation?.output_json) return;
    await copyText(JSON.stringify(generation.output_json, null, 2));
    setCopyStatus("Copied JSON");
    window.setTimeout(() => setCopyStatus(""), 1600);
  }

  if (!runtimeLoaded) {
    return (
      <main className="centerShell">
        <section className="accessPanel">
          <div className="eyebrow">Loading</div>
          <h1>SakinaAI SOAP Demo</h1>
        </section>
      </main>
    );
  }

  if (!expert || !token) {
    return (
      <main className="centerShell accessShell">
        <section className="accessPanel">
          <div className="eyebrow">
            <LockKeyhole size={14} />
            Demo access
          </div>
          <h1>SakinaAI SOAP Demo</h1>
          <form className="accessForm accessFormGate" onSubmit={submitAccess}>
            <Input
              icon={<Mail size={18} />}
              label="Expert email"
              type="email"
              value={access.email}
              onChange={(value) => setAccess((current) => ({ ...current, email: value }))}
              autoComplete="email"
            />
            <Input
              icon={<KeyRound size={18} />}
              label="Access code"
              type="password"
              value={access.access_code}
              onChange={(value) => setAccess((current) => ({ ...current, access_code: value }))}
              autoComplete="one-time-code"
            />
            <button className="primaryAction" type="submit" disabled={accessBusy || !apiEnabled()}>
              {accessBusy ? <RefreshCw size={18} className="spin" /> : <ShieldCheck size={18} />}
              {accessBusy ? "Checking..." : "Enter demo"}
            </button>
          </form>
          {accessStatus && (
            <div className="statusBanner danger">
              <AlertCircle size={16} />
              <span>{accessStatus}</span>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="brandTitle">SakinaAI Notes Demo</div>
            <div className="brandSub">{expert.email}</div>
          </div>
        </div>
        <div className="topbarCenter">
          <div className="modelSummary">
            <span>{modelLabel(selectedModel)}</span>
            <small>{selectedTemplateInfo.label} · {selectedModelInfo?.provider} · {selectedModelInfo?.language}</small>
          </div>
        </div>
        <nav className="topbarActions" aria-label="Primary">
          <button className="navButton" type="button" onClick={() => void openHistory()}>
            <Database size={17} />
            History
          </button>
          <button className="navButton" type="button" onClick={logout}>
            <LogOut size={17} />
            Exit
          </button>
        </nav>
      </header>

      <div className="syncStrip">
        <Cloud size={16} />
        <span>{apiStatus}</span>
      </div>

      <main className="demoLayout">
        <aside className="controlPanel">
          <section className="panelBlock">
            <div className="sectionHeader">
              <div>
                <div className="eyebrow">Model</div>
                <h2>LLM selection</h2>
              </div>
            </div>
            <div className="modelGroupList">
              {MODEL_GROUPS.map((group) => (
                <section className="modelGroup" key={group.key} aria-labelledby={`model-group-${group.key}`}>
                  <h3 id={`model-group-${group.key}`}>{group.label}</h3>
                  <div className="modelList">
                    {modelOptions.filter((model) => model.category === group.key).map((model) => (
                      <button
                        key={model.key}
                        className={`modelCard ${selectedModel === model.key ? "active" : ""}`}
                        type="button"
                        disabled={!model.enabled}
                        onClick={() => setSelectedModel(model.key)}
                        title={model.enabled ? model.label : model.unavailableReason || "This repository has no live inference endpoint"}
                      >
                        <strong>{model.label}</strong>
                        <span>{model.provider} · {model.enabled ? model.language : "Dedicated endpoint required"}</span>
                        {model.enabled && selectedModel === model.key && (
                          <small className="templateHint">{selectedTemplateInfo.label}</small>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="panelBlock">
            <div className="sectionHeader">
              <div>
                <div className="eyebrow">Template</div>
                <h2>Note type</h2>
              </div>
            </div>
            <label className="selectField">
              <span>Template</span>
              <select
                value={selectedTemplate}
                onChange={(event) => {
                  setSelectedTemplate(event.target.value);
                  setGeneration(null);
                  setShowSourceTranscript(false);
                }}
              >
                {NOTE_TEMPLATE_OPTIONS.map((template) => (
                  <option key={template.key} value={template.key}>{template.label}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="panelBlock historyPanel" ref={historyPanelRef} tabIndex={-1}>
            <div className="sectionHeader">
              <div>
                <div className="eyebrow">History</div>
                <h2>{history.length} saved runs</h2>
              </div>
              <button className="iconButton" type="button" onClick={() => void refreshHistory()} aria-label="Refresh history">
                <RefreshCw size={17} />
              </button>
            </div>
            <div className="historyList">
              {history.length === 0 && <div className="emptyState">No saved runs yet.</div>}
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`historyItem ${item.status === "running" ? "running" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => showGeneration(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      showGeneration(item);
                    }
                  }}
                >
                  <div className="historyItemText">
                    <strong>{modelLabel(item.model_key)}</strong>
                    <span>{templateLabelFromGeneration(item)} · {formatTime(item.created_at)}</span>
                    <small className={statusClass(item.status)}>{statusText(item.status)}</small>
                  </div>
                  <button
                    className="historyDeleteButton"
                    type="button"
                    disabled={deletingHistoryId === item.id}
                    onClick={(event) => void deleteHistoryItem(event, item)}
                    title="Remove from history"
                    aria-label={`Remove ${modelLabel(item.model_key)} run from history`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="workspace">
          <section className="inputPanel">
            <div className="inputHeader">
              <div>
                <div className="eyebrow">Transcript</div>
                <h1>Arabic session input</h1>
              </div>
              <div className="headerActions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json,text/plain,application/json"
                  onChange={(event) => void importFile(event.target.files?.[0])}
                  hidden
                />
                <button className="secondaryButton" type="button" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={17} />
                  Import
                </button>
                <button className="secondaryButton" type="button" disabled={!transcript.trim()} onClick={() => downloadText(inputName, transcript)}>
                  <Download size={17} />
                  Transcript
                </button>
              </div>
            </div>
            <textarea
              className="transcriptInput"
              dir={transcriptHasArabic ? "rtl" : "auto"}
              value={transcript}
              onChange={(event) => {
                setTranscript(event.target.value);
                setInputName("pasted-transcript.txt");
                setPreparedTranslation(null);
                setShowPreparedTranslation(false);
              }}
              placeholder="الصق نص الجلسة العربية هنا"
            />
            <div className="inputFooter">
              <span>{transcript.trim().length.toLocaleString()} characters</span>
              <span>{transcriptHasArabic ? "Arabic detected" : "Arabic not detected"}</span>
              {requiresTranslation && (
                <button
                  className="secondaryButton translationAction"
                  type="button"
                  disabled={!preparedTranslation && !canGenerateTranslation}
                  aria-expanded={Boolean(preparedTranslation && showPreparedTranslation)}
                  aria-controls="prepared-translation"
                  onClick={() => void generateTranslation()}
                >
                  {translationBusy ? <RefreshCw size={17} className="spin" /> : <Languages size={17} />}
                  {translationBusy
                    ? "Translating..."
                    : preparedTranslation
                      ? showPreparedTranslation
                        ? "Hide translation"
                        : "Show translation"
                      : "Generate translation"}
                </button>
              )}
              <button className="primaryAction" type="button" disabled={!canGenerate} onClick={() => void generateSoap()}>
                {busy ? <RefreshCw size={18} className="spin" /> : <Send size={18} />}
                {busy ? "Generating..." : "Generate note"}
              </button>
            </div>
          </section>

          {requiresTranslation && showPreparedTranslation && preparedTranslation?.text && (
            <section className="translationPanel preparedTranslationPanel" id="prepared-translation">
              <div className="translationHeader">
                <div>
                  <div className="eyebrow">Fanar translation</div>
                  <h2>English text that will be sent to {selectedModelInfo?.label}</h2>
                </div>
                <span>{preparedTranslation.translation_character_count?.toLocaleString() || preparedTranslation.text.length.toLocaleString()} characters</span>
              </div>
              <pre className="translationText" dir="ltr">{preparedTranslation.text}</pre>
            </section>
          )}

          {status && (
            <div className={isProblemStatus(status) ? "statusBanner danger" : "statusBanner"}>
              {busy || translationBusy || responseStreaming || isProgressStatus(status) ? (
                <RefreshCw size={16} className="spin" />
              ) : isProblemStatus(status) ? (
                <AlertCircle size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
              <span>{status}</span>
            </div>
          )}

          {generation?.output_json && (
            <section className="resultPanel">
              <div className="resultHeader">
                <div>
                  <div className="eyebrow">{templateLabelFromOutput(generation.output_json)}</div>
                  <h1>{modelLabel(generation.model_key)}</h1>
                </div>
                {!responseStreaming && <div className="headerActions">
                  {generation.translated_with_fanar && generation.translated_transcript && (
                    <button
                      className="secondaryButton"
                      type="button"
                      aria-expanded={showTranslation}
                      aria-controls="generated-translation"
                      onClick={() => setShowTranslation((current) => !current)}
                    >
                      <Languages size={17} />
                      {showTranslation ? "Hide translation" : "Show translation"}
                    </button>
                  )}
                  {generation.transcript_text && (
                    <button
                      className="secondaryButton"
                      type="button"
                      aria-expanded={showSourceTranscript}
                      aria-controls="generated-source-transcript"
                      onClick={() => setShowSourceTranscript((current) => !current)}
                    >
                      <FileText size={17} />
                      {showSourceTranscript ? "Hide transcript" : "Show transcript"}
                    </button>
                  )}
                  <button className="secondaryButton" type="button" onClick={() => void copyCurrent()}>
                    <Clipboard size={17} />
                    {copyStatus || "Copy JSON"}
                  </button>
                  <button className="primaryAction" type="button" onClick={exportCurrent}>
                    <FileJson size={17} />
                    Export
                  </button>
                </div>}
              </div>

              {showTranslation && generation.translated_transcript && (
                <section className="translationPanel" id="generated-translation">
                  <div className="translationHeader">
                    <div>
                      <div className="eyebrow">Fanar translation</div>
                      <h2>English model input</h2>
                    </div>
                    <span>{generation.translated_transcript.length.toLocaleString()} characters</span>
                  </div>
                  <pre className="translationText" dir="ltr">{generation.translated_transcript}</pre>
                </section>
              )}

              {showSourceTranscript && generation.transcript_text && (
                <section className="sourceTranscriptPanel" id="generated-source-transcript">
                  <div className="translationHeader">
                    <div>
                      <div className="eyebrow">Source transcript</div>
                      <h2>{generation.input_name || "Transcript used for this run"}</h2>
                    </div>
                    <span>{generation.transcript_text.length.toLocaleString()} characters</span>
                  </div>
                  <TranscriptPreview text={generation.transcript_text} />
                </section>
              )}

              {responseStreaming ? (
                <div className="streamingOutput" aria-live="polite" aria-label="Streaming SOAP response">
                  <div className="streamingLabel">
                    <span className="streamingDot" />
                    Streaming response
                  </div>
                  <pre className="streamingResponse" ref={streamingResponseRef}>
                    {streamedResponse}<span className="streamingCursor" aria-hidden="true" />
                  </pre>
                </div>
              ) : (
                <SoapViewer output={generation.output_json} />
              )}
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

function Input({ icon, label, value, onChange, type = "text", ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="inputWrap">
        {icon}
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
      </div>
    </label>
  );
}

export default App;
