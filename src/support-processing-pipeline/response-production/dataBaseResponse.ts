type ResponseLanguage = "french" | "english";

type DataBaseResponse = {
  [language in ResponseLanguage]: {
    securityGate: string;
    suspicious: string;
    lackComprehension: string;
    scopeBoundary: string;
    topic: {
      acknowledgement: string;
      askFields: string;
      proposeSolution: string;
    };
    signal: string;
    handover: string;
  };
};

const dataBaseResponse: DataBaseResponse = {
  french: {
    securityGate: "Je ne peux pas traiter cette demande pour des raisons de securite.",
    suspicious: "Je ne peux pas continuer avec ce contenu tel quel.",
    lackComprehension: "Je n'ai pas compris certains elements de votre demande.",
    scopeBoundary: "Cette demande semble sortir du perimetre du support.",
    topic: {
      acknowledgement: "J'ai bien pris en compte votre demande.",
      askFields: "Il me manque quelques informations pour continuer.",
      proposeSolution: "Voici une solution possible."
    },
    signal: "Merci pour votre retour.",
    handover: "Je vais transmettre votre demande a l'equipe support."
  },
  english: {
    securityGate: "I cannot process this request for security reasons.",
    suspicious: "I cannot continue with this content as-is.",
    lackComprehension: "I did not understand some parts of your request.",
    scopeBoundary: "This request seems outside support scope.",
    topic: {
      acknowledgement: "I have taken your request into account.",
      askFields: "I need a few more details to continue.",
      proposeSolution: "Here is a possible solution."
    },
    signal: "Thanks for your feedback.",
    handover: "I will pass your request to the support team."
  }
};

export { dataBaseResponse };
export type { DataBaseResponse, ResponseLanguage };
