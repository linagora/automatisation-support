# Conversation History `contextLLM`

`conversationHistory.contextLLM` is a compact, prompt-friendly history summary for LLM calls.

The raw conversation history remains available in patches and internal data. `contextLLM` does not replace raw events. It is only a standardized textual summary meant to help the next LLM turn without sending large JSON payloads.

Generation of `contextLLM` is intentionally not implemented inside `support-processing-pipeline` for now. Another layer should prepare it before the pipeline receives `conversationHistory`.

## General Format

Use one short log per line.

```txt
User(topic): add_topic topic_id={id} label="{label}" category={category}
User(topic): update_topic topic_id={id} fields=[os, frequency, observed_result]
User(topic): tested_solution topic_id={id} action="{action}" outcome={outcome}
User(signal): signal types=[thanks_neutral, time_sensitive] verbatim="{verbatim}"
User(scope_boundary): scope_boundary type={type} verbatim="{verbatim}"

Bot(topic): ask_more_info topic_id={id} fields=[auth_method, expected_result]
Bot(topic): propose_solution topic_id={id} solution_ids=[...]
Bot(topic): acknowledge topic_id={id} next_step={next_step}
Bot(signal): respond_signal types=[thanks_neutral, time_sensitive]
Bot(handover): handover_announced reason={reason}
```

## Authorized Roles

- `User(topic)`
- `User(signal)`
- `User(scope_boundary)`
- `User(suspicious)`
- `User(lack_comprehension)`
- `Bot(topic)`
- `Bot(signal)`
- `Bot(scope_boundary)`
- `Bot(handover)`
- `System(note)`

## Authorized Actions

For `User(topic)`:

- `add_topic`
- `continue_topic`
- `update_topic`
- `tested_solution`
- `mark_blocking`
- `mark_resolved`

For `User(signal)`:

- `signal`

For `User(scope_boundary)`:

- `scope_boundary`

For `User(suspicious)`:

- `suspicious_segment`

For `User(lack_comprehension)`:

- `lack_comprehension`

For `Bot(topic)`:

- `ask_more_info`
- `propose_solution`
- `acknowledge`
- `wait_more_info`
- `wait_apply_solution`
- `wait_for_support`

For `Bot(signal)`:

- `respond_signal`

For `Bot(scope_boundary)`:

- `decline_scope_boundary`

For `Bot(handover)`:

- `handover_announced`

## Rules

- A log must be short.
- A log must represent one fact useful for the next turn.
- Do not store the full user or bot response.
- Keep verbatim quotes only when they are useful.
- Always include `topic_id` when the log concerns a topic.
- Use exact internal field names for `fields=[...]`.
- Do not invent information absent from the analysis.
- Raw data remains in patches; `contextLLM` is only a prompt-friendly summary.

## Example

```txt
User(topic): add_topic topic_id=1 label="Twake Drive : create : folder" category=bug
User(topic): update_topic topic_id=1 fields=[platform, os, trigger_action, observed_result, expected_result]
User(topic): add_topic topic_id=2 label="Twake : access : account" category=access_security
User(topic): update_topic topic_id=2 fields=[access_action, observed_result]
User(signal): signal types=[thanks_neutral, time_sensitive] verbatim="Merci d'avance pour votre aide, c'est assez urgent pour moi."
User(scope_boundary): scope_boundary type=unrelated_request verbatim="Pouvez-vous m'aider à récupérer mon compte Instagram ?"

Bot(topic): acknowledge topic_id=1 next_step=wait_for_support
Bot(topic): ask_more_info topic_id=2 fields=[auth_method, expected_result]
Bot(signal): respond_signal types=[thanks_neutral, time_sensitive]
Bot(scope_boundary): decline_scope_boundary type=unrelated_request
```
