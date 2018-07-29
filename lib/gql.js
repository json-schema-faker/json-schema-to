'use strict';

const utils = require('./utils');

const graphqlTypes = {
  string: 'String',
  boolean: 'Boolean',
  number: 'Float',
  integer: 'Int',
};

function graphqlInput(value) {
  const prefix = value.get || value.set;

  return value.input
    ? `${prefix}(input: ${value.input}${value.required ? '!' : ' = {}'})`
    : prefix;
}

function graphqlOutput(value, defns) {
  if (defns[value.resp]) {
    const schema = defns[value.resp];
    const target = graphqlTypes[schema] || schema;

    return `[${target}]`;
  }

  return value.resp;
}

function graphqlType(info, value) {
  const suffix = value.required ? '!' : '';
  const target = graphqlTypes[value.schema] || value.schema;

  if (value.type === 'list') {
    return `${value.field}: [${target}]${suffix}`;
  }

  return `${value.field}: ${target}${suffix}`;
}

module.exports = {
  blueprint(pkgInfo) {
    const calls = pkgInfo.calls;
    const defns = pkgInfo.defns;

    const Query = calls.filter(call => call.get);
    const Mutation = calls.filter(call => call.set);

    const definitions = { Query, Mutation };

    return Object.keys(definitions).reduce((prev, cur) => {
      if (definitions[cur] && definitions[cur].length) {
        prev.push(utils.trim(`
          extend type ${cur} {
          ${definitions[cur].map(call => `  ${graphqlInput(call)}: ${graphqlOutput(call, defns)}`).join('\n')}
          }
        `));
      }

      return prev;
    }, []).join('\n');
  },
  definition(pkgInfo, modelInfo) {
    return utils.trim(`
      ${modelInfo.target} ${modelInfo.name} {${modelInfo.props ? (modelInfo.props.length ? '\n' : '')
      + modelInfo.props.map(prop => `  ${graphqlType(pkgInfo, prop)}\n`).join('') : ''}}
    `);
  },
  enumeration(pkgInfo, modelInfo) {
    return utils.trim(`
      enum ${modelInfo.schema || `ENUM_${modelInfo.offset}`} {${modelInfo.values ? (modelInfo.values.length ? '\n' : '')
        + modelInfo.values.map(value => `  ${value}\n`).join('') : ''}}
    `);
  },
};
