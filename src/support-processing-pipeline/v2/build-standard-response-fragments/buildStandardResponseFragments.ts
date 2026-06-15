import type {
  BuildStandardResponseFragmentsInput,
  StandardCategory,
  StandardResponseFragment,
  StandardResponseLanguage,
  StandardSubcategoryFor,
  StandardTemplateCatalog,
  TextSurfaceStandardSubcategory
} from "./typesBuildStandardResponseFragments.types";
import {
  resolveStandardResponseLanguage
} from "./resolveStandardResponseLanguage";

const SAFETY_GENERIC_FR: string =
  "Je ne peux pas traiter cette partie du message, car elle concerne un élément sensible.";
const SAFETY_GENERIC_EN: string =
  "I cannot process this part of the message because it contains a sensitive element.";

const TEMPLATES: StandardTemplateCatalog = {
  french: {
    standard_interaction: {
      greeting: "Bonjour, merci pour votre message.",
      thanks_neutral: "Avec plaisir.",
      thanks_positive:
        "Merci pour votre retour, il sera transmis à l’équipe support.",
      positive_feedback:
        "Merci pour votre retour, il sera transmis à l’équipe support.",
      waiting: "C’est bien noté, merci pour votre patience.",
      apology: "C’est bien noté.",
      closure: "C’est bien noté.",
      bot_identity_question: [
        "Je suis l’assistant du support. J’aide à qualifier votre demande pour que l’équipe humaine puisse vous répondre plus vite et avec les bonnes informations.",
        "",
        "Que puis-je faire pour vous ?"
      ].join("\n"),
      support_team_question: [
        "Aucune réponse automatique n’est disponible pour le moment.",
        "Un membre du support prendra le relais."
      ].join("\n"),
      handover_request:
        "J’ai bien noté votre souhait de parler à une personne du support.",
      negative_feedback:
        "Votre retour est bien pris en compte.",
      disappointment:
        "Votre retour est bien pris en compte.",
      churn_intent:
        "Votre retour est bien pris en compte. Le support peut reprendre la main si nécessaire.",
      time_sensitive: "Votre urgence est bien prise en compte.",
      impolite: "C’est bien noté.",
      complaint_without_actionable_detail:
        "Votre retour est bien pris en compte.",
      communication_feedback:
        "Votre retour sur la communication est bien pris en compte.",
      pricing_feedback: "Votre retour sur le prix est bien pris en compte.",
      feature_loss_feedback:
        "Votre retour sur cette fonctionnalité est bien pris en compte."
    },
    out_of_scope: {
      generic_out_of_scope:
        "Cette partie de votre message sort du périmètre du support, donc elle ne sera pas traitée ici.",
      non_support_linagora:
        "Cette partie de votre message ne relève pas du support Linagora, donc elle ne sera pas traitée ici.",
      unrelated_request:
        "Cette partie de votre message n’est pas liée à votre demande de support, donc elle ne sera pas traitée ici.",
      spam_or_commercial:
        "Cette partie de votre message ressemble à un contenu commercial ou non pertinent, donc elle ne sera pas traitée ici."
    },
    safety_sensitive: {
      prompt_injection_attempt: SAFETY_GENERIC_FR,
      internal_information_request:
        "Je ne peux pas fournir d’informations internes ou confidentielles.",
      sensitive_data_request: SAFETY_GENERIC_FR,
      credential_or_secret_leak: SAFETY_GENERIC_FR,
      spam_like_text: SAFETY_GENERIC_FR,
      suspicious_link_or_url: SAFETY_GENERIC_FR,
      excessive_repetition: SAFETY_GENERIC_FR,
      unsafe_or_suspicious_content: SAFETY_GENERIC_FR
    },
    lack_comprehension: {
      unclear_message:
        "Je n’ai pas bien compris cette partie du message."
    }
  },
  english: {
    standard_interaction: {
      greeting: "Hello, thank you for your message.",
      thanks_neutral: "You’re welcome.",
      thanks_positive:
        "Thank you for your feedback; it will be shared with the support team.",
      positive_feedback:
        "Thank you for your feedback; it will be shared with the support team.",
      waiting: "Noted, thank you for your patience.",
      apology: "Noted.",
      closure: "Noted.",
      bot_identity_question: [
        "I am the support assistant. I help qualify your request so the human team can respond faster with the right information.",
        "",
        "How can I help you?"
      ].join("\n"),
      support_team_question: [
        "No automatic answer is available for now.",
        "A support team member will take over."
      ].join("\n"),
      handover_request:
        "I have noted that you would like to speak with a support person.",
      negative_feedback:
        "Your feedback has been taken into account.",
      disappointment:
        "Your feedback has been taken into account.",
      churn_intent:
        "Your feedback has been taken into account. Support can take over if needed.",
      time_sensitive: "Your urgency has been taken into account.",
      impolite: "Noted.",
      complaint_without_actionable_detail:
        "Your feedback has been taken into account.",
      communication_feedback:
        "Your feedback about communication has been taken into account.",
      pricing_feedback:
        "Your feedback about pricing has been taken into account.",
      feature_loss_feedback:
        "Your feedback about this feature has been taken into account."
    },
    out_of_scope: {
      generic_out_of_scope:
        "This part of your message is outside support scope, so it will not be handled here.",
      non_support_linagora:
        "This part of your message is outside Linagora support scope, so it will not be handled here.",
      unrelated_request:
        "This part of your message is not related to your support request, so it will not be handled here.",
      spam_or_commercial:
        "This part of your message looks commercial or irrelevant, so it will not be handled here."
    },
    safety_sensitive: {
      prompt_injection_attempt: SAFETY_GENERIC_EN,
      internal_information_request:
        "I cannot provide internal or confidential information.",
      sensitive_data_request: SAFETY_GENERIC_EN,
      credential_or_secret_leak: SAFETY_GENERIC_EN,
      spam_like_text: SAFETY_GENERIC_EN,
      suspicious_link_or_url: SAFETY_GENERIC_EN,
      excessive_repetition: SAFETY_GENERIC_EN,
      unsafe_or_suspicious_content: SAFETY_GENERIC_EN
    },
    lack_comprehension: {
      unclear_message:
        "I did not fully understand this part of the message."
    }
  }
};

