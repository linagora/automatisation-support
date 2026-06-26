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
    fieldName: "observed_result",
    description: "What actually happens."
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

function simplifiedItem(params: {
  sourceSegmentIds: string[];
  summary?: string;
  messageKinds?: unknown[];
  caseDetails?: unknown[];
  attemptedActions?: unknown[];
  supportMetadata?: unknown[];
}) {
  return {
    sourceSegmentIds: params.sourceSegmentIds,
    messageKinds: params.messageKinds ?? [
      {
        kind: "issue_report",
        evidence: "bloqué"
      }
    ],
    caseDetails: params.caseDetails ?? [],
    attemptedActions: params.attemptedActions ?? [],
    supportMetadata: params.supportMetadata ?? [],
    summary: params.summary ?? "The user reports a support issue."
  };
}

function fallbackFor(segment: SupportTextSegment, understandingIndex = 1) {
  return {
    understandingId: `text_understanding_${understandingIndex}`,
    sourceSegmentIds: [segment.segmentId],
    messageKinds: [],
    caseDetails: [],
    attemptedActions: [],
    supportMetadata: [],
    summary: segment.verbatim
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

  it("requests support text analysis with the simplified schema", async function () {
    callLLMMock.mockResolvedValue({
      success: true,
      content: JSON.stringify({ items: [] })
    });

    await requestSupportTextAnalysis({
      prompt: buildAnalyzeSupportTextPrompt({
        supportSegments: [supportSegment],
        recentInteractionContext,
        extractableFieldCatalog
      })
    });

    const serializedSchema = JSON.stringify(supportTextAnalysisResponseFormat);

    expect(callLLMMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        preset: "fullWeightMessageAnalysis",
        temperature: 0,
        responseFormat: supportTextAnalysisResponseFormat
      })
    );
    expect(serializedSchema).toContain("messageKinds");
    expect(serializedSchema).toContain("caseDetails");
    expect(serializedSchema).toContain("attemptedActions");
    expect(serializedSchema).toContain("supportMetadata");
    expect(serializedSchema).toContain("support_context");
    expect(serializedSchema).not.toContain("sourceVerbatims");
    expect(serializedSchema).not.toContain("primaryUserExpectation");
    expect(serializedSchema).not.toContain("supportResponseCues");
  });

  it("builds a prompt for the simplified LLM2 output", function () {
    const prompt = buildAnalyzeSupportTextPrompt({
      supportSegments: [supportSegment],
      recentInteractionContext,
      extractableFieldCatalog
    });
    const serializedPrompt = prompt.messages
      .map((message) => message.content)
      .join("\n");

    expect(serializedPrompt).toContain("messageKinds");
    expect(serializedPrompt).toContain("caseDetails");
    expect(serializedPrompt).toContain("attemptedActions");
    expect(serializedPrompt).toContain("supportMetadata");
    expect(serializedPrompt).toContain("visual_evidence_available");
    expect(serializedPrompt).toContain("support_context");
    expect(serializedPrompt).toContain("trigger_action is the normal product action");
    expect(serializedPrompt).toContain(
      "caseDetails may contain the interpreted value, but evidence must be the exact current answer text"
    );
    expect(serializedPrompt).toContain("evidence\": \"exact substring");
    expect(serializedPrompt).not.toContain("sourceVerbatims");
    expect(serializedPrompt).not.toContain("supportResponseCues");
    expect(serializedPrompt).not.toContain("testedActions");
  });

  it("formats the simplified LLM2 item shape", function () {
    const segment: SupportTextSegment = {
      segmentId: "text_segment_1",
      verbatim:
        "Sur web, la page Facturation affiche une erreur 502. J'ai rafraîchi la page et ça échoue encore.",
      category: "support_relevant"
    };
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [segment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          simplifiedItem({
            sourceSegmentIds: [segment.segmentId],
            summary: "Billing page shows a 502 error after refresh.",
            messageKinds: [
              {
                kind: "issue_report",
                evidence: "affiche une erreur 502"
              },
              {
                kind: "info_update",
                evidence: "Sur web"
              }
            ],
            caseDetails: [
              {
                key: "platform",
                value: "web",
                evidence: "web"
              },
              {
                key: "feature_or_page",
                value: "page Facturation",
                evidence: "page Facturation"
              },
              {
                key: "error_message",
                value: "502",
                evidence: "erreur 502"
              }
            ],
            attemptedActions: [
              {
                action: "refresh page",
                outcome: "failed",
                evidence: "J'ai rafraîchi la page et ça échoue encore"
              }
            ]
          })
        ]
      })
    });

    expect(output).toEqual({
      status: "valid",
      textUnderstandings: [
        {
          understandingId: "text_understanding_1",
          sourceSegmentIds: ["text_segment_1"],
          messageKinds: [
            {
              kind: "issue_report",
              evidence: "affiche une erreur 502"
            },
            {
              kind: "info_update",
              evidence: "Sur web"
            }
          ],
          caseDetails: [
            {
              key: "platform",
              value: "web",
              evidence: "web"
            },
            {
              key: "feature_or_page",
              value: "page Facturation",
              evidence: "page Facturation"
            },
            {
              key: "error_message",
              value: "502",
              evidence: "erreur 502"
            }
          ],
          attemptedActions: [
            {
              action: "refresh page",
              outcome: "failed",
              evidence: "J'ai rafraîchi la page et ça échoue encore"
            }
          ],
          supportMetadata: [],
          summary: "Billing page shows a 502 error after refresh."
        }
      ],
      supportResponseCues: []
    });
  });

  it("accepts support context message kinds with exact current evidence", function () {
    const segment: SupportTextSegment = {
      segmentId: "text_segment_1",
      verbatim: "Je ne peux pas envoyer de capture, l'app plante.",
      category: "support_relevant"
    };
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [segment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          simplifiedItem({
            sourceSegmentIds: [segment.segmentId],
            summary: "App crash with inability to provide a screenshot.",
            messageKinds: [
              {
                kind: "issue_report",
                evidence: "l'app plante"
              },
              {
                kind: "support_context",
                evidence: "Je ne peux pas envoyer de capture"
              }
            ],
            supportMetadata: [
              {
                key: "visual_evidence_available",
                value: false,
                evidence: "Je ne peux pas envoyer de capture"
              }
            ]
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.textUnderstandings[0]?.messageKinds).toEqual([
      {
        kind: "issue_report",
        evidence: "l'app plante"
      },
      {
        kind: "support_context",
        evidence: "Je ne peux pas envoyer de capture"
      }
    ]);
    expect(output.textUnderstandings[0]?.supportMetadata).toEqual([
      {
        key: "visual_evidence_available",
        value: false,
        evidence: "Je ne peux pas envoyer de capture"
      }
    ]);
  });

  it("keeps inferred case detail values when evidence is the exact current answer", function () {
    const segment: SupportTextSegment = {
      segmentId: "text_segment_1",
      verbatim: "Oui",
      category: "support_relevant"
    };
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [segment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          simplifiedItem({
            sourceSegmentIds: [segment.segmentId],
            summary: "The user confirms that the issue is still present.",
            messageKinds: [
              {
                kind: "confirmation",
                evidence: "Oui"
              }
            ],
            caseDetails: [
              {
                key: "observed_result",
                value: "still blocked",
                evidence: "Oui"
              }
            ]
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.textUnderstandings[0]?.caseDetails).toEqual([
      {
        key: "observed_result",
        value: "still blocked",
        evidence: "Oui"
      }
    ]);
  });

  it("drops secondary elements whose evidence is not an exact current substring", function () {
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [supportSegment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          simplifiedItem({
            sourceSegmentIds: [supportSegment.segmentId],
            messageKinds: [
              {
                kind: "issue_report",
                evidence: "account is blocked"
              }
            ],
            caseDetails: [
              {
                key: "platform",
                value: "web",
                evidence: "browser"
              }
            ],
            attemptedActions: [
              {
                action: "retry login",
                outcome: "failed",
                evidence: "I retried"
              }
            ]
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.textUnderstandings[0]).toEqual({
      understandingId: "text_understanding_1",
      sourceSegmentIds: ["text_segment_1"],
      messageKinds: [],
      caseDetails: [],
      attemptedActions: [],
      supportMetadata: [],
      summary: "The user reports a support issue."
    });
  });

  it("allows one source segment to produce two understandings", function () {
    const segment: SupportTextSegment = {
      segmentId: "text_segment_1",
      verbatim:
        "J'ai un problème avec mes mails. Mon frère aussi. Puis j'ai reçu une facture deux fois pour mai.",
      category: "support_relevant"
    };
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [segment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          simplifiedItem({
            sourceSegmentIds: [segment.segmentId],
            summary: "Mail problem with another affected user.",
            messageKinds: [
              {
                kind: "issue_report",
                evidence: "problème avec mes mails"
              }
            ],
            caseDetails: [
              {
                key: "affected_users",
                value: "Mon frère",
                evidence: "Mon frère aussi"
              }
            ]
          }),
          simplifiedItem({
            sourceSegmentIds: [segment.segmentId],
            summary: "Duplicate billing for May.",
            messageKinds: [
              {
                kind: "issue_report",
                evidence: "facture deux fois"
              }
            ],
            caseDetails: [
              {
                key: "billing_issue_type",
                value: "duplicate invoice",
                evidence: "facture deux fois"
              },
              {
                key: "billing_date_or_period",
                value: "mai",
                evidence: "mai"
              }
            ]
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.textUnderstandings).toHaveLength(2);
    expect(output.textUnderstandings.map((item) => item.sourceSegmentIds))
      .toEqual([["text_segment_1"], ["text_segment_1"]]);
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
          simplifiedItem({
            sourceSegmentIds: [secondSegment.segmentId, firstSegment.segmentId],
            summary: "Blocked account with a failed reconnection attempt.",
            messageKinds: [
              {
                kind: "issue_report",
                evidence: "compte est bloqué"
              }
            ],
            attemptedActions: [
              {
                action: "retry login",
                outcome: "unknown",
                evidence: "J'ai déjà essayé de me reconnecter"
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
    expect(output.textUnderstandings[0]?.attemptedActions).toEqual([
      {
        action: "retry login",
        outcome: "unknown",
        evidence: "J'ai déjà essayé de me reconnecter"
      }
    ]);
  });

  it("removes invalid secondary elements without restoring old fields", function () {
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [supportSegment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          {
            ...simplifiedItem({
              sourceSegmentIds: [supportSegment.segmentId],
              caseDetails: [
                {
                  key: "platform",
                  value: "web",
                  evidence: "web"
                },
                {
                  key: "question",
                  value: "unsupported intent field",
                  evidence: "not in segment"
                }
              ],
              attemptedActions: [
                {
                  action: "retry login",
                  outcome: "unclear",
                  evidence: "not in segment"
                }
              ],
              supportMetadata: [
                {
                  key: "visual_evidence_available",
                  value: false,
                  evidence: "not in segment"
                }
              ]
            }),
            sourceVerbatims: [supportSegment.verbatim],
            facts: [
              {
                type: "catalogued_field",
                fieldName: "platform",
                value: "web",
                evidence: "web"
              }
            ]
          }
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.textUnderstandings[0]).toEqual({
      understandingId: "text_understanding_1",
      sourceSegmentIds: ["text_segment_1"],
      messageKinds: [
        {
          kind: "issue_report",
          evidence: "bloqué"
        }
      ],
      caseDetails: [
        {
          key: "platform",
          value: "web",
          evidence: "web"
        }
      ],
      attemptedActions: [],
      supportMetadata: [],
      summary: "The user reports a support issue."
    });
    expect(output.textUnderstandings[0]).not.toHaveProperty("sourceVerbatims");
    expect(output.textUnderstandings[0]).not.toHaveProperty("facts");
  });

  it("falls back locally for invalid source segment ids", function () {
    const output = formatSupportTextAnalysisOutput({
      supportSegments: [supportSegment],
      extractableFieldCatalog,
      rawSupportTextAnalysis: completed({
        items: [
          simplifiedItem({
            sourceSegmentIds: ["unknown_segment"]
          })
        ]
      })
    });

    expect(output.textUnderstandings).toEqual([
      fallbackFor(supportSegment)
    ]);
    expect(output.supportResponseCues).toEqual([]);
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
