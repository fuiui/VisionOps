# Data Format

Phase 1 reads `sample_data/manifest.json`.

Each experiment entry points to a CSV file. `epoch` is required. Known columns are used for the core dashboard:

```csv
epoch,precision,recall,map50,map5095
```

Additional numeric columns are also accepted. For example:

```csv
epoch,precision,recall,map50,map5095,box_loss,cls_loss
```

The final row becomes the experiment's metric snapshot. All numeric columns except `epoch` are exposed as dynamic metrics in the API. Non-numeric columns are ignored for metric charts.

Visual cases are listed in the manifest and reference files under `sample_data/visual_cases/`.

Local Research Mode should later import an experiment run artifact folder, not the whole code project. A real run folder should look roughly like this:

```text
<your-local-path>/WildNight_Experiments/
  yolov8s_lowlight_aug_2026_06_01/
    metadata.yaml
    args.yaml
    results.csv
    weights/
      best.pt
      last.pt
    plots/
      confusion_matrix.png
      results.png
      PR_curve.png
    predictions/
      val_batch0_pred.jpg
    failures/
      manifest.json
      low_light_false_negative.jpg
```

VisionOps should store lightweight metadata and paths in SQLite. The original images, datasets, plots, and model weights should stay on disk.

Large datasets, private images, and model weights should stay outside the repository.
