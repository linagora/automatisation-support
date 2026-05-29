import type {
  AccountTrustStatus,
  ConversationHistory,
  LatestUserAttachment,
  MessageAnalysisInput,
  ResponsePlan,
  SupportTopicKnowledge,
  TurnUnderstandingDelta
} from "../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

export type MessageAnalysisTestCase = {
  id: string;
  label: string;
  description: string;
  input: MessageAnalysisInput;
  needsAttachment?: boolean;
};

const accountTrustStatus: AccountTrustStatus = {
  status: "trusted",
  reasons: [
    "longHistory",
    "legitimateSupportInteractions",
    "verifiedEmailDomain"
  ]
};

const emptyBotResponsePlan: ResponsePlan = {
  responseLanguage: "french",
  messagesPlan: {
    inputCleaningPlanMessages: [],
    scopeBoundaryPlanMessages: [],
    topicPlanMessages: [],
    signalPlanMessages: [],
    handoverPlanMessages: []
  }
};

const turn1Delta: TurnUnderstandingDelta = {
  user_language: "French",
  segments_lack_comprehension: [],
  segments_topic: [
    {
      matched_historical_topic: "no",
      id_topic: 1,
      topic_category: "bug",
      tool_or_product: "Twake Drive",
      topic_action: "create",
      topic_object: "folder",
      topic_label: "Twake Drive : create : folder",
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
      topic_label: "Twake : reset : password",
      topic_details: {
        access_action: "reset password",
        auth_method: "email",
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
      signal_verbatim: "C'est assez urgent pour moi",
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
  segments_topic: [
    {
      id_topic: 1,
      topic_category: "bug",
      tool_or_product: "Twake Drive",
      topic_action: "create",
      topic_object: "folder",
      topic_label: "Twake Drive : create : folder",
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
      id_topic: 2,
      topic_category: "access_security",
      tool_or_product: "Twake",
      topic_action: "reset",
      topic_object: "password",
      topic_label: "Twake : reset : password",
      topic_details: {
        access_action: "reset password",
        auth_method: "email",
        observed_result: "no email received",
        expected_result: "receive password reset email"
      },
      user_goal:
        "Reset Twake account password but no password reset email is received",
      blocking_issue: "yes"
    }
  ]
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
      "User(topic): update_topic topic_id=2 fields=[access_action, auth_method, observed_result, expected_result]",
      'User(signal): signal types=[thanks_neutral] verbatim="Merci d\'avance pour votre aide."',
      'User(signal): signal types=[time_sensitive] verbatim="C\'est assez urgent pour moi"',
      'User(scope_boundary): scope_boundary type=non_support_linagora verbatim="au passage, est-ce que vous pouvez aussi m\'aider à récupérer mon compte Instagram ?"',
      "Bot(topic): acknowledge topic_id=1 next_step=wait_for_support",
      "Bot(topic): ask_more_info topic_id=2 fields=[auth_method, expected_result]",
      "Bot(signal): respond_signal types=[thanks_neutral, time_sensitive]",
      "Bot(scope_boundary): decline_scope_boundary type=non_support_linagora"
    ].join("\n")
  }
);

const turn2Delta: TurnUnderstandingDelta = {
  user_language: "French",
  segments_lack_comprehension: [],
  segments_topic: [
    {
      matched_historical_topic: "yes",
      id_topic: 2,
      topic_details: {
        affected_scope:
          "password reset emails are not received, even in spam folder",
        additional_context:
          "user tried to send the reset email three times"
      },
      tested_actions: [
        {
          tested_action: "send password reset email three times",
          outcome_tested_action: "failed"
        }
      ],
      user_goal:
        "Reset Twake account password but no password reset email is received, even after three attempts and spam folder check",
      blocking_issue: "yes"
    }
  ],
  segments_signal: [
    {
      signal_verbatim: "Désolé d'insister",
      signal_types: ["apology"]
    },
    {
      signal_verbatim: "je commence à être un peu bloqué",
      signal_types: ["disappointment"]
    }
  ],
  segments_scope_boundary: [
    {
      signal_verbatim:
        "rien à voir, mais est-ce que vous pouvez aussi m'aider à configurer mon imprimante ?",
      scope_boundary_type: "unrelated_request"
    }
  ],
  segments_suspicious: []
};

const supportTopicKnowledgeAfterTurn2: SupportTopicKnowledge = {
  segments_topic: [
    supportTopicKnowledgeAfterTurn1.segments_topic[0],
    {
      ...supportTopicKnowledgeAfterTurn1.segments_topic[1],
      topic_details: {
        ...supportTopicKnowledgeAfterTurn1.segments_topic[1].topic_details,
        affected_scope:
          "password reset emails are not received, even in spam folder",
        additional_context:
          "user tried to send the reset email three times"
      },
      tested_actions: [
        {
          tested_action: "send password reset email three times",
          outcome_tested_action: "failed"
        }
      ],
      user_goal:
        "Reset Twake account password but no password reset email is received, even after three attempts and spam folder check"
    }
  ]
};

const conversationHistoryAfterTurn2: ConversationHistory = Object.assign(
  [
    ...conversationHistoryAfterTurn1,
    {
      id: "history_turn_2_user",
      message_id: "msg_turn_2",
      role: "user" as const,
      created_at: "2026-05-21T09:15:00.000Z",
      turnUnderstandingDelta: turn2Delta
    },
    {
      id: "history_turn_2_bot",
      message_id: "bot_turn_2",
      role: "bot" as const,
      created_at: "2026-05-21T09:16:00.000Z",
      responsePlan: emptyBotResponsePlan
    }
  ],
  {
    contextLLM: [
      conversationHistoryAfterTurn1.contextLLM,
      "User(topic): continue_topic topic_id=2",
      "User(topic): update_topic topic_id=2 fields=[affected_scope, additional_context]",
      'User(topic): tested_solution topic_id=2 action="send password reset email three times" outcome=failed',
      "User(topic): mark_blocking topic_id=2",
      'User(signal): signal types=[apology] verbatim="Désolé d\'insister"',
      'User(signal): signal types=[disappointment] verbatim="je commence à être un peu bloqué"',
      'User(scope_boundary): scope_boundary type=unrelated_request verbatim="rien à voir, mais est-ce que vous pouvez aussi m\'aider à configurer mon imprimante ?"',
      "Bot(topic): ask_more_info topic_id=2 fields=[auth_method]",
      "Bot(scope_boundary): decline_scope_boundary type=unrelated_request"
    ]
      .filter(Boolean)
      .join("\n")
  }
);

export const messageAnalysisTestCases: MessageAnalysisTestCase[] = [
  {
    id: "1",
    label: "Turn 1 — two new topics with signal and scope boundary",
    description:
      "The user sends one message containing two support topics, a thank-you signal, urgency, and one unrelated Instagram request.",
    input: {
      latestUserMessage: {
        id: "msg_turn_1",
        channel: "email",
        sentAt: "2026-05-21T09:00:00.000Z",
        content:
          "Bonjour, j’ai deux soucis. D’abord, dans Twake Drive, quand je clique sur créer un dossier sur l’application mobile Android, rien ne se passe. Ensuite, je n’arrive plus à me connecter à mon compte Twake : j’ai demandé une réinitialisation de mot de passe mais je ne reçois aucun email. Merci d'avance pour votre aide, c'est assez urgent pour moi. Et au passage, est-ce que vous pouvez aussi m'aider à récupérer mon compte Instagram ?"
      },
      latestUserAttachments: [],
      accountTrustStatus,
      supportTopicKnowledge: {
        segments_topic: []
      },
      conversationHistory: []
    }
  },
  {
    id: "2",
    label: "Turn 2 — text precision for topic 2 with noise",
    description:
      "The user only adds details about the password reset issue, while also adding apology/disappointment signals and an unrelated printer request.",
    input: {
      latestUserMessage: {
        id: "msg_turn_2",
        channel: "email",
        sentAt: "2026-05-21T09:15:00.000Z",
        content:
          "Désolé d'insister, mais pour la connexion, j’ai essayé de renvoyer l’email de réinitialisation trois fois. Je ne reçois toujours rien, même dans les spams. Mon adresse est georges@example.com et je commence à être un peu bloqué. Rien à voir, mais est-ce que vous pouvez aussi m'aider à configurer mon imprimante ?"
      },
      latestUserAttachments: [],
      accountTrustStatus,
      supportTopicKnowledge: supportTopicKnowledgeAfterTurn1,
      conversationHistory: conversationHistoryAfterTurn1
    }
  },
  {
    id: "3",
    label: "Turn 3 — attachment precision for topic 1 with noise",
    description:
      "The user adds text and an attachment about the folder creation issue, with a positive signal and an unrelated Canva request.",
    needsAttachment: true,
    input: {
      latestUserMessage: {
        id: "msg_turn_3",
        channel: "email",
        sentAt: "2026-05-21T09:30:00.000Z",
        content:
          "Merci pour le suivi. Pour le problème de création de dossier, voici une capture. Je clique sur « Nouveau dossier », la fenêtre reste bloquée et le bouton de validation est grisé. À part ça, je sais que ce n'est probablement pas votre périmètre, mais est-ce que vous savez pourquoi mon design Canva ne s'exporte pas ?"
      },
      latestUserAttachments: [],
      accountTrustStatus,
      supportTopicKnowledge: supportTopicKnowledgeAfterTurn2,
      conversationHistory: conversationHistoryAfterTurn2
    }
  }
];

export function withAttachment(
  testCase: MessageAnalysisTestCase,
  attachment: LatestUserAttachment
): MessageAnalysisTestCase {
  return {
    ...testCase,
    input: {
      ...testCase.input,
      latestUserAttachments: [attachment]
    }
  };
}
