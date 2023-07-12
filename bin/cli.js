#!/usr/bin/env node

const USAGE_INFO = `
JSON-Schema To ≤GraphQL|Protobuf|Code≥.™

  -w, --cwd         Working directory for all sources (default 'process.cwd()')
  -s, --src         List schemas from this directory (default 'models')
  -d, --dest        Output definitions to this directory (default 'generated')
  -p, --prune       Remove generated files before writing new ones

  -m, --esm         Ensure generated code is ESM (default is CommonJS)
  -k, --pkg         Package name for generated services (--protobuf only)
  -r, --refs        External imports for generated services (--protobuf only)

  -D, --docs        Turn descriptions as comments on model and field declarations
  -t, --types       Scan for additional schemas, if boolean is given 'types' is used
  -c, --common      Filename used for saving common definitions (default 'common')
  -b, --bundle      Generate multiple files instead of a single file as result
  -i, --ignore      Pattern to skip some files, e.g. \`-i sample\`

  -q, --queries     Save GraphQL queries along with schemas

      --json        Produce JSON as output
      --graphql     Produce GraphQL as output
      --protobuf    Produce Protobuf as output
      --typescript  Produce TypeScript types as output

Examples:
  json-schema-to -tk my-app -w src/schema --json
  json-schema-to -bt definitions --protobuf --graphql
`;

const argv = require('wargs')(process.argv.slice(2), {
  boolean: 'bpqm',
  alias: {
    w: 'cwd',
    k: 'pkg',
    m: 'esm',
    s: 'src',
    d: 'dest',
    r: 'refs',
    D: 'docs',
    t: 'types',
    p: 'prune',
    i: 'ignore',
    c: 'common',
    M: 'module',
    b: 'bundle',
    q: 'queries',
  },
});

try {
  require('./main').build(argv);
} catch (e) {
  process.stderr.write(`${USAGE_INFO}\n`);
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
}
