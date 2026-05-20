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

    T_PROMPT_INPUT["<b>Prepare buildFullWeightPromptInput</b><br/>
    buildFullWeightPromptInput = {<br/>
    latestUserMessage<br/>
    supportTopicKnowledge<br/>
    conversationHistory<br/>
    attachmentAnalysis?<br/>
    lightWeightMessageAnalysis?<br/>
    expectedOutputSchema<br/>
    }"]

    subgraph PROMPT_DATA["fullWeightPrompt = buildFullWeightPrompt(buildFullWeightPromptInput)"]
      direction LR

      PROMPT_INPUTS["<b>buildFullWeightPromptInput</b><br/>
      latestUserMessage<br/>
      supportTopicKnowledge<br/>
      conversationHistory<br/>
      attachmentAnalysis?<br/>
      lightWeightMessageAnalysis?<br/>
      expectedOutputSchema"]

      PROMPT_OUTPUTS["<b>Output</b><br/>
      fullWeightPrompt = {<br/>
      systemPrompt<br/>
      userPrompt<br/>
      expectedOutputSchema<br/>
      }<br/><br/>
      Purpose:<br/>
      prepare the complete prompt sent to the LLM"]

      PROMPT_INPUTS --> PROMPT_OUTPUTS
    end

    T_REQUEST_INPUT["<b>Prepare requestTextAnalysisInput</b><br/>
    requestTextAnalysisInput = {<br/>
    fullWeightPrompt<br/>
    }"]

    subgraph REQUEST_DATA["rawFullWeightMessageAnalysis = requestTextAnalysis(requestTextAnalysisInput)"]
      direction LR

      REQUEST_INPUTS["<b>requestTextAnalysisInput</b><br/>
      fullWeightPrompt"]

      REQUEST_OUTPUTS["<b>Output</b><br/>
      rawFullWeightMessageAnalysis = {<br/>
      status: completed / failed<br/>
      parsedResponse?<br/>
      rawResponse?<br/>
      error?<br/>
      }<br/><br/>
      Purpose:<br/>
      callLLM(fullWeightPrompt)<br/>
      then parse the LLM response"]

      REQUEST_INPUTS --> REQUEST_OUTPUTS
    end

    T_FORMAT_INPUT["<b>Prepare formatFullWeightMessageAnalysisOutputInput</b><br/>
    formatFullWeightMessageAnalysisOutputInput = {<br/>
    rawFullWeightMessageAnalysis<br/>
    expectedOutputSchema<br/>
    }"]

    subgraph FORMAT_DATA["fullWeightMessageAnalysisOutput = formatFullWeightMessageAnalysisOutput(formatFullWeightMessageAnalysisOutputInput)"]
      direction LR

      FORMAT_INPUTS["<b>formatFullWeightMessageAnalysisOutputInput</b><br/>
      rawFullWeightMessageAnalysis<br/>
      expectedOutputSchema"]

      FORMAT_OUTPUTS["<b>Output</b><br/>
      fullWeightMessageAnalysisOutput = {<br/>
      decision: {<br/>
      route: continue / stop<br/>
      }<br/>
      history: {<br/>
      checked: FullWeightOutputCheckName[]<br/>
      failed: FullWeightOutputCheckName[]<br/>
      refusalReason?<br/>
      }<br/>
      analysis?: {<br/>
      user_language?<br/>
      segments_lack_comprehension<br/>
      segments_topic<br/>
      segments_signal<br/>
      segments_scope_boundary<br/>
      segments_suspicious<br/>
      }<br/>
      error?: {<br/>
      message<br/>
      rawResponse?<br/>
      }<br/>
      }<br/><br/>
      Purpose:<br/>
      validate fields and return either the clean analysis<br/>
      or a structured stop output"]

      FORMAT_INPUTS --> FORMAT_OUTPUTS
    end

    T_RETURN["<b>Return fullWeightMessageAnalysisOutput</b><br/>
    return fullWeightMessageAnalysisOutput"]

    T_PROMPT_INPUT --> PROMPT_DATA
    PROMPT_DATA --> T_REQUEST_INPUT

    T_REQUEST_INPUT --> REQUEST_DATA
    REQUEST_DATA --> T_FORMAT_INPUT

    T_FORMAT_INPUT --> FORMAT_DATA
    FORMAT_DATA --> T_RETURN
  end

  subgraph NEXT_STEP["Next step"]
    direction TB
    NEXT_OUTPUTS["<b>Output produced by runFullWeightMessageAnalysis</b><br/>
    fullWeightMessageAnalysisOutput"]
  end

  PREVIOUS_STEP --> PIPELINE
  PIPELINE --> NEXT_STEP

  classDef previousBlock fill:#0b6b3a,stroke:#064a28,color:#ffffff,stroke-width:1px;
  classDef inputBlock fill:#d5e8d4,stroke:#82b366,color:#000000,stroke-width:1px;
  classDef outputBlock fill:#f8cecc,stroke:#b85450,color:#000000,stroke-width:1px;
  classDef processingBlock fill:#d9e8f5,stroke:#4f93d2,color:#000000,stroke-width:1px;
  classDef nextOutputBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;

  class PROMPT_INPUTS,REQUEST_INPUTS,FORMAT_INPUTS inputBlock;
  class PROMPT_OUTPUTS,REQUEST_OUTPUTS,FORMAT_OUTPUTS outputBlock;

  class T_PROMPT_INPUT,T_REQUEST_INPUT,T_FORMAT_INPUT,T_RETURN processingBlock;

  class NEXT_OUTPUTS nextOutputBlock;

  style PIPELINE fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style PREVIOUS_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;
  style NEXT_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;

  %% Functional blocks
  style PROMPT_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;
  style REQUEST_DATA fill:#333333,stroke:#333333,stroke-width:1px,color:#ffffff;

  %% Output validation / formatting block
  style FORMAT_DATA fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1px,color:#000000;

  linkStyle default stroke:#000000,stroke-width:2px;
  ```