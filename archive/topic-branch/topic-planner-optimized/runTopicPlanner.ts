import type {TopicReadinessAssessment} from "../assess-topic-readiness-optimized/assessTopicReadiness";
import type {AssessSupportNeedOutput} from "../assess-support-need-optimized/runAssessSupportNeed";
import type {DerivedSupportRouting} from "../derive-support-routing-optimized/deriveSupportRouting";
import type {QualificationOrienterOutput} from "../qualification-orienter-optimized/runQualificationOrienter";
import type {SearchSimilarityOutput} from "../search-similarity-optimized/runSearchSimilarity";
import type {SynthesizeRagOutput} from "../synthesize-rag-optimized/runSynthesizeRag";
import type {AnalyzeSupportTextUnderstanding} from "../../analyze-support-text-optimized/runAnalyzeSupportText";
import type {TopicIdentity, TopicUpdatePlan} from "../runTopicBranch";

type TopicResponsePlan = {
  topicTitle: string | null;
  supportNeed: string;
  responseStrategy: "answer" | "ask_qualification" | "acknowledge" | "handoff";
  summary: string;
  qualificationQuestions: string[];
  knowledgeSummary: string | null;
  internalReasonCodes: string[];
};

type TopicPlannerInput = {
  topicUpdatePlan: TopicUpdatePlan;
  topicIdentity: TopicIdentity;
  sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
  supportNeedOutput: AssessSupportNeedOutput;
  readinessOutput: TopicReadinessAssessment;
  routingOutput: DerivedSupportRouting;
  qualificationOrienterOutput: QualificationOrienterOutput | null;
  searchSimilarityOutput: SearchSimilarityOutput | null;
  synthesizeRagOutput: SynthesizeRagOutput | null;
};

type TopicPlannerProcessedOutput = {
  status: "processed";
  fallbackReason: null;
  topicResponsePlan: TopicResponsePlan;
};

type TopicPlannerFallbackOutput = {
  status: "fallback";
  fallbackReason: "invalid_input";
  topicResponsePlan: null;
};

type TopicPlannerOutput =
  | TopicPlannerProcessedOutput
  | TopicPlannerFallbackOutput;

async function runTopicPlanner(input: TopicPlannerInput): Promise<TopicPlannerOutput> {
  if (input.supportNeedOutput.status === "fallback") {
    return {
      status: "fallback",
      fallbackReason: "invalid_input",
      topicResponsePlan: null
    };
  }

  const supportNeed = input.supportNeedOutput.supportNeedAssessment.supportNeed;
  const qualificationQuestions = readQualificationQuestions(input.qualificationOrienterOutput);
  const knowledgeSummary = readKnowledgeSummary(input.synthesizeRagOutput);

  return {
    status: "processed",
    fallbackReason: null,
    topicResponsePlan: {
      topicTitle: input.topicIdentity.title,
      supportNeed,
      responseStrategy: chooseResponseStrategy({supportNeed, qualificationQuestions, knowledgeSummary}),
      summary: input.topicIdentity.summary,
      qualificationQuestions,
      knowledgeSummary,
      internalReasonCodes: [
        ...input.readinessOutput.reasonCodes,
        ...input.routingOutput.catalogueRouting.reasonCodes,
        ...input.routingOutput.similarTopicSearchRouting.reasonCodes
      ]
    }
  };
}

function readQualificationQuestions(output: QualificationOrienterOutput | null): string[] {
  if (!output || output.status === "fallback") return [];
  return output.qualificationPlan.questions.map((question) => question.fieldName);
}

function readKnowledgeSummary(output: SynthesizeRagOutput | null): string | null {
  if (!output || output.status === "fallback" || !output.synthesizedKnowledge) return null;
  return output.synthesizedKnowledge.summary;
}

function chooseResponseStrategy(input: {
  supportNeed: string;
  qualificationQuestions: string[];
  knowledgeSummary: string | null;
}): TopicResponsePlan["responseStrategy"] {
  if (input.qualificationQuestions.length > 0) return "ask_qualification";
  if (input.knowledgeSummary) return "answer";
  if (input.supportNeed === "support_action") return "handoff";
  return "acknowledge";
}

export {runTopicPlanner};

export type {
  TopicPlannerInput,
  TopicPlannerOutput,
  TopicResponsePlan
};
