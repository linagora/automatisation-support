```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 22, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB
  %% =====================================================
  %% PREVIOUS STEP
  %% =====================================================

  subgraph PREVIOUS_STEP["Previous step"]
    direction TB

    PREVIOUS_INPUTS["<b>Inputs provided to runSupportProcessingPipelineV2</b><br/>
    1. latestUserMessage, 2. latestUserAttachments, 3.1 accountTrustStatus,<br/>
    3.2 accountProfile, 3.3 accountInteractionTraits,<br/>
    4. supportTopicKnowledge, 5. conversationHistory,<br/>
    6. recentInteractionContext"]
  end

  %% =====================================================
  %% SUPPORT PROCESSING PIPELINE V2
  %% =====================================================

  subgraph PIPELINE["{ userResponse, patches } = runSupportProcessingPipelineV2(inputSupportProcessingPipeline)"]
    direction TB

    %% =====================================================
    %% 1. PREFLIGHT AND TURN PLAN
    %% =====================================================

    T_RESPONSE_ACCUMULATOR_INIT["<b>responseAccumulator = initializeResponseAccumulator()</b><br/>
    responseAccumulator = {<br/>
    standardResponseFragments: []<br/>
    supportResponse: undefined<br/>
    }"]

    T_PROMPT_SECURITY_INPUT["<b>Prepare promptSecurityInput</b>"]

    subgraph PROMPT_SECURITY_DATA["promptSecuritySignals = detectSuspiciousPromptPatterns(promptSecurityInput)"]
      direction TB

      PROMPT_SECURITY_ROLE["<b>Rôle :</b> détecter les formulations potentiellement suspectes dans le dernier message utilisateur."]

      subgraph PROMPT_SECURITY_IO[" "]
        direction LR

        PROMPT_SECURITY_INPUTS["<b>Input</b><br/>
        latestUserMessage"]

        PROMPT_SECURITY_OUTPUTS["<b>Output</b><br/>
        promptSecuritySignals = {<br/>
        matchedPatternIds<br/>
        }"]

        PROMPT_SECURITY_INPUTS --> PROMPT_SECURITY_OUTPUTS
      end

      PROMPT_SECURITY_ROLE ~~~ PROMPT_SECURITY_IO
    end

    T_TURN_PLAN_INPUT["<b>Prepare turnAnalysisPlanInput</b>"]

    subgraph TURN_PLAN_DATA["turnAnalysisPlan = planTurnAnalysis(turnAnalysisPlanInput)"]
      direction TB

      TURN_PLAN_ROLE["<b>Rôle :</b> décider quels chemins d’analyse lancer selon les signaux de sécurité, le trust et les contenus disponibles."]

      subgraph TURN_PLAN_IO[" "]
        direction LR

        TURN_PLAN_INPUTS["<b>Input</b><br/>
        latestUserMessage<br/>
        latestUserAttachments<br/>
        promptSecuritySignals<br/>
        accountTrustStatus"]

        TURN_PLAN_OUTPUTS["<b>Output</b><br/>
        turnAnalysisPlan = {<br/>
        analyzeText<br/>
        analyzeAttachments<br/>
        matchedPatternIds<br/>
        }"]

        TURN_PLAN_INPUTS --> TURN_PLAN_OUTPUTS
      end

      TURN_PLAN_ROLE ~~~ TURN_PLAN_IO
    end

    T_ANALYZE_TURN{"<b>Analyze turn?</b><br/>
    turnAnalysisPlan.analyzeText<br/>
    OR analyzeAttachments"}

    %% =====================================================
    %% 2. PHASE 1 - SURFACE ANALYSIS
    %% =====================================================

    T_SURFACE_START["<b>parallelSurfacePromises = startEnabledSurfacePaths(turnAnalysisPlan)</b><br/>
    Text surface path runs text surface analysis only.<br/>
    Attachment surface path runs pre-router only.<br/>
    Disabled paths resolve to empty results."]

    T_TEXT_SURFACE_INPUT["<b>Prepare textSurfaceInput</b>"]

    subgraph TEXT_SURFACE_DATA["textSurfaceAnalysis = analyzeTextSurface(textSurfaceInput)"]
      direction TB

      TEXT_SURFACE_ROLE["<b>Rôle :</b> segmenter et catégoriser rapidement le message utilisateur."]

      subgraph TEXT_SURFACE_IO[" "]
        direction LR

        TEXT_SURFACE_INPUTS["<b>Input</b><br/>
        latestUserMessage<br/>
        turnAnalysisPlan"]

        TEXT_SURFACE_OUTPUTS["<b>Output</b><br/>
        textSurfaceAnalysis = {<br/>
        userLanguage<br/>
        segments[] = [{<br/>
        segmentId<br/>
        verbatim<br/>
        category<br/>
        standardSubcategory?<br/>
        }]<br/>
        }"]

        TEXT_SURFACE_INPUTS --> TEXT_SURFACE_OUTPUTS
      end

      TEXT_SURFACE_ROLE ~~~ TEXT_SURFACE_IO
    end

    T_ATTACHMENT_SURFACE_INPUT["<b>Prepare attachmentSurfaceInput</b>"]

    subgraph ATTACHMENT_SURFACE_DATA["attachmentSurfaceAnalysis = analyzeAttachmentSurface(attachmentSurfaceInput)"]
      direction TB

      ATTACHMENT_SURFACE_ROLE["<b>Rôle :</b> déterminer quels attachments doivent être ignorés, traités de façon standard ou analysés profondément."]

      subgraph ATTACHMENT_SURFACE_IO[" "]
        direction LR

        ATTACHMENT_SURFACE_INPUTS["<b>Input</b><br/>
        latestUserMessage<br/>
        latestUserAttachments<br/>
        turnAnalysisPlan"]

        ATTACHMENT_SURFACE_OUTPUTS["<b>Output</b><br/>
        attachmentSurfaceAnalysis[] = [{<br/>
        attachmentIndex<br/>
        category<br/>
        standardSubcategory?<br/>
        shouldRunDeepAnalysis<br/>
        reason?<br/>
        }]"]

        ATTACHMENT_SURFACE_INPUTS --> ATTACHMENT_SURFACE_OUTPUTS
      end

      ATTACHMENT_SURFACE_ROLE ~~~ ATTACHMENT_SURFACE_IO
    end

    T_WAIT_SURFACE["<b>Wait for enabled surface paths</b><br/>
    Await textSurfaceAnalysis and attachmentSurfaceAnalysis.<br/>
    Disabled paths already resolved as empty results."]

    %% =====================================================
    %% 3. STANDARD HANDLERS
    %% =====================================================

    T_STANDARD_INPUT["<b>Prepare standardHandlerInput</b>"]

    subgraph STANDARD_HANDLER_DATA["standardResponseFragments = buildStandardResponseFragments(standardHandlerInput)"]
      direction TB

      STANDARD_ROLE["<b>Rôle :</b> produire les fragments de réponse déterministes correspondant aux cas standards."]

      subgraph STANDARD_IO[" "]
        direction LR

        STANDARD_INPUTS["<b>Input</b><br/>
        turnAnalysisPlan<br/>
        textSurfaceAnalysis?<br/>
        attachmentSurfaceAnalysis?"]

        STANDARD_OUTPUTS["<b>Output</b><br/>
        standardResponseFragments[] = [{<br/>
        category<br/>
        standardSubcategory?<br/>
        content<br/>
        }]"]

        STANDARD_INPUTS --> STANDARD_OUTPUTS
      end

      STANDARD_ROLE ~~~ STANDARD_IO
    end

    T_APPEND_STANDARD_FRAGMENTS["<b>Append standard fragments to responseAccumulator</b><br/>
    responseAccumulator.standardResponseFragments<br/>
    += standardResponseFragments"]

    T_DEEP_ANALYSIS_CHECK{"<b>Deep analysis needed?</b><br/>
    from textSurfaceAnalysis<br/>
    and attachmentSurfaceAnalysis"}

    %% =====================================================
    %% 4. PHASE 2 - DEEP ANALYSIS
    %% =====================================================

    T_DEEP_START["<b>deepAnalysisPromises = startEnabledDeepAnalysisPaths(textSurfaceAnalysis, attachmentSurfaceAnalysis)</b><br/>
    Text deep path runs support text analysis.<br/>
    Attachment deep path runs full attachment analysis.<br/>
    Disabled deep paths resolve to empty results."]

    T_SUPPORT_TEXT_INPUT["<b>Prepare supportTextInput</b>"]

    subgraph SUPPORT_TEXT_DATA["textUnderstandings = analyzeSupportText(supportTextInput)"]
      direction TB

      SUPPORT_TEXT_ROLE["<b>Rôle :</b> comprendre les segments support et en extraire les besoins, champs et faits utiles."]

      subgraph SUPPORT_TEXT_IO[" "]
        direction LR

        SUPPORT_TEXT_INPUTS["<b>Input</b><br/>
        turnAnalysisPlan<br/>
        textSurfaceAnalysis<br/>
        recentInteractionContext<br/>
        extractableFieldCatalog"]

        SUPPORT_TEXT_OUTPUTS["<b>Output</b><br/>
        textUnderstandings[] = [{<br/>
        segmentId<br/>
        summary<br/>
        explicitUserRequest?<br/>
        supportNeed?<br/>
        extractedFields?<br/>
        candidateFacts?<br/>
        uncertainties?<br/>
        }]"]

        SUPPORT_TEXT_INPUTS --> SUPPORT_TEXT_OUTPUTS
      end

      SUPPORT_TEXT_ROLE ~~~ SUPPORT_TEXT_IO
    end

    T_SUPPORT_ATTACHMENT_INPUT["<b>Prepare supportAttachmentInput</b>"]

    subgraph SUPPORT_ATTACHMENT_DATA["attachmentUnderstandings = analyzeSupportAttachments(supportAttachmentInput)"]
      direction TB

      SUPPORT_ATTACHMENT_ROLE["<b>Rôle :</b> extraire des attachments sélectionnés les faits, champs et limitations utiles."]

      subgraph SUPPORT_ATTACHMENT_IO[" "]
        direction LR

        SUPPORT_ATTACHMENT_INPUTS["<b>Input</b><br/>
        turnAnalysisPlan<br/>
        attachmentSurfaceAnalysis<br/>
        latestUserAttachments<br/>
        latestUserMessage<br/>
        recentInteractionContext<br/>
        extractableFieldCatalog"]

        SUPPORT_ATTACHMENT_OUTPUTS["<b>Output</b><br/>
        attachmentUnderstandings[] = [{<br/>
        attachmentIndex<br/>
        status: analyzed / failed<br/>
        summary?<br/>
        extractedFields?<br/>
        candidateFacts?<br/>
        limitations?<br/>
        }]"]

        SUPPORT_ATTACHMENT_INPUTS --> SUPPORT_ATTACHMENT_OUTPUTS
      end

      SUPPORT_ATTACHMENT_ROLE ~~~ SUPPORT_ATTACHMENT_IO
    end

    T_WAIT_DEEP_RESULTS["<b>Wait for deep analysis results</b><br/>
    Await textUnderstandings and attachmentUnderstandings.<br/>
    Disabled deep paths already resolved as empty results."]

    %% =====================================================
    %% 5. TOPIC UPDATE PROPOSAL
    %% =====================================================

    T_TOPIC_UPDATE_INPUT["<b>Prepare topicUpdateInput</b>"]

    subgraph TOPIC_UPDATE_DATA["topicUpdateProposal = proposeTopicUpdates(topicUpdateInput)"]
      direction TB

      TOPIC_UPDATE_ROLE["<b>Rôle :</b> proposer comment créer, rattacher, mettre à jour, fusionner ou différer les topics."]

      subgraph TOPIC_UPDATE_IO[" "]
        direction LR

        TOPIC_UPDATE_INPUTS["<b>Input</b><br/>
        textUnderstandings<br/>
        attachmentUnderstandings<br/>
        supportTopicKnowledge<br/>
        conversationHistory"]

        TOPIC_UPDATE_OUTPUTS["<b>Output</b><br/>
        topicUpdateProposal = {<br/>
        topicUpdates[] = [{<br/>
        action: create / attach / update / merge / defer<br/>
        targetTopicIds?<br/>
        sourceSegmentIds?<br/>
        sourceAttachmentIndexes?<br/>
        proposedChanges?<br/>
        }]<br/>
        deferredItems?<br/>
        }"]

        TOPIC_UPDATE_INPUTS --> TOPIC_UPDATE_OUTPUTS
      end

      TOPIC_UPDATE_ROLE ~~~ TOPIC_UPDATE_IO
    end

    %% =====================================================
    %% 6. SUPPORT UNDERSTANDING ASSEMBLY
    %% =====================================================

    T_UNDERSTANDING_INPUT["<b>Prepare supportUnderstandingInput</b>"]

    subgraph UNDERSTANDING_DATA["supportUnderstanding = applyTopicUpdates(supportUnderstandingInput)"]
      direction TB

      UNDERSTANDING_ROLE["<b>Rôle :</b> appliquer déterministiquement les propositions et produire la compréhension consolidée du support."]

      subgraph UNDERSTANDING_IO[" "]
        direction LR

        UNDERSTANDING_INPUTS["<b>Input</b><br/>
        supportTopicKnowledge<br/>
        topicUpdateProposal<br/>
        textUnderstandings<br/>
        attachmentUnderstandings"]

        UNDERSTANDING_OUTPUTS["<b>Output</b><br/>
        supportUnderstanding = {<br/>
        topics<br/>
        unresolvedItems<br/>
        appliedTopicUpdates<br/>
        }"]

        UNDERSTANDING_INPUTS --> UNDERSTANDING_OUTPUTS
      end

      UNDERSTANDING_ROLE ~~~ UNDERSTANDING_IO
    end

    %% =====================================================
    %% 7. KNOWLEDGE ENRICHMENT PLAN
    %% =====================================================

    T_KNOWLEDGE_ENRICHMENT_INPUT["<b>Prepare knowledgeEnrichmentInput</b>"]

    subgraph KNOWLEDGE_ENRICHMENT_DATA["knowledgeEnrichmentPlan = planKnowledgeEnrichment(knowledgeEnrichmentInput)"]
      direction TB

      KNOWLEDGE_ENRICHMENT_ROLE["<b>Rôle :</b> déterminer si un enrichissement externe est utile et préparer les recherches par topic."]

      subgraph KNOWLEDGE_ENRICHMENT_IO[" "]
        direction LR

        KNOWLEDGE_ENRICHMENT_INPUTS["<b>Input</b><br/>
        supportUnderstanding<br/>
        supportTopicKnowledge"]

        KNOWLEDGE_ENRICHMENT_OUTPUTS["<b>Output</b><br/>
        knowledgeEnrichmentPlan = {<br/>
        route: retrieve_knowledge / use_generic_fields<br/>
        retrievalRequests?[] = [{<br/>
        topicId<br/>
        query<br/>
        filters?<br/>
        }]<br/>
        }"]

        KNOWLEDGE_ENRICHMENT_INPUTS --> KNOWLEDGE_ENRICHMENT_OUTPUTS
      end

      KNOWLEDGE_ENRICHMENT_ROLE ~~~ KNOWLEDGE_ENRICHMENT_IO
    end

    T_RAG_ROUTE{"<b>Retrieve external knowledge?</b><br/>
    knowledgeEnrichmentPlan.route === retrieve_knowledge"}

    T_GENERIC_FIELD_KNOWLEDGE["<b>genericFieldKnowledge = getGenericFieldKnowledge()</b><br/>
    Minimal knowledge base when no RAG result is used."]

    T_RAG_INPUT["<b>Prepare ragInput</b>"]

    subgraph RAG_DATA["knowledgeChunks = retrieveSupportKnowledge(ragInput)"]
      direction TB

      RAG_ROLE["<b>Rôle :</b> récupérer les extraits documentaires pertinents pour les recherches préparées."]

      subgraph RAG_IO[" "]
        direction LR

        RAG_INPUTS["<b>Input</b><br/>
        knowledgeEnrichmentPlan"]

        RAG_OUTPUTS["<b>Output</b><br/>
        knowledgeChunks[] = [{<br/>
        topicId<br/>
        sourceId<br/>
        content<br/>
        score<br/>
        metadata?<br/>
        }]"]

        RAG_INPUTS --> RAG_OUTPUTS
      end

      RAG_ROLE ~~~ RAG_IO
    end

    %% =====================================================
    %% 8. RETRIEVED KNOWLEDGE SYNTHESIS
    %% =====================================================

    T_RETRIEVED_KNOWLEDGE_SYNTHESIS_INPUT["<b>Prepare retrievedKnowledgeSynthesisInput</b>"]

    subgraph RETRIEVED_KNOWLEDGE_SYNTHESIS_DATA["retrievedKnowledgeSynthesis = synthesizeRetrievedKnowledge(retrievedKnowledgeSynthesisInput)"]
      direction TB

      RETRIEVED_KNOWLEDGE_SYNTHESIS_ROLE["<b>Rôle :</b> filtrer et structurer les extraits RAG pour les rendre exploitables."]

      subgraph RETRIEVED_KNOWLEDGE_SYNTHESIS_IO[" "]
        direction LR

        RETRIEVED_KNOWLEDGE_SYNTHESIS_INPUTS["<b>Input</b><br/>
        supportUnderstanding<br/>
        knowledgeEnrichmentPlan<br/>
        knowledgeChunks"]

        RETRIEVED_KNOWLEDGE_SYNTHESIS_OUTPUTS["<b>Output</b><br/>
        retrievedKnowledgeSynthesis = {<br/>
        topics[] = [{<br/>
        topicId<br/>
        relevantFacts<br/>
        applicableInstructions?<br/>
        possibleFields?<br/>
        unresolvedPoints?<br/>
        sourceReferences<br/>
        }]<br/>
        }"]

        RETRIEVED_KNOWLEDGE_SYNTHESIS_INPUTS --> RETRIEVED_KNOWLEDGE_SYNTHESIS_OUTPUTS
      end

      RETRIEVED_KNOWLEDGE_SYNTHESIS_ROLE ~~~ RETRIEVED_KNOWLEDGE_SYNTHESIS_IO
    end

    %% =====================================================
    %% 9. RESPONSE PLANNING
    %% =====================================================

    T_RESPONSE_PLAN_INPUT["<b>Prepare responsePlanInput</b>"]

    subgraph RESPONSE_PLAN_DATA["responsePlan = planSupportResponse(responsePlanInput)"]
      direction TB

      RESPONSE_PLAN_ROLE["<b>Rôle :</b> décider quoi répondre, quoi demander et quelles preuves complémentaires obtenir."]

      subgraph RESPONSE_PLAN_IO[" "]
        direction LR

        RESPONSE_PLAN_INPUTS["<b>Input</b><br/>
        supportUnderstanding<br/>
        retrievedKnowledgeSynthesis?<br/>
        genericFieldKnowledge?<br/>
        standardResponseFragments<br/>
        recentInteractionContext<br/>
        channel"]

        RESPONSE_PLAN_OUTPUTS["<b>Output</b><br/>
        responsePlan = {<br/>
        topicPlans<br/>
        informationRequests?<br/>
        evidenceRequests?<br/>
        handover?<br/>
        }"]

        RESPONSE_PLAN_INPUTS --> RESPONSE_PLAN_OUTPUTS
      end

      RESPONSE_PLAN_ROLE ~~~ RESPONSE_PLAN_IO
    end

    %% =====================================================
    %% 10. SUPPORT RESPONSE RENDERING
    %% =====================================================

    T_SUPPORT_RESPONSE_INPUT["<b>Prepare supportResponseInput</b>"]

    subgraph SUPPORT_RESPONSE_DATA["supportResponse = renderSupportResponse(supportResponseInput)"]
      direction TB

      SUPPORT_RESPONSE_ROLE["<b>Rôle :</b> transformer le plan structuré en réponse naturelle adaptée au canal."]

      subgraph SUPPORT_RESPONSE_IO[" "]
        direction LR

        SUPPORT_RESPONSE_INPUTS["<b>Input</b><br/>
        responsePlan<br/>
        textSurfaceAnalysis?<br/>
        accountProfile<br/>
        channel"]

        SUPPORT_RESPONSE_OUTPUTS["<b>Output</b><br/>
        supportResponse"]

        SUPPORT_RESPONSE_INPUTS --> SUPPORT_RESPONSE_OUTPUTS
      end

      SUPPORT_RESPONSE_ROLE ~~~ SUPPORT_RESPONSE_IO
    end

    T_APPEND_SUPPORT_RESPONSE["<b>Append support response to responseAccumulator</b><br/>
    responseAccumulator.supportResponse<br/>
    = supportResponse"]

    %% =====================================================
    %% 11. USER RESPONSE BUILDING
    %% =====================================================

    T_USER_RESPONSE_INPUT["<b>Prepare userResponseInput</b>"]

    subgraph USER_RESPONSE_DATA["userResponse = buildUserResponse(userResponseInput)"]
      direction TB

      USER_RESPONSE_ROLE["<b>Rôle :</b> construire l’output utilisateur à partir des fragments standards et de la réponse support."]

      subgraph USER_RESPONSE_IO[" "]
        direction LR

        USER_RESPONSE_INPUTS["<b>Input</b><br/>
        responseAccumulator"]

        USER_RESPONSE_OUTPUTS["<b>Output</b><br/>
        userResponse"]

        USER_RESPONSE_INPUTS --> USER_RESPONSE_OUTPUTS
      end

      USER_RESPONSE_ROLE ~~~ USER_RESPONSE_IO
    end

    %% =====================================================
    %% 12. PATCHES
    %% =====================================================

    T_PATCHES_INPUT["<b>Prepare patchesInput</b>"]

    subgraph PATCHES_DATA["patches = buildSupportPatches(patchesInput)"]
      direction TB

      PATCHES_ROLE["<b>Rôle :</b> construire les modifications persistantes produites par le traitement."]

      subgraph PATCHES_IO[" "]
        direction LR

        PATCHES_INPUTS["<b>Input</b><br/>
        promptSecuritySignals<br/>
        turnAnalysisPlan<br/>
        supportUnderstanding?<br/>
        responsePlan?<br/>
        responseAccumulator<br/>
        userResponse"]

        PATCHES_OUTPUTS["<b>Output</b><br/>
        patches"]

        PATCHES_INPUTS --> PATCHES_OUTPUTS
      end

      PATCHES_ROLE ~~~ PATCHES_IO
    end

    T_RETURN["<b>Return final pipeline output</b><br/>
    return { userResponse, patches }"]

    %% =====================================================
    %% LINKS
    %% =====================================================

    T_RESPONSE_ACCUMULATOR_INIT --> T_PROMPT_SECURITY_INPUT
    T_PROMPT_SECURITY_INPUT --> PROMPT_SECURITY_DATA
    PROMPT_SECURITY_DATA --> T_TURN_PLAN_INPUT
    T_TURN_PLAN_INPUT --> TURN_PLAN_DATA
    TURN_PLAN_DATA --> T_ANALYZE_TURN

    T_ANALYZE_TURN -->|no| T_STANDARD_INPUT

    T_ANALYZE_TURN -->|yes| T_SURFACE_START

    T_SURFACE_START -->|if analyzeText| T_TEXT_SURFACE_INPUT
    T_TEXT_SURFACE_INPUT --> TEXT_SURFACE_DATA
    TEXT_SURFACE_DATA --> T_WAIT_SURFACE

    T_SURFACE_START -->|if analyzeAttachments| T_ATTACHMENT_SURFACE_INPUT
    T_ATTACHMENT_SURFACE_INPUT --> ATTACHMENT_SURFACE_DATA
    ATTACHMENT_SURFACE_DATA --> T_WAIT_SURFACE

    T_WAIT_SURFACE --> T_STANDARD_INPUT

    T_STANDARD_INPUT --> STANDARD_HANDLER_DATA
    STANDARD_HANDLER_DATA --> T_APPEND_STANDARD_FRAGMENTS

    T_APPEND_STANDARD_FRAGMENTS --> T_DEEP_ANALYSIS_CHECK

    T_DEEP_ANALYSIS_CHECK -->|false| T_USER_RESPONSE_INPUT
    T_DEEP_ANALYSIS_CHECK -->|true| T_DEEP_START

    T_DEEP_START -->|if support text segments| T_SUPPORT_TEXT_INPUT
    T_SUPPORT_TEXT_INPUT --> SUPPORT_TEXT_DATA
    SUPPORT_TEXT_DATA --> T_WAIT_DEEP_RESULTS

    T_DEEP_START -->|if selected attachments| T_SUPPORT_ATTACHMENT_INPUT
    T_SUPPORT_ATTACHMENT_INPUT --> SUPPORT_ATTACHMENT_DATA
    SUPPORT_ATTACHMENT_DATA --> T_WAIT_DEEP_RESULTS
    T_WAIT_DEEP_RESULTS --> T_TOPIC_UPDATE_INPUT

    T_TOPIC_UPDATE_INPUT --> TOPIC_UPDATE_DATA
    TOPIC_UPDATE_DATA --> T_UNDERSTANDING_INPUT

    T_UNDERSTANDING_INPUT --> UNDERSTANDING_DATA
    UNDERSTANDING_DATA --> T_KNOWLEDGE_ENRICHMENT_INPUT
    T_KNOWLEDGE_ENRICHMENT_INPUT --> KNOWLEDGE_ENRICHMENT_DATA
    KNOWLEDGE_ENRICHMENT_DATA --> T_RAG_ROUTE

    T_RAG_ROUTE -->|false| T_GENERIC_FIELD_KNOWLEDGE
    T_RAG_ROUTE -->|true| T_RAG_INPUT

    T_RAG_INPUT --> RAG_DATA
    RAG_DATA --> T_RETRIEVED_KNOWLEDGE_SYNTHESIS_INPUT
    T_RETRIEVED_KNOWLEDGE_SYNTHESIS_INPUT --> RETRIEVED_KNOWLEDGE_SYNTHESIS_DATA

    RETRIEVED_KNOWLEDGE_SYNTHESIS_DATA --> T_RESPONSE_PLAN_INPUT
    T_GENERIC_FIELD_KNOWLEDGE --> T_RESPONSE_PLAN_INPUT

    T_RESPONSE_PLAN_INPUT --> RESPONSE_PLAN_DATA
    RESPONSE_PLAN_DATA --> T_SUPPORT_RESPONSE_INPUT
    T_SUPPORT_RESPONSE_INPUT --> SUPPORT_RESPONSE_DATA
    SUPPORT_RESPONSE_DATA --> T_APPEND_SUPPORT_RESPONSE
    T_APPEND_SUPPORT_RESPONSE --> T_USER_RESPONSE_INPUT

    T_USER_RESPONSE_INPUT --> USER_RESPONSE_DATA
    USER_RESPONSE_DATA --> T_PATCHES_INPUT
    T_PATCHES_INPUT --> PATCHES_DATA
    PATCHES_DATA --> T_RETURN
  end

  %% =====================================================
  %% NEXT STEP
  %% =====================================================

  subgraph NEXT_STEP["Next step"]
    direction TB

    NEXT_OUTPUTS["<b>Outputs produced by runSupportProcessingPipelineV2</b><br/>
    userResponse<br/>
    patches"]
  end

  PREVIOUS_STEP --> PIPELINE
  PIPELINE --> NEXT_STEP

  %% =====================================================
  %% STYLES
  %% =====================================================

  classDef previousBlock fill:#0b6b3a,stroke:#064a28,color:#ffffff,stroke-width:1px;
  classDef inputBlock fill:#d5e8d4,stroke:#82b366,color:#000000,stroke-width:1px;
  classDef outputBlock fill:#f8cecc,stroke:#b85450,color:#000000,stroke-width:1px;
  classDef processingBlock fill:#d9e8f5,stroke:#4f93d2,color:#000000,stroke-width:1px;
  classDef roleBlock fill:#333333,stroke:#333333,color:#ffffff,stroke-width:0px;
  classDef nextOutputBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;

  class PROMPT_SECURITY_INPUTS,TURN_PLAN_INPUTS,TEXT_SURFACE_INPUTS,ATTACHMENT_SURFACE_INPUTS,STANDARD_INPUTS,SUPPORT_TEXT_INPUTS,SUPPORT_ATTACHMENT_INPUTS,TOPIC_UPDATE_INPUTS,UNDERSTANDING_INPUTS,KNOWLEDGE_ENRICHMENT_INPUTS,RAG_INPUTS,RETRIEVED_KNOWLEDGE_SYNTHESIS_INPUTS,RESPONSE_PLAN_INPUTS,SUPPORT_RESPONSE_INPUTS,USER_RESPONSE_INPUTS,PATCHES_INPUTS inputBlock;

  class PROMPT_SECURITY_OUTPUTS,TURN_PLAN_OUTPUTS,TEXT_SURFACE_OUTPUTS,ATTACHMENT_SURFACE_OUTPUTS,STANDARD_OUTPUTS,SUPPORT_TEXT_OUTPUTS,SUPPORT_ATTACHMENT_OUTPUTS,TOPIC_UPDATE_OUTPUTS,UNDERSTANDING_OUTPUTS,KNOWLEDGE_ENRICHMENT_OUTPUTS,RAG_OUTPUTS,RETRIEVED_KNOWLEDGE_SYNTHESIS_OUTPUTS,RESPONSE_PLAN_OUTPUTS,SUPPORT_RESPONSE_OUTPUTS,USER_RESPONSE_OUTPUTS,PATCHES_OUTPUTS outputBlock;

  class T_RESPONSE_ACCUMULATOR_INIT,T_PROMPT_SECURITY_INPUT,T_TURN_PLAN_INPUT,T_ANALYZE_TURN,T_SURFACE_START,T_TEXT_SURFACE_INPUT,T_ATTACHMENT_SURFACE_INPUT,T_WAIT_SURFACE,T_STANDARD_INPUT,T_APPEND_STANDARD_FRAGMENTS,T_DEEP_ANALYSIS_CHECK,T_DEEP_START,T_SUPPORT_TEXT_INPUT,T_SUPPORT_ATTACHMENT_INPUT,T_WAIT_DEEP_RESULTS,T_TOPIC_UPDATE_INPUT,T_UNDERSTANDING_INPUT,T_KNOWLEDGE_ENRICHMENT_INPUT,T_RAG_ROUTE,T_GENERIC_FIELD_KNOWLEDGE,T_RAG_INPUT,T_RETRIEVED_KNOWLEDGE_SYNTHESIS_INPUT,T_RESPONSE_PLAN_INPUT,T_SUPPORT_RESPONSE_INPUT,T_APPEND_SUPPORT_RESPONSE,T_USER_RESPONSE_INPUT,T_PATCHES_INPUT,T_RETURN processingBlock;

  class PROMPT_SECURITY_ROLE,TURN_PLAN_ROLE,TEXT_SURFACE_ROLE,ATTACHMENT_SURFACE_ROLE,STANDARD_ROLE,SUPPORT_TEXT_ROLE,SUPPORT_ATTACHMENT_ROLE,TOPIC_UPDATE_ROLE,UNDERSTANDING_ROLE,KNOWLEDGE_ENRICHMENT_ROLE,RAG_ROLE,RETRIEVED_KNOWLEDGE_SYNTHESIS_ROLE,RESPONSE_PLAN_ROLE,SUPPORT_RESPONSE_ROLE,USER_RESPONSE_ROLE,PATCHES_ROLE roleBlock;

  class NEXT_OUTPUTS nextOutputBlock;

  style PIPELINE fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style PREVIOUS_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;
  style NEXT_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;

  style PROMPT_SECURITY_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TURN_PLAN_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TEXT_SURFACE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style ATTACHMENT_SURFACE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style STANDARD_HANDLER_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SUPPORT_TEXT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SUPPORT_ATTACHMENT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TOPIC_UPDATE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style UNDERSTANDING_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style KNOWLEDGE_ENRICHMENT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style RAG_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style RETRIEVED_KNOWLEDGE_SYNTHESIS_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style RESPONSE_PLAN_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SUPPORT_RESPONSE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style USER_RESPONSE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style PATCHES_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  style PROMPT_SECURITY_IO fill:transparent,stroke:transparent,color:#ffffff;
  style TURN_PLAN_IO fill:transparent,stroke:transparent,color:#ffffff;
  style TEXT_SURFACE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style ATTACHMENT_SURFACE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style STANDARD_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SUPPORT_TEXT_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SUPPORT_ATTACHMENT_IO fill:transparent,stroke:transparent,color:#ffffff;
  style TOPIC_UPDATE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style UNDERSTANDING_IO fill:transparent,stroke:transparent,color:#ffffff;
  style KNOWLEDGE_ENRICHMENT_IO fill:transparent,stroke:transparent,color:#ffffff;
  style RAG_IO fill:transparent,stroke:transparent,color:#ffffff;
  style RETRIEVED_KNOWLEDGE_SYNTHESIS_IO fill:transparent,stroke:transparent,color:#ffffff;
  style RESPONSE_PLAN_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SUPPORT_RESPONSE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style USER_RESPONSE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style PATCHES_IO fill:transparent,stroke:transparent,color:#ffffff;

  linkStyle default stroke:#000000,stroke-width:2px;
```

