'use strict';

const utils = require('./utils');

const protobufTypes = {
  string: 'string',
  boolean: 'bool',
  number: 'double',
  integer: 'int32',
};

function protobufType(schema, offset, defns) {
  const suffix = `${schema.field} = ${offset + 1};`;

  const options = [
    schema.required && !schema.repeat ? 'required ' : '',
    schema.repeat ? 'repeated ' : '',
  ].filter(Boolean).join('');

  const type = schema.schema || schema.value;

  let fallback;
  if (schema.format === 'date-time' || schema.format === 'datetime') {
    fallback = 'int64';
  }

  const source = defns[type] || {};
  const target = protobufTypes[source.schema] || source.schema;

  fallback = target || fallback;

  if (!protobufTypes[type] || fallback) {
    return `${options}${fallback || type} ${suffix}`;
  }

  return `${options}${protobufTypes[type]} ${suffix}`;
}

function protobufCall(call, noop, defns) {
  const target = defns[call.resp] || {};
  const value = protobufTypes[target.schema] || target.schema;
  const suffix = `returns(${value || call.resp});`;
  const name = call.get || call.set;

  if (typeof call.input === 'object') {
    return `\n  rpc ${name}(${utils.caps(`${name}-input`)}) ${suffix}`;
  }

  return `\n  rpc ${name}(${call.params || call.input || noop}) ${suffix}`;
}

function typedef(name, model, defns) {
  return `\nmessage ${name} {${model.schema.map((prop, i) => `\n  ${protobufType(prop, i, defns)}`).join('')}\n}`;
}

function list(name, options) {
  return `\nenum ${name} {${options.map((x, i) => `\n  ${x} = ${i};`).join('')}\n}`;
}

module.exports = (repo, factory) => {
  const noop = repo.pkg.noop || 'Noop';
  const suffix = repo.pkg.suffix || 'Service';
  const pkgName = utils.safe(repo.pkg.pkg || 'API');

  const external = (repo.pkg.refs || [])
    .map(x => `\nimport "${x}.proto";`).join('');

  const service = {};
  const buffer = [];
  const types = {};
  const defns = [];

  function push(ref, schema) {
    const model = factory(schema);

    if (model) {
      if (model.kind === 'type') {
        if (!Array.isArray(model.schema)) {
          types[ref] = model;
        } else {
          model.schema.forEach(sub => {
            if (sub.options) {
              const name = utils.caps([ref, sub.field].join('-'));

              buffer.push(list(name, sub.options));
              sub.schema = name;
            }

            if (['array', 'object'].includes(sub.schema)) {
              sub.schema = utils.caps([ref, sub.field].join('-'));
              push(sub.schema, schema.properties[sub.field]);
            }
          });

          defns.push([ref, model]);
        }
      } else if (model.kind === 'enum') {
        buffer.push(list(ref, model.options));
      } else if (model.repeat) {
        const type = protobufTypes[model.schema] || model.schema;
        const prefix = model.repeat ? 'repeated ' : '';

        buffer.push(`\nmessage ${ref} {\n  ${prefix}${type} data = 1;\n}`);
      } else {
        types[ref] = model;
      }
    }
  }

  Object.keys(repo.models).forEach(ref => {
    push(ref, repo.models[ref]);
  });

  defns.forEach(([ref, model]) => {
    buffer.push(typedef(ref, model, types));
  });

  repo.calls.forEach(call => {
    if (typeof call.input === 'object') {
      const name = utils.caps(`${call.get || call.set}-input`);
      const schema = Object.keys(call.input).reduce((memo, cur, i) => {
        const prefix = utils.isReq(call.input[cur], call.required) ? 'required ' : '';
        const target = types[call.input[cur]] || {};
        const source = protobufTypes[target.schema] || target.schema;

        memo.push(`\n  ${prefix}${source || call.input[cur]} ${cur} = ${i + 1};`);
        return memo;
      }, []);

      buffer.unshift(`\nmessage ${name} {${schema.join('')}\n}`);
    }

    if (!service[call.schema]) service[call.schema] = [];
    service[call.schema].push(protobufCall(call, noop, types));
  });

  Object.keys(service).forEach(ref => {
    buffer.unshift(`\nservice ${ref}${suffix} {${service[ref].join('')}\n}`);
  });

  return `syntax = "proto3";${external}\npackage ${pkgName};${buffer.join('')}`;
};
