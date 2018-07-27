const $RefParser = require('json-schema-ref-parser');
const path = require('path');

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
          required: required.includes(prop),
        });
        return;
      }

      if (value.id) {
        types[schema.id].push({
          type: 'ref',
          field: prop,
          schema: value.id,
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
        required: required.includes(prop),
      });
    });
  }

  if (schema.id && schema.type !== 'object') {
    types[schema.id].push({
      type: 'value',
      schema: schema.type,
    });
  }

  return Object.keys(types)
    .map(name => ({
      model: name,
      props: types[name],
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

function generate(models) {
  // FIXME
}

module.exports = {
  parse,
  resolve,
  generate,
};
