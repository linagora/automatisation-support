import {
  standardAccountInteractionTraits,
  standardAccountProfile,
  trustedAccountTrustStatus
} from "./dataset-support-quality-test";

import type {
  ConversationHistory,
  SupportProcessingPipelineInput,
  SupportTopicKnowledge
} from "../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";

export type SupportQualityFullTestCase = {
  id: number;
  label: string;
  latestUserMessage: string;
};

export const supportQualityFullTestCases: SupportQualityFullTestCase[] = [
  {
    id: 1,
    label: "App crashes, dark theme, My vault shortcut",
    latestUserMessage:
      "J'ai eu plusieurs fois des fermetures de l'application, sans pour autant comprendre pourquoi.La gestion du thème sombre est perfectible, notamment dans la création d'une nouvelle entrée, les boutons \"enregistrer\" sont écrits en noir sur fond gris foncé, donc quasiment illisibles. Mais je ne peux pas t'illustrer avec une capture d'écran, elles ne sont pas possible.Le raccourci \"My vault\" dans les réglages rapides ne fonctionne plus. Je l'aimais bien celui-là, il était pratique pour accéder à l'appli rapidement. Et l'appui sur ce raccourci provoque une fermeture d'application."
  },
  {
    id: 2,
    label: "Folders scroll fixed plus rename limitation",
    latestUserMessage:
      "lorsque j'utilise l'application et que je veux consulter mes dossiers qui n'apparaissent pas à l'écran (et donc que je scrolle vers le bas), les dossiers se mettent en mode case a cocher et je ne peux pas les ouvrir.(…)Je viens de tester ce soir et cela semble plus facile. Je peux scroller sans que les cases à cocher apparaissent. 🙂 J'ai également remarqué qu'il n'était pas possible de renommer un dossier ou un document depuis l'application.Via le web, on peut renommer mais il faut supprimer le nom du fichier pour y arriver. C'est parfois ennuyant quand on veut juste ajouter une information."
  },
  {
    id: 3,
    label: "Create folders and rename files from app",
    latestUserMessage:
      "Depuis qq temps je n'arrive plus à créer des répertoires ni renommer des fichiers depuis l'appli. Dans les deux cas le champs du nom se referme tout de suite avant que j'ai eu le temps de le renommer. Dans le cas d'un répertoire j'ai ensuite ce message \"vous devez nommer votre dossier si vous voulez le sauvegarder...\""
  },
  {
    id: 4,
    label: "Drive create folder and rename impossible",
    latestUserMessage:
      "Depuis 1 semaine au moins, il m'est impossible de créer un dossier dans le drive, ni même renommer un fichier. Que ce soit depuis l'application ou depuis le navigateur web."
  },
  {
    id: 5,
    label: "Android create folder error",
    latestUserMessage:
      "depuis l'application android twake workplace, je ne peux plus créer de dossier. Quand je fais \"Créer\" - dossier, j'ai le message : \"Vous devez nommer votre dossier si vous voulez le sauvegarder. Vos infos n'ont pas été sauvegardées.\" Mais je ne peux pas entrer de nom de dossier."
  },
  {
    id: 6,
    label: "Brand change and crash test feeling",
    latestUserMessage:
      "Bon, je n'imaginais pas que changer de drive provoquerait tant de questionnements... J'ai l'impression d'être une sorte de crash test pour Twake en réalité. Perso je pense qu'il n'aurait jamais fallu changer de nom car Cozy était parfait, c'était cool et ça marchait. D'ailleurs l'année dernière le drive se lançait sans aucun souci sur les vieux navigateurs du lycée. Je pense donc que ce nouveau nom y est pour quelque chose... Il est dur, froid... c'est sûr que c'est ça."
  },
  {
    id: 7,
    label: "TwakeDesktop install Microsoft Store paid concern",
    latestUserMessage:
      "J'ai essayé d'installer TwakeDesktop sur l'ordinateur de ma mère mais j'ai dû mal m'y prendre car il m'a été demandé de rechercher l'application dans le Microsoft Store et cela semblait conduire à quelque chose de payant"
  },
  {
    id: 8,
    label: "Downgrade with sharing, calendar, pass, sync, mail questions",
    latestUserMessage:
      "really like your service and it's interface but I decided to downgrade to the free version because there are some limitations and errors that in the end made it useless for me. But I would really like to use your service if these problems were solved.In that regard I have some questions and.comments that I would appreciate you would answer:- I need a service together with my wife where we can share folders and photo albums between two accounts. The shared folders and albums should appear on both accounts. Is this possible with Twake? I don't see this option on my account- I would also like to share calendars between the accounts. Will this be a possibility in the near future?- The Twake Pass app keeps crashing right after login on my Fairphone 4 with /e/os installed. I can see others have the same problem. Is this something that will be solved?- When trying to use the Twake sync app to sync my contacts I simply don't know which credentials to use for logging in. Can you advice on this?- Will there be a Twake mail service in the near future?With these mentioned services and comments in place I would very much like to use your service. It has the possibility of being a strong European alternative to the American big tech companies."
  },
  {
    id: 9,
    label: "Connectors and synchronizations broken for months",
    latestUserMessage:
      "utilisateur de Cozy puis maintenant de Twake depuis plusieurs années, je suis confronté aux situations suivantes :- des connecteurs qui ne fonctionnent plus, certains depuis plusieurs mois (ENSAP), voir années (NETFLIX, NESPRESSO)...- des synchronisations qui ne fonctionnent plus avec le Crédit Agricole ou encore plus récemment avec Total Energies...Pourriez-vous faire le nécessaire pour permettre le rétablissement du fonctionnement nominal de l'application et des connecteurs concernés ? Ou a minima, informer sur la reprise du service dans un délais raisonnable ou bien de l'abandon pur et simple des fonctionnalités.Vous remerciant pour votre appui, je me tiens à votre disposition pour toutes démarches ou informations complémentaires que vous estimeriez utiles au rétablissement de la situation qui m'avait conduit à adopter Cozy Cloud."
  },
  {
    id: 10,
    label: "Switch account to discovery offer",
    latestUserMessage:
      "Je viens de créer une instance et je constate que la nouvelle offre est plus avantageuse que l'offre dont je bénéficie actuellement. Actuellement, pas de création de documents avec OnlyOffice possible et le nombre d'appareils est également limité. Pouvez-vous basculer ce compte sur l'offre découverte ?"
  },
  {
    id: 11,
    label: "Password reset request security explanation",
    latestUserMessage:
      "– Bonjour, j’ai reçu une demande de réinitialisation du mot de passe, mais ça n’est pas moi qui ai fait la demande ;– heu, je viens de vérifier, la demande provient d’une IP depuis laquelle je vois également des connections de l’application mobile à votre compte. Est-ce que quelqu’un utiliserait votre téléphone à votre insu ?– Je faisais un footing à cette heure, j ai dû laissé mon téléphone déverrouillé dans ma poche et j ai du cliquer n importe où pendant pas mal de temps :/"
  },
  {
    id: 12,
    label: "Bank connector retired and alternative search",
    latestUserMessage:
      "– Cela fait plus de 140 jours (grosso modo depuis la transition vers Twake) que le connecteur La Banque Postale est indisponible. (…) Cela fera bientôt 4 ans que je suis un client de l'offre cozy, et l'application Banks est le service que je souhaite pouvoir utiliser.– désolé, l’application Banque est partie à la retraite. Mais Twake toussa !– Ces décisions sont tout a fait regrettables. En tant que particulier, je n'aurai aucune utilisation email et chat. Mon utilisation est uniquement Mot de passes, drive et banque. Je vais donc malheureusement devoir chercher une alternative."
  },
  {
    id: 13,
    label: "Restaurant commercial outreach",
    latestUserMessage:
      "I recently came across your restaurant and was impressed by its charm and quality. I help restaurants like yours collect real customer reviews that enhance visibility, increase bookings, and build lasting trust with diners."
  },
  {
    id: 14,
    label: "Double monthly charge CozyCloud and Easypark",
    latestUserMessage:
      "Je viens de constater que depuis un certain temps je suis prélevé deux fois par mois de 2,99 € une fois au nom de CozyCloud et une autre au nom de Easypark SARL Metz. Pouvez-vous m'expliquer cette anomalie ? Il semble que cela se produit depuis le passage vers Twake."
  },
  {
    id: 15,
    label: "Connectors no longer priority and free plan",
    latestUserMessage:
      "Fidèle client depuis des années de Cozy, j’appréciai cette possibilité de connecteurs aux différents services administratifs... Force est de constater que ce n'est plus votre priorité... les connecteurs que j'utilise ne sont plus à jour et ne fonctionne pas (EDF, ENSAP, IMPOTS, MAIF, APPR...). Les autres offres (cloud, pass...) ne correspondent pas à mes besoins. Merci pour ces quelques années, en vous souhaitant bonne continuation en restant dans cet esprit d'éthique et des respects des droits utilisateurs que défend LINOAGORA. Je reste cependant client de votre offre gratuite."
  },
  {
    id: 16,
    label: "Conditions changed and possible migration away",
    latestUserMessage:
      "Je suis ennuyé par les nouvelles conditions de twake.J'avais pris cozy cloud, parce que cela me permettait de récupérer automatiquement mes papiers (bulletins de salaires, factures, etc). Au début, je pouvais récupérer tout, maintenant plus que 5 comptes. J'ai choisi de vous soutenir depuis des années , au départ cozy, puis twake, mais j'avoue que je suis déçu par l'évolution du service, d'autant qu'il faut que je reconnecte souvent mes comptes.Je me demande donc si je ne vais pas tout rapatrier sur mon compte infomaniak ou ouvri un compte à la poste pour ça."
  },
  {
    id: 17,
    label: "iPhone cannot save and bank links broken",
    latestUserMessage:
      "Depuis que c’est Twake et depuis mon iPhone je ne peux plus rien enregistrer sur Twake. Ça marchait très bien avec cozy. Maintenant ca ne marche plus. Idem pour les liens banque, impôts, etc. Je pense que je vais retourner chez Dropbox ce ça marche mieux."
  },
  {
    id: 18,
    label: "Bank app no longer useful",
    latestUserMessage:
      "L'application Bank ne fonctionne plus, il n'y a rien qui l'indique. C'est en faisant une recherche sur le net que j'ai trouvé un message sur un forum. Idem pour les applications free, crédit mutuel et fortuneo. Ça n'a plus aucune utilité donc et pour le drive je vais le stocker ailleurs."
  },
  {
    id: 19,
    label: "iOS login, reset, AltCha and VoiceOver",
    latestUserMessage:
      "Jusqu'à ce matin j'étais encore connecté sur mon application iOS.J'ai souhaité me déconnecter pour tester le nouveau système… Mais mal m'en a pris… Problème probable avec le nouveau mode de connexions… :J'ai essayé de me connecter avec mon identifiant et mot de passe habituels depuis l'application, depuis le site et ce avec deux navigateurs différents. A chaque fois je reçois invariablement le message \"Informations d'identification invalides\". J'ai tenté la connexions avec mon nom d'utilisateur, mon adresse courriel, même résultat…J'ai alors essayé de réinitialiser mon mot de passe (alors que mes données sont a priori correctes), mais là encore le système ne reconnaît ni mon courriel de récupération ni même mon numéro de téléphone… m'indiquant en retour qu'aucun compte n'existe avec ce numéro/courriel…Je précise que je suis sous iOS 26.1 bêta et utilise VoiceOver étant non-voyant… ce soucis de connexion pourrait-il être lié au nouveau système d'authentification AltCha et une incompatibilité avec VoiceOver?"
  },
  {
    id: 20,
    label: "Login page and iOS accessibility improvements",
    latestUserMessage:
      "C'est tout à fait ça, c'est la page vers laquelle renvoie également l'application, dois-je en déduire que pour l'instant je ne peut l'utiliser pour me connecter à mon espace ?Si c'est le cas, je vais donc patienter car je l'ai déjà mise à jour.Par ailleurs, savez-vous s'il est prévu des améliorations en matière d'accessibilité pour l'application iOS SVP ?"
  },
  {
    id: 21,
    label: "Suspend subscription and stored data deletion",
    latestUserMessage:
      "Vu que le service ne marche pas pour l’instant et que je n’ai pas de solution à mon problème, si je suspend mon abonnement est ce que ce que j’ai stocké sera supprimé car je vais retourner chez Dropbox ?"
  },
  {
    id: 22,
    label: "Bank function was main reason and stop platform",
    latestUserMessage:
      "la fonction Banque/ étant la raison pour laquelle j'utilisais Cozy Cloud. Je vais devoir arrêter d'utiliser la plate-forme Quake. De mon point de vue, cette nouvelle offre est dépourvu d'intérêt sans l'hébergement de la fonction Banque. J'ai apprécié l'utilisation de Cozy toutes ces années."
  },
  {
    id: 23,
    label: "Banque Populaire maintenance timing",
    latestUserMessage:
      "nous avons choisi votre plateforme pour pouvoir profiter des applications bancaires. Or cela fait plus de 9 mois que le service \"banque populaire\" est en maintenance. Pourriez-vous nous dire quand cela devra être réparé?"
  },
  {
    id: 24,
    label: "Account not recognized and premium purchase page",
    latestUserMessage:
      "twake ne semble plus reconnaitre mon compte. Je n'arrive plus a enregistrer des papiers... au moment d enregistré un nouveau papier, il me renvoie sur une page d achat de compte premium"
  },
  {
    id: 25,
    label: "MFA option availability",
    latestUserMessage:
      "Je ne trouve pas d'option de MFA sur mon compte Twake. Cette option n'est-elle pas proposée ?"
  },
  {
    id: 26,
    label: "Create Twake with phone number, login and missing Pass",
    latestUserMessage:
      "Mon épouse et moi-même venons de créer un « twake » (je ne comprends pas la différence avec le cozy cloud que j’avais créé pour moi autrefois) bref. Nous avons créé le cozy avec l’identifiant « svitlanabt68 » mais après déconnexion ça ne marche pas, on nous dit que cela n’existe pas.le support me propose de m’aider en marquant l’adresse mail avec laquelle nous avons créé le cozy, mais on ne nous a demandé qu’un numéro de téléphone. De quelle adresse mes mal s’agit-il?Je suis déçu, quand j’avais créé mon cozy cloud, tout était simple. Maintenant il y a des mots anglais, des twake des trucs… En plus lors de la création du « twake » de mon épouse il n’y avais pas d’espace pour la gestion des mots de passe comme sur mon cozy, je voulais avoir un abonnement pour moi et un pour ma femme mais cela me décourage complètement 😦"
  },
  {
    id: 27,
    label: "Missing Pass undermines adoption",
    latestUserMessage:
      "Si on ne dispose pas du pass, cela perd beaucoup de son intérêt. Imaginez, mon épouse est particlulièrement réfractaire au numérique auquel elle ne comprend rien. Je lui vend cozy cloud, j'arrive sans trop de peine à lui vendre de faire deux comptes et un abonnement pour chaque et au moment décisif, patatra, ça ne marche pas. Outre le fait que j'ai l'air bête, elle est désormais convaincu que le numérique est un \"attrappe couil...) et que ce n'est pas fait pour elle..."
  },
  {
    id: 28,
    label: "Positive despite difficulty and taking subscriptions",
    latestUserMessage:
      "je suis vraiment trop content même si c'esst super galère... C'est pour nouis convaicre d'aller chez un hébergeur américain ? ;-) ;-) (…) Bon, je vais prendre un abonnement, pour elle et un pour moi."
  },
  {
    id: 29,
    label: "Cannot login after phone change and Proton threat",
    latestUserMessage:
      "I was using Cozy cloud for a lot of years, and recently you change to twake. Now I changed my phone and install twake app and cannot login with my cozy cloud account. What is hapenning? I have also twake pass working but cannot login through phone app. I will change to Proton if you will not manage this immediately"
  },
  {
    id: 30,
    label: "Organization server not found",
    latestUserMessage:
      "after using organization server and typing samo.mycozy.cloud it shows error \" Organization server not found\".You whould at last inform us... Cozy before was way better and really inovative with better protection. Sadly you sell it to other..."
  },
  {
    id: 31,
    label: "Now works and positive feedback",
    latestUserMessage:
      "Now it works. Merci. I really like cozy and thought finally found one of the best cloud suite but your promotion was lacking. Wish all good."
  },
  {
    id: 32,
    label: "Few bugs and no photo management",
    latestUserMessage:
      "quelques bugs, pas de gestion des photos."
  },
  {
    id: 33,
    label: "Now works and positive feedback duplicate",
    latestUserMessage:
      "Now it works. Merci. I really like cozy and thought finally found one of the best cloud suite but your promotion was lacking. Wish all good."
  },
  {
    id: 34,
    label: "No bank connection",
    latestUserMessage: "No connection to banks anymore"
  },
  {
    id: 35,
    label: "Churn because Twake no longer fits needs",
    latestUserMessage:
      "Twake ne répond plus à mes besoins et je vais arrêter mon abonnement."
  },
  {
    id: 36,
    label: "Churn because features cannot be maintained",
    latestUserMessage:
      "Je vais donc prochainement arrêter mon abonnement vu que les fonctionnalités que j'apprécie dans votre suite ne peuvent plus être maintenues."
  },
  {
    id: 37,
    label: "Long churn about direction and data conditions",
    latestUserMessage:
      "La direction que prend cozy depuis que twake et donc linagora sont impliqués ne m'incite pas à rester chez vous trop longtemps. Dans les mois qui viennent je pense récupérer les dernières données encore stockées chez vous c'est à dire plus grand chose et clore mon compte. Je n'ai pas besoin d'une application de mail, j'ai déjà un nom de domaine et les mails associés. Je n'ai pas non plus besoin d'un tchat basé sur matrix puisque j'ai déjà eu élément matrix et que mes besoins ne vont pas au delà de l'utilisation de signal et d'irc. Si le besoin s'en fait sentir je me recréerais un compte matrix. J'ai beaucoup aimé être sur cozy depuis l'époque de la version test. Je j'aimerai pas rester sur twake. J'ai bien conscience que vos impératifs pour continuer à exister exigent certains changements de direction hélas incompatibles avec mon éthique. Je vous souhaite néanmoins bonne route pour la suite qui se déroulera sans moi. J'ai beaucoup aimé Cozy.conditions générales modifiée suite change cozy vers twake. Les conditions de stockage et de traitement des données ne me conviennent plus."
  },
  {
    id: 38,
    label: "iOS app totally buggy",
    latestUserMessage: "Application totalement bugée sur iOS"
  },
  {
    id: 39,
    label: "Not as user friendly as kDrive",
    latestUserMessage:
      "Not as user friendly as kDrive. I was lookin for a french open source e2ee alternatives but there are to many trade off..."
  },
  {
    id: 40,
    label: "Suspended services make mycozy useless",
    latestUserMessage:
      "Avec tous les services suspendus, mycozy n'a plus aucun intérêt pour moi."
  },
  {
    id: 41,
    label: "Delete account due to cloud-only service",
    latestUserMessage:
      "Donc mycosy ne présente plus aucun intérêt à mes yeux. C'est devenu un simple service cloud et j'en ai déjà d'autres plus performants. Je supprime donc mon compte. Dommage du manque de communication de votre part..."
  },
  {
    id: 42,
    label: "No bank means no use",
    latestUserMessage:
      "Sans la gestion de la bank cela ne me sert plus à rien."
  },
  {
    id: 43,
    label: "Request password folders",
    latestUserMessage:
      "Serait-il possible d’envisager la création de dossiers pour y ranger les mots de passe par thème ?"
  },
  {
    id: 44,
    label: "Request iOS accessibility improvements",
    latestUserMessage:
      "serait-il possible d'améliorer l'accessibilité de l'application Twake Workplace pour iOS en :- étiquetant les boutons : certains ne disposant d'étiquette texte, il est difficile avec VoiceOver (le lecteur d'écran d'Apple) de connaître leur fonction.- ajoutant un moyen, à moins que cela existe déjà et que VoiceOver ne l'ait pas identifié, permettant de revenir à l'écran précédent/l'écran d'accueil de l'application.AMHA, ça ne concerne pas spécifiquement l’AA, l’absence d’étiquette sur les boutons est dans les applis Web."
  },
  {
    id: 45,
    label: "Google Wallet refused direct payment question",
    latestUserMessage:
      "alors que tout va bien sur mes comptes et que je paie avec mes cartes en réel et sur internet, tous mes paiements par carte via Google Wallet sont refusés. Puis-je payé en direct ?"
  },
  {
    id: 46,
    label: "Google Wallet refused direct payment duplicate",
    latestUserMessage:
      "alors que tout va bien sur mes comptes et que je paie avec mes cartes en réel et sur internet, tous mes paiements par carte via Google Wallet sont refusés. Puis-je payé en direct ?"
  },
  {
    id: 47,
    label: "Sensitive connectors and storage elsewhere",
    latestUserMessage:
      "Plein de services non synchronisables sauf avec un smartphone. Je ne mets JAMAIS des accès aussi sensibles sur un smartphone.Plein de connecteurs administratifs essentiels ne fonctionnent plus.Octopus Energie et Alterna Energie ne sont pas proposés alors qu'ils sont les lauréats de l'opération \"Energie mins chère ensemble\" de Que Choisir.Pour ce qui est du stockage, j'en ai déjà un à vie sur pCloud."
  },
  {
    id: 48,
    label: "Share document to Twake no-op",
    latestUserMessage:
      "Depuis le passage à Twake une action est désormais impossible : partager un document (ex une correction écrite au stylet sur le sujet de l activité en utilisant Notability.Auparavant je cliquais sur partager, choisissais Cozy, puis on me demander où je souhaitais enregistrer le doc dans le Cozy.Aujourd’hui quand je clique sur partager, puis Tawke, il ne se passe rien."
  },
  {
    id: 49,
    label: "Classroom iPad export workflow missing",
    latestUserMessage:
      "Oui exactement, svt je corrige en classe, sur l iPad, avec le stylet, en mm temps que les élèves, puis j exporte afin de publier ensuite dans elea, ce qui permet aux absents de se mettre à jour dès qu ils peuvent.Cela manque depuis le début de l année. J ai la possibilité de passer par le stockage d iOS mais je préférerai utiliser les outils institutionnels."
  },
  {
    id: 50,
    label: "Android Photos tab missing after account creation",
    latestUserMessage:
      "J'ai aidé mon amie à créer un compte twake, tout fonctionne correctement sur son Mac. Sur le téléphone - Android 15 à jour - nous avons installé l'application Twake par le playstore et connecté le compte. Sur la page d'accueil de l'appli, l'onglet Photos n'est pas présent et nous ne pouvons donc pas demander la synchronisation des photos (le bouton Add ne m'aide pas, je ne sais quelle URL renseigner). Avez-vous une idée de ce que j'ai manqué ?"
  },
  {
    id: 51,
    label: "Photo backup disappointment after support info",
    latestUserMessage:
      "Merci pour ces infos même si elles me désolent un peu. - je lui avais justement vendu la fonction de sauvegardes des photos. Aujourd'hui nous avons installé twake desktop sur le mac, donc avec synchro des dossiers, que nous voulons conserver. Son besoin est de sauvegarder les photos sur le compte et de les effacer du téléphone. A titre perso, j'aimais beaucoup les fonctionnalités de Cozy, surtout les connecteurs edf etc qui faisaient arriver les factures directement sur mon pc."
  },
  {
    id: 52,
    label: "Google Wallet refused direct payment duplicate 2",
    latestUserMessage:
      "alors que tout va bien sur mes comptes et que je paie avec mes cartes en réel et sur internet, tous mes paiements par carte via Google Wallet sont refusés. Puis-je payé en direct ?"
  },
  {
    id: 53,
    label: "Google non-payment reminder after bank validation",
    latestUserMessage:
      "Je suis relancé par Google pour un non paiement du service Twake auquel je suis abonné (3€/mens). Or j’effectue bien le paiement avec validation auprès de ma banque, mais ensuite, Google affiche un paiement refusé."
  },
  {
    id: 54,
    label: "Google Wallet refused direct payment duplicate 3",
    latestUserMessage:
      "alors que tout va bien sur mes comptes et que je paie avec mes cartes en réel et sur internet, tous mes paiements par carte via Google Wallet sont refusés. Puis-je payé en direct ?"
  },
  {
    id: 55,
    label: "Google non-payment reminder November 2025",
    latestUserMessage:
      "Je suis relancé par Google pour un non paiement du service Twake auquel je suis abonné (3€/mens). Or j’effectue bien le paiement avec validation auprès de ma banque, mais ensuite, Google affiche un paiement refusé.NOVEMBRE 2025"
  }
];

export function buildSupportQualityFullInput(
  testCase: SupportQualityFullTestCase
): SupportProcessingPipelineInput {
  const emptySupportTopicKnowledge: SupportTopicKnowledge = {
    segments_topic: []
  };

  return {
    latestUserMessage: {
      id: `quality_full_case_${testCase.id}`,
      channel: "email",
      sentAt: "2026-05-21T09:00:00.000Z",
      content: testCase.latestUserMessage
    },
    latestUserAttachments: [],
    accountTrustStatus: trustedAccountTrustStatus,
    accountProfile: standardAccountProfile,
    accountInteractionTraits: standardAccountInteractionTraits,
    supportTopicKnowledge: emptySupportTopicKnowledge,
    conversationHistory: [] as ConversationHistory
  };
}
