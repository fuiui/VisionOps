# Data Format

Phase 1 reads `sample_data/manifest.json`.

Each experiment entry points to a CSV file with this header:

```csv
epoch,precision,recall,map50,map5095
```

The final row becomes the experiment's metric snapshot. All rows are stored as curve points.

Visual cases are listed in the manifest and reference files under `sample_data/visual_cases/`.

Local Research Mode will later scan a user-provided WildNight experiment directory such as:

```text
<your-local-path>/WildNight_Experiments
```

Large datasets, private images, and model weights should stay outside the repository.
