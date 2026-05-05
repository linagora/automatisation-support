/**
 * Response Producer
 *
 * This file is the local orchestrator of the response-producer block.
 *
 * This block applies response templates to produce user-facing string messages
 * according to the structured responsePlan.
 *
 * INPUTS:
 * - responsePlan
 *
 * OUTPUT:
 * - userResponse
 *
 * Internal steps:
 *
 * 1. Apply response templates
 *    Transforms each structured responsePlan message into a user-facing string.
 *    INPUTS  - responsePlan
 *    OUTPUTS - responseStrings
 *
 * 2. Assemble user response
 *    Builds the final userResponse format with one or several messages to send.
 *    INPUTS  - responseStrings
 *    OUTPUTS - userResponse
 */

type UnknownObject = Record<string, unknown>;

type ResponseProducerStep<TInput, TOutput> = (input: TInput) => TOutput;

interface ResponsePlan {
  userLanguage: string | null;
  messages: UnknownObject[];
}

interface ResponseProducerInput {
  responsePlan: ResponsePlan;
}

interface UserResponse {
  messages: string[];
}

interface ResponseProducerSteps {
  applyResponseTemplates?: ResponseProducerStep<UnknownObject, string[]>;
  assembleUserResponse?: ResponseProducerStep<UnknownObject, UserResponse>;
}

/**
 * Creates a placeholder function for response-producer steps that are not implemented yet.
 */
function createMissingStep<TInput, TOutput>(
  stepName: string
): ResponseProducerStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

/**
 * Temporary assertion placeholders.
 *
 * These functions are intentionally minimal for now.
 * Their real validation logic can be implemented later in a dedicated assertions file.
 */
function assertValidResponseProducerInput(
  input: unknown
): asserts input is ResponseProducerInput {}

function assertValidResponseStrings(
  responseStrings: unknown
): asserts responseStrings is string[] {}

function assertValidUserResponse(
  userResponse: unknown
): asserts userResponse is UserResponse {}

/**
 * Runs the response-producer block.
 */
function runResponseProducer(
  input: ResponseProducerInput,
  steps: ResponseProducerSteps = {}
): UserResponse {
  assertValidResponseProducerInput(input);

  const responseProducerSteps: Required<ResponseProducerSteps> = {
    applyResponseTemplates:
      steps.applyResponseTemplates ||
      createMissingStep<UnknownObject, string[]>("applyResponseTemplates"),

    assembleUserResponse:
      steps.assembleUserResponse ||
      createMissingStep<UnknownObject, UserResponse>("assembleUserResponse")
  };

  /**
   * Step 1: Apply response templates
   */
  const responseStrings = responseProducerSteps.applyResponseTemplates({
    responsePlan: input.responsePlan
  });

  assertValidResponseStrings(responseStrings);

  /**
   * Step 2: Assemble user response
   */
  const userResponse = responseProducerSteps.assembleUserResponse({
    responsePlan: input.responsePlan,
    responseStrings
  });

  assertValidUserResponse(userResponse);

  return userResponse;
}

export {
  runResponseProducer,
  assertValidResponseProducerInput,
  assertValidResponseStrings,
  assertValidUserResponse
};

export type {
  ResponseProducerInput,
  ResponseProducerSteps,
  ResponsePlan,
  UserResponse
};