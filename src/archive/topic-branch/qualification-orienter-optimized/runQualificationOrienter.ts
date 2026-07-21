import type {TopicReadinessAssessment} from "../assess-topic-readiness-optimized/assessTopicReadiness";
import type {SupportNeedAssessment} from "../assess-support-need-optimized/validateAssessSupportNeedOutput";
import type {DerivedSupportRouting} from "../derive-support-routing-optimized/deriveSupportRouting";
import type {AnalyzeSupportTextUnderstanding} from "../../analyze-support-text-optimized/runAnalyzeSupportText";
import type {TopicIdentity, TopicUpdatePlan} from "../runTopicBranch";

type QualificationQuestion = {
  fieldName: string;
  reason: string;
};

type QualificationPlan = {
  mode: DerivedSupportRouting["catalogueRouting"]["mode"];
  shouldAskQualificationQuestion: boolean;
  questions: QualificationQuestion[];
  reasonCodes: string[];
};

type QualificationOrienterInput = {
  topicUpdatePlan: TopicUpdatePlan;
  topicIdentity: TopicIdentity;
  sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
  supportNeedAssessment: SupportNeedAssessment;
  topicReadinessAssessment: TopicReadinessAssessment;
  routing: DerivedSupportRouting;
};

type QualificationOrienterProcessedOutput = {
  status: "processed";
  fallbackReason: null;
  qualificationPlan: QualificationPlan;
};

type QualificationOrienterFallbackOutput = {
  status: "fallback";
  fallbackReason: "invalid_input";
  qualificationPlan: null;
};

type QualificationOrienterOutput =
  | QualificationOrienterProcessedOutput
  | QualificationOrienterFallbackOutput;

async function runQualificationOrienter(input: QualificationOrienterInput): Promise<QualificationOrienterOutput> {
  if (!input.routing.catalogueRouting.shouldRun) {
    return {
      status: "processed",
      fallbackReason: null,
      qualificationPlan: {
        mode: input.routing.catalogueRouting.mode,
        shouldAskQualificationQuestion: false,
        questions: [],
        reasonCodes: input.routing.catalogueRouting.reasonCodes
      }
    };
  }

  const questions = buildQualificationQuestions(input);

  return {
    status: "processed",
    fallbackReason: null,
    qualificationPlan: {
      mode: input.routing.catalogueRouting.mode,
      shouldAskQualificationQuestion: questions.length > 0,
      questions,
      reasonCodes: input.routing.catalogueRouting.reasonCodes
    }
  };
}

function buildQualificationQuestions(input: QualificationOrienterInput): QualificationQuestion[] {
  const questions: QualificationQuestion[] = [];
  const presentKeys = new Set(
    input.sourceUnderstandings.flatMap((understanding) => [
      ...understanding.extractedFields.map((field) => field.key),
      ...understanding.other.map((field) => field.key)
    ])
  );

  if (input.supportNeedAssessment.supportNeed === "unclear") {
    questions.push({fieldName: "support_need", reason: "support_need_unclear"});
  }

  if (!input.topicIdentity.supportDomain || input.topicIdentity.supportDomain === "other") {
    questions.push({fieldName: "support_domain", reason: "support_domain_unclear"});
  }

  if (!input.topicReadinessAssessment.hasSearchableDetails) {
    addMissingQuestion(questions, presentKeys, "product_or_service", "missing_searchable_details");
    addMissingQuestion(questions, presentKeys, "feature_or_page", "missing_searchable_details");
  }

  if (input.supportNeedAssessment.supportNeed === "issue_resolution") {
    addMissingQuestion(questions, presentKeys, "observed_result", "issue_resolution_context");
    addMissingQuestion(questions, presentKeys, "expected_result", "issue_resolution_context");
    addMissingQuestion(questions, presentKeys, "reproduction_steps", "issue_resolution_context");
  }

  return questions.slice(0, 3);
}

function addMissingQuestion(
  questions: QualificationQuestion[],
  presentKeys: Set<string>,
  fieldName: string,
  reason: string
): void {
  if (!presentKeys.has(fieldName)) {
    questions.push({fieldName, reason});
  }
}

export {runQualificationOrienter};

export type {
  QualificationOrienterInput,
  QualificationOrienterOutput,
  QualificationPlan,
  QualificationQuestion
};
