'use strict';

function uniq(schema, hash, get) {
  const key = schema.values
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

function caps(value, camelCase) {
  const fixedValue = value
    .replace(/(?:\b|^)([a-z])/g, ($0, $1) => $1.toUpperCase())
    .replace(/\W/g, '');

  if (camelCase) {
    return fixedValue[0].toLowerCase() + fixedValue.substr(1);
  }

  return fixedValue;
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
    .replace(/[\s_-]+/g, separator)
    .toLowerCase();
}

module.exports = {
  uniq,
  caps,
  trim,
  safe,
};
