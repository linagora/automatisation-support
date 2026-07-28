# Support Automation

Commandes locales pour tester et lancer le bot de support automatisé Matrix/Twake.

Ce README correspond au pipeline actuel :

```text
Matrix/Twake
→ buffer réel
→ runSupportAutomation
→ runSupportProcessingPipeline optimized
→ delivery Matrix/Twake
→ patch live memory
```

Les anciennes commandes `global-pipeline:*` ne sont plus utilisées dans le `package.json` actuel.

---

## Commandes principales

### Vérifier que le projet compile

```bash
npm run typecheck
```

Cette commande utilise :

```bash
tsc -p tsconfig.build.json --noEmit
```

C’est la commande à utiliser pour le périmètre actuel.

---

### Build

```bash
npm run build
```

---

### Tests actuels

```bash
npm test
```

ou :

```bash
npm run test:run
```

Ces commandes lancent uniquement :

```text
tests/current
```

---

## Attention à `typecheck:all`

```bash
npm run typecheck:all
```

Cette commande lance :

```bash
tsc --noEmit
```

Elle vérifie tout le dépôt, y compris d’anciens tests ou fichiers legacy qui peuvent référencer des modules supprimés.

À utiliser seulement si l’objectif est de nettoyer tout l’ancien périmètre.

Pour le pipeline actuel, utiliser plutôt :

```bash
npm run typecheck
```

---

## Vérifier la configuration Matrix/Twake

```bash
npm run matrix:check
```

Cette commande sert à vérifier que la configuration Matrix/Twake est correctement chargée depuis l’environnement.

---

## Écouter les événements Matrix/Twake

```bash
npm run matrix:listen
```

Utile pour vérifier que le bot reçoit bien les messages Matrix/Twake.

---

## Envoyer un message de test Matrix/Twake

```bash
npm run matrix:send-test
```

Utile pour vérifier que l’envoi Matrix/Twake fonctionne.

---

## Lancer le bot en dry-run

```bash
npm run automation:dry-run
```

Le dry-run lance le bot avec :

```bash
SUPPORT_MATRIX_DRY_RUN=true
```

En dry-run :

* le bot écoute les messages ;
* la pipeline est exécutée ;
* les réponses prévues sont loggées ;
* les messages ne sont pas réellement envoyés ;
* la live memory n’est pas patchée.

C’est la commande recommandée pour tester un scénario réel sans envoyer de réponse utilisateur.

---

## Lancer le bot en live

```bash
npm run automation:live
```

Le live lance le bot réel Matrix/Twake.

En live :

* le bot écoute les messages ;
* la pipeline est exécutée ;
* les réponses sont envoyées dans Matrix/Twake ;
* la live memory est patchée.

À utiliser seulement quand le dry-run est validé.

---

## Variables d’environnement

Le fichier `.env` doit être à la racine du projet :

```text
/home/georges/automatisation-support/.env
/home/georges/automatisation-support/src/
```

Les scripts `automation:*` chargent l’environnement avec :

```bash
-r dotenv/config
```

---

## Variables RAG requises

Le RAG actuel utilise ces variables :

```env
SUPPORT_RAG_API_URL=
SUPPORT_RAG_API_KEY=
SUPPORT_RAG_MODEL=
```

Il n’utilise pas les anciennes variables `LLM_RAG_*`.

Pour vérifier que ces variables sont bien lues depuis la racine du projet :

```bash
node -r dotenv/config -e "console.log({
  cwd: process.cwd(),
  hasApiUrl: Boolean(process.env.SUPPORT_RAG_API_URL),
  hasApiKey: Boolean(process.env.SUPPORT_RAG_API_KEY),
  hasModel: Boolean(process.env.SUPPORT_RAG_MODEL)
})"
```

Résultat attendu :

```text
{
  cwd: '/home/georges/automatisation-support',
  hasApiUrl: true,
  hasApiKey: true,
  hasModel: true
}
```

---

## Workflow recommandé avant un test live

