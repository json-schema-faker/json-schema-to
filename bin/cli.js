'use strict';

const USAGE_INFO = `
JSON-Schema To ≤GraphQL|Protobuf|Code≥.™

  -w, --cwd       Working directory for all sources (default 'process.cwd()')
  -s, --src       List schemas from this directory (default 'models')
  -d, --dest      Output definitions to this directory (default 'generated')
  -p, --prune     Remove generated files before writing new ones

  -k, --pkg       Package name for generated services (--protobuf only)
  -r, --refs      External imports for generated services (--protobuf only)

  -t, --types     Scan for additional schemas, if boolean is given 'types' is used
  -i, --ignore    Pattern to skip some files, e.g. \`-i sample\` (--json only)
  -c, --common    Filename used for saving common definitions (default 'common')
  -b, --bundle    Generate multiple files instead of a single file as result

      --json      Produce JSON as output
      --graphql   Produce GraphQL as output
      --protobuf  Produce Protobuf as output

Examples:
  json-schema-to -tk my-app -w src/schema --json
  json-schema-to -bt definitions --protobuf --graphql
`;

const argv = require('wargs')(process.argv.slice(2), {
  alias: {
    w: 'cwd',
    k: 'pkg',
    s: 'src',
    d: 'dest',
    r: 'refs',
    t: 'types',
    p: 'prune',
    i: 'ignore',
    c: 'common',
    b: 'bundle',
  },
  boolean: 'bp',
});

if (!(argv.flags.json || argv.flags.graphql || argv.flags.protobuf)) {
  process.stderr.write(`${USAGE_INFO}\n`);
  process.stderr.write('Unknown output, please give --json, --graphql or --protobuf\n');
  process.exit(1);
}

const is = require('is-my-json-valid');
const YAML = require('yamljs');
const glob = require('glob');
const path = require('path');
const util = require('util');
const fs = require('fs');

const utils = require('../lib/utils');

const cwd = path.resolve(argv.flags.cwd || '.');
const pkg = argv.flags.pkg || path.basename(cwd);
const src = path.join(cwd, argv.flags.src || 'models');
const dest = path.join(cwd, argv.flags.dest || 'generated');
const refs = (argv.flags.refs || '').split(',').filter(Boolean);
const types = argv.flags.types ? path.join(cwd, argv.flags.types === true ? 'types' : argv.flags.types) : undefined;
const params = argv.flags.params || undefined;
const common = utils.safe(argv.flags.common || 'common', '-');

const validateDefinition = is(require('./dsl').definitions.Definition);
const validateService = is(require('./dsl').definitions.Service);
const validateModel = is(require('./dsl').definitions.Model);

function read(file) {
  return fs.readFileSync(file, 'utf8').toString();
}

function load(fromDir) {
  return glob.sync('**/*.{yml,yaml,json}', { cwd: fromDir })
    .filter(x => !argv.flags.ignore || !x.includes(argv.flags.ignore))
    .map(x => path.join(fromDir, x))
    .map(x => {
      const schema = x.indexOf('.json') !== -1
        ? JSON.parse(read(x))
        : YAML.parse(read(x));

      if (!schema.id) {
        throw new Error(`Missing schema identifier for ./${path.relative(process.cwd(), x)}`);
      }

      let validator = schema.service && validateService;

      if (schema.definitions && !validator) {
        validator = validateDefinition;
      }

      if (!validator) {
        validator = validateModel;
      }

      if (!validator(schema)) {
        process.stderr.write(`Invalid definition ${path.relative(process.cwd(), x)}:\n`);
        process.stderr.write(`${util.inspect(schema, { depth: 10, colors: true })}\n`);

        validator.errors.forEach(err => {
          const key = err.field.replace('data.', '');

          process.stderr.write(`- ${err.message}${err.field !== 'data' ? ` (${key})` : ''}\n`);
        });

        process.exit(1);
      }

      return schema;
    });
}

const schemas = load(src).reduce((prev, cur) => {
  prev[cur.id] = prev[cur.id] || {};

  Object.assign(prev[cur.id], cur);

  return prev;
}, {});

const references = types ? load(types) : [];

const Service = require('../lib/service');

function run(desc, task) {
  process.stdout.write(`\r${desc}`);

  try {
    task();
    process.stdout.write('\n');
  } catch (e) {
    process.stderr.write(` ... FAILED\n  ${e.stack}\n`);
    process.exit(1);
  }
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

  run(`write ./${path.relative(process.cwd(), destFile)}`, () => {
    fs.writeFileSync(destFile, callback());
  });
}

function output(name, model) {
  if (argv.flags.graphql) {
    write(`${name}.gql`, () => model.graphql);
  }

  if (argv.flags.protobuf) {
    write(`${name}.proto`, () => model.protobuf);
  }
}

Promise.resolve()
  .then(() => Service.load(src, schemas, references))
  .then(models => {
    if (!models.length) {
      throw new Error(`Empty bundle, ${Object.keys(schemas).length} schemas found in ./${path.relative(process.cwd(), src)}`);
    }

    if (argv.flags.bundle || argv.flags.json) {
      return Service.bundle({ pkg, refs, params }, models);
    }

    return Service.merge({ pkg, refs, params }, models);
  })
  .then(repository => {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }

    if (argv.flags.protobuf) {
      clear('*.proto', dest);
    }

    if (argv.flags.graphql) {
      clear('*.gql', dest);
    }

    if (argv.flags.json) {
      clear('*.{js,json}', dest);

      Object.keys(schemas).forEach(x => {
        write(`${x}.json`, () => JSON.stringify(schemas[x], null, 2));
      });
    }

    if (repository.models) {
      repository.models.forEach(x => {
        output(utils.safe(x.modelId, '-'), x, true);
      });

      if (argv.flags.json) {
        write(`${common}.json`, () => JSON.stringify(references, null, 2));
        write(`${common}.js`, () => `module.exports = [\n${
          Object.keys(schemas).map(x => `  require('./${x}.json'),\n`).join('')
        }].concat(require('./${common}.json'));\n`);
      }
    }

    output(common, repository);
  })
  .catch(e => {
    process.stderr.write(`${e.stack}\n`);
    process.exit(1);
  });
