import type {
  AccountTrustStatus,
  LatestUserMessage
} from "../typesSupportProcessingPipeline.types";

import type {
  AttachmentAnalysis,
  AttachmentAnalysisSecurityCheckName,
  ContextAccountDecision,
  LatestUserMessageSecurityCheckName,
  SecurityDecisionRoute
} from "./typesMessageAnalysis.types";

/* =====================================================
 * Internal latest user message security pipeline
 * ===================================================== */

export type LatestUserMessageSafetyGateInput = {
  latestUserMessage: LatestUserMessage;
};

export type LatestUserMessageSafetyGate = {
  checked: LatestUserMessageSecurityCheckName[];
  failed: LatestUserMessageSecurityCheckName[];
};

export type LatestUserMessageTrustDecisionInput = {
  latestUserMessageSafetyGate: LatestUserMessageSafetyGate;
  accountTrustStatus: AccountTrustStatus;
};

export type LatestUserMessageTrustDecision = {
  route: ContextAccountDecision;
};

export type LatestUserMessageSafetyReviewInput = {
  latestUserMessage: LatestUserMessage;
  latestUserMessageSafetyGate: LatestUserMessageSafetyGate;
  accountTrustStatus: AccountTrustStatus;
};

export type LatestUserMessageSafetyReview = {
  route: SecurityDecisionRoute;
  reason: string;
};

/* =====================================================
 * Internal attachment analysis security pipeline
 * ===================================================== */

export type AttachmentAnalysisSafetyGateInput = {
  attachmentAnalysis: AttachmentAnalysis;
};

export type AttachmentAnalysisSafetyGate = {
  checked: AttachmentAnalysisSecurityCheckName[];
  failed: AttachmentAnalysisSecurityCheckName[];
};

export type AttachmentAnalysisTrustDecisionInput = {
  attachmentAnalysisSafetyGate: AttachmentAnalysisSafetyGate;
  accountTrustStatus: AccountTrustStatus;
};

export type AttachmentAnalysisTrustDecision = {
  route: ContextAccountDecision;
};

export type AttachmentAnalysisSafetyReviewInput = {
  attachmentAnalysis: AttachmentAnalysis;
  attachmentAnalysisSafetyGate: AttachmentAnalysisSafetyGate;
  accountTrustStatus: AccountTrustStatus;
};

export type AttachmentAnalysisSafetyReview = {
  route: SecurityDecisionRoute;
  reason: string;
};


