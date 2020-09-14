'use strict';

const $RefParser = require('json-schema-ref-parser');
const path = require('path');

const _util = require('util');

const gqlQueries = require('./gql-queries');
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
  givenTypes.deps = givenTypes.deps || [];

  if (schema.definitions) {
    Object.keys(schema.definitions).forEach(def => {
      givenTypes.refs[def] = { $ref: `${schema.id}#/definitions/${def}` };
    });
  }

  if (schema.properties) {
    const required = schema.required || [];

    Object.keys(schema.properties).forEach(prop => {
      const value = schema.properties[prop];

      if (value.$ref) return;

      if (value.enum) {
        const key = givenTypes.enums.length + 1;
        const enumId = value.id ? value.id : `${schema.id}_${prop}_${key}`;

        givenTypes.enums.push({
          schema: enumId,
          source: schema.id,
          values: value.enum,
        });

        givenTypes.models[schema.id].push({
          field: prop,
          schema: enumId,
          format: value.format,
          required: required.indexOf(prop) !== -1,
        });
        return;
      }

      if (value.items) {
        let asType = value.items.as || value.items.id;

        if (!asType) {
          const assoc = value.items.hasMany || value.items.belongsToMany;

          asType = (assoc && (assoc.through.model || assoc.through)) || value.items.$ref;
        }

        const schemaId = (value.items.type === 'object' || value.items.type === 'array')
          ? value.items.$ref || value.items.id
          : value.items.type || asType;

        if (!schemaId) {
          throw new Error(`Unknown identity, given ${_util.inspect(value.items)}`);
        }

        if (asType !== '#' && givenTypes.deps.indexOf(asType) === -1) {
          givenTypes.deps.push(asType);
          walk(value.items, givenTypes);
        }

        delete value.items.as;

        givenTypes.models[schema.id].push({
          field: prop,
          schema: schemaId !== '#' ? schemaId : schema.id,
          format: value.format,
          required: required.indexOf(prop) !== -1,
          repeated: true,
        });
        return;
      }

      if (value.id) {
        givenTypes.models[schema.id].push({
          field: prop,
          schema: value.id,
          format: value.format,
          required: required.indexOf(prop) !== -1,
        });
        return;
      }

      if (!value.type || ['array', 'object'].indexOf(value.type) !== -1) {
        throw new Error(`Unexpected ${value.type} at ${schema.id}.${prop}`);
      }

      givenTypes.models[schema.id].push({
        field: prop,
        schema: value.type,
        format: value.format,
        required: required.indexOf(prop) !== -1,
      });
    });
  }
}

function resolve(cwd, refs, schema) {
  if (!(refs && Array.isArray(refs))) {
    throw new Error(`Invalid references, given ${_util.inspect(refs)}`);
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
    return new $RefParser().dereference(schema, Object.assign({}, fixedOpts, {
      resolve: {
        fixedRefs,
        file: false,
      },
    }));
  }

  return new $RefParser().dereference(`${cwd.replace(/\/+$/, '')}/`, schema, fixedOpts);
}

function load(refs, schema, definitions) {
  try {
    walk(schema, definitions);

    refs.forEach(ref => {
      if (!ref.definitions && (ref.properties || (!ref.type && ref.id))) {
        walk(ref, definitions);
      }
    });
  } catch (e) {
    throw new Error(`${e.message} while resolving ${schema.id}`);
  }
}

function parse(cwd, refs, schema, definitions) {
  return Promise.all(refs.map(x => resolve(cwd, refs, x)))
    .then(fixedRefs => resolve(cwd, refs, schema).then(fixedSchema => load(fixedRefs, fixedSchema, definitions)));
}

