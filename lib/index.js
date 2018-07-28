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
  givenTypes.refs[schema.id] = { $ref: schema.id };

  if (schema.definitions) {
    Object.keys(schema.definitions).forEach(def => {
      givenTypes.refs[def] = { $ref: `${schema.id}#/definitions/${def}` };
    });
  }

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
        const schemaId = value.items.type || value.items.id;
        const asType = value.items.as || value.items.id;

        if (asType) {
          givenTypes.deps[value.items.id] = givenTypes.deps[value.items.id] || [];
          givenTypes.deps[value.items.id].push(asType);
        }

        delete value.items.as;

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
  if (!(refs && Array.isArray(refs))) {
    throw new Error(`Invalid references, given ${inspect(refs)}`);
  }

  const map = refs.reduce((prev, cur) => {
    prev[cur.id] = cur;

    return prev;
  }, {});

  const fixedRefs = {
    order: 1,
    canRead: true,
    read: (file, callback) => {
      const rel = (cwd && path.relative(cwd, file.url)) || path.basename(file.url);

      if (!map[rel]) {
        callback(new Error(`Missing '${rel}' definition (${file.url})`));
      } else {
        callback(null, map[rel]);
      }
    },
  };

  const fixedOpts = {
    resolve: { fixedRefs },
    dereference: {
      circular: 'ignore',
    },
  };

  if (!cwd) {
    return new $RefParser().dereference(schema, {
      ...fixedOpts,
      resolve: {
        fixedRefs,
        file: false,
      },
    });
  }

  return new $RefParser().dereference(`${cwd.replace(/\/+$/, '')}/`, schema, fixedOpts);
}

async function load(refs, schema, definitions) {
  walk(schema, definitions);

  refs.forEach(ref => {
    if (!ref.definitions && (ref.properties || (!ref.type && ref.id))) {
      walk(ref, definitions);
    }
  });
}

async function parse(cwd, refs, schema, definitions) {
  const fixedRefs = await Promise.all(refs.map(x => resolve(cwd, refs, x)));
  const fixedSchema = await resolve(cwd, refs, schema);

  await load(fixedRefs, fixedSchema, definitions);
}

function generate(info, input, generator, definitions) {
  if (!info.calls) {
    throw new Error(`Missing calls, given ${inspect(info)}`);
  }

  info.defns = Object.assign(info.defns || {}, definitions);

  let output = `${generator.blueprint(info)}\n`;

  const { models, enums } = input;

  const inputs = info.calls
    .filter(x => x.input)
    .map(x => x.input);

  models.forEach(modelInfo => {
    if (input.deps[modelInfo.name]) {
      const defns = input.deps[modelInfo.name];

      defns.splice(0, defns.length).forEach(prop => {
        modelInfo.props.push({
          field: prop,
          schema: prop,
          format: undefined,
          required: true,
        });
      });
    }

    modelInfo.target = inputs.includes(modelInfo.name) ? 'input' : 'type';

    output += `${generator.definition(info, modelInfo)}\n`;
  });

  enums.forEach(enumInfo => {
    output += `${generator.enumeration(info, enumInfo)}\n`;
  });

  return output;
}

module.exports = {
  walk,
  load,
  parse,
  resolve,
  generate,
  graphqlDefs,
  protobufDefs,
};
