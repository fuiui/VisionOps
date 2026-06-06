# API Reference

## GET /api/health

Returns backend status and database readiness.

## POST /api/import/sample

Imports bundled Demo Mode records into SQLite.

## GET /api/demo-summary

Returns frontend story metrics for Phase 1: Demo Mode status, experiment count, failure case count, best mAP model, best FPS model, and latest import time.

## POST /api/import/local

Reserved for Local Research Mode. Phase 1 returns a not-implemented status.

## GET /api/experiments

Returns all imported experiments and metric snapshots.

## GET /api/experiments/{id}

Returns one experiment plus metric curve points.

## GET /api/failures

Returns indexed visual cases and sample image URLs.

## POST /api/infer

Accepts an uploaded image and returns deterministic Demo Mode detection metadata. Real YOLO inference is planned for a later phase.
