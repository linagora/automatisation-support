---
title: Architecture Decision Records
sidebar_position: 1
---

Architecture Decision Records (ADRs) document the important choices behind Twake Workplace and the integration between its components.

**The sidebar lists every ADR** by title. Open an ADR to see its current status, context, and decision. Status lives inside each file (not duplicated here), so it stays in sync with the decision itself.

New ADRs? Drop a new file in `documentation/docs/adrs/`. It shows up automatically.

## External ADRs

Decisions that belong to upstream projects are tracked in their own repositories:

- [Apache James ADRs](https://github.com/apache/james-project/tree/master/src/adr) — the mail backend Twake Mail is built on.
- [TMail private ADRs](https://github.com/linagora/james-project-private/tree/master/adr) — TMail-specific decisions on top of James.
- [TMail frontend ADRs](https://github.com/linagora/tmail-flutter/tree/master/docs/adr) — Flutter web/mobile decisions.
- Cozy Stack — routing, per-instance isolation, and sharing are listed in the sidebar alongside the Twake Workplace ADRs (ADRs 037–039).
