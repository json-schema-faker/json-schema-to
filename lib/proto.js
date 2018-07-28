const { inspect } = require('util');

const { trim, caps } = require('./utils');

const protobufTypes = {
  string: 'string',
  boolean: 'bool',
  number: 'double',
  integer: 'int32',
};

function protobufType(info, value, offset) {
  const {
    type, field, format, schema, required,
  } = value;

  if (format === 'date-time' || format === 'datetime') {
    return 'int64';
  }

  const suffix = `${field} = ${offset + 1};`;

  const options = [
    required && type !== 'list' ? 'required ' : '',
    type === 'list' ? 'repeated ' : '',
  ].filter(Boolean).join('');

  if (!protobufTypes[schema]) {
    return `${options}${schema} ${suffix}`;
  }

  return `${options}${protobufTypes[schema]} ${suffix}`;
}

function protobufOutput(value) {
  return `returns (${value.resp}) {}`;
}

function protobufDefinition(value, defns) {
  return `\nmessage ${value} {\n  repeated ${defns[value]} data = 1;\n}`;
}

const protobufDefs = {
  blueprint(pkgInfo) {
    const {
      pkg, refs, calls, defns,
    } = pkgInfo;

    if (!calls) {
      throw new Error(`Missing calls, given ${inspect(calls)}`);
    }

    const suffix = Object.keys(defns)
      .map(def => protobufDefinition(def, defns))
      .join('');

    return trim(`
      syntax = "proto3";
      package ${caps(pkg, true)};
      ${refs ? refs.map(ref => `import "${ref}.proto";\n`).join('') : ''}service ${caps(pkg)} {
      ${calls.map(call => `  rpc ${call.get || call.set}(${call.input || 'Empty'}) ${protobufOutput(call, defns)}\n`).join('')}}${suffix}
    `);
  },
  definition(pkgInfo, { name, props }) {
    return trim(`
      message ${name} {${props ? (props.length ? '\n' : '')
      + props.map((prop, i) => `  ${protobufType(pkgInfo, prop, i)}\n`).join('') : ''}}
    `);
  },
  enumeration(pkgInfo, { schema, values, offset }) {
    return trim(`
      enum ${schema || `ENUM_${offset}`} {${values ? (values.length ? '\n' : '')
        + values.map((value, i) => `  ${value} = ${i};\n`).join('') : ''}}
    `);
  },
};

module.exports = protobufDefs;
