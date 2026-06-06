export type Experiment = {
  id: string;
  experiment_folder: string;
  experiment_name: string;
  experiment_group: string;
  method: string;
  epoch: number;
  source_path: string;
  created_at: string;
  imported_at: string;
  notes: string;
  precision: number;
  recall: number;
  map50: number;
  map5095: number;
  fps: number;
  frame_time_ms: number;
  data_source: string;
  metrics?: DynamicMetric[];
  curve?: MetricPoint[];
};

export type DynamicMetric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  direction: "higher" | "lower";
  metric_group: "accuracy" | "speed" | "loss" | "other";
};

export type ModelAnalysis = {
  headline: string;
  strengths: string[];
  risks: string[];
  next_steps: string[];
  tradeoff: string;
};

export type ExperimentDetail = Experiment & {
  curve: MetricCurvePoint[];
  visual_cases: VisualCase[];
  analysis: ModelAnalysis;
};

export type MetricSnapshot = {
  precision: number;
  recall: number;
  map50: number;
  map5095: number;
  fps: number;
  frame_time_ms: number;
};

export type MetricPoint = {
  epoch: number;
  precision: number;
  recall: number;
  map50: number;
  map5095: number;
};

export type MetricCurvePoint = MetricPoint;

export type VisualCase = {
  id: string;
  experiment_id: string;
  image_url: string;
  case_type: string;
  model_name: string;
  description: string;
  experiment_name: string;
  experiment_group: string;
};

export type ImportResult = {
  experiments_imported: number;
  visual_cases_imported: number;
};

export type InferenceResult = {
  mode: string;
  message: string;
  model_path: string;
  confidence_threshold: number;
  inference_time_ms: number;
  detections: Array<{
    label: string;
    confidence: number;
    box: { x: number; y: number; width: number; height: number };
  }>;
};

export type InferenceRun = InferenceResult;

export type PageState = "empty" | "loading" | "normal" | "error" | "success";

export type DemoSummary = {
  demo_mode: boolean;
  status: "empty" | "normal";
  experiment_count: number;
  failure_case_count: number;
  best_map_model: Experiment | null;
  best_fps_model: Experiment | null;
  latest_imported_at: string | null;
};
