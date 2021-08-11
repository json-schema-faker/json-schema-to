[![Build status](https://github.com/json-schema-faker/json-schema-to/workflows/build/badge.svg)](https://github.com/json-schema-faker/json-schema-to/actions)
[![NPM version](https://badge.fury.io/js/json-schema-to.svg)](http://badge.fury.io/js/json-schema-to)
[![Coverage Status](https://codecov.io/github/json-schema-faker/json-schema-to/coverage.svg?branch=master)](https://codecov.io/github/json-schema-faker/json-schema-to?branch=master)
[![Dependency Status](https://david-dm.org/json-schema-faker/json-schema-to/status.svg)](https://david-dm.org/json-schema-faker/json-schema-to)
[![devDependency Status](https://david-dm.org/json-schema-faker/json-schema-to/dev-status.svg)](https://david-dm.org/json-schema-faker/json-schema-to#info=devDependencies)

# JSON-Schema To <br> ≤GraphQL|Protobuf|Code≥.™

Generate third-party definitions directly from your JSON-Schema.

## Contribute!

This module is under development, we're missing:

- [ ] Documentation
- [ ] Advanced examples
- [ ] TypeScript support
- [ ] Complete unit-testing
- [ ] Complete code-coverage

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

### TypeScript

We're able to produce `.d.ts` files as well.

Types, enums and interfaces are exported together in a single entry-point:

```ts
import type { User, Success } from './generated';

const ok: Success = { success: true };
const user: User = { email: 'a@b.c', role: 'USER' };

console.log(ok);
console.log(user);
```

### Enumerations

The generated `index.js` script exports a function that can be called to augment any object with the exported enums:

```js
// main/index.js
require('../generated')(module.exports = {
  // other stuff
});
```

Later, just import your wrapped module and use the available enums, e.g.

```ts
// test.ts
import { someEnum } from './main';

const value: someEnum = someEnum.SOME_VALUE;
```

> If you have a `./main/index.d.ts` file any used enum will be type-checked in your script.

### Supported keywords

Currently, a small subset of keywords from JSON-Schema v4 are supported:

- `id` &mdash; Used to declare types or services, it MUST be unique
- `$ref` &mdash; Dereferencing is resolved against defined refs only
- `enum` &mdash; Fixed set of values to enumerate, strings only
- `type` &mdash; Declare the used type of any given definition
- `items` &mdash; Standard definition of repeated objects, array will not work
- `required` &mdash; List of required properties to declare in the generated types
- `properties` &mdash; Standard set of properties from a given object, they are the type props
- `definitions` &mdash; Additional types to export, if no `id` is given then its basename will be used

> ⚠ More keywords can be implemented later, by now complete support is no a requirement.
