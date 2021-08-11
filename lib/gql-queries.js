'use strict';

const graphqlTypes = {
  string: 'String',
  boolean: 'Boolean',
  number: 'Float',
  integer: 'Int',
};

class GQLChunk {
  static getInput(input, _parent, _types) {
    if (!input) return;

    return Object.keys(input)
      .reduce((memo, cur) => {
        const _chunk = new GQLChunk();

        const _schema = typeof input[cur] === 'string'
          ? { schema: input[cur] }
          : input[cur];

        const _fragment = _types[_schema.schema]
          ? _types[_schema.schema]
          : { schema: _schema.schema };

        _chunk.key = cur;
        _chunk.input = _fragment.schema || _fragment.value;
        _chunk.required = _schema.required || _parent.required.includes(_schema.schema);

        if (Array.isArray(_chunk.input)) {
          _chunk.input = _chunk.input[0].schema;
        }

        memo.push(_chunk);
        return memo;
      }, []);
  }

  static getChunk(chunk, _parent, _types, _set) {
    const _schema = chunk.schema || chunk.value;

    if (_schema && Array.isArray(_schema.schema)) {
      const _chunk = new GQLChunk();

      _chunk.children = GQLChunk.getChunks(_schema.schema, chunk, _types, _set);
      _chunk.key = chunk.field;
      return _chunk;
    }

    // FIXME: this can be set to N-depth?
    if (_set[_schema] > 0) return;

    const _chunk = new GQLChunk();
    _chunk.query = chunk.query;

    if (_types[_schema]) {
      const sub = _types[_schema].schema;

      _set[_schema] = _set[_schema] || 0;
      _set[_schema] += 1;

      _chunk.key = chunk.field;
      _chunk.repeated = chunk.repeated;
      _chunk.children = GQLChunk.getChunks(sub, chunk, _types, _set);
    } else {
      _chunk.key = chunk.field;
    }

    return _chunk;
  }

  static getChunks(chunk, _parent, _types, _set) {
    if (!chunk) return;
    return chunk.reduce((memo, x) => {
      const sub = GQLChunk.getChunk(x, _parent, _types, _set);

      if (sub) memo.push(sub);
      return memo;
    }, []);
  }

  static getQuery(chunk, types) {
    const _chunk = new GQLChunk();
    _chunk.query = chunk.query;

    const _seen = {};

    _chunk.key = chunk.get || chunk.set;
    _chunk.required = chunk.required || [];
    _chunk.mutation = typeof chunk.set !== 'undefined';

    if (typeof chunk.input === 'string') {
      chunk.input = types[chunk.input].schema.reduce((memo, cur) => {
        memo[cur.field] = cur;
        return memo;
      }, {});
    }

    let sub = types[chunk.resp]
      ? types[chunk.resp].schema
      : chunk.resp;

    if (typeof sub === 'string') {
      sub = types[sub].schema;
    }

    _chunk.input = GQLChunk.getInput(chunk.input, _chunk, types, _seen);
    _chunk.children = GQLChunk.getChunks(sub, _chunk, types, _seen);

    return _chunk;
  }

  renderChildren() {
    if (!this.children) return '';

    const prefix = Array.from({ length: this.depth || 2 }).join('  ');
    const buffer = [];

    this.children.forEach(x => {
      if (x.query === false) return;

      x.depth = (this.depth || 2) + 1;

      const sub = x.renderChildren();
      const leafs = sub ? ` {\n${sub}${prefix}  }` : '';

      buffer.push(`  ${prefix}${x.key}${leafs}\n`);
    });

    return buffer.join('');
  }

  renderFields() {
    if (!this.input || this.query === null) return '';
    return `(input: {\n${
      this.input.map(x => `    ${x.key}: $${x.key},\n`).join('')
    }  })`;
  }

  renderInput() {
    if (!this.input || this.query === null) return '';
    return `(\n${
      this.input.map(x => `  $${x.key}: ${graphqlTypes[x.input] || x.input}${x.required ? '!' : ''},\n`).join('')
    })`;
  }

  toString() {
    const kind = this.mutation ? 'mutation' : 'query';
    const buffer = [];

    buffer.push(`  ${this.key}${this.renderFields()} {\n`);
    buffer.push(`${this.renderChildren()}  }\n`);

    return `${kind}${this.renderInput()} {\n${buffer.join('')}}\n`;
  }
}

module.exports = (repo, factory) => {
  const types = {};

  Object.keys(repo.models).forEach(ref => {
    const model = factory(repo.models[ref]);

    if (model) {
      types[ref] = model;

      if (Array.isArray(model.schema)) {
        model.schema.forEach(sub => {
          if (sub.schema === 'object') {
            sub.schema = factory(repo.models[ref].properties[sub.field]);
          }
        });
      }
    }
  });

  return repo.calls.map(call => GQLChunk.getQuery(call, types));
};
