import { describe, expect, it, vi } from "vitest";

const requestProposeTopicUpdatesMock = vi.hoisted(() => vi.fn());

vi.mock(
  "../../../../src/support-automation/support-processing-pipeline-v2/propose-topic-updates/requestProposeTopicUpdates",
  () => ({
    requestProposeTopicUpdates: requestProposeTopicUpdatesMock
  })
);

import {
  buildProposeTopicUpdatesPrompt
} from "../../../../src/support-automation/support-processing-pipeline-v2/propose-topic-updates/buildProposeTopicUpdatesPrompt";
import {
  buildTopicPatchesAndSnapshots
} from "../../../../src/support-automation/support-processing-pipeline-v2/propose-topic-updates/buildTopicPatchesAndSnapshots";
import {
  formatProposeTopicUpdatesOutput
} from "../../../../src/support-automation/support-processing-pipeline-v2/propose-topic-updates/formatProposeTopicUpdatesOutput";
import {
  proposeTopicUpdates
} from "../../../../src/support-automation/support-processing-pipeline-v2/propose-topic-updates/proposeTopicUpdates";
import {
  buildPlanKnowledgeEnrichmentPrompt
} from "../../../../src/support-automation/support-processing-pipeline-v2/plan-knowledge-enrichment/buildPlanKnowledgeEnrichmentPrompt";

import type {
  PlanKnowledgeEnrichmentInput,
  TextUnderstanding,
  TopicUpdateOp
} from "../../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

function understanding(params: {
  id: string;
  summary: string;
  caseDetails?: TextUnderstanding["caseDetails"];
  attemptedActions?: TextUnderstanding["attemptedActions"];
}): TextUnderstanding {
  return {
    understandingId: params.id,
    sourceSegmentIds: [`segment_${params.id}`],
    messageKinds: [],
    caseDetails: params.caseDetails ?? [],
    attemptedActions: params.attemptedActions ?? [],
    supportMetadata: [],
    summary: params.summary
  };
}

function completed(parsedResponse: unknown) {
  return {
    status: "completed" as const,
    parsedResponse,
    rawResponse: JSON.stringify(parsedResponse)
  };
}

function updateOp(overrides: Partial<TopicUpdateOp> = {}): TopicUpdateOp {
  return {
    op: "update",
    items: [0],
    topicId: 1,
    topic: null,
    merge: {
      caseDetails: [[0, 0]],
      attemptedActions: []
    },
    replace: null,
    review: null,
    ...overrides
  };
}

const accountTopic = {
  topicId: 1,
  id: "topic_account",
  title: "Compte bloque",
  broadCategoryHint: "access_security",
  summary: "Compte bloque.",
  caseDetails: [],
  attemptedActions: []
};

const billingTopic = {
  topicId: 2,
  id: "topic_billing",
  title: "Billing issue",
  broadCategoryHint: "billing",
  summary: "Billing issue.",
  caseDetails: [],
  attemptedActions: []
};

function createOp(overrides: Partial<TopicUpdateOp> = {}): TopicUpdateOp {
  return {
    op: "create",
    items: [0],
    topicId: null,
    topic: {
      title: "Android notifications",
      broadCategoryHint: "bug",
      summary: "Android notifications do not arrive."
    },
    merge: {
      caseDetails: [[0, 0]],
      attemptedActions: []
    },
    replace: null,
    review: null,
    ...overrides
  };
}

