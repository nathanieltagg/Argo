'use strict';

function forEach (obj, fn, ctx) {
    if (Object.prototype.toString.call(fn) !== '[object Function]') {
        throw new TypeError('iterator must be a function');
    }
    var l = obj.length;
    if (l === +l) {
        for (var i = 0; i < l; i++) {
            fn.call(ctx, obj[i], i, obj);
        }
    } else {
        for (var k in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, k)) {
                fn.call(ctx, obj[k], k, obj);
            }
        }
    }
  }
/**
 * Convenience wrapper around the jsonpointer.
 * Calls `.get` when called with an `object` and a `pointer`.
 * Calls `.set` when also called with `value`.
 * If only supplied `object`, returns a partially applied function, mapped to the object.
 *
 * @param {Object} obj
 * @param {String|Array} pointer
 * @param value
 * @returns {*}
 */

function jsonpointer (obj, pointer, value) {
    // .set()
    if (arguments.length === 3) {
        return jsonpointer.set(obj, pointer, value);
    }
    // .get()
    if (arguments.length === 2) {
        return jsonpointer.get(obj, pointer);
    }
    // Return a partially applied function on `obj`.
    var wrapped = jsonpointer.bind(jsonpointer, obj);

    // Support for oo style
    for (var name in jsonpointer) {
        if (jsonpointer.hasOwnProperty(name)) {
            wrapped[name] = jsonpointer[name].bind(wrapped, obj);
        }
    }
    return wrapped;
}


/**
 * Lookup a json pointer in an object
 *
 * @param {Object} obj
 * @param {String|Array} pointer
 * @returns {*}
 */
jsonpointer.get = function get (obj, pointer) {
    var refTokens = Array.isArray(pointer) ? pointer : jsonpointer.parse(pointer);

    for (var i = 0; i < refTokens.length; ++i) {
        var tok = refTokens[i];
        if (!(typeof obj == 'object' && tok in obj)) {
            throw new Error('Invalid reference token: ' + tok);
        }
        obj = obj[tok];
    }
    return obj;
};

/**
 * Sets a value on an object
 *
 * @param {Object} obj
 * @param {String|Array} pointer
 * @param value
 */
jsonpointer.set = function set (obj, pointer, value) {
    var refTokens = Array.isArray(pointer) ? pointer : jsonpointer.parse(pointer),
      nextTok = refTokens[0];

    if (refTokens.length === 0) {
      throw Error('Can not set the root object');
    }

    for (var i = 0; i < refTokens.length - 1; ++i) {
        var tok = refTokens[i];
        if (tok === '-' && Array.isArray(obj)) {
          tok = obj.length;
        }
        nextTok = refTokens[i + 1];

        if (!(tok in obj)) {
            if (nextTok.match(/^(\d+|-)$/)) {
                obj[tok] = [];
            } else {
                obj[tok] = {};
            }
        }
        obj = obj[tok];
    }
    if (nextTok === '-' && Array.isArray(obj)) {
      nextTok = obj.length;
    }
    obj[nextTok] = value;
    return this;
};

/**
 * Removes an attribute
 *
 * @param {Object} obj
 * @param {String|Array} pointer
 */
jsonpointer.remove = function (obj, pointer) {
    var refTokens = Array.isArray(pointer) ? pointer : jsonpointer.parse(pointer);
    var finalToken = refTokens[refTokens.length -1];
    if (finalToken === undefined) {
        throw new Error('Invalid JSON pointer for remove: "' + pointer + '"');
    }

    var parent = jsonpointer.get(obj, refTokens.slice(0, -1));
    if (Array.isArray(parent)) {
      var index = +finalToken;
      if (finalToken === '' && isNaN(index)) {
        throw new Error('Invalid array index: "' + finalToken + '"');
      }

      Array.prototype.splice.call(parent, index, 1);
    } else {
      delete parent[finalToken];
    }
};

/**
 * Returns a (pointer -> value) dictionary for an object
 *
 * @param obj
 * @param {function} descend
 * @returns {}
 */
jsonpointer.dict = function dict (obj, descend) {
    var results = {};
    jsonpointer.walk(obj, function (value, pointer) {
        results[pointer] = value;
    }, descend);
    return results;
};

/**
 * Iterates over an object
 * Iterator: function (value, pointer) {}
 *
 * @param obj
 * @param {function} iterator
 * @param {function} descend
 */
jsonpointer.walk = function walk (obj, iterator, descend, maxdepth) {
    var refTokens = [];

    maxdepth = maxdepth || 1e99;
    descend = descend || function (value,depth) {
        if (depth > maxdepth) return false;
        var type = Object.prototype.toString.call(value);
        return type === '[object Object]' || type === '[object Array]';
    };
    
    (function next (cur,depth) {
        forEach(cur, function (value, key) {
            refTokens.push(String(key));
            if (descend(value,depth+1)) {
                next(value,depth+1);
            } else {
                iterator(value, jsonpointer.compile(refTokens));
            }
            refTokens.pop();
        });
    }(obj,1));
};

/**
 * Tests if an object has a value for a json pointer
 *
 * @param obj
 * @param pointer
 * @returns {boolean}
 */
jsonpointer.has = function has (obj, pointer) {
    try {
        jsonpointer.get(obj, pointer);
    } catch (e) {
        return false;
    }
    return true;
};

/**
 * Escapes a reference token
 *
 * @param str
 * @returns {string}
 */
jsonpointer.escape = function escape (str) {
    return str.toString().replace(/~/g, '~0').replace(/\//g, '~1');
};

/**
 * Unescapes a reference token
 *
 * @param str
 * @returns {string}
 */
jsonpointer.unescape = function unescape (str) {
    return str.replace(/~1/g, '/').replace(/~0/g, '~');
};

/**
 * Converts a json pointer into a array of reference tokens
 *
 * @param pointer
 * @returns {Array}
 */
jsonpointer.parse = function parse (pointer) {
    if (pointer === '') { return []; }
    if (pointer.charAt(0) !== '/') { throw new Error('Invalid JSON pointer: ' + pointer); }
    return pointer.substring(1).split(/\//).map(jsonpointer.unescape);
};

/**
 * Builds a json pointer from a array of reference tokens
 *
 * @param refTokens
 * @returns {string}
 */
jsonpointer.compile = function compile (refTokens) {
    if (refTokens.length === 0) { return ''; }
    return '/' + refTokens.map(jsonpointer.escape).join('/');
};
