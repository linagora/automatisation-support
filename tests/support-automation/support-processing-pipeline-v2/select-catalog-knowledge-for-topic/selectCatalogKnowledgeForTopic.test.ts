import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  callLLM
} from "../../../../src/infrastructure/llm/llm-client";
import {
  buildCandidateFieldsForTopicSelector
} from "../../../../src/support-automation/support-processing-pipeline-v2/select-catalog-knowledge-for-topic/buildCandidateFieldsForTopicSelector";
import {
  buildSelectCatalogKnowledgeForTopicPrompt
} from "../../../../src/support-automation/support-processing-pipeline-v2/select-catalog-knowledge-for-topic/buildSelectCatalogKnowledgeForTopicPrompt";
import {
  formatSelectCatalogKnowledgeForTopicOutput
} from "../../../../src/support-automation/support-processing-pipeline-v2/select-catalog-knowledge-for-topic/formatSelectCatalogKnowledgeForTopicOutput";
import {
  requestSelectCatalogKnowledgeForTopic
} from "../../../../src/support-automation/support-processing-pipeline-v2/select-catalog-knowledge-for-topic/requestSelectCatalogKnowledgeForTopic";
import {
  selectCatalogKnowledgeForTopicResponseFormat
} from "../../../../src/support-automation/support-processing-pipeline-v2/select-catalog-knowledge-for-topic/selectCatalogKnowledgeForTopic.schema";
import {
  getCandidateDiagnosticFlowsForCatalogSelection
} from "../../../../src/support-automation/support-catalog-LEGACY";

import type {
  ExtractableFieldDefinition,
  KnowledgeEnrichmentPlan,
  MergedTopicSnapshot,
  TextUnderstanding,
  TopicEvidence
} from "../../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  SelectCatalogKnowledgeForTopicInput
} from "../../../../src/support-automation/support-processing-pipeline-v2/select-catalog-knowledge-for-topic/typesSelectCatalogKnowledgeForTopic.types";

vi.mock("../../../../src/infrastructure/llm/llm-client", function () {
  return {
    callLLM: vi.fn()
  };
});

const callLLMMock = vi.mocked(callLLM);

function field(
  fieldName: string,
  askableByUser = true
): ExtractableFieldDefinition {
  return {
    fieldName,
    description: `${fieldName} description.`,
    askableByUser
  };
}

