const {
  runSupportProcessingPipeline
} = require("../../src/support-processing-pipeline/runSupportProcessingPipeline");

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

    const steps = {
      runMessageAnalysis: function () {
        return {
          intent: "login_issue"
        };
      },

      runSearchingDecision: function () {
        return true;
      },

      runSolutionRetrieval: function () {
        return {
          status: "solutions_found",
          solutions: []
        };
      },

      runResponseDecision: function () {
        return {
          type: "answer_with_solution"
        };
      },

      produceResponse: function () {
        return "Réponse automatique";
      },

      produceTicketData: function () {
        return {
          status: "waiting_user"
        };
      }
    };

    const output = runSupportProcessingPipeline(input, steps);

    expect(output).toEqual({
      userResponse: "Réponse automatique",
      updatedDataTicket: {
        status: "waiting_user"
      },
      dataCollectorProcessing: {}
    });
  });
});