'use strict';

const _util = require('util');

const jst = require('./lib');

class Builder {
  constructor(resource) {
    const schema = Object.assign({}, resource);

    const serviceDefinition = schema.serviceDefinition;

    delete schema.serviceDefinition;

    if (!serviceDefinition) {
      throw new Error(`Missing service definition, given ${_util.inspect(serviceDefinition)}`);
    }

    if (!(schema && schema.id)) {
      throw new Error(`Missing schema identifier, given ${_util.inspect(schema)}`);
    }

    this.modelId = schema.id;

    const _defns = Object.assign({}, schema.definitions);

    Object.keys(_defns).forEach(def => {
      const ref = _defns[def] || {};
      const items = ref.items;

      _defns[def] = (items && (items.$ref || items.id)) || ref.$ref || ref.id;
    });

    Object.defineProperty(this, '_resource', {
      enumerable: false,
      value: Object.assign(serviceDefinition, {
        schema,
        defns: _defns,
        pkg: resource.pkg || schema.id,
        refs: resource.refs || [],
      }),
    });

    Object.defineProperty(this, '_definitions', {
      enumerable: false,
      value: {
        models: {},
        enums: [],
        deps: {},
        refs: {},
      },
    });

    console.log(this);
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
        const modelInfo = _jst.model;

        Object.assign(schemas, _jst.$refs);
        Object.assign(defns, _jst.defns);
        Object.assign(options.deps, modelInfo.service.assoc);

        Array.prototype.push.apply(resource.calls, modelInfo.service.resource.calls);

        modelInfo.service.resource.refs.forEach(ref => {
          if (resource.refs.indexOf(ref) === -1) {
            resource.refs.push(ref);
          }
        });

        if (seen.indexOf(modelInfo.service.model) === -1) {
          seen.push(modelInfo.service.model);

          options.models.push({
            name: modelInfo.service.model,
            props: modelInfo.service.schema,
          });
        }

        modelInfo.external.forEach(ref => {
          if (seen.indexOf(ref.model) === -1) {
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
      get graphql() {
        return jst.generate(resource, options, jst.graphqlDefs, defns);
      },
      get protobuf() {
        return jst.generate(resource, options, jst.protobufDefs, defns);
      },
    };
  }

  static load(directory, schemas, refs) {
    refs = refs || [];

    if (typeof directory === 'object') {
      refs = schemas || [];
      schemas = directory;
      directory = undefined;
    }

    const bundle = Object.keys(schemas).reduce((prev, cur) => {
      if (schemas[cur].serviceDefinition) {
        const _jst = new Builder(schemas[cur]);

        prev.push(_refs => _jst.load(directory, _refs));
        refs.push(_jst.$schema);
      } else {
        refs.push(schemas[cur]);
      }

      return prev;
    }, []);

    return Promise
      .all(refs.map(x => jst.resolve(directory, refs, x)))
      .then(fixedRefs => Promise.all(bundle.map(cb => cb(fixedRefs))));
  }

  load(directory, refs) {
    return jst.resolve(directory, refs || [], this._resource.schema)
      .then(fixedSchema => jst.load(refs, fixedSchema, this._definitions))
      .then(() => this);
  }

  scan(directory, refs) {
    return jst.parse(directory, refs || [], this._resource.schema, this._definitions)
      .then(() => this);
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
    const schema = this._resource.schema;

    const service = {
      model: this.modelId,
      assoc: this._definitions.deps,
      schema: this._definitions.models[this.modelId],
      resource: {
        refs: this._resource.refs,
        calls: this._resource.calls,
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

  get $schema() {
    return this._resource.schema;
  }

  get $refs() {
    return this._definitions.refs;
  }

  get defns() {
    return this._resource.defns || {};
  }

  get enums() {
    return this._definitions.enums;
  }

  get graphql() {
    return jst.generate(this._resource, this.options, jst.graphqlDefs, this.defns);
  }

  get protobuf() {
    return jst.generate(this._resource, this.options, jst.protobufDefs, this.defns);
  }
}

module.exports = Builder;
