const $RefParser = require('json-schema-ref-parser');
const path = require('path');

function caps(value) {
  return value
    .replace(/(?:\b|^)([a-z])/g, ($0, $1) => $1.toUpperCase())
    .replace(/\W/g, '');
}

function trim(code) {
  const matches = code.match(/\n( )*/);

  if (!matches) {
    return code;
  }

  const spaces = matches[0].substr(0, matches[0].length - 1);
  const depth = spaces.split('').length;

  return code.replace(new RegExp(`^ {${depth}}`, 'mg'), '').trim();
}

function walk(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(value => walk(value));
  }

  const types = {
    [schema.id]: [],
  };

  if (schema.properties) {
    const required = schema.required || [];

    Object.keys(schema.properties).forEach(prop => {
      const value = schema.properties[prop];

      if (value.items && value.items.id) {
        types[schema.id].push({
          type: 'list',
          field: prop,
          schema: value.items.id,
          format: value.format,
          required: required.includes(prop),
        });
        return;
      }

      if (value.id) {
        types[schema.id].push({
          type: 'ref',
          field: prop,
          schema: value.id,
          format: value.format,
          required: required.includes(prop),
        });
        return;
      }

      if (value.$ref) {
        throw new Error(`Unexpected reference, given '${value.$ref}'`);
      }

      types[schema.id].push({
        type: 'value',
        field: prop,
        schema: value.type,
        format: value.format,
        required: required.includes(prop),
      });
    });
  }

  if (schema.id && schema.type !== 'object') {
    types[schema.id].push({
      type: 'value',
      schema: schema.type,
      format: schema.format,
      required: typeof schema.required === 'boolean'
        ? schema.required
        : true,
    });
  }

  return Object.keys(types)
    .map(typeName => ({
      name: typeName,
      props: types[typeName],
    }));
}

async function resolve(cwd, refs, schema) {
  const fixedRefs = {
    order: 1,
    canRead: true,
    read: (file, callback) => {
      const rel = path.relative(cwd, file.url);
      const found = refs.find(x => x.id === rel);

      if (!found) {
        callback(new Error(`Missing '${rel}' definition (${file.url})`));
      } else {
        callback(null, found);
      }
    },
  };

  const fixedOpts = {
    resolve: { fixedRefs },
    dereference: {
      circular: 'ignore',
    },
  };

  return await new $RefParser().dereference(`${cwd}/`, schema, fixedOpts);
}

async function parse(cwd, refs, schema) {
  const fixedRefs = await Promise.all(refs.map(x => resolve(cwd, refs, x)));
  const fixedSchema = await resolve(cwd, fixedRefs, schema);

  const results = fixedRefs.reduce((prev, cur) => {
    if (cur.type) {
      prev.push(...walk(cur));
    }

    return prev;
  }, walk(fixedSchema))

  return results;
}

function generate(info, models, generator) {
  let output = `${generator.blueprint(info)}\n`;

  models.forEach(modelInfo => {
    output += `${generator.definition(info, modelInfo)}\n`;
  });

  return output;
}

function protobufType(info, value, offset) {
  if (value.format === 'date-time' || value.format === 'datetime') {
    return 'int64';
  }

  const types = {
    string: 'string',
    boolean: 'bool',
    number: 'float',
    integer: 'int32',
  };

  const suffix = `${value.field} = ${offset + 1};`;

  const options = [
    value.required ? '' : 'optional ',
    value.type === 'list' ? 'repeated ' : '',
  ].filter(Boolean).join('');

  if (!types[value.schema]) {
    return `${options}${value.schema} ${suffix}`;
  }

  return `${options}${types[value.schema]} ${suffix}`;
}

const protobufDefs = {
  blueprint(pkgInfo) {
    return trim(`
      syntax = "proto3";
      package ${pkgInfo.name};
      ${pkgInfo.refs
        ? pkgInfo.refs.map(ref => `import "${ref}.proto";\n`).join('')
        : ''
      }service ${caps(pkgInfo.name)} {
      ${pkgInfo.calls
        ? pkgInfo.calls.map(call =>
          `  rpc ${call.req}(${call.input || 'Empty'}) returns (${call.resp}) {}\n`).join('')
        : ''
      }}
    `);
  },
  definition(pkgInfo, modelInfo) {
    return trim(`
      message ${modelInfo.name} {
      ${modelInfo.props
        ? modelInfo.props.map((prop, i) => `  ${protobufType(pkgInfo, prop, i)}\n`).join('')
        : ''
      }}
    `);
  },
};

module.exports = {
  parse,
  resolve,
  generate,
  protobufDefs,
};
