import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, NavLink, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
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
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
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
import type { ClassMetric, DemoSummary, DynamicMetric, Experiment, ExperimentDetail, InferenceResult, PageState, VisualCase } from "./types";

function formatNumber(value: number | undefined, digits = 3) {
  return typeof value === "number" ? value.toFixed(digits) : "0.000";
}

function pageState(isLoading: boolean, error: string | null, hasData: boolean, success = false): PageState {
  if (isLoading) return "loading";
  if (error) return "error";
  if (success) return "success";
  return hasData ? "normal" : "empty";
}

const metricOrder = ["map50", "precision", "recall", "map5095", "fps", "frame_time_ms"];

function metricRank(metric: DynamicMetric) {
  const index = metricOrder.indexOf(metric.key);
  return index === -1 ? metricOrder.length + 1 : index;
}

function metricColor(metric: DynamicMetric) {
  if (metric.metric_group === "loss") return "#E4002B";
  if (metric.metric_group === "speed") return "#111827";
  if (metric.metric_group === "accuracy") return "#002FA7";
  return "#4B5563";
}

function formatMetricValue(metric: DynamicMetric | undefined) {
  if (!metric) return "not recorded";
  const digits = metric.unit === "ms" || metric.unit === "fps" ? 1 : 3;
  const value = formatNumber(metric.value, digits);
  return metric.unit ? `${value} ${metric.unit}` : value;
}

