```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 24, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB

  subgraph ISSUE_BRANCH["Issue resolution branch"]
    direction TB

    %% =====================================================
    %% INPUT
    %% =====================================================

    ISSUE_BRANCH_INPUT["<b>Input provided to issue branch</b><br/>
    topicIdentity<br/>
    supportDomain<br/>
    sourceUnderstandings<br/>
    previousLiveTopic?<br/>
    previousIssueProgressState?"]

    %% =====================================================
    %% 1. RESOLVE CURRENT ISSUE STATE
    %% =====================================================

    T_RESOLVE_ISSUE_STATE_INPUT["<b>Prepare issueStateInput</b>"]

    subgraph RESOLVE_ISSUE_STATE_DATA["issueProgressState = resolveIssueProgressState(input)"]
      direction TB

      RESOLVE_ISSUE_STATE_ROLE["<b>Rôle :</b> fusionner l’état précédent avec les nouvelles informations extraites du message utilisateur."]

      subgraph RESOLVE_ISSUE_STATE_IO[" "]
        direction LR

        RESOLVE_ISSUE_STATE_INPUTS["<b>Input</b><br/>
        previousIssueProgressState?<br/>
        sourceUnderstandings<br/>
        extractedFields<br/>
        attemptedActions<br/>
        supportDomain"]

        RESOLVE_ISSUE_STATE_OUTPUTS["<b>Output</b><br/>
        issueProgressState = {<br/>
        basicQualification: {complete, fields[]}<br/>
        similarTopic: {complete, status, candidateTopics[], selectedTopic?}<br/>
        deepQualification: {complete, mode, fields[]}<br/>
        solution: {complete, status, solution?}<br/>
        }"]

        RESOLVE_ISSUE_STATE_INPUTS --> RESOLVE_ISSUE_STATE_OUTPUTS
      end

      RESOLVE_ISSUE_STATE_ROLE ~~~ RESOLVE_ISSUE_STATE_IO
    end

    %% =====================================================
    %% 2. BASIC QUALIFICATION
    %% =====================================================

    T_BASIC_PRE_GATE{"<b>Basic qualification already complete?</b>"}

    T_BASIC_QUALIFICATION_INPUT["<b>Prepare basicQualificationInput</b>"]

    subgraph BASIC_QUALIFICATION_DATA["issueProgressState = assessIssueBasicQualification(input)"]
      direction TB

      BASIC_QUALIFICATION_ROLE["<b>Rôle :</b> vérifier déterministiquement les champs basiques attendus pour ce supportDomain et mettre à jour l’état."]

      subgraph BASIC_QUALIFICATION_IO[" "]
        direction LR

        BASIC_QUALIFICATION_INPUTS["<b>Input</b><br/>
        supportDomain<br/>
        issueProgressState.basicQualification<br/>
        issueBasicFieldCatalog"]

        BASIC_QUALIFICATION_OUTPUTS["<b>Output</b><br/>
        issueProgressState.basicQualification = {<br/>
        complete<br/>
        fields[]<br/>
        missingRequiredFields[]<br/>
        missingRecommendedFields[]<br/>
        nextAskFields[]<br/>
        }"]

        BASIC_QUALIFICATION_INPUTS --> BASIC_QUALIFICATION_OUTPUTS
      end

      BASIC_QUALIFICATION_ROLE ~~~ BASIC_QUALIFICATION_IO
    end

    T_BASIC_POST_GATE{"<b>Basic qualification complete?</b>"}

    subgraph BASIC_ASK_DATA["topicPlannerOutput = planIssueBasicQualificationAsk(input)"]
      direction TB

      BASIC_ASK_ROLE["<b>Rôle :</b> demander les champs basiques manquants ou demander à l’utilisateur de dire s’ils sont impossibles à fournir."]

      subgraph BASIC_ASK_IO[" "]
        direction LR

        BASIC_ASK_INPUTS["<b>Input</b><br/>
        issueProgressState.basicQualification<br/>
        topicIdentity"]

        BASIC_ASK_OUTPUTS["<b>Output</b><br/>
        topicPlannerOutput = {<br/>
        route: issue_resolution<br/>
        action: ask_basic_qualification<br/>
        rendererTask<br/>
        nextIssueProgressState<br/>
        }"]

        BASIC_ASK_INPUTS --> BASIC_ASK_OUTPUTS
      end

      BASIC_ASK_ROLE ~~~ BASIC_ASK_IO
    end

    %% =====================================================
    %% 3. SIMILAR TOPIC / RAG
    %% =====================================================

    T_SIMILAR_PRE_GATE{"<b>Similar topic already complete?</b><br/>
    identified or absent"}

    T_SIMILAR_SEARCH_INPUT["<b>Prepare similarTopicSearchInput</b>"]

    subgraph SIMILAR_SEARCH_DATA["issueProgressState = searchSimilarIssueTopics(input)"]
      direction TB

      SIMILAR_SEARCH_ROLE["<b>Rôle :</b> chercher des cas ou topics similaires uniquement si l’état similarTopic n’est pas encore complet."]

      subgraph SIMILAR_SEARCH_IO[" "]
        direction LR

        SIMILAR_SEARCH_INPUTS["<b>Input</b><br/>
        topicIdentity<br/>
        supportDomain<br/>
        basicQualificationFields<br/>
        sourceUnderstandings<br/>
        liveMemory / knowledge base"]

        SIMILAR_SEARCH_OUTPUTS["<b>Output</b><br/>
        issueProgressState.similarTopic = {<br/>
        complete<br/>
        status: identified / unclear / absent / fallback<br/>
        candidateTopics[]<br/>
        selectedTopic?<br/>
        }"]

        SIMILAR_SEARCH_INPUTS --> SIMILAR_SEARCH_OUTPUTS
      end

      SIMILAR_SEARCH_ROLE ~~~ SIMILAR_SEARCH_IO
    end

    R_SIMILAR_SEARCH_FALLBACK["<b>Possible fallback return</b><br/>
    if similarTopic.status = fallback"]

    T_SIMILAR_POST_GATE{"<b>Similar topic complete?</b><br/>
    identified / absent / unclear"}

    subgraph SIMILAR_DISAMBIGUATION_DATA["topicPlannerOutput = planSimilarTopicDisambiguationAsk(input)"]
      direction TB

      SIMILAR_DISAMBIGUATION_ROLE["<b>Rôle :</b> poser une question ciblée si plusieurs topics similaires sont plausibles."]

      subgraph SIMILAR_DISAMBIGUATION_IO[" "]
        direction LR

        SIMILAR_DISAMBIGUATION_INPUTS["<b>Input</b><br/>
        candidateTopics<br/>
        sourceUnderstandings<br/>
        topicIdentity"]

        SIMILAR_DISAMBIGUATION_OUTPUTS["<b>Output</b><br/>
        topicPlannerOutput = {<br/>
        route: issue_resolution<br/>
        action: ask_similar_topic_disambiguation<br/>
        rendererTask<br/>
        nextIssueProgressState<br/>
        }"]

        SIMILAR_DISAMBIGUATION_INPUTS --> SIMILAR_DISAMBIGUATION_OUTPUTS
      end

      SIMILAR_DISAMBIGUATION_ROLE ~~~ SIMILAR_DISAMBIGUATION_IO
    end

    %% =====================================================
    %% 4. DEEP QUALIFICATION
    %% =====================================================

    T_DEEP_PRE_GATE{"<b>Deep qualification already complete?</b>"}

    T_DEEP_QUALIFICATION_INPUT["<b>Prepare deepQualificationInput</b>"]

    subgraph DEEP_QUALIFICATION_DATA["issueProgressState = assessIssueDeepQualification(input)"]
      direction TB

      DEEP_QUALIFICATION_ROLE["<b>Rôle :</b> vérifier les champs profonds nécessaires, orientés par le topic similaire identifié ou par le domaine si aucun topic similaire n’est exploitable."]

      subgraph DEEP_QUALIFICATION_IO[" "]
        direction LR

        DEEP_QUALIFICATION_INPUTS["<b>Input</b><br/>
        issueProgressState<br/>
        supportDomain<br/>
        similarTopicState<br/>
        issueDeepFieldCatalog"]

        DEEP_QUALIFICATION_OUTPUTS["<b>Output</b><br/>
        issueProgressState.deepQualification = {<br/>
        complete<br/>
        mode: similar_topic_guided / domain_generic<br/>
        fields[]<br/>
        missingFields[]<br/>
        nextAskFields[]<br/>
        }"]

        DEEP_QUALIFICATION_INPUTS --> DEEP_QUALIFICATION_OUTPUTS
      end

      DEEP_QUALIFICATION_ROLE ~~~ DEEP_QUALIFICATION_IO
    end

    T_DEEP_POST_GATE{"<b>Deep qualification complete?</b>"}

    subgraph DEEP_ASK_DATA["topicPlannerOutput = planIssueDeepQualificationAsk(input)"]
      direction TB

      DEEP_ASK_ROLE["<b>Rôle :</b> demander les informations profondes nécessaires avant de proposer une solution."]

      subgraph DEEP_ASK_IO[" "]
        direction LR

        DEEP_ASK_INPUTS["<b>Input</b><br/>
        issueProgressState.deepQualification<br/>
        topicIdentity"]

        DEEP_ASK_OUTPUTS["<b>Output</b><br/>
        topicPlannerOutput = {<br/>
        route: issue_resolution<br/>
        action: ask_deep_qualification<br/>
        rendererTask<br/>
        nextIssueProgressState<br/>
        }"]

        DEEP_ASK_INPUTS --> DEEP_ASK_OUTPUTS
      end

      DEEP_ASK_ROLE ~~~ DEEP_ASK_IO
    end

    %% =====================================================
    %% 5. SOLUTION
    %% =====================================================

    T_SOLUTION_PRE_GATE{"<b>Solution already complete?</b><br/>
    available / not_found / not_relevant / provided / awaiting_user_result"}

    T_SOLUTION_INPUT["<b>Prepare issueSolutionInput</b>"]

    subgraph SOLUTION_DATA["issueProgressState = extractIssueSolution(input)"]
      direction TB

      SOLUTION_ROLE["<b>Rôle :</b> déterminer si la connaissance récupérée permet de proposer une solution pertinente et mettre à jour l’état solution."]

      subgraph SOLUTION_IO[" "]
        direction LR

        SOLUTION_INPUTS["<b>Input</b><br/>
        issueProgressState<br/>
        similarTopicState<br/>
        deepQualificationState<br/>
        knowledgeChunks?"]

        SOLUTION_OUTPUTS["<b>Output</b><br/>
        issueProgressState.solution = {<br/>
        complete<br/>
        status: available / not_found / not_relevant / fallback<br/>
        solution?<br/>
        confidence?<br/>
        }"]

        SOLUTION_INPUTS --> SOLUTION_OUTPUTS
      end

      SOLUTION_ROLE ~~~ SOLUTION_IO
    end

    R_SOLUTION_FALLBACK["<b>Possible fallback return</b><br/>
    if solution.status = fallback"]

    T_SOLUTION_POST_GATE{"<b>Solution complete?</b>"}

    subgraph SOLUTION_FOLLOWUP_DATA["topicPlannerOutput = planIssueSolutionFollowup(input)"]
      direction TB

      SOLUTION_FOLLOWUP_ROLE["<b>Rôle :</b> produire une réponse de secours si aucune solution exploitable ne peut encore être construite."]

      subgraph SOLUTION_FOLLOWUP_IO[" "]
        direction LR

        SOLUTION_FOLLOWUP_INPUTS["<b>Input</b><br/>
        issueProgressState.solution<br/>
        topicIdentity"]

        SOLUTION_FOLLOWUP_OUTPUTS["<b>Output</b><br/>
        topicPlannerOutput = {<br/>
        route: issue_resolution<br/>
        action: acknowledge_no_solution / escalate / ask_followup<br/>
        rendererTask<br/>
        nextIssueProgressState<br/>
        }"]

        SOLUTION_FOLLOWUP_INPUTS --> SOLUTION_FOLLOWUP_OUTPUTS
      end

      SOLUTION_FOLLOWUP_ROLE ~~~ SOLUTION_FOLLOWUP_IO
    end

    T_SOLUTION_PLANNER_INPUT["<b>Prepare issueSolutionPlannerInput</b>"]

    subgraph SOLUTION_PLANNER_DATA["topicPlannerOutput = planIssueSolutionResponse(input)"]
      direction TB

      SOLUTION_PLANNER_ROLE["<b>Rôle :</b> proposer la solution, acknowledge, attendre le résultat utilisateur, ou préparer une escalade selon l’état solution."]

      subgraph SOLUTION_PLANNER_IO[" "]
        direction LR

        SOLUTION_PLANNER_INPUTS["<b>Input</b><br/>
        issueProgressState<br/>
        topicIdentity<br/>
        sourceUnderstandings"]

        SOLUTION_PLANNER_OUTPUTS["<b>Output</b><br/>
        topicPlannerOutput = {<br/>
        route: issue_resolution<br/>
        action: provide_solution / await_result / acknowledge_no_solution / escalate<br/>
        rendererTask<br/>
        nextIssueProgressState<br/>
        }"]

        SOLUTION_PLANNER_INPUTS --> SOLUTION_PLANNER_OUTPUTS
      end

      SOLUTION_PLANNER_ROLE ~~~ SOLUTION_PLANNER_IO
    end

    %% =====================================================
    %% RETURN
    %% =====================================================

    ISSUE_BRANCH_RETURN["<b>Return topicPlannerOutput</b><br/>
    plus nextIssueProgressState"]

    %% =====================================================
    %% LINKS
    %% =====================================================

    ISSUE_BRANCH_INPUT --> T_RESOLVE_ISSUE_STATE_INPUT
    T_RESOLVE_ISSUE_STATE_INPUT --> RESOLVE_ISSUE_STATE_DATA
    RESOLVE_ISSUE_STATE_DATA --> T_BASIC_PRE_GATE

    T_BASIC_PRE_GATE -->|yes| T_SIMILAR_PRE_GATE
    T_BASIC_PRE_GATE -->|no| T_BASIC_QUALIFICATION_INPUT

    T_BASIC_QUALIFICATION_INPUT --> BASIC_QUALIFICATION_DATA
    BASIC_QUALIFICATION_DATA --> T_BASIC_POST_GATE

    T_BASIC_POST_GATE -->|no| BASIC_ASK_DATA
    BASIC_ASK_DATA --> ISSUE_BRANCH_RETURN

    T_BASIC_POST_GATE -->|yes| T_SIMILAR_PRE_GATE

    T_SIMILAR_PRE_GATE -->|yes| T_DEEP_PRE_GATE
    T_SIMILAR_PRE_GATE -->|no| T_SIMILAR_SEARCH_INPUT

    T_SIMILAR_SEARCH_INPUT --> SIMILAR_SEARCH_DATA
    SIMILAR_SEARCH_DATA ~~~ R_SIMILAR_SEARCH_FALLBACK
    SIMILAR_SEARCH_DATA --> T_SIMILAR_POST_GATE

    T_SIMILAR_POST_GATE -->|unclear| SIMILAR_DISAMBIGUATION_DATA
    SIMILAR_DISAMBIGUATION_DATA --> ISSUE_BRANCH_RETURN

    T_SIMILAR_POST_GATE -->|identified / absent| T_DEEP_PRE_GATE

    T_DEEP_PRE_GATE -->|yes| T_SOLUTION_PRE_GATE
    T_DEEP_PRE_GATE -->|no| T_DEEP_QUALIFICATION_INPUT

    T_DEEP_QUALIFICATION_INPUT --> DEEP_QUALIFICATION_DATA
    DEEP_QUALIFICATION_DATA --> T_DEEP_POST_GATE

    T_DEEP_POST_GATE -->|no| DEEP_ASK_DATA
    DEEP_ASK_DATA --> ISSUE_BRANCH_RETURN

    T_DEEP_POST_GATE -->|yes| T_SOLUTION_PRE_GATE

    T_SOLUTION_PRE_GATE -->|yes| T_SOLUTION_PLANNER_INPUT
    T_SOLUTION_PRE_GATE -->|no| T_SOLUTION_INPUT

    T_SOLUTION_INPUT --> SOLUTION_DATA
    SOLUTION_DATA ~~~ R_SOLUTION_FALLBACK
    SOLUTION_DATA --> T_SOLUTION_POST_GATE

    T_SOLUTION_POST_GATE -->|no| SOLUTION_FOLLOWUP_DATA
    SOLUTION_FOLLOWUP_DATA --> ISSUE_BRANCH_RETURN

    T_SOLUTION_POST_GATE -->|yes| T_SOLUTION_PLANNER_INPUT

    T_SOLUTION_PLANNER_INPUT --> SOLUTION_PLANNER_DATA
    SOLUTION_PLANNER_DATA --> ISSUE_BRANCH_RETURN

  end

  %% =====================================================
  %% STYLES
  %% =====================================================

  classDef inputBlock fill:#d5e8d4,stroke:#82b366,color:#000000,stroke-width:1px;
  classDef outputBlock fill:#f8cecc,stroke:#b85450,color:#000000,stroke-width:1px;
  classDef processingBlock fill:#d9e8f5,stroke:#4f93d2,color:#000000,stroke-width:1px;
  classDef decisionBlock fill:#fff2cc,stroke:#d6b656,color:#000000,stroke-width:1px;
  classDef earlyReturnBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px,stroke-dasharray: 5 5;
  classDef roleBlock fill:#333333,stroke:#333333,color:#ffffff,stroke-width:0px;

  class ISSUE_BRANCH_INPUT inputBlock;

  class RESOLVE_ISSUE_STATE_INPUTS,BASIC_QUALIFICATION_INPUTS,BASIC_ASK_INPUTS,SIMILAR_SEARCH_INPUTS,SIMILAR_DISAMBIGUATION_INPUTS,DEEP_QUALIFICATION_INPUTS,DEEP_ASK_INPUTS,SOLUTION_INPUTS,SOLUTION_FOLLOWUP_INPUTS,SOLUTION_PLANNER_INPUTS inputBlock;

  class RESOLVE_ISSUE_STATE_OUTPUTS,BASIC_QUALIFICATION_OUTPUTS,BASIC_ASK_OUTPUTS,SIMILAR_SEARCH_OUTPUTS,SIMILAR_DISAMBIGUATION_OUTPUTS,DEEP_QUALIFICATION_OUTPUTS,DEEP_ASK_OUTPUTS,SOLUTION_OUTPUTS,SOLUTION_FOLLOWUP_OUTPUTS,SOLUTION_PLANNER_OUTPUTS outputBlock;

  class T_RESOLVE_ISSUE_STATE_INPUT,T_BASIC_QUALIFICATION_INPUT,T_SIMILAR_SEARCH_INPUT,T_DEEP_QUALIFICATION_INPUT,T_SOLUTION_INPUT,T_SOLUTION_PLANNER_INPUT,ISSUE_BRANCH_RETURN processingBlock;

  class T_BASIC_PRE_GATE,T_BASIC_POST_GATE,T_SIMILAR_PRE_GATE,T_SIMILAR_POST_GATE,T_DEEP_PRE_GATE,T_DEEP_POST_GATE,T_SOLUTION_PRE_GATE,T_SOLUTION_POST_GATE decisionBlock;

  class R_SIMILAR_SEARCH_FALLBACK,R_SOLUTION_FALLBACK earlyReturnBlock;

  class RESOLVE_ISSUE_STATE_ROLE,BASIC_QUALIFICATION_ROLE,BASIC_ASK_ROLE,SIMILAR_SEARCH_ROLE,SIMILAR_DISAMBIGUATION_ROLE,DEEP_QUALIFICATION_ROLE,DEEP_ASK_ROLE,SOLUTION_ROLE,SOLUTION_FOLLOWUP_ROLE,SOLUTION_PLANNER_ROLE roleBlock;

  style ISSUE_BRANCH fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;

  style RESOLVE_ISSUE_STATE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style BASIC_QUALIFICATION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style BASIC_ASK_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SIMILAR_SEARCH_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SIMILAR_DISAMBIGUATION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style DEEP_QUALIFICATION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style DEEP_ASK_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SOLUTION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SOLUTION_FOLLOWUP_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SOLUTION_PLANNER_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  style RESOLVE_ISSUE_STATE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style BASIC_QUALIFICATION_IO fill:transparent,stroke:transparent,color:#ffffff;
  style BASIC_ASK_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SIMILAR_SEARCH_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SIMILAR_DISAMBIGUATION_IO fill:transparent,stroke:transparent,color:#ffffff;
  style DEEP_QUALIFICATION_IO fill:transparent,stroke:transparent,color:#ffffff;
  style DEEP_ASK_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SOLUTION_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SOLUTION_FOLLOWUP_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SOLUTION_PLANNER_IO fill:transparent,stroke:transparent,color:#ffffff;

  linkStyle default stroke:#000000,stroke-width:2px;
```