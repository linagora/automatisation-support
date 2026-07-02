import type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  ConversationHistory,
  LatestUserAttachment,
  ResponsePlan,
  SupportProcessingPipelineInput,
  SupportTopicKnowledge,
  TurnUnderstandingDelta
} from "../../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";

export type SupportProcessingTestCase = {
  id: string;
  label: string;
  description: string;
  input: SupportProcessingPipelineInput;
  mockedTurnUnderstandingDelta?: TurnUnderstandingDelta;
  needsAttachment?: boolean;
  expected?: {
    shouldUseLlmTruster?: boolean;
    expectedLlmReviewRoute?: "continue" | "stop" | "failed";
    expectedFinalSecurityRoute?: "continue" | "stop";
    minUserResponseMessages?: number;
  };
};

const accountTrustStatus: AccountTrustStatus = {
  status: "trusted",
  reasons: [
    "longHistory",
    "legitimateSupportInteractions",
    "verifiedEmailDomain"
  ]
};

export const neutralAccountTrustStatus: AccountTrustStatus = {
  status: "neutral",
  reasons: ["newerAccount", "noKnownSuspiciousActivity"]
};

export const suspiciousAccountTrustStatus: AccountTrustStatus = {
  status: "suspicious",
  reasons: ["recentSuspiciousActivity"]
};

const accountProfile: AccountProfile = {
  accountType: "company",
  actualPlan: "paid",
  paymentStatus: "up_to_date",
  planHistory: [
    {
      plan: "paid",
      startedAt: "2025-01-01T00:00:00.000Z",
      endedAt: null
    }
  ],
  createdAt: "2025-01-01T00:00:00.000Z",
  daysSinceCreation: 512
};

const accountInteractionTraits: AccountInteractionTraits = {
  labels: ["technical", "needsGuidance"],
  lastUpdatedAt: "2026-05-21T08:00:00.000Z"
};

const emptyBotResponsePlan: ResponsePlan = {
  responseLanguage: "french",
  messagesPlan: {
    securityGatePlanMessage: undefined,
    suspiciousPlanMessage: undefined,
    lackComprehensionPlanMessage: undefined,
    scopeBoundaryPlanMessages: [],
    topicPlanMessages: [],
    signalPlanMessages: [],
    handoverPlanMessages: []
  }
};

const turn1Delta: TurnUnderstandingDelta = {
  user_language: "french",
  securityGateSummary: {
    gateChecked: {},
    gateFailed: []
  },
  segments_lack_comprehension: [],
  segments_topic: [
    {
      matched_historical_topic: "no",
      id_topic: 1,
      topic_category: "bug",
      tool_or_product: "Twake Drive",
      topic_action: "create",
      topic_object: "folder",
      topic_details: {
        platform: "mobile app",
        os: "Android",
        trigger_action: "click on create folder",
        observed_result: "nothing happens",
        expected_result: "folder should be created"
      },
      user_goal:
        "Create a folder in Twake Drive on Android mobile app but nothing happens when clicking the create folder button",
      blocking_issue: "no"
    },
    {
      matched_historical_topic: "no",
      id_topic: 2,
      topic_category: "access_security",
      tool_or_product: "Twake",
      topic_action: "reset",
      topic_object: "password",
      topic_details: {
        access_action: "reset password",
        observed_result: "no email received",
        expected_result: "receive password reset email"
      },
      user_goal:
        "Reset Twake account password but no password reset email is received",
      blocking_issue: "yes"
    }
  ],
  segments_signal: [
    {
      signal_verbatim: "Merci d'avance pour votre aide.",
      signal_types: ["thanks_neutral"]
    },
    {
      signal_verbatim: "c'est assez urgent pour moi",
      signal_types: ["time_sensitive"]
    }
  ],
  segments_scope_boundary: [
    {
      signal_verbatim:
        "au passage, est-ce que vous pouvez aussi m'aider à récupérer mon compte Instagram ?",
      scope_boundary_type: "non_support_linagora"
    }
  ],
  segments_suspicious: []
};

const supportTopicKnowledgeAfterTurn1: SupportTopicKnowledge = {
  segments_topic: turn1Delta.segments_topic.map((topicSegment) => {
    return {
      id_topic: topicSegment.id_topic,
      topic_category: topicSegment.topic_category || "other",
      tool_or_product: topicSegment.tool_or_product,
      topic_action: topicSegment.topic_action,
      topic_object: topicSegment.topic_object,
      topic_details: topicSegment.topic_details || {},
      user_goal: topicSegment.user_goal || "undefined",
      blocking_issue: topicSegment.blocking_issue || "no"
    };
  })
};