Notes:
- Text surface categories: `support_relevant | contextual_support_candidate | small_talk | out_of_scope | safety_sensitive | lack_comprehension`.
- `turnAnalysisPlan` carries `analyzeText`, `analyzeAttachments`, and `matchedPatternIds`; when both analysis flags are false, the turn follows the standard-only branch.
- `responseAccumulator` only holds standard fragments and the optional support response; patches are still produced at the end by `buildSupportPatches`.
- Phase 1 is surface-only: text runs `analyzeTextSurface`, attachments run `analyzeAttachmentSurface`, and no deep support analysis runs there.
- `buildStandardResponseFragments` receives either the `no_analyze` turn result or the surface results and directly produces `standardResponseFragments`.
- `Deep analysis needed?` is evaluated directly from `textSurfaceAnalysis` and `attachmentSurfaceAnalysis`; the `no_analyze` branch naturally evaluates false.
- Phase 2 is deep-only: text runs `analyzeSupportText` for support text segments from `textSurfaceAnalysis`, attachments run `analyzeSupportAttachments` only for selected attachments from `attachmentSurfaceAnalysis`.
- Attachment safety and eligibility are handled before full analysis by `planTurnAnalysis` and `analyzeAttachmentSurface`.
- Fallback is handled by `buildStandardResponseFragments` when no standard or deep work is available from the current branch.
- `proposeTopicUpdates` runs only after the deep analysis wait step and consumes `textSurfaceAnalysis`, `attachmentSurfaceAnalysis`, `textUnderstandings`, and `attachmentUnderstandings`.
- `supportUnderstanding` is the deterministic consolidated object produced by `applyTopicUpdates`; downstream enrichment and response planning are based on this stable `SupportUnderstandingV2`.
- `planKnowledgeEnrichment` decides whether retrieval is useful and prepares `retrievalRequests` per topic.
- `synthesizeRetrievedKnowledge` runs only after retrieval and turns `knowledgeChunks` into structured `retrievedKnowledgeSynthesis`; when no retrieval runs, `genericFieldKnowledge` goes directly to `planSupportResponse`.
- `planSupportResponse` receives `supportUnderstanding`, optional `retrievedKnowledgeSynthesis`, optional `genericFieldKnowledge`, and decides what response plan to build.
- `recentInteractionContext` is provided by the previous step and is not rebuilt inside this pipeline; it is the only conversation context sent to surface/deep attachment analysis.
- `extractableFieldCatalog` est une configuration interne, pas un input utilisateur du pipeline.
- `candidateFacts` sert aux faits utiles non catalogués, pas au groupement de topics.
