```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 22, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB
  subgraph PREVIOUS_STEP["Previous step"]
    direction TB
    PREVIOUS_INPUTS["<b>Input provided to runAnalysisGate</b><br/>
    analysisGateInput = {<br/>
    latestUserMessage<br/>
    }"]
  end

  subgraph PIPELINE["6.4 analysisGate = runAnalysisGate(analysisGateInput)"]
    direction TB

    T_EXTRACT_MESSAGE["<b>Extract latest user message content</b><br/>
    latestUserMessageContent = latestUserMessage.content.trim()"]

    subgraph FULL_DIRECT_DATA["preferFullDirect = collectFullDirectChecks(latestUserMessageContent)"]
      direction LR

      FULL_DIRECT_INPUTS["<b>Input</b><br/>
      latestUserMessageContent"]

      FULL_DIRECT_OUTPUTS["<b>Output</b><br/>
      preferFullDirect: AnalysisGateCheckName[]<br/><br/>
      Possible checks:<br/>
      explicit_bug_or_error<br/>
      explicit_access_security_issue<br/>
      explicit_billing_issue<br/>
      explicit_question_or_request<br/>
      actionable_trigger_context<br/>
      error_code_detected<br/>
      detailed_actionable_message"]

      FULL_DIRECT_INPUTS --> FULL_DIRECT_OUTPUTS
    end

    subgraph LIGHT_FIRST_DATA["preferLightFirst = collectLightFirstChecks(latestUserMessageContent, preferFullDirect)"]
      direction LR

      LIGHT_FIRST_INPUTS["<b>Input</b><br/>
      latestUserMessageContent<br/>
      preferFullDirect"]

      LIGHT_FIRST_OUTPUTS["<b>Output</b><br/>
      preferLightFirst: AnalysisGateCheckName[]<br/><br/>
      Possible checks:<br/>
      empty_message<br/>
      short_message<br/>
      pure_signal_message<br/>
      closure_or_confirmation_message<br/>
      scope_boundary_candidate<br/>
      vague_complaint_without_actionable_detail<br/>
      ambiguous_message_without_actionable_detail"]

      LIGHT_FIRST_INPUTS --> LIGHT_FIRST_OUTPUTS
    end

    T_DECISION["<b>Decide route</b><br/>
    route = decideRoute({<br/>
    preferLightFirst,<br/>
    preferFullDirect<br/>
    })<br/><br/>
    If preferFullDirect has checks:<br/>
    route = full_weight_direct<br/><br/>
    Else:<br/>
    route = light_weight_first"]

    T_RETURN["<b>Return analysisGate</b><br/>
    analysisGate = {<br/>
    decision: {<br/>
    route: light_weight_first / full_weight_direct<br/>
    }<br/>
    history: {<br/>
    prefer_light_first: AnalysisGateCheckName[]<br/>
    prefer_full_direct: AnalysisGateCheckName[]<br/>
    }<br/>
    }"]

    T_EXTRACT_MESSAGE --> FULL_DIRECT_DATA
    FULL_DIRECT_DATA --> LIGHT_FIRST_DATA
    LIGHT_FIRST_DATA --> T_DECISION
    T_DECISION --> T_RETURN
  end

  subgraph NEXT_STEP["Next step"]
    direction TB
    NEXT_OUTPUTS["<b>Output produced by runAnalysisGate</b><br/>
    analysisGate"]
  end

  PREVIOUS_STEP --> PIPELINE
  PIPELINE --> NEXT_STEP

  classDef previousBlock fill:#0b6b3a,stroke:#064a28,color:#ffffff,stroke-width:1px;
  classDef inputBlock fill:#d5e8d4,stroke:#82b366,color:#000000,stroke-width:1px;
  classDef outputBlock fill:#f8cecc,stroke:#b85450,color:#000000,stroke-width:1px;
  classDef processingBlock fill:#d9e8f5,stroke:#4f93d2,color:#000000,stroke-width:1px;
  classDef nextOutputBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;

  class FULL_DIRECT_INPUTS,LIGHT_FIRST_INPUTS inputBlock;
  class FULL_DIRECT_OUTPUTS,LIGHT_FIRST_OUTPUTS outputBlock;

  class T_EXTRACT_MESSAGE,T_DECISION,T_RETURN processingBlock;

  class NEXT_OUTPUTS nextOutputBlock;

  style PIPELINE fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style PREVIOUS_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;
  style NEXT_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;

  style FULL_DIRECT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style LIGHT_FIRST_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  linkStyle default stroke:#000000,stroke-width:2px;
  ```