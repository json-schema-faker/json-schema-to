'use strict';

const expect = require('chai').expect;

const utils = require('../lib/utils');
const Service = require('../lib/service');

/* global beforeEach, describe, it */

describe('Service', () => {
  let service;

  beforeEach(() => {
    service = new Service({
      serviceDefinition: {
        calls: [
          { get: 'value', resp: 'Test' },
        ],
      },
      id: 'Test',
      definitions: {
        SomeType: {
          $ref: 'Example',
        },
        SomeExample: {
          id: 'OSOM',
        },
      },
      properties: {
        id: {
          type: 'integer',
        },
      },
    });
  });

  it('should generate valid graphql', () => {
    expect(service.graphql.trim()).to.eql(utils.trim(`
      extend type Query {
        value: Test
      }
    `));
  });

  it('should generate valid protobuf', () => {
    expect(service.protobuf.trim()).to.eql(utils.trim(`
      syntax = "proto3";
      package test;
      service Test {
        rpc value(Empty) returns(Test) {}
      }
      message Empty {}
      message SomeType {
        repeated Example data = 1;
      }
      message SomeExample {
        repeated OSOM data = 1;
      }
    `));
  });
});
