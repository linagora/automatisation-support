```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 22, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB
  subgraph PREVIOUS_STEP["Previous step"]
    direction TB
    PREVIOUS_INPUTS["<b>Inputs provided to runLatestUserMessageSecurity</b><br/>
    latestUserMessageSecurityInput = {<br/>
    latestUserMessage<br/>
    accountTrustStatus<br/>
    }"]
  end

  subgraph PIPELINE["6.1 latestUserMessageSecurityDecision = runLatestUserMessageSecurity(latestUserMessageSecurityInput)"]
    direction TB

    T_INIT["<b>Initialize latestUserMessageSecurityDecision</b><br/>
    latestUserMessageSecurityDecision = {<br/>
    decision: { route: undefined }<br/>
    history: {<br/>
    checked: []<br/>
    failed: []<br/>
    llmReview: undefined<br/>
    }<br/>
    }"]

    T_TEXT_CHECKS_INPUT["<b>Prepare textSecurityChecksInput</b><br/>
    textSecurityChecksInput = {<br/>
    text: latestUserMessage.content<br/>
    }"]

    subgraph TEXT_CHECKS_DATA["textSecurityChecks = runTextSecurityChecks(textSecurityChecksInput)"]
      direction LR
      TEXT_CHECKS_INPUTS["<b>textSecurityChecksInput</b><br/>
      text"]
      TEXT_CHECKS_OUTPUTS["<b>Output</b><br/>
      textSecurityChecks = {<br/>
      checked<br/>
      failed<br/>
      }"]
      TEXT_CHECKS_INPUTS --> TEXT_CHECKS_OUTPUTS
    end

    T_ADD_TEXT_RESULTS["<b>Add text security results</b><br/>
    latestUserMessageSecurityDecision.history.checked +=<br/>
    textSecurityChecks.checked<br/><br/>
    latestUserMessageSecurityDecision.history.failed +=<br/>
    textSecurityChecks.failed"]

    T_TRUST_DECISION_INPUT["<b>Prepare trustDecisionInput</b><br/>
    trustDecisionInput = {<br/>
    textSecurityChecks<br/>
    accountTrustStatus<br/>
    }"]

    subgraph TRUST_DECISION_DATA["trustDecision = decideTextSecurityWithAccountTrust(trustDecisionInput)"]
      direction LR
      TRUST_DECISION_INPUTS["<b>trustDecisionInput</b><br/>
      textSecurityChecks<br/>
      accountTrustStatus"]
      TRUST_DECISION_OUTPUTS["<b>Output</b><br/>
      trustDecision = {<br/>
      route: continue / stop / review_with_llm_truster<br/>
      reason?<br/>
      }"]
      TRUST_DECISION_INPUTS --> TRUST_DECISION_OUTPUTS
    end

    T_TRUST_ROUTE_DECISION{"<b>trustDecision.route ?</b>"}

    T_TEXT_CONTINUE["<b>Add continue decision</b><br/>
    latestUserMessageSecurityDecision.decision.route = continue"]

    T_TEXT_STOP["<b>Add stop decision</b><br/>
    latestUserMessageSecurityDecision.decision.route = stop"]

    T_REVIEW_INPUT["<b>Prepare llmTrusterReviewInput</b><br/>
    llmTrusterReviewInput = {<br/>
    reviewKind: latest_user_message_text_security_checks<br/>
    latestUserMessageContent<br/>
    textSecurityChecks<br/>
    trustDecision: {<br/>
    route: review_with_llm_truster<br/>
    reason?<br/>
    }<br/>
    accountTrustStatus<br/>
    }"]

    subgraph REVIEW_DATA["llmReview = runLlmTrusterReview(llmTrusterReviewInput)"]
      direction LR
      REVIEW_INPUTS["<b>llmTrusterReviewInput</b><br/>
      reviewKind<br/>
      latestUserMessageContent<br/>
      textSecurityChecks<br/>
      trustDecision<br/>
      accountTrustStatus"]
      REVIEW_OUTPUTS["<b>Output</b><br/>
      llmReview = {<br/>
      route: continue / stop / failed<br/>
      reason?: short LLM justification<br/>
      }"]
      REVIEW_INPUTS --> REVIEW_OUTPUTS
    end

    T_REVIEW_ROUTE{"<b>llmReview.route ?</b>"}

    T_REVIEW_CONTINUE["<b>Add review continue decision</b><br/>
    latestUserMessageSecurityDecision.decision.route = continue<br/>
    latestUserMessageSecurityDecision.history.llmReview = llmReview"]

    T_REVIEW_STOP["<b>Add review stop decision</b><br/>
    latestUserMessageSecurityDecision.decision.route = stop<br/>
    latestUserMessageSecurityDecision.history.llmReview = llmReview"]

    T_RETURN["<b>Return latestUserMessageSecurityDecision</b><br/>
    latestUserMessageSecurityDecision = {<br/>
    decision: { route: continue / stop }<br/>
    history: {<br/>
    checked: LatestUserMessageSecurityCheckName[]<br/>
    failed: LatestUserMessageSecurityCheckName[]<br/>
    llmReview?: {<br/>
    route: continue / stop / failed<br/>
    reason?<br/>
    }<br/>
    }<br/>
    }"]

    T_INIT --> T_TEXT_CHECKS_INPUT
    T_TEXT_CHECKS_INPUT --> TEXT_CHECKS_DATA
    TEXT_CHECKS_DATA --> T_ADD_TEXT_RESULTS
    T_ADD_TEXT_RESULTS --> T_TRUST_DECISION_INPUT
    T_TRUST_DECISION_INPUT --> TRUST_DECISION_DATA
    TRUST_DECISION_DATA --> T_TRUST_ROUTE_DECISION
    T_TRUST_ROUTE_DECISION -->|continue| T_TEXT_CONTINUE
    T_TRUST_ROUTE_DECISION -->|stop| T_TEXT_STOP
    T_TRUST_ROUTE_DECISION -->|review_with_llm_truster| T_REVIEW_INPUT
    T_TEXT_CONTINUE --> T_RETURN
    T_TEXT_STOP --> T_RETURN
    T_REVIEW_INPUT --> REVIEW_DATA
    REVIEW_DATA --> T_REVIEW_ROUTE
    T_REVIEW_ROUTE -->|continue| T_REVIEW_CONTINUE
    T_REVIEW_ROUTE -->|stop / failed| T_REVIEW_STOP
    T_REVIEW_CONTINUE --> T_RETURN
    T_REVIEW_STOP --> T_RETURN
  end

  subgraph NEXT_STEP["Next step"]
    direction TB
    NEXT_OUTPUTS["<b>Output provided to runMessageAnalysis</b><br/>
    latestUserMessageSecurityDecision"]
  end

  PREVIOUS_STEP --> PIPELINE
  PIPELINE --> NEXT_STEP

  classDef previousBlock fill:#0b6b3a,stroke:#064a28,color:#ffffff,stroke-width:1px;
  classDef inputBlock fill:#d5e8d4,stroke:#82b366,color:#000000,stroke-width:1px;
  classDef outputBlock fill:#f8cecc,stroke:#b85450,color:#000000,stroke-width:1px;
  classDef processingBlock fill:#d9e8f5,stroke:#4f93d2,color:#000000,stroke-width:1px;
  classDef nextOutputBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;

  class TEXT_CHECKS_INPUTS,TRUST_DECISION_INPUTS,REVIEW_INPUTS inputBlock;
  class TEXT_CHECKS_OUTPUTS,TRUST_DECISION_OUTPUTS,REVIEW_OUTPUTS outputBlock;

  class T_INIT,T_TEXT_CHECKS_INPUT,T_ADD_TEXT_RESULTS,T_TRUST_DECISION_INPUT,T_TRUST_ROUTE_DECISION,T_TEXT_CONTINUE,T_TEXT_STOP,T_REVIEW_INPUT,T_REVIEW_ROUTE,T_REVIEW_CONTINUE,T_REVIEW_STOP,T_RETURN processingBlock;

  class NEXT_OUTPUTS nextOutputBlock;

  style PIPELINE fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style PREVIOUS_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;
  style NEXT_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;

  %% Helper functions
  style TEXT_CHECKS_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style TRUST_DECISION_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style REVIEW_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  linkStyle default stroke:#000000,stroke-width:2px;
```
