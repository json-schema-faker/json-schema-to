'use strict';

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
  caps,
  trim,
};
