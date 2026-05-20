// src/support-processing-pipeline/message-analysis/fullweight-message-analysis/buildFullWeightPrompt.ts

import type {
  LatestUserMessage,
  SupportTopicKnowledge,
  ConversationHistory,
  TurnUnderstandingDelta,
} from "../../typesSupportProcessingPipeline.types";

/**
 * À remplacer par ton vrai prompt système.
 * Le prompt système doit contenir :
 * - le rôle du modèle,
 * - les définitions métier des champs,
 * - les règles de remplissage,
 * - les contraintes de sortie JSON.
 */
const FULL_WEIGHT_SYSTEM_PROMPT = `
Lorem ipsum dolor sit amet.
Replace this placeholder with the real full-weight message analysis system prompt.
The model must return only valid JSON matching the expected output schema.
`.trim();

type AttachmentAnalysisItem = {
  filename?: string;
  status: "analyzed" | "failed" | "refused";
  reason?: string;
  analysis?: {
    llmDescription?: string;
    structuredObservations?: unknown;
    relationToPreviousAttachment?: string;
  };
};

type AttachmentAnalysis = AttachmentAnalysisItem[];

type LightWeightMessageAnalysis = Partial<
  Pick<
    TurnUnderstandingDelta,
    | "user_language"
    | "segments_signal"
    | "segments_scope_boundary"
    | "segments_suspicious"
  >
> & {
  shouldRunSupportMessageAnalysis?: boolean;
};

export type BuildFullWeightPromptInput = {
  latestUserMessage: LatestUserMessage;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
  attachmentAnalysis?: AttachmentAnalysis;
  lightWeightMessageAnalysis?: LightWeightMessageAnalysis;
};

export type FullWeightPrompt = {
  systemPrompt: string;
  userPrompt: string;
  expectedOutputSchema: TurnUnderstandingDelta;
};

const expectedOutputSchema: TurnUnderstandingDelta = {
  user_language: "fr",
  segments_lack_comprehension: [
    {
      segment_verbatim: "string",
    },
  ],
  segments_topic: [
    {
      matched_historical_topic: "yes",
      id_topic: 1,
      topic_category: "bug",
      tool_or_product: "string",
      topic_action: "string",
      topic_object: "string",
      topic_label: "string",
      topic_details: {
        feature_or_page: "string",
        provided_url: "string",
        pre_problem_state: "string",
        observed_result: "string",
        expected_result: "string",
        error_message: "string",
        platform: "string",
        account_context: "string",
        frequency: "string",
        affected_scope: "string",
        additional_context: "string",
        trigger_action: "string",
        access_action: "string",
        auth_method: "string",
        os: "string",
        device: "string",
        browser: "string",
        app_version: "string",
        server_or_instance: "string",
        affected_users: "string",
        logs_available: "yes",
        billing_issue_type: "string",
        billing_provider: "string",
        offer_or_plan: "string",
        amount: "string",
        currency: "string",
        billing_date_or_period: "string",
        gap_observed: "string",
        question_intent: "how_to",
        video_available: "no",
        image_available: "no",
      },
      tested_actions: [
        {
          tested_action: "string",
          outcome_tested_action: "unclear",
        },
      ],
      user_goal: "string",
      blocking_issue: "yes",
    },
  ],
  segments_signal: [
    {
      segment_verbatim: "string",
      signal_types: ["types"],
    },
  ],
  segments_scope_boundary: [
    {
      segment_verbatim: "string",
      scope_boundary_types: ["types"],
    },
  ],
  segments_suspicious: [
    {
      segment_verbatim: "string",
      suspicious_type: ["types"],
    },
  ],
};

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildLatestUserMessageContext(
  latestUserMessage: LatestUserMessage
): Record<string, unknown> {
  return {
    content: latestUserMessage.content
  };
}

function buildSupportTopicKnowledgeContext(
  supportTopicKnowledge: SupportTopicKnowledge
): Record<string, unknown> {
  return {
    existing_topics: supportTopicKnowledge.segments_topic.map((topic) => ({
      id_topic: topic.id_topic,
      topic_category: topic.topic_category,
      tool_or_product: topic.tool_or_product,
      topic_action: topic.topic_action,
      topic_object: topic.topic_object,
      topic_label: topic.topic_label,
      topic_details: topic.topic_details,
      tested_actions: topic.tested_actions,
      user_goal: topic.user_goal,
      blocking_issue: topic.blocking_issue,
    })),
  };
}

