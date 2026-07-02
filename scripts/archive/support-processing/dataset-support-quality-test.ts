import type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  ConversationHistory,
  ResponsePlan,
  SupportProcessingPipelineInput,
  SupportTopicKnowledge,
  TurnUnderstandingDelta
} from "../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";

export type SupportQualityTestCase = {
  id: number;
  label: string;
  latestUserMessage: string;
  supportTopicKnowledge?: SupportTopicKnowledge;
  conversationHistory?: unknown[];
};

export const trustedAccountTrustStatus: AccountTrustStatus = {
  status: "trusted",
  reasons: [
    "longHistory",
    "legitimateSupportInteractions",
    "verifiedEmailDomain"
  ]
};

export const standardAccountProfile: AccountProfile = {
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

export const standardAccountInteractionTraits: AccountInteractionTraits = {
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

const historicalDriveFolderTopic: SupportTopicKnowledge["segments_topic"][number] = {
  id_topic: 1,
  topic_category: "bug",
  tool_or_product: "Twake Drive",
  topic_action: "create",
  topic_object: "folder",
  segment_verbatims: [
    "Je n'arrive pas a creer un dossier dans Drive depuis Android."
  ],
  topic_details: {
    platform: "mobile app",
    os: "Android",
    trigger_action: "tap create folder",
    observed_result: "folder is not created",
    expected_result: "folder should be created"
  },
  user_goal:
    "Create a folder in Twake Drive on Android mobile app but the folder is not created",
  blocking_issue: "yes"
};

const historicalLoginTopic: SupportTopicKnowledge["segments_topic"][number] = {
  id_topic: 1,
  topic_category: "access_security",
  tool_or_product: "Twake",
  topic_action: "login",
  topic_object: "account",
  segment_verbatims: [
    "Je ne peux plus me connecter a Twake depuis ce matin."
  ],
  topic_details: {
    access_action: "login",
    auth_method: "password",
    observed_result: "login fails",
    platform: "web"
  },
  user_goal: "Log in to Twake account from the web app",
  blocking_issue: "yes"
};

const historicalDriveFolderDelta: TurnUnderstandingDelta = {
  user_language: "french",
  securityGateSummary: {
    gateChecked: {},
    gateFailed: []
  },
  segments_lack_comprehension: [],
  segments_topic: [
    {
      matched_historical_topic: "no",
      id_topic: historicalDriveFolderTopic.id_topic,
      topic_category: historicalDriveFolderTopic.topic_category,
      tool_or_product: historicalDriveFolderTopic.tool_or_product,
      topic_action: historicalDriveFolderTopic.topic_action,
      topic_object: historicalDriveFolderTopic.topic_object,
      segment_verbatims: historicalDriveFolderTopic.segment_verbatims,
      topic_details: historicalDriveFolderTopic.topic_details,
      user_goal: historicalDriveFolderTopic.user_goal,
      blocking_issue: historicalDriveFolderTopic.blocking_issue
    }
  ],
  segments_signal: [],
  segments_scope_boundary: [],
  segments_suspicious: []
};

const historicalLoginDelta: TurnUnderstandingDelta = {
  user_language: "french",
  securityGateSummary: {
    gateChecked: {},
    gateFailed: []
  },
  segments_lack_comprehension: [],
  segments_topic: [
    {
      matched_historical_topic: "no",
      id_topic: historicalLoginTopic.id_topic,
      topic_category: historicalLoginTopic.topic_category,
      tool_or_product: historicalLoginTopic.tool_or_product,
      topic_action: historicalLoginTopic.topic_action,
      topic_object: historicalLoginTopic.topic_object,
      segment_verbatims: historicalLoginTopic.segment_verbatims,
      topic_details: historicalLoginTopic.topic_details,
      user_goal: historicalLoginTopic.user_goal,
      blocking_issue: historicalLoginTopic.blocking_issue
    }
  ],
  segments_signal: [],
  segments_scope_boundary: [],
  segments_suspicious: []
};

function buildConversationHistory(params: {
  idPrefix: string;
  turnUnderstandingDelta: TurnUnderstandingDelta;
  contextLLM: string;
}): ConversationHistory {
  return Object.assign(
    [
      {
        id: `${params.idPrefix}_user_1`,
        message_id: `${params.idPrefix}_msg_1`,
        role: "user" as const,
        created_at: "2026-05-20T09:00:00.000Z",
        turnUnderstandingDelta: params.turnUnderstandingDelta
      },
      {
        id: `${params.idPrefix}_bot_1`,
        message_id: `${params.idPrefix}_bot_msg_1`,
        role: "bot" as const,
        created_at: "2026-05-20T09:01:00.000Z",
        responsePlan: emptyBotResponsePlan
      }
    ],
    {
      contextLLM: params.contextLLM
    }
  );
}

const driveFolderHistory = buildConversationHistory({
  idPrefix: "quality_drive_folder",
  turnUnderstandingDelta: historicalDriveFolderDelta,
  contextLLM: [
    'User(topic): add_topic topic_id=1 label="Twake Drive : create : folder" category=bug',
    "User(topic): update_topic topic_id=1 fields=[platform, os, trigger_action, observed_result, expected_result]",
    "Bot(topic): ask_more_info topic_id=1 fields=[error_message]"
  ].join("\n")
});

const loginHistory = buildConversationHistory({
  idPrefix: "quality_login",
  turnUnderstandingDelta: historicalLoginDelta,
  contextLLM: [
    'User(topic): add_topic topic_id=1 label="Twake : login : account" category=access_security',
    "User(topic): update_topic topic_id=1 fields=[platform, access_action, auth_method, observed_result]",
    "Bot(topic): ask_more_info topic_id=1 fields=[error_message, account_context]"
  ].join("\n")
});

export const supportQualityTestCases: SupportQualityTestCase[] = [
  {
    id: 1,
    label: "Bug app crash / dark theme unreadable button",
    latestUserMessage:
      "Depuis la mise a jour, l'application se ferme quand j'active le theme sombre et le bouton Enregistrer devient presque illisible."
  },
  {
    id: 2,
    label: "Bug Drive create folder / rename file",
    latestUserMessage:
      "Dans Drive je n'arrive pas a creer un dossier, et quand je renomme un fichier le nouveau nom n'est pas sauvegarde."
  },
  {
    id: 3,
    label: "Bug Android folder creation with error",
    latestUserMessage:
      "Sur Android, quand je cree un dossier dans Drive j'ai le message Vous devez nommer votre dossier alors que le nom est bien rempli."
  },
  {
    id: 4,
    label: "Login impossible",
    latestUserMessage:
      "Impossible de me connecter a mon compte Twake depuis ce matin, mon mot de passe est refuse alors qu'il fonctionne d'habitude."
  },
  {
    id: 5,
    label: "VoiceOver iOS accessibility",
    latestUserMessage:
      "Avec VoiceOver sur iPhone, je n'arrive pas a savoir quel bouton permet d'envoyer un message dans Twake Chat."
  },
  {
    id: 6,
    label: "FAQ MFA setup",
    latestUserMessage:
      "Comment activer la double authentification MFA sur mon compte Twake ?"
  },
  {
    id: 7,
    label: "Feature request password folders",
    latestUserMessage:
      "Est-ce que vous pouvez ajouter des dossiers pour organiser les mots de passe ?"
  },
  {
    id: 8,
    label: "Feature request export / sharing / photos",
    latestUserMessage:
      "J'aimerais pouvoir exporter mes photos, les partager avec ma famille et choisir un album entier d'un coup."
  },
  {
    id: 9,
    label: "Billing double charge",
    latestUserMessage:
      "J'ai ete preleve deux fois ce mois-ci pour mon abonnement."
  },
  {
    id: 10,
    label: "Billing payment refused / Google Wallet",
    latestUserMessage:
      "Le paiement via Google Wallet est refuse alors que ma carte fonctionne, comment renouveler mon abonnement ?"
  },
  {
    id: 11,
    label: "Bank and administrative connectors unavailable",
    latestUserMessage:
      "Les connecteurs de ma banque et de l'ENSAP sont indisponibles depuis plusieurs jours, je ne peux plus importer mes documents."
  },
  {
    id: 12,
    label: "Churn complaint without clear technical request",
    latestUserMessage:
      "Franchement je vais arreter mon abonnement, il y a trop de problemes et je perds du temps a chaque fois."
  },
  {
    id: 13,
    label: "Out of scope / restaurant spam",
    latestUserMessage:
      "Bonjour, notre restaurant propose des menus de groupe et un service traiteur, voulez-vous recevoir notre carte ?"
  },
  {
    id: 14,
    label: "Historical follow-up resolved then new issue",
    latestUserMessage:
      "Ca marche maintenant pour le dossier, merci. Par contre je ne recois plus les notifications Drive.",
    supportTopicKnowledge: {
      segments_topic: [historicalDriveFolderTopic]
    },
    conversationHistory: driveFolderHistory
  },
  {
    id: 15,
    label: "Historical follow-up precision after existing login topic",
    latestUserMessage:
      "Pour la connexion, l'erreur exacte est Session expiree et je suis sur Firefox.",
    supportTopicKnowledge: {
      segments_topic: [historicalLoginTopic]
    },
    conversationHistory: loginHistory
  }
];

export function buildSupportQualityInput(
  testCase: SupportQualityTestCase
): SupportProcessingPipelineInput {
  return {
    latestUserMessage: {
      id: `quality_case_${testCase.id}`,
      channel: "email",
      sentAt: "2026-05-21T09:00:00.000Z",
      content: testCase.latestUserMessage
    },
    latestUserAttachments: [],
    accountTrustStatus: trustedAccountTrustStatus,
    accountProfile: standardAccountProfile,
    accountInteractionTraits: standardAccountInteractionTraits,
    supportTopicKnowledge: testCase.supportTopicKnowledge ?? {
      segments_topic: []
    },
    conversationHistory: (testCase.conversationHistory ?? []) as ConversationHistory
  };
}
