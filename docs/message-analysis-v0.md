# Message Analysis V0

This document describes the expected behavior of the `message-analysis` module.

The goal of this module is to transform a raw support message and its context into a clean, validated and normalized `supportAnalysisOutput` JSON object that can be used by the next pipeline step: the `decision-engine`.

This module does not decide the final user response.  
It only analyzes the latest user message and prepares structured information for the rest of the support processing pipeline.

---

## Module responsibility

The `message-analysis` module receives:

- the latest user message text;
- optional attachments such as screenshots, videos, files or logs;
- the previous ticket state;
- the previous analysis output if available;
- conversation logs;
- attempt history;
- user context.

It then:

1. validates the input format;
2. detects obvious spam, abuse or prompt injection with simple backend rules;
3. detects whether attachments require specialized analysis;
4. runs image or video analysis when needed;
5. decides whether to call LLM0 or directly call LLM1;
6. optionally runs LLM0 as a lightweight router;
7. runs LLM1 when full support analysis is required;
8. validates the LLM1 output;
9. normalizes the final structured JSON;
10. returns a clean `supportAnalysisOutput` for the next module.

---

## Input

The input object should contain:

```js
{
  latestUserMessage: {
    text: "string",
    createdAt: "ISO date string optional",
    messageId: "string optional"
  },

  attachments: [
    {
      id: "string optional",
      filename: "string optional",
      mimeType: "string optional",
      url: "string optional",
      content: "string optional"
    }
  ],

  previousTicketState: {
    ticketId: "string optional",
    status: "string optional",
    topics: [],
    topicHistory: []
  },

  previousAnalysisOutput: {
    user_language: "string optional",
    warning_comprehension: "boolean optional",
    segments: []
  },

  conversationLogs: [
    {
      role: "user | assistant | agent | system",
      content: "string",
      createdAt: "ISO date string optional"
    }
  ],

  attemptHistory: [
    {
      action: "string",
      outcome: "string optional",
      createdAt: "ISO date string optional"
    }
  ],

  userContext: {
    userId: "string optional",
    email: "string optional",
    plan: "string optional",
    organization: "string optional"
  }
}
```

---

## Output

The module returns:

```js
{
  supportAnalysisOutput: {
    user_language: "fr",
    warning_comprehension: false,
    segments: []
  },

  analysisMetadata: {
    route: "spam_or_abuse | simple_signal | scope_boundary | full_analysis",
    usedLLM0: false,
    usedLLM1: true,
    usedAttachmentAnalysis: false,
    attachmentTypes: [],
    warnings: []
  },

  debug: {
    preRoutingDecision: {},
    llm0Output: null,
    attachmentAnalysisOutput: null,
    validationErrors: []
  }
}
```

---

## High-level pseudo-code

