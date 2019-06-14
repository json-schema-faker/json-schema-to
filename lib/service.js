'use strict';

const _util = require('util');

const utils = require('./utils');
const jst = require('.');

class Service {
  constructor(resourceInfo) {
    const schema = utils.copy(resourceInfo) || {};
    const service = schema.service;

    delete schema.service;

    if (!(service && !Array.isArray(service) && typeof service === 'object')) {
      throw new Error(`Invalid service definition, given ${_util.inspect(service)}`);
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
      value: Object.assign(service, {
        id: schema.id,
        pkg: service.pkg || 'api',
        refs: service.refs || [],
        calls: service.calls || [],
        defns: service.defns || {},
      }),
    });

    Object.defineProperty(this, '_definitions', {
      enumerable: false,
      value: {
        models: {},
        enums: [],
        refs: {},
      },
    });
  }

  static bundle(pkgInfo, models) {
    if (!models) {
      models = pkgInfo;
      pkgInfo = {};
    }

    const defns = pkgInfo.defns || [];
    const refs = pkgInfo.refs || [];
    const pkg = pkgInfo.pkg || 'api';

    const output = {};
    const enums = [];
    const seen = [];
    const map = {};

    function push(ref) {
      ref.props.forEach(x => {
        if (Array.isArray(map[x.schema])) {
          x.schema = utils.uniq(map[x.schema], map, true);
        }
      });
    }

    models.forEach(_jst => {
      if (_jst instanceof Service) {
        _jst.enums.splice(0, _jst.enums.length).forEach(enumInfo => {
          const key = utils.uniq(enumInfo, map);

          map[enumInfo.schema] = enumInfo.values;

          if (key) {
            enums.push({
              schema: key,
              source: enumInfo.source,
              values: enumInfo.values,
            });
          }
        });

        _jst.models.forEach(modelInfo => {
          if (seen.indexOf(modelInfo.name) !== -1) {
            delete _jst._definitions.models[modelInfo.name];

            if (output[modelInfo.name]) {
              output[modelInfo.name].refs.push(utils.safe(_jst.modelId, '-'));
            }

            return;
          }

          seen.push(modelInfo.name);

          push(modelInfo);
        });

        Object.assign(_jst._resource.defns, defns);

        _jst._resource.pkg = pkg;

        const fixedId = utils.safe(_jst.modelId, '-');

        if (refs.indexOf(fixedId) === -1) {
          refs.push(fixedId);
        }

        output[_jst.modelId] = _jst;
      }
    });

    return {
      get models() {
        return Object.keys(output).reduce((prev, cur) => {
          prev.push(output[cur]);

          return prev;
        }, []);
      },

      get graphql() {
        return jst.generate({ pkg, calls: [] }, { enums }, jst.graphqlDefs, defns);
      },

      get protobuf() {
        return jst.generate({ pkg, refs, calls: [] }, { enums }, jst.protobufDefs, defns);
      },
    };
  }

  static merge(pkgInfo, models) {
    if (!models) {
      models = pkgInfo;
      pkgInfo = {};
    }

    const resource = {
      pkg: pkgInfo.pkg || 'api',
      refs: pkgInfo.refs || [],
      calls: pkgInfo.calls || [],
    };

    const options = {
      models: [],
      enums: [],
    };

    const schemas = {};
    const defns = {};
    const seen = [];
    const map = {};

    function push(ref) {
      if (ref.schema) {
        ref.schema.forEach(x => {
          if (Array.isArray(map[x.schema])) {
            x.schema = utils.uniq(map[x.schema], map, true);
          }
        });
      }
    }

    models.forEach(_jst => {
      if (_jst instanceof Service) {
        const modelInfo = _jst.model;

        Object.assign(schemas, _jst.$refs);
        Object.assign(defns, _jst.defns);

        _jst.enums.forEach(enumInfo => {
          const key = utils.uniq(enumInfo, map);

          map[enumInfo.schema] = enumInfo.values;

          if (key) {
            options.enums.push({
              schema: key,
              source: enumInfo.source,
              values: enumInfo.values,
            });
          }
        });

        resource.calls = resource.calls.concat(modelInfo.service.resource.calls);

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

          push(modelInfo.service);
        }

        modelInfo.external.forEach(ref => {
          if (seen.indexOf(ref.model) === -1) {
            seen.push(ref.model);
            options.models.push({
              name: ref.model,
              props: ref.schema,
            });

            push(ref);
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
    refs = (refs || []).slice();

    if (typeof directory === 'object') {
      refs = (schemas || []).slice();
      schemas = directory;
      directory = undefined;
    }

    let bundle;

    return Promise.resolve()
      .then(() => {
        bundle = Object.keys(schemas).reduce((prev, cur) => {
          if (schemas[cur].service) {
            const _jst = new Service(schemas[cur]);

            prev.push(_refs => _jst.load(directory, _refs));
            refs.push(_jst.$schema);
          } else {
            refs.push(schemas[cur]);
          }

          return prev;
        }, []);
      })
      .then(() => Promise.all(refs.map(x => jst.resolve(directory, refs, x))))
      .then(fixedRefs => Promise.all(bundle.map(cb => cb(fixedRefs))));
  }

  load(directory, refs) {
    return this.sync(directory, refs || [])
      .then(() => jst.resolve(directory, refs || [], this._schema))
      .then(fixedSchema => jst.load(refs || [], fixedSchema, this._definitions))
      .then(() => jst.conciliate(this._resource, this._definitions))
      .then(() => this);
  }

  scan(directory, refs) {
    return this.sync(directory, refs || [])
      .then(() => jst.parse(directory, refs || [], this._schema, this._definitions))
      .then(() => jst.conciliate(this._resource, this._definitions))
      .then(() => this);
  }

  sync(directory, refs) {
    const _defns = this._schema.definitions || {};
    const _refs = [];

    return Promise.resolve()
      .then(() => {
        Object.keys(_defns).forEach(def => {
          const ref = _defns[def] || {};
          const items = ref.items;

          if (ref.properties) {
            _refs.push(() => {
              return jst.resolve(directory, refs || [], ref)
                .then(fixedSchema => {
                  fixedSchema.id = fixedSchema.id || def;

                  return jst.load(refs || [], fixedSchema, this._definitions);
                });
            });
          }

          let fixedId = (items && (items.$ref || items.id)) || ref.$ref || ref.id;

          fixedId = fixedId && fixedId.replace(/^#\/definitions\//, '');

          if (def !== fixedId) {
            this._resource.defns[def] = {
              repeated: !!items,
              schema: fixedId || def,
            };

            const fixedType = (items && items.type) || ref.type;

            if (fixedType && fixedType !== 'object') {
              this._resource.defns[def].type = fixedType;
            }
          }

          if (ref.id !== fixedId) {
            ref.id = fixedId;
          }
        });
      })
      .then(() => Promise.all(_refs.map(cb => cb())))
      .then(() => this);
  }

  get options() {
    return {
      models: this.models,
      enums: this._definitions.enums,
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
    return this._schema;
  }

  get $refs() {
    return this._definitions.refs;
  }

  get refs() {
    return this._resource.refs || [];
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
