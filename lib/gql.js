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
    ? `${prefix}(input: ${value.input || value.params}${value.required ? '!' : ' = {}'})`
    : prefix;
}

function graphqlOutput(value, defns) {
  const get = defns[value.get];
  const set = defns[value.set];
  const resp = defns[value.resp];

  if (get || set || resp) {
    const source = get || set || resp;
    const target = graphqlTypes[source.schema] || source.schema;

    return (source.repeated || value.repeated)
      ? `[${target}]`
      : target;
  }

  return value.resp;
}

function graphqlType(info, value) {
  const suffix = value.required ? '!' : '';
  const target = graphqlTypes[value.schema] || value.schema;

  if (value.repeated) {
    return `${value.field}: [${target}]${suffix}`;
  }

  return `${value.field}: ${target}${suffix}`;
}

function graphqlParams(call, defns) {
  return `  ${graphqlInput(call)}: ${graphqlOutput(call, defns)}`;
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
          ${definitions[cur].map(call => graphqlParams(call, defns)).filter(Boolean).join('\n')}
          }
        `));
      }

      return prev;
    }, []).join('\n');
  },
  definition(pkgInfo, modelInfo) {
    if (!(modelInfo.props && modelInfo.props.length) || modelInfo.params) {
      return;
    }

    return utils.trim(`
      ${modelInfo.target} ${modelInfo.name} {
      ${modelInfo.props.map(prop => `  ${graphqlType(pkgInfo, prop)}`).join('\n')}
      }
    `);
  },
  enumeration(pkgInfo, modelInfo) {
    return utils.trim(`
      enum ${modelInfo.schema} {${modelInfo.values ? (modelInfo.values.length ? '\n' : '')
        + modelInfo.values.map(value => `  ${value}\n`).join('') : ''}}
    `);
  },
};
