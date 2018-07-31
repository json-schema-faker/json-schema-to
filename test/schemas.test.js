'use strict';

const fs = require('fs');
const ls = require('glob').sync;
const expect = require('chai').expect;

const Service = require('../lib/service');

/* global describe, it */

describe.only('Service', () => {
  describe('static methods', () => {
    describe('constructor', () => {
      it('should fail without arguments', () => {
        expect(() => new Service()).to.throw('Invalid service definition, given undefined');
      });

      it('should fail on invalid definitions', () => {
        expect(() => new Service({ serviceDefinition: true })).to.throw('Invalid service definition, given true');
        expect(() => new Service({ serviceDefinition: [] })).to.throw('Invalid service definition, given []');
      });

      it('should fail on invalid schema definitions', () => {
        expect(() => new Service({ serviceDefinition: {} })).to.throw('Invalid schema identifier, given {}');
        expect(() => new Service({ serviceDefinition: {}, schema: NaN })).to.throw('Invalid schema identifier, given { schema: NaN }');
        expect(() => new Service({ serviceDefinition: {}, schema: { id: -1 } })).to.throw('Invalid schema identifier, given { schema: { id: -1 } }');
      });
    });
  });

  describe('instance methods', () => {});

  describe('schema validation', () => {
    const schemasDir = `${__dirname}/schemas`;

    function readFile(filePath) {
      return fs.readFileSync(filePath).toString();
    }

    function readJSON(filePath) {
      return JSON.parse(readFile(filePath));
    }

    ls('**/*.json', { cwd: schemasDir })
      .forEach(schemaFile => {
        const schemaId = schemaFile.replace('.json', '');

        it(schemaFile, () => {
          const data = readJSON(`${schemasDir}/${schemaFile}`);
          const service = new Service(data);

          const gqlFile = `${schemasDir}/${schemaId}.gql`;
          const protoFile = `${schemasDir}/${schemaId}.proto`;

          if (data.debug) {
            console.log(service.graphql);
            console.log(service.protobuf);
          }

          expect(service.graphql.trim()).to.eql(readFile(gqlFile).trim());
          expect(service.protobuf.trim()).to.eql(readFile(protoFile).trim());
        });
      });
  });
});
