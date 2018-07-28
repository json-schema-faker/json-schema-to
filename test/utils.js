const mockFs = require('mock-fs');

const { graphql } = require('graphql');
const { makeExecutableSchema } = require('graphql-tools');

const {
  Server, loadPackageDefinition, ServerCredentials, credentials,
} = require('grpc');

const { loadSync } = require('@grpc/proto-loader');

const is = require('is-my-json-valid');
const jsf = require('json-schema-faker');

const { trim } = require('../lib/utils');

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
    deps: {},
    enums: definitions.enums,
  };
}

module.exports = {
  makeExecutableSchema,
  graphql,
  mockFs,
  Server,
  loadSync,
  loadPackageDefinition,
  ServerCredentials,
  credentials,
  jsf,
  is,
  trim,
  getModels,
  getOptions,
};
