import {
  runResponseProducer
} from "../../../src/support-processing-pipeline/response-producer/runResponseProducer";

describe("runResponseProducer", function () {
  it("runs all response-producer steps and returns userResponse", function () {
    const input = {
      responsePlan: {
        userLanguage: "fr",
        messages: [
          {
            messageType: "politeness_introduction"
          },
          {
            messageType: "topic_response",
            topicId: 1,
            topicLabel: "Problème de connexion",
            variables: {
              mainResponseType: "direct_answer"
            }
          }
        ]
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
          messages: responseStrings
        };
      }
    };

    const output = runResponseProducer(input, steps);

    expect(callOrder).toEqual([
      "apply-response-templates",
      "assemble-user-response"
    ]);

    expect(output).toEqual({
      messages: [
        "Bonjour, je vais vous aider.",
        "Pour votre problème de connexion, vous pouvez réinitialiser votre mot de passe."
      ]
    });
  });

  it("throws an explicit error when applyResponseTemplates is missing", function () {
    const input = {
      responsePlan: {
        userLanguage: "fr",
        messages: []
      }
    };

    expect(function () {
      runResponseProducer(input);
    }).toThrow("applyResponseTemplates is not implemented yet");
  });

  it("throws an explicit error when assembleUserResponse is missing", function () {
    const input = {
      responsePlan: {
        userLanguage: "fr",
        messages: []
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
      runResponseProducer(input, steps);
    }).toThrow("assembleUserResponse is not implemented yet");
  });
});