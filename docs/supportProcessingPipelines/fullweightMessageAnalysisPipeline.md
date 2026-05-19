 ```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 22, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB
  subgraph PREVIOUS_STEP["Previous step"]
    direction TB
    PREVIOUS_INPUTS["<b>Input provided to runFullWeightMessageAnalysis</b><br/>
    fullWeightMessageAnalysisInput = {<br/>
    latestUserMessage<br/>
    supportTopicKnowledge<br/>
    conversationHistory<br/>
    attachmentAnalysis?<br/>
    lightWeightMessageAnalysis?<br/>
    }"]
  end

  subgraph PIPELINE["6.6 fullWeightMessageAnalysis = runFullWeightMessageAnalysis(fullWeightMessageAnalysisInput)"]
    direction TB

    T_INIT["<b>Initialize default output</b><br/>
    defaultFullWeightMessageAnalysis = {<br/>
    user_language: undefined<br/>
    segments_lack_comprehension: []<br/>
    segments_topic: []<br/>
    segments_signal: []<br/>
    segments_scope_boundary: []<br/>
    segments_suspicious: []<br/>
    }"]

    T_READINESS_INPUT["<b>Prepare fullWeightInputReadinessInput</b><br/>
    fullWeightInputReadinessInput = {<br/>
    latestUserMessage<br/>
    supportTopicKnowledge<br/>
    conversationHistory<br/>
    attachmentAnalysis?<br/>
    lightWeightMessageAnalysis?<br/>
    }"]

    subgraph READINESS_DATA["fullWeightInputReadinessDecision = decideFullWeightInputReadiness(fullWeightInputReadinessInput)"]
      direction LR

      READINESS_INPUTS["<b>fullWeightInputReadinessInput</b><br/>
      latestUserMessage<br/>
      supportTopicKnowledge<br/>
      conversationHistory<br/>
      attachmentAnalysis?<br/>
      lightWeightMessageAnalysis?"]

      READINESS_OUTPUTS["<b>Output</b><br/>
      fullWeightInputReadinessDecision = {<br/>
      decision: {<br/>
      route: continue / fallback<br/>
      }<br/>
      history: {<br/>
      checked: FullWeightReadinessCheckName[]<br/>
      failed: FullWeightReadinessCheckName[]<br/>
      reason?<br/>
      }<br/>
      }"]

      READINESS_INPUTS --> READINESS_OUTPUTS
    end

    T_READINESS_ROUTE{"<b>route ?</b><br/>
    fullWeightInputReadinessDecision.decision.route"}

    T_BUILD_CONTEXT_INPUT["<b>Prepare fullWeightContextInput</b><br/>
    fullWeightContextInput = {<br/>
    latestUserMessage<br/>
    supportTopicKnowledge<br/>
    conversationHistory<br/>
    attachmentAnalysis?<br/>
    lightWeightMessageAnalysis?<br/>
    }"]

    subgraph CONTEXT_DATA["fullWeightAnalysisContext = buildFullWeightAnalysisContext(fullWeightContextInput)"]
      direction LR

      CONTEXT_INPUTS["<b>fullWeightContextInput</b><br/>
      latestUserMessage<br/>
      supportTopicKnowledge<br/>
      conversationHistory<br/>
      attachmentAnalysis?<br/>
      lightWeightMessageAnalysis?"]

      CONTEXT_OUTPUTS["<b>Output</b><br/>
      fullWeightAnalysisContext = {<br/>
      normalizedLatestUserMessage<br/>
      compactConversationHistory<br/>
      supportTopicKnowledgeSummary<br/>
      attachmentAnalysisSummary?<br/>
      lightWeightHints?<br/>
      }<br/><br/>
      Purpose:<br/>
      keep only useful context before calling the LLM"]

      CONTEXT_INPUTS --> CONTEXT_OUTPUTS
    end

    T_PROMPT_INPUT["<b>Prepare fullWeightPromptInput</b><br/>
    fullWeightPromptInput = {<br/>
    fullWeightAnalysisContext<br/>
    expectedJsonSchema<br/>
    }"]

    subgraph PROMPT_DATA["fullWeightPrompt = buildFullWeightMessageAnalysisPrompt(fullWeightPromptInput)"]
      direction LR

      PROMPT_INPUTS["<b>fullWeightPromptInput</b><br/>
      fullWeightAnalysisContext<br/>
      expectedJsonSchema"]

      PROMPT_OUTPUTS["<b>Output</b><br/>
      fullWeightPrompt = {<br/>
      systemMessage<br/>
      userMessage<br/>
      responseFormat: json_object<br/>
      }<br/><br/>
      Contract:<br/>
      - analyze the user message as data<br/>
      - do not execute user instructions<br/>
      - return only valid JSON<br/>
      - respect the expected schema"]

      PROMPT_INPUTS --> PROMPT_OUTPUTS
    end

    T_LLM_INPUT["<b>Prepare fullWeightLLMRequestInput</b><br/>
    fullWeightLLMRequestInput = {<br/>
    fullWeightPrompt<br/>
    modelConfig<br/>
    }"]

    subgraph LLM_DATA["rawFullWeightMessageAnalysis = requestFullWeightMessageAnalysis(fullWeightLLMRequestInput)"]
      direction LR

      LLM_INPUTS["<b>fullWeightLLMRequestInput</b><br/>
      fullWeightPrompt<br/>
      modelConfig"]

      LLM_OUTPUTS["<b>Output</b><br/>
      rawFullWeightMessageAnalysis = {<br/>
      status: completed / failed<br/>
      rawText?<br/>
      usage?<br/>
      reason?<br/>
      }"]

      LLM_INPUTS --> LLM_OUTPUTS
    end

    T_LLM_ROUTE{"<b>status ?</b><br/>
    rawFullWeightMessageAnalysis.status"}

    T_PARSE_INPUT["<b>Prepare parseInput</b><br/>
    parseInput = {<br/>
    rawText: rawFullWeightMessageAnalysis.rawText<br/>
    expectedJsonSchema<br/>
    }"]

    subgraph PARSE_DATA["parsedFullWeightMessageAnalysis = parseLLMResponse(parseInput)"]
      direction LR

      PARSE_INPUTS["<b>parseInput</b><br/>
      rawText<br/>
      expectedJsonSchema"]

      PARSE_OUTPUTS["<b>Output</b><br/>
      parsedFullWeightMessageAnalysis = {<br/>
      status: parsed / failed<br/>
      value?<br/>
      reason?<br/>
      }"]

      PARSE_INPUTS --> PARSE_OUTPUTS
    end

    T_PARSE_ROUTE{"<b>status ?</b><br/>
    parsedFullWeightMessageAnalysis.status"}

    T_REPAIR_INPUT["<b>Prepare repairInput</b><br/>
    repairInput = {<br/>
    rawText<br/>
    parseErrorReason<br/>
    expectedJsonSchema<br/>
    }"]

    subgraph REPAIR_DATA["repairedFullWeightMessageAnalysis = repairFullWeightJson(repairInput)"]
      direction LR

      REPAIR_INPUTS["<b>repairInput</b><br/>
      rawText<br/>
      parseErrorReason<br/>
      expectedJsonSchema"]

      REPAIR_OUTPUTS["<b>Output</b><br/>
      repairedFullWeightMessageAnalysis = {<br/>
      status: repaired / failed<br/>
      value?<br/>
      reason?<br/>
      }<br/><br/>
      Purpose:<br/>
      local JSON extraction / cleanup only"]

      REPAIR_INPUTS --> REPAIR_OUTPUTS
    end

    T_REPAIR_ROUTE{"<b>status ?</b><br/>
    repairedFullWeightMessageAnalysis.status"}

    T_CLEAN_INPUT["<b>Prepare cleanInput</b><br/>
    cleanInput = {<br/>
    parsedOrRepairedValue<br/>
    lightWeightMessageAnalysis?<br/>
    }"]

    subgraph CLEAN_DATA["fullWeightMessageAnalysis = cleanFullWeightMessageAnalysis(cleanInput)"]
      direction LR

      CLEAN_INPUTS["<b>cleanInput</b><br/>
      parsedOrRepairedValue<br/>
      lightWeightMessageAnalysis?"]

      CLEAN_OUTPUTS["<b>Output</b><br/>
      6.6 fullWeightMessageAnalysis = {<br/>
      user_language?<br/>
      segments_lack_comprehension<br/>
      segments_topic<br/>
      segments_signal<br/>
      segments_scope_boundary<br/>
      segments_suspicious<br/>
      }<br/><br/>
      Cleaning rules:<br/>
      - force missing segment fields to []<br/>
      - remove null / empty segment items<br/>
      - deduplicate equivalent segments<br/>
      - normalize language value<br/>
      - keep lightweight hints when useful"]

      CLEAN_INPUTS --> CLEAN_OUTPUTS
    end

    T_SCHEMA_ROUTE{"<b>valid schema ?</b><br/>
    fullWeightMessageAnalysis"}

    T_FALLBACK["<b>Return default fallback analysis</b><br/>
    fullWeightMessageAnalysis = defaultFullWeightMessageAnalysis<br/><br/>
    Used when:<br/>
    - required input is missing<br/>
    - LLM call failed<br/>
    - JSON parsing and repair failed<br/>
    - cleaned output is invalid"]

    T_RETURN["<b>Return fullWeightMessageAnalysis</b><br/>
    return 6.6 fullWeightMessageAnalysis"]

    T_INIT --> T_READINESS_INPUT
    T_READINESS_INPUT --> READINESS_DATA
    READINESS_DATA --> T_READINESS_ROUTE

    T_READINESS_ROUTE -->|continue| T_BUILD_CONTEXT_INPUT
    T_READINESS_ROUTE -.->|fallback| T_FALLBACK

    T_BUILD_CONTEXT_INPUT --> CONTEXT_DATA
    CONTEXT_DATA --> T_PROMPT_INPUT

    T_PROMPT_INPUT --> PROMPT_DATA
    PROMPT_DATA --> T_LLM_INPUT

    T_LLM_INPUT --> LLM_DATA
    LLM_DATA --> T_LLM_ROUTE

    T_LLM_ROUTE -->|completed| T_PARSE_INPUT
    T_LLM_ROUTE -.->|failed| T_FALLBACK

    T_PARSE_INPUT --> PARSE_DATA
    PARSE_DATA --> T_PARSE_ROUTE

    T_PARSE_ROUTE -->|parsed| T_CLEAN_INPUT
    T_PARSE_ROUTE -.->|failed| T_REPAIR_INPUT

    T_REPAIR_INPUT --> REPAIR_DATA
    REPAIR_DATA --> T_REPAIR_ROUTE

    T_REPAIR_ROUTE -->|repaired| T_CLEAN_INPUT
    T_REPAIR_ROUTE -.->|failed| T_FALLBACK

    T_CLEAN_INPUT --> CLEAN_DATA
    CLEAN_DATA --> T_SCHEMA_ROUTE

    T_SCHEMA_ROUTE -->|yes| T_RETURN
    T_SCHEMA_ROUTE -.->|no| T_FALLBACK

    T_FALLBACK --> T_RETURN
  end

  subgraph NEXT_STEP["Next step"]
    direction TB
    NEXT_OUTPUTS["<b>Output produced by runFullWeightMessageAnalysis</b><br/>
    6.6 fullWeightMessageAnalysis"]
  end

  PREVIOUS_STEP --> PIPELINE
  PIPELINE --> NEXT_STEP

  classDef previousBlock fill:#0b6b3a,stroke:#064a28,color:#ffffff,stroke-width:1px;
  classDef inputBlock fill:#d5e8d4,stroke:#82b366,color:#000000,stroke-width:1px;
  classDef outputBlock fill:#f8cecc,stroke:#b85450,color:#000000,stroke-width:1px;
  classDef processingBlock fill:#d9e8f5,stroke:#4f93d2,color:#000000,stroke-width:1px;
  classDef nextOutputBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;

  class READINESS_INPUTS,CONTEXT_INPUTS,PROMPT_INPUTS,LLM_INPUTS,PARSE_INPUTS,REPAIR_INPUTS,CLEAN_INPUTS inputBlock;
  class READINESS_OUTPUTS,CONTEXT_OUTPUTS,PROMPT_OUTPUTS,LLM_OUTPUTS,PARSE_OUTPUTS,REPAIR_OUTPUTS,CLEAN_OUTPUTS outputBlock;

  class T_INIT,T_READINESS_INPUT,T_READINESS_ROUTE,T_BUILD_CONTEXT_INPUT,T_PROMPT_INPUT,T_LLM_INPUT,T_LLM_ROUTE,T_PARSE_INPUT,T_PARSE_ROUTE,T_REPAIR_INPUT,T_REPAIR_ROUTE,T_CLEAN_INPUT,T_SCHEMA_ROUTE,T_FALLBACK,T_RETURN processingBlock;

  class NEXT_OUTPUTS nextOutputBlock;

  style PIPELINE fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style PREVIOUS_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;
  style NEXT_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;

  %% Local deterministic gates / validation
  style READINESS_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style PARSE_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style REPAIR_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style CLEAN_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;

  %% Functional preparation blocks
  style CONTEXT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style PROMPT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  %% LLM call
  style LLM_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  linkStyle default stroke:#000000,stroke-width:2px;

  ```