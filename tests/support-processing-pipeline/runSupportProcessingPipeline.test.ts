import {
  runSupportProcessingPipeline
} from "../../src/support-processing-pipeline/runSupportProcessingPipeline";

describe("runSupportProcessingPipeline", function () {
  it("runs all pipeline steps and returns the final output", function () {
    const input = {
      latestUserMessage: {
        text: "Bonjour, je n'arrive pas à me connecter."
      },
      attachments: [],
      previousAnalysisOutput: null,
      conversationLogs: [],
      attemptHistory: [],
      userInformations: {
        userId: "user_123"
      }
    };

    const analysisDelta = {
      hasNewInformation: true,
      newTopics: [
        {
          id_topic: 1,
          topic_label: "Problème de connexion"
        }
      ],
      updatedTopics: [],
      resolvedTopics: [],
      newSignals: [],
      newScopeBoundaries: [],
      warningComprehensionChanged: false
    };

    const expectedCurrentAnalysisOutput = {
      intent: "login_issue",
      analysisDelta
    };

    const possibleSolutions = {
      status: "solutions_found",
      solutions: [
        {
          title: "Solution de test"
        }
      ]
    };

    const callOrder: string[] = [];

    const steps = {
      runMessageAnalysis: function () {
        callOrder.push("message-analysis");

        return expectedCurrentAnalysisOutput;
      },

      runSearchingDecision: function (stepInput: any) {
        callOrder.push("searching-decision");

        expect(stepInput.currentAnalysisOutput).toEqual(expectedCurrentAnalysisOutput);
        expect(stepInput.analysisDelta).toEqual(analysisDelta);
        expect(stepInput.previousAnalysisOutput).toBeNull();

        return true;
      },

      runSolutionRetrieval: function (stepInput: any) {
        callOrder.push("solution-retrieval");

        expect(stepInput.decisionSearchingSolution).toBe(true);
        expect(stepInput.currentAnalysisOutput).toEqual(expectedCurrentAnalysisOutput);
        expect(stepInput.analysisDelta).toEqual(analysisDelta);

        return possibleSolutions;
      },

      runResponseDecision: function (stepInput: any) {
        callOrder.push("response-decision");

        expect(stepInput.currentAnalysisOutput).toEqual(expectedCurrentAnalysisOutput);
        expect(stepInput.analysisDelta).toEqual(analysisDelta);
        expect(stepInput.possibleSolutions).toEqual(possibleSolutions);

        return {
          type: "answer_with_solution"
        };
      },

      produceResponse: function (stepInput: any) {
        callOrder.push("response-producer");

        expect(stepInput.responsePlan).toEqual({
          type: "answer_with_solution"
        });
        expect(stepInput.currentAnalysisOutput).toEqual(expectedCurrentAnalysisOutput);
        expect(stepInput.analysisDelta).toEqual(analysisDelta);
        expect(stepInput.possibleSolutions).toEqual(possibleSolutions);

        return "Réponse automatique";
      },

      produceTicketData: function (stepInput: any) {
        callOrder.push("data-producer");

        expect(stepInput.currentAnalysisOutput).toEqual(expectedCurrentAnalysisOutput);
        expect(stepInput.analysisDelta).toEqual(analysisDelta);
        expect(stepInput.possibleSolutions).toEqual(possibleSolutions);
        expect(stepInput.responsePlan).toEqual({
          type: "answer_with_solution"
        });

        return {
          status: "waiting_user"
        };
      }
    };

    const output = runSupportProcessingPipeline(input, steps);

    expect(callOrder).toEqual([
      "message-analysis",
      "searching-decision",
      "solution-retrieval",
      "response-decision",
      "response-producer",
      "data-producer"
    ]);

    expect(output).toEqual({
      userResponse: "Réponse automatique",
      updatedDataTicket: {
        status: "waiting_user"
      }
    });
  });
});