const $RefParser = require('json-schema-ref-parser');
const path = require('path');

const { inspect } = require('util');

const graphqlDefs = require('./gql');
const protobufDefs = require('./proto');

function walk(schema, givenTypes) {
  if (!schema || typeof schema !== 'object') {
    return;
  }

  if (Array.isArray(schema)) {
    schema.forEach(value => {
      walk(value, givenTypes);
    });
    return;
  }

  if (givenTypes.models[schema.id]) {
    return;
  }

  givenTypes.models[schema.id] = [];

  if (schema.properties) {
    const required = schema.required || [];

    Object.keys(schema.properties).forEach(prop => {
      const value = schema.properties[prop];

      if (value.enum) {
        const key = givenTypes.enums.push({
          schema: value.id,
          values: value.enum,
          offset: givenTypes.enums.length + 1,
        });

        givenTypes.models[schema.id].push({
          field: prop,
          schema: value.id ? value.id : `ENUM_${key}`,
          format: value.format,
          required: required.includes(prop),
        });
        return;
      }

      if (value.items) {
        const {
          id, $ref, type, hasMany, belongsToMany,
        } = value.items;

        const assoc = belongsToMany || hasMany;

        const fixedId = (['object', 'array'].includes(type) && id)
          || type
          || $ref;

        const schemaId = ((assoc && assoc.through) || assoc || {}).model || fixedId;

        if (!givenTypes.deps[schemaId]) {
          givenTypes.deps[schemaId] = [];
        }

        givenTypes.deps[schemaId].push(fixedId);
        givenTypes.models[schema.id].push({
          type: 'list',
          field: prop,
          schema: schemaId,
          format: value.format,
          required: required.includes(prop),
        });
        return;
      }

      if (value.id) {
        givenTypes.models[schema.id].push({
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

      givenTypes.models[schema.id].push({
        field: prop,
        schema: value.type,
        format: value.format,
        required: required.includes(prop),
      });
    });
  }
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

async function parse(cwd, refs, schema, definitions) {
  const fixedRefs = await Promise.all(refs.map(x => resolve(cwd, refs, x)));
  const fixedSchema = await resolve(cwd, fixedRefs, schema);

  walk(fixedSchema, definitions);

  fixedRefs.forEach(ref => {
    if (!ref.definitions && (ref.properties || (!ref.type && ref.id))) {
      walk(ref, definitions);
    }
  });
}

function generate(info, input, generator) {
  if (!info.calls) {
    throw new Error(`Missing calls, given ${inspect(info)}`);
  }

  let output = `${generator.blueprint(info)}\n`;

  const { models, enums } = input;

  const inputs = info.calls
    .filter(x => x.input)
    .map(x => x.input);

  models.forEach(modelInfo => {
    if (input.deps[modelInfo.name]) {
      input.deps[modelInfo.name].forEach(prop => {
        modelInfo.props.push({
          field: prop,
          schema: prop,
          format: undefined,
          required: true,
        });
      });
    }

    output += `${generator.definition(info, {
      target: inputs.includes(modelInfo.name) ? 'input' : 'type',
      ...modelInfo,
    })}\n`;
  });

  enums.forEach(enumInfo => {
    output += `${generator.enumeration(info, enumInfo)}\n`;
  });

  return output;
}

module.exports = {
  parse,
  resolve,
  generate,
  graphqlDefs,
  protobufDefs,
};
