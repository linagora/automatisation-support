import {
  runResponseProduction
} from "../../../src/support-processing-pipeline/response-production/runResponseProduction";

import type {
  ResponseProductionInput
} from "../../../src/support-processing-pipeline/response-production/runResponseProduction";

describe("runResponseProduction", function () {
  it("transforms the response plan into final user messages", function () {
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
                      topic_label: "Probleme de connexion",
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

    const output = runResponseProduction(input);

    expect(output).toEqual({
      messages: [
        {
          type: "topic_response",
          content:
            "Bonjour, merci pour votre message.\nJ’ai identifié 1 nouveau(x) sujet(s) et 0 sujet(s) faisant référence à un sujet en cours.\nSujet 1 - undefined - Probleme de connexion - (Nouveau sujet) undefined Nous avons désormais toutes les informations pour que le support humain puisse prendre la main et vous répondre au mieux. Nous attendons votre retour pour obtenir plus d’informations.\nundefined"
        }
      ]
    });
  });

  it("keeps security and handover messages in pipeline order", function () {
    const input: ResponseProductionInput = {
      responsePlan: {
        responseLanguage: "english",
        messagesPlan: {
          securityGatePlanMessage: {
            gateFailed: ["latestUserMessageSecurityDecision"]
          },
          suspiciousPlanMessage: undefined,
          lackComprehensionPlanMessage: undefined,
          scopeBoundaryPlanMessages: [],
          topicPlanMessages: [],
          signalPlanMessages: [],
          handoverPlanMessages: [{}]
        }
      }
    };

    const output = runResponseProduction(input);

    expect(output).toEqual({
      messages: [
        {
          type: "security_gate",
          content:
            "Our security system identified your message as potentially problematic and automatic analysis was stopped. Support will take over to confirm or dismiss this decision."
        },
        {
          type: "handover",
          content: "Support will soon review and respond to your request."
        }
      ]
    });
  });
});
