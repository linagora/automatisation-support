import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  callLLM
} from "../../../../src/llm/llm-client";
import {
  analyzeSupportText
} from "../../../../src/support-processing-pipeline/v2/analyze-support-text/analyzeSupportText";
import {
  buildAnalyzeSupportTextPrompt
} from "../../../../src/support-processing-pipeline/v2/analyze-support-text/buildAnalyzeSupportTextPrompt";
import {
  formatSupportTextAnalysisOutput
} from "../../../../src/support-processing-pipeline/v2/analyze-support-text/formatSupportTextAnalysisOutput";
import {
  requestSupportTextAnalysis
} from "../../../../src/support-processing-pipeline/v2/analyze-support-text/requestSupportTextAnalysis";
import {
  supportTextAnalysisResponseFormat
} from "../../../../src/support-processing-pipeline/v2/analyze-support-text/supportTextAnalysis.schema";

import type {
  AnalyzeSupportTextInput,
  ExtractableFieldDefinition,
  RecentInteractionContext,
  TextSurfaceAnalysis,
  TurnAnalysisPlan
} from "../../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";
import type {
  SupportTextSegment
} from "../../../../src/support-processing-pipeline/v2/analyze-support-text/typesAnalyzeSupportText.types";

vi.mock("../../../../src/llm/llm-client", function () {
  return {
    callLLM: vi.fn()
  };
});

const callLLMMock = vi.mocked(callLLM);

const turnAnalysisPlan: TurnAnalysisPlan = {
  analyzeText: true,
  analyzeAttachments: false,
  matchedPatternIds: []
};

const extractableFieldCatalog: ExtractableFieldDefinition[] = [
  {
    fieldName: "platform",
    description: "Execution platform explicitly mentioned by the user."
  },
  {
    fieldName: "operating_system",
    description: "Operating system explicitly mentioned by the user."
  },
  {
    fieldName: "feature_or_page",
    description: "Specific feature or page explicitly involved."
  },
  {
    fieldName: "error_message",
    description: "Exact error text shown to the user."
  },
  {
    fieldName: "trigger_action",
    description: "Normal product action that triggers or reveals the issue."
  },
  {
    fieldName: "pre_problem_state",
    description: "State before the issue started."
  },
  {
    fieldName: "affected_users",
    description: "Users explicitly affected."
  },
  {
    fieldName: "billing_issue_type",
    description: "Billing issue type explicitly stated."
  },
  {
    fieldName: "billing_date_or_period",
    description: "Billing period explicitly mentioned."
  },
  {
    fieldName: "notification_permission_status",
    description: "Whether Android notification permission is granted."
  }
];

const recentInteractionContext: RecentInteractionContext = {
  previousBotResponseSummary: "The bot asked whether billing is affected.",
  previousUserMessageSummary: "The user reported a problem."
};

const supportSegment: SupportTextSegment = {
  segmentId: "text_segment_1",
  verbatim: "mon compte est bloqué sur web",
  category: "support_relevant"
};

function buildTextSurfaceAnalysis(
  segments: TextSurfaceAnalysis["segments"]
): TextSurfaceAnalysis {
  return {
    userLanguage: "French",
    segments
  };
}

function buildInput(
  textSurfaceAnalysis: TextSurfaceAnalysis
): AnalyzeSupportTextInput {
  return {
    turnAnalysisPlan,
    textSurfaceAnalysis,
    recentInteractionContext,
    extractableFieldCatalog
  };
}

function completed(parsedResponse: unknown) {
  return {
    status: "completed" as const,
    parsedResponse,
    rawResponse: JSON.stringify(parsedResponse)
  };
}

function standaloneItem(params: {
  sourceSegmentIds: string[];
  sourceVerbatims: string[];
  summary?: string;
  supportNeeds?: string[];
  broadCategoryHint?: string;
  facts?: unknown[];
  testedActions?: unknown[];
}) {
  return {
    sourceSegmentIds: params.sourceSegmentIds,
    sourceVerbatims: params.sourceVerbatims,
    summary: params.summary ?? "The user reports a support issue.",
    primaryUserExpectation: "wants_solution",
    explicitUserRequest: null,
    supportNeeds: params.supportNeeds ?? ["possible_bug"],
    broadCategoryHint: params.broadCategoryHint ?? "bug",
    contextDependency: "standalone_but_may_match_existing",
    contextualAnswer: {
      type: "none",
      value: null,
      evidence: null
    },
    facts: params.facts ?? [],
    testedActions: params.testedActions ?? [],
    uncertainties: []
  };
}

