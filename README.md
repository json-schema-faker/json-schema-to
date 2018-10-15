[![Build Status](https://travis-ci.org/agave/json-schema-to.svg?branch=master)](https://travis-ci.org/agave/json-schema-to)
[![NPM version](https://badge.fury.io/js/json-schema-to.svg)](http://badge.fury.io/js/json-schema-to)
[![Coverage Status](https://codecov.io/github/agave/json-schema-to/coverage.svg?branch=master)](https://codecov.io/github/agave/json-schema-to?branch=master)
[![Dependency Status](https://david-dm.org/agave/json-schema-to/status.svg)](https://david-dm.org/agave/json-schema-to)
[![devDependency Status](https://david-dm.org/agave/json-schema-to/dev-status.svg)](https://david-dm.org/agave/json-schema-to#info=devDependencies)

# JSON-Schema To <br> ≤GraphQL|Protobuf|Code≥.™

Generate third-party definitions directly from your JSON-Schema.

## How it works?

JSON-Schema, GraphQL and Protobuf are generated from YAML definitions, e.g.

```yaml
id: User
service:
  calls:
  - set: updatePassword
    resp: User
    input: UpdatePasswordParams
    params: UpdatePasswordRequest
definitions:
  UpdatePasswordParams:
  UpdatePasswordRequest:
```

This definition is also a JSON-Schema definition.

> Actually, it can be a `.json` file to but YAML format it's easier to maintain.

Due `resp`, `input` and `params` are schema identifiers they'll be looked-up from all available schemas or from `#/definitions`  on the current file.

Options for `calls` are:

- `get` &mdash; RPC call (or Query)
- `set` &mdash; RPC call (or Mutation)
- `resp` &mdash; Response type
- `input` &mdash; Request type
- `params` &mdash; Request type (Protobuf only)

> Use the `params` option only if you want different input types.

Having some definitions like this we can produce different outputs, e.g.

```
$ tree .
.
└── schema
    └── test.yml

1 directory, 1 file

$ npx json-schema-to -s schema --json --graphql --protobuf
write ./generated/user.json
write ./generated/user.gql
write ./generated/user.proto
write ./generated/common.json
write ./generated/common.gql
write ./generated/common.proto
```

Now you can use those sources in your application.

> Use `--help` to display more usage info from the CLI
