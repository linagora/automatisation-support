import { describe, expect, it } from "vitest";

import {
  buildProposeTopicUpdatesPrompt
} from "../../../src/support-processing-pipeline-v2/propose-topic-updates/buildProposeTopicUpdatesPrompt";
import {
  buildTopicPatchesAndSnapshots
} from "../../../src/support-processing-pipeline-v2/propose-topic-updates/buildTopicPatchesAndSnapshots";
import {
  formatProposeTopicUpdatesOutput
} from "../../../src/support-processing-pipeline-v2/propose-topic-updates/formatProposeTopicUpdatesOutput";

import type {
  TextUnderstanding,
  TopicUpdateOp
} from "../../../src/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

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
    topicId: "topic_account",
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
  id: "topic_account",
  title: "Compte bloque",
  broadCategoryHint: "access_security",
  summary: "Compte bloque.",
  caseDetails: [],
  attemptedActions: []
};

const billingTopic = {
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

    expect(output.topicPatches[0]?.temporaryTopicId).toBe("new_topic_1");
    expect(output.mergedTopicSnapshots[0]).toMatchObject({
      snapshotId: "new_topic_1",
      temporaryTopicId: "new_topic_1",
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

    expect(output).toEqual({
      status: "valid",
      topicUpdateOps: [
        updateOp()
      ]
    });
    expect(JSON.stringify(output.topicUpdateOps)).not.toContain("still blocked");
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

    expect(output).toEqual({
      status: "invalid",
      reason: "invalid_ops",
      topicUpdateOps: []
    });
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
            topicId: "topic_billing",
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
      topicId: "topic_billing"
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

    expect(output).toEqual({
      status: "invalid",
      reason: "invalid_ops",
      topicUpdateOps: []
    });
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

    expect(output).toEqual({
      status: "invalid",
      reason: "invalid_ops",
      topicUpdateOps: []
    });
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