```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 22, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB
  subgraph PREVIOUS_STEP["Previous step"]
    direction TB
    PREVIOUS_INPUTS["<b>Inputs provided to decideRawInputSecurity</b><br/>
    latestUserMessage<br/>
    accountTrustStatus"]
  end

  subgraph PIPELINE["rawInputSecurityDecision = decideRawInputSecurity(rawInputSecurityDecisionInput)"]
    direction TB

    T_MESSAGE_GATE_INPUT["<b>Prepare rawInputMessageSafetyGateInput</b><br/>
    rawInputMessageSafetyGateInput = {<br/>
    latestUserMessage<br/>
    }"]

    subgraph MESSAGE_GATE_DATA["rawInputMessageSafetyGate = runRawInputMessageSafetyGate(rawInputMessageSafetyGateInput)"]
      direction LR
      MESSAGE_GATE_INPUTS["<b>rawInputMessageSafetyGateInput</b><br/>
      latestUserMessage"]
      MESSAGE_GATE_OUTPUTS["<b>Output</b><br/>
      rawInputMessageSafetyGate = {<br/>
      checked<br/>
      failed<br/>
      }"]
      MESSAGE_GATE_INPUTS --> MESSAGE_GATE_OUTPUTS
    end

    T_TRUST_INPUT["<b>Prepare rawInputTrustConsistencyInput</b><br/>
    rawInputTrustConsistencyInput = {<br/>
    rawInputMessageSafetyGate<br/>
    accountTrustStatus<br/>
    }"]

    subgraph TRUST_DATA["rawInputTrustDecision = decideRawInputTrustConsistency(rawInputTrustConsistencyInput)"]
      direction LR
      TRUST_INPUTS["<b>rawInputTrustConsistencyInput</b><br/>
      rawInputMessageSafetyGate<br/>
      accountTrustStatus"]
      TRUST_OUTPUTS["<b>Output</b><br/>
      rawInputTrustDecision = {<br/>
      route<br/>
      }<br/>
      route: continue / stop / review_with_llm_truster"]
      TRUST_INPUTS --> TRUST_OUTPUTS
    end

    T_ROUTE{"<b>route ?</b><br/>
    rawInputTrustDecision.route"}

    T_REVIEW_INPUT["<b>Prepare rawInputSafetyReviewInput</b><br/>
    rawInputSafetyReviewInput = {<br/>
    latestUserMessage<br/>
    rawInputMessageSafetyGate<br/>
    accountTrustStatus<br/>
    }"]

    subgraph REVIEW_DATA["rawInputSafetyReview = runRawInputSafetyReviewLlmTruster(rawInputSafetyReviewInput)"]
      direction LR
      REVIEW_INPUTS["<b>rawInputSafetyReviewInput</b><br/>
      latestUserMessage<br/>
      rawInputMessageSafetyGate<br/>
      accountTrustStatus"]
      REVIEW_OUTPUTS["<b>Output</b><br/>
      rawInputSafetyReview = {<br/>
      route<br/>
      reason<br/>
      }<br/>
      route: continue / stop"]
      REVIEW_INPUTS --> REVIEW_OUTPUTS
    end

    T_REVIEW_ROUTE{"<b>route ?</b><br/>
    rawInputSafetyReview.route"}

    T_CONTINUE_OUTPUT["<b>Build rawInputSecurityDecision</b><br/>
    rawInputSecurityDecision = {<br/>
    route: continue<br/>
    llmReviewUsed: false<br/>
    rawInputMessageSafetyGate<br/>
    rawInputTrustDecision<br/>
    }"]

    T_STOP_OUTPUT["<b>Build rawInputSecurityDecision</b><br/>
    rawInputSecurityDecision = {<br/>
    route: stop<br/>
    llmReviewUsed: false<br/>
    rawInputMessageSafetyGate<br/>
    rawInputTrustDecision<br/>
    }"]

    T_REVIEW_CONTINUE_OUTPUT["<b>Build rawInputSecurityDecision</b><br/>
    rawInputSecurityDecision = {<br/>
    route: continue<br/>
    llmReviewUsed: true<br/>
    rawInputMessageSafetyGate<br/>
    rawInputTrustDecision<br/>
    rawInputSafetyReview<br/>
    }"]

    T_REVIEW_STOP_OUTPUT["<b>Build rawInputSecurityDecision</b><br/>
    rawInputSecurityDecision = {<br/>
    route: stop<br/>
    llmReviewUsed: true<br/>
    rawInputMessageSafetyGate<br/>
    rawInputTrustDecision<br/>
    rawInputSafetyReview<br/>
    }"]

    T_RETURN["<b>Return</b><br/>
    return rawInputSecurityDecision"]

    T_MESSAGE_GATE_INPUT --> MESSAGE_GATE_DATA
    MESSAGE_GATE_DATA --> T_TRUST_INPUT
    T_TRUST_INPUT --> TRUST_DATA
    TRUST_DATA --> T_ROUTE

    T_ROUTE -->|continue| T_CONTINUE_OUTPUT
    T_ROUTE -->|stop| T_STOP_OUTPUT
    T_ROUTE -->|review_with_llm_truster| T_REVIEW_INPUT

    T_REVIEW_INPUT --> REVIEW_DATA
    REVIEW_DATA --> T_REVIEW_ROUTE

    T_REVIEW_ROUTE -->|continue| T_REVIEW_CONTINUE_OUTPUT
    T_REVIEW_ROUTE -->|stop| T_REVIEW_STOP_OUTPUT

    T_CONTINUE_OUTPUT --> T_RETURN
    T_STOP_OUTPUT --> T_RETURN
    T_REVIEW_CONTINUE_OUTPUT --> T_RETURN
    T_REVIEW_STOP_OUTPUT --> T_RETURN
  end

  PREVIOUS_STEP --> PIPELINE

  classDef previousBlock fill:#0b6b3a,stroke:#064a28,color:#ffffff,stroke-width:1px;
  classDef inputBlock fill:#d5e8d4,stroke:#82b366,color:#000000,stroke-width:1px;
  classDef outputBlock fill:#f8cecc,stroke:#b85450,color:#000000,stroke-width:1px;
  classDef processingBlock fill:#d9e8f5,stroke:#4f93d2,color:#000000,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;
  class MESSAGE_GATE_INPUTS,TRUST_INPUTS,REVIEW_INPUTS inputBlock;
  class MESSAGE_GATE_OUTPUTS,TRUST_OUTPUTS,REVIEW_OUTPUTS outputBlock;
  class T_MESSAGE_GATE_INPUT,T_TRUST_INPUT,T_ROUTE,T_REVIEW_INPUT,T_REVIEW_ROUTE,T_CONTINUE_OUTPUT,T_STOP_OUTPUT,T_REVIEW_CONTINUE_OUTPUT,T_REVIEW_STOP_OUTPUT,T_RETURN processingBlock;

  style PIPELINE fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style PREVIOUS_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;

  style MESSAGE_GATE_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style TRUST_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style REVIEW_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;

  linkStyle default stroke:#000000,stroke-width:2px;
 ```



