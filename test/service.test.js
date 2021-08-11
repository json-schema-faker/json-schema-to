'use strict';

const expect = require('chai').expect;

const utils = require('./utils');
const Service = require('../lib/service');

/* global describe, it */

describe('Service class', () => {
  it('should handle given enumerations', () => {
    const service = Service.from({ id: 'Test' });
    const test = service.enumerate(['A', 'B', 'C']);

    expect(test.A).to.eql('A');
    expect(test[1]).to.eql('B');
    expect(() => test.X).to.throw(/Missing 'X' in/);
    expect(() => test[3]).to.throw(/Missing value for 'enum\[3\]'/);
  });

  it('should handle single-model repositories', () => {
    const PK = {
      id: 'PK',
      type: 'integer',
    };
    const Util = {
      definitions: {
        someEnum: {
          enum: ['A', 'B', 'C'],
        },
        someType: {
          type: 'integer',
        },
      },
    };
    const Value = {
      id: 'Value',
      type: 'object',
      properties: {
        name: {
          type: 'string',
        },
      },
    };
    const Other = {
      id: 'Other',
      type: 'object',
      properties: {
        list: {
          type: 'array',
          items: {
            $ref: 'Value',
          },
        },
      },
    };
    const Example = {
      id: 'Example',
      type: 'object',
      properties: {
        id: {
          $ref: 'PK',
        },
        type: {
          type: 'string',
        },
        value: {
          enum: ['foo', 'bar'],
        },
        model: {
          $ref: 'Value',
        },
      },
      service: {
        calls: [{
          get: 'getModel',
          resp: 'Example',
          input: {
            value: 'Value',
            self: 'Example',
          },
          required: ['Value'],
        }, {
          get: 'getModels',
          resp: 'Example',
          repeat: true,
        }],
      },
    };

    const model = Service.from(Example, [PK, Util, Value, Other]);

    expect(model.typescript.trim()).to.eql(utils.trim(`
      export type Example = {
        id?: PK;
        type?: string;
        value?: 'foo' | 'bar';
        model?: Value;
      };
      export type PK = number;
      export type Value = {
        name?: string;
      };
      export enum someEnum {
        A = 'A',
        B = 'B',
        C = 'C',
      }
      export type someType = number;
      export type Other = {
        list?: Value[];
      };
    `));
    expect(model.protobuf.trim()).to.eql(utils.trim(`
      syntax = "proto3";
      package API;
      service ExampleService {
        rpc getModel(GetModelInput) returns(Example);
        rpc getModels(Noop) returns(Example);
      }
      message GetModelInput {
        required Value value = 1;
        Example self = 2;
      }
      enum ExampleValue {
        foo = 0;
        bar = 1;
      }
      enum someEnum {
        A = 0;
        B = 1;
        C = 2;
      }
      message Example {
        int32 id = 1;
        string type = 2;
        ExampleValue value = 3;
        Value model = 4;
      }
      message Value {
        string name = 1;
      }
      message Other {
        repeated Value list = 1;
      }
    `));
    expect(model.graphql.trim()).to.eql(utils.trim(`
      extend type Query {
        getModel(value: Value!, self: Example = {}): Example
        getModels: Example
      }
      enum ExampleValue {
        foo
        bar
      }
      enum someEnum {
        A
        B
        C
      }
      input Example {
        id: Int
        type: String
        value: ExampleValue
        model: Value
      }
      input Value {
        name: String
      }
      type Other {
        list: [Value]
      }
    `));
  });
});