const catalog: ExtractableFieldDefinition[] = [
  field("user_identifier"),
  field("account_identifier"),
  field("account_status", false),
  field("product_or_service"),
  field("feature_or_page"),
  field("platform"),
  field("operating_system"),
  field("browser"),
  field("app_version"),
  field("device"),
  field("access_action"),
  field("auth_method"),
  field("recovery_channel"),
  field("mfa_status"),
  field("error_message"),
  field("observed_result"),
  field("expected_result"),
  field("trigger_action"),
  field("frequency"),
  field("affected_scope"),
  field("affected_users"),
  field("user_impact"),
  field("billing_or_payment_status"),
  field("billing_issue_type"),
  field("duplicate_billing_impact"),
  field("amount"),
  field("currency"),
  field("billing_date_or_period"),
  field("payment_method"),
  field("reference_id"),
  field("visual_evidence")
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

function snapshot(
  overrides: Partial<MergedTopicSnapshot> = {}
): MergedTopicSnapshot {
  return {
    snapshotId: "snapshot_1",
    topicId: null,
    temporaryTopicId: null,
    isNewTopic: true,
    title: "Login problem",
    broadCategoryHint: "access_security",
    summary: "Login problem",
    caseDetails: [],
    attemptedActions: [],
    sourceUnderstandingIds: ["understanding_1"],
    sourceVerbatims: ["Login error"],
    sourceOpIndex: 0,
    baseTopic: null,
    ...overrides
  };
}

type SelectorTestOverrides = Omit<
  Partial<SelectCatalogKnowledgeForTopicInput>,
  "topicUserMessageContent" | "topicEvidence"
> & {
  latestUserMessageContent?: string;
  topicEvidence?: Partial<TopicEvidence>;
  relatedTextUnderstandings?: TextUnderstanding[];
};

function input(
  overrides: SelectorTestOverrides = {}
): SelectCatalogKnowledgeForTopicInput {
  const {
    latestUserMessageContent = "Erreur de login.",
    topicEvidence,
    relatedTextUnderstandings = [understanding()],
    ...inputOverrides
  } = overrides;
  const topicSnapshot = inputOverrides.topicSnapshot ?? snapshot();

  return {
    topicUserMessageContent: latestUserMessageContent,
    topicEvidence: {
      proposalId: topicSnapshot.snapshotId,
      topicId: topicSnapshot.topicId ?? topicSnapshot.temporaryTopicId,
      topicSnapshot,
      topicSourceVerbatims: [latestUserMessageContent],
      relatedUnderstandingIds: relatedTextUnderstandings.map((item) => {
        return item.understandingId;
      }),
      relatedTextUnderstandings,
      relatedAttachmentUnderstandings: [],
      relatedSupportResponseCues: [],
      existingTopic: topicSnapshot,
      ...topicEvidence
    },
    topicSnapshot,
    extractableFieldCatalog: catalog,
    targetLanguage: "French",
    ...inputOverrides
  };
}

function enrichmentPlan(
  mode: NonNullable<KnowledgeEnrichmentPlan["broadIntent"]>["mode"]
): KnowledgeEnrichmentPlan {
  return {
    route: "catalog_only",
    reason: "test",
    broadIntent: {
      mode,
      reason: "test"
    },
    retrievalRequests: []
  };
}

function withSelectorFields(
  baseInput: SelectCatalogKnowledgeForTopicInput
): SelectCatalogKnowledgeForTopicInput {
  const selectorFields = buildCandidateFieldsForTopicSelector({
    topicSnapshot: baseInput.topicSnapshot ?? baseInput.topicEvidence.topicSnapshot!,
    knowledgeEnrichmentPlan: baseInput.knowledgeEnrichmentPlan,
    extractableFieldCatalog: baseInput.extractableFieldCatalog
  });

  return {
    ...baseInput,
    knownFields: selectorFields.knownFields,
    candidateFields: selectorFields.candidateFields,
    candidateDiagnosticFlows: selectorFields.candidateDiagnosticFlows
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

  it("uses one strict minimal JSON-schema LLM call", async function () {
    callLLMMock.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        selectedFieldNames: []
      })
    });

    await requestSelectCatalogKnowledgeForTopic({
      prompt: buildSelectCatalogKnowledgeForTopicPrompt(
        withSelectorFields(input())
      )
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

  it("builds knownFields and candidateFields from the merged topic snapshot", function () {
    const selectorFields = buildCandidateFieldsForTopicSelector({
      topicSnapshot: snapshot({
        broadCategoryHint: "access_security",
        caseDetails: [
          {
            key: "platform",
            value: "web",
            evidence: "sur le web"
          },
          {
            key: "error_message",
            value: "Token expired",
            evidence: "Token expired"
          }
        ]
      }),
      extractableFieldCatalog: catalog
    });

    expect(selectorFields.knownFields).toEqual([
      {
        fieldName: "platform",
        value: "web",
        evidence: "sur le web"
      },
      {
        fieldName: "error_message",
        value: "Token expired",
        evidence: "Token expired"
      }
    ]);
    expect(selectorFields.candidateFields.map((item) => item.fieldName))
      .toContain("access_action");
    expect(selectorFields.candidateFields.map((item) => item.fieldName))
      .not.toEqual(expect.arrayContaining([
        "platform",
        "error_message",
        "account_status"
      ]));
  });

  it("returns issue diagnostic flow candidates for issue topics", function () {
    expect(getCandidateDiagnosticFlowsForCatalogSelection({
      broadIntent: "issue",
      broadCategoryHint: "bug"
    }).map((flow) => flow.name)).toEqual([
      "issue_diagnostic"
    ]);
  });

  it("returns access diagnostic flow candidates for access issue topics", function () {
    expect(getCandidateDiagnosticFlowsForCatalogSelection({
      broadIntent: "issue",
      broadCategoryHint: "access_security"
    }).map((flow) => flow.name)).toEqual([
      "access_diagnostic"
    ]);
  });

  it("returns billing diagnostic flow candidates for billing issue topics", function () {
    expect(getCandidateDiagnosticFlowsForCatalogSelection({
      broadIntent: "issue",
      broadCategoryHint: "billing"
    }).map((flow) => flow.name)).toEqual([
      "billing_diagnostic"
    ]);
  });

  it("returns request clarification for request topics", function () {
    expect(getCandidateDiagnosticFlowsForCatalogSelection({
      broadIntent: "request",
      broadCategoryHint: "feature_request"
    }).map((flow) => flow.name)).toEqual([
      "request_clarification"
    ]);
  });

  it("returns no diagnostic flow candidate for faq topics by default", function () {
    expect(getCandidateDiagnosticFlowsForCatalogSelection({
      broadIntent: "faq",
      broadCategoryHint: "question_faq"
    })).toEqual([]);
  });

  it("drops known fields selected by the raw LLM output", function () {
    const baseInput = withSelectorFields(input({
      topicSnapshot: snapshot({
        broadCategoryHint: "access_security",
        caseDetails: [
          {
            key: "platform",
            value: "web",
            evidence: "web"
          },
          {
            key: "error_message",
            value: "Token expired",
            evidence: "Token expired"
          },
          {
            key: "observed_result",
            value: "failed",
            evidence: "failed"
          }
        ]
      })
    }));
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: baseInput,
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: [
          "platform",
          "error_message",
          "observed_result",
          "access_action",
          "auth_method"
        ]
      })
    });

    expect(output.selectedFields.map((item) => item.fieldName)).toEqual([
      "access_action",
      "auth_method"
    ]);
    expect(output.rejectedFieldNames).toEqual([]);
    expect(output.scopeReason).toBe("selected_candidate_fields");
  });

  it("drops fields outside candidateFields", function () {
    const baseInput = withSelectorFields(input({
      topicSnapshot: snapshot({
        broadCategoryHint: "billing"
      })
    }));
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: baseInput,
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: [
          "duplicate_billing_impact",
          "auth_method"
        ]
      })
    });

    expect(output.selectedFields.map((item) => item.fieldName)).toEqual([
      "duplicate_billing_impact"
    ]);
  });

  it("accepts selectedFieldNames plus diagnosticFlow from the raw LLM output", function () {
    const baseInput = withSelectorFields(input({
      knowledgeEnrichmentPlan: enrichmentPlan("issue"),
      topicSnapshot: snapshot({
        broadCategoryHint: "access_security"
      })
    }));
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: baseInput,
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: [
          "access_action"
        ],
        directQuestionGuidance: {
          fieldNames: [
            "access_action"
          ],
          guidance: "Ask which access action is blocked.",
          reason: "The action is missing."
        },
        diagnosticFlow: {
          name: "access_diagnostic",
          targetFieldNames: [
            "access_action",
            "auth_method",
            "failure_step",
            "error_message",
            "account_status"
          ],
          attemptedActionsRelevant: true,
          guidance:
            "Ask where the access/login/account flow blocks, which authentication method is used, and whether an error or account status is shown.",
          reason: "The access issue needs guided qualification."
        },
        sufficientlyQualified: false,
        reason: "Missing access flow details."
      })
    });

    expect(output.selectedFieldNames).toEqual([
      "access_action"
    ]);
    expect(output.selectedFields.map((item) => item.fieldName)).toEqual([
      "access_action"
    ]);
    expect(output.directQuestionGuidance).toEqual({
      fieldNames: [
        "access_action"
      ],
      guidance: "Ask which access action is blocked.",
      reason: "The action is missing."
    });
    expect(output.diagnosticFlow).toEqual({
      name: "access_diagnostic",
      targetFieldNames: [
        "access_action",
        "auth_method",
        "failure_step",
        "error_message",
        "account_status"
      ],
      attemptedActionsRelevant: true,
      guidance:
        "Ask where the access/login/account flow blocks, which authentication method is used, and whether an error or account status is shown.",
      reason: "The access issue needs guided qualification."
    });
    expect(output.sufficientlyQualified).toBe(false);
    expect(output.reason).toBe("Missing access flow details.");
  });

  it("preserves backward compatibility when diagnosticFlow is absent", function () {
    const baseInput = withSelectorFields(input({
      topicSnapshot: snapshot({
        broadCategoryHint: "billing"
      })
    }));
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: baseInput,
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: [
          "billing_issue_type"
        ]
      })
    });

    expect(output.selectedFieldNames).toEqual([
      "billing_issue_type"
    ]);
    expect(output.selectedFields.map((item) => item.fieldName)).toEqual([
      "billing_issue_type"
    ]);
    expect(output.directQuestionGuidance).toBeNull();
    expect(output.diagnosticFlow).toBeNull();
  });

  it("drops askable false fields", function () {
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: {
        ...input(),
        knownFields: [],
        candidateFields: [
          field("account_status", false),
          field("access_action")
        ]
      },
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: [
          "account_status",
          "access_action"
        ]
      })
    });

    expect(output.selectedFields.map((item) => item.fieldName)).toEqual([
      "access_action"
    ]);
  });

  it("does not include visual_evidence for a notification Android bug shortlist", function () {
    const baseInput = withSelectorFields(input({
      topicSnapshot: snapshot({
        title: "Android notifications",
        broadCategoryHint: "bug",
        caseDetails: [
          {
            key: "product_or_service",
            value: "notifications",
            evidence: "notifications"
          },
          {
            key: "platform",
            value: "Android",
            evidence: "Android"
          },
          {
            key: "observed_result",
            value: "notifications not sent",
            evidence: "notifications pas envoyées"
          }
        ]
      })
    }));
    const candidateFieldNames = baseInput.candidateFields?.map((item) => {
      return item.fieldName;
    }) ?? [];
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: baseInput,
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: [
          "product_or_service",
          "platform",
          "observed_result",
          "visual_evidence",
          "app_version",
          "device"
        ]
      })
    });

    expect(candidateFieldNames).not.toContain("visual_evidence");
    expect(output.selectedFields.map((item) => item.fieldName)).toEqual([
      "app_version",
      "device"
    ]);
  });

  it("does not reselect known duplicate billing fields", function () {
    const baseInput = withSelectorFields(input({
      topicSnapshot: snapshot({
        title: "Duplicate billing",
        broadCategoryHint: "billing",
        caseDetails: [
          {
            key: "billing_issue_type",
            value: "duplicate invoice",
            evidence: "facture deux fois"
          },
          {
            key: "billing_date_or_period",
            value: "June",
            evidence: "juin"
          }
        ]
      })
    }));
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: baseInput,
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: [
          "billing_issue_type",
          "billing_date_or_period",
          "duplicate_billing_impact",
          "reference_id"
        ]
      })
    });

    expect(output.selectedFields.map((item) => item.fieldName)).toEqual([
      "duplicate_billing_impact",
      "reference_id"
    ]);
    expect(output.rejectedFieldNames).toEqual([]);
  });

  it("prompts with a shortlist instead of the full catalog", function () {
    const baseInput = withSelectorFields(input({
      topicSnapshot: snapshot({
        broadCategoryHint: "billing",
        caseDetails: [
          {
            key: "billing_issue_type",
            value: "duplicate invoice",
            evidence: "facture deux fois"
          }
        ]
      })
    }));
    const prompt = buildSelectCatalogKnowledgeForTopicPrompt(
      baseInput
    ).messages.map((message) => message.content).join("\n");
    const candidateFieldCount = baseInput.candidateFields?.length ?? 0;

    expect(candidateFieldCount).toBeLessThan(catalog.length);
    expect(prompt).toContain('"knownFields"');
    expect(prompt).toContain('"candidateFields"');
    expect(prompt).toContain('"candidateDiagnosticFlows"');
    expect(prompt).toContain('"duplicate_billing_impact"');
    expect(prompt).not.toContain('"account_status"');
    expect(prompt).not.toContain('"extractableFieldCatalog"');
  });

  it("renders unansweredRequestedFieldNames in the selector prompt when available", function () {
    const baseInput = withSelectorFields(input({
      topicSnapshot: snapshot({
        broadCategoryHint: "access_security",
        unansweredRequestedFieldNames: ["error_message"]
      })
    }));
    const prompt = buildSelectCatalogKnowledgeForTopicPrompt(
      baseInput
    ).messages.map((message) => message.content).join("\n");

    expect(prompt).toContain('"unansweredRequestedFields"');
    expect(prompt).toContain('"fieldName": "error_message"');
    expect(prompt).toContain('"label": "Error message"');
    expect(prompt).not.toContain('"qualificationSummary"');
  });

  it("explains unanswered requested field anti-repeat rules in the selector prompt", function () {
    const prompt = buildSelectCatalogKnowledgeForTopicPrompt(
      withSelectorFields(input())
    ).messages.map((message) => message.content).join("\n");

    expect(prompt).toContain(
      "topicSnapshot.unansweredRequestedFieldNames is internal memory for this same topic"
    );
    expect(prompt).toContain(
      "direct field keys that were already requested or planned in previous bot turns but are still missing from current caseDetails"
    );
    expect(prompt).toContain(
      "avoid asking it again immediately unless it is decisive for support and still useful"
    );
    expect(prompt).toContain(
      "Do not reselect a direct field only because it is still theoretically useful"
    );
  });

  it("renders an empty unansweredRequestedFields list when no previous anti-repeat memory exists", function () {
    const prompt = buildSelectCatalogKnowledgeForTopicPrompt(
      withSelectorFields(input())
    ).messages.map((message) => message.content).join("\n");

    expect(prompt).toContain('"unansweredRequestedFields": []');
    expect(prompt).not.toContain('"qualificationSummary"');
  });

  it("keeps legacy selector output compatible when enriched fields are absent", function () {
    const baseInput = withSelectorFields(input({
      topicSnapshot: snapshot({
        broadCategoryHint: "access_security"
      })
    }));
    const output = formatSelectCatalogKnowledgeForTopicOutput({
      input: baseInput,
      rawSelectCatalogKnowledgeForTopic: completed({
        selectedFieldNames: ["error_message"]
      })
    });

    expect(output.selectedFieldNames).toEqual(["error_message"]);
    expect(output.selectedFields.map((item) => item.fieldName)).toEqual([
      "error_message"
    ]);
    expect(output.directQuestionGuidance).toBeNull();
    expect(output.diagnosticFlow).toBeNull();
    expect(output.sufficientlyQualified).toBe(false);
    expect(output.reason).toBeUndefined();
  });
});