function buildConversationHistoryContext(
  conversationHistory: ConversationHistory
): Record<string, unknown>[] {
  return conversationHistory.map((event) => {
    if (event.role === "user") {
      return {
        role: "user",
        created_at: event.created_at,
        previous_turn_understanding: {
          user_language: event.turnUnderstandingDelta.user_language,
          segments_lack_comprehension:
            event.turnUnderstandingDelta.segments_lack_comprehension,
          segments_topic: event.turnUnderstandingDelta.segments_topic,
          segments_signal: event.turnUnderstandingDelta.segments_signal,
          segments_scope_boundary:
            event.turnUnderstandingDelta.segments_scope_boundary,
          segments_suspicious: event.turnUnderstandingDelta.segments_suspicious,
        },
      };
    }

    if (event.role === "bot") {
      return {
        role: "bot",
        created_at: event.created_at,
        previous_response_plan: {
          responseLanguage: event.responsePlan.responseLanguage,
          messagesPlan: event.responsePlan.messagesPlan,
        },
      };
    }

    return {
      role: "system",
      created_at: event.created_at,
      note: event.note,
    };
  });
}

function buildAttachmentAnalysisContext(
  attachmentAnalysis?: AttachmentAnalysis
): Record<string, unknown>[] {
  if (!attachmentAnalysis || attachmentAnalysis.length === 0) {
    return [];
  }

  return attachmentAnalysis.map((attachment) => ({
    filename: attachment.filename,
    status: attachment.status,
    reason: attachment.reason,
    llmDescription: attachment.analysis?.llmDescription,
    structuredObservations: attachment.analysis?.structuredObservations,
    relationToPreviousAttachment:
      attachment.analysis?.relationToPreviousAttachment,
  }));
}

function buildLightWeightMessageAnalysisContext(
  lightWeightMessageAnalysis?: LightWeightMessageAnalysis
): Record<string, unknown> | null {
  if (!lightWeightMessageAnalysis) {
    return null;
  }

  return {
    shouldRunSupportMessageAnalysis:
      lightWeightMessageAnalysis.shouldRunSupportMessageAnalysis,
    user_language: lightWeightMessageAnalysis.user_language,
    segments_signal: lightWeightMessageAnalysis.segments_signal,
    segments_scope_boundary:
      lightWeightMessageAnalysis.segments_scope_boundary,
    segments_suspicious: lightWeightMessageAnalysis.segments_suspicious,
  };
}

export function buildFullWeightPrompt(
  input: BuildFullWeightPromptInput
): FullWeightPrompt {
  const latestUserMessageContext = buildLatestUserMessageContext(
    input.latestUserMessage
  );

  const supportTopicKnowledgeContext = buildSupportTopicKnowledgeContext(
    input.supportTopicKnowledge
  );

  const conversationHistoryContext = buildConversationHistoryContext(
    input.conversationHistory
  );

  const attachmentAnalysisContext = buildAttachmentAnalysisContext(
    input.attachmentAnalysis
  );

  const lightWeightMessageAnalysisContext =
    buildLightWeightMessageAnalysisContext(input.lightWeightMessageAnalysis);

  const userPrompt = `
Analyze the latest user message using the following contexts.

# Latest user message

\`\`\`json
${toPrettyJson(latestUserMessageContext)}
\`\`\`

# Existing support topic knowledge

\`\`\`json
${toPrettyJson(supportTopicKnowledgeContext)}
\`\`\`

# Conversation history

\`\`\`json
${toPrettyJson(conversationHistoryContext)}
\`\`\`

# Attachment analysis

\`\`\`json
${toPrettyJson(attachmentAnalysisContext)}
\`\`\`

# Lightweight message analysis hints

\`\`\`json
${toPrettyJson(lightWeightMessageAnalysisContext)}
\`\`\`

# Expected output schema

Return a JSON object matching this TypeScript-compatible structure:

\`\`\`json
${toPrettyJson(expectedOutputSchema)}
\`\`\`

Return only JSON.
`.trim();

  return {
    systemPrompt: FULL_WEIGHT_SYSTEM_PROMPT,
    userPrompt,
    expectedOutputSchema,
  };
}