export type Experiment = {
  id: string;
  experiment_name: string;
  experiment_group: string;
  method: string;
  epoch: number;
  source_path: string;
  imported_at: string;
  notes: string;
  precision: number;
  recall: number;
  map50: number;
  map5095: number;
  fps: number;
  frame_time_ms: number;
  curve?: MetricPoint[];
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
