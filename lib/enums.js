'use strict';

const utils = require('./utils');

module.exports = (repo, factory, enumerate) => {
  const _refs = [];
  const _values = [];

  Object.keys(repo.models).forEach(ref => {
    if (repo.models[ref].enum) {
      _refs.push(`['${ref}', ${JSON.stringify(repo.models[ref].enum)}]`);
      _values.push(ref);
    }
  });

  let buffer = '';
  if (_refs.length) {
    const code = enumerate.toString().replace(/function\s+/, '');

    buffer += `\nconst __ref = function ${utils.trim(code)};`;
    buffer += `\nconst __enums = [${_refs.map(x => `\n  ${x},`).join('')}\n];`;
    buffer += '\nconst __factory = self => __enums.reduce((memo, [k, v]) => (self[k] = __ref(v, k), memo), self);\n';
  } else {
    buffer += '\nconst __factory = self => self;\n';
  }

  return { buffer, set: _values };
};