```js
function analyzeSupportMessage(input) {
  // 1. Validate raw input format
  const validatedInput = validateMessageAnalysisInput(input);

  // 2. Detect obvious spam / abuse / prompt injection with deterministic backend rules
  const spamResult = detectObviousSpam(validatedInput.latestUserMessage.text);

  if (spamResult.isSpamOrAbuse) {
    return buildSpamAnalysisResult({
      input: validatedInput,
      spamResult
    });
  }

  // 3. Detect attachment types
  const attachmentTypes = validatedInput.attachments.map(detectAttachmentType);

  // 4. Run specialized attachment analysis if needed
  let attachmentAnalysisOutput = null;

  if (attachmentTypes.includes("image")) {
    attachmentAnalysisOutput = runImageAnalysis({
      attachments: validatedInput.attachments,
      latestUserMessage: validatedInput.latestUserMessage
    });
  }

  if (attachmentTypes.includes("video")) {
    attachmentAnalysisOutput = runVideoAnalysis({
      attachments: validatedInput.attachments,
      latestUserMessage: validatedInput.latestUserMessage
    });
  }

  // 5. Decide if we should run LLM1 directly or use LLM0 first
  const preRoutingDecision = preRouteMessageAnalysis({
    latestUserMessage: validatedInput.latestUserMessage,
    attachmentAnalysisOutput,
    previousAnalysisOutput: validatedInput.previousAnalysisOutput,
    conversationLogs: validatedInput.conversationLogs,
    attemptHistory: validatedInput.attemptHistory
  });

  // 6. If deterministic rules say full analysis is required, call LLM1 directly
  if (preRoutingDecision.route === "run_full_analysis") {
    const rawLLM1Output = runLLM1SupportAnalysis({
      latestUserMessage: validatedInput.latestUserMessage,
      attachmentAnalysisOutput,
      previousAnalysisOutput: validatedInput.previousAnalysisOutput,
      conversationLogs: validatedInput.conversationLogs,
      attemptHistory: validatedInput.attemptHistory
    });

    const supportAnalysisOutput = validateAndNormalizeSupportAnalysis(rawLLM1Output);

    return buildMessageAnalysisResult({
      supportAnalysisOutput,
      route: "full_analysis",
      usedLLM0: false,
      usedLLM1: true,
      usedAttachmentAnalysis: Boolean(attachmentAnalysisOutput),
      attachmentTypes,
      attachmentAnalysisOutput,
      preRoutingDecision
    });
  }

  // 7. If uncertain, call LLM0 lightweight router
  const rawLLM0Output = runLLM0LightweightRouter({
    latestUserMessage: validatedInput.latestUserMessage,
    attachmentAnalysisOutput,
    previousAnalysisOutput: validatedInput.previousAnalysisOutput,
    conversationLogs: validatedInput.conversationLogs
  });

  const llm0Decision = validateLLM0Output(rawLLM0Output);

  // 8. Act according to LLM0 route
  if (llm0Decision.route === "simple_signal") {
    const supportAnalysisOutput = buildSignalOnlyAnalysisOutput({
      input: validatedInput,
      llm0Decision
    });

    return buildMessageAnalysisResult({
      supportAnalysisOutput,
      route: "simple_signal",
      usedLLM0: true,
      usedLLM1: false,
      usedAttachmentAnalysis: Boolean(attachmentAnalysisOutput),
      attachmentTypes,
      attachmentAnalysisOutput,
      llm0Output: llm0Decision,
      preRoutingDecision
    });
  }

  if (llm0Decision.route === "scope_boundary") {
    const supportAnalysisOutput = buildScopeBoundaryOnlyAnalysisOutput({
      input: validatedInput,
      llm0Decision
    });

    return buildMessageAnalysisResult({
      supportAnalysisOutput,
      route: "scope_boundary",
      usedLLM0: true,
      usedLLM1: false,
      usedAttachmentAnalysis: Boolean(attachmentAnalysisOutput),
      attachmentTypes,
      attachmentAnalysisOutput,
      llm0Output: llm0Decision,
      preRoutingDecision
    });
  }

  if (llm0Decision.route === "spam_or_abuse") {
    return buildSpamAnalysisResult({
      input: validatedInput,
      spamResult: llm0Decision
    });
  }

  // 9. If LLM0 asks for full analysis, call LLM1
  if (llm0Decision.route === "run_full_analysis") {
    const rawLLM1Output = runLLM1SupportAnalysis({
      latestUserMessage: validatedInput.latestUserMessage,
      attachmentAnalysisOutput,
      previousAnalysisOutput: validatedInput.previousAnalysisOutput,
      conversationLogs: validatedInput.conversationLogs,
      attemptHistory: validatedInput.attemptHistory
    });

    const supportAnalysisOutput = validateAndNormalizeSupportAnalysis(rawLLM1Output);

    return buildMessageAnalysisResult({
      supportAnalysisOutput,
      route: "full_analysis",
      usedLLM0: true,
      usedLLM1: true,
      usedAttachmentAnalysis: Boolean(attachmentAnalysisOutput),
      attachmentTypes,
      attachmentAnalysisOutput,
      llm0Output: llm0Decision,
      preRoutingDecision
    });
  }

  // 10. Safe fallback
  return buildInvalidAnalysisFallback({
    input: validatedInput,
    reason: "Unknown LLM0 route"
  });
}
```

