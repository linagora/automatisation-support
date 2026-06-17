# plan-support-response

Dossier V2 pour le LLM de response planning.

Chemin cible conseillé :

```text
src/support-processing-pipeline/v2/plan-support-response/
```

Rôle : produire un plan de réponse structuré pour le renderer, sans rédiger la réponse finale.

Entrées principales :
- `textSurfaceAnalysis`
- `standardResponseFragments`
- `supportResponseCues`
- `textUnderstandings`
- `topicUpdateProposals`
- `existingTopics`
- `knowledgeEnrichmentPlan`
- `retrievedSupportKnowledge`
- `synthesizedRetrievedKnowledge`
- `recentInteractionContext`
- `extractableFieldCatalog`
- `responsePlanningPolicy`

Sortie principale :
- `SupportResponsePlan`

Le planner remplace conceptuellement la combinaison V1 `runSearchDecision` + `runResponsePlan`, mais avec une logique plus souple :
- pas de questions robotiques ;
- questions communes vs spécifiques ;
- prise en compte standard fragments et support response cues ;
- prudence si RAG absent ;
- instructions structurées pour le renderer ;
- rationale interne pour debug.

Notes d’intégration :
- brancher après `planKnowledgeEnrichment` mock / RAG ;
- ne pas appeler pour les cas purement standard-only ;
- transporter `responsePlan.responsePlan` vers le renderer ;
- le formatter retourne aussi `validation` pour debug.
