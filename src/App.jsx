import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Cloud,
  Database,
  Download,
  FileJson,
  KeyRound,
  Languages,
  LockKeyhole,
  LogOut,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiEnabled, postJSON, setApiBase } from "./api.js";
import { SoapViewer, TranscriptPreview } from "./renderers.jsx";
import { containsArabic, copyText, downloadJson, downloadText, filenameSafe, formatTime, nowUtc } from "./utils.js";

const STORAGE_KEYS = {
  token: "sakina_demo_token",
  expert: "sakina_demo_expert",
  lastTranscript: "sakina_demo_last_transcript",
  lastModel: "sakina_demo_last_model",
};

const MODEL_OPTIONS = [
  { key: "fanar2", label: "Fanar C-2 27B", category: "non-medical", provider: "Fanar API", language: "Arabic direct", enabled: true },
  { key: "gemma4", label: "Gemma 4 31B", category: "non-medical", provider: "OpenRouter", language: "Arabic direct", enabled: true },
  { key: "acegpt", label: "AceGPT v2 8B", category: "non-medical", provider: "Hugging Face", language: "Arabic direct", enabled: true },
  { key: "gpt4_1", label: "GPT-4.1", category: "non-medical", provider: "Azure OpenAI", language: "Fanar to English", enabled: true },
  { key: "deepseek_v32", label: "DeepSeek V3.2", category: "non-medical", provider: "Azure AI / OpenAI compatible", language: "Fanar to English", enabled: true },
  { key: "llama_33_70b", label: "Llama 3.3 70B", category: "non-medical", provider: "Azure AI / OpenAI compatible", language: "Fanar to English", enabled: true },
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
  return MODEL_OPTIONS.find((item) => item.key === key)?.label || key;
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

function App() {
  const fileInputRef = useRef(null);
  const [runtimeLoaded, setRuntimeLoaded] = useState(false);
  const [apiStatus, setApiStatus] = useState("Checking API connection...");
  const [expert, setExpert] = useState(() => loadJson(STORAGE_KEYS.expert, null));
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEYS.token) || "");
  const [access, setAccess] = useState({ email: expert?.email || "", access_code: "" });
  const [accessStatus, setAccessStatus] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem(STORAGE_KEYS.lastModel) || "fanar2");
  const [transcript, setTranscript] = useState(() => localStorage.getItem(STORAGE_KEYS.lastTranscript) || "");
  const [inputName, setInputName] = useState("pasted-transcript.txt");
  const [generation, setGeneration] = useState(null);
  const [history, setHistory] = useState([]);
  const [modelOptions, setModelOptions] = useState(MODEL_OPTIONS);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [preparedTranslation, setPreparedTranslation] = useState(null);
  const [showPreparedTranslation, setShowPreparedTranslation] = useState(false);
  const [translationBusy, setTranslationBusy] = useState(false);
  const selectedModelInfo = useMemo(() => modelOptions.find((item) => item.key === selectedModel), [modelOptions, selectedModel]);
  const transcriptHasArabic = containsArabic(transcript);
  const requiresTranslation = selectedModelInfo?.language === "Fanar to English" && transcriptHasArabic;
  const canGenerate = apiEnabled() && token && transcript.trim() && selectedModelInfo?.enabled && !busy && !translationBusy;
  const canGenerateTranslation = apiEnabled() && token && transcript.trim() && requiresTranslation && !busy && !translationBusy;

  useEffect(() => {
    document.title = "SakinaAI SOAP Demo";
  }, []);

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
    localStorage.setItem(STORAGE_KEYS.lastTranscript, transcript);
  }, [transcript]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.lastModel, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    if (runtimeLoaded && token && apiEnabled()) {
      void refreshModels();
      void refreshHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeLoaded, token]);

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
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.expert);
    setExpert(null);
    setToken("");
    setGeneration(null);
    setShowTranslation(false);
    setPreparedTranslation(null);
    setShowPreparedTranslation(false);
    setHistory([]);
    setModelOptions(MODEL_OPTIONS);
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
    if (!explicitToken || !apiEnabled()) return;
    try {
      const payload = await postJSON("/api/history", { token: explicitToken }, { timeoutMs: 30000 });
      setHistory(Array.isArray(payload.generations) ? payload.generations : []);
    } catch (error) {
      setStatus(`History unavailable: ${error?.message || "request failed"}`);
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
      setStatus("English translation ready. Review it, then generate the SOAP note.");
    } catch (error) {
      setStatus(error?.message || "Translation failed.");
    } finally {
      setTranslationBusy(false);
    }
  }

  async function generateSoap() {
    if (!canGenerate) return;
    setBusy(true);
    setStatus(
      requiresTranslation
        ? preparedTranslation
          ? "Generating SOAP note from the reviewed English translation..."
          : "Generating English translation with Fanar, then the SOAP note..."
        : "Generating SOAP note...",
    );
    setGeneration(null);
    setShowTranslation(false);

    try {
      const payload = await postJSON(
        "/api/generate",
        {
          token,
          model_key: selectedModel,
          transcript,
          input_name: inputName,
          translated_transcript: requiresTranslation ? preparedTranslation?.text || "" : "",
          translation_source_sha256: requiresTranslation ? preparedTranslation?.source_sha256 || "" : "",
        },
        { timeoutMs: 240000 },
      );
      setGeneration(payload.generation);
      if (payload.generation?.translated_transcript) {
        setPreparedTranslation({
          text: payload.generation.translated_transcript,
          source_sha256: payload.generation.output_json?.metadata?.source_sha256 || "",
          source_character_count: payload.generation.output_json?.metadata?.source_character_count || transcript.length,
          translation_character_count: payload.generation.translated_transcript.length,
        });
      }
      setStatus("Generation complete");
      await refreshHistory();
    } catch (error) {
      setStatus(error?.message || "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  function exportCurrent() {
    if (!generation?.output_json) return;
    downloadJson(`${filenameSafe(generation.model_key)}-${generation.id || "soap"}.json`, {
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
            <div className="brandTitle">SakinaAI SOAP Demo</div>
            <div className="brandSub">{expert.email}</div>
          </div>
        </div>
        <div className="topbarCenter">
          <div className="modelSummary">
            <span>{modelLabel(selectedModel)}</span>
            <small>{selectedModelInfo?.provider} · {selectedModelInfo?.language}</small>
          </div>
        </div>
        <nav className="topbarActions" aria-label="Primary">
          <button className="navButton" type="button" onClick={() => void refreshHistory()}>
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
                        <span>{model.provider}</span>
                        <small>{model.enabled ? model.language : "Dedicated endpoint required"}</small>
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
                <button
                  key={item.id}
                  className="historyItem"
                  type="button"
                  onClick={() => {
                    const outputJson = item.output_json ? JSON.parse(item.output_json) : null;
                    setGeneration({
                      ...item,
                      output_json: outputJson,
                    });
                    setShowTranslation(false);
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
                    setSelectedModel(item.model_key || selectedModel);
                    if (item.transcript_text) setTranscript(item.transcript_text);
                  }}
                >
                  <strong>{modelLabel(item.model_key)}</strong>
                  <span>{formatTime(item.created_at)}</span>
                  <small className={item.status === "completed" ? "okText" : "dangerText"}>{item.status}</small>
                </button>
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
                {busy ? "Generating..." : "Generate SOAP"}
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
            <div className={status.toLowerCase().includes("failed") || status.toLowerCase().includes("unavailable") ? "statusBanner danger" : "statusBanner"}>
              {busy || translationBusy ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
              <span>{status}</span>
            </div>
          )}

          <section className="resultPanel">
            <div className="resultHeader">
              <div>
                <div className="eyebrow">SOAP output</div>
                <h1>{generation?.output_json ? modelLabel(generation.model_key) : "Awaiting generation"}</h1>
              </div>
              <div className="headerActions">
                {generation?.translated_with_fanar && generation?.translated_transcript && (
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
                <button className="secondaryButton" type="button" disabled={!generation?.output_json} onClick={() => void copyCurrent()}>
                  <Clipboard size={17} />
                  {copyStatus || "Copy JSON"}
                </button>
                <button className="primaryAction" type="button" disabled={!generation?.output_json} onClick={exportCurrent}>
                  <FileJson size={17} />
                  Export
                </button>
              </div>
            </div>

            {showTranslation && generation?.translated_transcript && (
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

            {generation?.output_json ? (
              <SoapViewer output={generation.output_json} />
            ) : (
              <div className="emptyResult">
                <TranscriptPreview text={transcript} />
              </div>
            )}
          </section>
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
