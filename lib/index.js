const $RefParser = require('json-schema-ref-parser');
const path = require('path');

const protobufDefs = require('./proto');

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
        const fixedId = ['object', 'array'].includes(value.items.type)
          ? value.items.id
          : value.items.type;

        types[schema.id].push({
          type: 'list',
          field: prop,
          schema: fixedId,
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
        field: prop,
        schema: value.type,
        format: value.format,
        required: required.includes(prop),
      });
    });
  }

  return Object.keys(types)
    .map(typeName => ({
      name: typeName,
      props: types[typeName],
    }));
}

function resolve(cwd, refs, schema) {
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

  return new $RefParser().dereference(`${cwd}/`, schema, fixedOpts);
}

async function parse(cwd, refs, schema) {
  const fixedRefs = await Promise.all(refs.map(x => resolve(cwd, refs, x)));
  const fixedSchema = await resolve(cwd, fixedRefs, schema);

  const results = fixedRefs.reduce((prev, cur) => {
    if (cur.id && !(cur.definitions || cur.type)) {
      prev.push(...walk(cur));
    }

    return prev;
  }, walk(fixedSchema));

  return results;
}

function generate(info, models, generator) {
  let output = `${generator.blueprint(info)}\n`;

  models.forEach(modelInfo => {
    output += `${generator.definition(info, modelInfo)}\n`;
  });

  return output;
}

module.exports = {
  parse,
  resolve,
  generate,
  protobufDefs,
};
