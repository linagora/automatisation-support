# Global Pipeline

Commandes locales pour tester le flux support complet avec fake Matrix.

## Commandes principales

Nettoyer les données de test :

```bash
npm run global-pipeline:empty-data
```

Runner fake Matrix local :

```bash
npm run global-pipeline:fake
```

Runner live Matrix/Twake réel :

```bash
npm run global-pipeline:live
```

## Voir les cas et groupes disponibles

```bash
npm run global-pipeline:fake -- --list
```

## Lancer un cas précis

```bash
npm run global-pipeline:fake -- --case double_charge_clarification --debug
```

Avec logs détaillés dans le terminal :

```bash
npm run global-pipeline:fake -- --case double_charge_clarification --debug --verbose
```

Avec clean avant :

```bash
npm run global-pipeline:empty-data
npm run global-pipeline:fake -- --case double_charge_clarification --debug
```

## Lancer plusieurs cas

```bash
npm run global-pipeline:fake -- --case double_charge_clarification,android_notifications_already_tried --debug
```

## Lancer par tag

```bash
npm run global-pipeline:fake -- --tag billing --debug
```

```bash
npm run global-pipeline:fake -- --tag billing,language --debug
```

```bash
npm run global-pipeline:fake -- --tag android,notifications --debug
```

Les tags sont en logique OR.

## Lancer par groupe

```bash
npm run global-pipeline:fake -- --group smoke --debug
```

```bash
npm run global-pipeline:fake -- --group billing-regression --debug
```

```bash
npm run global-pipeline:fake -- --group android-notifications --debug
```

```bash
npm run global-pipeline:fake -- --group regression --debug
```

Plusieurs groupes :

```bash
npm run global-pipeline:fake -- --group billing-regression,android-notifications --debug
```

## Lancer tout le dataset

En série :

```bash
npm run global-pipeline:fake -- --all --serial --debug
```

En parallèle :

```bash
npm run global-pipeline:fake -- --all --parallel --concurrency 3 --debug
```

Par vagues :

```bash
npm run global-pipeline:fake -- --all --wave-size 3 --wave-delay-ms 10000 --debug
```

## Stopper à une étape précise

Jusqu’à l’analyse surface :

```bash
npm run global-pipeline:fake -- --case language-it-notifications --until surface --debug --verbose
```

Jusqu’aux topics :

```bash
npm run global-pipeline:fake -- --case double_charge_clarification --until topics --debug --verbose
```

Jusqu’au render :

```bash
npm run global-pipeline:fake -- --case double_charge_clarification --until render --debug --verbose
```

Étapes disponibles :

```text
--until security
--until plan
--until surface
--until standard
--until support
--until topics
--until knowledge
--until response-plan
--until compose
--until render
--until all
```

Quand `--until` n’est pas `all`, le run s’arrête volontairement et le statut du cas peut être `stopped`.

## Fichiers debug

Avec `--debug`, les fichiers sont écrits dans :

```text
tmp/global-pipeline-runs/<runId>/
```

Pour chaque cas :

```text
tmp/global-pipeline-runs/<runId>/<caseId>/
  scenario-report.json
  input.json
  pipeline-progress-events.json
  pipeline-progress-summary.json
  pipeline-partial.json
  pipeline-output.json
  pipeline-debug-status.json
  dataset-assertions.json
```

Lire le rapport :

```bash
cat tmp/global-pipeline-runs/<runId>/<caseId>/scenario-report.json | jq
```

Lire le debug interne :

```bash
cat tmp/global-pipeline-runs/<runId>/<caseId>/pipeline-partial.json | jq
```

Lire la réponse finale :

```bash
cat tmp/global-pipeline-runs/<runId>/<caseId>/scenario-report.json | jq '.sentContent'
```

## Clean data

```bash
npm run global-pipeline:empty-data
```

Vide et recrée :

```text
data/fake-received/
data/fake-sent/
data/live-memory-context/
```

Ne touche pas à :

```text
tmp/global-pipeline-runs/
```

## Workflows utiles

Clean + smoke :

```bash
npm run global-pipeline:empty-data
npm run global-pipeline:fake -- --group smoke --debug
```

Clean + cas précis :

```bash
npm run global-pipeline:empty-data
npm run global-pipeline:fake -- --case double_charge_clarification --debug
```

Debug profond :

```bash
npm run global-pipeline:empty-data
npm run global-pipeline:fake -- --case double_charge_clarification --until render --debug --verbose
```

Billing + language :

```bash
npm run global-pipeline:empty-data
npm run global-pipeline:fake -- --tag billing,language --debug
```

Full regression en série :

```bash
npm run global-pipeline:empty-data
npm run global-pipeline:fake -- --group regression --serial --debug
```

## Scripts package.json attendus

```json
{
  "scripts": {
    "global-pipeline:fake": "tsx scripts/global-pipeline/runners/fake-matrix/runGlobalPipelineDataset.ts",
    "global-pipeline:empty-data": "tsx scripts/global-pipeline/runners/fake-matrix/runGlobalPipelineDataset.ts --empty-data",
    "global-pipeline:live": "tsx scripts/global-pipeline/runners/live-matrix/runMatrixSupportProcessingV2.ts"
  }
}
```

## Repères

Dataset :

```text
scripts/global-pipeline/dataset/textAnalysisDataset.ts
```

Groupes :

```text
scripts/global-pipeline/dataset/groups/
```

Runner fake :

```text
scripts/global-pipeline/runners/fake-matrix/runGlobalPipelineDataset.ts
```

Runner live :

```text
scripts/global-pipeline/runners/live-matrix/runMatrixSupportProcessingV2.ts
```

Le runner fake simule seulement les bords Matrix :

```text
fake Matrix listener
→ buffer réel
→ build input réel
→ pipeline V2 réelle
→ fake sent
→ live memory réelle
```
