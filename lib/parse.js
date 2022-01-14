const yaml = require('js-yaml');
const { readFileSync } = require('fs');
const { join, dirname, resolve } = require('path');

function IncludedFile(mixed, obj) {
  if (!mixed) {
    this.contents = obj;
  } else {
    Object.assign(this, obj);
  }
}

function parse(ctx, _load) {
  return value => {
    const inc = value.indexOf('~/') === 0
      ? value.replace(/^~\//, `${ctx.cwd}/`)
      : resolve(join(dirname(ctx.src), value));

    let data;
    if (inc.indexOf('.yml') !== -1 || inc.indexOf('.yaml') !== -1) {
      data = new IncludedFile(true, _load({ ...ctx, src: inc }, readFileSync(inc).toString()));
    } else if (inc.indexOf('.json')) {
      data = JSON.parse(readFileSync(inc).toString());
    } else {
      data = readFileSync(inc).toString();
    }
    return data;
  };
}

function load(ctx, text, files) {
  const construct = parse(ctx, load, files);

  return yaml.load(text, {
    filename: ctx.src,
    schema: yaml.JSON_SCHEMA.extend([
      new yaml.Type('!include', {
        construct,
        resolve(value) {
          return typeof value === 'string';
        },
        kind: 'scalar',
        instanceOf: IncludedFile,
      }),
    ]),
  });
}

module.exports = (cwd, src, text) => {
  const data = (text && load({ cwd, src }, text)) || {};

  if (Object.prototype.toString.call(data) !== '[object Object]') {
    throw new TypeError(`Expecting object, given '${typeof data}'`);
  }

  return data;
};
