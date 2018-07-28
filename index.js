const { inspect } = require('util');

const jst = require('./lib');

class Builder {
  constructor({ serviceDefinition, ...schema }) {
    if (!serviceDefinition) {
      throw new Error(`Missing service definition, given ${inspect(serviceDefinition)}`);
    }

    if (!(schema && schema.id)) {
      throw new Error(`Missing schema identifier, given ${inspect(schema)}`);
    }

    this.resource = { ...serviceDefinition, schema };
    this.modelId = schema.id;

    const _defns = { ...this.resource.schema.definitions };

    Object.keys(_defns).forEach(def => {
      const { items, $ref, id } = _defns[def] || {};

      _defns[def] = (items && (items.$ref || items.id)) || $ref || id;
    });

    this.resource.defns = _defns;
    this.resource.pkg = this.resource.pkg || schema.id;
    this.resource.refs = this.resource.refs || [];

    Object.defineProperty(this, '_definitions', {
      enumerable: false,
      value: {
        models: {},
        enums: [],
        deps: {},
        refs: {},
      },
    });
  }

  static merge(id, results) {
    const resource = {
      pkg: id,
      refs: [],
      calls: [],
    };

    const options = {
      models: [],
      enums: [],
      deps: {},
    };

    const schemas = {};
    const defns = {};
    const seen = [];

    results.forEach(_jst => {
      if (_jst instanceof Builder) {
        const { service, external } = _jst.model;

        Object.assign(schemas, _jst.$refs);
        Object.assign(defns, _jst.defns);
        Object.assign(options.deps, service.assoc);

        resource.calls.push(...service.resource.calls);

        service.resource.refs.forEach(ref => {
          if (!resource.refs.includes(ref)) {
            resource.refs.push(ref);
          }
        });

        if (!seen.includes(service.model)) {
          seen.push(service.model);

          options.models.push({
            name: service.model,
            props: service.schema,
          });
        }

        external.forEach(ref => {
          if (!seen.includes(ref.model)) {
            seen.push(ref.model);
            options.models.push({
              name: ref.model,
              props: ref.schema,
            });
          }
        });
      }
    });

    return {
      get $refs() {
        return schemas;
      },
      get schema() {
        return jst.generate(resource, options, jst.graphqlDefs, defns);
      },
      get protobuf() {
        return jst.generate(resource, options, jst.protobufDefs, defns);
      },
    };
  }

  async scan(directory, references = []) {
    if (!(references && Array.isArray(references))) {
      throw new Error(`Invalid references, given ${inspect(references)}`);
    }

    await jst.parse(directory, references, this.resource.schema, this._definitions);

    return this;
  }

  get options() {
    return {
      models: this.models,
      enums: this._definitions.enums,
      deps: this._definitions.deps,
    };
  }

  get models() {
    return Object.keys(this._definitions.models)
      .map(def => ({
        name: def,
        props: this._definitions.models[def],
      }));
  }

  get model() {
    const { schema } = this.resource;

    const service = {
      model: this.modelId,
      assoc: this._definitions.deps,
      schema: this._definitions.models[this.modelId],
      resource: {
        refs: this.resource.refs,
        calls: this.resource.calls,
      },
    };

    const external = [];

    Object.keys(this._definitions.models).forEach(refId => {
      if (refId !== this.modelId) {
        external.push({
          model: refId,
          schema: this._definitions.models[refId],
        });
      }
    });

    return {
      schema,
      service,
      external,
    };
  }

  get $refs() {
    return this._definitions.refs;
  }

  get defns() {
    return this.resource.defns || {};
  }

  get enums() {
    return this._definitions.enums;
  }

  get schema() {
    return jst.generate(this.resource, this.options, jst.graphqlDefs, this.defns);
  }

  get protobuf() {
    return jst.generate(this.resource, this.options, jst.protobufDefs, this.defns);
  }
}

module.exports = Builder;
