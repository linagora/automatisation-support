---
title: CLI Cheatsheet
sidebar_position: 5
---

Day-to-day `cozy-stack` commands for managing instances and feature flags. An
instance is identified by its domain (e.g. `cozy.localhost:8080`); locally that
includes the port.

## Instances

### Create

```console
$ cozy-stack instances add --apps drive,home,settings --passphrase cozy \
    --email alice@example.com --public-name Alice docs-demo.localhost:8080
```

Alias: `create`. Useful flags:

| Flag                       | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `--apps`                   | Comma-separated apps to preinstall                       |
| `--passphrase`             | Set login passphrase (skips onboarding; handy for tests) |
| `--email`, `--public-name` | Owner email and display name                             |
| `--locale`                 | Instance locale (default `en`)                           |
| `--disk-quota`             | Storage quota, e.g. `5GB`                                |
| `--context-name`           | Assign the instance to a context                         |
| `--settings`               | Inline settings, e.g. `context:foo,offer:premium`        |

Setting `COZY_DISABLE_INSTANCES_ADD_RM` in the stack env disables both `add` and
`destroy`; its value becomes the error message.

### List and show

```console
$ cozy-stack instances ls
cozy.localhost:8080       en  unlimited  onboarded  v38  cozy1a4e1aab...
docs-demo.localhost:8080  en  3.0 GB     onboarded  v38  cozyc1147729...
```

- `--fields domain,disk_quota` to pick columns, `--available-fields` to list them
- `--json` for the full record
- `cozy-stack instances show <domain>` for one instance, `instances count` to count

### Update

```console
$ cozy-stack instances modify <domain> --disk-quota 5GB --public-name "Alice Demo"
```

`modify` flags include `--disk-quota`, `--email`, `--public-name`, `--locale`,
`--tz`, `--context-name`, `--domain-aliases`, `--blocked` / `--blocking-reason`,
`--onboarding-finished`, `--deleting=false`.

Targeted shortcuts:

| Command                                        | Effect                                            |
| ---------------------------------------------- | ------------------------------------------------- |
| `instances set-disk-quota <domain> 3GB`        | Set quota (`0` removes it)                        |
| `instances set-passphrase <domain> <pass>`     | Reset login passphrase                            |
| `instances auth-mode <domain> two_factor_mail` | Set auth mode (`basic` or `two_factor_mail`)      |
| `instances debug --domain <domain> true`       | Per-instance debug logging (`--ttl`, default 24h) |
| `instances token-cli <domain> io.cozy.files`   | Mint a CLI token for the given scopes             |

### Destroy

```console
$ cozy-stack instances destroy <domain> --force
```

Aliases: `rm`, `delete`, `remove`. Permanently removes the instance and its
data. Without `--force` it prompts for confirmation.

:::note Only if you run RAG
If a RAG/AI server is configured (the `rag` URL in `cozy.yaml`), deletion flags
the instance as `deleting` and calls that server to drop its vector data. When
it is down, destroy fails (`connect: connection refused`) and a retry reports
`The deletion has already been requested`. Recover by clearing the flag first:
`cozy-stack instances modify <domain> --deleting=false`, then destroy again.
:::

## Feature flags

Flags resolve from layers (highest priority first): per-instance flags, feature
sets, context ratios, config, defaults. Command alias: `feature`. JSON updates
take `null` to remove a flag.

| Command                                  | Writable              | Scope                                          |
| ---------------------------------------- | --------------------- | ---------------------------------------------- |
| `features flags --domain <d> '{...}'`    | yes                   | One instance                                   |
| `features sets --domain <d> 'set1 set2'` | yes                   | One instance (replaces, no merge; `''` clears) |
| `features ratio --context <c> '{...}'`   | yes                   | A context (rollout ratio + value)              |
| `features defaults '{...}'`              | yes                   | All instances                                  |
| `features config --context <c>`          | no (config + restart) | A context                                      |
| `features show --domain <d>`             | read-only             | Resolved result (`--source` shows origin)      |

Per-instance flags, with no JSON arg to read, `null` to remove:

```console
$ cozy-stack features flags --domain <domain> '{"cozy.fullstack": true}'   # set
$ cozy-stack features flags --domain <domain> '{"cozy.fullstack": null}'   # remove
$ cozy-stack features flags --domain <domain>                              # read
```

Context ratio for gradual rollout:

```console
$ cozy-stack features ratio --context beta '{"demo_flag": [{"ratio": 0.5, "value": 1}]}'
```

## Apps on an instance

```console
$ cozy-stack apps install --domain <domain> drive registry://drive/stable
$ cozy-stack apps ls --domain <domain>
```

`apps install <slug> [source]` accepts registry, git, and ssh sources; manage
with `apps update`, `apps show`, `apps uninstall`.

Append `--help` to any command for its full flag list.
