import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  callLLM
} from "../../../../src/llm/llm-client";
import {
  buildSelectCatalogKnowledgeForTopicPrompt
} from "../../../../src/support-processing-pipeline/v2/select-catalog-knowledge-for-topic/buildSelectCatalogKnowledgeForTopicPrompt";
import {
  formatSelectCatalogKnowledgeForTopicOutput
} from "../../../../src/support-processing-pipeline/v2/select-catalog-knowledge-for-topic/formatSelectCatalogKnowledgeForTopicOutput";
import {
  requestSelectCatalogKnowledgeForTopic
} from "../../../../src/support-processing-pipeline/v2/select-catalog-knowledge-for-topic/requestSelectCatalogKnowledgeForTopic";
import {
  selectCatalogKnowledgeForTopicResponseFormat
} from "../../../../src/support-processing-pipeline/v2/select-catalog-knowledge-for-topic/selectCatalogKnowledgeForTopic.schema";

import type {
  ExtractableFieldDefinition,
  TextUnderstanding,
  TopicEvidence
} from "../../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";
import type {
  SelectCatalogKnowledgeForTopicInput
} from "../../../../src/support-processing-pipeline/v2/select-catalog-knowledge-for-topic/typesSelectCatalogKnowledgeForTopic.types";

vi.mock("../../../../src/llm/llm-client", function () {
  return {
    callLLM: vi.fn()
  };
});

const callLLMMock = vi.mocked(callLLM);

const catalog: ExtractableFieldDefinition[] = [
  {
    fieldName: "error_message",
    description: "Exact error message.",
    askableByUser: true
  },
  {
    fieldName: "access_action",
    description: "Login or access action.",
    askableByUser: true
  },
  {
    fieldName: "auth_method",
    description: "Authentication method.",
    askableByUser: true
  },
  {
    fieldName: "account_status",
    description: "Internal account status.",
    askableByUser: false
  },
  {
    fieldName: "browser",
    description: "Browser.",
    askableByUser: true
  },
  {
    fieldName: "visual_evidence",
    description: "Screenshot, photo, or video.",
    askableByUser: true
  },
  {
    fieldName: "duplicate_billing_impact",
    description: "Duplicate document versus duplicate charge.",
    askableByUser: true
  },
  {
    fieldName: "amount",
    description: "Amount.",
    askableByUser: true
  },
  {
    fieldName: "currency",
    description: "Currency.",
    askableByUser: true
  }
];

function understanding(
  overrides: Partial<TextUnderstanding> = {}
): TextUnderstanding {
  return {
    understandingId: "understanding_1",
    sourceSegmentIds: ["segment_1"],
    messageKinds: [],
    caseDetails: [],
    attemptedActions: [],
    supportMetadata: [],
    summary: "Login error",
    ...overrides
  };
}

type SelectorTestOverrides = Omit<
  Partial<SelectCatalogKnowledgeForTopicInput>,
  "topicUserMessageContent" | "topicEvidence"
> & {
  latestUserMessageContent?: string;
  topicEvidence?: Partial<TopicEvidence>;
  existingTopic?: unknown;
  relatedTextUnderstandings?: TextUnderstanding[];
  relatedAttachmentUnderstandings?: SelectCatalogKnowledgeForTopicInput[
    "topicEvidence"
  ]["relatedAttachmentUnderstandings"];
};

function input(
  overrides: SelectorTestOverrides = {}
): SelectCatalogKnowledgeForTopicInput {
  const {
    latestUserMessageContent =
      "Erreur de login, mon mot de passe n’est pas bon.",
    topicEvidence,
    existingTopic,
    relatedTextUnderstandings = [understanding()],
    relatedAttachmentUnderstandings = [],
    ...inputOverrides
  } = overrides;

  return {
    topicUserMessageContent: latestUserMessageContent,
    topicEvidence: {
      proposalId: "topic_update_op_1",
      topicId: null,
      topicSourceVerbatims: [latestUserMessageContent],
      relatedUnderstandingIds: relatedTextUnderstandings.map((item) => {
        return item.understandingId;
      }),
      relatedTextUnderstandings,
      relatedAttachmentUnderstandings,
      relatedSupportResponseCues: [],
      ...(existingTopic ? { existingTopic } : {}),
      ...topicEvidence
    },
    extractableFieldCatalog: catalog,
    targetLanguage: "French",
    ...inputOverrides
  };
}

function completed(parsedResponse: unknown) {
  return {
    status: "completed" as const,
    parsedResponse,
    rawResponse: JSON.stringify(parsedResponse)
  };
}

