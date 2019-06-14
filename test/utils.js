const mockFs = require('mock-fs');

const gql = require('graphql');
const gqltools = require('graphql-tools');

const grpc = require('grpc');

const grpcloader = require('@grpc/proto-loader');

const is = require('is-my-json-valid');
const jsf = require('json-schema-faker');

const utils = require('../lib/utils');

function getModels(definitions) {
  return Object.keys(definitions.models)
    .map(def => ({
      name: def,
      props: definitions.models[def],
    }));
}

function getOptions(models, definitions) {
  return {
    models,
    deps: [],
    enums: definitions.enums,
  };
}

module.exports = {
  makeExecutableSchema: gqltools.makeExecutableSchema,
  graphql: gql.graphql,
  mockFs,
  Server: grpc.Server,
  loadSync: grpcloader.loadSync,
  loadPackageDefinition: grpc.loadPackageDefinition,
  ServerCredentials: grpc.ServerCredentials,
  credentials: grpc.credentials,
  jsf,
  is,
  trim: utils.trim,
  getModels,
  getOptions,
};
