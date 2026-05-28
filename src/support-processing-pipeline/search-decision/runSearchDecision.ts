import type {
  SearchDecisionInput,
  SearchDecisionOutput
} from "../typesSupportProcessingPipeline.types";

async function runSearchDecision(
  input: SearchDecisionInput
): Promise<SearchDecisionOutput> {
  const hasTopic =
    Array.isArray(input.turnUnderstandingDelta.segments_topic) &&
    input.turnUnderstandingDelta.segments_topic.length > 0;

  return {
    decision: {
      route: "continue",
      type: "acknowledgement"
    },
    detected: {
      topicsQualificationResult: hasTopic ? "not_evaluated" : "no_topic",
      solutionLikelihoodResult: "not_evaluated"
    },
    history: {
      checked: [
        "turn_understanding_delta_received",
        "topics_presence_checked",
        "forced_acknowledgement_mode"
      ],
      failed: []
    }
  } as SearchDecisionOutput;
}

export {
  runSearchDecision
};

Le runSearch decision est aujourd'hui mocke et renvoie toujours acknlodgement, pour l'instant je souhaite continuer de le mocker mais le democker quand meme un peu en lui donnant la possibiité d'évaluer le niveau d'information obtenu, on doit juste définir des règles sur les topcis defaultMaxListeners. En gros le but est de statuer sur des règles selon la catégorie, si on est face à un bug, demande (etccc) alors on va dire qu'on a enoguh informaiton seuleemnt si le tous ces champs sont bien remplsi, s'il ne sont pas remplis alors on va lister tout les manquant et les ajouter et dire qu'on a besoin de plu d'info, si on a toutes les infos pour l'instna ton mockera de nouveau direcezmtn vers aknlogement mais ensuite on fera pour recherche RAG. la l'idée c'est qu'on prenent déjà le temps de definir ensemble les règles qu'on va mettre et le  niveau d'exgience des champs qu'on veut je ense le truc smart c'est d'aoir au début du code une simple vairbale qu'on peut faire changer de 1 à 3 par exmeple et 3 on demande tous les chaps utilse et 1 seuelemnt les essentielles. puis on calibrera le bot pour faire evoluer ça en focntion du userinfo 