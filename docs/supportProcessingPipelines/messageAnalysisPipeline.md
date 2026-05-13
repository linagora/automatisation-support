
```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 22, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB
  subgraph PREVIOUS_STEP["Previous step"]
    direction TB
    PREVIOUS_INPUTS["<b>Inputs provided to runMessageAnalysis</b><br/>
    1. latestUserMessage<br/>
    2. latestUserAttachments<br/>
    3.1. accountTrustStatus<br/>
    4. supportTopicKnowledge<br/>
    5. conversationHistory"]
  end

  subgraph PIPELINE["6. turnUnderstandingDelta = runMessageAnalysis(messageAnalysisInput)"]
    direction TB

    T0["<b>Prepare rawInputSafetyGateInput</b><br/>
    rawInputSafetyGateInput = {<br/>
    latestUserMessage<br/>
    latestUserAttachments<br/>
    }"]

    subgraph RAW_SAFETY_DATA["rawInputSafetyGate = runRawInputSafetyGate(rawInputSafetyGateInput)"]
      direction LR
      RAW_INPUTS["<b>rawInputSafetyGateInput</b><br/>
      latestUserMessage<br/>
      latestUserAttachments"]
      RAW_OUTPUTS["<b>Output</b><br/>
      6.1 rawInputSafetyGate = {<br/>
      inputClean<br/>
      failedChecks<br/>
      }"]
      RAW_INPUTS --> RAW_OUTPUTS
    end

    T1{"<b>if</b><br/>
    rawInputSafetyGate.failedChecks includes suspicious_attachments"}

    T_STOP_ATTACHMENT["<b>Stop message analysis</b><br/>
    No model call<br/>
    Message and unauthorized attachment are ignored<br/>
    Remaining step outputs are set to status: skipped"]

    T_TRUST_INPUT["<b>Prepare rawInputTrustConsistencyInput</b><br/>
    rawInputTrustConsistencyInput = {<br/>
    rawInputSafetyGate<br/>
    accountTrustStatus<br/>
    }"]

    subgraph TRUST_DATA["rawInputTrustDecision = decideRawInputTrustConsistency(rawInputTrustConsistencyInput)"]
      direction LR
      TRUST_INPUTS["<b>rawInputTrustConsistencyInput</b><br/>
      rawInputSafetyGate<br/>
      accountTrustStatus"]
      TRUST_OUTPUTS["<b>Output</b><br/>
      6.2 rawInputTrustDecision = {<br/>
      status<br/>
      route<br/>
      }<br/>
      status: decided<br/>
      route: continue / stop / review_with_llm_truster"]
      TRUST_INPUTS --> TRUST_OUTPUTS
    end

    T2{"<b>if</b><br/>
    rawInputTrustDecision.route === review_with_llm_truster"}

    T_REVIEW_INPUT["<b>Prepare rawInputSafetyReviewInput</b><br/>
    rawInputSafetyReviewInput = {<br/>
    latestUserMessage<br/>
    rawInputSafetyGate<br/>
    accountTrustStatus<br/>
    }"]

    subgraph REVIEW_DATA["rawInputSafetyReview = runRawInputSafetyReviewLlmTruster(rawInputSafetyReviewInput)"]
      direction LR
      REVIEW_INPUTS["<b>rawInputSafetyReviewInput</b><br/>
      latestUserMessage<br/>
      rawInputSafetyGate<br/>
      accountTrustStatus"]
      REVIEW_OUTPUTS["<b>Output</b><br/>
      6.3 rawInputSafetyReview = {<br/>
      status<br/>
      route<br/>
      reason<br/>
      }<br/>
      status: reviewed<br/>
      route: continue / stop"]
      REVIEW_INPUTS --> REVIEW_OUTPUTS
    end

    T_REVIEW_SKIPPED["<b>No raw input safety review</b><br/>
    6.3 rawInputSafetyReview = {<br/>
    status: skipped<br/>
    }"]

    T3{"<b>if</b><br/>
    final raw input route === continue"}

    T_ATTACHMENT_CHECK{"<b>if</b><br/>
    latestUserAttachments.length > 0"}

    T_ATTACHMENT_INPUT["<b>Prepare attachmentAnalysisInput</b><br/>
    attachmentAnalysisInput = {<br/>
    latestUserMessage<br/>
    latestUserAttachments<br/>
    }"]

    subgraph ATTACHMENT_DATA["attachmentAnalysis = runAttachmentAnalysis(attachmentAnalysisInput)"]
      direction LR
      ATTACHMENT_INPUTS["<b>attachmentAnalysisInput</b><br/>
      latestUserMessage<br/>
      latestUserAttachments"]
      ATTACHMENT_OUTPUTS["<b>Output</b><br/>
      6.4 attachmentAnalysis = {<br/>
      status<br/>
      analysis<br/>
      }<br/>
      status: analyzed / failed"]
      ATTACHMENT_INPUTS --> ATTACHMENT_OUTPUTS
    end

    T_ATTACHMENT_EMPTY["<b>No attachment analysis</b><br/>
    6.4 attachmentAnalysis = {<br/>
    status: skipped<br/>
    }<br/>
    6.5 attachmentAnalysisSafetyGate = { status: skipped }<br/>
    6.6 attachmentTrustDecision = { status: skipped }<br/>
    6.7 attachmentSafetyReview = { status: skipped }"]

    T_ATTACHMENT_SAFETY_INPUT["<b>Prepare attachmentAnalysisSafetyGateInput</b><br/>
    attachmentAnalysisSafetyGateInput = {<br/>
    attachmentAnalysis<br/>
    }"]

    subgraph ATTACHMENT_SAFETY_DATA["attachmentAnalysisSafetyGate = runAttachmentAnalysisSafetyGate(attachmentAnalysisSafetyGateInput)"]
      direction LR
      ATTACHMENT_SAFETY_INPUTS["<b>attachmentAnalysisSafetyGateInput</b><br/>
      attachmentAnalysis"]
      ATTACHMENT_SAFETY_OUTPUTS["<b>Output</b><br/>
      6.5 attachmentAnalysisSafetyGate = {<br/>
      status<br/>
      inputClean<br/>
      failedChecks<br/>
      }<br/>
      status: checked"]
      ATTACHMENT_SAFETY_INPUTS --> ATTACHMENT_SAFETY_OUTPUTS
    end

    T_ATTACHMENT_TRUST_INPUT["<b>Prepare attachmentTrustConsistencyInput</b><br/>
    attachmentTrustConsistencyInput = {<br/>
    attachmentAnalysisSafetyGate<br/>
    accountTrustStatus<br/>
    }"]

    subgraph ATTACHMENT_TRUST_DATA["attachmentTrustDecision = decideAttachmentTrustConsistency(attachmentTrustConsistencyInput)"]
      direction LR
      ATTACHMENT_TRUST_INPUTS["<b>attachmentTrustConsistencyInput</b><br/>
      attachmentAnalysisSafetyGate<br/>
      accountTrustStatus"]
      ATTACHMENT_TRUST_OUTPUTS["<b>Output</b><br/>
      6.6 attachmentTrustDecision = {<br/>
      status<br/>
      route<br/>
      }<br/>
      status: decided<br/>
      route: continue / stop / review_with_llm_truster"]
      ATTACHMENT_TRUST_INPUTS --> ATTACHMENT_TRUST_OUTPUTS
    end

    T4{"<b>if</b><br/>
    attachmentTrustDecision.route === review_with_llm_truster"}

    T_ATTACHMENT_REVIEW_INPUT["<b>Prepare attachmentSafetyReviewInput</b><br/>
    attachmentSafetyReviewInput = {<br/>
    attachmentAnalysis<br/>
    attachmentAnalysisSafetyGate<br/>
    accountTrustStatus<br/>
    }"]

    subgraph ATTACHMENT_REVIEW_DATA["attachmentSafetyReview = runAttachmentSafetyReviewLlmTruster(attachmentSafetyReviewInput)"]
      direction LR
      ATTACHMENT_REVIEW_INPUTS["<b>attachmentSafetyReviewInput</b><br/>
      attachmentAnalysis<br/>
      attachmentAnalysisSafetyGate<br/>
      accountTrustStatus"]
      ATTACHMENT_REVIEW_OUTPUTS["<b>Output</b><br/>
      6.7 attachmentSafetyReview = {<br/>
      status<br/>
      route<br/>
      reason<br/>
      }<br/>
      status: reviewed<br/>
      route: continue / stop"]
      ATTACHMENT_REVIEW_INPUTS --> ATTACHMENT_REVIEW_OUTPUTS
    end

    T_ATTACHMENT_REVIEW_SKIPPED["<b>No attachment safety review</b><br/>
    6.7 attachmentSafetyReview = {<br/>
    status: skipped<br/>
    }"]

    T5{"<b>if</b><br/>
    final attachment route === continue"}

    T_STOP_ATTACHMENT_RAIL["<b>Stop after attachment safety rail</b><br/>
    No message analysis model call<br/>
    6.8 analysisGate = { status: skipped }<br/>
    6.9 lightweightMessageAnalysis = { status: skipped }<br/>
    6.10 rawFullweightMessageAnalysis = { status: skipped }"]

    T_ANALYSIS_GATE_INPUT["<b>Prepare analysisGateInput</b><br/>
    analysisGateInput = {<br/>
    latestUserMessage<br/>
    supportTopicKnowledge<br/>
    conversationHistory<br/>
    attachmentAnalysis<br/>
    }"]

    subgraph ANALYSIS_GATE_DATA["analysisGate = runAnalysisGate(analysisGateInput)"]
      direction LR
      ANALYSIS_GATE_INPUTS["<b>analysisGateInput</b><br/>
      latestUserMessage<br/>
      supportTopicKnowledge<br/>
      conversationHistory<br/>
      attachmentAnalysis"]
      ANALYSIS_GATE_OUTPUTS["<b>Output</b><br/>
      6.8 analysisGate = {<br/>
      status<br/>
      shouldRunLightweightMessageAnalysis<br/>
      }<br/>
      status: checked"]
      ANALYSIS_GATE_INPUTS --> ANALYSIS_GATE_OUTPUTS
    end

    T6{"<b>if</b><br/>
    analysisGate.shouldRunLightweightMessageAnalysis === true"}

    T_LIGHTWEIGHT_INPUT["<b>Prepare lightweightMessageAnalysisInput</b><br/>
    lightweightMessageAnalysisInput = {<br/>
    latestUserMessage<br/>
    supportTopicKnowledge<br/>
    conversationHistory<br/>
    attachmentAnalysis<br/>
    }"]

    subgraph LIGHTWEIGHT_DATA["lightweightMessageAnalysis = runLightweightMessageAnalysis(lightweightMessageAnalysisInput)"]
      direction LR
      LIGHTWEIGHT_INPUTS["<b>lightweightMessageAnalysisInput</b><br/>
      latestUserMessage<br/>
      supportTopicKnowledge<br/>
      conversationHistory<br/>
      attachmentAnalysis"]
      LIGHTWEIGHT_OUTPUTS["<b>Output</b><br/>
      6.9 lightweightMessageAnalysis = {<br/>
      status<br/>
      shouldRunSupportMessageAnalysis<br/>
      user_language<br/>
      segments_signal<br/>
      segments_scope_boundary<br/>
      segments_suspicious<br/>
      }<br/>
      status: analyzed / failed"]
      LIGHTWEIGHT_INPUTS --> LIGHTWEIGHT_OUTPUTS
    end

    T_LIGHTWEIGHT_EMPTY["<b>No lightweightMessageAnalysis</b><br/>
    6.9 lightweightMessageAnalysis = {<br/>
    status: skipped<br/>
    shouldRunSupportMessageAnalysis: true<br/>
    segments_signal: []<br/>
    segments_scope_boundary: []<br/>
    segments_suspicious: []<br/>
    }"]

    T7{"<b>if</b><br/>
    lightweightMessageAnalysis.shouldRunSupportMessageAnalysis === true"}

    T_FULLWEIGHT_INPUT["<b>Prepare fullweightMessageAnalysisInput</b><br/>
    fullweightMessageAnalysisInput = {<br/>
    latestUserMessage<br/>
    supportTopicKnowledge<br/>
    conversationHistory<br/>
    attachmentAnalysis<br/>
    lightweightMessageAnalysis<br/>
    }"]

    subgraph FULLWEIGHT_DATA["rawFullweightMessageAnalysis = runFullweightMessageAnalysis(fullweightMessageAnalysisInput)"]
      direction LR
      FULLWEIGHT_INPUTS["<b>fullweightMessageAnalysisInput</b><br/>
      latestUserMessage<br/>
      supportTopicKnowledge<br/>
      conversationHistory<br/>
      attachmentAnalysis<br/>
      lightweightMessageAnalysis"]
      FULLWEIGHT_OUTPUTS["<b>Output</b><br/>
      6.10 rawFullweightMessageAnalysis = {<br/>
      status<br/>
      user_language<br/>
      segments_lack_comprehension<br/>
      segments_topic<br/>
      segments_signal<br/>
      segments_scope_boundary<br/>
      segments_suspicious<br/>
      }<br/>
      status: analyzed / failed"]
      FULLWEIGHT_INPUTS --> FULLWEIGHT_OUTPUTS
    end

    T_FULLWEIGHT_EMPTY["<b>No fullweightMessageAnalysis</b><br/>
    6.10 rawFullweightMessageAnalysis = {<br/>
    status: skipped<br/>
    segments_lack_comprehension: []<br/>
    segments_topic: []<br/>
    segments_signal: []<br/>
    segments_scope_boundary: []<br/>
    segments_suspicious: []<br/>
    }"]

    T_DELTA_INPUT["<b>Prepare turnUnderstandingDeltaInput</b><br/>
    turnUnderstandingDeltaInput = {<br/>
    rawInputSafetyGate<br/>
    rawInputTrustDecision<br/>
    rawInputSafetyReview<br/>
    attachmentAnalysis<br/>
    attachmentAnalysisSafetyGate<br/>
    attachmentTrustDecision<br/>
    attachmentSafetyReview<br/>
    analysisGate<br/>
    lightweightMessageAnalysis<br/>
    rawFullweightMessageAnalysis<br/>
    supportTopicKnowledge<br/>
    conversationHistory<br/>
    }"]

    subgraph DELTA_DATA["turnUnderstandingDelta = assembleTurnUnderstandingDelta(turnUnderstandingDeltaInput)"]
      direction LR
      DELTA_INPUTS["<b>turnUnderstandingDeltaInput</b><br/>
      rawInputSafetyGate<br/>
      rawInputTrustDecision<br/>
      rawInputSafetyReview<br/>
      attachmentAnalysis<br/>
      attachmentAnalysisSafetyGate<br/>
      attachmentTrustDecision<br/>
      attachmentSafetyReview<br/>
      analysisGate<br/>
      lightweightMessageAnalysis<br/>
      rawFullweightMessageAnalysis<br/>
      supportTopicKnowledge<br/>
      conversationHistory"]
      DELTA_OUTPUTS["<b>Output</b><br/>
      6. turnUnderstandingDelta"]
      DELTA_INPUTS --> DELTA_OUTPUTS
    end

    T8["<b>Return message analysis output</b><br/>
    return 6. turnUnderstandingDelta"]

    T0 --> RAW_SAFETY_DATA
    RAW_SAFETY_DATA --> T1

    T1 -->|true| T_STOP_ATTACHMENT
    T1 -->|false| T_TRUST_INPUT

    T_STOP_ATTACHMENT --> T_DELTA_INPUT

    T_TRUST_INPUT --> TRUST_DATA
    TRUST_DATA --> T2

    T2 -->|true| T_REVIEW_INPUT
    T2 -.->|false| T_REVIEW_SKIPPED

    T_REVIEW_INPUT --> REVIEW_DATA
    REVIEW_DATA --> T3
    T_REVIEW_SKIPPED --> T3

    T3 -->|true| T_ATTACHMENT_CHECK
    T3 -.->|false<br/>stop raw input rail| T_DELTA_INPUT

    T_ATTACHMENT_CHECK -->|true| T_ATTACHMENT_INPUT
    T_ATTACHMENT_CHECK -.->|false<br/>no attachment| T_ATTACHMENT_EMPTY

    T_ATTACHMENT_INPUT --> ATTACHMENT_DATA
    ATTACHMENT_DATA --> T_ATTACHMENT_SAFETY_INPUT

    T_ATTACHMENT_EMPTY --> T_ANALYSIS_GATE_INPUT

    T_ATTACHMENT_SAFETY_INPUT --> ATTACHMENT_SAFETY_DATA
    ATTACHMENT_SAFETY_DATA --> T_ATTACHMENT_TRUST_INPUT

    T_ATTACHMENT_TRUST_INPUT --> ATTACHMENT_TRUST_DATA
    ATTACHMENT_TRUST_DATA --> T4

    T4 -->|true| T_ATTACHMENT_REVIEW_INPUT
    T4 -.->|false| T_ATTACHMENT_REVIEW_SKIPPED

    T_ATTACHMENT_REVIEW_INPUT --> ATTACHMENT_REVIEW_DATA
    ATTACHMENT_REVIEW_DATA --> T5
    T_ATTACHMENT_REVIEW_SKIPPED --> T5

    T5 -->|true| T_ANALYSIS_GATE_INPUT
    T5 -.->|false<br/>stop attachment rail| T_STOP_ATTACHMENT_RAIL
    T_STOP_ATTACHMENT_RAIL --> T_DELTA_INPUT

    T_ANALYSIS_GATE_INPUT --> ANALYSIS_GATE_DATA
    ANALYSIS_GATE_DATA --> T6

    T6 -->|true| T_LIGHTWEIGHT_INPUT
    T6 -.->|false<br/>run fullweight analysis directly| T_LIGHTWEIGHT_EMPTY

    T_LIGHTWEIGHT_INPUT --> LIGHTWEIGHT_DATA
    LIGHTWEIGHT_DATA --> T7

    T_LIGHTWEIGHT_EMPTY --> T_FULLWEIGHT_INPUT

    T7 -->|true| T_FULLWEIGHT_INPUT
    T7 -.->|false<br/>no support topic detected| T_FULLWEIGHT_EMPTY

    T_FULLWEIGHT_INPUT --> FULLWEIGHT_DATA
    FULLWEIGHT_DATA --> T_DELTA_INPUT

    T_FULLWEIGHT_EMPTY --> T_DELTA_INPUT

    T_DELTA_INPUT --> DELTA_DATA
    DELTA_DATA --> T8
  end

  subgraph NEXT_STEP["Next step"]
    direction TB
    NEXT_OUTPUTS["<b>Output produced by runMessageAnalysis</b><br/>
    6. turnUnderstandingDelta"]
  end

  PREVIOUS_STEP --> PIPELINE
  PIPELINE --> NEXT_STEP

  classDef previousBlock fill:#0b6b3a,stroke:#064a28,color:#ffffff,stroke-width:1px;
  classDef inputBlock fill:#d5e8d4,stroke:#82b366,color:#000000,stroke-width:1px;
  classDef outputBlock fill:#f8cecc,stroke:#b85450,color:#000000,stroke-width:1px;
  classDef processingBlock fill:#d9e8f5,stroke:#4f93d2,color:#000000,stroke-width:1px;
  classDef nextOutputBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;

  class RAW_INPUTS,TRUST_INPUTS,REVIEW_INPUTS,ATTACHMENT_INPUTS,ATTACHMENT_SAFETY_INPUTS,ATTACHMENT_TRUST_INPUTS,ATTACHMENT_REVIEW_INPUTS,ANALYSIS_GATE_INPUTS,LIGHTWEIGHT_INPUTS,FULLWEIGHT_INPUTS,DELTA_INPUTS inputBlock;
  class RAW_OUTPUTS,TRUST_OUTPUTS,REVIEW_OUTPUTS,ATTACHMENT_OUTPUTS,ATTACHMENT_SAFETY_OUTPUTS,ATTACHMENT_TRUST_OUTPUTS,ATTACHMENT_REVIEW_OUTPUTS,ANALYSIS_GATE_OUTPUTS,LIGHTWEIGHT_OUTPUTS,FULLWEIGHT_OUTPUTS,DELTA_OUTPUTS outputBlock;

  class T0,T1,T_STOP_ATTACHMENT,T_TRUST_INPUT,T2,T_REVIEW_INPUT,T_REVIEW_SKIPPED,T3,T_ATTACHMENT_CHECK,T_ATTACHMENT_INPUT,T_ATTACHMENT_EMPTY,T_ATTACHMENT_SAFETY_INPUT,T_ATTACHMENT_TRUST_INPUT,T4,T_ATTACHMENT_REVIEW_INPUT,T_ATTACHMENT_REVIEW_SKIPPED,T5,T_STOP_ATTACHMENT_RAIL,T_ANALYSIS_GATE_INPUT,T6,T_LIGHTWEIGHT_INPUT,T_LIGHTWEIGHT_EMPTY,T7,T_FULLWEIGHT_INPUT,T_FULLWEIGHT_EMPTY,T_DELTA_INPUT,T8 processingBlock;

  class NEXT_OUTPUTS nextOutputBlock;

  style PIPELINE fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style PREVIOUS_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;
  style NEXT_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;

  %% Safety subgraphs: light grey
  style RAW_SAFETY_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style TRUST_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style REVIEW_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style ATTACHMENT_SAFETY_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style ATTACHMENT_TRUST_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style ATTACHMENT_REVIEW_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;

  %% Non-safety functional subgraphs: dark grey
  style ATTACHMENT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style ANALYSIS_GATE_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style LIGHTWEIGHT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style FULLWEIGHT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style DELTA_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  linkStyle default stroke:#000000,stroke-width:2px;
  ```