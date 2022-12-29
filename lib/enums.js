'use strict';

const utils = require('./utils');

module.exports = (repo, factory, enumerate) => {
  const _refs = [];

  Object.keys(repo.models).forEach(ref => {
    if (repo.models[ref].enum) {
      _refs.push(`['${ref}', ${JSON.stringify(repo.models[ref].enum)}]`);
    }
  });

  let buffer = '';
  if (_refs.length) {
    buffer += `\nconst __ref = function ${utils.trim(enumerate.toString())};`;
    buffer += `\nconst __enums = [${_refs.map(x => `\n  ${x},`).join('')}\n];`;
    buffer += '\nconst __factory = self => __enums.reduce((memo, [k, v]) => (self[k] = __ref(v, k), memo), self);\n';
  } else {
    buffer += '\nconst __factory = self => self;\n';
  }
  return buffer;
};