describe("buildTopicPatchesAndSnapshots", function () {
  it("adds a new caseDetail to an existing topic update snapshot", function () {
    const output = buildTopicPatchesAndSnapshots({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Erreur token expired",
          caseDetails: [
            {
              key: "error_message",
              value: "Token expired",
              evidence: "Token expired"
            }
          ]
        })
      ],
      topicUpdateOps: [
        updateOp()
      ]
    });

    expect(output.mergedTopicSnapshots[0]?.caseDetails).toEqual([
      {
        key: "error_message",
        value: "Token expired",
        evidence: "Token expired"
      }
    ]);
  });

  it("overwrites an existing caseDetail with the same key", function () {
    const output = buildTopicPatchesAndSnapshots({
      existingTopics: [
        {
          ...accountTopic,
          caseDetails: [
            {
              key: "platform",
              value: "web",
              evidence: "web"
            }
          ]
        }
      ],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Sur Android",
          caseDetails: [
            {
              key: "platform",
              value: "Android",
              evidence: "Sur Android"
            }
          ]
        })
      ],
      topicUpdateOps: [
        updateOp()
      ]
    });

    expect(output.mergedTopicSnapshots[0]?.caseDetails).toEqual([
      {
        key: "platform",
        value: "Android",
        evidence: "Sur Android"
      }
    ]);
  });

  it("applies replace.caseDetails by targeted key", function () {
    const output = buildTopicPatchesAndSnapshots({
      existingTopics: [
        {
          ...accountTopic,
          caseDetails: [
            {
              key: "platform",
              value: "web",
              evidence: "web"
            }
          ]
        }
      ],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Sur Android",
          caseDetails: [
            {
              key: "platform",
              value: "Android",
              evidence: "Sur Android"
            }
          ]
        })
      ],
      topicUpdateOps: [
        updateOp({
          merge: {
            caseDetails: [],
            attemptedActions: []
          },
          replace: {
            caseDetails: [
              {
                key: "platform",
                with: [0, 0]
              }
            ],
            attemptedActions: []
          }
        })
      ]
    });

    expect(output.mergedTopicSnapshots[0]?.caseDetails).toEqual([
      {
        key: "platform",
        value: "Android",
        evidence: "Sur Android"
      }
    ]);
  });

  it("adds or replaces attemptedActions deterministically", function () {
    const output = buildTopicPatchesAndSnapshots({
      existingTopics: [
        {
          ...accountTopic,
          attemptedActions: [
            {
              action: "retry login",
              outcome: "unknown",
              evidence: "I tried login"
            }
          ]
        }
      ],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Retry failed",
          attemptedActions: [
            {
              action: "retry login",
              outcome: "failed",
              evidence: "I retried login and it failed"
            }
          ]
        })
      ],
      topicUpdateOps: [
        updateOp({
          merge: {
            caseDetails: [],
            attemptedActions: [[0, 0]]
          }
        })
      ]
    });

    expect(output.mergedTopicSnapshots[0]?.attemptedActions).toEqual([
      {
        action: "retry login",
        outcome: "failed",
        evidence: "I retried login and it failed"
      }
    ]);
  });

  it("creates a new topic snapshot with a stable temporary id", function () {
    const output = buildTopicPatchesAndSnapshots({
      existingTopics: [],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Android notifications do not arrive",
          caseDetails: [
            {
              key: "platform",
              value: "Android",
              evidence: "Android"
            }
          ],
          attemptedActions: [
            {
              action: "enabled notifications",
              outcome: "success",
              evidence: "notifications are enabled"
            }
          ]
        })
      ],
      topicUpdateOps: [
        createOp({
          merge: {
            caseDetails: [[0, 0]],
            attemptedActions: [[0, 0]]
          }
        })
      ]
    });

    expect(output.topicPatches[0]?.temporaryTopicId).toBeNull();
    expect(output.mergedTopicSnapshots[0]).toMatchObject({
      topicId: 1,
      temporaryTopicId: null,
      isNewTopic: true,
      title: "Android notifications",
      broadCategoryHint: "bug",
      summary: "Android notifications do not arrive.",
      caseDetails: [
        {
          key: "platform",
          value: "Android",
          evidence: "Android"
        }
      ],
      attemptedActions: [
        {
          action: "enabled notifications",
          outcome: "success",
          evidence: "notifications are enabled"
        }
      ]
    });
  });

  it("keeps the stable existing topicId when an update op references the numeric id", function () {
    const output = buildTopicPatchesAndSnapshots({
      existingTopics: [
        {
          topicId: 1,
          title: "Twake Chat desktop messages",
          broadCategoryHint: "bug",
          summary: "Twake Chat desktop messages require a reload.",
          caseDetails: [
            {
              key: "product_or_service",
              value: "twake chat",
              evidence: ""
            },
            {
              key: "platform",
              value: "desktop app",
              evidence: ""
            },
            {
              key: "observed_result",
              value: "must reload conversation",
              evidence: ""
            }
          ],
          attemptedActions: [],
          supportKnowledgeSummary: null
        }
      ],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Ubuntu and latest version",
          caseDetails: [
            {
              key: "operating_system",
              value: "ubuntu",
              evidence: "ubuntu"
            },
            {
              key: "app_version",
              value: "latest",
              evidence: "dernière version"
            }
          ]
        })
      ],
      topicUpdateOps: [
        updateOp({
          topicId: 1,
          merge: {
            caseDetails: [[0, 0], [0, 1]],
            attemptedActions: []
          }
        })
      ]
    });

    expect(output.topicPatches[0]?.topicId).toBe(1);
    expect(output.mergedTopicSnapshots[0]).toEqual(expect.objectContaining({
      topicId: 1,
      temporaryTopicId: null,
      isNewTopic: false,
      title: "Twake Chat desktop messages",
      caseDetails: expect.arrayContaining([
        expect.objectContaining({
          key: "operating_system",
          value: "ubuntu"
        }),
        expect.objectContaining({
          key: "app_version",
          value: "latest"
        })
      ])
    }));
  });

  it("keeps live-memory supportKnowledgeSummary through topic update snapshots and enrichment prompts", async function () {
    const supportKnowledgeSummary = {
      summary:
        "Support knowledge lookup returned no usable customer-facing knowledge for this topic.",
      customerFacing: null,
      supportFacing: "Previous lookup had no reusable support-only signal."
    };
    const textUnderstanding = understanding({
      id: "text_understanding_1",
      summary: "Android version 14",
      caseDetails: [
        {
          key: "os_version",
          value: "Android 14",
          evidence: "Android 14"
        }
      ]
    });

    requestProposeTopicUpdatesMock.mockResolvedValueOnce(completed({
      ops: [
        updateOp({
          topicId: 1,
          merge: {
            caseDetails: [[0, 0]],
            attemptedActions: []
          }
        })
      ]
    }));

    const result = await proposeTopicUpdates({
      supportTopicKnowledge: {
        topics: [
          {
            topicId: 1,
            title: "Android notifications",
            broadCategoryHint: "bug",
            summary: "Android notifications are not received.",
            caseDetails: [],
            attemptedActions: [],
            supportKnowledgeSummary
          }
        ]
      },
      textUnderstandings: [textUnderstanding],
      recentInteractionContext: {
        previousUserMessageSummary: "none",
        previousBotResponseSummary: "none",
        previousBotQuestionFieldNames: []
      },
      latestUserMessageContent: "It happens on Android 14."
    });

    expect(result.topicUpdateOps[0]).toMatchObject({
      op: "update",
      topicId: 1
    });
    expect(result.mergedTopicSnapshots[0]).toMatchObject({
      title: "Android notifications",
      broadCategoryHint: "bug",
      summary: "Android notifications are not received.",
      caseDetails: [
        {
          key: "os_version",
          value: "Android 14",
          evidence: "Android 14"
        }
      ],
      attemptedActions: [],
      supportKnowledgeSummary
    });

    const enrichmentInput: PlanKnowledgeEnrichmentInput = {
      topicEvidence: {
        proposalId: "topic_patch_1",
        topicId: 1,
        topicSnapshot: result.mergedTopicSnapshots[0],
        topicSourceVerbatims: ["It happens on Android 14."],
        relatedUnderstandingIds: ["text_understanding_1"],
        relatedTextUnderstandings: [textUnderstanding],
        relatedAttachmentUnderstandings: [],
        relatedSupportResponseCues: []
      },
      topicSnapshot: result.mergedTopicSnapshots[0],
      extractableFieldCatalog: []
    };
    const prompt = buildPlanKnowledgeEnrichmentPrompt({
      input: enrichmentInput
    });
    const userPrompt = prompt.messages.find((message) => {
      return message.role === "user";
    })?.content ?? "";

    expect(userPrompt).toContain(
      `"supportKnowledgeSummary":{"summary":"${supportKnowledgeSummary.summary}"`
    );
    expect(userPrompt).toContain(
      `"supportFacing":"${supportKnowledgeSummary.supportFacing}"`
    );
  });
});

