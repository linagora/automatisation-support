 ```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 22, "subGraphTitleMargin": {"top": 10, "bottom": 25}}, "themeVariables": {"fontSize": "13px", "lineColor": "#000000"}}}%%
flowchart TB
  subgraph PREVIOUS_STEP["Previous step"]
    direction TB
    PREVIOUS_INPUTS["<b>Input provided to assembleTurnUnderstandingDelta</b><br/>
    turnUnderstandingDeltaInput = {<br/>
    securityGateSummary<br/>
    latestUserAttachments?<br/>
    attachmentAnalysis?<br/>
    supportTopicKnowledge<br/>
    fullWeightMessageAnalysisOutput?<br/>
    lightWeightMessageAnalysis?<br/>
    }"]
  end

  subgraph PIPELINE["turnUnderstandingDelta = assembleTurnUnderstandingDelta(turnUnderstandingDeltaInput)"]
    direction TB

    T_INIT["<b>Initialize assembly state</b><br/>
    analysisSource = undefined<br/>
    numberOfCleanedFields = 0<br/><br/>
    turnUnderstandingDelta = {<br/>
    user_language: Unknown<br/>
    segments_lack_comprehension: []<br/>
    segments_topic: []<br/>
    segments_signal: []<br/>
    segments_scope_boundary: []<br/>
    segments_suspicious: []<br/>
    }"]

    T_SET_SECURITY["<b>Set security summary</b><br/>
    turnUnderstandingDelta.securityGateSummary =<br/>
    normalizeSecurityGateSummary(input.securityGateSummary)"]

    T_BUILD_ATTACHMENTS["<b>Build lightweight attachment references</b><br/>
    attachments = buildTurnAttachments(<br/>
    latestUserAttachments,<br/>
    attachmentAnalysis<br/>
    )<br/><br/>
    Output buckets:<br/>
    images / videos / other"]

    T_ATTACHMENTS_ROUTE{"<b>attachments built?</b>"}

    T_SET_ATTACHMENTS["<b>Add global attachments</b><br/>
    turnUnderstandingDelta.attachments = {<br/>
    images: TurnAttachmentReference[]<br/>
    videos: TurnAttachmentReference[]<br/>
    other: TurnAttachmentReference[]<br/>
    }<br/><br/>
    References are lightweight:<br/>
    id, kind, filename?, mimeType?, sizeInBytes?,<br/>
    status, reason?, storageKey?, safe accessUrl?,<br/>
    analysis?: { llmDescription?, structuredObservations? }"]

    T_ANALYSIS_EMPTY_ROUTE{"<b>No analysis available?</b><br/>
    fullWeightMessageAnalysisOutput?.analysis is empty<br/>
    AND lightWeightMessageAnalysis is empty"}

    T_RETURN_EMPTY["<b>Return empty delta</b><br/>
    analysisSource = undefined<br/>
    return turnUnderstandingDelta"]

    T_SET_SOURCE["<b>Select analysis source</b><br/>
    If fullWeightMessageAnalysisOutput.analysis exists:<br/>
    analysisSource = full<br/><br/>
    Else if lightWeightMessageAnalysis exists:<br/>
    analysisSource = light"]

    T_SET_LANGUAGE["<b>Set user language</b><br/>
    If analysisSource = full:<br/>
    use fullWeightMessageAnalysisOutput.analysis.user_language<br/><br/>
    If analysisSource = light:<br/>
    use lightWeightMessageAnalysis.user_language<br/><br/>
    Always update language because the user can change language"]

    T_SOURCE_ROUTE{"<b>analysisSource?</b><br/>
    light / full"}

    T_LIGHT_PROCESS["<b>Light analysis</b><br/>
    Add all non-empty lightweight segments:<br/>
    segments_signal<br/>
    segments_scope_boundary<br/>
    segments_suspicious<br/><br/>
    Lightweight analysis contains only lightweight delta"]

    T_FULL_NON_TOPIC["<b>Full analysis</b><br/>
    Add non-empty fullweight non-topic segments:<br/>
    segments_lack_comprehension<br/>
    segments_signal<br/>
    segments_scope_boundary<br/>
    segments_suspicious"]

    T_TOPIC_ROUTE{"<b>Fullweight topic segments?</b><br/>
    fullWeightMessageAnalysisOutput.analysis.segments_topic exists<br/>
    and is not empty"}

    subgraph TOPIC_LOOP["For each fullweight topic segment"]
      direction TB

      T_MATCH_ROUTE{"<b>matched_historical_topic?</b>"}

      T_NEW_TOPIC["<b>New topic</b><br/>
      matched_historical_topic = no<br/><br/>
      Add the complete topic segment<br/>
      to turnUnderstandingDelta.segments_topic"]

      T_FIND_EXISTING["<b>Matched historical topic</b><br/>
      matched_historical_topic = yes<br/><br/>
      Find existing topic in supportTopicKnowledge<br/>
      using id_topic"]

      T_EXISTING_ROUTE{"<b>Existing topic found?</b>"}

      T_KEEP_FOR_REVIEW["<b>Existing topic not found</b><br/>
      Keep minimal returned topic segment<br/>
      for review"]

      T_INIT_MATCHED_DELTA["<b>Initialize matched topic delta</b><br/>
      cleanedTopicDelta = {<br/>
      matched_historical_topic: yes<br/>
      id_topic<br/>
      topic_details: {}<br/>
      tested_actions: []<br/>
      }<br/><br/>
      Only these fields can be kept:<br/>
      id_topic<br/>
      topic_details<br/>
      tested_actions<br/>
      user_goal<br/>
      blocking_issue"]

      subgraph DETAILS_LOOP["For each returned topic_details field"]
        direction TB

        T_DETAIL_EXISTS_ROUTE{"<b>Field already exists<br/>in supportTopicKnowledge?</b>"}

        T_DETAIL_KEEP_NEW["<b>New topic_details field</b><br/>
        Add field to cleanedTopicDelta.topic_details"]

        T_DETAIL_COMPARE["<b>Existing topic_details field</b><br/>
        Compare new value and old value<br/>
        letter by letter"]

        T_DETAIL_DUPLICATE_ROUTE{"<b>Exact duplicate?</b>"}

        T_DETAIL_DROP["<b>Duplicate value</b><br/>
        Remove field from delta<br/>
        numberOfCleanedFields += 1"]

        T_DETAIL_KEEP_PRECISION["<b>Different value</b><br/>
        Keep as precision / update<br/>
        in cleanedTopicDelta.topic_details"]

        T_DETAIL_EXISTS_ROUTE -->|no| T_DETAIL_KEEP_NEW
        T_DETAIL_EXISTS_ROUTE -->|yes| T_DETAIL_COMPARE
        T_DETAIL_COMPARE --> T_DETAIL_DUPLICATE_ROUTE
        T_DETAIL_DUPLICATE_ROUTE -->|yes| T_DETAIL_DROP
        T_DETAIL_DUPLICATE_ROUTE -->|no| T_DETAIL_KEEP_PRECISION
      end

      subgraph TESTED_ACTIONS_LOOP["For each returned tested_action"]
        direction TB

        T_TESTED_ACTION_EXISTS_ROUTE{"<b>Same tested_action + outcome<br/>already exists?</b>"}

        T_TESTED_ACTION_DROP["<b>Duplicate tested action</b><br/>
        Remove tested action from delta<br/>
        numberOfCleanedFields += 1"]

        T_TESTED_ACTION_KEEP["<b>New tested action</b><br/>
        Add to cleanedTopicDelta.tested_actions"]

        T_TESTED_ACTION_EXISTS_ROUTE -->|yes| T_TESTED_ACTION_DROP
        T_TESTED_ACTION_EXISTS_ROUTE -->|no| T_TESTED_ACTION_KEEP
      end

      T_USER_GOAL_ROUTE{"<b>user_goal returned?</b>"}

      T_USER_GOAL_LENGTH_CHECK{"<b>New user_goal length<br/>≥ 80% old user_goal length?</b>"}

      T_USER_GOAL_KEEP["<b>Keep user_goal</b><br/>
      Add / update cleanedTopicDelta.user_goal"]

      T_USER_GOAL_DROP["<b>Drop user_goal</b><br/>
      Too short compared to previous goal<br/>
      numberOfCleanedFields += 1"]

      T_BLOCKING_ROUTE{"<b>blocking_issue returned?</b>"}

      T_BLOCKING_KEEP["<b>Keep blocking_issue</b><br/>
      Always add returned blocking_issue<br/>
      to cleanedTopicDelta"]

      T_USEFUL_TOPIC_ROUTE{"<b>cleanedTopicDelta has useful fields?</b><br/>
      topic_details not empty<br/>
      or tested_actions not empty<br/>
      or user_goal exists<br/>
      or blocking_issue exists"}

      T_ADD_MATCHED_TOPIC["<b>Add cleaned matched topic delta</b><br/>
      Append cleanedTopicDelta<br/>
      to turnUnderstandingDelta.segments_topic"]

      T_DROP_MATCHED_TOPIC["<b>Drop matched topic delta</b><br/>
      No useful new information<br/>
      numberOfCleanedFields += 1"]

      T_MATCH_ROUTE -->|no| T_NEW_TOPIC
      T_MATCH_ROUTE -->|yes| T_FIND_EXISTING

      T_FIND_EXISTING --> T_EXISTING_ROUTE
      T_EXISTING_ROUTE -->|no| T_KEEP_FOR_REVIEW
      T_EXISTING_ROUTE -->|yes| T_INIT_MATCHED_DELTA

      T_INIT_MATCHED_DELTA --> DETAILS_LOOP
      DETAILS_LOOP --> TESTED_ACTIONS_LOOP
      TESTED_ACTIONS_LOOP --> T_USER_GOAL_ROUTE

      T_USER_GOAL_ROUTE -->|yes| T_USER_GOAL_LENGTH_CHECK
      T_USER_GOAL_ROUTE -->|no| T_BLOCKING_ROUTE

      T_USER_GOAL_LENGTH_CHECK -->|yes| T_USER_GOAL_KEEP
      T_USER_GOAL_LENGTH_CHECK -->|no| T_USER_GOAL_DROP

      T_USER_GOAL_KEEP --> T_BLOCKING_ROUTE
      T_USER_GOAL_DROP --> T_BLOCKING_ROUTE

      T_BLOCKING_ROUTE -->|yes| T_BLOCKING_KEEP
      T_BLOCKING_ROUTE -->|no| T_USEFUL_TOPIC_ROUTE

      T_BLOCKING_KEEP --> T_USEFUL_TOPIC_ROUTE

      T_USEFUL_TOPIC_ROUTE -->|yes| T_ADD_MATCHED_TOPIC
      T_USEFUL_TOPIC_ROUTE -->|no| T_DROP_MATCHED_TOPIC
    end

    T_BUILD_OUTPUT["<b>Build final output</b><br/>
    Return turnUnderstandingDelta<br/><br/>
    Optional internal metadata:<br/>
    numberOfCleanedFields"]

    T_INIT --> T_SET_SECURITY
    T_SET_SECURITY --> T_BUILD_ATTACHMENTS
    T_BUILD_ATTACHMENTS --> T_ATTACHMENTS_ROUTE
    T_ATTACHMENTS_ROUTE -->|yes| T_SET_ATTACHMENTS
    T_ATTACHMENTS_ROUTE -->|no| T_ANALYSIS_EMPTY_ROUTE
    T_SET_ATTACHMENTS --> T_ANALYSIS_EMPTY_ROUTE

    T_ANALYSIS_EMPTY_ROUTE -->|yes| T_RETURN_EMPTY
    T_ANALYSIS_EMPTY_ROUTE -->|no| T_SET_SOURCE

    T_RETURN_EMPTY --> T_BUILD_OUTPUT

    T_SET_SOURCE --> T_SET_LANGUAGE
    T_SET_LANGUAGE --> T_SOURCE_ROUTE

    T_SOURCE_ROUTE -->|light| T_LIGHT_PROCESS
    T_SOURCE_ROUTE -->|full| T_FULL_NON_TOPIC

    T_LIGHT_PROCESS --> T_BUILD_OUTPUT

    T_FULL_NON_TOPIC --> T_TOPIC_ROUTE

    T_TOPIC_ROUTE -->|no| T_BUILD_OUTPUT
    T_TOPIC_ROUTE -->|yes| TOPIC_LOOP

    T_NEW_TOPIC --> T_BUILD_OUTPUT
    T_KEEP_FOR_REVIEW --> T_BUILD_OUTPUT
    T_ADD_MATCHED_TOPIC --> T_BUILD_OUTPUT
    T_DROP_MATCHED_TOPIC --> T_BUILD_OUTPUT
  end

  subgraph NEXT_STEP["Next step"]
    direction TB
    NEXT_OUTPUTS["<b>Output produced by assembleTurnUnderstandingDelta</b><br/>
    turnUnderstandingDelta"]
  end

  PREVIOUS_STEP --> PIPELINE
  PIPELINE --> NEXT_STEP

  classDef previousBlock fill:#0b6b3a,stroke:#064a28,color:#ffffff,stroke-width:1px;
  classDef routeBlock fill:#fff2cc,stroke:#d6b656,color:#000000,stroke-width:1px;
  classDef processingBlock fill:#d9e8f5,stroke:#4f93d2,color:#000000,stroke-width:1px;
  classDef nextOutputBlock fill:#8b0000,stroke:#5c0000,color:#ffffff,stroke-width:1px;

  class PREVIOUS_INPUTS previousBlock;

  class T_ATTACHMENTS_ROUTE,T_ANALYSIS_EMPTY_ROUTE,T_SOURCE_ROUTE,T_TOPIC_ROUTE,T_MATCH_ROUTE,T_EXISTING_ROUTE,T_DETAIL_EXISTS_ROUTE,T_DETAIL_DUPLICATE_ROUTE,T_TESTED_ACTION_EXISTS_ROUTE,T_USER_GOAL_ROUTE,T_USER_GOAL_LENGTH_CHECK,T_BLOCKING_ROUTE,T_USEFUL_TOPIC_ROUTE routeBlock;

  class T_INIT,T_SET_SECURITY,T_BUILD_ATTACHMENTS,T_SET_ATTACHMENTS,T_RETURN_EMPTY,T_SET_SOURCE,T_SET_LANGUAGE,T_LIGHT_PROCESS,T_FULL_NON_TOPIC,T_NEW_TOPIC,T_FIND_EXISTING,T_KEEP_FOR_REVIEW,T_INIT_MATCHED_DELTA,T_DETAIL_KEEP_NEW,T_DETAIL_COMPARE,T_DETAIL_DROP,T_DETAIL_KEEP_PRECISION,T_TESTED_ACTION_DROP,T_TESTED_ACTION_KEEP,T_USER_GOAL_KEEP,T_USER_GOAL_DROP,T_BLOCKING_KEEP,T_ADD_MATCHED_TOPIC,T_DROP_MATCHED_TOPIC,T_BUILD_OUTPUT processingBlock;

  class NEXT_OUTPUTS nextOutputBlock;

  style PIPELINE fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style PREVIOUS_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;
  style NEXT_STEP fill:#fff2cc,stroke:#d6b656,stroke-width:1px,color:#000000;

  style TOPIC_LOOP fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style DETAILS_LOOP fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;
  style TESTED_ACTIONS_LOOP fill:#eef8ff,stroke:#000000,stroke-width:1px,color:#000000;

  linkStyle default stroke:#000000,stroke-width:2px;
  ```

Note:
`TurnUnderstandingDelta.attachments` stores lightweight references only. It does not store the complete `LatestUserAttachment`, the complete `AttachmentAnalysisItem`, local `path`, raw `url`, data URLs, or base64 payloads. A short safe `accessUrl` can be copied only when available and suitable for long-term history.
