const argv = require('wargs')(process.argv.slice(2));

if (!argv.flags.graphql && !argv.flags.protobuf) {
  process.stderr.write('Unknown output, please give --graphql or --protobuf\n');
  process.exit(1);
}

const glob = require('glob');
const path = require('path');
const fs = require('fs');

const cwd = process.cwd();
const pkg = argv.flags.pkg || path.basename(cwd);
const src = argv.flags.src || path.join(cwd, 'schemas');
const dest = argv.flags.dest || path.join(cwd, 'generated');
const refs = (argv.flags.refs || '').split(',').filter(Boolean);
const types = argv.flags.types || undefined;

function load(fromDir) {
  return glob.sync('**/*.json', { cwd: fromDir })
    .map(x => path.join(fromDir, x))
    .map(x => {
      const schema = JSON.parse(fs.readFileSync(x));

      if (!schema.id) {
        schema.id = path.basename(x, '.json');
      }

      return schema;
    });
}

const schemas = load(src).reduce((prev, cur) => {
  prev[cur.id] = cur;
  return prev;
}, {});

const references = types ? load(types) : [];

const Service = require('../lib/Service');

function run(desc, task) {
  process.stdout.write(`\r${desc} ... `);

  const start = new Date();

  try {
    task();
    process.stdout.write(`OK (in ${(new Date() - start) / 1000}ms)\n`);
  } catch (e) {
    process.stderr.write(`ERROR.\n${e.message}\n`);
    process.exit(1);
  }
}

function write(file, callback) {
  const destFile = path.resolve(dest, file);

  run(`write ./${path.relative(cwd, destFile)}`, () => {
    fs.writeFileSync(destFile, callback());
  });
}

Promise.resolve()
  .then(() => Service.load(src, schemas, references))
  .then(bundle => {
    if (!bundle.length) {
      throw new Error(`Empty bundle, given directory: ./${path.relative(cwd, src)}`);
    }

    return Service.merge({ pkg, refs }, bundle);
  })
  .then(repository => {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }

    if (argv.flags.graphql) {
      write('schema.gql', () => repository.graphql);
    }

    if (argv.flags.protobuf) {
      write('schema.proto', () => repository.protobuf);
    }
  })
  .catch(e => {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  });
