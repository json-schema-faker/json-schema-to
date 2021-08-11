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

  if (model.options) {
    return `${model.field}${middle}: ${model.options.map(x => `'${x}'`).join(' | ')};`;
  }
  if (model.repeat) {
    return `${model.field}${middle}: ${target}[];`;
  }
  return `${model.field}${middle}: ${target};`;
}

function typedef(name, model) {
  const buffer = [];

  if (model.kind === 'type') {
    if (!Array.isArray(model.schema)) {
      buffer.push(`export type ${name} = ${type(model.schema)}${model.repeat ? '[]' : ''};`);
    } else {
      buffer.push(`export type ${name} = {${model.schema.map(k => `\n  ${field(k)}`).join('')}\n};`);
    }
  } else if (model.kind === 'enum') {
    buffer.push(`export enum ${name} {${model.options.map(k => `\n  ${k} = '${k}',`).join('')}\n}`);
  } else {
    buffer.push(`export type ${name} = ${type(model.value, model.schema)}${model.repeat ? '[]' : ''};`);
  }
  return buffer.join('');
}

module.exports = ({ calls, models }, factory) => {
  const buffer = [];

  Object.keys(models).forEach(ref => {
    const model = factory(models[ref]);

    if (model) {
      buffer.push(typedef(ref, model, calls));
    }
  });
  return buffer.join('\n');
};