```bash
npm run typecheck
npm run build
npm test
npm run automation:dry-run
```

Si le dry-run est correct :

```bash
npm run automation:live
```

---

## Workflow de debug RAG

Lancer le bot en dry-run :

```bash
npm run automation:dry-run
```

Puis reproduire le cas utilisateur dans Twake/Matrix.

Surveiller les logs :

```text
[support-rag]
```

Logs utiles attendus :

```text
[support-rag] create_default_client
[support-rag] request
[support-rag] response_ok
[support-rag] response_error
[support-rag] invalid_json
[support-rag] thrown
```

Si le log affiche :

```text
hasApiUrl: false
hasApiKey: false
hasModel: false
```

alors le process du bot ne lit pas correctement les variables RAG.

Si le log affiche :

```text
hasApiUrl: true
hasApiKey: true
hasModel: true
```

alors le RAG est bien configuré et il faut regarder les logs HTTP suivants.

---

## Tests attachment analysis

### Image locale

```bash
npm run test:local:image
```

### Image en ligne

```bash
npm run test:online:image
```

### Vidéo locale

```bash
npm run test:local:video
```

### Vidéo en ligne

```bash
npm run test:online:video
```

---

## Scripts actuellement disponibles

```json
{
  "scripts": {
    "test": "vitest run --passWithNoTests tests/current",
    "test:run": "vitest run --passWithNoTests tests/current",
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.build.json --noEmit",
    "typecheck:all": "tsc --noEmit",
    "matrix:check": "tsx scripts/matrix/matrix-tools.ts check",
    "matrix:listen": "tsx scripts/matrix/matrix-tools.ts listen",
    "matrix:send-test": "tsx scripts/matrix/matrix-tools.ts send-test",
    "automation:live": "tsx -r dotenv/config scripts/support-automation/runSupportAutomation.ts",
    "automation:dry-run": "SUPPORT_MATRIX_DRY_RUN=true tsx -r dotenv/config scripts/support-automation/runSupportAutomation.ts --dry-run",
    "test:local:image": "tsx -r dotenv/config scripts/attachment-analysis/test-local-image.ts",
    "test:online:image": "tsx -r dotenv/config scripts/attachment-analysis/test-online-image.ts",
    "test:local:video": "tsx -r dotenv/config scripts/attachment-analysis/test-local-video.ts",
    "test:online:video": "tsx -r dotenv/config scripts/attachment-analysis/test-online-video.ts"
  }
}
```

---

## Repères fichiers

Runner automation :

```text
scripts/support-automation/runSupportAutomation.ts
```

Runner principal :

```text
src/support-automation/runSupportAutomation.ts
```

Pipeline support optimisée :

```text
src/support-automation/support-processing-pipeline-optimized/runSupportProcessingPipelineOptimized.ts
```

Client RAG :

```text
src/infrastructure/rag/httpSupportRagClient.ts
```

Création du client RAG :

```text
src/infrastructure/rag/createDefaultSupportRagClient.ts
```

Outils Matrix :

```text
scripts/matrix/matrix-tools.ts
```

Configuration Matrix :

```text
src/infrastructure/matrix/loadMatrixChannelConfig.ts
```

Live memory :

```text
src/infrastructure/live-memory/
src/support-automation/patch-live-memory/
```

---

## Anciennes commandes supprimées

Les commandes suivantes ne sont plus présentes dans le `package.json` actuel :

```bash
npm run global-pipeline:fake
npm run global-pipeline:live
npm run global-pipeline:empty-data
```

Si un ancien README ou une ancienne note les mentionne encore, il faut les considérer comme obsolètes pour le pipeline actuel.

---

## Commandes les plus utiles au quotidien

Vérifier que le code actuel est propre :

```bash
npm run typecheck
npm run build
npm test
```

Tester sans envoyer de réponse réelle :

```bash
npm run automation:dry-run
```

Lancer le bot réel :

```bash
npm run automation:live
```

Vérifier Matrix/Twake :

```bash
npm run matrix:check
```
