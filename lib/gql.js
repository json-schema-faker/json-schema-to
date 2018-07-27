const { trim } = require('./utils');

const graphqlTypes = {
  string: 'String',
  boolean: 'Boolean',
  number: 'Float',
  integer: 'Int',
};

function graphqlInput(value) {
  const {
    get, set, input, required,
  } = value;

  const prefix = get || set;

  return input
    ? `${prefix}(input: ${input}${required ? '!' : ' = {}'})`
    : prefix;
}

function graphqlType(info, value) {
  const {
    type, field, schema, required,
  } = value;

  const suffix = required ? '!' : '';
  const target = graphqlTypes[schema] || schema;

  if (type === 'list') {
    return `${field}: [${target}]${suffix}`;
  }

  return `${field}: ${target}${suffix}`;
}

module.exports = {
  blueprint({ calls }) {
    const Query = calls.filter(call => call.get);
    const Mutation = calls.filter(call => call.set);

    const definitions = { Query, Mutation };

    return Object.keys(definitions).map(type => trim(`
      extend type ${type} {${definitions[type] ? (definitions[type].length ? '\n' : '')
        + definitions[type].map(call => `  ${graphqlInput(call)}: ${call.resp}\n`).join('') : ''}}
    `)).join('\n');
  },
  definition(pkgInfo, { name, props, target }) {
    return trim(`
      ${target} ${name} {${props ? (props.length ? '\n' : '')
      + props.map(prop => `  ${graphqlType(pkgInfo, prop)}\n`).join('') : ''}}
    `);
  },
  enumeration(pkgInfo, { schema, values, offset }) {
    return trim(`
      enum ${schema || `ENUM_${offset}`} {${values ? (values.length ? '\n' : '')
        + values.map(value => `  ${value}\n`).join('') : ''}}
    `);
  },
};
