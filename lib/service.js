'use strict';

const utils = require('./utils');
const jst = require('.');

class Service {
  constructor(pkgInfo, repo) {
    delete pkgInfo.calls;
    this.package = pkgInfo;
    Object.assign(this, repo);
  }

  static from(model, refs) {
    if (typeof refs === 'string') {
      refs = jst({ exit: false })(refs);
    }

    if (!model || !model.id) {
      throw new TypeError(`Invalid schema, given '${JSON.stringify(model, null, 2)}'`);
    }

    let repo = Service.load(model, refs, true);
    if (model.service) {
      if (!repo.calls.length) {
        repo.calls.push(...(model.service.calls || []).map(call => ({ ...call, schema: model.id })));
      }
      repo = Service.build(model.service, repo);
      delete repo.package.calls;
    }
    return repo;
  }

  static load(model, refs, one) {
    if (one) {
      model = { [model.id]: model };
    }
    return utils.load(utils.copy(model), utils.copy(refs || []));
  }

  static build(pkgInfo, repo) {
    return new Service(pkgInfo, repo);
  }

  get enums() {
    return this.generate(jst.enumSets, this.package, this.calls, this.models, this.enumerate);
  }

  get queries() {
    return this.generate(jst.gqlQueries, this.package, this.calls, this.models);
  }

  get graphql() {
    return this.generate(jst.graphqlDefs, this.package, this.calls, this.models);
  }

  get protobuf() {
    return this.generate(jst.protobufDefs, this.package, this.calls, this.models);
  }

  get typescript() {
    return this.generate(jst.typescriptDefs, this.package, this.calls, this.models);
  }
}

module.exports = Service;
