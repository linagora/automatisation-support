import {
  buildProposeTopicUpdatesPrompt
} from "./buildProposeTopicUpdatesPrompt";
import {
  formatProposeTopicUpdatesOutput
} from "./formatProposeTopicUpdatesOutput";
import {
  requestProposeTopicUpdates
} from "./requestProposeTopicUpdates";

import type {
  ProposeTopicUpdatesInput,
  ProposeTopicUpdatesResult
} from "./typesProposeTopicUpdates.types";

function getExistingTopics(input: ProposeTopicUpdatesInput): unknown[] {
  return input.existingTopics ?? input.supportTopicKnowledge.segments_topic;
}

async function proposeTopicUpdates(
  input: ProposeTopicUpdatesInput
): Promise<ProposeTopicUpdatesResult> {
  if (input.textUnderstandings.length === 0) {
    return {
      topicUpdateProposals: []
    };
  }

  const existingTopics = getExistingTopics(input);
  const prompt = buildProposeTopicUpdatesPrompt({
    existingTopics,
    textUnderstandings: input.textUnderstandings,
    recentInteractionContext: input.recentInteractionContext,
    latestUserMessageContent: input.latestUserMessageContent
  });
  const rawProposeTopicUpdates = await requestProposeTopicUpdates({
    prompt
  });
  const formattedOutput = formatProposeTopicUpdatesOutput({
    existingTopics,
    textUnderstandings: input.textUnderstandings,
    rawProposeTopicUpdates
  });

  return {
    topicUpdateProposals: formattedOutput.topicUpdateProposals
  };
}

export {
  proposeTopicUpdates
};
