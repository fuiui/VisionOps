import axios from "axios";
import type { DemoSummary, Experiment, ImportResult, InferenceResult, VisualCase } from "./types";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

const client = axios.create({
  baseURL: apiBaseUrl
});

export async function importSampleData(): Promise<ImportResult> {
  const response = await client.post<ImportResult>("/api/import/sample");
  return response.data;
}

export async function getDemoSummary(): Promise<DemoSummary> {
  const response = await client.get<DemoSummary>("/api/demo-summary");
  return response.data;
}

export async function getExperiments(): Promise<Experiment[]> {
  const response = await client.get<Experiment[]>("/api/experiments");
  return response.data;
}

export async function getFailures(): Promise<VisualCase[]> {
  const response = await client.get<VisualCase[]>("/api/failures");
  return response.data;
}

export async function runInference(file: File, confidence: number): Promise<InferenceResult> {
  const form = new FormData();
  form.append("image", file);
  const response = await client.post<InferenceResult>(
    `/api/infer?confidence=${confidence}&model_path=demo-mode`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return response.data;
}

export function assetUrl(path: string): string {
  if (path.startsWith("http")) {
    return path;
  }
  return `${apiBaseUrl}${path}`;
}
