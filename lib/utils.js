'use strict';

const __ref = Symbol('$ref');

function isReq(value, required) {
  if (Array.isArray(required) && required.indexOf(value) > -1) return true;
  if (required === true) return true;
  return false;
}

function copy(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(copy);
  return Object.keys(value).reduce((memo, cur) => {
    memo[cur] = copy(value[cur]);
    return memo;
  }, {});
}

function caps(value) {
  return value
    .replace(/(?:\b|^)([a-z])/g, ($0, $1) => $1.toUpperCase())
    .replace(/\W/g, '');
}

function trim(code) {
  const matches = code.match(/\n( )*/);

  if (!matches) {
    return code;
  }

  const spaces = matches[0].substr(0, matches[0].length - 1);
  const depth = spaces.split('').length;

  return code.replace(new RegExp(`^ {${depth}}`, 'mg'), '').trim();
}

function safe(value, separator) {
  separator = separator || '_';

  return value
    .replace(/([a-z])([A-Z])/g, `$1${separator}$2`)
    .replace(/[\s_-]+/g, separator);
}

function load(schemas, refs) {
  function get(id, ref) {
    if (ref === '#') {
      return schemas[id];
    }

    const [_id, _ref] = ref.split('#/definitions/');

    let sub = ref && !_ref ? schemas[ref] : schemas[id];
    if (sub && sub.definitions && _ref && !_id) {
      sub = sub.definitions[_ref];
    } else if (schemas[_id]) {
      if (_ref) {
        if (schemas[_id][__ref]) {
          sub = schemas[schemas[_id][__ref]];
        } else if (!(schemas[_id].definitions && schemas[_id].definitions[_ref])) {
          throw new Error(`Missing '${ref || id}' definition`);
        } else {
          sub = schemas[_id].definitions[_ref];
        }
      } else {
        sub = schemas[_id];
      }
    } else if (!sub) {
      throw new Error(`Missing '${ref || id}' definition`);
    }

    if (sub.$ref) sub = get(sub.id, sub.$ref);
    if (!sub.id && _ref) sub.id = _ref;
    return sub;
  }

  const scalars = ['string', 'number', 'integer', 'boolean', 'null'];
  const models = {};
  const calls = [];
  const $refs = {};

  function info(key, schema, required) {
    const _items = 'items' in schema;
    const _enum = 'enum' in schema;
    const _obj = _items ? schema.items : schema;

    let _ref = _obj[__ref] || _obj.type || schema.$ref;
    let _type = _obj.type;
    if (_ref && typeof _ref === 'object') {
      _type = _ref.type;
      _ref = _ref.id;
    }

    return {
      field: key,
      value: _ref,
      schema: _type,
      repeat: _items,
      exists: _ref in schemas,
      scalar: scalars.includes(_type),
      options: _enum ? schema.enum : null,
      required: required ? required.includes(key) : false,
    };
  }

  function group(key, schema, required) {
    return info(key, schema[key], required);
  }

  function make(obj) {
    if (obj[__ref]) {
      return { kind: 'ref', schema: obj[__ref] };
    }
    if (obj.enum) {
      return { kind: 'enum', options: obj.enum };
    }
    if (obj.items) {
      const ref = make(obj.items);

      ref.repeat = true;
      return ref;
    }
    if (obj.properties) {
      return { kind: 'type', schema: Object.keys(obj.properties).map(k => group(k, obj.properties, obj.required)) };
    }
    if (!(obj.definitions || obj.service)) {
      if (['object', 'array', 'null'].includes(obj.type)) {
        throw new TypeError(`Objects are disallowed, given '${JSON.stringify(obj, null, 2)}'`);
      }
      if (typeof obj.type === 'string') {
        return { kind: 'type', schema: obj.type };
      }
    }
  }

  function walk(schema, parent) {
    if (!schema || typeof schema !== 'object') return;
    if (!parent && schema.id) {
      parent = schema.id;
      models[parent] = schema;
      $refs[parent] = copy(schema);

      if (schema.service) {
        calls.push(...(schema.service.calls || []).map(call => ({ ...call, schema: parent })));
      }
    }

    if (schema.definitions) {
      walk(schema.definitions, parent);
      Object.assign(models, schema.definitions);
    }

    if (Array.isArray(schema)) {
      schema.forEach(x => walk(x, parent));
    } else if (typeof schema === 'object') {
      Object.keys(schema).forEach(key => {
        if (typeof schema[key] === 'object') {
          walk(schema[key], parent);
        } else if (key === '$ref') {
          const sub = get(parent, schema.$ref);

          if (sub) {
            if (sub.type && !['object', 'array'].includes(sub.type)) schema.type = sub.type;
            if (sub.id) {
              if (!models[sub.id]) models[sub.id] = sub;
              if (!schema.id) schema[__ref] = sub.id;
            }
            delete schema.$ref;
          }
        }
      });
    }
  }

  refs.forEach(ref => {
    schemas[ref.id] = ref;
  });
  walk(schemas);

  return {
    calls,
    $refs,
    models,
    generate(cb, pkg, _calls, _models, _callback) {
      const result = cb({ pkg, calls: _calls, models: _models }, make, _callback);
      if (typeof result !== 'string') return result;
      return `${result.trim()}\n`;
    },
    enumerate(set, _ref = 'enum') {
      if (!set || typeof set !== 'object') return set;
      return new Proxy(set, {
        get: (target, name) => {
          if (name === 'inspect') return target;
          if (name === 'length') return target.length;
          if (Symbol.iterator === name) return [][name].bind(target);
          if (Symbol.toStringTag === name) return '';
          if (typeof name === 'string') {
            if (/^-?\d+$/.test(name)) {
              if (typeof target[name] === 'undefined') {
                throw new Error(`Missing value for '${_ref}[${name}]'`);
              }
              return target[name];
            }
            if (!target.includes(name)) {
              throw new TypeError(`Missing '${name}' in '${target.join(' | ')}'`);
            }
            return name;
          }
          return target[name];
        },
      });
    },
  };
}

module.exports = {
  isReq,
  copy,
  caps,
  trim,
  safe,
  load,
};
