```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 24, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB

  %% =====================================================
  %% PREVIOUS STEP
  %% =====================================================

  subgraph PREVIOUS_STEP["Previous step"]
    direction TB

    PREVIOUS_INPUTS["<b>Inputs provided to runSupportProcessingPipelineV3Optimized</b><br/>
    latestUserMessage<br/>
    latestUserAttachments<br/>
    liveMemory"]
  end

  %% =====================================================
  %% SUPPORT PROCESSING PIPELINE V3 OPTIMIZED
  %% =====================================================

  subgraph PIPELINE["{ userResponse, patches, intermOutputs } = runSupportProcessingPipelineV3Optimized(input)"]
    direction TB

    %% =====================================================
    %% 1. PREFLIGHT
    %% =====================================================

    T_PROMPT_SECURITY_INPUT["<b>Prepare detectSuspiciousPromptPatternsInput</b>"]

    subgraph PROMPT_SECURITY_DATA["intermOutputs.detectSuspiciousPromptPatternsOutput = detectSuspiciousPromptPatterns(input)"]
      direction TB

      PROMPT_SECURITY_ROLE["<b>Rôle :</b> détecter les formulations potentiellement suspectes dans le dernier message utilisateur."]

      subgraph PROMPT_SECURITY_IO[" "]
        direction LR

        PROMPT_SECURITY_INPUTS["<b>Input</b><br/>
        latestUserMessage"]

        PROMPT_SECURITY_OUTPUTS["<b>Output</b><br/>
        detectSuspiciousPromptPatternsOutput = {<br/>
        matchedPatternIds<br/>
        }"]

        PROMPT_SECURITY_INPUTS --> PROMPT_SECURITY_OUTPUTS
      end

      PROMPT_SECURITY_ROLE ~~~ PROMPT_SECURITY_IO
    end

    T_TURN_PLAN_INPUT["<b>Prepare planTurnAnalysisInput</b>"]

    subgraph TURN_PLAN_DATA["intermOutputs.planTurnAnalysisOutput = planTurnAnalysis(input)"]
      direction TB

      TURN_PLAN_ROLE["<b>Rôle :</b> décider quels chemins d’analyse sont autorisés pour ce tour."]

      subgraph TURN_PLAN_IO[" "]
        direction LR

        TURN_PLAN_INPUTS["<b>Input</b><br/>
        latestUserMessage<br/>
        latestUserAttachments<br/>
        detectSuspiciousPromptPatternsOutput<br/>
        liveMemory.userState.status"]

        TURN_PLAN_OUTPUTS["<b>Output</b><br/>
        planTurnAnalysisOutput = {<br/>
        analyzeText<br/>
        analyzeAttachments<br/>
        matchedPatternIds<br/>
        }"]

        TURN_PLAN_INPUTS --> TURN_PLAN_OUTPUTS
      end

      TURN_PLAN_ROLE ~~~ TURN_PLAN_IO
    end

    R_NOT_ANALYZED["<b>Possible early return</b><br/>
    if analyzeText = false<br/>
    and analyzeAttachments = false<br/><br/>
    status = processed<br/>
    patches = turn_not_analyzed"]

    %% =====================================================
    %% 2. SURFACE ANALYSIS
    %% =====================================================

    T_SURFACE_ROUTE{"<b>Enabled surface paths?</b><br/>
    depending on planTurnAnalysisOutput"}

    T_TEXT_SURFACE_INPUT["<b>Prepare analyzeTextSurfaceInput</b>"]

    subgraph TEXT_SURFACE_DATA["intermOutputs.analyzeTextSurfaceOutput = runAnalyzeTextSurface(input)"]
      direction TB

      TEXT_SURFACE_ROLE["<b>Rôle :</b> segmenter et catégoriser rapidement le message utilisateur ; standard_interaction et support_relevant peuvent coexister."]

      subgraph TEXT_SURFACE_IO[" "]
        direction LR

        TEXT_SURFACE_INPUTS["<b>Input</b><br/>
        latestUserMessage<br/>
        planTurnAnalysisOutput<br/>
        recentInteractionContext"]

        TEXT_SURFACE_OUTPUTS["<b>Output</b><br/>
        analyzeTextSurfaceOutput = {<br/>
        status: analyzed / fallback<br/>
        fallbackReason?<br/>
        segments[]?<br/>
        }"]

        TEXT_SURFACE_INPUTS --> TEXT_SURFACE_OUTPUTS
      end

      TEXT_SURFACE_ROLE ~~~ TEXT_SURFACE_IO
    end

    R_TEXT_SURFACE_FALLBACK["<b>Possible fallback return</b><br/>
    if analyzeTextSurfaceOutput.status = fallback"]

    T_ATTACHMENT_SURFACE_INPUT["<b>Prepare analyzeAttachmentSurfaceInput</b>"]

    subgraph ATTACHMENT_SURFACE_DATA["intermOutputs.analyzeAttachmentSurfaceOutput = runAnalyzeAttachmentSurface(input)"]
      direction TB

      ATTACHMENT_SURFACE_ROLE["<b>Rôle :</b> déterminer quels attachments doivent être ignorés, traités de façon standard ou analysés profondément."]

      subgraph ATTACHMENT_SURFACE_IO[" "]
        direction LR

        ATTACHMENT_SURFACE_INPUTS["<b>Input</b><br/>
        latestUserMessage<br/>
        latestUserAttachments<br/>
        planTurnAnalysisOutput"]

        ATTACHMENT_SURFACE_OUTPUTS["<b>Output</b><br/>
        analyzeAttachmentSurfaceOutput = {<br/>
        status: analyzed / fallback<br/>
        fallbackReason?<br/>
        attachmentSurfaceItems[]?<br/>
        }"]

        ATTACHMENT_SURFACE_INPUTS --> ATTACHMENT_SURFACE_OUTPUTS
      end

      ATTACHMENT_SURFACE_ROLE ~~~ ATTACHMENT_SURFACE_IO
    end

    R_ATTACHMENT_SURFACE_FALLBACK["<b>Possible fallback return</b><br/>
    if analyzeAttachmentSurfaceOutput.status = fallback"]

    T_WAIT_SURFACE["<b>Continue after enabled surface paths</b><br/>
    disabled paths are null"]

    %% =====================================================
    %% 3. STANDARD FRAGMENTS
    %% =====================================================

    T_STANDARD_INPUT["<b>Prepare buildStandardResponseFragmentsInput</b>"]

    subgraph STANDARD_DATA["intermOutputs.buildStandardResponseFragmentsOutput = buildStandardResponseFragments(input)"]
      direction TB

      STANDARD_ROLE["<b>Rôle :</b> transformer les segments standards en formulations canoniques."]

      subgraph STANDARD_IO[" "]
        direction LR

        STANDARD_INPUTS["<b>Input</b><br/>
        textSurfaceAnalysis?"]

        STANDARD_OUTPUTS["<b>Output</b><br/>
        buildStandardResponseFragmentsOutput[] = [{<br/>
        category<br/>
        standardSubcategory<br/>
        say<br/>
        content<br/>
        }]"]

        STANDARD_INPUTS --> STANDARD_OUTPUTS
      end

      STANDARD_ROLE ~~~ STANDARD_IO
    end

    T_SUPPORT_GATE["<b>Check support_relevant</b><br/>
    from text surface and attachment surface"]

    %% =====================================================
    %% 4. STANDARD ONLY SHORT ROUTE
    %% =====================================================

    subgraph STANDARD_ONLY_ROUTE["Short route — no support_relevant"]
      direction TB

      T_STANDARD_ONLY_COMPOSER_INPUT["<b>Prepare composer input</b>"]

      subgraph STANDARD_ONLY_COMPOSER_DATA["intermOutputs.composerPlannerOutput = runComposerPlanner(input)"]
        direction TB

        STANDARD_ONLY_COMPOSER_ROLE["<b>Rôle :</b> composer une réponse à partir des fragments standards uniquement."]

        subgraph STANDARD_ONLY_COMPOSER_IO[" "]
          direction LR

          STANDARD_ONLY_COMPOSER_INPUTS["<b>Input</b><br/>
          mode = only_standard_fragments<br/>
          standardResponseFragments<br/>
          topicPlannerOutputs = []"]

          STANDARD_ONLY_COMPOSER_OUTPUTS["<b>Output</b><br/>
          composerPlannerOutput: processed / fallback"]

          STANDARD_ONLY_COMPOSER_INPUTS --> STANDARD_ONLY_COMPOSER_OUTPUTS
        end

        STANDARD_ONLY_COMPOSER_ROLE ~~~ STANDARD_ONLY_COMPOSER_IO
      end

      R_STANDARD_ONLY_COMPOSER_FALLBACK["<b>Possible fallback return</b><br/>
      if composerPlannerOutput.status = fallback"]

      T_STANDARD_ONLY_RENDERER_INPUT["<b>Prepare renderer input</b>"]

      subgraph STANDARD_ONLY_RENDERER_DATA["intermOutputs.rendererOutput = runRenderer(input)"]
        direction TB

        STANDARD_ONLY_RENDERER_ROLE["<b>Rôle :</b> rédiger la réponse finale à partir du plan composé."]

        subgraph STANDARD_ONLY_RENDERER_IO[" "]
          direction LR

          STANDARD_ONLY_RENDERER_INPUTS["<b>Input</b><br/>
          composerPlannerOutput"]

          STANDARD_ONLY_RENDERER_OUTPUTS["<b>Output</b><br/>
          rendererOutput: processed / fallback<br/>
          content?"]

          STANDARD_ONLY_RENDERER_INPUTS --> STANDARD_ONLY_RENDERER_OUTPUTS
        end

        STANDARD_ONLY_RENDERER_ROLE ~~~ STANDARD_ONLY_RENDERER_IO
      end

      R_STANDARD_ONLY_RENDERER_FALLBACK["<b>Possible fallback return</b><br/>
      if rendererOutput.status = fallback"]

      T_STANDARD_ONLY_PATCHES_INPUT["<b>Prepare patches input</b>"]

      subgraph STANDARD_ONLY_PATCHES_DATA["intermOutputs.patchesOutput = buildSupportPatches(input)"]
        direction TB

        STANDARD_ONLY_PATCHES_ROLE["<b>Rôle :</b> construire les patches persistants du tour."]

        subgraph STANDARD_ONLY_PATCHES_IO[" "]
          direction LR

          STANDARD_ONLY_PATCHES_INPUTS["<b>Input</b><br/>
          liveMemory<br/>
          latestUserMessage<br/>
          latestUserAttachments<br/>
          intermOutputs"]

          STANDARD_ONLY_PATCHES_OUTPUTS["<b>Output</b><br/>
          patchesOutput: processed / fallback<br/>
          patches?"]

          STANDARD_ONLY_PATCHES_INPUTS --> STANDARD_ONLY_PATCHES_OUTPUTS
        end

        STANDARD_ONLY_PATCHES_ROLE ~~~ STANDARD_ONLY_PATCHES_IO
      end

      R_STANDARD_ONLY_PATCHES_FALLBACK["<b>Possible fallback return</b><br/>
      if patchesOutput.status = fallback"]

      T_STANDARD_ONLY_RETURN["<b>Return processed</b><br/>
      userResponse = rendererOutput.content<br/>
      patches = patchesOutput.patches"]
    end

    %% =====================================================
    %% 5. DEEP SUPPORT ANALYSIS
    %% =====================================================

    T_SUPPORT_ROUTE{"<b>Enabled deep support paths?</b><br/>
    depending on support_relevant outputs"}

    T_SUPPORT_TEXT_INPUT["<b>Prepare analyzeSupportTextInput</b>"]

    subgraph SUPPORT_TEXT_DATA["intermOutputs.analyzeSupportTextOutput = runAnalyzeSupportText(input)"]
      direction TB

      SUPPORT_TEXT_ROLE["<b>Rôle :</b> comprendre localement les segments support : messageAct, champs, actions testées, autres faits et supportDomain."]

      subgraph SUPPORT_TEXT_IO[" "]
        direction LR

        SUPPORT_TEXT_INPUTS["<b>Input</b><br/>
        analyzeTextSurfaceOutput<br/>
        recentInteractionContext"]

        SUPPORT_TEXT_OUTPUTS["<b>Output</b><br/>
        analyzeSupportTextOutput = {<br/>
        status: analyzed / fallback<br/>
        fallbackReason?<br/>
        understandings[]?<br/>
        }"]

        SUPPORT_TEXT_INPUTS --> SUPPORT_TEXT_OUTPUTS
      end

      SUPPORT_TEXT_ROLE ~~~ SUPPORT_TEXT_IO
    end

    R_SUPPORT_TEXT_FALLBACK["<b>Possible fallback return</b><br/>
    if analyzeSupportTextOutput.status = fallback"]

    T_SUPPORT_ATTACHMENT_INPUT["<b>Prepare analyzeSupportAttachmentsInput</b>"]

    subgraph SUPPORT_ATTACHMENT_DATA["intermOutputs.analyzeSupportAttachmentsOutput = runAnalyzeSupportAttachments(input)"]
      direction TB

      SUPPORT_ATTACHMENT_ROLE["<b>Rôle :</b> extraire des attachments sélectionnés les informations support utiles."]

      subgraph SUPPORT_ATTACHMENT_IO[" "]
        direction LR

        SUPPORT_ATTACHMENT_INPUTS["<b>Input</b><br/>
        analyzeAttachmentSurfaceOutput<br/>
        latestUserAttachments<br/>
        recentInteractionContext"]

        SUPPORT_ATTACHMENT_OUTPUTS["<b>Output</b><br/>
        analyzeSupportAttachmentsOutput = {<br/>
        status: analyzed / fallback<br/>
        fallbackReason?<br/>
        attachmentUnderstandings[]?<br/>
        }"]

        SUPPORT_ATTACHMENT_INPUTS --> SUPPORT_ATTACHMENT_OUTPUTS
      end

      SUPPORT_ATTACHMENT_ROLE ~~~ SUPPORT_ATTACHMENT_IO
    end

    R_SUPPORT_ATTACHMENT_FALLBACK["<b>Possible fallback return</b><br/>
    if analyzeSupportAttachmentsOutput.status = fallback"]

    T_WAIT_SUPPORT["<b>Continue after enabled deep support paths</b><br/>
    disabled paths are null"]

    %% =====================================================
    %% 6. TOPIC UPDATES
    %% =====================================================

    T_TOPIC_UPDATE_INPUT["<b>Prepare proposeTopicUpdatesInput</b>"]

    subgraph TOPIC_UPDATE_DATA["intermOutputs.proposeTopicUpdatesOutput = runProposeTopicUpdates(input)"]
      direction TB

      TOPIC_UPDATE_ROLE["<b>Rôle :</b> réconcilier les understandings support avec les topics persistants, sans muter la live memory."]

      subgraph TOPIC_UPDATE_IO[" "]
        direction LR

        TOPIC_UPDATE_INPUTS["<b>Input</b><br/>
        supportUnderstandings<br/>
        liveMemory.topics<br/>
        recentInteractionContext<br/>
        latestUserMessage.content"]

        TOPIC_UPDATE_OUTPUTS["<b>Output</b><br/>
        proposeTopicUpdatesOutput: analyzed / fallback<br/>
        topicUpdatePlans[]?"]

        TOPIC_UPDATE_INPUTS --> TOPIC_UPDATE_OUTPUTS
      end

      TOPIC_UPDATE_ROLE ~~~ TOPIC_UPDATE_IO
    end

    R_TOPIC_UPDATE_FALLBACK["<b>Possible fallback return</b><br/>
    if proposeTopicUpdatesOutput.status = fallback"]

    %% =====================================================
    %% 7. PARALLEL TOPIC BRANCHES
    %% =====================================================

    T_TOPIC_BRANCH_INPUTS["<b>Build topicBranchInputs</b><br/>
    topicUpdatePlans.map(topicUpdatePlan → topicBranchInput)<br/><br/>
    Chaque topicUpdatePlan produit un input dédié<br/>
    pour une branche topic indépendante."]

    subgraph TOPIC_BRANCHES_DATA["topicBranchResults = Promise.all(topicBranchInputs.map(runTopicBranch))"]
      direction TB

      TOPIC_BRANCHES_ROLE["<b>Rôle :</b> lancer N branches topic en parallèle : une branche par topicUpdatePlan."]

      subgraph TOPIC_BRANCHES_IO[" "]
        direction LR

        TOPIC_BRANCHES_INPUTS["<b>Input</b><br/>
        topicBranchInputs[] = [{<br/>
        input<br/>
        topicUpdatePlan<br/>
        supportUnderstandings<br/>
        recentInteractionContext<br/>
        }]"]

        TOPIC_BRANCHES_OUTPUTS["<b>Output</b><br/>
        topicBranchResults[] = [{<br/>
        status: processed / fallback<br/>
        fallbackReason?<br/>
        topicPlannerOutput?<br/>
        topicBranchOutput<br/>
        }]"]

        TOPIC_BRANCHES_INPUTS --> TOPIC_BRANCHES_OUTPUTS
      end

      TOPIC_BRANCHES_ROLE ~~~ TOPIC_BRANCHES_IO
    end

    subgraph TOPIC_BRANCH_PARALLEL_VIEW["Parallel execution detail"]
      direction LR

      TOPIC_BRANCH_1["runTopicBranch<br/>
      topicBranchInput #1"]

      TOPIC_BRANCH_2["runTopicBranch<br/>
      topicBranchInput #2"]

      TOPIC_BRANCH_N["runTopicBranch<br/>
      topicBranchInput #N"]

      TOPIC_BRANCH_1 ~~~ TOPIC_BRANCH_2
      TOPIC_BRANCH_2 ~~~ TOPIC_BRANCH_N
    end

    R_TOPIC_BRANCH_FALLBACK["<b>Possible fallback return</b><br/>
    if any topicBranchResult.status = fallback"]

    T_COLLECT_TOPIC_PLANS["<b>Collect topicPlannerOutputs</b><br/>
    topicBranchResults.map(topicPlannerOutput)"]

    %% =====================================================
    %% 8. SUPPORT COMPOSER / RENDERER / PATCHES
    %% =====================================================

    T_SUPPORT_COMPOSER_INPUT["<b>Prepare support composer input</b>"]

    subgraph SUPPORT_COMPOSER_DATA["intermOutputs.composerPlannerOutput = runComposerPlanner(input)"]
      direction TB

      SUPPORT_COMPOSER_ROLE["<b>Rôle :</b> composer la réponse globale à partir des fragments standards et des plans topic."]

      subgraph SUPPORT_COMPOSER_IO[" "]
        direction LR

        SUPPORT_COMPOSER_INPUTS["<b>Input</b><br/>
        mode = support<br/>
        standardResponseFragments<br/>
        topicPlannerOutputs"]

        SUPPORT_COMPOSER_OUTPUTS["<b>Output</b><br/>
        composerPlannerOutput: processed / fallback"]

        SUPPORT_COMPOSER_INPUTS --> SUPPORT_COMPOSER_OUTPUTS
      end

      SUPPORT_COMPOSER_ROLE ~~~ SUPPORT_COMPOSER_IO
    end

    R_SUPPORT_COMPOSER_FALLBACK["<b>Possible fallback return</b><br/>
    if composerPlannerOutput.status = fallback"]

    T_RENDERER_INPUT["<b>Prepare renderer input</b>"]

    subgraph RENDERER_DATA["intermOutputs.rendererOutput = runRenderer(input)"]
      direction TB

      RENDERER_ROLE["<b>Rôle :</b> rédiger la réponse finale depuis le plan composé, sans redécider la stratégie support."]

      subgraph RENDERER_IO[" "]
        direction LR

        RENDERER_INPUTS["<b>Input</b><br/>
        composerPlannerOutput"]

        RENDERER_OUTPUTS["<b>Output</b><br/>
        rendererOutput: processed / fallback<br/>
        content?"]

        RENDERER_INPUTS --> RENDERER_OUTPUTS
      end

      RENDERER_ROLE ~~~ RENDERER_IO
    end

    R_RENDERER_FALLBACK["<b>Possible fallback return</b><br/>
    if rendererOutput.status = fallback"]

    T_PATCHES_INPUT["<b>Prepare patches input</b>"]

    subgraph PATCHES_DATA["intermOutputs.patchesOutput = buildSupportPatches(input)"]
      direction TB

      PATCHES_ROLE["<b>Rôle :</b> construire les modifications persistantes produites par le traitement."]

      subgraph PATCHES_IO[" "]
        direction LR

        PATCHES_INPUTS["<b>Input</b><br/>
        liveMemory<br/>
        latestUserMessage<br/>
        latestUserAttachments<br/>
        intermOutputs"]

        PATCHES_OUTPUTS["<b>Output</b><br/>
        patchesOutput: processed / fallback<br/>
        patches?"]

        PATCHES_INPUTS --> PATCHES_OUTPUTS
      end

      PATCHES_ROLE ~~~ PATCHES_IO
    end

    R_PATCHES_FALLBACK["<b>Possible fallback return</b><br/>
    if patchesOutput.status = fallback"]

    T_RETURN["<b>Return processed</b><br/>
    userResponse = rendererOutput.content<br/>
    patches = patchesOutput.patches<br/>
    intermOutputs"]

    R_UNEXPECTED_FALLBACK["<b>Possible unexpected fallback</b><br/>
    catch runner_or_unexpected<br/>
    buildPipelineFallback(...)"]

    %% =====================================================
    %% LINKS
    %% =====================================================

    T_PROMPT_SECURITY_INPUT --> PROMPT_SECURITY_DATA
    PROMPT_SECURITY_DATA --> T_TURN_PLAN_INPUT
    T_TURN_PLAN_INPUT --> TURN_PLAN_DATA
    TURN_PLAN_DATA --> R_NOT_ANALYZED
    R_NOT_ANALYZED -.-> T_SURFACE_ROUTE

    T_SURFACE_ROUTE -->|analyzeText| T_TEXT_SURFACE_INPUT
    T_SURFACE_ROUTE -->|analyzeAttachments| T_ATTACHMENT_SURFACE_INPUT

    T_TEXT_SURFACE_INPUT --> TEXT_SURFACE_DATA
    TEXT_SURFACE_DATA --> R_TEXT_SURFACE_FALLBACK
    R_TEXT_SURFACE_FALLBACK -.-> T_WAIT_SURFACE

    T_ATTACHMENT_SURFACE_INPUT --> ATTACHMENT_SURFACE_DATA
    ATTACHMENT_SURFACE_DATA --> R_ATTACHMENT_SURFACE_FALLBACK
    R_ATTACHMENT_SURFACE_FALLBACK -.-> T_WAIT_SURFACE

    T_WAIT_SURFACE --> T_STANDARD_INPUT
    T_STANDARD_INPUT --> STANDARD_DATA
    STANDARD_DATA --> T_SUPPORT_GATE

    T_SUPPORT_GATE -->|no support_relevant| T_STANDARD_ONLY_COMPOSER_INPUT
    T_SUPPORT_GATE -->|support_relevant| T_SUPPORT_ROUTE

    T_STANDARD_ONLY_COMPOSER_INPUT --> STANDARD_ONLY_COMPOSER_DATA
    STANDARD_ONLY_COMPOSER_DATA --> R_STANDARD_ONLY_COMPOSER_FALLBACK
    R_STANDARD_ONLY_COMPOSER_FALLBACK -.-> T_STANDARD_ONLY_RENDERER_INPUT
    T_STANDARD_ONLY_RENDERER_INPUT --> STANDARD_ONLY_RENDERER_DATA
    STANDARD_ONLY_RENDERER_DATA --> R_STANDARD_ONLY_RENDERER_FALLBACK
    R_STANDARD_ONLY_RENDERER_FALLBACK -.-> T_STANDARD_ONLY_PATCHES_INPUT
    T_STANDARD_ONLY_PATCHES_INPUT --> STANDARD_ONLY_PATCHES_DATA
    STANDARD_ONLY_PATCHES_DATA --> R_STANDARD_ONLY_PATCHES_FALLBACK
    R_STANDARD_ONLY_PATCHES_FALLBACK -.-> T_STANDARD_ONLY_RETURN

    T_SUPPORT_ROUTE -->|support text| T_SUPPORT_TEXT_INPUT
    T_SUPPORT_ROUTE -->|support attachments| T_SUPPORT_ATTACHMENT_INPUT

    T_SUPPORT_TEXT_INPUT --> SUPPORT_TEXT_DATA
    SUPPORT_TEXT_DATA --> R_SUPPORT_TEXT_FALLBACK
    R_SUPPORT_TEXT_FALLBACK -.-> T_WAIT_SUPPORT

    T_SUPPORT_ATTACHMENT_INPUT --> SUPPORT_ATTACHMENT_DATA
    SUPPORT_ATTACHMENT_DATA --> R_SUPPORT_ATTACHMENT_FALLBACK
    R_SUPPORT_ATTACHMENT_FALLBACK -.-> T_WAIT_SUPPORT

    T_WAIT_SUPPORT --> T_TOPIC_UPDATE_INPUT
    T_TOPIC_UPDATE_INPUT --> TOPIC_UPDATE_DATA
    TOPIC_UPDATE_DATA --> R_TOPIC_UPDATE_FALLBACK
    R_TOPIC_UPDATE_FALLBACK -.-> T_TOPIC_BRANCH_INPUTS

    T_TOPIC_BRANCH_INPUTS --> TOPIC_BRANCHES_DATA
    TOPIC_BRANCHES_DATA -.-> TOPIC_BRANCH_PARALLEL_VIEW
    TOPIC_BRANCHES_DATA --> R_TOPIC_BRANCH_FALLBACK
    R_TOPIC_BRANCH_FALLBACK -.-> T_COLLECT_TOPIC_PLANS

    T_COLLECT_TOPIC_PLANS --> T_SUPPORT_COMPOSER_INPUT
    T_SUPPORT_COMPOSER_INPUT --> SUPPORT_COMPOSER_DATA
    SUPPORT_COMPOSER_DATA --> R_SUPPORT_COMPOSER_FALLBACK
    R_SUPPORT_COMPOSER_FALLBACK -.-> T_RENDERER_INPUT
    T_RENDERER_INPUT --> RENDERER_DATA
    RENDERER_DATA --> R_RENDERER_FALLBACK
    R_RENDERER_FALLBACK -.-> T_PATCHES_INPUT
    T_PATCHES_INPUT --> PATCHES_DATA
    PATCHES_DATA --> R_PATCHES_FALLBACK
    R_PATCHES_FALLBACK -.-> T_RETURN

    R_UNEXPECTED_FALLBACK -.-> T_RETURN
  end

  %% =====================================================
  %% NEXT STEP
  %% =====================================================

  subgraph NEXT_STEP["Next step"]
    direction TB

    NEXT_OUTPUTS["<b>Outputs produced by runSupportProcessingPipelineV3Optimized</b><br/>
    status<br/>
    fallbackReason<br/>
    userResponse<br/>
    patches<br/>
    intermOutputs"]
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
  classDef decisionBlock fill:#fff2cc,stroke:#d6b656,color:#000000,stroke-width:1px;
  classDef earlyReturnBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px,stroke-dasharray: 5 5;
  classDef parallelHintBlock fill:#eeeeee,stroke:#777777,color:#000000,stroke-width:1px,stroke-dasharray: 5 5;
  classDef roleBlock fill:#333333,stroke:#333333,color:#ffffff,stroke-width:0px;
  classDef nextOutputBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;
  class NEXT_OUTPUTS nextOutputBlock;

  class PROMPT_SECURITY_INPUTS,TURN_PLAN_INPUTS,TEXT_SURFACE_INPUTS,ATTACHMENT_SURFACE_INPUTS,STANDARD_INPUTS,STANDARD_ONLY_COMPOSER_INPUTS,STANDARD_ONLY_RENDERER_INPUTS,STANDARD_ONLY_PATCHES_INPUTS,SUPPORT_TEXT_INPUTS,SUPPORT_ATTACHMENT_INPUTS,TOPIC_UPDATE_INPUTS,TOPIC_BRANCHES_INPUTS,SUPPORT_COMPOSER_INPUTS,RENDERER_INPUTS,PATCHES_INPUTS inputBlock;

  class PROMPT_SECURITY_OUTPUTS,TURN_PLAN_OUTPUTS,TEXT_SURFACE_OUTPUTS,ATTACHMENT_SURFACE_OUTPUTS,STANDARD_OUTPUTS,STANDARD_ONLY_COMPOSER_OUTPUTS,STANDARD_ONLY_RENDERER_OUTPUTS,STANDARD_ONLY_PATCHES_OUTPUTS,SUPPORT_TEXT_OUTPUTS,SUPPORT_ATTACHMENT_OUTPUTS,TOPIC_UPDATE_OUTPUTS,TOPIC_BRANCHES_OUTPUTS,SUPPORT_COMPOSER_OUTPUTS,RENDERER_OUTPUTS,PATCHES_OUTPUTS outputBlock;

  class T_PROMPT_SECURITY_INPUT,T_TURN_PLAN_INPUT,T_SURFACE_ROUTE,T_TEXT_SURFACE_INPUT,T_ATTACHMENT_SURFACE_INPUT,T_WAIT_SURFACE,T_STANDARD_INPUT,T_SUPPORT_GATE,T_STANDARD_ONLY_COMPOSER_INPUT,T_STANDARD_ONLY_RENDERER_INPUT,T_STANDARD_ONLY_PATCHES_INPUT,T_STANDARD_ONLY_RETURN,T_SUPPORT_ROUTE,T_SUPPORT_TEXT_INPUT,T_SUPPORT_ATTACHMENT_INPUT,T_WAIT_SUPPORT,T_TOPIC_UPDATE_INPUT,T_TOPIC_BRANCH_INPUTS,T_COLLECT_TOPIC_PLANS,T_SUPPORT_COMPOSER_INPUT,T_RENDERER_INPUT,T_PATCHES_INPUT,T_RETURN processingBlock;

  class R_NOT_ANALYZED,R_TEXT_SURFACE_FALLBACK,R_ATTACHMENT_SURFACE_FALLBACK,R_STANDARD_ONLY_COMPOSER_FALLBACK,R_STANDARD_ONLY_RENDERER_FALLBACK,R_STANDARD_ONLY_PATCHES_FALLBACK,R_SUPPORT_TEXT_FALLBACK,R_SUPPORT_ATTACHMENT_FALLBACK,R_TOPIC_UPDATE_FALLBACK,R_TOPIC_BRANCH_FALLBACK,R_SUPPORT_COMPOSER_FALLBACK,R_RENDERER_FALLBACK,R_PATCHES_FALLBACK,R_UNEXPECTED_FALLBACK earlyReturnBlock;

  class TOPIC_BRANCH_1,TOPIC_BRANCH_2,TOPIC_BRANCH_N parallelHintBlock;

  class PROMPT_SECURITY_ROLE,TURN_PLAN_ROLE,TEXT_SURFACE_ROLE,ATTACHMENT_SURFACE_ROLE,STANDARD_ROLE,STANDARD_ONLY_COMPOSER_ROLE,STANDARD_ONLY_RENDERER_ROLE,STANDARD_ONLY_PATCHES_ROLE,SUPPORT_TEXT_ROLE,SUPPORT_ATTACHMENT_ROLE,TOPIC_UPDATE_ROLE,TOPIC_BRANCHES_ROLE,SUPPORT_COMPOSER_ROLE,RENDERER_ROLE,PATCHES_ROLE roleBlock;

  style PIPELINE fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style PREVIOUS_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;
  style NEXT_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;

  style PROMPT_SECURITY_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TURN_PLAN_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TEXT_SURFACE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style ATTACHMENT_SURFACE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style STANDARD_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style STANDARD_ONLY_ROUTE fill:#f5f5f5,stroke:#777777,stroke-width:1px,stroke-dasharray: 5 5,color:#000000;
  style STANDARD_ONLY_COMPOSER_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style STANDARD_ONLY_RENDERER_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style STANDARD_ONLY_PATCHES_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SUPPORT_TEXT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style SUPPORT_ATTACHMENT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TOPIC_UPDATE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TOPIC_BRANCHES_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TOPIC_BRANCH_PARALLEL_VIEW fill:#f5f5f5,stroke:#777777,stroke-width:1px,stroke-dasharray: 5 5,color:#000000;
  style SUPPORT_COMPOSER_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style RENDERER_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style PATCHES_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  style PROMPT_SECURITY_IO fill:transparent,stroke:transparent,color:#ffffff;
  style TURN_PLAN_IO fill:transparent,stroke:transparent,color:#ffffff;
  style TEXT_SURFACE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style ATTACHMENT_SURFACE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style STANDARD_IO fill:transparent,stroke:transparent,color:#ffffff;
  style STANDARD_ONLY_COMPOSER_IO fill:transparent,stroke:transparent,color:#ffffff;
  style STANDARD_ONLY_RENDERER_IO fill:transparent,stroke:transparent,color:#ffffff;
  style STANDARD_ONLY_PATCHES_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SUPPORT_TEXT_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SUPPORT_ATTACHMENT_IO fill:transparent,stroke:transparent,color:#ffffff;
  style TOPIC_UPDATE_IO fill:transparent,stroke:transparent,color:#ffffff;
  style TOPIC_BRANCHES_IO fill:transparent,stroke:transparent,color:#ffffff;
  style SUPPORT_COMPOSER_IO fill:transparent,stroke:transparent,color:#ffffff;
  style RENDERER_IO fill:transparent,stroke:transparent,color:#ffffff;
  style PATCHES_IO fill:transparent,stroke:transparent,color:#ffffff;

  linkStyle default stroke:#000000,stroke-width:2px;
  ```