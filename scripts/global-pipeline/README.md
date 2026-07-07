# Global Pipeline Test Runner

Unified test runner for the support automation global pipeline.

## Commands

Clean fake Matrix and live-memory test data:

```bash
npm run global-pipeline:empty-data
```

List all available cases and groups:

```bash
npm run global-pipeline:fake -- --list
```

Run one case:

```bash
npm run global-pipeline:fake -- --case double_charge_clarification --debug
```

Run by tags:

```bash
npm run global-pipeline:fake -- --tag billing,language --debug
```

Run by group:

```bash
npm run global-pipeline:fake -- --group smoke --debug
```

Run the real Matrix/Twake runner:

```bash
npm run global-pipeline:live
```

## Debug Reports

Use `--debug` to write readable run outputs into:

```text
tmp/global-pipeline-runs/<runId>/
  summary.json
  cases/
    <caseId>/
      summary.json
      debug.json
```

`tmp/global-pipeline-runs/<runId>/summary.json` is the global run summary.

`tmp/global-pipeline-runs/<runId>/cases/<caseId>/summary.json` is the short per-case summary.

`tmp/global-pipeline-runs/<runId>/cases/<caseId>/debug.json` is the complete per-case debug payload.

Example:

```bash
npm run global-pipeline:fake -- --case double_charge_clarification --debug
```

The terminal prints the per-case summary/debug paths and the global summary path.

## Split Debug Files

By default, debug mode no longer writes the older split files:

```text
scenario-report.json
input.json
pipeline-progress-events.json
pipeline-progress-summary.json
pipeline-partial.json
pipeline-output.json
pipeline-debug-status.json
dataset-assertions.json
```

Use `--split-debug-files` only when you also want those compatibility files:

```bash
npm run global-pipeline:fake -- --case double_charge_clarification --debug --split-debug-files
```

## Stop After A Pipeline Step

Use `--until` to stop after a specific support-processing step:

```text
security | plan | surface | standard | support | topics | knowledge | response-plan | compose | render | all
```

Examples:

```bash
npm run global-pipeline:fake -- --case double_charge_clarification --until topics --debug
npm run global-pipeline:fake -- --case double_charge_clarification --until render --debug
```

When `--until` is not `all`, the runner intentionally stops after the mapped pipeline step.

## Useful Workflows

Start from a clean state:

```bash
npm run global-pipeline:empty-data
```

Run a fast smoke check:

```bash
npm run global-pipeline:fake -- --group smoke --debug
```

Inspect a single case deeply:

```bash
npm run global-pipeline:fake -- --case double_charge_clarification --until render --debug --verbose
```

Run the full dataset carefully:

```bash
npm run global-pipeline:fake -- --all --serial --debug
```
