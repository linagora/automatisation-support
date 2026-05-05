import {
  runSearchingDecision,
  createInitialSearchingDecisionRoute,
  updateSearchingDecisionRoute
} from "../../../src/support-processing-pipeline/searching-decision/runSearchingDecision";

describe("runSearchingDecision", function () {
  it("runs all searching-decision steps and returns decisionSearchingSolution", function () {
    const input = {
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
      previousAnalysisOutput: null,
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
      ],
      userInformations: {
        userId: "user_123"
      }
    };

    const callOrder: string[] = [];

    let finalDecisionInput: any = null;

    const steps = {
      runTopicRouting: function ({
        currentAnalysisOutput,
        decisionRouteSearchingDecision
      }: any) {
        callOrder.push("topic-routing");

        return {
          topicIsPresent: Array.isArray(currentAnalysisOutput.topics),
          stopReason: decisionRouteSearchingDecision.stopReason
        };
      },

      evaluateSolutionLikelihood: function ({
        topicRoutingResult
      }: any) {
        callOrder.push("solution-likelihood");

        return {
          shouldEvaluateSolutionLikelihood: topicRoutingResult.topicIsPresent === true,
          stopReason: null
        };
      },

      evaluateTopicQualification: function ({
        solutionLikelihoodResult
      }: any) {
        callOrder.push("topic-qualification");

        return {
          shouldEvaluateTopicQualification:
            solutionLikelihoodResult.shouldEvaluateSolutionLikelihood === true,
          stopReason: null
        };
      },

      evaluateHelpfulness: function ({
        topicsQualificationResult
      }: any) {
        callOrder.push("helpfulness-evaluation");

        return {
          shouldEvaluateHelpfulness:
            topicsQualificationResult.shouldEvaluateTopicQualification === true,
          stopReason: null
        };
      },

      calculateSearchingDecision: function (input: any) {
        callOrder.push("final-searching-decision");

        finalDecisionInput = input;

        return (
          input.decisionRouteSearchingDecision.topicIsPresent === true &&
          input.decisionRouteSearchingDecision.shouldEvaluateSolutionLikelihood === true &&
          input.decisionRouteSearchingDecision.shouldEvaluateTopicQualification === true &&
          input.decisionRouteSearchingDecision.shouldEvaluateHelpfulness === true
        );
      }
    };

    const output = runSearchingDecision(input, steps);

    expect(callOrder).toEqual([
      "topic-routing",
      "solution-likelihood",
      "topic-qualification",
      "helpfulness-evaluation",
      "final-searching-decision"
    ]);

    expect(output).toBe(true);

    expect(finalDecisionInput.decisionRouteSearchingDecision).toEqual({
      topicIsPresent: true,
      shouldEvaluateSolutionLikelihood: true,
      shouldEvaluateTopicQualification: true,
      shouldEvaluateHelpfulness: true,
      shouldCalculateFinalDecision: true,
      stopReason: null
    });

    expect(finalDecisionInput.topicRoutingResult).toEqual({
      topicIsPresent: true,
      stopReason: null
    });

    expect(finalDecisionInput.solutionLikelihoodResult).toEqual({
      shouldEvaluateSolutionLikelihood: true,
      stopReason: null
    });

    expect(finalDecisionInput.topicsQualificationResult).toEqual({
      shouldEvaluateTopicQualification: true,
      stopReason: null
    });

    expect(finalDecisionInput.helpfulnessEvaluationResult).toEqual({
      shouldEvaluateHelpfulness: true,
      stopReason: null
    });
  });

  it("returns false when the final searching decision step decides not to search", function () {
    const input = {
      currentAnalysisOutput: {
        topics: []
      },
      previousAnalysisOutput: null,
      conversationLogs: [],
      attemptHistory: [],
      userInformations: {}
    };

    const callOrder: string[] = [];

    const steps = {
      runTopicRouting: function () {
        callOrder.push("topic-routing");

        return {
          topicIsPresent: false,
          stopReason: "no_exploitable_topic"
        };
      },

      evaluateSolutionLikelihood: function () {
        callOrder.push("solution-likelihood");

        return {
          shouldEvaluateSolutionLikelihood: false,
          stopReason: "no_exploitable_topic"
        };
      },

      evaluateTopicQualification: function () {
        callOrder.push("topic-qualification");

        return {
          shouldEvaluateTopicQualification: false,
          stopReason: "no_exploitable_topic"
        };
      },

      evaluateHelpfulness: function () {
        callOrder.push("helpfulness-evaluation");

        return {
          shouldEvaluateHelpfulness: false,
          stopReason: "no_exploitable_topic"
        };
      },

      calculateSearchingDecision: function () {
        callOrder.push("final-searching-decision");

        return false;
      }
    };

    const output = runSearchingDecision(input, steps);

    expect(callOrder).toEqual([
      "topic-routing",
      "solution-likelihood",
      "topic-qualification",
      "helpfulness-evaluation",
      "final-searching-decision"
    ]);

    expect(output).toBe(false);
  });

  it("throws an explicit error when a required step is missing", function () {
    const input = {
      currentAnalysisOutput: {
        topics: [
          {
            id_topic: "topic_1",
            topicLabel: "Problème de connexion"
          }
        ]
      },
      previousAnalysisOutput: null,
      conversationLogs: [],
      attemptHistory: [],
      userInformations: {}
    };

    expect(function () {
      runSearchingDecision(input);
    }).toThrow("runTopicRouting is not implemented yet");
  });

  it("throws an explicit error when decisionSearchingSolution is not a boolean", function () {
    const input = {
      currentAnalysisOutput: {
        topics: [
          {
            id_topic: "topic_1",
            topicLabel: "Problème de connexion"
          }
        ]
      },
      previousAnalysisOutput: null,
      conversationLogs: [],
      attemptHistory: [],
      userInformations: {}
    };

    const steps = {
      runTopicRouting: function () {
        return {
          topicIsPresent: true,
          stopReason: null
        };
      },

      evaluateSolutionLikelihood: function () {
        return {
          shouldEvaluateSolutionLikelihood: true,
          stopReason: null
        };
      },

      evaluateTopicQualification: function () {
        return {
          shouldEvaluateTopicQualification: true,
          stopReason: null
        };
      },

      evaluateHelpfulness: function () {
        return {
          shouldEvaluateHelpfulness: true,
          stopReason: null
        };
      },

      calculateSearchingDecision: function () {
        return "true" as any;
      }
    };

    expect(function () {
      runSearchingDecision(input, steps);
    }).toThrow("decisionSearchingSolution must be a boolean");
  });

  it("creates the initial searching-decision route", function () {
    const decisionRoute = createInitialSearchingDecisionRoute();

    expect(decisionRoute).toEqual({
      topicIsPresent: null,
      shouldEvaluateSolutionLikelihood: true,
      shouldEvaluateTopicQualification: true,
      shouldEvaluateHelpfulness: true,
      shouldCalculateFinalDecision: true,
      stopReason: null
    });
  });

  it("updates the searching-decision route without mutating the previous object", function () {
    const initialDecisionRoute = createInitialSearchingDecisionRoute();

    const updatedDecisionRoute = updateSearchingDecisionRoute(initialDecisionRoute, {
      topicIsPresent: false,
      shouldEvaluateSolutionLikelihood: false,
      stopReason: "no_exploitable_topic"
    });

    expect(updatedDecisionRoute).toEqual({
      topicIsPresent: false,
      shouldEvaluateSolutionLikelihood: false,
      shouldEvaluateTopicQualification: true,
      shouldEvaluateHelpfulness: true,
      shouldCalculateFinalDecision: true,
      stopReason: "no_exploitable_topic"
    });

    expect(initialDecisionRoute).toEqual({
      topicIsPresent: null,
      shouldEvaluateSolutionLikelihood: true,
      shouldEvaluateTopicQualification: true,
      shouldEvaluateHelpfulness: true,
      shouldCalculateFinalDecision: true,
      stopReason: null
    });
  });
});