function formatSignedPercent(value: number | undefined) {
  if (typeof value !== "number") return "0.0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatSignedValue(value: number | undefined, digits = 3) {
  if (typeof value !== "number") return "0.000";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function shortCaseType(caseType: string) {
  const normalized = caseType.toLowerCase();
  if (normalized.includes("false negative")) return "FN";
  if (normalized.includes("false positive")) return "FP";
  if (normalized.includes("class")) return "CLS";
  if (normalized.includes("localization")) return "LOC";
  return "Other";
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
    { to: "/experiments", label: "Experiment Comparison", icon: Table2 },
    { to: "/experiment", label: "Experiment", icon: Target },
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
  const baselineModel = experiments.find((experiment) => experiment.experiment_group.toLowerCase() === "baseline") ?? experiments[0];
  const bestMapModel = [...experiments].sort((a, b) => b.map50 - a.map50)[0];
  const bestMap5095Model = [...experiments].sort((a, b) => b.map5095 - a.map5095)[0];
  const bestFpsModel = [...experiments].sort((a, b) => b.fps - a.fps)[0];
  const failureCountsByExperiment = failures.reduce<Record<string, number>>((counts, item) => {
    counts[item.experiment_id] = (counts[item.experiment_id] ?? 0) + 1;
    return counts;
  }, {});
  const lowestFailureModel = [...experiments].sort((a, b) => {
    const byFailures = (failureCountsByExperiment[a.id] ?? 0) - (failureCountsByExperiment[b.id] ?? 0);
    return byFailures || b.map50 - a.map50;
  })[0];
  const failureBreakdown = failures.reduce<Record<string, number>>((counts, item) => {
    const key = shortCaseType(item.case_type);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const failureBreakdownLabel = Object.entries(failureBreakdown)
    .map(([key, value]) => `${value} ${key}`)
    .join(" / ");
  const recommendedModel = bestMapModel;
  const mapDelta = bestMapModel && baselineModel ? bestMapModel.map50 - baselineModel.map50 : undefined;
  const map5095Delta = bestMap5095Model && baselineModel ? bestMap5095Model.map5095 - baselineModel.map5095 : undefined;
  const fpsDelta = bestFpsModel && bestMapModel ? bestFpsModel.fps - bestMapModel.fps : undefined;
  const chartData = experiments.map((experiment) => ({
    name: experiment.experiment_name.replace("YOLOv8", "v8"),
    map50: experiment.map50,
    map50Label: formatNumber(experiment.map50)
  }));
  const tradeoffData = experiments.map((experiment) => ({
    id: experiment.id,
    name: experiment.experiment_name,
    shortName: experiment.experiment_name.replace("YOLOv8", "v8"),
    fps: experiment.fps,
    map50: experiment.map50,
    map50Label: formatNumber(experiment.map50),
    map5095: experiment.map5095
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
      <Link className="metric-card metric-link-card" to="/experiments">
        <span>Total experiments</span>
        <strong>{summary?.experiment_count ?? 0}</strong>
        <small>Open comparison table</small>
      </Link>
      <Link className="metric-card metric-link-card" to={bestMapModel ? `/experiment?model=${bestMapModel.id}` : "/experiment"}>
        <span>Best mAP@0.5</span>
        <strong>{formatNumber(bestMapModel?.map50 ?? summary?.best_map_model?.map50)}</strong>
        <small>{formatSignedValue(mapDelta)} vs Baseline</small>
        <small>{bestMapModel?.experiment_name ?? "Import sample data"}</small>
      </Link>
      <Link className="metric-card metric-link-card" to={bestMap5095Model ? `/experiment?model=${bestMap5095Model.id}` : "/experiment"}>
        <span>Best mAP@0.5:0.95</span>
        <strong>{formatNumber(bestMap5095Model?.map5095)}</strong>
        <small>{formatSignedValue(map5095Delta)} vs Baseline</small>
        <small>{bestMap5095Model?.experiment_name ?? "Import sample data"}</small>
      </Link>
      <Link className="metric-card metric-link-card" to={bestFpsModel ? `/experiment?model=${bestFpsModel.id}` : "/experiment"}>
        <span>Best FPS</span>
        <strong>{formatNumber(bestFpsModel?.fps ?? summary?.best_fps_model?.fps, 1)}</strong>
        <small>{formatSignedValue(fpsDelta, 1)} FPS vs Accuracy Model</small>
        <small>{bestFpsModel?.experiment_name ?? "Import sample data"}</small>
      </Link>
      <Link className="metric-card metric-link-card" to="/failures">
        <span>Failure cases</span>
        <strong>{summary?.failure_case_count ?? failures.length}</strong>
        <small>{failureBreakdownLabel || "No failure cases yet"}</small>
        <small>Lowest: {lowestFailureModel?.experiment_name ?? "Import sample data"}</small>
      </Link>
      <Link className="metric-card metric-link-card recommendation-kpi" to={recommendedModel ? `/experiment?model=${recommendedModel.id}` : "/experiment"}>
        <span>Recommended model</span>
        <strong>{recommendedModel?.experiment_name ?? "Import sample data"}</strong>
        <small>Best accuracy candidate</small>
      </Link>
      <section className="wide-panel recommendation-panel">
        <div className="section-heading">
          <h2>Recommended model: {recommendedModel?.experiment_name ?? "Import sample data"}</h2>
          <p>
            {recommendedModel
              ? `${recommendedModel.experiment_name} is the best accuracy candidate with mAP@0.5 = ${formatNumber(recommendedModel.map50)} and mAP@0.5:0.95 = ${formatNumber(recommendedModel.map5095)}, but it is not the fastest model. Use ${bestFpsModel?.experiment_name ?? "the speed model"} when real-time speed is the main priority.`
              : "Import sample data to let VisionOps recommend an accuracy-first model and a speed-first fallback."}
          </p>
        </div>
      </section>
      <section className="wide-panel">
        <div className="section-heading">
          <h2>What This MVP Proves</h2>
          <p>
            VisionOps turns scattered YOLO artifacts into a reviewer-friendly loop: project positioning,
            sample import, metric comparison, visual failure analysis, and demo inference feedback.
          </p>
        </div>
        {experiments.length ? (
          <div className="overview-chart-stack">
            <div className="chart-frame">
              <div className="section-heading compact-heading">
                <h2>Accuracy-Speed Tradeoff</h2>
                <p>Each point is one model run. Higher is more accurate; farther right is faster.</p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
                  <CartesianGrid stroke="#d7dce2" />
                  <XAxis dataKey="fps" name="FPS" type="number" tickLine={false} axisLine={false} unit=" fps" />
                  <YAxis dataKey="map50" name="mAP@0.5" type="number" tickLine={false} axisLine={false} domain={[0, 1]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value, name) => [typeof value === "number" ? formatNumber(value, name === "FPS" ? 1 : 3) : value, name]} />
                  <Scatter data={tradeoffData} fill="#002FA7" name="Model run">
                    <LabelList dataKey="shortName" position="top" fontSize={12} />
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-frame">
              <div className="chart-legend" aria-label="Overview chart legend">
                <span><i className="legend-blue" /> mAP@0.5 detection accuracy</span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#d7dce2" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} domain={[0, 1]} />
                  <Tooltip />
                  <Bar dataKey="map50" fill="#002FA7" name="mAP@0.5">
                    <LabelList dataKey="map50Label" position="top" fontSize={12} fill="#002FA7" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <StatePanel state="empty" title="No chart yet" body="Import sample data to render the first model comparison chart." />
        )}
      </section>
    </section>
  );
}

function Experiments({ experiments, state }: { experiments: Experiment[]; state: PageState }) {
  const [comparisonMode, setComparisonMode] = useState<"metric" | "model">("metric");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const rows = [...experiments].sort((a, b) => b.map50 - a.map50);

  useEffect(() => {
    setSelectedIds((current) => {
      const rowIds = rows.map((experiment) => experiment.id);
      if (!rowIds.length) return [];
      const next = current.filter((id) => rowIds.includes(id));
      return next.length ? next : rowIds;
    });
  }, [experiments]);

  const selectedRows = rows.filter((experiment) => selectedIds.includes(experiment.id));
  const chartRowsSource = selectedRows.length ? selectedRows : rows;
  const bestAccuracy = chartRowsSource[0];
  const bestSpeed = [...chartRowsSource].sort((a, b) => b.fps - a.fps)[0];
  const metricDefinitions = chartRowsSource
    .flatMap((experiment) => experiment.metrics ?? [])
    .reduce<DynamicMetric[]>((definitions, metric) => {
      return definitions.some((item) => item.key === metric.key) ? definitions : [...definitions, metric];
    }, [])
    .sort((a, b) => metricRank(a) - metricRank(b) || a.label.localeCompare(b.label));
  const selectedCount = selectedRows.length;

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.length > 1 ? current.filter((item) => item !== id) : current;
      }
      return [...current, id];
    });
  }

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
              <strong>{selectedCount}</strong>
              <small>{rows.length} imported runs</small>
            </article>
          </div>
          <section className="wide-panel">
            <div className="section-heading comparison-heading">
              <div>
                <h2>Select Models</h2>
                <p>Choose the model runs you want to compare. Charts below update from the selected set.</p>
              </div>
              <button className="secondary" type="button" onClick={() => setSelectedIds(rows.map((experiment) => experiment.id))}>
                Select all
              </button>
            </div>
            <div className="model-picker-grid">
              {rows.map((experiment) => (
                <label className="model-picker-item" key={experiment.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(experiment.id)}
                    disabled={selectedIds.includes(experiment.id) && selectedIds.length === 1}
                    onChange={() => toggleSelected(experiment.id)}
                  />
                  <span>
                    <strong>{experiment.experiment_name}</strong>
                    <small>mAP@0.5 {formatNumber(experiment.map50)} / FPS {formatNumber(experiment.fps, 1)}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Compare</th>
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
                {rows.map((experiment) => (
                  <tr key={experiment.id} className={experiment.id === bestAccuracy?.id ? "best-row" : ""}>
                    <td>
                      <input
                        aria-label={`Compare ${experiment.experiment_name}`}
                        type="checkbox"
                        checked={selectedIds.includes(experiment.id)}
                        disabled={selectedIds.includes(experiment.id) && selectedIds.length === 1}
                        onChange={() => toggleSelected(experiment.id)}
                      />
                    </td>
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
            <div className="section-heading comparison-heading">
              <div>
                <h2>Dynamic Metric Comparison</h2>
                <p>Showing {selectedCount} selected model{selectedCount === 1 ? "" : "s"}. VisionOps separates units to avoid misleading axes.</p>
              </div>
              <div className="segmented-control" aria-label="Comparison view mode">
                <button
                  className={comparisonMode === "metric" ? "active" : ""}
                  onClick={() => setComparisonMode("metric")}
                  type="button"
                >
                  View by metric
                </button>
                <button
                  className={comparisonMode === "model" ? "active" : ""}
                  onClick={() => setComparisonMode("model")}
                  type="button"
                >
                  View by model
                </button>
              </div>
            </div>
            {metricDefinitions.length ? (
              comparisonMode === "metric" ? (
                <div className="metric-chart-grid">
                  {metricDefinitions.map((metric) => {
                    const chartRows = chartRowsSource.map((experiment) => {
                      const value = experiment.metrics?.find((item) => item.key === metric.key);
                      return {
                        name: experiment.experiment_name.replace("YOLOv8", "v8"),
                        value: value?.value,
                        valueLabel: formatMetricValue(value)
                      };
                    });
                    const missing = chartRows.filter((item) => item.value === undefined).length;
                    return (
                      <article className="metric-chart-card" key={metric.key}>
                        <div className="metric-chart-title">
                          <strong>{metric.label}</strong>
                          <span>{metric.direction === "lower" ? "lower is better" : "higher is better"}</span>
                        </div>
                        <ResponsiveContainer width="100%" height={210}>
                          <BarChart data={chartRows}>
                            <CartesianGrid stroke="#d7dce2" vertical={false} />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} />
                            <Tooltip formatter={(value) => (typeof value === "number" ? formatMetricValue({ ...metric, value }) : "not recorded")} />
                            <Bar dataKey="value" fill={metricColor(metric)} name={metric.label}>
                              <LabelList dataKey="valueLabel" position="top" fontSize={12} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        {missing ? <small>{missing} model{missing > 1 ? "s" : ""} not recorded</small> : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="model-chart-stack">
                  {chartRowsSource.map((experiment) => {
                    const metrics = [...(experiment.metrics ?? [])].sort((a, b) => metricRank(a) - metricRank(b) || a.label.localeCompare(b.label));
                    const maxValue = Math.max(...metrics.map((metric) => Math.abs(metric.value)), 1);
                    const chartRows = metrics.map((metric) => ({
                      key: metric.key,
                      label: metric.label,
                      normalized: Math.abs(metric.value) / maxValue,
                      valueLabel: formatMetricValue(metric),
                      metric
                    }));
                    return (
                      <article className="model-chart-card" key={experiment.id}>
                        <div className="metric-chart-title">
                          <strong>{experiment.experiment_name}</strong>
                          <span>Normalized bars, original values shown</span>
                        </div>
                        <div className="model-chart-scroll">
                          <ResponsiveContainer width={Math.max(620, chartRows.length * 118)} height={220}>
                            <BarChart data={chartRows}>
                              <CartesianGrid stroke="#d7dce2" vertical={false} />
                              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
                              <YAxis tickLine={false} axisLine={false} domain={[0, 1]} hide />
                              <Tooltip formatter={(_, __, item) => item.payload.valueLabel} />
                              <Bar dataKey="normalized" name="Normalized metric">
                                {chartRows.map((item) => (
                                  <Cell key={item.key} fill={metricColor(item.metric)} />
                                ))}
                                <LabelList dataKey="valueLabel" position="top" fontSize={12} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )
            ) : (
              <StatePanel state="empty" title="No dynamic metrics" body="Import sample data again to populate the dynamic metric list." />
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Experiment({ experiments, state }: { experiments: Experiment[]; state: PageState }) {
  const rows = [...experiments].sort((a, b) => b.map50 - a.map50);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedModelId = searchParams.get("model");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExperimentDetail | null>(null);
  const [detailState, setDetailState] = useState<PageState>("empty");
  const [curveTab, setCurveTab] = useState<"accuracy" | "loss" | "learning_rate">("accuracy");
  const [classSort, setClassSort] = useState<"lowest_recall" | "lowest_map5095" | "class_name">("lowest_recall");

  useEffect(() => {
    setSelectedId((current) => {
      if (requestedModelId && rows.some((experiment) => experiment.id === requestedModelId)) return requestedModelId;
      if (current && rows.some((experiment) => experiment.id === current)) return current;
      return rows[0]?.id ?? null;
    });
  }, [experiments, requestedModelId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailState("empty");
      return;
    }
    let cancelled = false;
    setDetailState("loading");
    getExperiment(selectedId)
      .then((nextDetail) => {
        if (cancelled) return;
        setDetail(nextDetail);
        setDetailState("normal");
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setDetailState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (!rows.length) {
    return (
      <section className="content-stack">
        <div className="section-heading">
          <h2>Experiment</h2>
          <p>Select one imported model run and inspect its characteristics.</p>
        </div>
        <StatePanel
          state={state}
          title="No model runs imported"
          body="Import sample data first. Later phases can add real uploaded model folders and weights here."
        />
      </section>
    );
  }

  const selected = rows.find((experiment) => experiment.id === selectedId) ?? rows[0];
  const activeDetail = detail?.id === selected.id ? detail : null;
  const baseline = activeDetail?.baseline_comparison;
  const curveGroups = activeDetail?.curve_groups;
  const errorSummary = activeDetail?.error_summary;
  const visualCases = activeDetail?.visual_cases ?? [];
  const baselineName = baseline?.map50?.baseline_experiment_name ?? "baseline";
  const accuracyNote = selected.map50 >= 0.7 ? "Strong accuracy candidate" : "Accuracy needs review";
  const speedNote = selected.fps >= 50 ? "Good real-time speed" : "Speed tradeoff needs review";
  const recallNote = selected.recall >= selected.precision ? "Recall-leaning behavior" : "Precision-leaning behavior";
  const metricCards = [
    {
      key: "map50",
      label: "mAP@0.5",
      value: formatNumber(selected.map50),
      comparison: `${formatSignedPercent(baseline?.map50?.percent_delta)} vs ${baselineName}`,
      note: "Detection accuracy"
    },
    {
      key: "precision",
      label: "Precision",
      value: formatNumber(selected.precision),
      comparison: `${formatSignedPercent(baseline?.precision?.percent_delta)} vs ${baselineName}`,
      note: "False positive control"
    },
    {
      key: "recall",
      label: "Recall",
      value: formatNumber(selected.recall),
      comparison: `${formatSignedPercent(baseline?.recall?.percent_delta)} vs ${baselineName}`,
      note: "Missed object control"
    },
    {
      key: "fps",
      label: "FPS",
      value: formatNumber(selected.fps, 1),
      comparison: `${selected.fps >= 30 ? "real-time OK" : "speed risk"} / ${formatSignedValue(baseline?.fps?.absolute_delta, 1)} fps`,
      note: "Throughput"
    },
    {
      key: "frame_time_ms",
      label: "Frame time",
      value: `${formatNumber(selected.frame_time_ms, 1)} ms`,
      comparison: `${selected.frame_time_ms <= 30 ? "below 30 ms" : "above 30 ms"} / ${formatSignedValue(baseline?.frame_time_ms?.absolute_delta, 1)} ms`,
      note: "Single-frame latency"
    }
  ];
  const sortedClassMetrics = [...(activeDetail?.class_metrics ?? [])].sort((a, b) => {
    if (classSort === "class_name") return a.class_name.localeCompare(b.class_name);
    if (classSort === "lowest_map5095") return a.map5095 - b.map5095;
    return a.recall - b.recall;
  });
  const curveData = curveGroups?.[curveTab] ?? [];
  const curveLines = {
    accuracy: [
      { key: "precision", name: "Precision", color: "#111827" },
      { key: "recall", name: "Recall", color: "#E4002B" },
      { key: "map50", name: "mAP@0.5", color: "#002FA7" },
      { key: "map5095", name: "mAP@0.5:0.95", color: "#4B5563" }
    ],
    loss: [
      { key: "train_box_loss", name: "train/box_loss", color: "#002FA7" },
      { key: "train_cls_loss", name: "train/cls_loss", color: "#111827" },
      { key: "train_dfl_loss", name: "train/dfl_loss", color: "#4B5563" },
      { key: "val_box_loss", name: "val/box_loss", color: "#E4002B" },
      { key: "val_cls_loss", name: "val/cls_loss", color: "#A16207" },
      { key: "val_dfl_loss", name: "val/dfl_loss", color: "#64748B" }
    ],
    learning_rate: [
      { key: "lr", name: "Learning rate", color: "#002FA7" }
    ]
  }[curveTab];
  const errorCards = [
    { label: "False Negative", value: errorSummary?.false_negative ?? 0, detail: "Missed objects" },
    { label: "False Positive", value: errorSummary?.false_positive ?? 0, detail: "Extra detections" },
    { label: "Class Error", value: errorSummary?.class_error ?? 0, detail: "Wrong category" },
    { label: "Localization Error", value: errorSummary?.localization_error ?? 0, detail: "Box quality issue" }
  ];

  return (
    <section className="experiment-layout">
      <aside className="model-list-panel">
        <div className="section-heading">
          <h2>Experiment</h2>
          <p>Pick one model run to inspect its profile.</p>
        </div>
        <div className="model-list">
          {rows.map((experiment) => (
            <button
              className={experiment.id === selected.id ? "active" : ""}
              key={experiment.id}
              onClick={() => {
                setSelectedId(experiment.id);
                setSearchParams({ model: experiment.id });
              }}
              type="button"
            >
              <strong>{experiment.experiment_name}</strong>
              <small>mAP@0.5 {formatNumber(experiment.map50)} / {experiment.epoch} epochs</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="content-stack">
        <div className="detail-header">
          <div className="section-heading">
            <h2>{selected.experiment_name}</h2>
            <p>{selected.method}</p>
          </div>
          <dl className="run-meta">
            <div>
              <dt>Group</dt>
              <dd>{selected.experiment_group}</dd>
            </div>
            <div>
              <dt>Final epoch</dt>
              <dd>{selected.epoch}</dd>
            </div>
            <div>
              <dt>Baseline</dt>
              <dd>{baselineName}</dd>
            </div>
          </dl>
        </div>

        <div className="metric-strip">
          {metricCards.map((card) => {
            const comparison = baseline?.[card.key];
            return (
              <article className="metric-card metric-card-detailed" key={card.key}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.comparison}</small>
                <small>{card.note}</small>
                <small>Best epoch: {comparison?.best_epoch ?? selected.epoch} / Final epoch: {comparison?.final_epoch ?? selected.epoch}</small>
              </article>
            );
          })}
        </div>

        <section className="analysis-grid">
          <article className="wide-panel">
            <div className="section-heading">
              <h2>Model Characteristics</h2>
              <p>{selected.notes}</p>
            </div>
            <div className="feature-list">
              <span>{accuracyNote}</span>
              <span>{speedNote}</span>
              <span>{recallNote}</span>
              <span>{selected.experiment_group}</span>
            </div>
          </article>
          <article className="wide-panel">
            <div className="section-heading">
              <h2>Source</h2>
              <p>{selected.data_source}</p>
            </div>
            <dl className="source-list">
              <div>
                <dt>Experiment folder</dt>
                <dd>{selected.experiment_folder}</dd>
              </div>
              <div>
                <dt>Results CSV</dt>
                <dd>{selected.source_path}</dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="wide-panel">
          <div className="comparison-heading">
            <div className="section-heading">
              <h2>Training Curves</h2>
              <p>Inspect accuracy, loss, and learning-rate progress across epochs.</p>
            </div>
            <div className="segmented-control" aria-label="Training curve group">
              <button className={curveTab === "accuracy" ? "active" : ""} onClick={() => setCurveTab("accuracy")} type="button">
                Accuracy Curves
              </button>
              <button className={curveTab === "loss" ? "active" : ""} onClick={() => setCurveTab("loss")} type="button">
                Loss Curves
              </button>
              <button className={curveTab === "learning_rate" ? "active" : ""} onClick={() => setCurveTab("learning_rate")} type="button">
                Learning Rate
              </button>
            </div>
          </div>
          {detailState === "loading" ? (
            <StatePanel state="loading" title="Loading training curves" body="VisionOps is reading the selected model run." />
          ) : detailState === "error" ? (
            <StatePanel state="error" title="Could not load training curves" body="Import sample data again or choose another model run." />
          ) : curveData.length ? (
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={curveData}>
                  <CartesianGrid stroke="#d7dce2" vertical={false} />
                  <XAxis dataKey="epoch" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  {curveLines.map((line) => (
                    <Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} strokeWidth={2.5} name={line.name} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <StatePanel state="empty" title="No training curves" body="This model run does not include epoch-level curve data yet." />
          )}
        </section>

        <section className="wide-panel">
          <div className="comparison-heading">
            <div className="section-heading">
              <h2>Class Performance</h2>
              <p>Per-class precision, recall, mAP, and sample count for the demo animal taxonomy.</p>
            </div>
            <label className="select-control">
              Sort
              <select value={classSort} onChange={(event) => setClassSort(event.target.value as typeof classSort)}>
                <option value="lowest_recall">Lowest recall</option>
                <option value="lowest_map5095">Lowest mAP@0.5:0.95</option>
                <option value="class_name">Class name</option>
              </select>
            </label>
          </div>
          {detailState === "loading" ? (
            <StatePanel state="loading" title="Loading class metrics" body="VisionOps is preparing the per-class table." />
          ) : sortedClassMetrics.length ? (
            <div className="table-wrap compact-table">
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>mAP@0.5</th>
                    <th>mAP@0.5:0.95</th>
                    <th>Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClassMetrics.map((item: ClassMetric) => (
                    <tr key={item.class_name}>
                      <td><strong>{item.class_name}</strong></td>
                      <td>{formatNumber(item.precision)}</td>
                      <td>{formatNumber(item.recall)}</td>
                      <td>{formatNumber(item.map50)}</td>
                      <td>{formatNumber(item.map5095)}</td>
                      <td>{item.samples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <StatePanel state={detailState === "error" ? "error" : "empty"} title="No class metrics" body="This model run does not include per-class metrics yet." />
          )}
        </section>

        <section className="wide-panel">
          <div className="section-heading">
            <h2>Error Analysis</h2>
            <p>Failure summary and related visual cases for the selected model.</p>
          </div>
          <div className="error-analysis-layout">
            <div className="error-card-grid">
              {errorCards.map((card) => (
                <article className="error-card" key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.detail}</small>
                </article>
              ))}
            </div>
            {visualCases.length ? (
              <div className="gallery-grid compact-gallery">
                {visualCases.map((item) => (
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
              <StatePanel state={detailState === "loading" ? "loading" : "empty"} title="No visual cases" body="This model does not have linked failure images yet." />
            )}
          </div>
        </section>
      </section>
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
          <Link className="back-button" to="/experiments">
            <ArrowLeft size={17} aria-hidden="true" />
            Back to comparison
          </Link>
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
        <Route path="/experiment" element={<Experiment experiments={experiments} state={currentState} />} />
        <Route path="/experiments/:id" element={<ExperimentDetailPage onImport={handleImport} />} />
        <Route path="/failures" element={<Failures failures={failures} state={currentState} />} />
        <Route path="/infer" element={<Inference />} />
        <Route path="/demo-guide" element={<DemoGuide summary={summary} />} />
      </Routes>
    </Shell>
  );
}
