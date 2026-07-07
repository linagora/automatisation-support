# GitHub Issues / Twake Docs -> OpenRAG indexer

Ce dossier permet de récupérer des issues GitHub ou la documentation web Twake, de les convertir en fichiers Markdown locaux, puis d'indexer uniquement une sélection dans OpenRAG.

Principe GitHub issues :

```txt
GitHub API
  -> issues + commentaires
  -> generated/issues/*.md
  -> generated/issues-manifest.json
  -> generated/selected-issues.json
  -> upload/indexation OpenRAG des issues sélectionnées
```

Principe Twake docs :

```txt
Twake docs web
  -> generated/docs/*.md
  -> generated/docs-manifest.json
  -> generated/selected-docs.json
  -> upload/indexation OpenRAG des pages sélectionnées
```

## 1. Prérequis

- Node.js 20 ou plus récent.
- Un token GitHub si le repo est privé ou si tu veux éviter les limites de rate limit.
- Un token OpenRAG seulement pour l'indexation réelle.

Aucune dépendance npm n'est nécessaire.

## 2. Configuration

Copie le fichier d'exemple :

```bash
cp .env.example .env
```

Puis remplis au minimum :

```env
GITHUB_OWNER=linagora
GITHUB_REPO=tmail-flutter
GITHUB_TOKEN=...
GITHUB_ISSUE_LIMIT=100
GITHUB_ISSUE_STATE=closed
GITHUB_ISSUE_SORT=comments
GITHUB_ISSUE_DIRECTION=desc

RUN_MODE=extract
OUTPUT_DIR=generated/issues
MANIFEST_FILE=generated/issues-manifest.json
SELECTION_FILE=generated/selected-issues.json

DOCS_BASE_URL=https://twake-docs.stg.lin-saas.com/
DOCS_START_URLS=
DOCS_AUTH_COOKIE=
DOCS_AUTHORIZATION_HEADER=
DOCS_EXTRA_HEADERS_JSON={}
DOCS_OUTPUT_DIR=generated/docs
DOCS_MANIFEST_FILE=generated/docs-manifest.json
DOCS_SELECTION_FILE=generated/selected-docs.json
DOCS_LIMIT=200
```

Pour l'indexation réelle, configure aussi :

```env
OPENRAG_BASE_URL=https://demo.open-rag.ai
OPENRAG_TOKEN=...
OPENRAG_AUTH_SCHEME=Bearer
OPENRAG_PARTITION=automatisation_support
OPENRAG_ISSUES_WORKSPACE=github_issues_support
OPENRAG_DOCS_WORKSPACE=twake_docs
OPENRAG_ALL_WORKSPACE=support_all
OPENRAG_ATTACH_TO_WORKSPACES=true
```

Si OpenRAG attend le token brut au lieu de `Authorization: Bearer <token>`, mets :

```env
OPENRAG_AUTH_SCHEME=
```

## 3. Workflow GitHub issues

### 1. Extraction

Pour repartir d'une extraction propre sans supprimer le dossier `generated` lui-même :

```bash
rm -rf generated/issues generated/issues-manifest.json
```

Puis lance :

```bash
RUN_MODE=extract node --env-file=.env main.mjs
```

Ce mode récupère les issues GitHub, écrit `generated/issues/*.md`, écrit `generated/issues-manifest.json`, puis s'arrête sans upload OpenRAG.

### 2. Review

Relis ou partage :

```txt
generated/issues-manifest.json
generated/issues/
```

Le manifest contient les issues récupérées, leurs compteurs de commentaires, labels, chemins Markdown et dates.

### 3. Sélection

Crée ou édite :

```txt
generated/selected-issues.json
```

Format par numéros :

```json
{
  "selectedIssueNumbers": [
    472,
    240
  ]
}
```

Format par `fileId` :

```json
{
  "selectedFileIds": [
    "github_linagora_tmail-flutter_issue_472"
  ]
}
```

