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

      TEXT_SURFACE_ROLE["<b>Rôle :</b> segmenter et catégoriser rapidement le message utilisateur ; standard_interaction et support_relevant peuvent coexister."]

      subgraph TEXT_SURFACE_IO[" "]
        direction LR

        TEXT_SURFACE_INPUTS["<b>Input</b><br/>
        latestUserMessage<br/>
        turnAnalysisPlan<br/>
        recentInteractionContext"]

        TEXT_SURFACE_OUTPUTS["<b>Output</b><br/>
        textSurfaceAnalysis = {<br/>
        userLanguage<br/>
        segments[] = [{<br/>
        segmentId<br/>
        verbatim<br/>
        category<br/>
        standardSubcategory?<br/>
        }]<br/>
        }<br/><br/>
        Les portions indépendantes sont séparées :<br/>
        greeting / disappointment / support / urgency<br/>
        peuvent former plusieurs segments distincts."]

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
    %% 3. STANDARD RESPONSE FRAGMENTS
    %% =====================================================

    T_STANDARD_INPUT["<b>Prepare standardFragmentsInput</b>"]

    subgraph STANDARD_HANDLER_DATA["standardResponseFragments = buildStandardResponseFragments(standardFragmentsInput)"]
      direction TB

      STANDARD_ROLE["<b>Rôle :</b> transformer déterministiquement les segments standards en formulations canoniques destinées au renderer."]

      subgraph STANDARD_IO[" "]
        direction LR

        STANDARD_INPUTS["<b>Input</b><br/>
        turnAnalysisPlan<br/>
        latestUserMessage?<br/>
        accountProfile?<br/>
        recentInteractionContext?<br/>
        textSurfaceAnalysis?<br/>
        attachmentSurfaceAnalysis?"]

        STANDARD_OUTPUTS["<b>Output</b><br/>
        standardResponseFragments[] = [{<br/>
        category<br/>
        standardSubcategory?<br/>
        content<br/>
        }]<br/><br/>
        Aucun fragment pour support_relevant.<br/>
        Ces fragments ne sont jamais envoyés<br/>
        directement à l’utilisateur."]

        STANDARD_INPUTS --> STANDARD_OUTPUTS
      end

      STANDARD_ROLE ~~~ STANDARD_IO
    end

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

    subgraph SUPPORT_TEXT_DATA["{ textUnderstandings, supportResponseCues } = analyzeSupportText(supportTextInput)"]
      direction TB

      SUPPORT_TEXT_ROLE["<b>Rôle :</b> comprendre localement les segments support : attente, besoins analytiques, catégorie large, faits, champs, actions testées et signaux de réponse embedded."]

      subgraph SUPPORT_TEXT_IO[" "]
        direction LR

        SUPPORT_TEXT_INPUTS["<b>Input</b><br/>
        turnAnalysisPlan<br/>
        textSurfaceAnalysis<br/>
        recentInteractionContext<br/>
        extractableFieldCatalog"]

        SUPPORT_TEXT_OUTPUTS["<b>Output</b><br/>
        textUnderstandings[] = [{<br/>
        understandingId<br/>
        sourceSegmentIds[]<br/>
        sourceVerbatims[]<br/>
        summary<br/>
        primaryUserExpectation<br/>
        explicitUserRequest? { request, evidence }<br/>
        supportNeeds[]<br/>
        broadCategoryHint?<br/>
        contextDependency<br/>
        contextualAnswer<br/>
        facts[]<br/>
        testedActions[]<br/>
        uncertainties[]<br/>
        }]<br/>
        supportResponseCues[] = [{<br/>
        cueId<br/>
        sourceSegmentIds[]<br/>
        relatedUnderstandingIds[]<br/>
        verbatim<br/>
        cueNote<br/>
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

    subgraph TOPIC_UPDATE_DATA["topicUpdateProposals = proposeTopicUpdates(topicUpdateInput)"]
      direction TB

      TOPIC_UPDATE_ROLE["<b>Rôle :</b> réconcilier les understandings support avec les topics persistants, sans muter les topics ni générer de réponse."]

      subgraph TOPIC_UPDATE_IO[" "]
        direction LR

        TOPIC_UPDATE_INPUTS["<b>Input</b><br/>
        textUnderstandings<br/>
        supportTopicKnowledge<br/>
        recentInteractionContext<br/>
        latestUserMessageContent?"]

        TOPIC_UPDATE_OUTPUTS["<b>Output</b><br/>
        topicUpdateProposals[] = [{<br/>
        proposalId<br/>
        action: update_existing_topic / create_new_topic / no_topic_update / needs_review<br/>
        fromUnderstandingIds[]<br/>
        topicId?<br/>
        selectedSourceVerbatims[]<br/>
        updateIntent?<br/>
        newTopic?<br/>
        reason<br/>
        }]"]

        TOPIC_UPDATE_INPUTS --> TOPIC_UPDATE_OUTPUTS
      end

      TOPIC_UPDATE_ROLE ~~~ TOPIC_UPDATE_IO
    end

    %% =====================================================
    %% 6. TOPIC COMMIT POSTPONED
    %% =====================================================

    T_UNDERSTANDING_INPUT["<b>Skip topic commit</b>"]

    subgraph UNDERSTANDING_DATA["applyTopicUpdates postponed"]
      direction TB

      UNDERSTANDING_ROLE["<b>Rôle temporaire :</b> ne pas appliquer ni persister les propositions de topics avant le responsePlan."]

      subgraph UNDERSTANDING_IO[" "]
        direction LR

        UNDERSTANDING_INPUTS["<b>Input</b><br/>
        topicUpdateProposals"]

        UNDERSTANDING_OUTPUTS["<b>Output</b><br/>
        no persisted topic mutation"]

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

      KNOWLEDGE_ENRICHMENT_ROLE["<b>Rôle temporaire :</b> retourner un plan stable sans retrieval RAG."]

      subgraph KNOWLEDGE_ENRICHMENT_IO[" "]
        direction LR

        KNOWLEDGE_ENRICHMENT_INPUTS["<b>Input</b><br/>
        textSurfaceAnalysis?<br/>
        standardResponseFragments<br/>
        textUnderstandings<br/>
        supportResponseCues<br/>
        topicUpdateProposals<br/>
        supportTopicKnowledge<br/>
        recentInteractionContext<br/>
        latestUserMessage<br/>
        extractableFieldCatalog"]

        KNOWLEDGE_ENRICHMENT_OUTPUTS["<b>Output</b><br/>
        knowledgeEnrichmentPlan = {<br/>
        route: no_retrieval<br/>
        retrievalRequests: []<br/>
        reason: rag_not_enabled_yet<br/>
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
        textSurfaceAnalysis?<br/>
        standardResponseFragments<br/>
        textUnderstandings<br/>
        supportResponseCues<br/>
        topicUpdateProposals<br/>
        supportTopicKnowledge<br/>
        knowledgeEnrichmentPlan<br/>
        retrievedSupportKnowledge: []<br/>
        synthesizedRetrievedKnowledge: null<br/>
        genericFieldKnowledge<br/>
        extractableFieldCatalog<br/>
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

    T_SUPPORT_RESPONSE_INPUT["<b>Prepare renderSupportResponseInput</b><br/>
    Convergence point for standard-only<br/>
    and deep-support branches."]

    subgraph SUPPORT_RESPONSE_DATA["supportResponse = renderSupportResponse(renderSupportResponseInput)"]
      direction TB

      SUPPORT_RESPONSE_ROLE["<b>Rôle :</b> fusionner les formulations standards et, lorsqu’il existe, le plan support pour produire une réponse unique et naturelle adaptée au canal."]

      subgraph SUPPORT_RESPONSE_IO[" "]
        direction LR

        SUPPORT_RESPONSE_INPUTS["<b>Input</b><br/>
        responsePlan?<br/>
        standardResponseFragments<br/>
        textSurfaceAnalysis?<br/>
        accountProfile<br/>
        channel<br/><br/>
        Standard-only : responsePlan absent.<br/>
        Deep : responsePlan et fragments standards<br/>
        peuvent être présents ensemble.<br/>
        Plusieurs fragments standards sont lissés,<br/>
        pas concaténés rigidement."]

        SUPPORT_RESPONSE_OUTPUTS["<b>Output</b><br/>
        supportResponse"]

        SUPPORT_RESPONSE_INPUTS --> SUPPORT_RESPONSE_OUTPUTS
      end

      SUPPORT_RESPONSE_ROLE ~~~ SUPPORT_RESPONSE_IO
    end

    %% =====================================================
    %% 11. USER RESPONSE BUILDING
    %% =====================================================

    T_USER_RESPONSE_INPUT["<b>Prepare userResponseInput</b>"]

    subgraph USER_RESPONSE_DATA["userResponse = buildUserResponse(userResponseInput)"]
      direction TB

      USER_RESPONSE_ROLE["<b>Rôle :</b> construire l’output utilisateur à partir de la réponse support rendue."]

      subgraph USER_RESPONSE_IO[" "]
        direction LR

        USER_RESPONSE_INPUTS["<b>Input</b><br/>
        supportResponse"]

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
        textUnderstandings?<br/>
        supportResponseCues?<br/>
        topicUpdateProposals?<br/>
        knowledgeEnrichmentPlan?<br/>
        retrievedSupportKnowledge?<br/>
        synthesizedRetrievedKnowledge?<br/>
        responsePlan?<br/>
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
    STANDARD_HANDLER_DATA --> T_DEEP_ANALYSIS_CHECK

    T_DEEP_ANALYSIS_CHECK -->|false| T_SUPPORT_RESPONSE_INPUT
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
    KNOWLEDGE_ENRICHMENT_DATA -->|no_retrieval| T_GENERIC_FIELD_KNOWLEDGE
    T_GENERIC_FIELD_KNOWLEDGE --> T_RESPONSE_PLAN_INPUT

    T_RESPONSE_PLAN_INPUT --> RESPONSE_PLAN_DATA
    RESPONSE_PLAN_DATA --> T_SUPPORT_RESPONSE_INPUT
    T_SUPPORT_RESPONSE_INPUT --> SUPPORT_RESPONSE_DATA
    SUPPORT_RESPONSE_DATA --> T_USER_RESPONSE_INPUT

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
    patches<br/>
    textUnderstandings?<br/>
    supportResponseCues?<br/>
    topicUpdateProposals?<br/>
    knowledgeEnrichmentPlan?<br/>
    retrievedSupportKnowledge?<br/>
    synthesizedRetrievedKnowledge?"]
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

  class T_PROMPT_SECURITY_INPUT,T_TURN_PLAN_INPUT,T_ANALYZE_TURN,T_SURFACE_START,T_TEXT_SURFACE_INPUT,T_ATTACHMENT_SURFACE_INPUT,T_WAIT_SURFACE,T_STANDARD_INPUT,T_DEEP_ANALYSIS_CHECK,T_DEEP_START,T_SUPPORT_TEXT_INPUT,T_SUPPORT_ATTACHMENT_INPUT,T_WAIT_DEEP_RESULTS,T_TOPIC_UPDATE_INPUT,T_UNDERSTANDING_INPUT,T_KNOWLEDGE_ENRICHMENT_INPUT,T_RAG_ROUTE,T_GENERIC_FIELD_KNOWLEDGE,T_RAG_INPUT,T_RETRIEVED_KNOWLEDGE_SYNTHESIS_INPUT,T_RESPONSE_PLAN_INPUT,T_SUPPORT_RESPONSE_INPUT,T_USER_RESPONSE_INPUT,T_PATCHES_INPUT,T_RETURN processingBlock;

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
- Text surface categories: `support_relevant | standard_interaction | out_of_scope | safety_sensitive | lack_comprehension`.
- `analyzeTextSurface` can return `standard_interaction` and `support_relevant` in the same output; independent spans are segmented separately, for example greeting, disappointment, support issue, and urgency.
- Isolated explicit handover requests are `standard_interaction / handover_request`; when a separable support problem is present, only the problem segment is `support_relevant`.
- `recentInteractionContext` may help `analyzeTextSurface` route a short current answer, but it must not be used to extract facts, create fields, create topics, or rewrite the message.
- `turnAnalysisPlan` carries `analyzeText`, `analyzeAttachments`, and `matchedPatternIds`; when both analysis flags are false, the turn follows the standard-only branch.
- `planTurnAnalysis` enables text analysis when trimmed text exists unless the account is `suspicious` with matched security patterns.
- `planTurnAnalysis` enables attachment surface analysis only when attachments exist and `accountTrustStatus.status` is `trusted` or `neutral`; attachments from `suspicious` accounts are not analyzed.
- Phase 1 is surface-only: text runs `analyzeTextSurface` as LLM1 for routing and macro-segmentation only, attachments run `analyzeAttachmentSurface`, and no deep support analysis runs there.
- `buildStandardResponseFragments` always runs after enabled surface paths, is fully deterministic, produces canonical formulations for standard segments, never creates fragments for `support_relevant`, and never sends fragments directly to the user.
- When text surface is skipped, `buildStandardResponseFragments` resolves language deterministically from known language hints or the current message before falling back to English.
- `Deep analysis needed?` is evaluated directly from `textSurfaceAnalysis` and `attachmentSurfaceAnalysis`; the `no_analyze` branch naturally evaluates false.
- When no deep analysis is needed, deep analysis, topic, knowledge, and `planSupportResponse` steps are skipped, then `renderSupportResponse` runs with no `responsePlan`.
- Phase 2 is deep-only: text runs `analyzeSupportText` as LLM2 for support text segments from `textSurfaceAnalysis`, attachments run `analyzeSupportAttachments` only for selected attachments from `attachmentSurfaceAnalysis`.
- `analyzeSupportText` makes one LLM call for all `support_relevant` text segments and may return multiple understanding units per macro-segment plus top-level `supportResponseCues` for embedded impolite, frustrated, urgent, pressured, or very negative wording; context can disambiguate short answers, but facts and tested actions must stay evidenced in the current segment.
- `proposeTopicUpdates` is LLM3: it reconciles `TextUnderstanding[]` with persistent topics only, but it does not receive standard segments, extract facts, mutate topics, plan a response, or generate final topic ids.
- Normal LLM3 shape is `1 understanding -> 1 topic proposal`; allowed exceptions are `N understandings -> 1 topic` when they describe the same persistent issue, or `1 understanding -> N proposals` only when the split is traceable through selected source verbatims. Otherwise LLM3 must use `needs_review`.
- Attachment safety and eligibility are handled before full analysis by `planTurnAnalysis` and `analyzeAttachmentSurface`.
- Fallback is handled by `buildStandardResponseFragments` when no standard or deep work is available from the current branch.
- `proposeTopicUpdates` runs only after the deep analysis wait step and consumes `textUnderstandings`, `supportTopicKnowledge`, `recentInteractionContext`, and the latest message content for consistency only; it does not receive `supportResponseCues`.
- `applyTopicUpdates` is temporarily skipped in the main V2 path; topic proposals are not applied or persisted before response planning.
- `planKnowledgeEnrichment` is temporarily mocked and returns `route: "no_retrieval"`, `retrievalRequests: []`, and `reason: "rag_not_enabled_yet"`.
- Retrieval and synthesis are skipped while `knowledgeEnrichmentPlan.route` is `no_retrieval`; the pipeline passes `retrievedSupportKnowledge: []` and `synthesizedRetrievedKnowledge: null` forward.
- `planSupportResponse` receives the LLM1/LLM2/LLM3 outputs directly, including `standardResponseFragments`, `textUnderstandings`, `supportResponseCues`, and `topicUpdateProposals`, plus `supportTopicKnowledge`, recent context, generic field knowledge, and the empty/mock knowledge outputs; standard fragments stay available for planning and rendering.
- Both standard-only and deep-support branches converge at `Prepare renderSupportResponseInput` before a single `renderSupportResponse` call.
- `renderSupportResponse` runs in every branch. It receives optional `responsePlan`, `standardResponseFragments`, optional `textSurfaceAnalysis`, `accountProfile`, and `channel`, then produces the single rendered support response.
- After `renderSupportResponse`, the pipeline runs `buildUserResponse({ supportResponse })`, `buildSupportPatches`, and returns `{ userResponse, patches }` plus temporary debug/bridge outputs when produced, including `textUnderstandings`, `supportResponseCues`, `topicUpdateProposals`, and mock knowledge outputs.
- `recentInteractionContext` is provided by the previous step and is not rebuilt inside this pipeline; it is sent to deep text and deep attachment analysis, and to response planning.
- `extractableFieldCatalog` est une configuration interne, pas un input utilisateur du pipeline.
- `facts` regroupe les champs catalogués et les faits ouverts avec evidence; les actions testées avec résultat restent dans `testedActions`.
