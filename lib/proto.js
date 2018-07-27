const { trim, caps } = require('./utils');

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
    value.required && value.type !== 'list' ? 'required ' : '',
    value.type === 'list' ? 'repeated ' : '',
  ].filter(Boolean).join('');

  if (!protobufTypes[value.schema]) {
    return `${options}${value.schema} ${suffix}`;
  }

  return `${options}${protobufTypes[value.schema]} ${suffix}`;
}

const protobufDefs = {
  blueprint(pkgInfo) {
    return trim(`
      syntax = "proto3";
      package ${caps(pkgInfo.name, true)};
      ${pkgInfo.refs ? pkgInfo.refs.map(ref => `import "${ref}.proto";\n`).join('') : ''}service ${caps(pkgInfo.name)} {
      ${pkgInfo.calls ? pkgInfo.calls.map(call => `  rpc ${call.req}(${call.input || 'Empty'}) returns (${call.resp}) {}\n`).join('') : ''}}
    `);
  },
  definition(pkgInfo, modelInfo) {
    return trim(`
      message ${modelInfo.name} {${modelInfo.props ? (modelInfo.props.length ? '\n' : '')
      + modelInfo.props.map((prop, i) => `  ${protobufType(pkgInfo, prop, i)}\n`).join('') : ''}}
    `);
  },
};

module.exports = protobufDefs;