describe("formatProposeTopicUpdatesOutput", function () {
  it("parses a valid ops response without copying referenced values", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Compte toujours bloque",
          caseDetails: [
            {
              key: "observed_result",
              value: "still blocked",
              evidence: "Mon compte est toujours bloque"
            }
          ]
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          updateOp()
        ]
      })
    });

    expect(output).toEqual(expect.objectContaining({
      status: "valid",
      topicUpdateOps: [
        updateOp()
      ]
    }));
    expect(JSON.stringify(output.topicUpdateOps)).not.toContain("still blocked");
  });

  it("normalizes numeric topic ids from the LLM to the stable existing topicId", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [
        {
          topicId: 1,
          title: "Twake Chat desktop messages"
        }
      ],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Ubuntu and latest version",
          caseDetails: [
            {
              key: "operating_system",
              value: "ubuntu",
              evidence: "ubuntu"
            }
          ]
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          updateOp({
            topicId: 1
          })
        ]
      })
    });

    expect(output).toEqual(expect.objectContaining({
      status: "valid",
      topicUpdateOps: [
        updateOp({
          topicId: 1
        })
      ]
    }));
  });

  it("rejects an invalid item reference without creating a review op", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Compte bloque"
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          updateOp({
            items: [3]
          })
        ]
      })
    });

    expect(output).toEqual(expect.objectContaining({
      status: "invalid",
      reason: "some_ops_rejected",
      topicUpdateOps: []
    }));
  });

  it("debugs raw ops, rejected ops and understanding coverage", function () {
    const textUnderstandings = [
      understanding({
        id: "text_understanding_1",
        summary: "Compte bloque",
        caseDetails: [
          {
            key: "access_action",
            value: "login",
            evidence: "compte bloque"
          }
        ]
      }),
      understanding({
        id: "text_understanding_2",
        summary: "Facture en double",
        caseDetails: [
          {
            key: "billing_issue_type",
            value: "duplicate_invoice",
            evidence: "facture deux fois"
          }
        ]
      })
    ];
    const rawParsedResponse = {
      ops: [
        {
          op: "update",
          items: [0],
          topicId: 1,
          topic: null,
          merge: {
            caseDetails: [[0, 0]],
            attemptedActions: []
          },
          replace: null
        },
        {
          op: "update",
          items: [1],
          topicId: "2",
          topic: null,
          merge: {
            caseDetails: [[1, 0]],
            attemptedActions: []
          },
          replace: null
        }
      ]
    };

    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic, billingTopic],
      textUnderstandings,
      rawProposeTopicUpdates: completed(rawParsedResponse)
    });

    expect(output.status).toBe("invalid");
    expect(output.topicUpdateOps).toHaveLength(1);
    expect(output.debug.rawParsedResponse).toEqual(rawParsedResponse);
    expect(output.debug.rawOpsCount).toBe(2);
    expect(output.debug.formattedTopicUpdateOps).toEqual(output.topicUpdateOps);
    expect(output.debug.rejectedOps).toEqual([
      expect.objectContaining({
        rawOpIndex: 1,
        reason: "invalidTopicId",
        rawOp: rawParsedResponse.ops[1]
      })
    ]);
    expect(output.debug.understandingCoverage).toEqual([
      expect.objectContaining({
        itemIndex: 0,
        understandingId: "text_understanding_1",
        persistable: true,
        coveredByFormattedOpIndexes: [0]
      }),
      expect.objectContaining({
        itemIndex: 1,
        understandingId: "text_understanding_2",
        persistable: true,
        coveredByFormattedOpIndexes: []
      })
    ]);
    expect(output.debug.uncoveredPersistableItemIndexes).toEqual([1]);
  });

  it("rejects invalid caseDetails references without creating a review op", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Compte bloque",
          caseDetails: []
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          updateOp({
            merge: {
              caseDetails: [[0, 0]],
              attemptedActions: []
            }
          })
        ]
      })
    });

    expect(output.status).toBe("invalid");
    expect(output.topicUpdateOps).toEqual([]);
  });

  it("rejects invalid attemptedActions references without creating a review op", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Login retried",
          attemptedActions: []
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          updateOp({
            merge: {
              caseDetails: [],
              attemptedActions: [[0, 0]]
            }
          })
        ]
      })
    });

    expect(output.status).toBe("invalid");
    expect(output.topicUpdateOps).toEqual([]);
  });

  it("accepts update only when it references an existing topic", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [billingTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Billing confirmation"
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          updateOp({
            topicId: 2,
            merge: {
              caseDetails: [],
              attemptedActions: []
            }
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.topicUpdateOps[0]).toMatchObject({
      op: "update",
      topicId: 2
    });
  });

  it("accepts create with topicId null and topic present", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Duplicate invoice",
          caseDetails: [
            {
              key: "observed_result",
              value: "duplicate invoice",
              evidence: "facture recue deux fois"
            }
          ]
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          {
            op: "create",
            items: [0],
            topicId: null,
            topic: {
              title: "Duplicate invoice",
              broadCategoryHint: "billing",
              summary: "The user reports a duplicate invoice."
            },
            merge: {
              caseDetails: [[0, 0]],
              attemptedActions: []
            },
            replace: null,
            review: null
          }
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.topicUpdateOps[0]).toMatchObject({
      op: "create",
      topicId: null,
      topic: {
        broadCategoryHint: "billing"
      }
    });
  });

  it("normalizes notifications to an allowed broad category", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Android notifications are not received",
          caseDetails: [
            {
              key: "observed_result",
              value: "notifications not received",
              evidence: "I do not receive notifications"
            }
          ]
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          {
            op: "create",
            items: [0],
            topicId: null,
            topic: {
              title: "Android notifications not received",
              broadCategoryHint: "notifications",
              summary: "The user does not receive Android notifications."
            },
            merge: {
              caseDetails: [[0, 0]],
              attemptedActions: []
            },
            replace: null,
            review: null
          }
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.topicUpdateOps[0]?.topic?.broadCategoryHint).toBe("bug");
    expect(JSON.stringify(output.topicUpdateOps)).not.toContain(
      "\"notifications\""
    );
  });

  it("rejects none because LLM ops are limited to create or update", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Thanks"
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          {
            op: "none",
            items: [0],
            topicId: null,
            topic: null,
            merge: null,
            replace: null,
            review: null
          }
        ]
      })
    });

    expect(output).toEqual(expect.objectContaining({
      status: "invalid",
      reason: "some_ops_rejected",
      topicUpdateOps: []
    }));
  });

  it("rejects review because it is not a business op", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Ambiguous continuation"
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          {
            op: "review",
            items: [0],
            topicId: null,
            topic: null,
            merge: null,
            replace: null,
            review: "Ambiguous topic match."
          }
        ]
      })
    });

    expect(output).toEqual(expect.objectContaining({
      status: "invalid",
      reason: "some_ops_rejected",
      topicUpdateOps: []
    }));
  });

  it("accepts replace.caseDetails by key", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Updated account state",
          caseDetails: [
            {
              key: "observed_result",
              value: "still blocked",
              evidence: "toujours bloque"
            }
          ]
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          updateOp({
            merge: null,
            replace: {
              caseDetails: [
                {
                  key: "observed_result",
                  with: [0, 0]
                }
              ],
              attemptedActions: []
            }
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.topicUpdateOps[0]?.replace?.caseDetails).toEqual([
      {
        key: "observed_result",
        with: [0, 0]
      }
    ]);
  });

  it("accepts replace.attemptedActions by targetIndex", function () {
    const output = formatProposeTopicUpdatesOutput({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Retry failed",
          attemptedActions: [
            {
              action: "retry login",
              outcome: "failed",
              evidence: "j'ai reessaye"
            }
          ]
        })
      ],
      rawProposeTopicUpdates: completed({
        ops: [
          updateOp({
            merge: null,
            replace: {
              caseDetails: [],
              attemptedActions: [
                {
                  targetIndex: 0,
                  with: [0, 0]
                }
              ]
            }
          })
        ]
      })
    });

    expect(output.status).toBe("valid");
    expect(output.topicUpdateOps[0]?.replace?.attemptedActions).toEqual([
      {
        targetIndex: 0,
        with: [0, 0]
      }
    ]);
  });
});

