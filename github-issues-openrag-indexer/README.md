# GitHub Issues -> OpenRAG indexer

Ce dossier permet de récupérer des issues GitHub, de les convertir en fichiers Markdown, puis d'indexer uniquement une sélection dans OpenRAG.

Principe :

```txt
GitHub API
  -> issues + commentaires
  -> generated/issues/*.md
  -> generated/issues-manifest.json
  -> generated/selected-issues.json
  -> upload/indexation OpenRAG des issues sélectionnées
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
```

Pour l'indexation réelle, configure aussi :

```env
OPENRAG_BASE_URL=https://demo.open-rag.ai
OPENRAG_TOKEN=...
OPENRAG_AUTH_SCHEME=Bearer
OPENRAG_PARTITION=automatisation_support
```

Si OpenRAG attend le token brut au lieu de `Authorization: Bearer <token>`, mets :

```env
OPENRAG_AUTH_SCHEME=
```

## 3. Workflow

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
RUN_MODE=extract                    # extract, index-selected
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
```

- `auto` : vérifie si le fichier existe, puis `POST` ou `PUT`.
- `post` : ajoute uniquement.
- `put` : remplace systématiquement.

## 5. Tester OpenRAG à la main

```bash
curl -s "$OPENRAG_BASE_URL/users/info" \
  -H "Authorization: Bearer $OPENRAG_TOKEN"
```

Si ça ne fonctionne pas avec `Bearer`, teste :

```bash
curl -s "$OPENRAG_BASE_URL/users/info" \
  -H "Authorization: $OPENRAG_TOKEN"
```

## 6. Format indexé

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
