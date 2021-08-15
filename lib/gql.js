'use strict';

const utils = require('./utils');

const graphqlTypes = {
  string: 'String',
  boolean: 'Boolean',
  number: 'Float',
  integer: 'Int',
};

const defaultValues = {
  string: '""',
  boolean: 'false',
  number: '0.0',
  integer: '0',
};

function graphqlInput(call, defns, inputs) {
  const prefix = call.get || call.set;

  if (typeof call.input === 'object') {
    const keys = Object.keys(call.input);

    if (!keys.length) return prefix;

    return `${prefix}(${keys.map(key => {
      const field = call.input[key];
      const target = defns[field] || {};
      const item = graphqlTypes[target.schema] || field;
      const def = defaultValues[target.schema] || '{}';

      if (!inputs.includes(field)) {
        inputs.push(field);
      }

      return `${key}: ${item}${utils.isReq(field, call.required) ? '!' : ` = ${def}`}`;
    }).join(', ')})`;
  }

  const input = call.input || call.params;
  const def = defaultValues[input] || '{}';

  if (input && !inputs.includes(input)) {
    inputs.push(input);
  }

  return input
    ? `${prefix}(input: ${input}${utils.isReq(input, call.required) ? '!' : ` = ${def}`})`
    : prefix;
}

function graphqlOutput(call, defns) {
  const get = call.get;
  const set = call.set;
  const resp = call.resp;
  const source = resp || set || get;

  if (defns[source]) {
    const schema = defns[source] || {};
    const target = graphqlTypes[schema.schema] || schema.schema;

    return (schema.repeat || call.repeat)
      ? `[${target}]`
      : target;
  }
  return source;
}

function graphqlParams(call, defns, inputs) {
  return `\n  ${graphqlInput(call, defns, inputs)}: ${graphqlOutput(call, defns)}`;
}

function graphqlType(model, defns) {
  const target = graphqlTypes[model.schema] || model.schema || model.value;
  const suffix = utils.isReq(target, model.required) ? '!' : '';
  const source = defns[target] || {};

  let type = graphqlTypes[source.schema] || source.schema || target;
  if (model.value in defns && defns[model.value].kind === 'enum') type = model.value;

  if (model.repeat) {
    return `${model.field}: [${type}]${suffix}`;
  }

  return `${model.field}: ${type}${suffix}`;
}

function typedef(name, model, defns, inputs) {
  const isInput = inputs.includes(name);
  const kind = isInput ? 'input' : 'type';

  return `\n${kind} ${name} {${model.schema.map(prop => `\n  ${graphqlType(prop, defns)}`).join('')}\n}`;
}

function list(name, options) {
  return `\nenum ${name} {${options.map(x => `\n  ${x}`).join('')}\n}`;
}

module.exports = (repo, factory) => {
  const buffer = [];
  const defns = [];
  const types = {};

  function push(ref, schema) {
    const model = factory(schema);

    if (model) {
      if (model.kind === 'type') {
        if (!Array.isArray(model.schema)) {
          types[ref] = model;
        } else {
          model.schema.forEach(prop => {
            if (prop.options) {
              const name = utils.caps([ref, prop.field].join('-'));

              buffer.push(list(name, prop.options));
              prop.schema = name;
            }

            if (['array', 'object'].includes(prop.schema)) {
              prop.schema = utils.caps([ref, prop.field].join('-'));
              push(prop.schema, schema.properties[prop.field]);
            }
          });

          defns.push([ref, model]);
        }
      } else if (model.kind === 'enum') {
        buffer.push(list(ref, model.options));
        types[ref] = model;
      } else {
        types[ref] = model;
      }
    }
  }

  Object.keys(repo.models).forEach(ref => {
    push(ref, repo.models[ref]);
  });

  const Query = repo.calls.filter(call => call.get);
  const Mutation = repo.calls.filter(call => call.set);

  const inputs = [];
  const groups = { Query, Mutation };
  const params = repo.calls.map(call => call.params);

  Object.keys(groups).forEach(def => {
    if (groups[def] && groups[def].length) {
      buffer.unshift(`\nextend type ${def} {${groups[def].map(call => graphqlParams(call, types, inputs)).join('')}\n}`);
    }
  });

  const fixedParams = params.filter(ref => ref && !inputs.includes(ref));

  defns.forEach(([ref, model]) => {
    if (!fixedParams.includes(ref)) {
      buffer.push(typedef(ref, model, types, inputs));
    }
  });

  return buffer.join('');
};
