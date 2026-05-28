type ResponseLanguage = "french" | "english";

type LabelDatabase = {
  default: string;
  [label: string]: string;
};

type DataBaseResponse = {
  [language in ResponseLanguage]: {
    securityGate: {
      latestUserMessageSecurityDecision: string;
      attachmentAnalysisSecurityDecision: string;
      default: string;
    };
    suspicious: {
      template: string;
      labels: LabelDatabase;
    };
    lackComprehension: {
      template: string;
    };
    scopeBoundary: {
      template: string;
      labels: LabelDatabase;
    };
    topic: {
      politenessOpening: LabelDatabase;
      topicRelationAcknowledgement: {
        prefix: string;
        separator: string;
        suffix: string;
        newTopicSingular: string;
        newTopicPlural: string;
        ongoingTopicSingular: string;
        ongoingTopicPlural: string;
      };
      title: string;
      topicStatusLabels: LabelDatabase;
      topicCategoryLabels: LabelDatabase;
      updatedFieldsAcknowledgement: string;
      testedSolution: string;
      topicDetailsLabels: LabelDatabase;
      topicDetailValueTranslations: Record<string, string>;
      testedSolutionOutcomeLabels: LabelDatabase;
      askFields: string;
      proposeSolution: string;
      acknowledgement: string;
      nextStep: LabelDatabase;
      politenessClosure: LabelDatabase;
    };
    signal: {
      responses: {
        default: string;
        thanks: string;
        timeSensitive: string;
      };
      labels: LabelDatabase;
    };
    handover: {
      default: string;
    };
  };
};

