'use strict';

const fs = require('fs');
const expect = require('chai').expect;

const _ = require('./utils');
const Service = require('../lib/service');

/* global describe, it */

describe('Schema validation', () => {
  const schemasDir = `${__dirname}/schemas`;

  function readFile(filePath) {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath).toString() : null;
  }

  function readJSON(filePath) {
    return JSON.parse(readFile(filePath));
  }

  fs.readdirSync(schemasDir)
    .filter(x => x.indexOf('.') === -1)
    .forEach(name => {
      const schemaId = `${schemasDir}/${name}`;

      it(name.replace(/[^a-z\d]+/g, ' ').trim(), () => {
        const data = readJSON(`${schemaId}/schema.json`);
        const service = Service.from(data);

        const tsFile = `${schemaId}/schema.ts`;
        const gqlFile = `${schemaId}/schema.gql`;
        const gqlQFile = `${schemaId}/queries.gql`;
        const protoFile = `${schemaId}/schema.proto`;

        if (data.debug) {
          console.log(service.queries.join('\n'));
          console.log(service.graphql);
          console.log(service.protobuf);
          console.log(service.typescript);
        }

        expect(service.typescript.trim()).to.eql(readFile(tsFile).trim());
        expect(service.protobuf.trim()).to.eql(readFile(protoFile).trim());
        expect(service.graphql.trim()).to.eql(readFile(gqlFile).trim());
        expect(service.queries.join('\n')).to.eql(readFile(gqlQFile));

        try {
          _.makeExecutableSchema({
            typeDefs: [_.trim(`
              type Query { dummy: [String] }
              type Mutation { dummy: [String] }
              schema { query: Query, mutation: Mutation }
            `), service.graphql],
          });
        } catch (e) {
          throw new Error(`(GraphQL) ${e.message}\n\n${service.graphql}`);
        }

        _.mockFs({
          'generated.proto': Buffer.from(`${service.protobuf}\nmessage Noop {}`),
        });

        try {
          _.loadPackageDefinition(_.loadSync('generated.proto', {}));
        } catch (e) {
          throw new Error(`(Protobuf) ${e.message}\n\n${service.protobuf}`);
        } finally {
          _.mockFs.restore();
        }
      });
    });
});
