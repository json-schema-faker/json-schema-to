const mockFs = require('mock-fs');

const gql = require('graphql');
const gqltools = require('@graphql-tools/schema');

const grpc = require('@grpc/grpc-js');
const fs = require('fs-extra');

const grpcloader = require('@grpc/proto-loader');

const is = require('is-my-json-valid');

const utils = require('../lib/utils');

module.exports = {
  makeExecutableSchema: gqltools.makeExecutableSchema,
  graphql: gql.graphql,
  mockFs,
  Server: grpc.Server,
  loadSync: grpcloader.loadSync,
  loadPackageDefinition: grpc.loadPackageDefinition,
  ServerCredentials: grpc.ServerCredentials,
  credentials: grpc.credentials,
  fs,
  is,
  trim: utils.trim,
};
