---
title: Data and cozy-client
sidebar_position: 3
---

This guide covers how data is stored in CouchDB and how to query and mutate it using the cozy-client JavaScript library.

## Data structure in CouchDB

Useful links:

- CouchDB admin panel: http://localhost:5984/\_utils/#/\_all_dbs
- Data tutorial: https://docs.cozy.io/en/tutorials/data/
- Doctypes reference: https://docs.cozy.io/cozy-doctypes/
- cozy-client getting started: https://github.com/cozy/cozy-client/blob/master/docs/getting-started.md

### Doctypes

Doctypes define how data is organized in Cozy -- one doctype per kind of document (files, contacts, notes, etc.). A doctype acts as a schema for consistent data structures across the platform.

If you need to create a new doctype or add fields to an existing one, open a PR on the [cozy-doctypes](https://github.com/cozy/cozy-doctypes/) repository first.

### Databases

There is one database namespace per Cozy user (instance). Each is identified by a unique ID (e.g. `cozy1a4e1aabf424a194d7daf946d7b1337d`).

Find an instance's ID with:

```bash
cozy-stack instances ls
# or
cozy-stack instances show <instance-url>
```

In practice, you get one database per doctype per user. For example, if instance `cozyA` has doctypes `io.cozy.files` and `io.cozy.settings`, two databases are created: `cozyA/io.cozy.files` and `cozyA/io.cozy.settings`.

### Documents

Each document has a unique `_id` (generated at creation) and a `_rev` (revision, updated on every change). More on [revisions](https://docs.cozy.io/en/tutorials/data/advanced/#revisions).

## cozy-client

cozy-client handles:

- Authentication to the cozy-stack
- Read/write queries through the cozy-stack
- A local in-memory store for React components with optimized rendering and real-time updates

### Client creation

Two steps:

1. **Retrieve auth tokens** -- in web apps, parse the `[role=application]` div injected by cozy-stack. For OAuth clients (desktop, mobile), see the [OAuth documentation](https://docs.cozy.io/en/cozy-stack/auth/#what-about-oauth2).
2. **Instantiate cozy-client**

### Provider setup

In React, use `CozyProvider` at the top of the component tree:

```jsx
<CozyProvider client={client}>
  <App />
</CozyProvider>
```

Then use `useClient()` anywhere in the tree to access the client instance.

## Querying data

### Basic queries with `client.query()`

```javascript
import { useClient, Q } from "cozy-client";

const client = useClient();

// Get all files
const result = await client.query(Q("io.cozy.files"));
const files = result.data;

// Get a specific file by ID
const result = await client.query(Q("io.cozy.files").getById("some_doc_id"));
const file = result.data;

// Filter with a where clause
const result = await client.query(
  Q("io.cozy.files")
    .where({ name: { $eq: "SomeName" } })
    .indexes(["name"]),
);
const matches = result.data;
```

For more complex queries: https://docs.cozy.io/en/tutorials/data/queries/

### React queries with `useQuery()`

`useQuery()` wraps `client.query()` in a hook that manages loading/error states and auto-updates the component when data changes (via real-time):

```javascript
const queryDefinition = Q("io.cozy.files").getById("some_doc_id");
const queryResult = useQuery(queryDefinition, {
  as: "my_query_unique_name",
});

if (queryResult.fetchStatus === "loading") {
  return <div>Loading...</div>;
}

const document = queryResult.data[0];
return <div>{document.name}</div>;
```

## Mutating data

```javascript
const result = await client.query(queryDefinition);
const document = result.data;

document.name = "SomeNewName.ext";
await client.save(document);
```

More on mutations: https://github.com/cozy/cozy-client/blob/master/docs/getting-started.md#mutate-the-data

## Real-time updates

cozy-client supports real-time event streaming via WebSocket to the cozy-stack. When a document changes, registered queries re-run and React components update automatically.

### Setup

Register the plugin when creating the client:

```javascript
import { RealtimePlugin } from "cozy-realtime";

const client = new CozyClient({ ... });
client.registerPlugin(RealtimePlugin);
```

Then register for real-time updates on the doctypes you need:

```jsx
import { RealTimeQueries } from "cozy-client";

<RealTimeQueries doctype="io.cozy.files" />;
<RealTimeQueries doctype="io.cozy.settings" />;
```

Any `useQuery()` watching those doctypes will re-run automatically when documents change.

More info: https://github.com/cozy/cozy-libs/tree/master/packages/cozy-realtime
