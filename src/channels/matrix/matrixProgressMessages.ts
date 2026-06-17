const DEFAULT_MATRIX_PROGRESS_MESSAGES = {
  buffer_started: "Je vous lis…",
  buffer_waiting: "Je regroupe vos messages…",
  buffer_flushed: "J’analyse votre demande…",
  analyzing: "J’analyse votre demande…",
  analyzing_surface: "Je comprends votre message…",
  analyzing_support: "Je qualifie le problème rencontré…",
  updating_topics: "Je rattache votre demande au bon sujet…",
  searching: "Je vérifie les informations utiles…",
  planning_response: "Je prépare la réponse…",
  rendering_response: "Je rédige la réponse…",
  building_user_response: "Je finalise la réponse…",
  sending_response: "J’envoie la réponse…",
  done: "Ci-dessous, voici ma réponse générée automatiquement.",
  failed: "Le traitement a échoué."
} as const;

export {
  DEFAULT_MATRIX_PROGRESS_MESSAGES
};
