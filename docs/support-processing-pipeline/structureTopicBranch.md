```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 24, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB

  %% =====================================================
  %% TOPIC BRANCH
  %% =====================================================

  subgraph TOPIC_BRANCH["topicBranchResult = runTopicBranch(topicBranchInput)"]
    direction TB

    %% =====================================================
    %% INPUT
    %% =====================================================

    TOPIC_BRANCH_INPUT["<b>Input provided to runTopicBranch</b><br/>
    input<br/>
    topicUpdatePlan<br/>
    supportUnderstandings<br/>
    recentInteractionContext"]

    %% =====================================================
    %% 1. TOPIC CONTEXT
    %% =====================================================

    T_TOPIC_CONTEXT_INPUT["<b>Prepare topic branch context</b>"]

    subgraph TOPIC_CONTEXT_DATA["topicBranchContext = resolveTopicBranchContext(input)"]
      direction TB

      TOPIC_CONTEXT_ROLE["<b>Rôle :</b> isoler les données utiles à ce topic uniquement, sans muter la live memory."]

      subgraph TOPIC_CONTEXT_IO[" "]
        direction LR

        TOPIC_CONTEXT_INPUTS["<b>Input</b><br/>
        topicUpdatePlan<br/>
        supportUnderstandings<br/>
        liveMemory"]

        TOPIC_CONTEXT_OUTPUTS["<b>Output</b><br/>
        topicBranchContext = {<br/>
        previousLiveTopic<br/>
        sourceUnderstandings<br/>
        topicIdentity<br/>
        }"]

        TOPIC_CONTEXT_INPUTS --> TOPIC_CONTEXT_OUTPUTS
      end

      TOPIC_CONTEXT_ROLE ~~~ TOPIC_CONTEXT_IO
    end

    %% =====================================================
    %% 2. ASSESS SUPPORT NEED
    %% =====================================================

    T_SUPPORT_NEED_INPUT["<b>Prepare assessSupportNeedInput</b>"]

    subgraph SUPPORT_NEED_DATA["topicBranchOutput.assessSupportNeedOutput = runAssessSupportNeed(input)"]
      direction TB

      SUPPORT_NEED_ROLE["<b>Rôle :</b> déterminer le besoin support global du topic après intégration des nouveaux understandings."]

      subgraph SUPPORT_NEED_IO[" "]
        direction LR

        SUPPORT_NEED_INPUTS["<b>Input</b><br/>
        topicIdentity<br/>
        previousSupportNeedAssessment?<br/>
        previousSupportKnowledgeSummary?<br/>
        sourceUnderstandings<br/>
        recentInteractionContext"]

        SUPPORT_NEED_OUTPUTS["<b>Output</b><br/>
        assessSupportNeedOutput = {<br/>
        status: analyzed / fallback<br/>
        fallbackReason?<br/>
        supportNeedAssessment?<br/>
        }"]

        SUPPORT_NEED_INPUTS --> SUPPORT_NEED_OUTPUTS
      end

      SUPPORT_NEED_ROLE ~~~ SUPPORT_NEED_IO
    end

    R_SUPPORT_NEED_FALLBACK["<b>Possible fallback return</b><br/>
    if assessSupportNeedOutput.status = fallback"]

    %% =====================================================
    %% 3. READINESS
    %% =====================================================

    T_READINESS_INPUT["<b>Prepare assessTopicReadinessInput</b>"]

    subgraph READINESS_DATA["topicBranchOutput.assessTopicReadinessOutput = assessTopicReadiness(input)"]
      direction TB

      READINESS_ROLE["<b>Rôle :</b> inspecter déterministiquement si le topic contient assez de matière pour qualification / recherche / réponse."]

      subgraph READINESS_IO[" "]
        direction LR

        READINESS_INPUTS["<b>Input</b><br/>
        supportNeedAssessment<br/>
        supportDomain<br/>
        sourceUnderstandings<br/>
        previousSupportKnowledgeSummary?"]

        READINESS_OUTPUTS["<b>Output</b><br/>
        assessTopicReadinessOutput = {<br/>
        hasMaterialFields<br/>
        hasSearchableDetails<br/>
        hasAttemptedActions<br/>
        hasPreviousKnowledge<br/>
        reasonCodes[]<br/>
        }"]

        READINESS_INPUTS --> READINESS_OUTPUTS
      end

      READINESS_ROLE ~~~ READINESS_IO
    end

    %% =====================================================
    %% 4. ROUTING
    %% =====================================================

    T_ROUTING_INPUT["<b>Prepare deriveSupportRoutingInput</b>"]

    subgraph ROUTING_DATA["topicBranchOutput.deriveSupportRoutingOutput = deriveSupportRouting(input)"]
      direction TB

      ROUTING_ROLE["<b>Rôle :</b> décider déterministiquement quelles branches de connaissance lancer pour ce topic."]

      subgraph ROUTING_IO[" "]
        direction LR

        ROUTING_INPUTS["<b>Input</b><br/>
        supportNeedAssessment<br/>
        assessTopicReadinessOutput<br/>
        supportDomain"]

        ROUTING_OUTPUTS["<b>Output</b><br/>
        deriveSupportRoutingOutput = {<br/>
        catalogueRouting<br/>
        similarTopicSearchRouting<br/>
        }"]

        ROUTING_INPUTS --> ROUTING_OUTPUTS
      end

      ROUTING_ROLE ~~~ ROUTING_IO
    end

    %% =====================================================
    %% 5. KNOWLEDGE BRANCHES
    %% =====================================================

    T_KNOWLEDGE_ROUTE{"<b>Knowledge branches</b><br/>
    qualification always runs<br/>
    similarity/RAG runs only if routing.shouldSearch"}

    T_QUALIFICATION_INPUT["<b>Prepare qualificationOrienterInput</b>"]

    subgraph QUALIFICATION_DATA["topicBranchOutput.qualificationOrienterOutput = runQualificationOrienter(input)"]
      direction TB

      QUALIFICATION_ROLE["<b>Rôle :</b> sélectionner les champs, questions ou éléments de qualification utiles pour ce topic."]

      subgraph QUALIFICATION_IO[" "]
        direction LR

        QUALIFICATION_INPUTS["<b>Input</b><br/>
        topicUpdatePlan<br/>
        topicIdentity<br/>
        sourceUnderstandings<br/>
        supportNeedAssessment<br/>
        assessTopicReadinessOutput<br/>
        deriveSupportRoutingOutput"]

        QUALIFICATION_OUTPUTS["<b>Output</b><br/>
        qualificationOrienterOutput = {<br/>
        status: processed / fallback<br/>
        fallbackReason?<br/>
        qualificationPlan?<br/>
        }"]

        QUALIFICATION_INPUTS --> QUALIFICATION_OUTPUTS
      end

      QUALIFICATION_ROLE ~~~ QUALIFICATION_IO
    end

    R_QUALIFICATION_FALLBACK["<b>Possible fallback return</b><br/>
    if qualificationOrienterOutput.status = fallback"]

    subgraph SIMILARITY_RAG_BRANCH["Optional similarity / RAG branch"]
      direction TB

      T_SEARCH_INPUT["<b>Prepare searchSimilarityInput</b>"]

      subgraph SEARCH_DATA["topicBranchOutput.searchSimilarityOutput = runSearchSimilarity(input)"]
        direction TB

        SEARCH_ROLE["<b>Rôle :</b> rechercher des connaissances ou anciens cas similaires utiles pour ce topic uniquement."]

        subgraph SEARCH_IO[" "]
          direction LR

          SEARCH_INPUTS["<b>Input</b><br/>
          topicUpdatePlan<br/>
          topicIdentity<br/>
          sourceUnderstandings<br/>
          liveMemory<br/>
          deriveSupportRoutingOutput"]

          SEARCH_OUTPUTS["<b>Output</b><br/>
          searchSimilarityOutput = {<br/>
          status: processed / fallback<br/>
          fallbackReason?<br/>
          chunks?<br/>
          matches?<br/>
          }"]

          SEARCH_INPUTS --> SEARCH_OUTPUTS
        end

        SEARCH_ROLE ~~~ SEARCH_IO
      end

      R_SEARCH_FALLBACK["<b>Possible fallback return</b><br/>
      if searchSimilarityOutput.status = fallback"]

      T_SYNTHESIS_INPUT["<b>Prepare synthesizeRagInput</b>"]

      subgraph SYNTHESIS_DATA["topicBranchOutput.synthesizeRagOutput = runSynthesizeRag(input)"]
        direction TB

        SYNTHESIS_ROLE["<b>Rôle :</b> synthétiser les résultats de similarité / RAG pour les rendre exploitables par le planner topic."]

        subgraph SYNTHESIS_IO[" "]
          direction LR

          SYNTHESIS_INPUTS["<b>Input</b><br/>
          topicUpdatePlan<br/>
          topicIdentity<br/>
          sourceUnderstandings<br/>
          searchSimilarityOutput"]

          SYNTHESIS_OUTPUTS["<b>Output</b><br/>
          synthesizeRagOutput = {<br/>
          status: processed / fallback<br/>
          fallbackReason?<br/>
          synthesizedKnowledge?<br/>
          }"]

          SYNTHESIS_INPUTS --> SYNTHESIS_OUTPUTS
        end

        SYNTHESIS_ROLE ~~~ SYNTHESIS_IO
      end

      R_SYNTHESIS_FALLBACK["<b>Possible fallback return</b><br/>
      if synthesizeRagOutput.status = fallback"]
    end

    T_KNOWLEDGE_WAIT["<b>Continue after knowledge branches</b><br/>
    qualification output always present<br/>
    search/synthesis outputs may be null"]

    %% =====================================================
    %% 6. TOPIC PLANNER
    %% =====================================================

    T_TOPIC_PLANNER_INPUT["<b>Prepare topicPlannerInput</b>"]

    subgraph TOPIC_PLANNER_DATA["topicBranchOutput.topicPlannerOutput = runTopicPlanner(input)"]
      direction TB

      TOPIC_PLANNER_ROLE["<b>Rôle :</b> décider quoi répondre ou demander pour ce topic uniquement."]

      subgraph TOPIC_PLANNER_IO[" "]
        direction LR

        TOPIC_PLANNER_INPUTS["<b>Input</b><br/>
        topicUpdatePlan<br/>
        topicIdentity<br/>
        sourceUnderstandings<br/>
        assessSupportNeedOutput<br/>
        assessTopicReadinessOutput<br/>
        deriveSupportRoutingOutput<br/>
        qualificationOrienterOutput<br/>
        searchSimilarityOutput?<br/>
        synthesizeRagOutput?"]

        TOPIC_PLANNER_OUTPUTS["<b>Output</b><br/>
        topicPlannerOutput = {<br/>
        status: processed / fallback<br/>
        fallbackReason?<br/>
        topicResponsePlan?<br/>
        }"]

        TOPIC_PLANNER_INPUTS --> TOPIC_PLANNER_OUTPUTS
      end

      TOPIC_PLANNER_ROLE ~~~ TOPIC_PLANNER_IO
    end

    R_TOPIC_PLANNER_FALLBACK["<b>Possible fallback return</b><br/>
    if topicPlannerOutput.status = fallback"]

    %% =====================================================
    %% RETURN
    %% =====================================================

    T_TOPIC_BRANCH_RETURN["<b>Return topicBranchResult</b><br/>
    status = processed / fallback<br/>
    topicPlannerOutput?<br/>
    topicBranchOutput<br/>
    fallbackReason?"]

    %% =====================================================
    %% LINKS
    %% =====================================================

    TOPIC_BRANCH_INPUT --> T_TOPIC_CONTEXT_INPUT
    T_TOPIC_CONTEXT_INPUT --> TOPIC_CONTEXT_DATA
    TOPIC_CONTEXT_DATA --> T_SUPPORT_NEED_INPUT

    T_SUPPORT_NEED_INPUT --> SUPPORT_NEED_DATA
    SUPPORT_NEED_DATA --> R_SUPPORT_NEED_FALLBACK
    R_SUPPORT_NEED_FALLBACK -.-> T_READINESS_INPUT

    T_READINESS_INPUT --> READINESS_DATA
    READINESS_DATA --> T_ROUTING_INPUT

    T_ROUTING_INPUT --> ROUTING_DATA
    ROUTING_DATA --> T_KNOWLEDGE_ROUTE

    T_KNOWLEDGE_ROUTE --> T_QUALIFICATION_INPUT
    T_KNOWLEDGE_ROUTE -.->|if shouldSearchSimilarity| T_SEARCH_INPUT

    T_QUALIFICATION_INPUT --> QUALIFICATION_DATA
    QUALIFICATION_DATA --> R_QUALIFICATION_FALLBACK
    R_QUALIFICATION_FALLBACK -.-> T_KNOWLEDGE_WAIT

    T_SEARCH_INPUT --> SEARCH_DATA
    SEARCH_DATA --> R_SEARCH_FALLBACK
    R_SEARCH_FALLBACK -.-> T_SYNTHESIS_INPUT

    T_SYNTHESIS_INPUT --> SYNTHESIS_DATA
    SYNTHESIS_DATA --> R_SYNTHESIS_FALLBACK
    R_SYNTHESIS_FALLBACK -.-> T_KNOWLEDGE_WAIT

    T_KNOWLEDGE_WAIT --> T_TOPIC_PLANNER_INPUT

    T_TOPIC_PLANNER_INPUT --> TOPIC_PLANNER_DATA
    TOPIC_PLANNER_DATA --> R_TOPIC_PLANNER_FALLBACK
    R_TOPIC_PLANNER_FALLBACK -.-> T_TOPIC_BRANCH_RETURN

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

  class TOPIC_BRANCH_INPUT inputBlock;

  class TOPIC_CONTEXT_INPUTS,SUPPORT_NEED_INPUTS,READINESS_INPUTS,ROUTING_INPUTS,QUALIFICATION_INPUTS,SEARCH_INPUTS,SYNTHESIS_INPUTS,TOPIC_PLANNER_INPUTS inputBlock;

  class TOPIC_CONTEXT_OUTPUTS,SUPPORT_NEED_OUTPUTS,READINESS_OUTPUTS,ROUTING_OUTPUTS,QUALIFICATION_OUTPUTS,SEARCH_OUTPUTS,SYNTHESIS_OUTPUTS,TOPIC_PLANNER_OUTPUTS outputBlock;

  class T_TOPIC_CONTEXT_INPUT,T_SUPPORT_NEED_INPUT,T_READINESS_INPUT,T_ROUTING_INPUT,T_QUALIFICATION_INPUT,T_SEARCH_INPUT,T_SYNTHESIS_INPUT,T_KNOWLEDGE_WAIT,T_TOPIC_PLANNER_INPUT,T_TOPIC_BRANCH_RETURN processingBlock;

  class T_KNOWLEDGE_ROUTE decisionBlock;

  class R_SUPPORT_NEED_FALLBACK,R_QUALIFICATION_FALLBACK,R_SEARCH_FALLBACK,R_SYNTHESIS_FALLBACK,R_TOPIC_PLANNER_FALLBACK earlyReturnBlock;

  class TOPIC_CONTEXT_ROLE,SUPPORT_NEED_ROLE,READINESS_ROLE,ROUTING_ROLE,QUALIFICATION_ROLE,SEARCH_ROLE,SYNTHESIS_ROLE,TOPIC_PLANNER_ROLE roleBlock;

  style TOPIC_BRANCH fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style TOPIC_CONTEXT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SUPPORT_NEED_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style READINESS_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style ROUTING_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style QUALIFICATION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SIMILARITY_RAG_BRANCH fill:#f5f5f5,stroke:#777777,stroke-width:1px,stroke-dasharray: 5 5,color:#000000;
  style SEARCH_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SYNTHESIS_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TOPIC_PLANNER_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  style TOPIC_CONTEXT_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SUPPORT_NEED_IO fill:transparent,stroke:transparent,color:#ffffff;
  style READINESS_IO fill:transparent,stroke:transparent,color:#ffffff;
  style ROUTING_IO fill:transparent,stroke:transparent,color:#ffffff;
  style QUALIFICATION_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SEARCH_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SYNTHESIS_IO fill:transparent,stroke:transparent,color:#ffffff;
  style TOPIC_PLANNER_IO fill:transparent,stroke:transparent,color:#ffffff;

  linkStyle default stroke:#000000,stroke-width:2px;
  ```