---

## Functions to implement

### Input validation

```js
validateMessageAnalysisInput(input)
```

Role:

- check that `latestUserMessage.text` exists;
- check that attachments have an expected format;
- check that optional contexts are objects or arrays when present;
- reject invalid input early.

Expected file:

```txt
src/schemas/messageAnalysisInput.schema.js
```

---

### Spam / abuse detection

```js
detectObviousSpam(text)
```

Role:

- detect obvious spam;
- detect abusive messages;
- detect obvious prompt injection attempts;
- avoid calling LLM1 when the message clearly should not be processed normally.

Expected file:

```txt
src/support-processing-pipeline/message-analysis/detectObviousSpam.js
```

---

### Attachment type detection

```js
detectAttachmentType(attachment)
```

Role:

- detect `image`;
- detect `video`;
- detect `log`;
- detect generic `file`;
- return `none` or `unknown` when needed.

Expected file:

```txt
src/support-processing-pipeline/message-analysis/detectAttachmentType.js
```

---

### Attachment analysis

```js
runImageAnalysis(input)
runVideoAnalysis(input)
```

Role:

- call a specialized model later;
- extract visible text, error messages, UI state, reproduction clues;
- return a structured attachment analysis.

In V0, this can be mocked.

Expected future files:

```txt
src/support-processing-pipeline/message-analysis/runImageAnalysis.js
src/support-processing-pipeline/message-analysis/runVideoAnalysis.js
```

---

### Pre-routing

```js
preRouteMessageAnalysis(input)
```

Role:

- decide with deterministic backend rules whether to:
  - run LLM1 directly;
  - call LLM0 first;
  - stop early;
  - route to attachment analysis.

Example output:

```js
{
  route: "run_full_analysis",
  reason: "Message contains an actionable support issue"
}
```

Expected file:

```txt
src/support-processing-pipeline/message-analysis/preRouteMessageAnalysis.js
```

---

### LLM0 lightweight router

```js
runLLM0LightweightRouter(input)
```

Role:

- decide only a lightweight route;
- avoid full LLM1 calls for simple messages;
- never generate final user response;
- never update ticket directly.

Possible routes:

```txt
run_full_analysis
simple_signal
scope_boundary
spam_or_abuse
```

In V0, this can be mocked.

Expected future file:

```txt
src/support-processing-pipeline/message-analysis/runLLM0LightweightRouter.js
```

---

### LLM1 support analysis

```js
runLLM1SupportAnalysis(input)
```

Role:

- call the full support analysis prompt;
- return strict JSON;
- produce segments:
  - topic;
  - signal;
  - scope_boundary.

In V0, this can be mocked or replaced by test fixtures.

Expected future file:

```txt
src/support-processing-pipeline/message-analysis/runLLM1SupportAnalysis.js
```

---

### Support analysis validation and normalization

```js
validateAndNormalizeSupportAnalysis(rawOutput)
```

Role:

- parse the raw model output;
- validate the expected JSON shape;
- validate enums;
- remove forbidden or empty fields;
- normalize LLM0 lightweight outputs into the same contract as LLM1 outputs.

Expected file:

```txt
src/support-processing-pipeline/message-analysis/validateAndNormalizeSupportAnalysis.js
```

---

### Result builder

```js
buildMessageAnalysisResult(input)
```

Role:

- return a stable output object;
- include `supportAnalysisOutput`;
- include metadata;
- include debug information when needed.

Expected file:

```txt
src/support-processing-pipeline/message-analysis/buildMessageAnalysisResult.js
```

---

## V0 implementation strategy

The first implementation should not call real SLM/LLM APIs.

Instead, V0 should implement:

1. input schema validation;
2. attachment type detection;
3. obvious spam detection;
4. deterministic pre-routing;
5. mocked LLM0 output;
6. mocked LLM1 output or injected test fixtures;
7. support analysis Zod validation;
8. normalized `supportAnalysisOutput`.

Real API calls can be added later behind adapter functions.