const dataBaseResponse: DataBaseResponse = {
  french: {
    securityGate: {
      latestUserMessageSecurityDecision:
        "Notre système de sécurité a identifié votre message comme potentiellement problématique et l’analyse automatique a été stoppée. Le support prendra le relais pour valider ou invalider cette décision.",
      attachmentAnalysisSecurityDecision:
        "Notre système de sécurité a identifié votre pièce jointe comme potentiellement problématique et l’analyse automatique a été stoppée. Le support prendra le relais pour valider ou invalider cette décision.",
      default:
        "Notre système de sécurité a identifié un élément potentiellement problématique et l’analyse automatique a été stoppée. Le support prendra le relais pour valider ou invalider cette décision."
    },
    suspicious: {
      template:
        "Il semblerait que cette partie de votre message ne respecte pas notre politique de support pour des raisons de {reason} : {segment_verbatim}.",
      labels: {
        default: "vérification de sécurité",
        empty_message: "message vide",
        prompt_injection_attempt: "tentative de manipulation des consignes",
        internal_information_request:
          "demande d’informations internes confidentielles",
        sensitive_data_request: "demande de données sensibles",
        spam_like_message: "message assimilé à du spam",
        suspicious_attachments: "pièce jointe suspecte",
        account_trust_status: "statut de confiance du compte"
      }
    },
    lackComprehension: {
      template:
        "Il semblerait que cette partie du message ait été mal comprise par notre analyse automatique. Le support viendra vérifier : {segment_verbatim}."
    },
    scopeBoundary: {
      template:
        "Cette partie de votre message {reason}, donc elle ne sera pas traitée ici : {signal_verbatim}.",
      labels: {
        default: "sort du périmètre du support",
        generic_out_of_scope: "sort du périmètre du support",
        non_support_linagora: "ne relève pas du support Linagora",
        unrelated_request: "n’est pas liée à votre demande de support",
        spam_or_commercial:
          "ressemble à un contenu commercial ou non pertinent"
      }
    },
    topic: {
      politenessOpening: {
        default: "undefined",
        understanding_1: "D’accord.",
        understanding_2: "Ok, je comprends.",
        salutation_and_understanding_1: "Bonjour, merci pour votre message.",
        salutation_and_understanding_2:
          "Bonjour, je vais tâcher de vous répondre."
      },
      topicRelationAcknowledgement: {
        prefix: "J’ai identifié ",
        separator: " et ",
        suffix: ".",
        newTopicSingular: "un nouveau sujet",
        newTopicPlural: "{count} nouveaux sujets",
        ongoingTopicSingular: "un sujet déjà en cours",
        ongoingTopicPlural: "{count} sujets déjà en cours"
      },
      title:
        "Sujet {topic_id} - {topic_category} - {topic_label} - ({topic_status})",
      topicStatusLabels: {
        default: "undefined",
        new: "Nouveau",
        previous: "En cours"
      },
      topicCategoryLabels: {
        default: "Autre",
        bug: "Bug",
        access_security: "Accès / sécurité",
        billing: "Facturation",
        request: "Demande",
        question_faq: "Question",
        other: "Autre"
      },
      updatedFieldsAcknowledgement:
        "Je comprends que vous indiquez : {updated_fields}.",
      testedSolution: "Vous avez testé {action} et cela a {outcome}.",
      topicDetailsLabels: {
        default: "undefined",
        feature_or_page: "fonctionnalité ou page",
        provided_url: "URL fournie",
        pre_problem_state: "état avant le problème",
        observed_result: "résultat observé",
        expected_result: "résultat attendu",
        error_message: "message d’erreur",
        platform: "plateforme",
        account_context: "contexte du compte",
        frequency: "fréquence",
        affected_scope: "périmètre affecté",
        additional_context: "contexte complémentaire",
        trigger_action: "action déclenchante",
        access_action: "action d’accès",
        auth_method: "méthode d’authentification",
        os: "système d’exploitation",
        device: "appareil",
        browser: "navigateur",
        app_version: "version de l’application",
        server_or_instance: "serveur ou instance",
        affected_users: "utilisateurs affectés",
        logs_available: "journaux disponibles",
        billing_issue_type: "type de problème de facturation",
        billing_provider: "prestataire de facturation",
        offer_or_plan: "offre ou forfait",
        amount: "montant",
        currency: "devise",
        billing_date_or_period: "date ou période de facturation",
        gap_observed: "écart observé",
        question_intent: "intention de la question",
        video_available: "vidéo disponible",
        image_available: "image disponible"
      },
      topicDetailValueTranslations: {
        "nothing happens": "rien ne se passe",
        "click create folder": "cliquer sur créer un dossier",
        "click on create folder": "cliquer sur créer un dossier",
        "folder should be created": "le dossier devrait être créé",
        "no email received": "aucun e-mail reçu",
        "receive password reset email":
          "recevoir l’e-mail de réinitialisation du mot de passe",
        "reset password": "réinitialiser le mot de passe",
        "mobile app": "application mobile"
      },
      testedSolutionOutcomeLabels: {
        default: "un résultat non précisé",
        worked: "fonctionné",
        failed: "échoué",
        partially_worked: "partiellement fonctionné",
        not_tried: "pas été essayé",
        unclear: "un résultat incertain"
      },
      askFields:
        "Pour mieux vous aider et comprendre votre demande, pourriez-vous m’indiquer : {fields_requested} ?",
      proposeSolution:
        "Une solution trouvée automatiquement pourrait vous aider : pourriez-vous essayer de {solutions} ?",
      acknowledgement:
        "Nous avons désormais toutes les informations pour que le support humain puisse prendre la main et vous répondre au mieux.",
      nextStep: {
        default: "undefined",
        wait_more_info:
          "Nous attendons votre retour pour obtenir plus d’informations.",
        wait_apply_solution:
          "Nous attendons votre retour pour savoir si la solution fonctionne.",
        wait_for_support:
          "Nous attendons l’intervention du support humain pour prendre le relais."
      },
      politenessClosure: {
        default: "undefined",
        thanks_for_cooperation1: "Merci pour votre coopération.",
        thanks_for_cooperation2: "Merci d’avance pour votre retour."
      }
    },
    signal: {
      responses: {
        default: "C’est bien noté.",
        thanks: "Avec plaisir.",
        timeSensitive: "Nous faisons au plus vite."
      },
      labels: {
        default: "signal utilisateur",
        thanks_neutral: "remerciement",
        thanks_positive: "remerciement positif",
        positive_feedback: "retour positif",
        negative_feedback: "retour négatif",
        disappointment: "déception",
        churn_intent: "intention de départ",
        waiting: "attente",
        apology: "excuse",
        closure: "clôture",
        time_sensitive: "urgence ou contrainte de temps",
        impolite: "ton inapproprié",
        complaint_without_actionable_detail:
          "plainte sans élément directement actionnable",
        communication_feedback: "retour sur la communication",
        pricing_feedback: "retour sur le prix",
        feature_loss_feedback: "retour sur une fonctionnalité perdue",
        confirmation_without_new_field:
          "confirmation sans nouvelle information exploitable"
      }
    },
    handover: {
      default: "Le support va bientôt relire et répondre à votre demande."
    }
  },
  english: {
    securityGate: {
      latestUserMessageSecurityDecision:
        "Our security system identified your message as potentially problematic and automatic analysis was stopped. Support will take over to confirm or dismiss this decision.",
      attachmentAnalysisSecurityDecision:
        "Our security system identified your attachment as potentially problematic and automatic analysis was stopped. Support will take over to confirm or dismiss this decision.",
      default:
        "Our security system identified a potentially problematic element and automatic analysis was stopped. Support will take over to confirm or dismiss this decision."
    },
    suspicious: {
      template:
        "It seems this part of your message does not comply with our support policy for the following reason: {reason}: {segment_verbatim}.",
      labels: {
        default: "security review",
        empty_message: "empty message",
        prompt_injection_attempt: "attempt to manipulate instructions",
        internal_information_request:
          "request for confidential internal information",
        sensitive_data_request: "request for sensitive data",
        spam_like_message: "spam-like message",
        suspicious_attachments: "suspicious attachment",
        account_trust_status: "account trust status"
      }
    },
    lackComprehension: {
      template:
        "It seems this part of the message may have been misunderstood by our automatic analysis. Support will review it: {segment_verbatim}."
    },
    scopeBoundary: {
      template:
        "This part of your message {reason}, so it will not be handled here: {signal_verbatim}.",
      labels: {
        default: "is outside support scope",
        generic_out_of_scope: "is outside support scope",
        non_support_linagora: "is outside Linagora support scope",
        unrelated_request: "is not related to your support request",
        spam_or_commercial:
          "looks like commercial or irrelevant content"
      }
    },
    topic: {
      politenessOpening: {
        default: "undefined",
        understanding_1: "Understood.",
        understanding_2: "Ok, I understand.",
        salutation_and_understanding_1: "Hello, thank you for your message.",
        salutation_and_understanding_2:
          "Hello, I will do my best to answer you."
      },
      topicRelationAcknowledgement: {
        prefix: "I identified ",
        separator: " and ",
        suffix: ".",
        newTopicSingular: "one new topic",
        newTopicPlural: "{count} new topics",
        ongoingTopicSingular: "one ongoing topic",
        ongoingTopicPlural: "{count} ongoing topics"
      },
      title:
        "Topic {topic_id} - {topic_category} - {topic_label} - ({topic_status})",
      topicStatusLabels: {
        default: "undefined",
        new: "New",
        previous: "Ongoing"
      },
      topicCategoryLabels: {
        default: "Other",
        bug: "Bug",
        access_security: "Access / security",
        billing: "Billing",
        request: "Request",
        question_faq: "Question",
        other: "Other"
      },
      updatedFieldsAcknowledgement:
        "I understand that you indicated: {updated_fields}.",
      testedSolution: "You tried {action} and it {outcome}.",
      topicDetailsLabels: {
        default: "undefined",
        feature_or_page: "feature or page",
        provided_url: "provided URL",
        pre_problem_state: "state before the problem",
        observed_result: "observed result",
        expected_result: "expected result",
        error_message: "error message",
        platform: "platform",
        account_context: "account context",
        frequency: "frequency",
        affected_scope: "affected scope",
        additional_context: "additional context",
        trigger_action: "trigger action",
        access_action: "access action",
        auth_method: "authentication method",
        os: "operating system",
        device: "device",
        browser: "browser",
        app_version: "application version",
        server_or_instance: "server or instance",
        affected_users: "affected users",
        logs_available: "logs available",
        billing_issue_type: "billing issue type",
        billing_provider: "billing provider",
        offer_or_plan: "offer or plan",
        amount: "amount",
        currency: "currency",
        billing_date_or_period: "billing date or period",
        gap_observed: "observed gap",
        question_intent: "question intent",
        video_available: "video available",
        image_available: "image available"
      },
      topicDetailValueTranslations: {},
      testedSolutionOutcomeLabels: {
        default: "had an unspecified outcome",
        worked: "worked",
        failed: "failed",
        partially_worked: "partially worked",
        not_tried: "was not tried",
        unclear: "had an unclear outcome"
      },
      askFields:
        "To better help you and understand your request, could you tell me: {fields_requested}?",
      proposeSolution:
        "An automatically found solution might help: could you try {solutions}?",
      acknowledgement:
        "We now have all the information needed for human support to take over and respond as well as possible.",
      nextStep: {
        default: "undefined",
        wait_more_info: "We are waiting for your reply to get more information.",
        wait_apply_solution:
          "We are waiting for your feedback to know whether the solution works.",
        wait_for_support:
          "We are waiting for human support to take over."
      },
      politenessClosure: {
        default: "undefined",
        thanks_for_cooperation1: "Thank you for your cooperation.",
        thanks_for_cooperation2: "Thanks in advance for your reply."
      }
    },
    signal: {
      responses: {
        default: "Noted.",
        thanks: "You’re welcome.",
        timeSensitive: "We’ll do our best to handle this quickly."
      },
      labels: {
        default: "user signal",
        thanks_neutral: "thanks",
        thanks_positive: "positive thanks",
        positive_feedback: "positive feedback",
        negative_feedback: "negative feedback",
        disappointment: "disappointment",
        churn_intent: "intent to leave",
        waiting: "waiting",
        apology: "apology",
        closure: "closure",
        time_sensitive: "urgency or time constraint",
        impolite: "inappropriate tone",
        complaint_without_actionable_detail:
          "complaint without directly actionable detail",
        communication_feedback: "communication feedback",
        pricing_feedback: "pricing feedback",
        feature_loss_feedback: "feedback about a lost feature",
        confirmation_without_new_field:
          "confirmation without new actionable information"
      }
    },
    handover: {
      default: "Support will soon review and respond to your request."
    }
  }
};

export { dataBaseResponse };
export type { DataBaseResponse, LabelDatabase, ResponseLanguage };
