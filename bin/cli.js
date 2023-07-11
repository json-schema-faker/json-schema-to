'use strict';

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

if (!(argv.flags.json || argv.flags.graphql || argv.flags.protobuf || argv.flags.typescript)) {
  process.stderr.write(`${USAGE_INFO}\n`);
  process.stderr.write('Unknown output, please give --json, --graphql, --protobuf or --typescript\n');
  process.exit(1);
}
const glob = require('glob');
const path = require('path');
const fs = require('fs-extra');

const load = require('../lib')(argv.flags);
const utils = require('../lib/utils');

const cwd = path.resolve(argv.flags.cwd || '.');
const pkg = argv.flags.pkg || path.basename(cwd);
const src = path.join(cwd, argv.flags.src || 'models');
const dest = path.join(cwd, argv.flags.dest || 'generated');
const refs = (argv.flags.refs || '').split(',').filter(Boolean);
const types = argv.flags.types ? path.join(cwd, argv.flags.types === true ? 'types' : argv.flags.types) : undefined;
const common = utils.safe(argv.flags.common || 'common', '-');

const schemas = load(src).reduce((prev, cur) => {
  prev[cur.id] = prev[cur.id] || {};

  Object.assign(prev[cur.id], cur);

  return prev;
}, {});

const references = types ? load(types) : [];

const Service = require('../lib/service');

function run(id, task) {
  process.stdout.write(`\r\x1b[36mwrite\x1b[0m ${id}\x1b[K`);

  try {
    task();
    process.stdout.write('\n');
  } catch (e) {
    process.stderr.write(`\r\x1b[31m${e.stack}\x1b[0m\n`);
    process.exit(1);
  }
}

function fname(file) {
  return path.basename(file).replace(/\b[a-z]/g, _=> _.toUpperCase());
}

function clear(pattern, baseDir) {
  if (argv.flags.prune) {
    process.stderr.write(`Removing ${pattern} files from ./${path.relative(process.cwd(), baseDir)}\n`);

    glob.sync(pattern, { cwd: baseDir }).forEach(x => {
      fs.unlinkSync(path.join(baseDir, x));
    });
  }
}

function write(file, callback) {
  const destFile = path.resolve(dest, file);

  run(path.relative(process.cwd(), destFile), () => {
    fs.outputFileSync(destFile, callback());
  });
}

function output(name, repository) {
  if (argv.flags.graphql) {
    write(`${name}.gql`, () => repository.graphql);

    if (argv.flags.queries) {
      let index = '';
      repository.queries.forEach(sub => {
        if (sub.query === false) return;

        write(`queries/${sub.key}.gql`, () => sub.toString());

        const _name = sub.key.replace(/[A-Z]/g, '_$&').toUpperCase();

        index += `export { default as ${_name} } from './${sub.key}.gql';\n`;
      });

      write(`queries/index.${argv.flags.esm && argv.flags.module ? 'mjs' : 'js'}`, () => index);
    }
  }

  if (argv.flags.protobuf) {
    write(`${name}.proto`, () => repository.protobuf);
  }

  if (argv.flags.typescript) {
    write(`${name}.d.ts`, () => repository.typescript);
  }
}

Promise.resolve()
  .then(() => Service.load(schemas, references, null, argv.flags.docs))
  .then(repository => Service.build({ pkg, refs }, repository))
  .then(repository => {
    if (argv.flags.typescript) {
      clear('*.d.ts', dest);
    }

    if (argv.flags.protobuf) {
      clear('*.proto', dest);
    }

    if (argv.flags.graphql) {
      clear('*.gql', dest);

      if (argv.flags.queries) {
        clear('queries/*.*', dest);
      }
    }

    if (argv.flags.json) {
      clear('*.{js,json}', dest);

      Object.keys(schemas).forEach(x => {
        write(`${x}.json`, () => JSON.stringify({ ...schemas[x], service: undefined }, null, 2));
      });

      if (argv.flags.json) {
        write(`${common}.json`, () => JSON.stringify(references, null, 2));

        const groups = {};

        Object.keys(schemas).forEach(schema => {
          const def = schemas[schema];
          const key = (def.options && def.options.database) || 'default';

          if (!groups[key]) groups[key] = [];
          groups[key].push(schema);
        });

        write(`${common}.${argv.flags.esm && argv.flags.module ? 'mjs' : 'js'}`, () => {
          const stack = [repository.enums.buffer];

          Object.keys(groups).forEach(cur => {
            if (argv.flags.esm) {
              stack.unshift(groups[cur].map(x => `import ${fname(x)}Json from './${x}.json' assert { type: 'json' };\n`).join(''));
              stack.unshift(`import ${common}Json from './${common}.json' assert { type: 'json' };\n`);
              stack.push(`__factory['@${cur}'] = [\n${groups[cur].map(x => `  ${fname(x)}Json`).join(',\n')}].concat(${common}Json);\n`);
            } else {
              stack.push(`__factory['@${cur}'] = [\n${
                groups[cur].map(x => `  require('./${x}.json'),\n`).join('')
              }].concat(require('./${common}.json'));\n`);
            }
          });

          if (repository.enums.set.length > 0) {
            repository.enums.set.forEach((x, i) => stack.push(`${
              argv.flags.esm ? 'export const ' : '__factory.'
            }${x} = __ref(__enums[${i}][1], '${x}');\n`));
          }

          stack.push(argv.flags.esm ? 'export default __factory;\n' : 'module.exports = __factory;\n');

          return `/* eslint-disable */\n${stack.join('')}`;
        });
      }
    }

    output(common, repository);
  })
  .catch(e => {
    process.stderr.write(`${e.stack}\n`);
    process.exit(1);
  });