Si le fichier de sélection n'existe pas, le script crée :

```txt
generated/selected-issues.example.json
```

### 4. Indexation dry-run

```bash
RUN_MODE=index-selected DRY_RUN=true node --env-file=.env main.mjs
```

Ce mode ne rappelle pas GitHub. Il lit le manifest et la sélection, puis affiche les fichiers qui seraient indexés.

### 5. Indexation réelle

```bash
RUN_MODE=index-selected DRY_RUN=false node --env-file=.env main.mjs
```

Ce mode ne rappelle pas GitHub. Il lit les Markdown locaux sélectionnés et les upload dans OpenRAG.

## 4. Options utiles

```env
RUN_MODE=extract                    # extract, index-selected, extract-and-index-selected, extract-docs, index-docs-selected, list-workspaces, create-workspaces, attach-selected-issues-to-workspaces
MANIFEST_FILE=generated/issues-manifest.json
SELECTION_FILE=generated/selected-issues.json
GITHUB_ISSUE_STATE=closed           # open, closed, all
GITHUB_ISSUE_SORT=comments          # created, updated, comments
GITHUB_ISSUE_DIRECTION=desc         # asc, desc
GITHUB_LABELS=bug,support           # optionnel
GITHUB_SINCE=2026-01-01T00:00:00Z
GITHUB_INCLUDE_COMMENTS=true
GITHUB_ISSUE_LIMIT=100
```

Upload OpenRAG :

```env
OPENRAG_UPLOAD_MODE=auto # auto, post, put
OPENRAG_ISSUES_WORKSPACE=github_issues_support
OPENRAG_DOCS_WORKSPACE=twake_docs
OPENRAG_ALL_WORKSPACE=support_all
OPENRAG_ATTACH_TO_WORKSPACES=true
```

- `auto` : vérifie si le fichier existe, puis `POST` ou `PUT`.
- `post` : ajoute uniquement.
- `put` : remplace systématiquement.
- `OPENRAG_ATTACH_TO_WORKSPACES=true` : après un upload réussi, rattache les fichiers aux workspaces de source et au workspace global.

## 5. Workflow Twake docs

### 1. Extraction docs

```bash
RUN_MODE=extract-docs DRY_RUN=true node --env-file=.env main.mjs
```

Ce mode part de `DOCS_BASE_URL`, crawle uniquement les liens internes, ignore les assets, écrit `generated/docs/*.md`, écrit `generated/docs-manifest.json`, puis s'arrête sans upload OpenRAG.

Si la documentation est protégée par auth, renseigne localement l'une de ces variables dans `.env` :

```env
DOCS_AUTH_COOKIE=
DOCS_AUTHORIZATION_HEADER=
DOCS_EXTRA_HEADERS_JSON={}
```

`DOCS_START_URLS` peut contenir une liste d'URLs de départ séparées par des virgules. Les URLs hors du host de `DOCS_BASE_URL` sont refusées. Les valeurs d'auth ne sont jamais logguées.

### 2. Review

```bash
zip -r /tmp/twake-docs-review.zip generated/docs generated/docs-manifest.json generated/selected-docs.example.json
```

Ne mets jamais `.env` dans les zips de review.

### 3. Sélection

Édite :

```txt
generated/selected-docs.json
```

Format par `fileId` :

```json
{
  "selectedFileIds": [
    "docs_twake_home"
  ]
}
```

Format par URL :

```json
{
  "selectedUrls": [
    "https://twake-docs.stg.lin-saas.com/"
  ]
}
```

Si le fichier de sélection n'existe pas, le script crée automatiquement :

```txt
generated/selected-docs.example.json
```

Le script n'indexe jamais automatiquement toute la documentation sans sélection.

### 4. Dry-run index docs

```bash
RUN_MODE=index-docs-selected DRY_RUN=true node --env-file=.env main.mjs
```

Ce mode ne crawle pas le site. Il lit `DOCS_MANIFEST_FILE` et `DOCS_SELECTION_FILE`, puis affiche les pages qui seraient indexées.

