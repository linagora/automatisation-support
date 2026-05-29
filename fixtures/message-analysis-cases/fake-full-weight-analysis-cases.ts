import type {
  MessageAnalysisInput,
  TurnUnderstandingDelta
} from "./src/support-processing-pipeline/typesSupportProcessingPipeline.types";

import type {
  AttachmentAnalysis,
  LightWeightMessageAnalysis
} from "./src/support-processing-pipeline/message-analysis/fullweight-message-analysis/typesFullWeightMessageAnalysis.types";

export type FullWeightAnalysisTestCase = {
  id: string;
  label: string;
  description: string;
  messageAnalysisInput: MessageAnalysisInput;
  attachmentAnalysis?: AttachmentAnalysis;
  lightWeightMessageAnalysis?: LightWeightMessageAnalysis;
};

const previousAccessIssueDelta: TurnUnderstandingDelta = {
  user_language: "French",
  segments_lack_comprehension: [],
  segments_topic: [
    {
      matched_historical_topic: "no",
      id_topic: 1,
      topic_category: "access_security",
      tool_or_product: "Twake",
      topic_action: "log in",
      topic_object: "account",
      topic_label: "Twake : log in : account",
      topic_details: {
        access_action: "log in",
        observed_result: "user cannot log in"
      },
      user_goal: "Twake : log in : account — user cannot access account",
      blocking_issue: "yes"
    }
  ],
  segments_signal: [],
  segments_scope_boundary: [],
  segments_suspicious: []
};

export const fullWeightAnalysisTestCases: FullWeightAnalysisTestCase[] = [
  {
    id: "1",
    label: "New bug without history",
    description: "User reports a new folder creation bug.",
    messageAnalysisInput: {
      latestUserMessage: {
        id: "msg_case_1_latest",
        content:
          "Bonjour, quand je clique sur créer un dossier dans Twake Drive, rien ne se passe. Je suis sur l'application mobile Android.",
        channel: "email",
        sentAt: "2026-05-21T09:00:00.000Z"
      },
      latestUserAttachments: [],
      accountTrustStatus: {
        status: "trusted",
        reasons: ["longHistory", "legitimateSupportInteractions"]
      },
      supportTopicKnowledge: {
        segments_topic: []
      },
      conversationHistory: []
    },
    lightWeightMessageAnalysis: {
      shouldRunSupportMessageAnalysis: true,
      user_language: "French",
      segments_signal: [],
      segments_scope_boundary: [],
      segments_suspicious: []
    }
  },
  {
    id: "2",
    label: "Matched access issue with tested action",
    description: "User updates an existing login issue after trying a reset.",
    messageAnalysisInput: {
      latestUserMessage: {
        id: "msg_case_2_latest",
        content:
          "J'ai essayé de réinitialiser mon mot de passe comme demandé, mais ça ne marche toujours pas. J'ai maintenant le message « lien expiré ».",
        channel: "twake_chat",
        sentAt: "2026-05-21T10:00:00.000Z"
      },
      latestUserAttachments: [],
      accountTrustStatus: {
        status: "neutral",
        reasons: ["legitimateSupportInteractions"]
      },
      supportTopicKnowledge: {
        segments_topic: [
          {
            id_topic: 1,
            topic_category: "access_security",
            tool_or_product: "Twake",
            topic_action: "log in",
            topic_object: "account",
            topic_label: "Twake : log in : account",
            topic_details: {
              access_action: "log in",
              observed_result: "user cannot log in"
            },
            user_goal: "Twake : log in : account — user cannot access account",
            blocking_issue: "yes"
          }
        ]
      },
      conversationHistory: [
        {
          id: "history_case_2_user_1",
          message_id: "msg_case_2_previous_user",
          role: "user",
          created_at: "2026-05-20T15:00:00.000Z",
          turnUnderstandingDelta: previousAccessIssueDelta
        },
        {
          id: "history_case_2_bot_1",
          message_id: "msg_case_2_previous_bot",
          role: "bot",
          created_at: "2026-05-20T15:05:00.000Z",
          responsePlan: {
            responseLanguage: "french",
            messagesPlan: {
              inputCleaningPlanMessages: [],
              scopeBoundaryPlanMessages: [],
              topicPlanMessages: [
                {
                  topic_response: {
                    topic_id: 1,
                    topic_category: "access_security",
                    topic_label: "Twake : log in : account",
                    main_response: "ask_fields",
                    fields_requested: ["error_message"],
                    next_step: "wait_more_info"
                  }
                }
              ],
              signalPlanMessages: [],
              handoverPlanMessages: []
            }
          }
        }
      ]
    },
    lightWeightMessageAnalysis: {
      shouldRunSupportMessageAnalysis: true,
      user_language: "French",
      segments_signal: [],
      segments_scope_boundary: [],
      segments_suspicious: []
    }
  },
  {
    id: "3",
    label: "Billing issue with positive signal",
    description: "User thanks support and reports a double billing issue.",
    messageAnalysisInput: {
      latestUserMessage: {
        id: "msg_case_3_latest",
        content:
          "Merci pour votre aide. Par contre j'ai été débité deux fois de 9,99€ ce mois-ci pour mon abonnement premium.",
        channel: "email",
        sentAt: "2026-05-21T11:00:00.000Z"
      },
      latestUserAttachments: [],
      accountTrustStatus: {
        status: "trusted",
        reasons: ["payingCustomer", "verifiedEmailDomain"]
      },
      supportTopicKnowledge: {
        segments_topic: []
      },
      conversationHistory: [
        {
          id: "history_case_3_system_1",
          message_id: "system_case_3_note",
          role: "system",
          created_at: "2026-05-21T10:55:00.000Z",
          note: "Customer is on a premium plan."
        }
      ]
    },
    lightWeightMessageAnalysis: {
      shouldRunSupportMessageAnalysis: true,
      user_language: "French",
      segments_signal: [
        {
          signal_verbatim: "Merci pour votre aide.",
          signal_types: ["thanks_positive"]
        }
      ],
      segments_scope_boundary: [],
      segments_suspicious: []
    }
  }
];