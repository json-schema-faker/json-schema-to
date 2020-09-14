'use strict';

const graphqlTypes = {
  string: 'String',
  boolean: 'Boolean',
  number: 'Float',
  integer: 'Int',
};

class GQLChunk {
  static getInput(input, _parent, _root) {
    if (!input) return;

    return Object.keys(input)
      .reduce((memo, cur) => {
        const _chunk = new GQLChunk;

        const _schema = typeof input[cur] === 'string'
          ? { schema: input[cur] }
          : input[cur];

        const _fragment = _root.$refs[_schema.schema]
          ? _root.$refs[_schema.schema][0]
          : { type: _schema.schema };

        _chunk.key = cur;
        _chunk.input = _fragment.type || _fragment.schema;
        _chunk.required = _schema.required || _parent.required.includes(_schema.schema);

        memo.push(_chunk);
        return memo;
      }, []);
  }

  static getChunk(chunk, _parent, _root, _set) {
    // FIXME: this can be set to N-depth?
    if (_set[chunk.schema] > 0) return;

    const _chunk = new GQLChunk;

    if (_root.$refs[chunk.schema]) {
      const sub = _root.$refs[chunk.schema];

      _set[chunk.schema] = _set[chunk.schema] || 0;
      _set[chunk.schema] += 1;

      _chunk.key = chunk.field;
      _chunk.repeated = chunk.repeated;
      _chunk.children = GQLChunk.getChunks(sub, chunk, _root, _set);
    } else {
      _chunk.key = chunk.field;
    }

    return _chunk;
  }

  static getChunks(chunk, _parent, _root, _set) {
    if (!chunk) return;
    return chunk.reduce((memo, x) => {
      const sub = GQLChunk.getChunk(x, _parent, _root, _set);

      if (sub) memo.push(sub);
      return memo;
    }, []);
  }

  static getQuery(chunk, resource) {
    const sub = !resource.$refs[chunk.resp]
      ? resource.defns[chunk.resp].schema
      : chunk.resp;

    const _chunk = new GQLChunk;
    const _seen = {};

    _chunk.key = chunk.get || chunk.set;
    _chunk.required = chunk.required || [];
    _chunk.mutation = typeof chunk.set !== 'undefined';

    if (typeof chunk.input === 'string') {
      chunk.input = resource.$refs[chunk.input].reduce((memo, cur) => {
        memo[cur.field] = cur;
        return memo;
      }, {});
    }

    _chunk.input = GQLChunk.getInput(chunk.input, _chunk, resource, _seen);
    _chunk.children = GQLChunk.getChunks(resource.$refs[sub], _chunk, resource, _seen);

    return _chunk;
  }

  renderChildren() {
    if (!this.children) return '';

    const prefix = Array.from({ length: this.depth || 2 }).join('  ');
    const buffer = [];

    this.children.forEach(x => {
      x.depth = (this.depth || 2) + 1;

      const sub = x.renderChildren();
      const leafs = sub ? ` {\n${sub}${prefix}  }` : '';

      buffer.push(`  ${prefix}${x.key}${leafs}\n`);
    });

    return buffer.join('');
  }

  renderFields() {
    if (!this.input) return '';
    return `(input: {\n${
      this.input.map(x => `    ${x.key}: $${x.key},\n`).join('')
    }  })`;
  }

  renderInput() {
    if (!this.input) return '';
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

module.exports = (resource, options, defns) => {
  resource.defns = Object.assign(resource.defns || {}, defns);
  resource.$refs = options.models.reduce((memo, cur) => {
    if (cur.props) memo[cur.name] = cur.props;
    return memo;
  }, {});

  Object.keys(resource.defns).forEach(def => {
    const sub = resource.defns[def];

    if (!resource.$refs[sub.schema]) {
      resource.$refs[sub.schema] = [sub];
    }
  });

  return resource.calls.map(x => GQLChunk.getQuery(x, resource));
};
