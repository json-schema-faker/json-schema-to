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

    this.definitions = {
      models: {},
      enums: [],
      deps: {},
      refs: {},
    };

    this.resource.defns = this.resource.schema.definitions || {};
    this.resource.pkg = this.resource.pkg || schema.id;
    this.resource.refs = this.resource.refs || [];
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

    await jst.parse(directory, references, this.resource.schema, this.definitions);

    return this;
  }

  get options() {
    return {
      models: this.models,
      enums: this.definitions.enums,
      deps: this.definitions.deps,
    };
  }

  get models() {
    return Object.keys(this.definitions.models)
      .map(def => ({
        name: def,
        props: this.definitions.models[def],
      }));
  }

  get model() {
    const { schema } = this.resource;

    const service = {
      model: this.modelId,
      assoc: this.definitions.deps,
      schema: this.definitions.models[this.modelId],
      resource: {
        refs: this.resource.refs,
        calls: this.resource.calls,
      },
    };

    const external = [];

    Object.keys(this.definitions.models).forEach(refId => {
      if (refId !== this.modelId) {
        external.push({
          model: refId,
          schema: this.definitions.models[refId],
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
    return this.definitions.refs;
  }

  get defns() {
    return this.resource.defns || {};
  }

  get enums() {
    return this.definitions.enums;
  }

  get schema() {
    return jst.generate(this.resource, this.options, jst.graphqlDefs, this.defns);
  }

  get protobuf() {
    return jst.generate(this.resource, this.options, jst.protobufDefs, this.defns);
  }
}

module.exports = Builder;