function fallbackFor(segment: SupportTextSegment, understandingIndex = 1) {
  return {
    understandingId: `text_understanding_${understandingIndex}`,
    sourceSegmentIds: [segment.segmentId],
    sourceVerbatims: [segment.verbatim],
    summary: segment.verbatim,
    primaryUserExpectation: "unclear",
    supportNeeds: [],
    contextDependency: "needs_context_to_interpret",
    contextualAnswer: {
      type: "reference",
      value: null,
      evidence: segment.verbatim
    },
    facts: [],
    testedActions: [],
    uncertainties: [
      {
        reason: "deep_analysis_failed",
        detail: "The segment could not be analyzed reliably."
      }
    ]
  };
}

describe("analyzeSupportText", function () {
  beforeEach(function () {
    callLLMMock.mockReset();
  });

  it("does not call the LLM without support segments", async function () {
    await expect(
      analyzeSupportText(buildInput(buildTextSurfaceAnalysis([
        {
          segmentId: "text_segment_1",
          verbatim: "Bonjour",
          category: "standard_interaction",
          standardSubcategory: "greeting"
        }
      ])))
    ).resolves.toEqual({
      textUnderstandings: [],
      supportResponseCues: []
    });

    expect(callLLMMock).not.toHaveBeenCalled();
  });

  it("requests support text analysis with the expected schema", async function () {
    callLLMMock.mockResolvedValue({
      success: true,
      content: JSON.stringify({ items: [], supportResponseCues: [] })
    });

    await requestSupportTextAnalysis({
      prompt: buildAnalyzeSupportTextPrompt({
        supportSegments: [supportSegment],
        recentInteractionContext,
        extractableFieldCatalog
      })
    });

    expect(callLLMMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        preset: "fullWeightMessageAnalysis",
        temperature: 0,
        responseFormat: supportTextAnalysisResponseFormat
      })
    );
  });

  it("maps an unambiguous contextual yes to the previously asked notification field", async function () {
    callLLMMock.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        items: [
          {
            ...standaloneItem({
              sourceSegmentIds: ["text_segment_1"],
              sourceVerbatims: ["Yes"],
              summary: "The user confirms the requested setting."
            }),
            contextDependency: "needs_context_to_interpret",
            contextualAnswer: {
              type: "affirmative",
              value: true,
              evidence: "Yes"
            }
          }
        ],
        supportResponseCues: []
      })
    });

    const output = await analyzeSupportText({
      ...buildInput(buildTextSurfaceAnalysis([
        {
          segmentId: "text_segment_1",
          verbatim: "Yes",
          category: "support_relevant"
        }
      ])),
      recentInteractionContext: {
        previousBotResponseSummary:
          "The bot asked whether notification permission is granted.",
        previousBotQuestionFieldNames: [
          "notification_permission_status"
        ]
      }
    });

    expect(output.textUnderstandings[0]?.facts).toContainEqual({
      type: "catalogued_field",
      fieldName: "notification_permission_status",
      value: "granted",
      evidence: "Yes"
    });
  });

  it("builds a prompt that distinguishes trigger actions from tested actions", function () {
    const prompt = buildAnalyzeSupportTextPrompt({
      supportSegments: [supportSegment],
      recentInteractionContext,
      extractableFieldCatalog
    });
    const serializedPrompt = prompt.messages
      .map((message) => message.content)
      .join("\n");

    expect(serializedPrompt).toContain(
      "trigger_action = a normal in-product action"
    );
    expect(serializedPrompt).toContain(
      "testedActions = actions the user attempted to resolve"
    );
    expect(serializedPrompt).toContain(
      "must not also be extracted as trigger_action, pre_problem_state"
    );
    expect(serializedPrompt).toContain(
      "quand j'ouvre la page Facturation"
    );
    expect(serializedPrompt).toContain(
      "j'ai rafraîchi la page et ça échoue encore"
    );
    expect(serializedPrompt).toContain(
      "j'ai déjà réessayé de me connecter et ça échoue toujours"
    );
    expect(serializedPrompt).toContain("supportResponseCues");
    expect(serializedPrompt).toContain("embedded signals inside the provided support segments");
    expect(serializedPrompt).toContain("putain");
    expect(serializedPrompt).toContain("insupportable");
  });

  it("allows one source segment to produce two understandings", function () {
    const segment: SupportTextSegment = {
      segmentId: "text_segment_1",
      verbatim:
        "J'ai un problème avec mes mails. J'ai essayé 4 fois. Mon frère aussi. Puis j'ai reçu une facture deux fois pour mai.",
      category: "support_relevant"
    };
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [segment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          standaloneItem({
            sourceSegmentIds: [segment.segmentId],
            sourceVerbatims: [
              "J'ai un problème avec mes mails.",
              "J'ai essayé 4 fois.",
              "Mon frère aussi."
            ],
            summary: "Mail problem with retries and another affected user.",
            facts: [
              {
                type: "catalogued_field",
                fieldName: "affected_users",
                value: "Mon frère",
                evidence: "Mon frère aussi"
              }
            ]
          }),
          standaloneItem({
            sourceSegmentIds: [segment.segmentId],
            sourceVerbatims: [
              "j'ai reçu une facture deux fois pour mai"
            ],
            summary: "Duplicate billing for May.",
            supportNeeds: ["possible_billing_or_payment_action"],
            facts: [
              {
                type: "catalogued_field",
                fieldName: "billing_issue_type",
                value: "duplicate invoice",
                evidence: "facture deux fois"
              },
              {
                type: "catalogued_field",
                fieldName: "billing_date_or_period",
                value: "mai",
                evidence: "mai"
              }
            ]
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.supportResponseCues).toEqual([]);
    expect(output.textUnderstandings).toHaveLength(2);
    expect(output.textUnderstandings.map((item) => item.sourceSegmentIds))
      .toEqual([["text_segment_1"], ["text_segment_1"]]);
  });

  it("keeps embedded impolite wording as a support response cue", function () {
    const segment: SupportTextSegment = {
      segmentId: "text_segment_1",
      verbatim: "J’ai un putain de problème avec mon compte.",
      category: "support_relevant"
    };
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [segment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          standaloneItem({
            sourceSegmentIds: [segment.segmentId],
            sourceVerbatims: [segment.verbatim],
            summary: "Account problem with impolite wording.",
            supportNeeds: ["possible_account_or_access_action"],
            broadCategoryHint: "access_security"
          })
        ],
        supportResponseCues: [
          {
            sourceSegmentIds: [segment.segmentId],
            relatedUnderstandingIds: ["text_understanding_1"],
            verbatim: "putain",
            cueNote: "impolite wording"
          }
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.supportResponseCues).toEqual([
      {
        cueId: "support_response_cue_1",
        sourceSegmentIds: ["text_segment_1"],
        relatedUnderstandingIds: ["text_understanding_1"],
        verbatim: "putain",
        cueNote: "impolite wording"
      }
    ]);
  });

  it("removes invalid support response cues", function () {
    const segment: SupportTextSegment = {
      segmentId: "text_segment_1",
      verbatim: "Mon compte est encore bloqué, c’est vraiment insupportable.",
      category: "support_relevant"
    };
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [segment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          standaloneItem({
            sourceSegmentIds: [segment.segmentId],
            sourceVerbatims: [segment.verbatim],
            summary: "Blocked account with strong frustration.",
            supportNeeds: ["possible_account_or_access_action"],
            broadCategoryHint: "access_security"
          })
        ],
        supportResponseCues: [
          {
            sourceSegmentIds: [segment.segmentId],
            relatedUnderstandingIds: ["text_understanding_1"],
            verbatim: "not in segment",
            cueNote: "strong frustration"
          },
          {
            sourceSegmentIds: [segment.segmentId],
            relatedUnderstandingIds: ["unknown_understanding"],
            verbatim: "insupportable",
            cueNote: "strong frustration"
          }
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.supportResponseCues).toEqual([]);
  });

  it("allows several source segments to produce one understanding", function () {
    const firstSegment: SupportTextSegment = {
      segmentId: "text_segment_1",
      verbatim: "Mon compte est bloqué.",
      category: "support_relevant"
    };
    const secondSegment: SupportTextSegment = {
      segmentId: "text_segment_2",
      verbatim: "J'ai déjà essayé de me reconnecter.",
      category: "support_relevant"
    };
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [firstSegment, secondSegment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          standaloneItem({
            sourceSegmentIds: [secondSegment.segmentId, firstSegment.segmentId],
            sourceVerbatims: [
              "Mon compte est bloqué.",
              "J'ai déjà essayé de me reconnecter."
            ],
            summary: "Blocked account with a failed reconnection attempt.",
            testedActions: [
              {
                label: "reconnect",
                outcome: "unclear",
                evidence: "J'ai déjà essayé de me reconnecter."
              }
            ]
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.textUnderstandings).toHaveLength(1);
    expect(output.textUnderstandings[0]?.sourceSegmentIds).toEqual([
      "text_segment_1",
      "text_segment_2"
    ]);
    expect(output.textUnderstandings[0]?.testedActions).toHaveLength(1);
  });

  it("keeps a tested action attached to its issue", function () {
    const segment: SupportTextSegment = {
      segmentId: "text_segment_1",
      verbatim:
        "Sur Firefox, la page Facturation affiche une erreur 502. J'ai rafraîchi la page et ça échoue encore.",
      category: "support_relevant"
    };
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [segment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          standaloneItem({
            sourceSegmentIds: [segment.segmentId],
            sourceVerbatims: [segment.verbatim],
            summary: "Billing page shows a 502 error on Firefox after refresh.",
            facts: [
              {
                type: "catalogued_field",
                fieldName: "trigger_action",
                value: "opens billing page",
                evidence: "la page Facturation affiche une erreur 502"
              },
              {
                type: "catalogued_field",
                fieldName: "feature_or_page",
                value: "page Facturation",
                evidence: "page Facturation"
              },
              {
                type: "catalogued_field",
                fieldName: "error_message",
                value: "502",
                evidence: "erreur 502"
              }
            ],
            testedActions: [
              {
                label: "refresh page",
                outcome: "failed",
                evidence: "J'ai rafraîchi la page et ça échoue encore"
              }
            ]
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.textUnderstandings).toHaveLength(1);
    expect(output.textUnderstandings[0]?.testedActions).toEqual([
      {
        label: "refresh page",
        outcome: "failed",
        evidence: "J'ai rafraîchi la page et ça échoue encore"
      }
    ]);
    expect(output.textUnderstandings[0]?.facts).not.toContainEqual(
      expect.objectContaining({
        fieldName: "trigger_action",
        evidence: "J'ai rafraîchi la page et ça échoue encore"
      })
    );
  });

  it("does not model a login retry as pre-problem state or trigger action", function () {
    const segment: SupportTextSegment = {
      segmentId: "text_segment_1",
      verbatim:
        "Sur le web, mon compte affiche l'erreur Token expired. J'ai déjà réessayé de me connecter et ça échoue toujours.",
      category: "support_relevant"
    };
    const retryEvidence =
      "J'ai déjà réessayé de me connecter et ça échoue toujours";
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [segment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          standaloneItem({
            sourceSegmentIds: [segment.segmentId],
            sourceVerbatims: [segment.verbatim],
            summary: "Account error on web with a failed login retry.",
            facts: [
              {
                type: "catalogued_field",
                fieldName: "platform",
                value: "web",
                evidence: "web"
              },
              {
                type: "catalogued_field",
                fieldName: "error_message",
                value: "Token expired",
                evidence: "Token expired"
              }
            ],
            testedActions: [
              {
                label: "retry login",
                outcome: "failed",
                evidence: retryEvidence
              }
            ]
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.textUnderstandings).toHaveLength(1);
    expect(output.textUnderstandings[0]?.testedActions).toEqual([
      {
        label: "retry login",
        outcome: "failed",
        evidence: retryEvidence
      }
    ]);
    expect(output.textUnderstandings[0]?.facts).not.toContainEqual(
      expect.objectContaining({
        fieldName: "trigger_action",
        evidence: retryEvidence
      })
    );
    expect(output.textUnderstandings[0]?.facts).not.toContainEqual(
      expect.objectContaining({
        fieldName: "pre_problem_state",
        evidence: retryEvidence
      })
    );
  });

  it("keeps contextual answers separate from facts", function () {
    const segment: SupportTextSegment = {
      segmentId: "text_segment_1",
      verbatim: "Oui pour la facturation. D'ailleurs mon frère a aussi eu le problème.",
      category: "support_relevant"
    };
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [segment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          {
            ...standaloneItem({
              sourceSegmentIds: [segment.segmentId],
              sourceVerbatims: [segment.verbatim],
              summary: "The user confirms billing relevance and adds another affected user.",
              facts: [
                {
                  type: "catalogued_field",
                  fieldName: "affected_users",
                  value: "mon frère",
                  evidence: "mon frère a aussi eu le problème"
                }
              ]
            }),
            contextDependency: "needs_context_to_interpret",
            contextualAnswer: {
              type: "affirmative",
              value: true,
              evidence: "Oui pour la facturation"
            }
          }
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.textUnderstandings[0]?.contextualAnswer).toEqual({
      type: "affirmative",
      value: true,
      evidence: "Oui pour la facturation"
    });
    expect(output.textUnderstandings[0]?.facts).toEqual([
      {
        type: "catalogued_field",
        fieldName: "affected_users",
        value: "mon frère",
        evidence: "mon frère a aussi eu le problème"
      }
    ]);
  });

  it("falls back locally for invalid source segment ids", function () {
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [supportSegment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          standaloneItem({
            sourceSegmentIds: ["unknown_segment"],
            sourceVerbatims: [supportSegment.verbatim]
          })
        ]
      })
    });

    expect(output.textUnderstandings).toEqual([
      fallbackFor(supportSegment)
    ]);
  });

  it("falls back globally on invalid JSON", async function () {
    callLLMMock.mockResolvedValue({
      success: true,
      content: "not json"
    });

    await expect(
      analyzeSupportText(buildInput(buildTextSurfaceAnalysis([
        supportSegment
      ])))
    ).resolves.toEqual({
      textUnderstandings: [
        fallbackFor(supportSegment)
      ],
      supportResponseCues: []
    });
  });
});
