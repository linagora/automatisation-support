---
title: OpenLDAP Schema
sidebar_position: 4
---

The B2B deployment requires a custom LDAP schema to store organization and user attributes. This page contains the full LDIF definition that must be loaded into OpenLDAP before any B2B service can operate.

For a higher-level overview of how these attributes are used, see [LDAP Structure](../overview/ldap-structure).

## Installation

```bash
ldapadd -Y EXTERNAL -H ldapi:/// -f twake.ldif
```

## Schema definition

```ldif
# Twake Workplace LDAP Schema for OpenLDAP cn=config
#
# OID base: 1.3.6.1.4.1.99999.1 (replace with your organization's OID)

dn: cn=twake,cn=schema,cn=config
objectClass: olcSchemaConfig
cn: twake

#
# Attribute Definitions
#

# twakeAdditionalName - Additional name (middle name)
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.1
  NAME 'twakeAdditionalName'
  DESC 'Additional name (middle name) for Twake user'
  EQUALITY caseIgnoreMatch
  SUBSTR caseIgnoreSubstringsMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
  SINGLE-VALUE )

# twakeNamePrefix - Name prefix (Mr, Mrs, Dr, etc.)
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.2
  NAME 'twakeNamePrefix'
  DESC 'Name prefix (honorific) for Twake user'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{64}
  SINGLE-VALUE )

# twakeEmails - JSON array of email addresses
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.3
  NAME 'twakeEmails'
  DESC 'JSON array of email addresses with type and primary flag'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
  SINGLE-VALUE )

# twakePhones - JSON array of phone numbers
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.4
  NAME 'twakePhones'
  DESC 'JSON array of phone numbers with type and primary flag'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
  SINGLE-VALUE )

# twakeAddresses - JSON array of addresses
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.5
  NAME 'twakeAddresses'
  DESC 'JSON array of postal addresses with extended fields'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
  SINGLE-VALUE )

# twakeImpp - JSON array of IMPP URIs
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.6
  NAME 'twakeImpp'
  DESC 'JSON array of IMPP URIs (SIP, XMPP, etc.)'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
  SINGLE-VALUE )

# twakeOrganizationRole - User role in organization
# DESC in twake.schema: 'admin, moderator, or member'. The 'owner' role is tracked at the
# org entry via twakeOrganizationOwner, not as a value of this attribute.
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.7
  NAME 'twakeOrganizationRole'
  DESC 'User role in organization: admin, moderator, or member'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{32}
  SINGLE-VALUE )

# twakeOrganizationLink - DN link to user organization
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.8
  NAME 'twakeOrganizationLink'
  DESC 'DN of the organization this user belongs to'
  EQUALITY distinguishedNameMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.12
  SINGLE-VALUE )

# twakeDomain - Organization domain
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.10
  NAME 'twakeDomain'
  DESC 'Domain name of the Twake organization'
  EQUALITY caseIgnoreMatch
  SUBSTR caseIgnoreSubstringsMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
  SINGLE-VALUE )

# twakeOrgStatus - Organization status
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.11
  NAME 'twakeOrgStatus'
  DESC 'Organization status: active or suspended'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{32}
  SINGLE-VALUE )

# twakeCreatedAt - Creation timestamp
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.12
  NAME 'twakeCreatedAt'
  DESC 'Creation timestamp in ISO 8601 format'
  EQUALITY caseIgnoreMatch
  ORDERING caseIgnoreOrderingMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{32}
  SINGLE-VALUE )

# twakeOrgMetadata - JSON metadata for organization
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.13
  NAME 'twakeOrgMetadata'
  DESC 'JSON metadata for organization (plan, industry, etc.)'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
  SINGLE-VALUE )

# twakeDisplayName
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.20
  NAME 'twakeDisplayName'
  DESC 'Display name for Twake user'
  EQUALITY caseIgnoreMatch
  SUBSTR caseIgnoreSubstringsMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
  SINGLE-VALUE )

# twakeFullname
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.21
  NAME 'twakeFullname'
  DESC 'Full name for Twake user'
  EQUALITY caseIgnoreMatch
  SUBSTR caseIgnoreSubstringsMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
  SINGLE-VALUE )

# twakeBirthday
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.22
  NAME 'twakeBirthday'
  DESC 'Birthday in YYYY-MM-DD format'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{10}
  SINGLE-VALUE )

# twakeGender
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.23
  NAME 'twakeGender'
  DESC 'Gender of the user'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{32}
  SINGLE-VALUE )

# twakeBirthplace
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.24
  NAME 'twakeBirthplace'
  DESC 'Birthplace of the user'
  EQUALITY caseIgnoreMatch
  SUBSTR caseIgnoreSubstringsMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
  SINGLE-VALUE )

# twakeJobTitle
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.25
  NAME 'twakeJobTitle'
  DESC 'Job title of the user'
  EQUALITY caseIgnoreMatch
  SUBSTR caseIgnoreSubstringsMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
  SINGLE-VALUE )

# twakeCompany
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.26
  NAME 'twakeCompany'
  DESC 'Company name of the user'
  EQUALITY caseIgnoreMatch
  SUBSTR caseIgnoreSubstringsMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
  SINGLE-VALUE )

# twakeNote
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.27
  NAME 'twakeNote'
  DESC 'Note or description for the user'
  EQUALITY caseIgnoreMatch
  SUBSTR caseIgnoreSubstringsMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{4096}
  SINGLE-VALUE )

# twakeScryptR
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.30
  NAME 'twakeScryptR'
  DESC 'Scrypt R parameter'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{16}
  SINGLE-VALUE )

# twakeScryptN
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.31
  NAME 'twakeScryptN'
  DESC 'Scrypt N parameter'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{16}
  SINGLE-VALUE )

# twakeScryptP
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.32
  NAME 'twakeScryptP'
  DESC 'Scrypt P parameter'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{16}
  SINGLE-VALUE )

# twakeScryptSalt
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.33
  NAME 'twakeScryptSalt'
  DESC 'Scrypt salt (base64 encoded)'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
  SINGLE-VALUE )

# twakeScryptDKLength
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.34
  NAME 'twakeScryptDKLength'
  DESC 'Scrypt derived key length'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{16}
  SINGLE-VALUE )

# twakeIterations
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.35
  NAME 'twakeIterations'
  DESC 'PBKDF2 iterations count'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{16}
  SINGLE-VALUE )

# twakePublicKey
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.36
  NAME 'twakePublicKey'
  DESC 'Public key in PEM format'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
  SINGLE-VALUE )

# twakePrivateKey
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.37
  NAME 'twakePrivateKey'
  DESC 'Encrypted private key in PEM format'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
  SINGLE-VALUE )

# twakeProtectedKey
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.38
  NAME 'twakeProtectedKey'
  DESC 'Protected encryption key'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{65536}
  SINGLE-VALUE )

# twakeTwoFactorEnabled
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.39
  NAME 'twakeTwoFactorEnabled'
  DESC 'Two-factor authentication enabled flag'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{8}
  SINGLE-VALUE )

# twakeRecoveryEmail
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.40
  NAME 'twakeRecoveryEmail'
  DESC 'Recovery email address'
  EQUALITY caseIgnoreMatch
  SUBSTR caseIgnoreSubstringsMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
  SINGLE-VALUE )

# twakeWorkspaceUrl
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.41
  NAME 'twakeWorkspaceUrl'
  DESC 'User workspace URL'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{1024}
  SINGLE-VALUE )

# twakeUserDomain
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.42
  NAME 'twakeUserDomain'
  DESC 'Domain associated with the user'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{256}
  SINGLE-VALUE )

# twakeAccountStatus - User account status (active, disabled)
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.43
  NAME 'twakeAccountStatus'
  DESC 'User account status: active or disabled'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{32}
  SINGLE-VALUE )

# twakeOrganizationOwner - DN of the organization owner
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.44
  NAME 'twakeOrganizationOwner'
  DESC 'DN of the organization owner user'
  EQUALITY distinguishedNameMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.12
  SINGLE-VALUE )

# twakeOrganizationId - Organization ID for B2B users
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.45
  NAME 'twakeOrganizationId'
  DESC 'Organization ID for B2B users'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{64}
  SINGLE-VALUE )

# twakeIsTechnical - Technical user flag
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.46
  NAME 'twakeIsTechnical'
  DESC 'Technical user flag: TRUE if technical user, absent if normal user'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{8}
  SINGLE-VALUE )

# twakeInvited - Invitation status flag
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.47
  NAME 'twakeInvited'
  DESC 'Invitation status: TRUE if user is invited, FALSE or absent if not'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{8}
  SINGLE-VALUE )

# twakeIsDeleted - Soft delete flag
olcAttributeTypes: ( 1.3.6.1.4.1.99999.1.1.48
  NAME 'twakeIsDeleted'
  DESC 'Soft delete flag: TRUE if user is deleted, absent if not'
  EQUALITY caseIgnoreMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.15{8}
  SINGLE-VALUE )

#
# Object Class Definitions
#

# twakeAccount - Base object class for Twake users
olcObjectClasses: ( 1.3.6.1.4.1.99999.1.2.1
  NAME 'twakeAccount'
  DESC 'Twake user account'
  SUP top
  AUXILIARY
  MAY ( twakeOrganizationRole $ twakeOrganizationLink $ twakeOrganizationId $
        twakeScryptR $ twakeScryptN $ twakeScryptP $
        twakeScryptSalt $ twakeScryptDKLength $ twakeIterations $
        twakePublicKey $ twakePrivateKey $ twakeProtectedKey $
        twakeTwoFactorEnabled $ twakeRecoveryEmail $
        twakeWorkspaceUrl $ twakeUserDomain $ twakeCreatedAt $
        twakeAccountStatus $ twakeIsTechnical $ twakeInvited $ twakeIsDeleted ) )

# twakeWhitePages - Extended user profile
olcObjectClasses: ( 1.3.6.1.4.1.99999.1.2.2
  NAME 'twakeWhitePages'
  DESC 'Twake user white pages profile with complex fields'
  SUP top
  AUXILIARY
  MAY ( twakeAdditionalName $ twakeNamePrefix $
        twakeEmails $ twakePhones $ twakeAddresses $ twakeImpp $
        twakeDisplayName $ twakeFullname $ twakeBirthday $
        twakeGender $ twakeBirthplace $ twakeJobTitle $
        twakeCompany $ twakeNote ) )

# twakeOrganization - Object class for organization attributes
olcObjectClasses: ( 1.3.6.1.4.1.99999.1.2.3
  NAME 'twakeOrganization'
  DESC 'Twake organization attributes'
  SUP top
  AUXILIARY
  MAY ( twakeDomain $ twakeOrgStatus $ twakeCreatedAt $ twakeOrgMetadata $ twakeOrganizationOwner ) )
```

## Object classes summary

| Object class        | Type      | Purpose                                                  |
| ------------------- | --------- | -------------------------------------------------------- |
| `twakeAccount`      | AUXILIARY | Core user account attributes (role, status, crypto keys) |
| `twakeWhitePages`   | AUXILIARY | Extended profile fields (emails, phones, addresses)      |
| `twakeOrganization` | AUXILIARY | Organization attributes (domain, status, owner)          |
