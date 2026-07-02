type FakeMatrixScenario = {
  id: string;
  name: string;
  tags: string[];
  actor: {
    userId: string;
    roomId: string;
    displayName?: string;
    threadId?: string;
  };
  seedLiveMemory: {
    topics: Array<{
      topicId: number;
      title: string | null;
      broadCategoryHint: string | null;
      summary: string | null;
      caseDetails: Array<Record<string, unknown>>;
      attemptedActions: Array<Record<string, unknown>>;
      supportKnowledgeSummary?: string | null;
    }>;
    lastUserVerbatim?: string;
    lastBotVerbatim?: string;
    userState?: {
      status: string;
      flags: string[];
    };
  };
  receivedMessages: Array<{
    name: string;
    content: string;
    delayMs?: number;
    typingBeforeMs?: number;
  }>;
  expected?: {
    sentShouldMention?: string[];
    sentShouldNotMention?: string[];
    liveMemoryLastBotShouldEqualSent?: boolean;
    ragUsage?: Array<{
      topicId: number;
      status: string;
    }>;
  };
};

const fakeMatrixScenarioDataset: FakeMatrixScenario[] = [
  {
    id: "double_charge_clarification",
    name: "Billing follow-up confirms duplicate payment and invoice reference",
    tags: ["billing", "rag", "live-memory"],
    actor: {
      userId: "@fake-double-charge:example.org",
      roomId: "!fake-double-charge:example.org"
    },
    seedLiveMemory: {
      topics: [
        {
          topicId: 1,
          title: "Double billing",
          broadCategoryHint: "billing",
          summary: "The user reported a suspected duplicate charge.",
          caseDetails: [
            {
              key: "issue",
              value: "possible duplicate billing",
              evidence: "previous fake scenario seed"
            }
          ],
          attemptedActions: [],
          supportKnowledgeSummary:
            "Support knowledge lookup returned no usable customer-facing knowledge for this topic."
        }
      ],
      lastUserVerbatim: "J'ai peut-être été facturé deux fois.",
      lastBotVerbatim:
        "Pouvez-vous confirmer si le double prélèvement concerne aussi le paiement ?",
      userState: {
        status: "normal",
        flags: []
      }
    },
    receivedMessages: [
      {
        name: "billing_confirmation",
        content:
          "Oui, j'ai bien deux prélèvements pour le même abonnement. La référence facture est FAC-2026-7781."
      }
    ],
    expected: {
      sentShouldMention: ["FAC-2026-7781"],
      liveMemoryLastBotShouldEqualSent: true,
      ragUsage: [
        {
          topicId: 1,
          status: "skipped_by_router"
        }
      ]
    }
  },
  {
    id: "android_notifications_already_tried",
    name: "Android notification follow-up says permissions are already enabled",
    tags: ["android", "notifications", "knowledge"],
    actor: {
      userId: "@fake-android-notifications:example.org",
      roomId: "!fake-android-notifications:example.org"
    },
    seedLiveMemory: {
      topics: [
        {
          topicId: 1,
          title: "Android notifications",
          broadCategoryHint: "notifications",
          summary: "The user does not receive notifications on Android.",
          caseDetails: [
            {
              key: "platform",
              value: "Android",
              evidence: "previous fake scenario seed"
            }
          ],
          attemptedActions: [],
          supportKnowledgeSummary:
            "For Android notification issues, verify app notification permissions, battery optimization restrictions, Do Not Disturb, and whether the user is logged into the expected account."
        }
      ],
      lastUserVerbatim: "Je ne reçois pas les notifications sur Android.",
      lastBotVerbatim:
        "Pouvez-vous vérifier que les notifications sont autorisées pour l'application ?",
      userState: {
        status: "normal",
        flags: []
      }
    },
    receivedMessages: [
      {
        name: "android_permissions_done",
        content:
          "J'ai déjà activé les notifications Android pour l'application, et le mode ne pas déranger est désactivé."
      }
    ],
    expected: {
      sentShouldMention: ["Android"],
      sentShouldNotMention: ["activez les notifications Android"],
      liveMemoryLastBotShouldEqualSent: true
    }
  },
  {
    id: "billing_android_multitopic",
    name: "Multi-topic follow-up gives billing and Android notification details",
    tags: ["multi-topic", "billing", "android"],
    actor: {
      userId: "@fake-multitopic:example.org",
      roomId: "!fake-multitopic:example.org"
    },
    seedLiveMemory: {
      topics: [
        {
          topicId: 1,
          title: "Double billing",
          broadCategoryHint: "billing",
          summary: "The user reported duplicate billing.",
          caseDetails: [],
          attemptedActions: [],
          supportKnowledgeSummary:
            "Duplicate billing requests should collect invoice references, charge dates, charged amounts, and whether both charges reached the bank account."
        },
        {
          topicId: 2,
          title: "Android notifications",
          broadCategoryHint: "notifications",
          summary: "The user reported missing Android notifications.",
          caseDetails: [],
          attemptedActions: [],
          supportKnowledgeSummary:
            "For Android notification issues, verify notification permissions, battery optimization, DND mode, app version, and account/session state."
        }
      ],
      lastUserVerbatim:
        "J'ai un souci de facture et aussi un souci de notifications Android.",
      lastBotVerbatim:
        "Pouvez-vous préciser les détails de facturation et votre configuration Android ?",
      userState: {
        status: "normal",
        flags: []
      }
    },
    receivedMessages: [
      {
        name: "billing_and_android_details",
        content:
          "Pour la facture, j'ai deux prélèvements de 9,99 euros le 28 juin. Pour Android, j'ai déjà désactivé l'optimisation batterie."
      }
    ],
    expected: {
      sentShouldMention: ["9,99"],
      liveMemoryLastBotShouldEqualSent: true
    }
  }
];

export {
  fakeMatrixScenarioDataset
};

export type {
  FakeMatrixScenario
};
