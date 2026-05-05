import {
  runSolutionRetrieval
} from "../../../src/support-processing-pipeline/solution-retrieval/runSolutionRetrieval";

describe("runSolutionRetrieval", function () {
  it("bypasses retrieval and returns not_searched when decisionSearchingSolution is false", function () {
    const input = {
      decisionSearchingSolution: false,
      currentAnalysisOutput: {
        topics: []
      },
      conversationLogs: [],
      attemptHistory: []
    };

    const callOrder: string[] = [];

    const steps = {
      prepareRetrievalRequest: function () {
        callOrder.push("prepare-retrieval-request");

        return {
          query: "This step should not be called"
        };
      },

      callOpenRag: function () {
        callOrder.push("call-openrag");

        return {
          results: []
        };
      },

      formatPossibleSolutions: function () {
        callOrder.push("format-possible-solutions");

        return {
          status: "not_found" as const,
          reason: "This step should not be called"
        };
      }
    };

    const output = runSolutionRetrieval(input, steps);

    expect(callOrder).toEqual([]);

    expect(output).toEqual({
      status: "not_searched",
      reason: "searching_decision_was_false"
    });
  });

  it("runs all solution-retrieval steps and returns possibleSolutions when decisionSearchingSolution is true", function () {
    const input = {
      decisionSearchingSolution: true,
      currentAnalysisOutput: {
        topics: [
          {
            id_topic: "topic_1",
            topicLabel: "Problème de connexion",
            category: "login_issue",
            product: "Twake"
          }
        ]
      },
      conversationLogs: [
        {
          role: "user",
          content: "Bonjour, je n'arrive pas à me connecter."
        }
      ],
      attemptHistory: [
        {
          action: "password_reset",
          outcome: "failed"
        }
      ]
    };

    const callOrder: string[] = [];

    const steps = {
      prepareRetrievalRequest: function ({
        currentAnalysisOutput,
        conversationLogs,
        attemptHistory
      }: any) {
        callOrder.push("prepare-retrieval-request");

        return {
          query: "Comment résoudre un problème de connexion Twake ?",
          currentAnalysisOutput,
          conversationLogs,
          attemptHistory
        };
      },

      callOpenRag: function ({ retrievalRequest }: any) {
        callOrder.push("call-openrag");

        return {
          provider: "openrag",
          query: retrievalRequest.query,
          results: [
            {
              title: "Réinitialiser le mot de passe",
              content: "Demander à l'utilisateur de réinitialiser son mot de passe.",
              confidence: "high",
              source: "FAQ login"
            }
          ]
        };
      },

      formatPossibleSolutions: function ({
        rawRetrievalResponse,
        retrievalRequest,
        currentAnalysisOutput,
        conversationLogs,
        attemptHistory
      }: any) {
        callOrder.push("format-possible-solutions");

        return {
          status: "solutions_found" as const,
          reason: "reliable_solution_found",
          solutions: [
            {
              title: rawRetrievalResponse.results[0].title,
              content: rawRetrievalResponse.results[0].content,
              confidence: rawRetrievalResponse.results[0].confidence,
              source: rawRetrievalResponse.results[0].source
            }
          ],
          retrievalRequest,
          currentAnalysisOutput,
          conversationLogs,
          attemptHistory
        };
      }
    };

    const output = runSolutionRetrieval(input, steps);

    expect(callOrder).toEqual([
      "prepare-retrieval-request",
      "call-openrag",
      "format-possible-solutions"
    ]);

    expect(output.status).toBe("solutions_found");

    expect(output.reason).toBe("reliable_solution_found");

    expect(output.solutions).toEqual([
      {
        title: "Réinitialiser le mot de passe",
        content: "Demander à l'utilisateur de réinitialiser son mot de passe.",
        confidence: "high",
        source: "FAQ login"
      }
    ]);

    expect(output.retrievalRequest).toEqual({
      query: "Comment résoudre un problème de connexion Twake ?",
      currentAnalysisOutput: input.currentAnalysisOutput,
      conversationLogs: input.conversationLogs,
      attemptHistory: input.attemptHistory
    });
  });

  it("throws an explicit error when a required step is missing and retrieval is required", function () {
    const input = {
      decisionSearchingSolution: true,
      currentAnalysisOutput: {
        topics: [
          {
            id_topic: "topic_1",
            topicLabel: "Problème de connexion"
          }
        ]
      },
      conversationLogs: [],
      attemptHistory: []
    };

    expect(function () {
      runSolutionRetrieval(input);
    }).toThrow("prepareRetrievalRequest is not implemented yet");
  });

  it("throws an explicit error when possibleSolutions has an invalid status", function () {
    const input = {
      decisionSearchingSolution: true,
      currentAnalysisOutput: {
        topics: [
          {
            id_topic: "topic_1",
            topicLabel: "Problème de connexion"
          }
        ]
      },
      conversationLogs: [],
      attemptHistory: []
    };

    const steps = {
      prepareRetrievalRequest: function () {
        return {
          query: "Comment résoudre un problème de connexion ?"
        };
      },

      callOpenRag: function () {
        return {
          results: []
        };
      },

      formatPossibleSolutions: function () {
        return {
          status: "invalid_status"
        } as any;
      }
    };

    expect(function () {
      runSolutionRetrieval(input, steps);
    }).toThrow(
      "possibleSolutions.status must be one of: not_searched, not_found, solutions_found"
    );
  });
});