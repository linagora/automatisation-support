import { describe, expect, it } from "vitest";

import {
  convertLiveMemoryContextToSupportTopicContextV2
} from "../../../src/support-automation/build-input/convertLiveMemoryContextToSupportTopicContextV2";

import type {
  LiveMemoryContext
} from "../../../src/infrastructure/live-memory/typesLiveMemoryContext.types";

describe("convertLiveMemoryContextToSupportTopicContextV2", function () {
  it("converts live-memory topics to the V2 topic context shape", function () {
    const liveMemoryContext: LiveMemoryContext = {
      topics: [
        {
          topicId: 42,
          title: "Notifications Android",
          broadCategoryHint: "bug",
          summary: "Les notifications Android ne se déclenchent plus.",
          supportKnowledgeSummary: {
            summary:
              "Support knowledge lookup returned useful customer-facing knowledge for this topic.",
            customerFacing: null,
            supportFacing: null
          },
          unansweredRequestedFieldNames: ["error_message"],
          caseDetails: [
            {
              key: "platform",
              value: "Android",
              evidence: "Android"
            },
            {
              key: "error_message",
              value: null,
              evidence: "Pas de message d'erreur"
            }
          ],
          attemptedActions: [
            {
              action: "Réinstaller l'application",
              outcome: "failed",
              evidence: "déjà réinstallé"
            }
          ]
        }
      ],
      lastUserVerbatim: "Toujours rien après réinstallation.",
      lastBotVerbatim: "Pouvez-vous confirmer la version Android ?",
      userState: {
        status: "normal",
        flags: []
      }
    };

    expect(
      convertLiveMemoryContextToSupportTopicContextV2(liveMemoryContext)
    ).toEqual({
      topics: [
        {
          topicId: 42,
          title: "Notifications Android",
          broadCategoryHint: "bug",
          summary: "Les notifications Android ne se déclenchent plus.",
          supportKnowledgeSummary: {
            summary:
              "Support knowledge lookup returned useful customer-facing knowledge for this topic.",
            customerFacing: null,
            supportFacing: null
          },
          unansweredRequestedFieldNames: ["error_message"],
          caseDetails: [
            {
              key: "platform",
              value: "Android",
              evidence: "Android"
            },
            {
              key: "error_message",
              value: null,
              evidence: "Pas de message d'erreur"
            }
          ],
          attemptedActions: [
            {
              action: "Réinstaller l'application",
              outcome: "failed",
              evidence: "déjà réinstallé"
            }
          ]
        }
      ]
    });
  });

  it("keeps canonical nullable fields without generating legacy aliases", function () {
    const liveMemoryContext: LiveMemoryContext = {
      topics: [
        {
          topicId: 1,
          title: null,
          broadCategoryHint: "access_security",
          summary: "Compte bloque.",
          caseDetails: [],
          attemptedActions: []
        }
      ],
      lastUserVerbatim: null,
      lastBotVerbatim: null,
      userState: {
        status: "normal",
        flags: []
      }
    };

    const context =
      convertLiveMemoryContextToSupportTopicContextV2(liveMemoryContext);

    expect(context.topics[0]).toEqual(expect.objectContaining({
      topicId: 1,
      title: null,
      broadCategoryHint: "access_security",
      summary: "Compte bloque.",
      caseDetails: [],
      attemptedActions: [],
      supportKnowledgeSummary: null
    }));
    expect(JSON.stringify(context)).not.toContain(["id", "topic"].join("_"));
    expect(JSON.stringify(context)).not.toContain(["topic", "details"].join("_"));
  });
});
