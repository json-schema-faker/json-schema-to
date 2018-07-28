const jst = require('./lib');

class Builder {
  constructor(id, pkg) {
    this.modelId = id;
    this.resource = { ...pkg };

    this.definitions = {
      models: {},
      enums: [],
      deps: {},
    };

    this.resource.pkg = this.resource.pkg || id;
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

    const defns = {};
    const seen = [];

    results.forEach(_jst => {
      if (_jst instanceof Builder) {
        const { service, external } = _jst.model;

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
      get schema() {
        return jst.generate(resource, options, jst.graphqlDefs, defns);
      },
      get protobuf() {
        return jst.generate(resource, options, jst.protobufDefs, defns);
      },
    };
  }

  async scan(cwd, refs, schema) {
    this.resource.defns = this.resource.defns || {};

    await jst.parse(cwd, refs, schema, this.definitions);

    Object.assign(this.resource.defns, schema.definitions);

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
      service,
      external,
    };
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