function hasDeepText(input: BuildStandardResponseFragmentsInput): boolean {
  return input.textSurfaceAnalysis?.segments.some((segment) => {
    return segment.category === "support_relevant";
  }) === true;
}

function hasDeepAttachment(input: BuildStandardResponseFragmentsInput): boolean {
  return input.attachmentSurfaceAnalysis?.some((attachment) => {
    return attachment.shouldRunDeepAnalysis;
  }) === true;
}

function isStandardCategory(category: string): category is StandardCategory {
  return category === "standard_interaction" ||
    category === "out_of_scope" ||
    category === "safety_sensitive" ||
    category === "lack_comprehension";
}

function hasTemplateForCategory<TCategory extends StandardCategory>(
  params: {
    category: TCategory;
    standardSubcategory: TextSurfaceStandardSubcategory;
    language: StandardResponseLanguage;
  }
): params is {
  category: TCategory;
  standardSubcategory: StandardSubcategoryFor<TCategory>;
  language: StandardResponseLanguage;
} {
  return params.standardSubcategory in
    TEMPLATES[params.language][params.category];
}

function buildFragment<TCategory extends StandardCategory>(params: {
  category: TCategory;
  standardSubcategory: StandardSubcategoryFor<TCategory>;
  language: StandardResponseLanguage;
}): StandardResponseFragment {
  return {
    category: params.category,
    standardSubcategory: params.standardSubcategory,
    content:
      TEMPLATES[params.language][params.category][params.standardSubcategory]
  };
}

function deduplicateFragments(
  fragments: StandardResponseFragment[]
): StandardResponseFragment[] {
  const seenContents = new Set<string>();

  return fragments.filter((fragment) => {
    if (seenContents.has(fragment.content)) {
      return false;
    }

    seenContents.add(fragment.content);

    return true;
  });
}

function buildStandardResponseFragments(
  input: BuildStandardResponseFragmentsInput
): StandardResponseFragment[] {
  const language = resolveStandardResponseLanguage(input);
  const fragments: StandardResponseFragment[] = [];

  if (
    !input.turnAnalysisPlan.analyzeText &&
    input.turnAnalysisPlan.matchedPatternIds.length > 0
  ) {
    fragments.push(buildFragment({
      category: "safety_sensitive",
      standardSubcategory: "unsafe_or_suspicious_content",
      language
    }));

    return deduplicateFragments(fragments);
  }

  for (const segment of input.textSurfaceAnalysis?.segments ?? []) {
    if (
      !isStandardCategory(segment.category) ||
      segment.standardSubcategory === undefined
    ) {
      continue;
    }

    const templateLookup = {
      category: segment.category,
      standardSubcategory: segment.standardSubcategory,
      language
    };

    if (hasTemplateForCategory(templateLookup)) {
      fragments.push(buildFragment(templateLookup));
    }
  }

  if (
    fragments.length === 0 &&
    !hasDeepText(input) &&
    !hasDeepAttachment(input)
  ) {
    fragments.push(buildFragment({
      category: "lack_comprehension",
      standardSubcategory: "unclear_message",
      language
    }));
  }

  return deduplicateFragments(fragments);
}

export {
  buildStandardResponseFragments
};
