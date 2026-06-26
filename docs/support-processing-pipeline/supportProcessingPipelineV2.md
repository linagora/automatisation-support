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
    %% 6. PARALLEL TOPIC PROCESSING
    %% =====================================================

    T_PARALLEL_TOPIC_START["<b>parallelTopicProcessing = startTopicProposalBranches(topicUpdateProposals)</b><br/>
    Each topicUpdateProposal runs its own knowledge and response planning branch.<br/>
    Branches are independent and can run in parallel."]

    subgraph TOPIC_BRANCH_MAIN["Topic branch #1 — process one topicUpdateProposal"]
      direction TB

      %% -----------------------------------------------------
      %% 6.1 TOPIC KNOWLEDGE ENRICHMENT PLAN
      %% -----------------------------------------------------

      T_TOPIC_KNOWLEDGE_ENRICHMENT_INPUT["<b>Prepare topicKnowledgeEnrichmentInput</b>"]

      subgraph TOPIC_KNOWLEDGE_ENRICHMENT_DATA["topicKnowledgeEnrichmentPlan = planKnowledgeEnrichment(topicKnowledgeEnrichmentInput)"]
        direction TB

        TOPIC_KNOWLEDGE_ENRICHMENT_ROLE["<b>Rôle :</b> décider, pour ce topic, si une recherche RAG externe doit être lancée et avec quelles requêtes."]

        subgraph TOPIC_KNOWLEDGE_ENRICHMENT_IO[" "]
          direction LR

          TOPIC_KNOWLEDGE_ENRICHMENT_INPUTS["<b>Input</b><br/>
          topicUpdateProposal<br/>
          relatedTextUnderstandings<br/>
          relatedAttachmentUnderstandings?<br/>
          supportTopicKnowledge<br/>
          recentInteractionContext<br/>
          ragAvailability"]

          TOPIC_KNOWLEDGE_ENRICHMENT_OUTPUTS["<b>Output</b><br/>
          topicKnowledgeEnrichmentPlan = {<br/>
          proposalId<br/>
          topicId?<br/>
          route: no_retrieval / retrieve_knowledge<br/>
          retrievalRequests[] = [{<br/>
          requestId<br/>
          query<br/>
          reason<br/>
          relatedUnderstandingIds[]<br/>
          }]<br/>
          reason<br/>
          }<br/><br/>
          Actuellement mocké en no_retrieval<br/>
          tant que le RAG n’est pas branché."]

          TOPIC_KNOWLEDGE_ENRICHMENT_INPUTS --> TOPIC_KNOWLEDGE_ENRICHMENT_OUTPUTS
        end

        TOPIC_KNOWLEDGE_ENRICHMENT_ROLE ~~~ TOPIC_KNOWLEDGE_ENRICHMENT_IO
      end

      %% -----------------------------------------------------
      %% 6.2 CATALOG KNOWLEDGE SELECTION
      %% -----------------------------------------------------

      T_CATALOG_SELECTION_INPUT["<b>Prepare catalogSelectionInput</b>"]

      subgraph CATALOG_SELECTION_DATA["selectedCatalogKnowledge = selectCatalogKnowledgeForTopic(catalogSelectionInput)"]
        direction TB

        CATALOG_SELECTION_ROLE["<b>Rôle :</b> sélectionner, dans le catalogue interne, uniquement les champs et connaissances génériques utiles pour ce topic, avec un scope volontairement un peu large."]

        subgraph CATALOG_SELECTION_IO[" "]
          direction LR

          CATALOG_SELECTION_INPUTS["<b>Input</b><br/>
          topicUpdateProposal<br/>
          relatedTextUnderstandings<br/>
          relatedAttachmentUnderstandings?<br/>
          supportTopicKnowledge<br/>
          extractableFieldCatalog<br/>
          genericFieldKnowledgeCatalog"]

          CATALOG_SELECTION_OUTPUTS["<b>Output</b><br/>
          selectedCatalogKnowledge = {<br/>
          proposalId<br/>
          topicId?<br/>
          selectedFieldNames[]<br/>
          selectedGenericKnowledgeIds[]<br/>
          possibleQuestionFields[]<br/>
          exclusions[]?<br/>
          reason<br/>
          }"]

          CATALOG_SELECTION_INPUTS --> CATALOG_SELECTION_OUTPUTS
        end

        CATALOG_SELECTION_ROLE ~~~ CATALOG_SELECTION_IO
      end

      %% -----------------------------------------------------
      %% 6.3 OPTIONAL RAG BRANCH
      %% -----------------------------------------------------

      subgraph OPTIONAL_RAG_BRANCH["Optional RAG branch for this topic"]
        direction TB

        T_TOPIC_RAG_ROUTE{"<b>Retrieve RAG knowledge for this topic?</b><br/>
        topicKnowledgeEnrichmentPlan.route === retrieve_knowledge"}

        T_TOPIC_RAG_INPUT["<b>Prepare topicRagInput</b>"]

        subgraph TOPIC_RAG_DATA["topicKnowledgeChunks = retrieveSupportKnowledgeForTopic(topicRagInput)"]
          direction TB

          TOPIC_RAG_ROLE["<b>Rôle :</b> récupérer les extraits documentaires pertinents pour ce topic uniquement."]

          subgraph TOPIC_RAG_IO[" "]
            direction LR

            TOPIC_RAG_INPUTS["<b>Input</b><br/>
            topicUpdateProposal<br/>
            topicKnowledgeEnrichmentPlan.retrievalRequests"]

            TOPIC_RAG_OUTPUTS["<b>Output</b><br/>
            topicKnowledgeChunks[] = [{<br/>
            proposalId<br/>
            requestId<br/>
            sourceId<br/>
            content<br/>
            score<br/>
            metadata?<br/>
            }]"]

            TOPIC_RAG_INPUTS --> TOPIC_RAG_OUTPUTS
          end

          TOPIC_RAG_ROLE ~~~ TOPIC_RAG_IO
        end

        T_TOPIC_RAG_SYNTHESIS_INPUT["<b>Prepare topicRetrievedKnowledgeSynthesisInput</b>"]

        subgraph TOPIC_RAG_SYNTHESIS_DATA["topicRetrievedKnowledgeSynthesis = synthesizeRetrievedKnowledgeForTopic(topicRetrievedKnowledgeSynthesisInput)"]
          direction TB

          TOPIC_RAG_SYNTHESIS_ROLE["<b>Rôle :</b> filtrer, simplifier et normaliser les extraits RAG de ce topic pour les rendre exploitables par le response planner."]

          subgraph TOPIC_RAG_SYNTHESIS_IO[" "]
            direction LR

            TOPIC_RAG_SYNTHESIS_INPUTS["<b>Input</b><br/>
            topicUpdateProposal<br/>
            topicKnowledgeEnrichmentPlan<br/>
            topicKnowledgeChunks"]

            TOPIC_RAG_SYNTHESIS_OUTPUTS["<b>Output</b><br/>
            topicRetrievedKnowledgeSynthesis = {<br/>
            proposalId<br/>
            relevantFacts[]<br/>
            applicableInstructions[]?<br/>
            possibleFields[]?<br/>
            unresolvedPoints[]?<br/>
            sourceReferences[]<br/>
            limitations[]?<br/>
            }"]

            TOPIC_RAG_SYNTHESIS_INPUTS --> TOPIC_RAG_SYNTHESIS_OUTPUTS
          end

          TOPIC_RAG_SYNTHESIS_ROLE ~~~ TOPIC_RAG_SYNTHESIS_IO
        end

        T_NO_TOPIC_RAG["<b>No RAG result for this topic</b><br/>
        topicRetrievedKnowledgeSynthesis = null"]
      end

      %% -----------------------------------------------------
      %% 6.4 TOPIC RESPONSE PLAN
      %% -----------------------------------------------------

      T_TOPIC_KNOWLEDGE_WAIT["<b>Wait for topic knowledge sources</b><br/>
      Await selectedCatalogKnowledge and optional topicRetrievedKnowledgeSynthesis."]

      T_TOPIC_RESPONSE_PLAN_INPUT["<b>Prepare topicResponsePlanInput</b>"]

      subgraph TOPIC_RESPONSE_PLAN_DATA["topicResponsePlan = planSupportResponseForTopic(topicResponsePlanInput)"]
        direction TB

        TOPIC_RESPONSE_PLAN_ROLE["<b>Rôle :</b> décider quoi répondre ou quoi demander pour ce topic uniquement, à partir de la proposition de topic, du catalogue sélectionné et de la connaissance RAG optionnelle."]

        subgraph TOPIC_RESPONSE_PLAN_IO[" "]
          direction LR

          TOPIC_RESPONSE_PLAN_INPUTS["<b>Input</b><br/>
          topicUpdateProposal<br/>
          relatedTextUnderstandings<br/>
          relatedAttachmentUnderstandings?<br/>
          supportResponseCues<br/>
          selectedCatalogKnowledge<br/>
          topicRetrievedKnowledgeSynthesis?<br/>
          topicKnowledgeEnrichmentPlan<br/>
          supportTopicKnowledge<br/>
          recentInteractionContext<br/>
          channel"]

          TOPIC_RESPONSE_PLAN_OUTPUTS["<b>Output</b><br/>
          topicResponsePlan = {<br/>
          proposalId<br/>
          topicId?<br/>
          responsePlanId<br/>
          knowledgeGate<br/>
          questionDecision<br/>
          rendererTask<br/>
          internalRationale<br/>
          }"]

          TOPIC_RESPONSE_PLAN_INPUTS --> TOPIC_RESPONSE_PLAN_OUTPUTS
        end

        TOPIC_RESPONSE_PLAN_ROLE ~~~ TOPIC_RESPONSE_PLAN_IO
      end
    end

    %% =====================================================
    %% 7. OPTIONAL PARALLEL TOPIC BRANCHES
    %% =====================================================

    T_OPTIONAL_TOPIC_BRANCHES["<b>Optional topic branches #2..N</b><br/>
    If topicUpdateProposals contains several actionable topic proposals, each additional proposal runs the same chain in parallel:<br/>
    planKnowledgeEnrichment → selectCatalogKnowledgeForTopic → optional RAG → planSupportResponseForTopic."]

    T_WAIT_TOPIC_RESPONSE_PLANS["<b>Wait for all topic response plans</b><br/>
    Await topicResponsePlan for every topic proposal branch."]

    %% =====================================================
    %% 8. SUPPORT RESPONSE COMPOSITION + RENDERING
    %% =====================================================

    T_SUPPORT_RESPONSE_INPUT["<b>Prepare composeSupportResponsePlanInput</b><br/>
    Convergence point for standard-only and deep-support branches.<br/>
    Deep branch receives all topic response plans."]

    subgraph SUPPORT_RESPONSE_DATA["composedSupportResponsePlan = composeSupportResponsePlan(composeSupportResponsePlanInput)"]
      direction TB

      SUPPORT_RESPONSE_ROLE["<b>Rôle :</b> faire la composition globale : ordre, fragments standards, questions redondantes, limite de questions, handover override, ton, transitions et forbidden claims."]

      subgraph SUPPORT_RESPONSE_IO[" "]
        direction LR

        SUPPORT_RESPONSE_INPUTS["<b>Input</b><br/>
        topicResponsePlans[]<br/>
        standardResponseFragments<br/>
        supportResponseCues?<br/>
        targetLanguage<br/>
        channel<br/><br/>
        Standard-only : topicResponsePlans vide.<br/>
        Deep : plusieurs topicResponsePlans peuvent être présents."]

        SUPPORT_RESPONSE_OUTPUTS["<b>Output</b><br/>
        composedSupportResponsePlan"]

        SUPPORT_RESPONSE_INPUTS --> SUPPORT_RESPONSE_OUTPUTS
      end

      SUPPORT_RESPONSE_ROLE ~~~ SUPPORT_RESPONSE_IO
    end

    subgraph SUPPORT_RENDER_DATA["supportResponse = renderSupportResponse(renderSupportResponseInput)"]
      direction TB

      SUPPORT_RENDER_ROLE["<b>Rôle :</b> écrire la réponse finale à partir du plan composé uniquement, sans décider, fusionner, diagnostiquer ni ajouter de contenu."]

      subgraph SUPPORT_RENDER_IO[" "]
        direction LR

        SUPPORT_RENDER_INPUTS["<b>Input</b><br/>
        composedSupportResponsePlan<br/><br/>
        Pas de latestUserMessageContent.<br/>
        Pas de standardResponseFragments bruts.<br/>
        Pas de topicResponsePlans bruts."]

        SUPPORT_RENDER_OUTPUTS["<b>Output</b><br/>
        supportResponse"]

        SUPPORT_RENDER_INPUTS --> SUPPORT_RENDER_OUTPUTS
      end

      SUPPORT_RENDER_ROLE ~~~ SUPPORT_RENDER_IO
    end

    %% =====================================================
    %% 9. USER RESPONSE BUILDING
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
    %% 10. PATCHES
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
        attachmentUnderstandings?<br/>
        supportResponseCues?<br/>
        topicUpdateProposals?<br/>
        topicKnowledgeEnrichmentPlans?<br/>
        selectedCatalogKnowledge?<br/>
        topicRetrievedKnowledgeSyntheses?<br/>
        topicResponsePlans?<br/>
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

    T_DEEP_ANALYSIS_CHECK -->|false| T_WAIT_TOPIC_RESPONSE_PLANS
    T_DEEP_ANALYSIS_CHECK -->|true| T_DEEP_START

    T_DEEP_START -->|if support text segments| T_SUPPORT_TEXT_INPUT
    T_SUPPORT_TEXT_INPUT --> SUPPORT_TEXT_DATA
    SUPPORT_TEXT_DATA --> T_WAIT_DEEP_RESULTS

    T_DEEP_START -->|if selected attachments| T_SUPPORT_ATTACHMENT_INPUT
    T_SUPPORT_ATTACHMENT_INPUT --> SUPPORT_ATTACHMENT_DATA
    SUPPORT_ATTACHMENT_DATA --> T_WAIT_DEEP_RESULTS

    T_WAIT_DEEP_RESULTS --> T_TOPIC_UPDATE_INPUT
    T_TOPIC_UPDATE_INPUT --> TOPIC_UPDATE_DATA
    TOPIC_UPDATE_DATA --> T_PARALLEL_TOPIC_START

    T_PARALLEL_TOPIC_START --> T_TOPIC_KNOWLEDGE_ENRICHMENT_INPUT
    T_PARALLEL_TOPIC_START -.-> T_OPTIONAL_TOPIC_BRANCHES

    T_TOPIC_KNOWLEDGE_ENRICHMENT_INPUT --> TOPIC_KNOWLEDGE_ENRICHMENT_DATA

    TOPIC_KNOWLEDGE_ENRICHMENT_DATA --> T_CATALOG_SELECTION_INPUT
    T_CATALOG_SELECTION_INPUT --> CATALOG_SELECTION_DATA
    CATALOG_SELECTION_DATA --> T_TOPIC_KNOWLEDGE_WAIT

    TOPIC_KNOWLEDGE_ENRICHMENT_DATA -.-> T_TOPIC_RAG_ROUTE
    T_TOPIC_RAG_ROUTE -.->|yes| T_TOPIC_RAG_INPUT
    T_TOPIC_RAG_INPUT -.-> TOPIC_RAG_DATA
    TOPIC_RAG_DATA -.-> T_TOPIC_RAG_SYNTHESIS_INPUT
    T_TOPIC_RAG_SYNTHESIS_INPUT -.-> TOPIC_RAG_SYNTHESIS_DATA
    TOPIC_RAG_SYNTHESIS_DATA -.-> T_TOPIC_KNOWLEDGE_WAIT

    T_TOPIC_RAG_ROUTE -.->|no| T_NO_TOPIC_RAG
    T_NO_TOPIC_RAG -.-> T_TOPIC_KNOWLEDGE_WAIT

    T_TOPIC_KNOWLEDGE_WAIT --> T_TOPIC_RESPONSE_PLAN_INPUT
    T_TOPIC_RESPONSE_PLAN_INPUT --> TOPIC_RESPONSE_PLAN_DATA
    TOPIC_RESPONSE_PLAN_DATA --> T_WAIT_TOPIC_RESPONSE_PLANS

    T_OPTIONAL_TOPIC_BRANCHES -.-> T_WAIT_TOPIC_RESPONSE_PLANS

    T_WAIT_TOPIC_RESPONSE_PLANS --> T_SUPPORT_RESPONSE_INPUT

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
    attachmentUnderstandings?<br/>
    supportResponseCues?<br/>
    topicUpdateProposals?<br/>
    topicKnowledgeEnrichmentPlans?<br/>
    selectedCatalogKnowledge?<br/>
    topicRetrievedKnowledgeSyntheses?<br/>
    topicResponsePlans?"]
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
  classDef optionalBlock fill:#eeeeee,stroke:#777777,color:#000000,stroke-width:1px,stroke-dasharray: 5 5;
  classDef roleBlock fill:#333333,stroke:#333333,color:#ffffff,stroke-width:0px;
  classDef nextOutputBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;

  class PROMPT_SECURITY_INPUTS,TURN_PLAN_INPUTS,TEXT_SURFACE_INPUTS,ATTACHMENT_SURFACE_INPUTS,STANDARD_INPUTS,SUPPORT_TEXT_INPUTS,SUPPORT_ATTACHMENT_INPUTS,TOPIC_UPDATE_INPUTS,TOPIC_KNOWLEDGE_ENRICHMENT_INPUTS,CATALOG_SELECTION_INPUTS,TOPIC_RAG_INPUTS,TOPIC_RAG_SYNTHESIS_INPUTS,TOPIC_RESPONSE_PLAN_INPUTS,SUPPORT_RESPONSE_INPUTS,USER_RESPONSE_INPUTS,PATCHES_INPUTS inputBlock;

  class PROMPT_SECURITY_OUTPUTS,TURN_PLAN_OUTPUTS,TEXT_SURFACE_OUTPUTS,ATTACHMENT_SURFACE_OUTPUTS,STANDARD_OUTPUTS,SUPPORT_TEXT_OUTPUTS,SUPPORT_ATTACHMENT_OUTPUTS,TOPIC_UPDATE_OUTPUTS,TOPIC_KNOWLEDGE_ENRICHMENT_OUTPUTS,CATALOG_SELECTION_OUTPUTS,TOPIC_RAG_OUTPUTS,TOPIC_RAG_SYNTHESIS_OUTPUTS,TOPIC_RESPONSE_PLAN_OUTPUTS,SUPPORT_RESPONSE_OUTPUTS,USER_RESPONSE_OUTPUTS,PATCHES_OUTPUTS outputBlock;

  class T_PROMPT_SECURITY_INPUT,T_TURN_PLAN_INPUT,T_ANALYZE_TURN,T_SURFACE_START,T_TEXT_SURFACE_INPUT,T_ATTACHMENT_SURFACE_INPUT,T_WAIT_SURFACE,T_STANDARD_INPUT,T_DEEP_ANALYSIS_CHECK,T_DEEP_START,T_SUPPORT_TEXT_INPUT,T_SUPPORT_ATTACHMENT_INPUT,T_WAIT_DEEP_RESULTS,T_TOPIC_UPDATE_INPUT,T_PARALLEL_TOPIC_START,T_TOPIC_KNOWLEDGE_ENRICHMENT_INPUT,T_CATALOG_SELECTION_INPUT,T_TOPIC_RAG_ROUTE,T_TOPIC_RAG_INPUT,T_TOPIC_RAG_SYNTHESIS_INPUT,T_NO_TOPIC_RAG,T_TOPIC_KNOWLEDGE_WAIT,T_TOPIC_RESPONSE_PLAN_INPUT,T_WAIT_TOPIC_RESPONSE_PLANS,T_SUPPORT_RESPONSE_INPUT,T_USER_RESPONSE_INPUT,T_PATCHES_INPUT,T_RETURN processingBlock;

  class T_OPTIONAL_TOPIC_BRANCHES optionalBlock;

  class PROMPT_SECURITY_ROLE,TURN_PLAN_ROLE,TEXT_SURFACE_ROLE,ATTACHMENT_SURFACE_ROLE,STANDARD_ROLE,SUPPORT_TEXT_ROLE,SUPPORT_ATTACHMENT_ROLE,TOPIC_UPDATE_ROLE,TOPIC_KNOWLEDGE_ENRICHMENT_ROLE,CATALOG_SELECTION_ROLE,TOPIC_RAG_ROLE,TOPIC_RAG_SYNTHESIS_ROLE,TOPIC_RESPONSE_PLAN_ROLE,SUPPORT_RESPONSE_ROLE,USER_RESPONSE_ROLE,PATCHES_ROLE roleBlock;

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
  style TOPIC_KNOWLEDGE_ENRICHMENT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style CATALOG_SELECTION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style OPTIONAL_RAG_BRANCH fill:#f5f5f5,stroke:#777777,stroke-width:1px,stroke-dasharray: 5 5,color:#000000;
  style TOPIC_RAG_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TOPIC_RAG_SYNTHESIS_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TOPIC_RESPONSE_PLAN_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
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
  style TOPIC_KNOWLEDGE_ENRICHMENT_IO fill:transparent,stroke:transparent,color:#ffffff;
  style CATALOG_SELECTION_IO fill:transparent,stroke:transparent,color:#ffffff;
  style TOPIC_RAG_IO fill:transparent,stroke:transparent,color:#ffffff;
  style TOPIC_RAG_SYNTHESIS_IO fill:transparent,stroke:transparent,color:#ffffff;
  style TOPIC_RESPONSE_PLAN_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SUPPORT_RESPONSE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style USER_RESPONSE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style PATCHES_IO fill:transparent,stroke:transparent,color:#ffffff;

  linkStyle default stroke:#000000,stroke-width:2px;
```

Notes:

* Après `topicUpdateProposals`, la pipeline ne passe plus par un bloc intermédiaire `topicWorkItems`.
* Chaque `topicUpdateProposal` actionable peut lancer une branche indépendante de traitement.
* La branche principale représente le traitement complet d’une proposition de topic.
* Les branches optionnelles en pointillés représentent les autres propositions de topics traitées de la même manière en parallèle.
* `planKnowledgeEnrichment` est exécuté par topic/proposal, pas globalement.
* `planKnowledgeEnrichment` décide seulement si une recherche RAG est nécessaire pour ce topic et avec quelles requêtes.
* La sélection catalogue est systématique par topic via `selectCatalogKnowledgeForTopic`.
* La recherche RAG est optionnelle par topic et isolée dans un sous-graphe dédié.
* Si le RAG est activé pour un topic, la recherche RAG est suivie d’un LLM de synthèse/normalisation : `synthesizeRetrievedKnowledgeForTopic`.
* Il n’y a plus de bloc `buildTopicKnowledgeBundle` : `planSupportResponseForTopic` reçoit directement `selectedCatalogKnowledge` et `topicRetrievedKnowledgeSynthesis?`.
* `planSupportResponseForTopic` produit un plan de réponse pour un seul topic.
* Tous les `topicResponsePlans` convergent ensuite dans `composeSupportResponsePlan`.
* `composeSupportResponsePlan` est le dernier bloc qui réfléchit globalement : ordre, fusion des questions, handover override, ton, transitions, forbidden claims.
* `renderSupportResponse` reçoit uniquement `composedSupportResponsePlan` et rédige la réponse finale sans voir le message utilisateur brut, les fragments standards bruts ni les plans topic bruts.
* Le bloc résiduel `applyTopicUpdates postponed` est supprimé.

```
```