describe("buildProposeTopicUpdatesPrompt", function () {
  it("documents the ops contract and does not ask for legacy proposal fields", function () {
    const prompt = buildProposeTopicUpdatesPrompt({
      existingTopics: [accountTopic],
      textUnderstandings: [
        understanding({
          id: "text_understanding_1",
          summary: "Compte bloque",
          caseDetails: [
            {
              key: "observed_result",
              value: "blocked",
              evidence: "Mon compte est bloque"
            }
          ]
        })
      ],
      recentInteractionContext: {},
      latestUserMessageContent: "Mon compte est bloque"
    });
    const content = prompt.messages.map((message) => {
      return message.content;
    }).join("\n");

    expect(content).toContain("\"ops\"");
    expect(content).toContain("\"op\": \"update|create\"");
    expect(content).not.toContain("\"op\": \"update|create|none|review\"");
    expect(content).toContain("Allowed broadCategoryHint values:");
    expect(content).toContain("bug | access_security | billing");
    expect(content).toContain("Do not invent narrow category values");
    expect(content).toContain("merge.caseDetails");
    expect(content).toContain("replace.attemptedActions");
    expect(content).not.toContain("update_existing_topic");
    expect(content).not.toContain("selectedSourceVerbatims");
    expect(content).not.toContain("fromUnderstandingIds");
    expect(content).not.toContain("op \"review\"");
    expect(content).not.toContain("op \"none\"");
  });
});
