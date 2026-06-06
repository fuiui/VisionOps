import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, NavLink, Route, Routes, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  Gauge,
  Images,
  Loader2,
  RefreshCw,
  Route as RouteIcon,
  Table2,
  Target,
  Upload,
  Zap
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  assetUrl,
  getDemoSummary,
  getExperiment,
  getExperiments,
  getFailures,
  importSampleData,
  runInference
} from "./api";
import type { DemoSummary, Experiment, ExperimentDetail, InferenceResult, PageState, VisualCase } from "./types";

function formatNumber(value: number | undefined, digits = 3) {
  return typeof value === "number" ? value.toFixed(digits) : "0.000";
}

function pageState(isLoading: boolean, error: string | null, hasData: boolean, success = false): PageState {
  if (isLoading) return "loading";
  if (error) return "error";
  if (success) return "success";
  return hasData ? "normal" : "empty";
}

function StatePanel({
  state,
  title,
  body,
  action
}: {
  state: PageState;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  const icon =
    state === "loading" ? <Loader2 className="spin" size={22} /> :
    state === "error" ? <AlertTriangle size={22} /> :
    state === "success" ? <CheckCircle2 size={22} /> :
    <Database size={22} />;
  return (
    <section className={`state-panel state-${state}`}>
      {icon}
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      {action}
    </section>
  );
}

function Shell({
  children,
  onImport,
  loading,
  message
}: {
  children: ReactNode;
  onImport: () => void;
  loading: boolean;
  message: string | null;
}) {
  const navItems = [
    { to: "/", label: "Overview", icon: Activity },
    { to: "/experiments", label: "Experiments", icon: Table2 },
    { to: "/failures", label: "Failures", icon: Images },
    { to: "/infer", label: "Inference", icon: Upload },
    { to: "/demo-guide", label: "Demo Guide", icon: RouteIcon }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">01</span>
          <span>
            <strong>VisionOps</strong>
            <small>Demo Mode MVP loop</small>
          </span>
        </Link>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Phase 1 Product Skeleton</p>
            <h1>Experiment Review Loop</h1>
            {message ? <p className="topbar-message">{message}</p> : null}
          </div>
          <button className="primary" onClick={onImport} disabled={loading} title="Import bundled sample data">
            {loading ? <RefreshCw size={18} className="spin" /> : <Database size={18} />}
            Import Sample Data
          </button>
        </header>
        {children}
      </main>
    </div>
  );
}

function Overview({
  summary,
  experiments,
  failures,
  state,
  onImport
}: {
  summary: DemoSummary | null;
  experiments: Experiment[];
  failures: VisualCase[];
  state: PageState;
  onImport: () => void;
}) {
  const chartData = experiments.map((experiment) => ({
    name: experiment.experiment_name.replace("YOLOv8", "v8"),
    map50: experiment.map50,
    fps: experiment.fps
  }));

  return (
    <section className="page-grid">
      {state !== "normal" && state !== "success" ? (
        <div className="full-width">
          <StatePanel
            state={state}
            title={state === "empty" ? "Start with the bundled demo data" : "Overview is waiting for data"}
            body="Phase 1 proves the review loop with sample experiments before real WildNight import is added."
            action={<button className="secondary" onClick={onImport}>Import now</button>}
          />
        </div>
      ) : null}
      <div className="metric-card">
        <span>Total experiments</span>
        <strong>{summary?.experiment_count ?? 0}</strong>
      </div>
      <div className="metric-card">
        <span>Best mAP@0.5</span>
        <strong>{formatNumber(summary?.best_map_model?.map50)}</strong>
        <small>{summary?.best_map_model?.experiment_name ?? "Import sample data"}</small>
      </div>
      <div className="metric-card">
        <span>Best FPS</span>
        <strong>{formatNumber(summary?.best_fps_model?.fps, 1)}</strong>
        <small>{summary?.best_fps_model?.experiment_name ?? "Import sample data"}</small>
      </div>
      <div className="metric-card">
        <span>Failure cases</span>
        <strong>{summary?.failure_case_count ?? failures.length}</strong>
      </div>
      <section className="wide-panel">
        <div className="section-heading">
          <h2>What This MVP Proves</h2>
          <p>
            VisionOps turns scattered YOLO artifacts into a reviewer-friendly loop: project positioning,
            sample import, metric comparison, visual failure analysis, and demo inference feedback.
          </p>
        </div>
        {experiments.length ? (
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid stroke="#d7dce2" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="map50" fill="#002FA7" name="mAP@0.5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <StatePanel state="empty" title="No chart yet" body="Import sample data to render the first model comparison chart." />
        )}
      </section>
    </section>
  );
}

function Experiments({ experiments, state }: { experiments: Experiment[]; state: PageState }) {
  const rows = [...experiments].sort((a, b) => b.map50 - a.map50);
  const bestAccuracy = rows[0];
  const bestSpeed = [...rows].sort((a, b) => b.fps - a.fps)[0];
  const comparisonData = rows.map((experiment) => ({
    name: experiment.experiment_name.replace("YOLOv8", "v8"),
    map50: experiment.map50,
    fps: experiment.fps
  }));

  return (
    <section className="content-stack">
      <div className="section-heading">
        <h2>Experiment Comparison</h2>
        <p>Compare two or more model runs side by side, then open a single run when you need the detailed record.</p>
      </div>
      {!rows.length ? (
        <StatePanel
          state={state}
          title="No experiments imported"
          body="Use Demo Mode import first. Real WildNight scanning is intentionally deferred."
        />
      ) : (
        <>
          <div className="comparison-summary">
            <article className="metric-card">
              <span>Best accuracy</span>
              <strong>{formatNumber(bestAccuracy?.map50)}</strong>
              <small>{bestAccuracy?.experiment_name}</small>
            </article>
            <article className="metric-card">
              <span>Fastest model</span>
              <strong>{formatNumber(bestSpeed?.fps, 1)}</strong>
              <small>{bestSpeed?.experiment_name}</small>
            </article>
            <article className="metric-card">
              <span>Compared runs</span>
              <strong>{rows.length}</strong>
              <small>Sorted by mAP@0.5</small>
            </article>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Experiment</th>
                  <th>Group</th>
                  <th>Epoch</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>mAP@0.5</th>
                  <th>mAP@0.5:0.95</th>
                  <th>FPS</th>
                  <th>Frame time</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((experiment, index) => (
                  <tr key={experiment.id} className={index === 0 ? "best-row" : ""}>
                    <td>
                      <strong>{experiment.experiment_name}</strong>
                      <small>{experiment.notes}</small>
                    </td>
                    <td>{experiment.experiment_group}</td>
                    <td>{experiment.epoch}</td>
                    <td>{formatNumber(experiment.precision)}</td>
                    <td>{formatNumber(experiment.recall)}</td>
                    <td>{formatNumber(experiment.map50)}</td>
                    <td>{formatNumber(experiment.map5095)}</td>
                    <td>{formatNumber(experiment.fps, 1)}</td>
                    <td>{formatNumber(experiment.frame_time_ms, 1)} ms</td>
                    <td>
                      <Link className="text-link" to={`/experiments/${experiment.id}`}>
                        View run <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="wide-panel">
            <div className="section-heading">
              <h2>Accuracy and Speed Tradeoff</h2>
              <p>mAP@0.5 answers quality; FPS answers throughput. The best choice depends on the review goal.</p>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={comparisonData}>
                <CartesianGrid stroke="#d7dce2" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis yAxisId="accuracy" tickLine={false} axisLine={false} />
                <YAxis yAxisId="speed" orientation="right" tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar yAxisId="accuracy" dataKey="map50" fill="#002FA7" name="mAP@0.5" />
                <Bar yAxisId="speed" dataKey="fps" fill="#111827" name="FPS" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}

function ExperimentDetailPage({ onImport }: { onImport: () => void }) {
  const { id } = useParams();
  const [experiment, setExperiment] = useState<ExperimentDetail | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setState("error");
      setError("No experiment id was provided.");
      return;
    }
    setState("loading");
    setError(null);
    getExperiment(id)
      .then((nextExperiment) => {
        setExperiment(nextExperiment);
        setState("normal");
      })
      .catch(() => {
        setExperiment(null);
        setError("This model run is not available yet. Import sample data first, then open a row from the comparison table.");
        setState("error");
      });
  }, [id]);

  if (state === "loading") {
    return (
      <section className="content-stack">
        <StatePanel state="loading" title="Loading model run" body="VisionOps is reading the experiment metrics, curve, and related visual cases." />
      </section>
    );
  }

  if (state === "error" || !experiment) {
    return (
      <section className="content-stack">
        <StatePanel
          state="error"
          title="Model run not found"
          body={error ?? "The detail page could not load this experiment."}
          action={<button className="secondary" onClick={onImport}>Import sample data</button>}
        />
      </section>
    );
  }

  const metrics = [
    { label: "mAP@0.5", value: formatNumber(experiment.map50), note: "Detection accuracy" },
    { label: "Precision", value: formatNumber(experiment.precision), note: "False positive control" },
    { label: "Recall", value: formatNumber(experiment.recall), note: "Missed object control" },
    { label: "FPS", value: formatNumber(experiment.fps, 1), note: "Throughput" },
    { label: "Frame time", value: `${formatNumber(experiment.frame_time_ms, 1)} ms`, note: "Single-frame latency" }
  ];

  return (
    <section className="content-stack">
      <div className="detail-header">
        <div className="section-heading">
          <Link className="text-link" to="/experiments">Back to comparison</Link>
          <h2>{experiment.experiment_name}</h2>
          <p>{experiment.method}</p>
        </div>
        <dl className="run-meta">
          <div>
            <dt>Group</dt>
            <dd>{experiment.experiment_group}</dd>
          </div>
          <div>
            <dt>Epoch</dt>
            <dd>{experiment.epoch}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{experiment.data_source}</dd>
          </div>
        </dl>
      </div>

      <div className="metric-strip">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </div>

      <section className="wide-panel">
        <div className="section-heading">
          <h2>Training Record</h2>
          <p>Each point comes from this run's metric curve, so the final score has a visible path.</p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={experiment.curve}>
            <CartesianGrid stroke="#d7dce2" vertical={false} />
            <XAxis dataKey="epoch" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="map50" stroke="#002FA7" strokeWidth={3} name="mAP@0.5" />
            <Line type="monotone" dataKey="precision" stroke="#111827" strokeWidth={2} name="Precision" />
            <Line type="monotone" dataKey="recall" stroke="#E4002B" strokeWidth={2} name="Recall" />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="analysis-grid">
        <article className="wide-panel">
          <div className="section-heading">
            <h2>Model Analysis</h2>
            <p>{experiment.analysis.headline}</p>
          </div>
          <div className="analysis-list">
            <strong>Strengths</strong>
            <ul>
              {experiment.analysis.strengths.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <strong>Risks</strong>
            <ul>
              {experiment.analysis.risks.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <strong>Next steps</strong>
            <ul>
              {experiment.analysis.next_steps.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </article>
        <article className="wide-panel">
          <div className="section-heading">
            <h2>Decision Note</h2>
            <p>{experiment.analysis.tradeoff}</p>
          </div>
          <dl className="source-list">
            <div>
              <dt>Experiment folder</dt>
              <dd>{experiment.experiment_folder}</dd>
            </div>
            <div>
              <dt>Results CSV</dt>
              <dd>{experiment.source_path}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="wide-panel">
        <div className="section-heading">
          <h2>Related Visual Cases</h2>
          <p>These examples belong to this model run only.</p>
        </div>
        {experiment.visual_cases.length ? (
          <div className="gallery-grid">
            {experiment.visual_cases.map((item) => (
              <article className="case-card" key={item.id}>
                <img src={assetUrl(item.image_url)} alt={item.description} />
                <div>
                  <strong>{item.case_type}</strong>
                  <span>{item.model_name}</span>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <StatePanel state="empty" title="No related cases" body="This run has metrics, but no visual cases have been attached yet." />
        )}
      </section>
    </section>
  );
}

function Failures({ failures, state }: { failures: VisualCase[]; state: PageState }) {
  return (
    <section className="content-stack">
      <div className="section-heading">
        <h2>Failure Gallery</h2>
        <p>Visual cases make model behavior inspectable instead of leaving examples buried in folders.</p>
      </div>
      {!failures.length ? (
        <StatePanel state={state} title="No visual cases yet" body="Import sample data to populate failure and detection examples." />
      ) : (
        <div className="gallery-grid">
          {failures.map((item) => (
            <article className="case-card" key={item.id}>
              <img src={assetUrl(item.image_url)} alt={item.description} />
              <div>
                <strong>{item.case_type}</strong>
                <span>{item.model_name}</span>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Inference() {
  const [file, setFile] = useState<File | null>(null);
  const [confidence, setConfidence] = useState(0.35);
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [state, setState] = useState<PageState>("empty");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose an image before running Demo Inference.");
      setState("error");
      return;
    }
    setState("loading");
    setError(null);
    try {
      setResult(await runInference(file, confidence));
      setState("success");
    } catch {
      setResult(null);
      setError("The inference request failed. Check that the backend is running and try again.");
      setState("error");
    }
  }

  return (
    <section className="inference-layout">
      <form className="upload-panel" onSubmit={submit}>
        <div className="section-heading">
          <h2>Inference Demo</h2>
          <p>Phase 1 records the upload and returns deterministic Demo Mode output.</p>
        </div>
        <label>
          Image file
          <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <label>
          Confidence threshold
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.05"
            value={confidence}
            onChange={(event) => setConfidence(Number(event.target.value))}
          />
          <span>{confidence.toFixed(2)}</span>
        </label>
        <button className="primary" disabled={state === "loading"} title="Run inference">
          {state === "loading" ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
          {state === "loading" ? "Running" : "Run Demo Inference"}
        </button>
      </form>
      <div className="result-panel">
        {state === "error" ? <StatePanel state="error" title="Inference failed" body={error ?? "Unknown inference error."} /> : null}
        {state === "success" && result ? (
          <>
            <StatePanel state="success" title="Demo inference completed" body={result.message} />
            <dl>
              <div>
                <dt>Mode</dt>
                <dd>{result.mode}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{result.inference_time_ms} ms</dd>
              </div>
              <div>
                <dt>Detection</dt>
                <dd>
                  {result.detections[0].label} {formatNumber(result.detections[0].confidence, 2)}
                </dd>
              </div>
            </dl>
          </>
        ) : null}
        {state === "empty" || state === "loading" ? (
          <StatePanel
            state={state}
            title={state === "loading" ? "Running Demo Inference" : "Ready for one image"}
            body="Upload a sample image to verify the API feedback shape before real YOLO weights are connected."
          />
        ) : null}
      </div>
    </section>
  );
}

function DemoGuide({ summary }: { summary: DemoSummary | null }) {
  const checklist = [
    "Open Overview and explain the product positioning.",
    "Import sample data and show the success feedback.",
    "Use Experiment Comparison to identify best mAP and best FPS.",
    "Use Failure Gallery to explain visual evidence.",
    "Run Demo Inference and explain the future YOLO integration point."
  ];
  const tiers = [
    { title: "Must-have", icon: Target, text: "Demo Mode, core pages, SQLite, basic API, clear states, README." },
    { title: "Should-have", icon: Gauge, text: "Ranking, charts, best model highlights, filtering, demo guide." },
    { title: "Later", icon: Zap, text: "Real WildNight import, real YOLO inference, auth, cloud, collaboration." }
  ];

  return (
    <section className="content-stack">
      <div className="section-heading">
        <h2>Demo Guide</h2>
        <p>This is the reviewer route: what to click, what it proves, and what Phase 1 deliberately leaves for later.</p>
      </div>
      <div className="tier-grid">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          return (
            <article className="tier-card" key={tier.title}>
              <Icon size={22} />
              <strong>{tier.title}</strong>
              <p>{tier.text}</p>
            </article>
          );
        })}
      </div>
      <section className="wide-panel">
        <div className="section-heading">
          <h2>Five-Minute Route</h2>
          <p>
            Current Demo Mode status: {summary?.status ?? "empty"}.
            Imported experiments: {summary?.experiment_count ?? 0}.
          </p>
        </div>
        <ol className="checklist">
          {checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </section>
  );
}

export default function App() {
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [failures, setFailures] = useState<VisualCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [nextSummary, nextExperiments, nextFailures] = await Promise.all([
      getDemoSummary(),
      getExperiments(),
      getFailures()
    ]);
    setSummary(nextSummary);
    setExperiments(nextExperiments);
    setFailures(nextFailures);
  }

  async function handleImport() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await importSampleData();
      await refresh();
      setMessage(`Imported ${result.experiments_imported} experiments and ${result.visual_cases_imported} visual cases.`);
    } catch {
      setError("Sample import failed. Check that the backend is running and try again.");
      setMessage(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => setError("Could not reach the VisionOps backend."))
      .finally(() => setLoading(false));
  }, []);

  const currentState = pageState(loading, error, experiments.length > 0, Boolean(message));

  return (
    <Shell onImport={handleImport} loading={loading} message={message}>
      {error ? (
        <div className="page-alert">
          <StatePanel state="error" title="Backend request failed" body={error} action={<button className="secondary" onClick={() => refresh()}>Retry</button>} />
        </div>
      ) : null}
      <Routes>
        <Route path="/" element={<Overview summary={summary} experiments={experiments} failures={failures} state={currentState} onImport={handleImport} />} />
        <Route path="/experiments" element={<Experiments experiments={experiments} state={currentState} />} />
        <Route path="/experiments/:id" element={<ExperimentDetailPage onImport={handleImport} />} />
        <Route path="/failures" element={<Failures failures={failures} state={currentState} />} />
        <Route path="/infer" element={<Inference />} />
        <Route path="/demo-guide" element={<DemoGuide summary={summary} />} />
      </Routes>
    </Shell>
  );
}