describe("selectCatalogKnowledgeForTopic", function () {
  beforeEach(function () {
    callLLMMock.mockReset();
  });

  it("uses one strict JSON-schema LLM call", async function () {
    callLLMMock.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        selectedFieldNames: [],
        selectedGenericKnowledgeIds: [],
        scopeReason: "No useful field.",
        rejectedFieldNames: [],
        warnings: []
      })
    });

    await requestSelectCatalogKnowledgeForTopic({
      prompt: buildSelectCatalogKnowledgeForTopicPrompt(input())
    });

    expect(callLLMMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        stage: "catalog_field_selection",
        preset: "fullWeightMessageAnalysis",
        temperature: 0,
        responseFormat: selectCatalogKnowledgeForTopicResponseFormat
      })
    );
  });

  it("keeps login selection narrow and preserves askable metadata", function () {
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: input({
        relatedTextUnderstandings: [
          understanding({
            caseDetails: [
              {
                key: "error_message",
                value: "mot de passe incorrect",
                evidence: "mot de passe n’est pas bon"
              }
            ]
          })
        ]
      }),
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: ["access_action", "auth_method"],
        selectedGenericKnowledgeIds: [],
        scopeReason: "Keep only access qualification fields still useful.",
        rejectedFieldNames: [
          "error_message",
          "account_status",
          "browser"
        ],
        warnings: []
      })
    });

    expect(output.selectedFields.map((field) => field.fieldName)).toEqual([
      "access_action",
      "auth_method"
    ]);
    expect(output.rejectedFieldNames).toContain("error_message");
  });

  it("preserves account_status as non-askable internal context", function () {
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: input(),
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: ["account_status"],
        selectedGenericKnowledgeIds: [],
        scopeReason: "Internal context may matter.",
        rejectedFieldNames: [],
        warnings: []
      })
    });

    expect(output.selectedFields).toEqual([
      expect.objectContaining({
        fieldName: "account_status",
        askableByUser: false
      })
    ]);
  });

  it("does not select visual evidence automatically for a bug without attachment", function () {
    const prompt = buildSelectCatalogKnowledgeForTopicPrompt(input({
      latestUserMessageContent: "La page se ferme.",
      relatedTextUnderstandings: [
        understanding({
          summary: "Page crash",
          caseDetails: [
            {
              key: "observed_result",
              value: "page closes",
              evidence: "La page se ferme"
            }
          ]
        })
      ]
    })).messages.map((message) => message.content).join("\n");

    expect(prompt).toContain(
      "Do not select visual_evidence by default for every bug."
    );
    expect(prompt).toContain('"relatedAttachmentUnderstandings": []');
  });

  it("allows visual evidence when a related attachment exists", function () {
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: input({
        relatedAttachmentUnderstandings: [
          {
            attachmentIndex: 0,
            status: "analyzed",
            summary: "Screenshot of the failing page"
          }
        ]
      }),
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: ["visual_evidence"],
        selectedGenericKnowledgeIds: [],
        scopeReason: "The linked screenshot must be evaluated.",
        rejectedFieldNames: [],
        warnings: []
      })
    });

    expect(output.selectedFields.map((field) => field.fieldName)).toEqual([
      "visual_evidence"
    ]);
  });

  it("prioritizes duplicate_billing_impact over amount and currency", function () {
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: input({
        latestUserMessageContent: "J’ai reçu ma facture deux fois.",
        relatedTextUnderstandings: [
          understanding({
            summary: "Duplicate invoice",
            caseDetails: [
              {
                key: "billing_issue_type",
                value: "duplicate invoice",
                evidence: "facture deux fois"
              }
            ]
          })
        ]
      }),
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: ["duplicate_billing_impact"],
        selectedGenericKnowledgeIds: [],
        scopeReason: "Clarify document duplication versus duplicate charge.",
        rejectedFieldNames: ["amount", "currency"],
        warnings: []
      })
    });

    expect(output.selectedFields.map((field) => field.fieldName)).toEqual([
      "duplicate_billing_impact"
    ]);
    expect(output.rejectedFieldNames).toEqual(["amount", "currency"]);
  });

  it("defensively rejects billing fields from an access-only topic", function () {
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: input({
        relatedTextUnderstandings: [
          understanding({
            caseDetails: [
              {
                key: "access_action",
                value: "login",
                evidence: "Erreur de login"
              }
            ]
          })
        ]
      }),
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: [
          "access_action",
          "duplicate_billing_impact",
          "amount",
          "currency"
        ],
        selectedGenericKnowledgeIds: [],
        scopeReason: "Mixed selection returned by the model.",
        rejectedFieldNames: [],
        warnings: []
      })
    });

    expect(output.selectedFields.map((field) => field.fieldName)).toEqual([
      "access_action"
    ]);
    expect(output.rejectedFieldNames).toEqual([
      "duplicate_billing_impact",
      "amount",
      "currency"
    ]);
    expect(output.warnings).toEqual(expect.arrayContaining([
      "cross_topic_field_rejected:duplicate_billing_impact",
      "cross_topic_field_rejected:amount",
      "cross_topic_field_rejected:currency"
    ]));
  });

  it("defensively rejects access fields from a billing-only topic", function () {
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: input({
        latestUserMessageContent: "J’ai reçu ma facture deux fois.",
        relatedTextUnderstandings: [
          understanding({
            understandingId: "understanding_billing",
            summary: "Duplicate invoice",
            caseDetails: [
              {
                key: "billing_issue_type",
                value: "duplicate invoice",
                evidence: "facture deux fois"
              }
            ]
          })
        ]
      }),
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: [
          "duplicate_billing_impact",
          "account_status",
          "access_action",
          "auth_method"
        ],
        selectedGenericKnowledgeIds: [],
        scopeReason: "Mixed selection returned by the model.",
        rejectedFieldNames: [],
        warnings: []
      })
    });

    expect(output.selectedFields.map((field) => field.fieldName)).toEqual([
      "duplicate_billing_impact"
    ]);
    expect(output.rejectedFieldNames).toEqual([
      "account_status",
      "access_action",
      "auth_method"
    ]);
  });

  it("rejects unknown selected field names and reports a warning", function () {
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: input(),
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: ["error_message", "invented_field"],
        selectedGenericKnowledgeIds: [],
        scopeReason: "Select the useful error field.",
        rejectedFieldNames: [],
        warnings: []
      })
    });

    expect(output.selectedFields.map((field) => field.fieldName)).toEqual([
      "error_message"
    ]);
    expect(output.warnings).toContain(
      "unknown_selected_field:invented_field"
    );
  });
});
