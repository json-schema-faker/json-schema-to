'use strict';

const util = require('util');
const path = require('path');
const glob = require('glob');
const fs = require('fs-extra');
const Ajv = require('ajv/dist/2020');

const parse = require('./parse');
const { normalize } = require('./utils');
const enumSets = require('./enums');
const gqlQueries = require('./gql-queries');
const graphqlDefs = require('./gql');
const protobufDefs = require('./proto');
const typescriptDefs = require('./typescript');

const ajv = new Ajv();
const dsl = require('./dsl.json');
const validateDefinition = ajv.compile(dsl.$defs.Definition);
const validateService = ajv.compile(dsl.$defs.Service);
const validateModel = ajv.compile(dsl.$defs.Model);

function relative(file) {
  return path.relative(process.cwd(), file);
}

function read(file) {
  return fs.readFileSync(file, 'utf8').toString();
}

function load(fromDir, opts) {
  function check(schema, file) {
    if (!schema.$id) {
      throw new Error(`Missing schema identifier for ./${relative(file)}`);
    }

    let validator = schema.service && validateService;
    let kind = 'service';

    if (schema.$defs && !schema.properties && !validator) {
      validator = validateDefinition;
      kind = 'definition';
    }

    if (!validator) {
      validator = validateModel;
      kind = 'model';
    }

    if (!validator(schema)) {
      process.stderr.write(`Invalid ${kind} ${relative(file)}:\n`);
      process.stderr.write(`${util.inspect(schema, { depth: 10, colors: true })}\n`);

      validator.errors.forEach(err => {
        const key = err.instancePath ? err.instancePath.replace(/^\//, '') : '';

        process.stderr.write(`- ${err.message}${key ? ` (${key})` : ''}\n`);
      });

      if (opts.exit !== false) {
        process.exit(1);
      }
    }
    return schema;
  }

  return glob.sync('**/*.{yml,yaml,json}', { cwd: fromDir })
    .filter(schema => !opts.ignore || !schema.includes(opts.ignore))
    .map(schema => path.join(fromDir, schema))
    .reduce((memo, file) => {
      const schema = file.indexOf('.json') === -1
        ? parse(process.cwd(), file, read(file))
        : JSON.parse(read(file));

      if (Array.isArray(schema)) {
        memo.push(...schema.map(x => check(normalize(x), file)));
      } else {
        memo.push(check(normalize(schema), file));
      }
      return memo;
    }, []);
}

module.exports = options => cwd => load(cwd, options);
module.exports.enumSets = enumSets;
module.exports.gqlQueries = gqlQueries;
module.exports.graphqlDefs = graphqlDefs;
module.exports.protobufDefs = protobufDefs;
module.exports.typescriptDefs = typescriptDefs;
