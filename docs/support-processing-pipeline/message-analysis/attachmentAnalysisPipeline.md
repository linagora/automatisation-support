```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 22, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB
  subgraph PREVIOUS_STEP["Previous step"]
    direction TB
    PREVIOUS_INPUTS["<b>Input provided to runAttachmentAnalysis</b><br/>
    attachmentAnalysisInput = {<br/>
    latestUserMessage<br/>
    latestUserAttachments<br/>
    }"]
  end

  subgraph PIPELINE["6.2 attachmentAnalysis = runAttachmentAnalysis(attachmentAnalysisInput)"]
    direction TB

    T_INIT_OUTPUT["<b>Initialize output</b><br/>
    attachmentAnalysis = []<br/><br/>
    This array is also used as accumulated context<br/>
    for the next attachment analyses"]

    subgraph FOR_EACH_ATTACHMENT["For each attachment in latestUserAttachments"]
      direction TB

      T_READINESS_INPUT["<b>Prepare attachmentReadinessDecisionInput</b><br/>
      attachmentReadinessDecisionInput = {<br/>
      attachmentIndex<br/>
      attachmentAnalysis<br/>
      }"]

      subgraph READINESS_DATA["attachmentReadinessDecision = decideAttachmentReadiness(attachmentReadinessDecisionInput)"]
        direction LR

        READINESS_INPUTS["<b>attachmentReadinessDecisionInput</b><br/>
        attachmentIndex<br/>
        attachmentAnalysis"]

        READINESS_OUTPUTS["<b>Output</b><br/>
        attachmentReadinessDecision = {<br/>
        decision: {<br/>
        route: continue / stop<br/>
        }<br/>
        history: {<br/>
        checked: AttachmentReadinessCheckName[]<br/>
        failed: AttachmentReadinessCheckName[]<br/>
        detectedFormat: image / video / other<br/>
        }<br/>
        }"]

        READINESS_INPUTS --> READINESS_OUTPUTS
      end

      T_READINESS_ROUTE{"<b>route ?</b><br/>
      attachmentReadinessDecision.decision.route"}

      T_REFUSED_ITEM["<b>Build refused item</b><br/>
      attachmentAnalysisItem = {<br/>
      filename<br/>
      status: refused<br/>
      reason: failed checks or attachment_readiness_failed<br/>
      readinessDecision: attachmentReadinessDecision<br/>
      }"]

      T_SEQUENCE_CONTEXT["<b>Update current item with readiness</b><br/>
      attachmentAnalysis[attachmentIndex] includes<br/>
      readinessDecision<br/><br/>
      attachmentAnalysis stays available as context<br/>
      for image / video analysis"]

      T_VISUAL_FORMAT_ROUTE{"<b>visual format ?</b><br/>
      attachmentReadinessDecision.history.detectedFormat<br/><br/>
      Only image or video can reach this point"}

      T_IMAGE_INPUT["<b>Prepare imageAnalysisInput</b><br/>
      imageAnalysisInput = {<br/>
      attachmentIndex<br/>
      latestUserMessage<br/>
      attachmentAnalysis<br/>
      }"]

      subgraph IMAGE_DATA["imageAnalysisResult = requestImageAnalysis(imageAnalysisInput)"]
        direction LR

        IMAGE_INPUTS["<b>imageAnalysisInput</b><br/>
        attachmentIndex<br/>
        latestUserMessage<br/>
        attachmentAnalysis"]

        IMAGE_OUTPUTS["<b>Output</b><br/>
        imageAnalysisResult = {<br/>
        status: analyzed / failed / suspicious<br/>
        reason?<br/>
        analysis?: {<br/>
        llmDescription<br/>
        structuredObservations?<br/>
        relationToPreviousAttachment?<br/>
        }<br/>
        }<br/><br/>
        llmDescription:<br/>
        free textual description of what the LLM sees<br/><br/>
        structuredObservations:<br/>
        provisional structured fields to refine later"]

        IMAGE_INPUTS --> IMAGE_OUTPUTS
      end

      T_IMAGE_ROUTE{"<b>status ?</b><br/>
      imageAnalysisResult.status"}

      T_IMAGE_ANALYZED_ITEM["<b>Build analyzed item</b><br/>
      attachmentAnalysisItem = {<br/>
      filename<br/>
      status: analyzed<br/>
      readinessDecision: attachmentReadinessDecision<br/>
      analysis: {<br/>
      llmDescription<br/>
      structuredObservations?<br/>
      relationToPreviousAttachment?<br/>
      }<br/>
      }"]

      T_IMAGE_FAILED_ITEM["<b>Build failed item</b><br/>
      attachmentAnalysisItem = {<br/>
      filename<br/>
      status: failed<br/>
      reason: imageAnalysisResult.reason<br/>
      readinessDecision: attachmentReadinessDecision<br/>
      }"]

      T_IMAGE_SUSPICIOUS_ITEM["<b>Build suspicious item</b><br/>
      attachmentAnalysisItem = {<br/>
      filename<br/>
      status: suspicious<br/>
      reason: imageAnalysisResult.reason<br/>
      readinessDecision: attachmentReadinessDecision<br/>
      analysis<br/>
      }"]

      T_VIDEO_INPUT["<b>Prepare videoAnalysisInput</b><br/>
      videoAnalysisInput = {<br/>
      attachmentIndex<br/>
      latestUserMessage<br/>
      attachmentAnalysis<br/>
      }"]

      subgraph VIDEO_DATA["videoAnalysisResult = requestVideoAnalysis(videoAnalysisInput)"]
        direction LR

        VIDEO_INPUTS["<b>videoAnalysisInput</b><br/>
        attachmentIndex<br/>
        latestUserMessage<br/>
        attachmentAnalysis"]

        VIDEO_OUTPUTS["<b>Output</b><br/>
        videoAnalysisResult = {<br/>
        status: analyzed / failed / suspicious<br/>
        reason?<br/>
        analysis?: {<br/>
        llmDescription<br/>
        structuredObservations?<br/>
        relationToPreviousAttachment?<br/>
        }<br/>
        }<br/><br/>
        llmDescription:<br/>
        free textual description of what the LLM sees<br/><br/>
        structuredObservations:<br/>
        provisional structured fields to refine later"]

        VIDEO_INPUTS --> VIDEO_OUTPUTS
      end

      T_VIDEO_ROUTE{"<b>status ?</b><br/>
      videoAnalysisResult.status"}

      T_VIDEO_ANALYZED_ITEM["<b>Build analyzed item</b><br/>
      attachmentAnalysisItem = {<br/>
      filename<br/>
      status: analyzed<br/>
      readinessDecision: attachmentReadinessDecision<br/>
      analysis: {<br/>
      llmDescription<br/>
      structuredObservations?<br/>
      relationToPreviousAttachment?<br/>
      }<br/>
      }"]

      T_VIDEO_FAILED_ITEM["<b>Build failed item</b><br/>
      attachmentAnalysisItem = {<br/>
      filename<br/>
      status: failed<br/>
      reason: videoAnalysisResult.reason<br/>
      readinessDecision: attachmentReadinessDecision<br/>
      }"]

      T_VIDEO_SUSPICIOUS_ITEM["<b>Build suspicious item</b><br/>
      attachmentAnalysisItem = {<br/>
      filename<br/>
      status: suspicious<br/>
      reason: videoAnalysisResult.reason<br/>
      readinessDecision: attachmentReadinessDecision<br/>
      analysis<br/>
      }"]

      T_COLLECT["<b>Update current output item</b><br/>
      attachmentAnalysis[attachmentIndex] = attachmentAnalysisItem<br/><br/>
      The updated item remains available as context<br/>
      for the next attachment analysis"]

      T_READINESS_INPUT --> READINESS_DATA
      READINESS_DATA --> T_READINESS_ROUTE

      T_READINESS_ROUTE -->|stop| T_REFUSED_ITEM
      T_REFUSED_ITEM --> T_COLLECT

      T_READINESS_ROUTE -->|continue| T_SEQUENCE_CONTEXT
      T_SEQUENCE_CONTEXT --> T_VISUAL_FORMAT_ROUTE

      T_VISUAL_FORMAT_ROUTE -->|image| T_IMAGE_INPUT
      T_IMAGE_INPUT --> IMAGE_DATA
      IMAGE_DATA --> T_IMAGE_ROUTE
      T_IMAGE_ROUTE -->|analyzed| T_IMAGE_ANALYZED_ITEM
      T_IMAGE_ROUTE -->|failed| T_IMAGE_FAILED_ITEM
      T_IMAGE_ROUTE -->|suspicious| T_IMAGE_SUSPICIOUS_ITEM
      T_IMAGE_ANALYZED_ITEM --> T_COLLECT
      T_IMAGE_FAILED_ITEM --> T_COLLECT
      T_IMAGE_SUSPICIOUS_ITEM --> T_COLLECT

      T_VISUAL_FORMAT_ROUTE -->|video| T_VIDEO_INPUT
      T_VIDEO_INPUT --> VIDEO_DATA
      VIDEO_DATA --> T_VIDEO_ROUTE
      T_VIDEO_ROUTE -->|analyzed| T_VIDEO_ANALYZED_ITEM
      T_VIDEO_ROUTE -->|failed| T_VIDEO_FAILED_ITEM
      T_VIDEO_ROUTE -->|suspicious| T_VIDEO_SUSPICIOUS_ITEM
      T_VIDEO_ANALYZED_ITEM --> T_COLLECT
      T_VIDEO_FAILED_ITEM --> T_COLLECT
      T_VIDEO_SUSPICIOUS_ITEM --> T_COLLECT
    end

    T_RETURN["<b>Return attachmentAnalysis</b><br/>
    attachmentAnalysis = [{<br/>
    filename<br/>
    status: analysis_pending / analyzed / failed / refused / suspicious<br/>
    reason?<br/>
    readinessDecision?: {<br/>
    decision: { route: continue / stop }<br/>
    history: {<br/>
    checked<br/>
    failed<br/>
    detectedFormat: image / video / other<br/>
    }<br/>
    }<br/>
    analysis?: {<br/>
    llmDescription<br/>
    structuredObservations?<br/>
    relationToPreviousAttachment?<br/>
    }<br/>
    }]"]

    T_INIT_OUTPUT --> FOR_EACH_ATTACHMENT
    FOR_EACH_ATTACHMENT --> T_RETURN
  end

  subgraph NEXT_STEP["Next step"]
    direction TB
    NEXT_OUTPUTS["<b>Output produced by runAttachmentAnalysis</b><br/>
    attachmentAnalysis"]
  end

  PREVIOUS_STEP --> PIPELINE
  PIPELINE --> NEXT_STEP

  classDef previousBlock fill:#0b6b3a,stroke:#064a28,color:#ffffff,stroke-width:1px;
  classDef inputBlock fill:#d5e8d4,stroke:#82b366,color:#000000,stroke-width:1px;
  classDef outputBlock fill:#f8cecc,stroke:#b85450,color:#000000,stroke-width:1px;
  classDef processingBlock fill:#d9e8f5,stroke:#4f93d2,color:#000000,stroke-width:1px;
  classDef nextOutputBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;

  class READINESS_INPUTS,IMAGE_INPUTS,VIDEO_INPUTS inputBlock;
  class READINESS_OUTPUTS,IMAGE_OUTPUTS,VIDEO_OUTPUTS outputBlock;

  class T_INIT_OUTPUT,T_READINESS_INPUT,T_READINESS_ROUTE,T_REFUSED_ITEM,T_SEQUENCE_CONTEXT,T_VISUAL_FORMAT_ROUTE,T_IMAGE_INPUT,T_IMAGE_ROUTE,T_IMAGE_ANALYZED_ITEM,T_IMAGE_FAILED_ITEM,T_IMAGE_SUSPICIOUS_ITEM,T_VIDEO_INPUT,T_VIDEO_ROUTE,T_VIDEO_ANALYZED_ITEM,T_VIDEO_FAILED_ITEM,T_VIDEO_SUSPICIOUS_ITEM,T_COLLECT,T_RETURN processingBlock;

  class NEXT_OUTPUTS nextOutputBlock;

  style PIPELINE fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style PREVIOUS_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;
  style NEXT_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;

  %% Per-attachment processing block
  style FOR_EACH_ATTACHMENT fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;

  %% Local deterministic readiness gate
  style READINESS_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;

  %% Model / external analysis calls
  style IMAGE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style VIDEO_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  linkStyle default stroke:#000000,stroke-width:2px;
  ```
