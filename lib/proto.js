'use strict';

const utils = require('./utils');

const protobufTypes = {
  string: 'string',
  boolean: 'bool',
  number: 'double',
  integer: 'int32',
};

function protobufType(info, value, offset) {
  const suffix = `${value.field} = ${offset + 1};`;

  const options = [
    value.required && !value.repeated ? 'required ' : '',
    value.repeated ? 'repeated ' : '',
  ].filter(Boolean).join('');

  const type = value.schema;

  let fallback;

  if (value.format === 'date-time' || value.format === 'datetime') {
    fallback = 'int64';
  }

  if (!protobufTypes[type] || fallback) {
    return `${options}${fallback || `_${type}`} ${suffix}`;
  }

  return `${options}${protobufTypes[type]} ${suffix}`;
}

function protobufOutput(value, defns, output) {
  const source = defns[value.resp];

  if (source && source.schema !== value.resp) {
    output.push({
      target: source.schema,
      schema: `_${value.resp}`,
      repeated: source.repeated || value.repeated,
    });
  }

  return `returns(_${value.resp});`;
}

function protobufDefinition(value) {
  const prefix = value.repeated
    ? 'repeated'
    : 'required';

  return `\nmessage ${value.schema} {\n  ${prefix} _${value.target} data = 1;\n}`;
}

function protobufCallDefinition(call, noop, defns, output) {
  if (call.resp || call.params || call.target === 'input') {
    const suffix = protobufOutput(call, defns, output);

    let target = call.params || call.input;

    if (target) {
      target = `_${target}`;
    }

    return `  rpc ${call.get || call.set}(${target || noop}) ${suffix}\n`;
  }
}

const protobufDefs = {
  blueprint(pkgInfo) {
    const noop = pkgInfo.noop || 'Noop';
    const output = [];

    const defns = pkgInfo.defns;
    const calls = pkgInfo.calls;
    const refs = pkgInfo.refs;
    const id = pkgInfo.id;

    const body = calls.map(call => protobufCallDefinition(call, noop, defns, output, id)).join('');

    const service = body ? `service ${utils.caps(pkgInfo.id || pkgInfo.pkg)} {
      ${body}}`
      : '';

    const suffix = output
      .map(protobufDefinition)
      .join('');

    return utils.trim(`
      syntax = "proto3";
      package ${utils.safe(pkgInfo.pkg)};
      ${refs ? refs.map(ref => `import "./${ref}.proto";\n`).join('') : ''}${service}${suffix}
    `);
  },
  definition(pkgInfo, modelInfo) {
    const output = [];

    output.push(utils.trim(`
      message _${modelInfo.name} {${modelInfo.props ? (modelInfo.props.length ? '\n' : '')
      + modelInfo.props.map((prop, i) => `  ${protobufType(pkgInfo, prop, i)}\n`).join('') : ''}}
    `));

    return output.join('');
  },
  enumeration(pkgInfo, modelInfo) {
    return utils.trim(`
      enum _${modelInfo.schema} {${modelInfo.values ? (modelInfo.values.length ? '\n' : '')
        + modelInfo.values.map((value, i) => `  ${value} = ${i};\n`).join('') : ''}}
    `);
  },
};

module.exports = protobufDefs;
