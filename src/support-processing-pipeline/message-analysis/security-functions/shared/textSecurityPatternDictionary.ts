import type {
  TextSecurityCheckName
} from "./runTextSecurityChecks";

type TextSecurityPatternLanguage = "fr" | "en" | "neutral";

type TextSecurityPatternDictionary = Partial<
  Record<TextSecurityCheckName, Record<TextSecurityPatternLanguage, RegExp[]>>
>;

const textSecurityPatternDictionary: TextSecurityPatternDictionary = {
  prompt_injection_attempt: {
    en: [
      /ignore (all )?(previous|prior) instructions/u,
      /disregard (all )?(previous|prior) instructions/u,
      /forget (all )?(previous|prior) instructions/u,
      /show (me )?(your )?(hidden )?prompt/u,
      /reveal (the )?(system|developer) prompt/u,
      /jailbreak/u
    ],
    fr: [
      /ignore les instructions/u,
      /ignore toutes les instructions/u,
      /oublie les instructions/u,
      /revele (le |ton |votre )?prompt/u,
      /montre(-| )?moi (le )?prompt cache/u
    ],
    neutral: [
      /developer message/u,
      /system prompt/u,
      /hidden prompt/u
    ]
  },
  internal_information_request: {
    en: [
      /internal (policy|instructions|information|rules)/u,
      /developer (message|instructions)/u,
      /system (message|instructions)/u,
      /hidden rules/u
    ],
    fr: [
      /instructions internes/u,
      /informations internes/u,
      /message developpeur/u,
      /instructions developpeur/u,
      /prompt systeme/u,
      /regles cachees/u
    ],
    neutral: []
  },
  sensitive_data_request: {
    en: [
      /(send|show|give|export|list).{0,40}(private|sensitive|personal) (customer )?data/u,
      /(send|show|give|export|list).{0,40}(passport|identity card|credit card)/u,
      /(customer|client) database/u
    ],
    fr: [
      /(envoie|montre|donne|exporte|liste).{0,40}donnees? (privees?|sensibles?|personnelles?)/u,
      /(envoie|montre|donne|exporte|liste).{0,40}(passeports?|cartes? d'identite|cartes? bancaires?)/u,
      /base (clients|utilisateurs)/u
    ],
    neutral: []
  },
  credential_or_secret_leak: {
    en: [
      /api[_ -]?key\s*[:=]\s*\S{8,}/u,
      /secret[_ -]?key\s*[:=]\s*\S{8,}/u,
      /bearer\s+[a-z0-9._-]{12,}/u,
      /token\s*[:=]\s*[a-z0-9._-]{12,}/u,
      /password\s*[:=]\s*\S{6,}/u,
      /my password is\s+\S{6,}/u
    ],
    fr: [
      /cle api\s*[:=]\s*\S{8,}/u,
      /cle secrete\s*[:=]\s*\S{8,}/u,
      /jeton\s*[:=]\s*[a-z0-9._-]{12,}/u,
      /mon mot de passe est\s+\S{6,}/u,
      /mot de passe\s*[:=]\s*\S{6,}/u
    ],
    neutral: [
      /sk-[a-z0-9_-]{12,}/u
    ]
  },
  spam_like_text: {
    en: [
      /buy now/u,
      /free money/u,
      /crypto investment/u,
      /limited time offer/u,
      /work from home and earn/u
    ],
    fr: [
      /cliquez ici.*promo/u,
      /promotion exceptionnelle/u,
      /argent gratuit/u,
      /investissement crypto/u,
      /offre limitee/u
    ],
    neutral: []
  },
  unsafe_or_suspicious_content: {
    en: [
      /self-harm/u,
      /graphic violence/u,
      /explicit sexual/u,
      /unsafe visual content/u,
      /suspicious visual content/u,
      /suspicious login verification/u
    ],
    fr: [
      /automutilation/u,
      /violence graphique/u,
      /contenu sexuel explicite/u,
      /contenu visuel dangereux/u,
      /contenu visuel suspect/u,
      /verification de connexion suspecte/u
    ],
    neutral: []
  }
};

export {
  textSecurityPatternDictionary
};
export type {
  TextSecurityPatternDictionary,
  TextSecurityPatternLanguage
};
