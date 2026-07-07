```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 22, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB
  A[Entrée planSupportResponse] --> B[Construire la task planner]

  B --> B1[targetLanguage]
  B --> B2[responsePlanningPolicy]
  B --> B3[topicUserMessageContent]
  B --> B4[topicSnapshot sanitized]
  B --> B5[relatedTextUnderstandings]
  B --> B6[relatedAttachmentUnderstandings]
  B --> B7[relatedSupportResponseCues]
  B --> B8[selectedCatalogKnowledge]
  B --> B9[topicKnowledgeEnrichmentPlan]
  B --> B10[topicRetrievedKnowledgeSynthesis]

  B1 --> C[Planner LLM]
  B2 --> C
  B3 --> C
  B4 --> C
  B5 --> C
  B6 --> C
  B7 --> C
  B8 --> C
  B9 --> C
  B10 --> C

  C --> D[1. Comprendre le topic]
  D --> D1[Identifier ce que l'utilisateur signale]
  D --> D2[Identifier ce qu'il demande]
  D --> D3[Identifier ce qui est déjà essayé]
  D --> D4[Identifier ce qui est déjà connu dans topicSnapshot / attachments]

  D1 --> E[2. Existe-t-il une réponse fiable ?]
  D2 --> E
  D3 --> E
  D4 --> E

  E -->|Oui| F[Ajouter des answer points]
  F --> F1[Source possible: retrieved_knowledge]
  F --> F2[Source possible: selected_catalog_knowledge explicite]
  F --> F3[Source possible: topic facts vérifiés ou user-reported]
  F --> F4[Source possible: attachment evidence]
  F --> F5[Source possible: policy]

  E -->|Non| G[Ne pas inventer de réponse]

  F --> H[3. Faut-il poser une question ?]
  G --> H

  H -->|Oui| I[Choisir les questions utiles]
  I --> I1[Champ présent dans selectedCatalogKnowledge.selectedFields]
  I --> I2[Champ askable par l'utilisateur]
  I --> I3[Champ manquant]
  I --> I4[Champ décisif maintenant]
  I --> I5[Respect maxQuestionsPerTopic / maxTotalQuestions]

  H -->|Non| J[Pas de question]

  I --> K{Réponse fiable ou question utile ?}
  J --> K

  K -->|Oui| L[Construire le plan normal]
  K -->|Non| M[Fallback human review]

  M --> M1[answer vide]
  M --> M2[ask vide]
  M --> M3[review explique pourquoi revue humaine]
  M --> M4[say demande au renderer d'accuser réception + dire qu'une revue support est nécessaire]

  L --> N[Construire say]
  M4 --> N

  N --> N1[Mentionner le problème concret]
  N --> N2[Framing prudent: user reports / user indicates]
  N --> N3[Inclure answer points supportés]
  N --> N4[Inclure les questions utiles s'il y en a]
  N --> N5[Inclure human review si nécessaire]
  N --> N6[Inclure limites: pas de promesse / pas d'invention]

  N1 --> O[Output JSON ResponsePlan]
  N2 --> O
  N3 --> O
  N4 --> O
  N5 --> O
  N6 --> O

  O --> O1[topicId]
  O --> O2[acknowledge]
  O --> O3[answer]
  O --> O4[ask]
  O --> O5[say]
  O --> O6[review]
  ```