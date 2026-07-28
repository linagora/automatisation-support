type TopicBranchCatalogEntry = {
  extractionGuidance: string;
};

type UnclearTopicFragment = {
  key: string;
  fragment: string;
};

const supportNeedCatalog = {
  issue_resolution: {
    extractionGuidance: "Use when the topic needs investigation or resolution of a problem, malfunction, blocked state, error, failed workflow, unexpected behavior, or abnormal result."
  },
  knowledge_answer: {
    extractionGuidance: "Use when the topic primarily needs an answer, explanation, how-to guidance, policy, availability, compatibility, pricing, product behavior explanation, or support knowledge."
  },
  support_action: {
    extractionGuidance: "Use when the topic primarily needs support to do, check, change, process, intervene, reset, unlock, refund, escalate, verify, or handle something."
  },
  feature_request: {
    extractionGuidance: "Use when the topic primarily asks for a missing capability, desired product improvement, new feature, product gap, or enhancement request."
  },
  unclear: {
    extractionGuidance: "Use when the support need cannot be chosen confidently between issue_resolution, knowledge_answer, support_action, or feature_request."
  }
} as const satisfies Record<string, TopicBranchCatalogEntry>;

const supportNeedUnclearReasonCatalog = {
  knowledge_answer_or_issue_resolution: {
    extractionGuidance: "Use when the topic may be either a request for instructions/knowledge or a report of being blocked by a malfunction."
  },
  knowledge_answer_or_support_action: {
    extractionGuidance: "Use when the topic may be either a knowledge question or a request for support to perform an action."
  },
  issue_resolution_or_support_action: {
    extractionGuidance: "Use when the topic may be either a problem to investigate or a request for support to take action."
  },
  feature_request_or_issue_resolution: {
    extractionGuidance: "Use when the topic may be either a desired missing feature or a broken/missing behavior that should already work."
  },
  feature_request_or_knowledge_answer: {
    extractionGuidance: "Use when the topic may be either a feature request or a question about whether/how the product already supports the capability."
  },
  too_ambiguous: {
    extractionGuidance: "Use when the topic is too ambiguous to identify a more specific support need ambiguity."
  }
} as const satisfies Record<string, TopicBranchCatalogEntry>;

const unclearTopicFragmentsCatalog = {
  support_domain_unclear: {
    key: "support_domain_unclear",
    fragment: "Je n’ai pas encore bien identifié le sujet précis de votre demande. Pouvez-vous préciser la partie du produit ou du service concernée ?"
  },
  support_need_unclear: {
    key: "support_need_unclear",
    fragment: "Je veux être sûr de bien comprendre votre besoin avant de le traiter. Pouvez-vous préciser ce que vous attendez exactement ?"
  },
  knowledge_answer_or_issue_resolution: {
    key: "knowledge_answer_or_issue_resolution",
    fragment: "Je ne suis pas encore sûr si vous signalez un problème à résoudre ou si vous cherchez simplement une explication. Pouvez-vous préciser ?"
  },
  knowledge_answer_or_support_action: {
    key: "knowledge_answer_or_support_action",
    fragment: "Je ne suis pas encore sûr si vous voulez une information ou si vous souhaitez que le support effectue une action. Pouvez-vous préciser ?"
  },
  issue_resolution_or_support_action: {
    key: "issue_resolution_or_support_action",
    fragment: "Je ne suis pas encore sûr si vous décrivez un problème à diagnostiquer ou si vous demandez une intervention du support. Pouvez-vous préciser ?"
  },
  feature_request_or_issue_resolution: {
    key: "feature_request_or_issue_resolution",
    fragment: "Je ne suis pas encore sûr si vous demandez une nouvelle fonctionnalité ou si vous signalez un comportement anormal. Pouvez-vous préciser ?"
  },
  feature_request_or_knowledge_answer: {
    key: "feature_request_or_knowledge_answer",
    fragment: "Je ne suis pas encore sûr si vous demandez si une fonctionnalité existe déjà ou si vous souhaitez proposer une amélioration. Pouvez-vous préciser ?"
  },
  too_ambiguous: {
    key: "too_ambiguous",
    fragment: "Votre demande est encore trop ambiguë pour être traitée correctement. Pouvez-vous reformuler en indiquant ce que vous essayez de faire et ce qui bloque ?"
  }
} as const satisfies Record<string, UnclearTopicFragment>;

type SupportNeed = keyof typeof supportNeedCatalog;
type SupportNeedUnclearReason = keyof typeof supportNeedUnclearReasonCatalog;
type UnclearTopicFragmentKey = keyof typeof unclearTopicFragmentsCatalog;

function getUnclearTopicFragment(key: UnclearTopicFragmentKey): string {
  return unclearTopicFragmentsCatalog[key].fragment;
}

export {
  getUnclearTopicFragment,
  supportNeedCatalog,
  supportNeedUnclearReasonCatalog,
  unclearTopicFragmentsCatalog
};

export type {
  SupportNeed,
  SupportNeedUnclearReason,
  TopicBranchCatalogEntry,
  UnclearTopicFragmentKey
};
