'use strict';

const utils = require('./utils');

const protobufTypes = {
  string: 'string',
  boolean: 'bool',
  number: 'double',
  integer: 'int32',
};

function protobufType(info, value, offset) {
  if (value.format === 'date-time' || value.format === 'datetime') {
    return 'int64';
  }

  const suffix = `${value.field} = ${offset + 1};`;

  const options = [
    value.required && !value.repeated ? 'required ' : '',
    value.repeated ? 'repeated ' : '',
  ].filter(Boolean).join('');

  if (!protobufTypes[value.schema]) {
    return `${options}${value.schema} ${suffix}`;
  }

  return `${options}${protobufTypes[value.schema]} ${suffix}`;
}

function protobufOutput(value) {
  return `returns(${value.resp}) {}`;
}

function protobufDefinition(value, defns) {
  return `\nmessage ${value} {\n  repeated ${defns[value]} data = 1;\n}`;
}

const protobufDefs = {
  blueprint(pkgInfo) {
    const empty = pkgInfo.empty || 'Empty';

    const suffix = Object.keys(pkgInfo.defns)
      .map(def => protobufDefinition(def, pkgInfo.defns));

    suffix.unshift(`\nmessage ${empty} {}`);

    const defns = pkgInfo.defns;
    const calls = pkgInfo.calls;
    const refs = pkgInfo.refs;

    return utils.trim(`
      syntax = "proto3";
      package ${utils.caps(pkgInfo.pkg, true)};
      ${refs ? refs.map(ref => `import "${ref}.proto";\n`).join('') : ''}service ${utils.caps(pkgInfo.pkg)} {
      ${calls.map(call => `  rpc ${call.get || call.set}(${call.input || empty}) ${protobufOutput(call, defns)}\n`).join('')}}${suffix.join('')}
    `);
  },
  definition(pkgInfo, modelInfo) {
    return utils.trim(`
      message ${modelInfo.name} {${modelInfo.props ? (modelInfo.props.length ? '\n' : '')
      + modelInfo.props.map((prop, i) => `  ${protobufType(pkgInfo, prop, i)}\n`).join('') : ''}}
    `);
  },
  enumeration(pkgInfo, modelInfo) {
    return utils.trim(`
      enum ${modelInfo.schema || `ENUM_${modelInfo.offset}`} {${modelInfo.values ? (modelInfo.values.length ? '\n' : '')
        + modelInfo.values.map((value, i) => `  ${value} = ${i};\n`).join('') : ''}}
    `);
  },
};

module.exports = protobufDefs;
