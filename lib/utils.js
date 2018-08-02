'use strict';

let _counter = 0;

function uniq(values, hash, get) {
  const key = values
    .sort((a, b) => a > b).join('_')
    .replace(/\W/g, '_').toUpperCase();

  if (get) {
    return hash[key];
  }

  if (!hash[key]) {
    hash[key] = `_${_counter += 1}`;

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

module.exports = {
  uniq,
  caps,
  trim,
};