function generate(info, input, generator, definitions) {
  if (!(Array.isArray(info.calls) && typeof info.pkg === 'string')) {
    throw new Error(`Missing info, given ${_util.inspect(info)}`);
  }

  info.defns = Object.assign(info.defns || {}, definitions);

  const blueprint = generator.blueprint(info);

  let output = blueprint
    ? `${blueprint}\n`
    : '';

  input.models = input.models || [];
  input.enums = input.enums || [];
  input.deps = input.deps || [];

  const keys = input.models.map(x => x.name)
    .concat(Object.keys(info.defns));

  const inputs = [];
  const params = [];

  info.calls.forEach(callInfo => {
    if (callInfo.input && !(callInfo.set || callInfo.get)) {
      throw new Error(`Unexpected input for '${callInfo.set}' call`);
    }

    if (callInfo.input) {
      if (typeof callInfo.input === 'object') {
        inputs.push(...Object.values(callInfo.input));
      } else {
        inputs.push(callInfo.input);
      }
    }

    if (callInfo.params) {
      params.push(callInfo.params);
    }

    ['resp', 'input', 'params'].forEach(param => {
      if (callInfo[param]) {
        if (typeof callInfo[param] === 'string' && keys.indexOf(callInfo[param]) === -1) {
          throw new Error(`Unknown '${callInfo[param]}' model`);
        }

        if (typeof callInfo[param] === 'object') {
          Object.keys(callInfo[param]).forEach(key => {
            if (keys.indexOf(callInfo[param][key]) === -1) {
              throw new Error(`Unknown '${callInfo[param][key]}' model`);
            }
          });
        }
      }
    });
  });

  input.models.forEach(modelInfo => {
    if (inputs.indexOf(modelInfo.name) !== -1) {
      modelInfo.props
        .filter(sub => keys.indexOf(sub.schema) !== -1)
        .forEach(sub => {
          if (inputs.indexOf(sub.schema) === -1) {
            inputs.push(sub.schema);
          }
        });
    }
  });

  input.models.forEach(modelInfo => {
    modelInfo.target = inputs.indexOf(modelInfo.name) !== -1 ? 'input' : 'type';
    modelInfo.params = params.indexOf(modelInfo.name) !== -1;

    if (modelInfo.target === 'input') {
      modelInfo.props.map(field => field.schema).forEach(prop => {
        if (inputs.indexOf(prop) === -1 && keys.indexOf(prop) !== -1) {
          for (let i = 0; i < input.models.length; i += 1) {
            if (input.models[i].name === prop) {
              input.models[i].target = 'input';
              inputs.push(prop);
              break;
            }
          }
        }
      });
    }

    const definition = generator.definition(info, modelInfo);

    if (definition) {
      output += `${definition}\n`;
    }
  });

  input.enums.forEach(enumInfo => {
    const enumeration = generator.enumeration(info, enumInfo);

    if (enumeration) {
      output += `${enumeration}\n`;
    }
  });

  return output;
}

function conciliate(pkgInfo, definitions) {
  const allowed = [];
  const seen = [];

  function push(schema) {
    if (schema && definitions.models[schema]) {
      if (seen.indexOf(schema) !== -1) return;

      allowed.push(schema);
      seen.push(schema);

      definitions.models[schema].map(x => x.schema)
        .filter(x => definitions.models[x])
        .forEach(x => {
          push(x);
        });
    }
  }

  pkgInfo.calls.forEach(x => {
    const target = pkgInfo.defns[x.resp];

    if (target) {
      push(target.schema);
    }

    push(x.resp);
    push(x.params);

    if (typeof x.input === 'object') {
      Object.values(x.input).forEach(push);
    } else {
      push(x.input);
    }
  });

  definitions.enums = definitions.enums
    .filter(x => allowed.indexOf(x.source) !== -1);

  Object.keys(definitions.models).forEach(name => {
    if (allowed.indexOf(name) === -1) {
      delete definitions.models[name];
      delete definitions.refs[name];
    }
  });
}

module.exports = {
  walk,
  load,
  parse,
  resolve,
  generate,
  conciliate,
  gqlQueries,
  graphqlDefs,
  protobufDefs,
};