```mermaid
  %%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 22, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB
  subgraph PREVIOUS_STEP["Previous step"]
    direction TB
    PREVIOUS_INPUTS["<b>Inputs provided to decideAttachmentSecurity</b><br/>
    attachmentAnalysis<br/>
    accountTrustStatus"]
  end

  subgraph PIPELINE["attachmentSecurityDecision = decideAttachmentSecurity(attachmentSecurityDecisionInput)"]
    direction TB

    T_ATTACHMENT_GATE_INPUT["<b>Prepare attachmentAnalysisSafetyGateInput</b><br/>
    attachmentAnalysisSafetyGateInput = {<br/>
    attachmentAnalysis<br/>
    }"]

    subgraph ATTACHMENT_GATE_DATA["attachmentAnalysisSafetyGate = runAttachmentAnalysisSafetyGate(attachmentAnalysisSafetyGateInput)"]
      direction LR
      ATTACHMENT_GATE_INPUTS["<b>attachmentAnalysisSafetyGateInput</b><br/>
      attachmentAnalysis"]
      ATTACHMENT_GATE_OUTPUTS["<b>Output</b><br/>
      attachmentAnalysisSafetyGate = {<br/>
      checked<br/>
      failed<br/>
      }"]
      ATTACHMENT_GATE_INPUTS --> ATTACHMENT_GATE_OUTPUTS
    end

    T_TRUST_INPUT["<b>Prepare attachmentTrustConsistencyInput</b><br/>
    attachmentTrustConsistencyInput = {<br/>
    attachmentAnalysisSafetyGate<br/>
    accountTrustStatus<br/>
    }"]

    subgraph TRUST_DATA["attachmentTrustDecision = decideAttachmentTrustConsistency(attachmentTrustConsistencyInput)"]
      direction LR
      TRUST_INPUTS["<b>attachmentTrustConsistencyInput</b><br/>
      attachmentAnalysisSafetyGate<br/>
      accountTrustStatus"]
      TRUST_OUTPUTS["<b>Output</b><br/>
      attachmentTrustDecision = {<br/>
      route<br/>
      }<br/>
      route: continue / stop / review_with_llm_truster"]
      TRUST_INPUTS --> TRUST_OUTPUTS
    end

    T_ROUTE{"<b>route ?</b><br/>
    attachmentTrustDecision.route"}

    T_REVIEW_INPUT["<b>Prepare attachmentSafetyReviewInput</b><br/>
    attachmentSafetyReviewInput = {<br/>
    attachmentAnalysis<br/>
    attachmentAnalysisSafetyGate<br/>
    accountTrustStatus<br/>
    }"]

    subgraph REVIEW_DATA["attachmentSafetyReview = runAttachmentSafetyReviewLlmTruster(attachmentSafetyReviewInput)"]
      direction LR
      REVIEW_INPUTS["<b>attachmentSafetyReviewInput</b><br/>
      attachmentAnalysis<br/>
      attachmentAnalysisSafetyGate<br/>
      accountTrustStatus"]
      REVIEW_OUTPUTS["<b>Output</b><br/>
      attachmentSafetyReview = {<br/>
      route<br/>
      reason<br/>
      }<br/>
      route: continue / stop"]
      REVIEW_INPUTS --> REVIEW_OUTPUTS
    end

    T_REVIEW_ROUTE{"<b>route ?</b><br/>
    attachmentSafetyReview.route"}

    T_CONTINUE_OUTPUT["<b>Build attachmentSecurityDecision</b><br/>
    attachmentSecurityDecision = {<br/>
    route: continue<br/>
    llmReviewUsed: false<br/>
    attachmentAnalysisSafetyGate<br/>
    attachmentTrustDecision<br/>
    }"]

    T_STOP_OUTPUT["<b>Build attachmentSecurityDecision</b><br/>
    attachmentSecurityDecision = {<br/>
    route: stop<br/>
    llmReviewUsed: false<br/>
    attachmentAnalysisSafetyGate<br/>
    attachmentTrustDecision<br/>
    }"]

    T_REVIEW_CONTINUE_OUTPUT["<b>Build attachmentSecurityDecision</b><br/>
    attachmentSecurityDecision = {<br/>
    route: continue<br/>
    llmReviewUsed: true<br/>
    attachmentAnalysisSafetyGate<br/>
    attachmentTrustDecision<br/>
    attachmentSafetyReview<br/>
    }"]

    T_REVIEW_STOP_OUTPUT["<b>Build attachmentSecurityDecision</b><br/>
    attachmentSecurityDecision = {<br/>
    route: stop<br/>
    llmReviewUsed: true<br/>
    attachmentAnalysisSafetyGate<br/>
    attachmentTrustDecision<br/>
    attachmentSafetyReview<br/>
    }"]

    T_RETURN["<b>Return</b><br/>
    return attachmentSecurityDecision"]

    T_ATTACHMENT_GATE_INPUT --> ATTACHMENT_GATE_DATA
    ATTACHMENT_GATE_DATA --> T_TRUST_INPUT
    T_TRUST_INPUT --> TRUST_DATA
    TRUST_DATA --> T_ROUTE

    T_ROUTE -->|continue| T_CONTINUE_OUTPUT
    T_ROUTE -->|stop| T_STOP_OUTPUT
    T_ROUTE -->|review_with_llm_truster| T_REVIEW_INPUT

    T_REVIEW_INPUT --> REVIEW_DATA
    REVIEW_DATA --> T_REVIEW_ROUTE

    T_REVIEW_ROUTE -->|continue| T_REVIEW_CONTINUE_OUTPUT
    T_REVIEW_ROUTE -->|stop| T_REVIEW_STOP_OUTPUT

    T_CONTINUE_OUTPUT --> T_RETURN
    T_STOP_OUTPUT --> T_RETURN
    T_REVIEW_CONTINUE_OUTPUT --> T_RETURN
    T_REVIEW_STOP_OUTPUT --> T_RETURN
  end

  PREVIOUS_STEP --> PIPELINE

  classDef previousBlock fill:#0b6b3a,stroke:#064a28,color:#ffffff,stroke-width:1px;
  classDef inputBlock fill:#d5e8d4,stroke:#82b366,color:#000000,stroke-width:1px;
  classDef outputBlock fill:#f8cecc,stroke:#b85450,color:#000000,stroke-width:1px;
  classDef processingBlock fill:#d9e8f5,stroke:#4f93d2,color:#000000,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;
  class ATTACHMENT_GATE_INPUTS,TRUST_INPUTS,REVIEW_INPUTS inputBlock;
  class ATTACHMENT_GATE_OUTPUTS,TRUST_OUTPUTS,REVIEW_OUTPUTS outputBlock;
  class T_ATTACHMENT_GATE_INPUT,T_TRUST_INPUT,T_ROUTE,T_REVIEW_INPUT,T_REVIEW_ROUTE,T_CONTINUE_OUTPUT,T_STOP_OUTPUT,T_REVIEW_CONTINUE_OUTPUT,T_REVIEW_STOP_OUTPUT,T_RETURN processingBlock;

  style PIPELINE fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style PREVIOUS_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;

  style ATTACHMENT_GATE_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style TRUST_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;
  style REVIEW_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;

  linkStyle default stroke:#000000,stroke-width:2px;

 ```