```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 24, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB

  %% =====================================================
  %% TOPIC BRANCH — RESPONSE ROUTING VERSION
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
        previousSupportNeedState?<br/>
        previousSupportDomainState?<br/>
        }"]

        TOPIC_CONTEXT_INPUTS --> TOPIC_CONTEXT_OUTPUTS
      end

      TOPIC_CONTEXT_ROLE ~~~ TOPIC_CONTEXT_IO
    end

    %% =====================================================
    %% 2. SUPPORT NEED / DOMAIN RESOLUTION
    %% =====================================================

    T_NEED_RESOLUTION_INPUT["<b>Prepare supportNeedResolutionInput</b>"]

    subgraph NEED_RESOLUTION_DATA["supportNeedResolution = resolveSupportNeedAndDomain(input)"]
      direction TB

      NEED_RESOLUTION_ROLE["<b>Rôle :</b> déterminer si le besoin support et le domaine sont déjà assez clairs pour router la réponse."]

      subgraph NEED_RESOLUTION_IO[" "]
        direction LR

        NEED_RESOLUTION_INPUTS["<b>Input</b><br/>
        topicIdentity<br/>
        previousSupportNeedState?<br/>
        previousSupportDomainState?<br/>
        sourceUnderstandings<br/>
        recentInteractionContext"]

        NEED_RESOLUTION_OUTPUTS["<b>Output</b><br/>
        supportNeedResolution = {<br/>
        supportNeed: issue_resolution / knowledge_answer / support_action / feature_request / unclear<br/>
        supportDomain<br/>
        supportNeedIsClear<br/>
        supportDomainIsClear<br/>
        source: previous_state / newly_assessed<br/>
        }"]

        NEED_RESOLUTION_INPUTS --> NEED_RESOLUTION_OUTPUTS
      end

      NEED_RESOLUTION_ROLE ~~~ NEED_RESOLUTION_IO
    end

    R_NEED_RESOLUTION_FALLBACK["<b>Possible fallback return</b><br/>
    if assessSupportNeed.status = fallback"]

    T_CLARITY_GATE["<b>Check supportNeed + supportDomain clarity</b><br/>
    If one is unclear, do not continue into business branches."]

    %% =====================================================
    %% 3. CLARIFICATION ROUTE
    %% =====================================================

    subgraph CLARIFICATION_ROUTE["Clarification route — unclear need or domain"]
      direction TB

      T_CLARIFICATION_INPUT["<b>Prepare topicClarificationInput</b>"]

      subgraph CLARIFICATION_DATA["topicPlannerOutput = buildTopicClarificationPlan(input)"]
        direction TB

        CLARIFICATION_ROLE["<b>Rôle :</b> préparer une demande de clarification ciblée quand le besoin ou le domaine du topic n’est pas assez clair."]

        subgraph CLARIFICATION_IO[" "]
          direction LR

          CLARIFICATION_INPUTS["<b>Input</b><br/>
          supportNeedResolution<br/>
          sourceUnderstandings<br/>
          topicIdentity"]

          CLARIFICATION_OUTPUTS["<b>Output</b><br/>
          topicPlannerOutput = {<br/>
          route: clarify_topic<br/>
          missing: support_need / support_domain<br/>
          rendererTask<br/>
          }"]

          CLARIFICATION_INPUTS --> CLARIFICATION_OUTPUTS
        end

        CLARIFICATION_ROLE ~~~ CLARIFICATION_IO
      end

      T_CLARIFICATION_RETURN["<b>Return topic branch processed</b><br/>
      topicPlannerOutput = clarification plan"]
    end

    %% =====================================================
    %% 4. BUSINESS ROUTING
    %% =====================================================

    T_BUSINESS_ROUTE{"<b>Route by supportNeed</b><br/>
    issue_resolution<br/>
    knowledge_answer<br/>
    support_action<br/>
    feature_request"}

    %% =====================================================
    %% 5. FEATURE REQUEST BRANCH
    %% =====================================================

    subgraph FEATURE_BRANCH["Feature request branch"]
      direction TB

      T_FEATURE_QUALIFICATION_INPUT["<b>Prepare featureQualificationInput</b>"]

      subgraph FEATURE_QUALIFICATION_DATA["featureQualification = assessFeatureRequestReadiness(input)"]
        direction TB

        FEATURE_QUALIFICATION_ROLE["<b>Rôle :</b> vérifier si on comprend bien la feature demandée, le pourquoi et l’impact utilisateur."]

        subgraph FEATURE_QUALIFICATION_IO[" "]
          direction LR

          FEATURE_QUALIFICATION_INPUTS["<b>Input</b><br/>
          sourceUnderstandings<br/>
          extractedFields<br/>
          other<br/>
          previousLiveTopic?"]

          FEATURE_QUALIFICATION_OUTPUTS["<b>Output</b><br/>
          featureQualification = {<br/>
          requestedFeature?<br/>
          useCase?<br/>
          userImpact?<br/>
          missingFields[]<br/>
          isQualified<br/>
          }"]

          FEATURE_QUALIFICATION_INPUTS --> FEATURE_QUALIFICATION_OUTPUTS
        end

        FEATURE_QUALIFICATION_ROLE ~~~ FEATURE_QUALIFICATION_IO
      end

      T_FEATURE_PLANNER_INPUT["<b>Prepare featurePlannerInput</b>"]

      subgraph FEATURE_PLANNER_DATA["topicPlannerOutput = planFeatureRequestResponse(input)"]
        direction TB

        FEATURE_PLANNER_ROLE["<b>Rôle :</b> produire soit une question de qualification, soit un accusé de réception de feature request."]

        subgraph FEATURE_PLANNER_IO[" "]
          direction LR

          FEATURE_PLANNER_INPUTS["<b>Input</b><br/>
          featureQualification<br/>
          topicIdentity<br/>
          sourceUnderstandings"]

          FEATURE_PLANNER_OUTPUTS["<b>Output</b><br/>
          topicPlannerOutput = {<br/>
          route: feature_request<br/>
          action: ask_qualification / acknowledge<br/>
          rendererTask<br/>
          memoryIntent?<br/>
          }"]

          FEATURE_PLANNER_INPUTS --> FEATURE_PLANNER_OUTPUTS
        end

        FEATURE_PLANNER_ROLE ~~~ FEATURE_PLANNER_IO
      end
    end

    %% =====================================================
    %% 6. KNOWLEDGE ANSWER / FAQ BRANCH
    %% =====================================================

    subgraph KNOWLEDGE_BRANCH["Knowledge answer / FAQ branch"]
      direction TB

      T_KNOWLEDGE_QUALIFICATION_INPUT["<b>Prepare knowledgeQuestionReadinessInput</b>"]

      subgraph KNOWLEDGE_QUALIFICATION_DATA["knowledgeQuestionReadiness = assessKnowledgeQuestionReadiness(input)"]
        direction TB

        KNOWLEDGE_QUALIFICATION_ROLE["<b>Rôle :</b> vérifier si la question est assez claire pour chercher et répondre."]

        subgraph KNOWLEDGE_QUALIFICATION_IO[" "]
          direction LR

          KNOWLEDGE_QUALIFICATION_INPUTS["<b>Input</b><br/>
          sourceUnderstandings<br/>
          supportDomain<br/>
          extractedFields<br/>
          topicIdentity"]

          KNOWLEDGE_QUALIFICATION_OUTPUTS["<b>Output</b><br/>
          knowledgeQuestionReadiness = {<br/>
          question?<br/>
          missingFields[]<br/>
          isAnswerable<br/>
          }"]

          KNOWLEDGE_QUALIFICATION_INPUTS --> KNOWLEDGE_QUALIFICATION_OUTPUTS
        end

        KNOWLEDGE_QUALIFICATION_ROLE ~~~ KNOWLEDGE_QUALIFICATION_IO
      end

      T_KNOWLEDGE_RAG_INPUT["<b>Prepare knowledgeRagInput</b>"]

      subgraph KNOWLEDGE_RAG_DATA["knowledgeRagResult = searchKnowledgeAnswer(input)"]
        direction TB

        KNOWLEDGE_RAG_ROLE["<b>Rôle :</b> rechercher une réponse FAQ / knowledge claire dans la base de connaissance."]

        subgraph KNOWLEDGE_RAG_IO[" "]
          direction LR

          KNOWLEDGE_RAG_INPUTS["<b>Input</b><br/>
          knowledgeQuestionReadiness<br/>
          supportDomain<br/>
          topicIdentity"]

          KNOWLEDGE_RAG_OUTPUTS["<b>Output</b><br/>
          knowledgeRagResult = {<br/>
          status: found / not_found / fallback<br/>
          answerKnowledge?<br/>
          sourceReferences?<br/>
          }"]

          KNOWLEDGE_RAG_INPUTS --> KNOWLEDGE_RAG_OUTPUTS
        end

        KNOWLEDGE_RAG_ROLE ~~~ KNOWLEDGE_RAG_IO
      end

      R_KNOWLEDGE_RAG_FALLBACK["<b>Possible fallback return</b><br/>
      if knowledgeRagResult.status = fallback"]

      T_KNOWLEDGE_PLANNER_INPUT["<b>Prepare knowledgePlannerInput</b>"]

      subgraph KNOWLEDGE_PLANNER_DATA["topicPlannerOutput = planKnowledgeAnswerResponse(input)"]
        direction TB

        KNOWLEDGE_PLANNER_ROLE["<b>Rôle :</b> répondre si une connaissance est trouvée, sinon acknowledge / handoff léger."]

        subgraph KNOWLEDGE_PLANNER_IO[" "]
          direction LR

          KNOWLEDGE_PLANNER_INPUTS["<b>Input</b><br/>
          knowledgeQuestionReadiness<br/>
          knowledgeRagResult<br/>
          topicIdentity"]

          KNOWLEDGE_PLANNER_OUTPUTS["<b>Output</b><br/>
          topicPlannerOutput = {<br/>
          route: knowledge_answer<br/>
          action: answer / ask_clarification / acknowledge_not_found<br/>
          rendererTask<br/>
          }"]

          KNOWLEDGE_PLANNER_INPUTS --> KNOWLEDGE_PLANNER_OUTPUTS
        end

        KNOWLEDGE_PLANNER_ROLE ~~~ KNOWLEDGE_PLANNER_IO
      end
    end

    %% =====================================================
    %% 7. SUPPORT ACTION BRANCH
    %% =====================================================

    subgraph SUPPORT_ACTION_BRANCH["Support action branch"]
      direction TB

      T_ACTION_QUALIFICATION_INPUT["<b>Prepare supportActionQualificationInput</b>"]

      subgraph ACTION_QUALIFICATION_DATA["supportActionQualification = assessSupportActionReadiness(input)"]
        direction TB

        ACTION_QUALIFICATION_ROLE["<b>Rôle :</b> vérifier ce que l’utilisateur demande au support de faire, pourquoi, et quels champs sont nécessaires."]

        subgraph ACTION_QUALIFICATION_IO[" "]
          direction LR

          ACTION_QUALIFICATION_INPUTS["<b>Input</b><br/>
          sourceUnderstandings<br/>
          extractedFields<br/>
          supportDomain<br/>
          previousLiveTopic?"]

          ACTION_QUALIFICATION_OUTPUTS["<b>Output</b><br/>
          supportActionQualification = {<br/>
          requestedAction?<br/>
          reason?<br/>
          missingFields[]<br/>
          canBeHandledByBot<br/>
          requiresHuman<br/>
          }"]

          ACTION_QUALIFICATION_INPUTS --> ACTION_QUALIFICATION_OUTPUTS
        end

        ACTION_QUALIFICATION_ROLE ~~~ ACTION_QUALIFICATION_IO
      end

      T_ACTION_PLANNER_INPUT["<b>Prepare supportActionPlannerInput</b>"]

      subgraph ACTION_PLANNER_DATA["topicPlannerOutput = planSupportActionResponse(input)"]
        direction TB

        ACTION_PLANNER_ROLE["<b>Rôle :</b> demander les informations manquantes ou accuser réception pour transmission au support humain."]

        subgraph ACTION_PLANNER_IO[" "]
          direction LR

          ACTION_PLANNER_INPUTS["<b>Input</b><br/>
          supportActionQualification<br/>
          topicIdentity<br/>
          sourceUnderstandings"]

          ACTION_PLANNER_OUTPUTS["<b>Output</b><br/>
          topicPlannerOutput = {<br/>
          route: support_action<br/>
          action: ask_missing_info / acknowledge / handoff<br/>
          rendererTask<br/>
          }"]

          ACTION_PLANNER_INPUTS --> ACTION_PLANNER_OUTPUTS
        end

        ACTION_PLANNER_ROLE ~~~ ACTION_PLANNER_IO
      end
    end

    %% =====================================================
    %% 8. ISSUE RESOLUTION BRANCH
    %% =====================================================

    subgraph ISSUE_BRANCH["Issue resolution branch — detailed later"]
      direction TB

      T_ISSUE_STATE_INPUT["<b>Prepare issueStateInput</b>"]

      subgraph ISSUE_STATE_DATA["issueState = resolveIssueProgressState(input)"]
        direction TB

        ISSUE_STATE_ROLE["<b>Rôle :</b> déterminer où on en est dans la résolution du problème."]

        subgraph ISSUE_STATE_IO[" "]
          direction LR

          ISSUE_STATE_INPUTS["<b>Input</b><br/>
          previousLiveTopic?<br/>
          sourceUnderstandings<br/>
          extractedFields<br/>
          attemptedActions"]

          ISSUE_STATE_OUTPUTS["<b>Output</b><br/>
          issueState = {<br/>
          stage<br/>
          knownFields<br/>
          missingFields<br/>
          attemptedActions<br/>
          lastSuggestedSteps?<br/>
          }"]

          ISSUE_STATE_INPUTS --> ISSUE_STATE_OUTPUTS
        end

        ISSUE_STATE_ROLE ~~~ ISSUE_STATE_IO
      end

      T_ISSUE_PLANNER_INPUT["<b>Prepare issuePlannerInput</b>"]

      subgraph ISSUE_PLANNER_DATA["topicPlannerOutput = planIssueResolutionResponse(input)"]
        direction TB

        ISSUE_PLANNER_ROLE["<b>Rôle :</b> demander des informations, proposer une étape, exploiter la connaissance, ou préparer une escalade selon l’état de résolution."]

        subgraph ISSUE_PLANNER_IO[" "]
          direction LR

          ISSUE_PLANNER_INPUTS["<b>Input</b><br/>
          issueState<br/>
          topicIdentity<br/>
          sourceUnderstandings<br/>
          supportDomain"]

          ISSUE_PLANNER_OUTPUTS["<b>Output</b><br/>
          topicPlannerOutput = {<br/>
          route: issue_resolution<br/>
          action<br/>
          rendererTask<br/>
          nextIssueState?<br/>
          }"]

          ISSUE_PLANNER_INPUTS --> ISSUE_PLANNER_OUTPUTS
        end

        ISSUE_PLANNER_ROLE ~~~ ISSUE_PLANNER_IO
      end
    end

    %% =====================================================
    %% 9. RETURN
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
    TOPIC_CONTEXT_DATA --> T_NEED_RESOLUTION_INPUT

    T_NEED_RESOLUTION_INPUT --> NEED_RESOLUTION_DATA
    NEED_RESOLUTION_DATA --> R_NEED_RESOLUTION_FALLBACK
    R_NEED_RESOLUTION_FALLBACK -.-> T_CLARITY_GATE

    T_CLARITY_GATE -->|unclear need or domain| T_CLARIFICATION_INPUT
    T_CLARITY_GATE -->|clear need and domain| T_BUSINESS_ROUTE

    T_CLARIFICATION_INPUT --> CLARIFICATION_DATA
    CLARIFICATION_DATA --> T_CLARIFICATION_RETURN
    T_CLARIFICATION_RETURN --> T_TOPIC_BRANCH_RETURN

    T_BUSINESS_ROUTE -->|feature_request| T_FEATURE_QUALIFICATION_INPUT
    T_FEATURE_QUALIFICATION_INPUT --> FEATURE_QUALIFICATION_DATA
    FEATURE_QUALIFICATION_DATA --> T_FEATURE_PLANNER_INPUT
    T_FEATURE_PLANNER_INPUT --> FEATURE_PLANNER_DATA
    FEATURE_PLANNER_DATA --> T_TOPIC_BRANCH_RETURN

    T_BUSINESS_ROUTE -->|knowledge_answer| T_KNOWLEDGE_QUALIFICATION_INPUT
    T_KNOWLEDGE_QUALIFICATION_INPUT --> KNOWLEDGE_QUALIFICATION_DATA
    KNOWLEDGE_QUALIFICATION_DATA --> T_KNOWLEDGE_RAG_INPUT
    T_KNOWLEDGE_RAG_INPUT --> KNOWLEDGE_RAG_DATA
    KNOWLEDGE_RAG_DATA --> R_KNOWLEDGE_RAG_FALLBACK
    R_KNOWLEDGE_RAG_FALLBACK -.-> T_KNOWLEDGE_PLANNER_INPUT
    T_KNOWLEDGE_PLANNER_INPUT --> KNOWLEDGE_PLANNER_DATA
    KNOWLEDGE_PLANNER_DATA --> T_TOPIC_BRANCH_RETURN

    T_BUSINESS_ROUTE -->|support_action| T_ACTION_QUALIFICATION_INPUT
    T_ACTION_QUALIFICATION_INPUT --> ACTION_QUALIFICATION_DATA
    ACTION_QUALIFICATION_DATA --> T_ACTION_PLANNER_INPUT
    T_ACTION_PLANNER_INPUT --> ACTION_PLANNER_DATA
    ACTION_PLANNER_DATA --> T_TOPIC_BRANCH_RETURN

    T_BUSINESS_ROUTE -->|issue_resolution| T_ISSUE_STATE_INPUT
    T_ISSUE_STATE_INPUT --> ISSUE_STATE_DATA
    ISSUE_STATE_DATA --> T_ISSUE_PLANNER_INPUT
    T_ISSUE_PLANNER_INPUT --> ISSUE_PLANNER_DATA
    ISSUE_PLANNER_DATA --> T_TOPIC_BRANCH_RETURN

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

  class TOPIC_CONTEXT_INPUTS,NEED_RESOLUTION_INPUTS,CLARIFICATION_INPUTS,FEATURE_QUALIFICATION_INPUTS,FEATURE_PLANNER_INPUTS,KNOWLEDGE_QUALIFICATION_INPUTS,KNOWLEDGE_RAG_INPUTS,KNOWLEDGE_PLANNER_INPUTS,ACTION_QUALIFICATION_INPUTS,ACTION_PLANNER_INPUTS,ISSUE_STATE_INPUTS,ISSUE_PLANNER_INPUTS inputBlock;

  class TOPIC_CONTEXT_OUTPUTS,NEED_RESOLUTION_OUTPUTS,CLARIFICATION_OUTPUTS,FEATURE_QUALIFICATION_OUTPUTS,FEATURE_PLANNER_OUTPUTS,KNOWLEDGE_QUALIFICATION_OUTPUTS,KNOWLEDGE_RAG_OUTPUTS,KNOWLEDGE_PLANNER_OUTPUTS,ACTION_QUALIFICATION_OUTPUTS,ACTION_PLANNER_OUTPUTS,ISSUE_STATE_OUTPUTS,ISSUE_PLANNER_OUTPUTS outputBlock;

  class T_TOPIC_CONTEXT_INPUT,T_NEED_RESOLUTION_INPUT,T_CLARITY_GATE,T_CLARIFICATION_INPUT,T_CLARIFICATION_RETURN,T_BUSINESS_ROUTE,T_FEATURE_QUALIFICATION_INPUT,T_FEATURE_PLANNER_INPUT,T_KNOWLEDGE_QUALIFICATION_INPUT,T_KNOWLEDGE_RAG_INPUT,T_KNOWLEDGE_PLANNER_INPUT,T_ACTION_QUALIFICATION_INPUT,T_ACTION_PLANNER_INPUT,T_ISSUE_STATE_INPUT,T_ISSUE_PLANNER_INPUT,T_TOPIC_BRANCH_RETURN processingBlock;

  class R_NEED_RESOLUTION_FALLBACK,R_KNOWLEDGE_RAG_FALLBACK earlyReturnBlock;

  class TOPIC_CONTEXT_ROLE,NEED_RESOLUTION_ROLE,CLARIFICATION_ROLE,FEATURE_QUALIFICATION_ROLE,FEATURE_PLANNER_ROLE,KNOWLEDGE_QUALIFICATION_ROLE,KNOWLEDGE_RAG_ROLE,KNOWLEDGE_PLANNER_ROLE,ACTION_QUALIFICATION_ROLE,ACTION_PLANNER_ROLE,ISSUE_STATE_ROLE,ISSUE_PLANNER_ROLE roleBlock;

  style TOPIC_BRANCH fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;

  style TOPIC_CONTEXT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style NEED_RESOLUTION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style CLARIFICATION_ROUTE fill:#f5f5f5,stroke:#777777,stroke-width:1px,stroke-dasharray: 5 5,color:#000000;
  style CLARIFICATION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  style FEATURE_BRANCH fill:#f5f5f5,stroke:#777777,stroke-width:1px,stroke-dasharray: 5 5,color:#000000;
  style FEATURE_QUALIFICATION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style FEATURE_PLANNER_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  style KNOWLEDGE_BRANCH fill:#f5f5f5,stroke:#777777,stroke-width:1px,stroke-dasharray: 5 5,color:#000000;
  style KNOWLEDGE_QUALIFICATION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style KNOWLEDGE_RAG_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style KNOWLEDGE_PLANNER_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  style SUPPORT_ACTION_BRANCH fill:#f5f5f5,stroke:#777777,stroke-width:1px,stroke-dasharray: 5 5,color:#000000;
  style ACTION_QUALIFICATION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style ACTION_PLANNER_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  style ISSUE_BRANCH fill:#f5f5f5,stroke:#777777,stroke-width:1px,stroke-dasharray: 5 5,color:#000000;
  style ISSUE_STATE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style ISSUE_PLANNER_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  style TOPIC_CONTEXT_IO fill:transparent,stroke:transparent,color:#ffffff;
  style NEED_RESOLUTION_IO fill:transparent,stroke:transparent,color:#ffffff;
  style CLARIFICATION_IO fill:transparent,stroke:transparent,color:#ffffff;
  style FEATURE_QUALIFICATION_IO fill:transparent,stroke:transparent,color:#ffffff;
  style FEATURE_PLANNER_IO fill:transparent,stroke:transparent,color:#ffffff;
  style KNOWLEDGE_QUALIFICATION_IO fill:transparent,stroke:transparent,color:#ffffff;
  style KNOWLEDGE_RAG_IO fill:transparent,stroke:transparent,color:#ffffff;
  style KNOWLEDGE_PLANNER_IO fill:transparent,stroke:transparent,color:#ffffff;
  style ACTION_QUALIFICATION_IO fill:transparent,stroke:transparent,color:#ffffff;
  style ACTION_PLANNER_IO fill:transparent,stroke:transparent,color:#ffffff;
  style ISSUE_STATE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style ISSUE_PLANNER_IO fill:transparent,stroke:transparent,color:#ffffff;

  linkStyle default stroke:#000000,stroke-width:2px;
  ```