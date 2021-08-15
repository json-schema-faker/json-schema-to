'use strict';

const utils = require('./utils');

const tsTypes = {
  integer: 'number',
};

function type(value, def) {
  return tsTypes[value] || value || def;
}

function field(model) {
  const target = type(model.value);
  const middle = utils.isReq(target, model.required) ? '' : '?';
  const suffix = model.nullable ? ' | null' : '';

  let info = '';
  if (model.description) {
    info = `\n/**\n${model.description}\n*/`;
  }

  if (model.options) {
    return `${info}\n  ${model.field}${middle}: ${model.options.map(x => `'${x}'`).join(' | ')}${suffix};`;
  }
  if (model.repeat) {
    return `${info}\n  ${model.field}${middle}: ${target}[]${suffix};`;
  }
  return `${info}\n  ${model.field}${middle}: ${target}${suffix};`;
}

function typedef(name, model) {
  const buffer = [];

  if (model.description) {
    buffer.push(`/**\n${model.description}\n*/\n`);
  }

  if (model.kind === 'type') {
    if (!Array.isArray(model.schema)) {
      buffer.push(`export type ${name} = ${type(model.schema)}${model.repeat ? '[]' : ''};`);
    } else {
      buffer.push(`export type ${name} = {${model.schema.map(k => field(k)).join('')}\n};`);
    }
  } else if (model.kind === 'enum') {
    buffer.push(`export enum ${name} {${model.options.map(k => `\n  ${k} = '${k}',`).join('')}\n}`);
  } else {
    buffer.push(`export type ${name} = ${type(model.value, model.schema)}${model.repeat ? '[]' : ''};`);
  }
  return buffer.join('');
}

function associate(name, model) {
  model.schema.forEach(prop => {
    if (prop.association) {
      prop.association.fields.forEach(([key, _type]) => {
        model.schema.push({
          description: prop.description ? `Associated \`${prop.association.model}.${key}\` field.` : null,
          field: `${prop.association.model.toLowerCase()}${utils.caps(key)}`,
          value: _type,
          required: true,
        });
      });
    }
  });
}

module.exports = ({ calls, models }, factory) => {
  const buffer = [];
  const defns = {};

  Object.keys(models).forEach(ref => {
    const model = factory(models[ref], ref);

    if (model) {
      defns[ref] = model;
    }
  });

  Object.keys(defns).forEach(ref => {
    if (Array.isArray(defns[ref].schema)) associate(ref, defns[ref]);
    buffer.push(typedef(ref, defns[ref], calls));
  });
  return buffer.join('\n');
};
