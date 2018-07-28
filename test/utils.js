const mockFs = require('mock-fs');
const { graphql } = require('graphql');
const { makeExecutableSchema } = require('graphql-tools');
const { Server, loadPackageDefinition, ServerCredentials, credentials } = require('grpc');
const { loadSync } = require('@grpc/proto-loader');

const is = require('is-my-json-valid');
const jsf = require('json-schema-faker');

// jsf.option({
//   alwaysFakeOptionals: true,
// });

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
};
