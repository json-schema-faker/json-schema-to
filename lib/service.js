'use strict';

const _util = require('util');

const jst = require('.');

class Service {
  constructor(resourceInfo) {
    const schema = Object.assign({}, resourceInfo);

    const serviceDefinition = schema.serviceDefinition;

    delete schema.serviceDefinition;

    if (!(serviceDefinition && !Array.isArray(serviceDefinition) && typeof serviceDefinition === 'object')) {
      throw new Error(`Invalid service definition, given ${_util.inspect(serviceDefinition)}`);
    }

    if (!(schema && typeof schema.id === 'string')) {
      throw new Error(`Invalid schema identifier, given ${_util.inspect(schema)}`);
    }

    this.modelId = schema.id;

    Object.defineProperty(this, '_schema', {
      enumerable: false,
      value: schema,
    });

    Object.defineProperty(this, '_resource', {
      enumerable: false,
      value: Object.assign(serviceDefinition, {
        pkg: serviceDefinition.pkg || schema.id,
        refs: serviceDefinition.refs || [],
        calls: serviceDefinition.calls || [],
        defns: serviceDefinition.defns || [],
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
      if (_jst instanceof Service) {
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
        const _jst = new Service(schemas[cur]);

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
    return this.sync(directory, refs || [])
      .then(() => jst.resolve(directory, refs || [], this._schema))
      .then(fixedSchema => jst.load(refs || [], fixedSchema, this._definitions))
      .then(() => this);
  }

  scan(directory, refs) {
    return this.sync(directory, refs || [])
      .then(() => jst.parse(directory, refs || [], this._schema, this._definitions))
      .then(() => this);
  }

  sync(directory, refs) {
    const _defns = Object.assign({}, this._schema.definitions);
    const _refs = [];

    Object.keys(_defns).forEach(def => {
      const ref = _defns[def] || {};
      const items = ref.items;

      if (ref.id && ref.properties) {
        _refs.push(() => {
          return jst.resolve(directory, refs || [], ref)
            .then(fixedSchema => jst.load(refs || [], fixedSchema, this._definitions));
        });
      }

      this._resource.defns[def] = (items && (items.$ref || items.id)) || ref.$ref || ref.id;
    });

    return Promise
      .all(_refs.map(cb => cb()))
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
    const schema = this._schema;

    const service = {
      model: this.modelId,
      assoc: this._definitions.deps,
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
    return this._schema;
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

module.exports = Service;