const conversationHistoryAfterTurn1: ConversationHistory = Object.assign(
  [
    {
      id: "history_turn_1_user",
      message_id: "msg_turn_1",
      role: "user" as const,
      created_at: "2026-05-21T09:00:00.000Z",
      turnUnderstandingDelta: turn1Delta
    },
    {
      id: "history_turn_1_bot",
      message_id: "bot_turn_1",
      role: "bot" as const,
      created_at: "2026-05-21T09:01:00.000Z",
      responsePlan: emptyBotResponsePlan
    }
  ],
  {
    contextLLM: [
      'User(topic): add_topic topic_id=1 label="Twake Drive : create : folder" category=bug',
      "User(topic): update_topic topic_id=1 fields=[platform, os, trigger_action, observed_result, expected_result]",
      'User(topic): add_topic topic_id=2 label="Twake : reset : password" category=access_security',
      "User(topic): update_topic topic_id=2 fields=[access_action, observed_result, expected_result]",
      'User(signal): signal types=[thanks_neutral] verbatim="Merci d\'avance pour votre aide."',
      'User(signal): signal types=[time_sensitive] verbatim="c\'est assez urgent pour moi"',
      'User(scope_boundary): scope_boundary type=non_support_linagora verbatim="au passage, est-ce que vous pouvez aussi m\'aider à récupérer mon compte Instagram ?"',
      "Bot(topic): acknowledge topic_id=1 next_step=wait_for_support",
      "Bot(topic): ask_more_info topic_id=2 fields=[auth_method, expected_result]",
      "Bot(signal): respond_signal types=[thanks_neutral, time_sensitive]",
      "Bot(scope_boundary): decline_scope_boundary type=non_support_linagora"
    ].join("\n")
  }
);

function buildInput(params: {
  id: string;
  content: string;
  accountTrustStatus?: AccountTrustStatus;
  supportTopicKnowledge?: SupportTopicKnowledge;
  conversationHistory?: ConversationHistory;
}): SupportProcessingPipelineInput {
  return {
    latestUserMessage: {
      id: params.id,
      channel: "email",
      sentAt: "2026-05-21T09:00:00.000Z",
      content: params.content
    },
    latestUserAttachments: [],
    accountTrustStatus: params.accountTrustStatus ?? accountTrustStatus,
    accountProfile,
    accountInteractionTraits,
    supportTopicKnowledge: params.supportTopicKnowledge || {
      segments_topic: []
    },
    conversationHistory: params.conversationHistory || []
  };
}

export const supportProcessingTestCases: SupportProcessingTestCase[] = [
  {
    id: "1",
    label: "End-to-end - two support topics with signal and scope boundary",
    description:
      "Runs the full pipeline on a rich support message with two topics, one thank-you signal, urgency, and one unrelated Instagram request.",
    input: buildInput({
      id: "support_pipeline_turn_1",
      content:
        "Bonjour, j’ai deux soucis. D’abord, dans Twake Drive, sur l’application mobile Android, quand je clique sur créer un dossier, rien ne se passe alors que le dossier devrait être créé. Ensuite, je n’arrive plus à accéder à mon compte Twake. Merci d'avance pour votre aide, c'est assez urgent pour moi. Et au passage, est-ce que vous pouvez aussi m'aider à récupérer mon compte Instagram ?"
    }),
    mockedTurnUnderstandingDelta: turn1Delta
  },
  {
    id: "2",
    label: "End-to-end - historical topic precision",
    description:
      "Runs the full pipeline with existing topic knowledge and a user adding details to a previous access issue.",
    input: buildInput({
      id: "support_pipeline_turn_2",
      content:
        "Désolé d'insister, mais pour la connexion, j’ai essayé de renvoyer l’email de réinitialisation trois fois. Je ne reçois toujours rien, même dans les spams. Je commence à être bloqué.",
      supportTopicKnowledge: supportTopicKnowledgeAfterTurn1,
      conversationHistory: conversationHistoryAfterTurn1
    })
  },
  {
    id: "3",
    label: "End-to-end - attachment support case",
    description:
      "Runs the full pipeline with an attachment added to a support message.",
    needsAttachment: true,
    input: buildInput({
      id: "support_pipeline_turn_3",
      content:
        "Merci pour le suivi. Pour le problème de création de dossier, voici une capture. Je clique sur Nouveau dossier, la fenêtre reste bloquée et le bouton de validation est grisé.",
      supportTopicKnowledge: supportTopicKnowledgeAfterTurn1,
      conversationHistory: conversationHistoryAfterTurn1
    })
  },
  {
    id: "4",
    label: "End-to-end - LLM truster review allows legitimate support URL",
    description:
      "Runs the full pipeline with a neutral account and a support message containing a URL, forcing latest-user-message security to ask the LLM truster.",
    input: buildInput({
      id: "support_pipeline_llm_truster_continue",
      accountTrustStatus: neutralAccountTrustStatus,
      content:
        "Bonjour, je n'arrive pas à me connecter à mon espace Twake. Voici l'URL de mon instance : https://samo.example.com. Pouvez-vous m'aider à comprendre pourquoi la connexion échoue ?"
    }),
    expected: {
      shouldUseLlmTruster: true,
      expectedLlmReviewRoute: "continue",
      expectedFinalSecurityRoute: "continue",
      minUserResponseMessages: 1
    }
  },
  {
    id: "5",
    label: "End-to-end - image-only weak text attachment topic creation",
    description:
      "Runs the full pipeline with weak text and an image attachment to verify fullweight can use attachmentAnalysis to create a topic.",
    needsAttachment: true,
    input: buildInput({
      id: "support_pipeline_image_only_attachment_topic",
      content: "Voici la capture.",
      accountTrustStatus,
      supportTopicKnowledge: {
        segments_topic: []
      },
      conversationHistory: []
    })
  }
];

export function withAttachment(
  testCase: SupportProcessingTestCase,
  attachment: LatestUserAttachment
): SupportProcessingTestCase {
  return {
    ...testCase,
    input: {
      ...testCase.input,
      latestUserAttachments: [attachment]
    }
  };
}