### 5. Indexation réelle

```bash
RUN_MODE=index-docs-selected DRY_RUN=false node --env-file=.env main.mjs
```

Ce mode ne crawle pas le site. Il lit les Markdown locaux sélectionnés et les upload dans OpenRAG avec des `fileId` stables du type `docs_twake_<slug>`.

## 6. Workspaces OpenRAG

Le script garde une seule partition OpenRAG, par exemple :

```env
OPENRAG_PARTITION=automatisation_support
```

Les sources sont organisées avec ces workspaces :

```env
OPENRAG_ISSUES_WORKSPACE=github_issues_support
OPENRAG_DOCS_WORKSPACE=twake_docs
OPENRAG_ALL_WORKSPACE=support_all
```

### 1. Lister les workspaces

```bash
RUN_MODE=list-workspaces node --env-file=.env main.mjs
```

Ce mode appelle `GET /partition/{OPENRAG_PARTITION}/workspaces`. Il ne fait aucune indexation et aucun rattachement.

### 2. Créer les workspaces

```bash
RUN_MODE=create-workspaces node --env-file=.env main.mjs
```

Ce mode crée :

```txt
github_issues_support -> GitHub Support Issues
twake_docs -> Twake Documentation
support_all -> All Support Knowledge
```

Si un workspace existe déjà, le script le loggue et continue.

### 3. Rattacher les issues déjà indexées

```bash
RUN_MODE=attach-selected-issues-to-workspaces node --env-file=.env main.mjs
```

Ce mode lit `MANIFEST_FILE` et `SELECTION_FILE`, résout les `fileId`, puis rattache les fichiers à `github_issues_support` et `support_all`. Il n'appelle pas GitHub, ne lit pas les Markdown et ne réuploade rien.

### 4. Tester recherche filtrée par workspace

```bash
curl -sG "$OPENRAG_BASE_URL/search/partition/$OPENRAG_PARTITION" \
  -H "Authorization: ${OPENRAG_AUTH_SCHEME:-Bearer} $OPENRAG_TOKEN" \
  --data-urlencode "workspace=github_issues_support" \
  --data-urlencode "text=slow load cache-control" \
  --data-urlencode "top_k=5" \
  | jq .
```

Ne mets jamais `.env` dans les zips de review.

## 7. Tester OpenRAG à la main

```bash
curl -s "$OPENRAG_BASE_URL/users/info" \
  -H "Authorization: Bearer $OPENRAG_TOKEN"
```

Si ça ne fonctionne pas avec `Bearer`, teste :

```bash
curl -s "$OPENRAG_BASE_URL/users/info" \
  -H "Authorization: $OPENRAG_TOKEN"
```

## 8. Format indexé

Chaque issue devient un fichier Markdown du type :

```txt
# GitHub issue #123: Title

## Metadata
Repository: owner/repo
Issue number: 123
State: open
Author: username
Created at: ...
Updated at: ...
Closed at: ...
Labels: bug, android
Assignees: ...
URL: ...

## Issue body
...

## Comments
...
```

Les métadonnées OpenRAG incluent :

```json
{
  "mimetype": "text/markdown",
  "source": "github_issue",
  "repository": "owner/repo",
  "issue_number": 123,
  "issue_state": "closed",
  "issue_title": "...",
  "github_url": "...",
  "labels": [],
  "assignees": [],
  "created_at": "...",
  "updated_at": "...",
  "closed_at": "...",
  "relationship_id": "github:owner/repo:issue:123"
}
```

Chaque page docs devient un fichier Markdown local dans `generated/docs/<slug-stable>.md`. Les métadonnées OpenRAG incluent :

```json
{
  "mimetype": "text/markdown",
  "source_type": "twake_docs",
  "source_url": "https://twake-docs.stg.lin-saas.com/...",
  "title": "...",
  "section": "...",
  "created_at": "..."
}
```
