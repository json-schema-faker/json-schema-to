'use strict';

const utils = require('./utils');

const protobufTypes = {
  string: 'string',
  boolean: 'bool',
  number: 'double',
  integer: 'int32',
};

function protobufType(info, value, offset) {
  let type = value.schema;

  if (value.format === 'date-time' || value.format === 'datetime') {
    type = 'int64';
  }

  const suffix = `${value.field} = ${offset + 1};`;

  const options = [
    value.required && !value.repeated ? 'required ' : '',
    value.repeated ? 'repeated ' : '',
  ].filter(Boolean).join('');

  if (!protobufTypes[type]) {
    return `${options}${type} ${suffix}`;
  }

  return `${options}${protobufTypes[type]} ${suffix}`;
}

function protobufOutput(value, defns, output) {
  const target = defns[value.resp];

  if (target && target !== value.resp) {
    output.push({
      target,
      schema: value.resp,
      repeated: value.repeated,
    });
  }

  return `returns(${value.resp});`;
}

function protobufInput(value, params) {
  // FIXME: consider extending another definition here...
  return `\nmessage ${value.input}${params ? '_' : ''} { ${value.input} params = 1; }`;
}

function protobufDefinition(value) {
  const prefix = value.repeated
    ? 'repeated '
    : '';

  return `\nmessage ${value.schema} {\n  ${prefix}${value.target} data = 1;\n}`;
}

function protobufCallDefinition(call, noop, defns, params, output) {
  let target = call.input || call.params;

  target = (target && `${target}${params ? '_' : ''}`) || noop;

  return `  rpc ${call.get || call.set}(${target}) ${protobufOutput(call, defns, output)}\n`;
}

const protobufDefs = {
  blueprint(pkgInfo) {
    const noop = pkgInfo.noop || 'Noop';
    const output = [];

    const params = pkgInfo.params;
    const defns = pkgInfo.defns;
    const calls = pkgInfo.calls;
    const refs = pkgInfo.refs;

    const service = calls.length ? `service ${utils.caps(pkgInfo.id || pkgInfo.pkg, true)} {
      ${calls.map(call => protobufCallDefinition(call, noop, defns, params, output)).join('')}}`
      : '';

    const seen = [];
    const extra = params && calls.map(call => {
      if (call.input && seen.indexOf(call.input) === -1) {
        seen.push(call.input);

        return protobufInput(call, params);
      }

      return '';
    });

    const suffix = output
      .map(protobufDefinition)
      .concat(extra || [])
      .join('');

    return utils.trim(`
      syntax = "proto3";
      package ${utils.safe(pkgInfo.pkg)};
      ${refs ? refs.map(ref => `import "${ref}.proto";\n`).join('') : ''}${service}${suffix}
    `);
  },
  definition(pkgInfo, modelInfo) {
    const output = [];

    output.push(utils.trim(`
      message ${modelInfo.name} {${modelInfo.props ? (modelInfo.props.length ? '\n' : '')
      + modelInfo.props.map((prop, i) => `  ${protobufType(pkgInfo, prop, i)}\n`).join('') : ''}}
    `));

    return output.join('');
  },
  enumeration(pkgInfo, modelInfo) {
    return utils.trim(`
      enum ${modelInfo.schema} {${modelInfo.values ? (modelInfo.values.length ? '\n' : '')
        + modelInfo.values.map((value, i) => `  ${value} = ${i};\n`).join('') : ''}}
    `);
  },
};

module.exports = protobufDefs;
