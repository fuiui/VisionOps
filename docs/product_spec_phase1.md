# VisionOps Phase 1 Product Spec

## Product Goal

Phase 1 turns VisionOps into a portfolio-ready Demo Mode loop, not a complete WildNight production platform. A reviewer should be able to open the project, import sample data, understand the experiment story, compare models, inspect failure cases, and run a demo inference flow in three to five minutes.

## MVP Loop

```text
Open VisionOps
-> read the project positioning
-> import sample data
-> review experiment summary
-> compare model metrics
-> browse failure cases
-> upload one image for Demo Inference
-> see clear success or error feedback
```

## MVP Tiers

### Must-have

- Demo Mode with bundled `sample_data`.
- Sample import into SQLite.
- Overview, Experiment Comparison, Model Run Detail, Failure Gallery, Inference Demo, and Demo Guide pages.
- FastAPI endpoints that serve the frontend loop.
- Clear empty, loading, error, success, normal, and mobile states.
- README instructions for Docker and local development.

### Should-have

- Metric sorting and model ranking.
- Best mAP and best FPS highlights.
- Metric chart for comparing sample experiments.
- Failure case filtering.
- A demo guide that tells a professor, reviewer, or interviewer what to look at first.

### Later

- Real WildNight experiment scanning.
- Real Ultralytics YOLO weight loading and inference.
- User login, multi-user collaboration, cloud deployment, permissions, and full MLOps features.

## Pages

### Overview

Purpose: explain what VisionOps is and show the current Demo Mode status.

Must show:

- product positioning,
- sample data import action,
- experiment count,
- best mAP model,
- best FPS model,
- failure case count,
- current page state.

### Experiment Comparison

Purpose: compare two or more model runs side by side.

Must show:

- experiment table,
- model group,
- precision, recall, mAP@0.5, mAP@0.5:0.95, FPS, frame time,
- best model highlight,
- dynamic metric charts across multiple runs,
- `View by metric` and `View by model` comparison modes,
- a link from each row to the single-run detail page,
- empty and error guidance.

### Model Run Detail

Purpose: explain one experiment run after the user chooses it from the comparison page.

Must show:

- experiment identity,
- metric snapshot,
- epoch-level metric curve,
- mAP@0.5, precision, recall, FPS, and frame time,
- analysis of strengths, risks, tradeoff, and next steps,
- related visual cases for that model run,
- source path for the imported results.

### Failure Gallery

Purpose: show how VisionOps turns visual outputs into reviewable failure analysis.

Must show:

- visual case cards,
- model name,
- experiment group,
- case type,
- description,
- image preview,
- empty and error guidance.

### Inference Demo

Purpose: demonstrate the API shape and user feedback loop for future YOLO inference.

Must show:

- upload control,
- confidence threshold,
- run button,
- success response,
- error response,
- clear note that Phase 1 uses deterministic Demo Mode output.

### Demo Guide

Purpose: provide the five-minute reviewer route.

Must show:

- what the project solves,
- what to click first,
- what each page proves,
- what is intentionally deferred,
- acceptance checklist.

## Page States

Every page must account for these states:

- `empty`: no sample data imported yet.
- `loading`: data import, request, or inference is in progress.
- `normal`: data is loaded and content is shown.
- `error`: API or inference failed, with a clear reason and retry path.
- `success`: import or inference completed and the user receives feedback.
- `mobile`: page remains readable on narrow screens.

## Data Model

Frontend types:

- `Experiment`
- `MetricSnapshot`
- `MetricCurvePoint`
- `DynamicMetric`
- `VisualCase`
- `InferenceRun`
- `DemoSummary`
- `PageState = "empty" | "loading" | "normal" | "error" | "success"`

Backend persistence:

- SQLite stores metadata, metric snapshots, curve points, visual case paths, and inference run records.
- SQLite stores dynamic final metric values parsed from numeric `results.csv` columns.
- SQLite must not store large datasets, model weights, or private absolute paths intended for GitHub.

## API

Required Phase 1 API:

- `GET /api/health`
- `GET /api/demo-summary`
- `POST /api/import/sample`
- `GET /api/experiments`
- `GET /api/experiments/{id}` with curve points, related visual cases, and model analysis
- `GET /api/failures`
- `POST /api/infer`

`POST /api/import/local` may exist as a placeholder, but Local Research Mode is not part of the Phase 1 acceptance criteria.

## Acceptance Criteria

- A new user can understand the project from the first screen.
- Empty states appear before importing sample data.
- Importing sample data populates Overview, Experiment Comparison, and Failure Gallery.
- Experiment Comparison remains a multi-run comparison page.
- Clicking a model row opens Model Run Detail for one run's record and analysis.
- The best mAP model and best FPS model are obvious.
- Inference Demo gives clear success and error feedback.
- Backend tests pass.
- Frontend production build passes.
- README and demo script match the actual Phase 1 flow.

## Debug Rule

Every debugging pass should answer:

- Where is the error?
- Why did it happen?
- What changed?
- How was the fix verified?

Every implementation pass should review diff for unrelated changes, private paths, hardcoded local assumptions, broken Docker instructions, and README drift.
