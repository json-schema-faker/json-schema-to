'use strict';

function isReq(value, required) {
  if (Array.isArray(required) && required.indexOf(value) > -1) return true;
  if (required === true) return true;
  return false;
}

function uniq(schema, hash, get) {
  const values = get ? schema : schema.values;

  const key = values
    .sort((a, b) => a > b).join('_')
    .replace(/\W/g, '_').toUpperCase();

  if (get) {
    return hash[key];
  }

  if (!hash[key]) {
    hash[key] = schema.schema;

    return hash[key];
  }
}

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

function safe(value, separator) {
  separator = separator || '_';

  return value
    .replace(/([a-z])([A-Z])/g, `$1${separator}$2`)
    .replace(/[\s_-]+/g, separator);
}

function copy(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(x => copy(x));
  }

  const target = {};

  Object.keys(value).forEach(key => {
    target[key] = copy(value[key]);
  });

  return target;
}

module.exports = {
  isReq,
  uniq,
  caps,
  trim,
  safe,
  copy,
};
