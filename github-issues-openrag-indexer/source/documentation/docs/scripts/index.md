---
title: Migration Scripts
sidebar_position: 1
---

## Twake Workplace users migration script

This script migrates LDAP users to the PBKDF2 + Scrypt hashing format

### Usage

#### Command-line arguments

| Option            | Alias | Description                     | Required |
| ----------------- | ----- | ------------------------------- | -------- |
| `--domain`        | `-d`  | Domain name for password crypto | yes      |
| `--url`           | `-u`  | LDAP server URL                 | yes      |
| `--adminDn`       | `-a`  | LDAP admin DN                   | yes      |
| `--adminPassword` | `-p`  | LDAP admin password             | yes      |
| `--baseDn`        | `-b`  | LDAP base DN                    | yes      |

#### Run the script

```bash
npm run migrate:twp -- \
  --domain example.com \
  --url ldap://ldap.example.com \
  --adminDn "cn=admin,dc=example,dc=com" \
  --adminPassword "secret" \
  --baseDn "dc=example,dc=com"
```

> The extra `--` is required when passing arguments via npm scripts.

## Cozy users migration script

This script migrates Cozy users from a JSON file to the Twake Workplace LDAP.

### Usage

#### Command-line arguments

| Option            | Alias | Description                               | Required |
| ----------------- | ----- | ----------------------------------------- | -------- |
| `--domain`        | `-d`  | Domain name for password crypto           | yes      |
| `--url`           | `-u`  | LDAP server URL                           | yes      |
| `--adminDn`       | `-a`  | LDAP admin DN                             | yes      |
| `--adminPassword` | `-p`  | LDAP admin password                       | yes      |
| `--baseDn`        | `-b`  | LDAP base DN                              | yes      |
| `--file`          | `-f`  | user JSON file                            | yes      |
| `--output`        | `-o`  | file where migrated users will be written | yes      |

#### Run the script

```bash
npm run migrate:cozy -- \
  --domain example.com \
  --url ldap://ldap.example.com \
  --adminDn "cn=admin,dc=example,dc=com" \
  --adminPassword "secret" \
  --baseDn "dc=example,dc=com" \
  --file /path/to/cozy-users.json \
  --output /path/to/output.txt
```

#### Example JSON Input

```json
[
  {
    "domain": "user.example.com",
    "passphrase_hash": "base64(scrypt(pbkdf2))",
    "auth_mode": 1,
    "passphrase_kdf_iterations": 5555,
    "key": "key",
    "public_key": "something",
    "private_key": "something else",
    "email": "user@example.com"
  },
  {
    "domain": "user2.example.com",
    "passphrase_hash": "base64(scrypt(pbkdf2))",
    "auth_mode": 1,
    "passphrase_kdf_iterations": 5555,
    "key": "key",
    "public_key": "something",
    "private_key": "something else",
    "email": "user2@example.com"
  }
]
```

#### Example Output

```
old_domain;new_domain;internal_email;twake_id
```
