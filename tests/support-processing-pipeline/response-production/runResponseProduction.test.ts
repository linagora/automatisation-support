import {
  runResponseProduction
} from "../../../src/support-processing-pipeline/response-production/runResponseProduction";

import type {
  ResponseProductionInput
} from "../../../src/support-processing-pipeline/response-production/runResponseProduction";

describe("runResponseProduction", function () {
  it("runs all response-production steps and returns userResponse", function () {
    const input: ResponseProductionInput = {
      responsePlan: {
        responseLanguage: "french",
        messagesPlan: {
          securityGatePlanMessage: undefined,
          suspiciousPlanMessage: undefined,
          lackComprehensionPlanMessage: undefined,
          scopeBoundaryPlanMessages: [],
          topicPlanMessages: [
            {
              politeness_opening: "salutation_and_understanding_1",
              topic_relation_acknowledgement: {
                no_matched_historical_topic_count: 1,
                matched_historical_topic_count: 0
              },
              topics_responses: [
                {
                  topic_response: {
                    title: {
                      topic_id: 1,
                      topic_label: "Problème de connexion",
                      matched_historical_topic: false
                    },
                    updated_fields_acknowledgement: {},
                    main_response: {
                      type: "acknowledgement"
                    },
                    next_step: "wait_more_info"
                  }
                }
              ],
              politeness_closure: "thanks_for_cooperation"
            }
          ],
          signalPlanMessages: [],
          handoverPlanMessages: []
        }
      }
    };

    const callOrder: string[] = [];

    const steps = {
      applyResponseTemplates: function ({ responsePlan }: any) {
        callOrder.push("apply-response-templates");

        expect(responsePlan).toEqual(input.responsePlan);

        return [
          "Bonjour, je vais vous aider.",
          "Pour votre problème de connexion, vous pouvez réinitialiser votre mot de passe."
        ];
      },

      assembleUserResponse: function ({ responsePlan, responseStrings }: any) {
        callOrder.push("assemble-user-response");

        expect(responsePlan).toEqual(input.responsePlan);
        expect(responseStrings).toEqual([
          "Bonjour, je vais vous aider.",
          "Pour votre problème de connexion, vous pouvez réinitialiser votre mot de passe."
        ]);

        return {
          messages: responseStrings.map((responseString: string) => {
            return {
              type: "topic_response",
              content: responseString
            };
          })
        };
      }
    };

    const output = runResponseProduction(input, steps);

    expect(callOrder).toEqual([
      "apply-response-templates",
      "assemble-user-response"
    ]);

    expect(output).toEqual({
      messages: [
        {
          type: "topic_response",
          content: "Bonjour, je vais vous aider."
        },
        {
          type: "topic_response",
          content:
            "Pour votre problème de connexion, vous pouvez réinitialiser votre mot de passe."
        }
      ]
    });
  });

  it("throws an explicit error when applyResponseTemplates is missing", function () {
    const input = {
      responsePlan: {
        responseLanguage: "french",
        messagesPlan: {
          securityGatePlanMessage: undefined,
          suspiciousPlanMessage: undefined,
          lackComprehensionPlanMessage: undefined,
          scopeBoundaryPlanMessages: [],
          topicPlanMessages: [],
          signalPlanMessages: [],
          handoverPlanMessages: []
        }
      }
    };

    expect(function () {
      runResponseProduction(input);
    }).toThrow("applyResponseTemplates is not implemented yet");
  });

  it("throws an explicit error when assembleUserResponse is missing", function () {
    const input = {
      responsePlan: {
        responseLanguage: "french",
        messagesPlan: {
          securityGatePlanMessage: undefined,
          suspiciousPlanMessage: undefined,
          lackComprehensionPlanMessage: undefined,
          scopeBoundaryPlanMessages: [],
          topicPlanMessages: [],
          signalPlanMessages: [],
          handoverPlanMessages: []
        }
      }
    };

    const steps = {
      applyResponseTemplates: function () {
        return [
          "Bonjour"
        ];
      }
    };

    expect(function () {
      runResponseProduction(input, steps);
    }).toThrow("assembleUserResponse is not implemented yet");
  });
});
