# plan-support-response

Dossier V2 pour le LLM de response planning.

Chemin cible conseillé :

```text
src/support-processing-pipeline-v2/plan-support-response/
```

Rôle : produire un plan de réponse strict pour un seul topic, sans rédiger la
réponse finale. Le renderer fusionne ensuite zéro, un ou plusieurs
`topicResponsePlans`.

Entrées principales :
- `topicUserMessageContent`
- `targetLanguage`
- `topicEvidence`
- `selectedCatalogKnowledge`
- `topicKnowledgeEnrichmentPlan`
- `topicRetrievedKnowledgeSynthesis`
- `responsePlanningPolicy`

Sortie principale :
- `SupportResponsePlan`

Le planner ne sélectionne pas le topic, le catalogue ou les connaissances. Il
reçoit uniquement les données déjà réduites pour sa branche :
- pas de questions robotiques ;
- une question décisive plutôt que plusieurs questions faibles ;
- prise en compte des attachments liés au topic ;
- prudence si RAG absent ;
- instructions structurées pour le renderer ;
- rationale interne pour debug.

Notes d’intégration :
- brancher après la sélection catalogue et l’enrichissement knowledge du topic ;
- ne pas appeler pour les cas purement standard-only ;
- transporter chaque `responsePlan.responsePlan` dans `topicResponsePlans` ;
- le formatter retourne aussi `validation` pour debug.
