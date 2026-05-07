action + [Qualificatif] + Objet + [Contexte]

Les préfixes d'action en TypeScript/Node
Exécution et orchestration
run      // exécute une étape, un processus        runPipeline()
start    // démarre quelque chose de long           startServer()
stop     // arrête                                  stopWorker()
process  // traite une donnée entrante              processMessage()
handle   // répond à un événement                  handleError()

Création et construction
build    // assemble une valeur complexe            buildPrompt()
create   // instancie un objet/ressource            createClient()
make     // alias léger de create                   makeRequest()
init     // initialise un état                      initConfig()
setup    // prépare un environnement                setupDatabase()

Lecture et récupération
get      // accès simple, souvent synchrone         getId()
fetch    // récupère depuis l'extérieur (API/DB)    fetchUserData()
load     // charge depuis fichier/disque            loadConfig()
read     // lit un flux ou fichier                  readFile()
find     // cherche et peut retourner null          findAttachment()
search   // cherche avec critères multiples         searchSolutions()

Transformation
parse    // convertit un format brut               parseResponse()
format   // met en forme pour affichage            formatDate()
convert  // change de type/format                  convertToBase64()
map      // transforme item par item               mapAttachments()
extract  // extrait une partie d'un tout           extractMetadata()
normalize // uniformise un format                  normalizeInput()

Validation et vérification
validate // vérifie et retourne erreurs            validateInput()
check    // vérifie, retourne boolean              checkFileSize()
is / has // prédicats purs boolean                 isVisualAttachment()
can      // vérifie une permission/capacité        canProcessFile()

Écriture et envoi
send     // envoie vers l'extérieur               sendRequest()
save     // persiste une donnée                   saveResult()
write    // écrit dans un flux ou fichier         writeLog()
publish  // émet vers un bus/queue                publishEvent()

Suppression
delete   // supprime une ressource                deleteSession()
remove   // retire d'une collection               removeAttachment()
clear    // vide un état ou cache                 clearQueue()
reset    // remet à zéro                          resetState()

Dans ton projet tu utiliseras surtout
run      → étapes du pipeline
build    → prompts, requêtes
fetch    → appels API externes
parse    → réponses LLM
validate → inputs entrants
is / has → prédicats utilitaires
