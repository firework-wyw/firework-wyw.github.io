 (function(factory){
 	// AMD
 	if( typeof define !== "undefined" && define["amd"] ){
 		define( ["exports"], factory.bind(window) );
 	// No module loader
 	}else{
 		factory( window["qtek"] = {} );
 	}

})(function(_exports){

/**
 * almond 0.2.5 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define('qtek/core/mixin/derive',['require'],function(require) {



/**
 * derive a sub class from base class
 * @makeDefaultOpt [Object|Function] default option of this sub class, 
                        method of the sub can use this.xxx to access this option
 * @initialize [Function](optional) initialize after the sub class is instantiated
 * @proto [Object](optional) prototype methods/property of the sub class
 *
 * @export{object}
 */
function derive(makeDefaultOpt, initialize/*optional*/, proto/*optional*/) {

    if (typeof initialize == "object") {
        proto = initialize;
        initialize = null;
    }

    var _super = this;

    var propList;
    if (! (makeDefaultOpt instanceof Function)) {
        // Optimize the property iterate if it have been fixed
        propList = [];
        for (var propName in makeDefaultOpt) {
            if (makeDefaultOpt.hasOwnProperty(propName)) {
                propList.push(propName);
            }
        }
    }

    var sub = function(options) {

        // call super constructor
        _super.call(this);

        if (makeDefaultOpt instanceof Function) {
            // call defaultOpt generate function each time
            // if it is a function, So we can make sure each 
            // property in the object is fresh
            extend(this, makeDefaultOpt.call(this));
        } else {
            extendWithPropList(this, makeDefaultOpt, propList);
        }
        
        if (options) {
            extend(this, options);
        }

        if (this.constructor === sub) {
            // initialize function will be called in the order of inherit
            var base = sub;
            var initializers = sub.__initializer__;
            for (var i = 0; i < initializers.length; i++) {
                initializers[i].call(this);
            }
        }
    };
    // save super constructor
    sub.__super__ = _super;
    // initialize function will be called after all the super constructor is called
    if (!_super.__initializer__) {
        sub.__initializer__ = [];
    } else {
        sub.__initializer__ = _super.__initializer__.slice();
    }
    if (initialize) {
        sub.__initializer__.push(initialize);
    }

    var Ctor = function() {};
    Ctor.prototype = _super.prototype;
    sub.prototype = new Ctor();
    sub.prototype.constructor = sub;
    extend(sub.prototype, proto);
    
    // extend the derive method as a static method;
    sub.derive = _super.derive;

    return sub;
}

function extend(target, source) {
    if (!source) {
        return;
    }
    for (var name in source) {
        if (source.hasOwnProperty(name)) {
            target[name] = source[name];
        }
    }
}

function extendWithPropList(target, source, propList) {
    for (var i = 0; i < propList.length; i++) {
        var propName = propList[i];
        target[propName] = source[propName];
    }   
}

return {
    derive : derive
}

});
define('qtek/core/mixin/notifier',[],function() {

    function Handler(action, context) {
        this.action = action;
        this.context = context;
    }

    return{
        trigger : function(name) {
            if (! this.hasOwnProperty('__handlers__')) {
                return;
            }
            if (!this.__handlers__.hasOwnProperty(name)) {
                return;
            }

            var hdls = this.__handlers__[name];
            var l = hdls.length, i = -1, args = arguments;
            // Optimize from backbone
            switch (args.length) {
                case 1: 
                    while (++i < l)
                        hdls[i].action.call(hdls[i].context);
                    return;
                case 2:
                    while (++i < l)
                        hdls[i].action.call(hdls[i].context, args[1]);
                    return;
                case 3:
                    while (++i < l)
                        hdls[i].action.call(hdls[i].context, args[1], args[2]);
                    return;
                case 4:
                    while (++i < l)
                        hdls[i].action.call(hdls[i].context, args[1], args[2], args[3]);
                    return;
                case 5:
                    while (++i < l)
                        hdls[i].action.call(hdls[i].context, args[1], args[2], args[3], args[4]);
                    return;
                default:
                    while (++i < l)
                        hdls[i].action.apply(hdls[i].context, Array.prototype.slice.call(args, 1));
                    return;
            }
        },
        
        on : function(name, action, context/*optional*/) {
            if (!name || !action) {
                return;
            }
            var handlers = this.__handlers__ || (this.__handlers__={});
            if (! handlers[name]) {
                handlers[name] = [];
            } else {
                if (this.has(name, action)) {
                    return;
                }   
            }
            var handler = new Handler(action, context || this);
            handlers[name].push(handler);

            return handler;
        },

        once : function(name, action, context) {
            if (!name || !action) {
                return;
            }
            var self = this;
            function wrapper() {
                self.off(name, wrapper);
                action.apply(this, arguments);
            }
            return this.on(name, wrapper, context);
        },

        // Alias of on('before')
        before : function(name, action, context/*optional*/) {
            if (!name || !action) {
                return;
            }
            name = 'before' + name;
            return this.on(name, action, context);
        },

        // Alias of on('after')
        after : function(name, action, context/*optional*/) {
            if (!name || !action) {
                return;
            }
            name = 'after' + name;
            return this.on(name, action, context);
        },

        // Alias of once('success')
        success : function(action, context/*optional*/) {
            return this.once('success', action, context);
        },

        // Alias of once('error')
        error : function() {
            return this.once('error', action, context);
        },

        off : function(name, action) {
            
            var handlers = this.__handlers__ || (this.__handlers__={});

            if (!action) {
                handlers[name] = [];
                return;
            }
            if (handlers[name]) {
                var hdls = handlers[name];
                // Splice is evil!!
                var retains = [];
                for (var i = 0; i < hdls.length; i++) {
                    if (action && hdls[i].action !== action) {
                        retains.push(hdls[i]);
                    }
                }
                handlers[name] = retains;
            } 
        },

        has : function(name, action) {
            var handlers = this.__handlers__;

            if (! handlers ||
                ! handlers[name]) {
                return false;
            }
            var hdls = handlers[name];
            for (var i = 0; i < hdls.length; i++) {
                if (hdls[i].action === action) {
                    return true;
                }
            }
        }
    }
    
});
define('qtek/core/util',['require'],function(require){
    
    var guid = 0;

	var util = {

		genGUID : function() {
			return ++guid;
		},

        relative2absolute : function(path, basePath) {
            if (!basePath || path.match(/^\//)) {
                return path;
            }
            var pathParts = path.split('/');
            var basePathParts = basePath.split('/');

            var item = pathParts[0];
            while(item === '.' || item === '..') {
                if (item === '..') {
                    basePathParts.pop();
                }
                pathParts.shift();
                item = pathParts[0];
            }
            return basePathParts.join('/') + '/' + pathParts.join('/');
        },

        extend : function(target, source) {
            if (source) {
                for (var name in source) {
                    if (source.hasOwnProperty(name)) {
                        target[name] = source[name];
                    }
                }
            }
            return target;
        },

        defaults : function(target, source) {
            if (source) {
                for (var propName in source) {
                    if (target[propName] === undefined) {
                        target[propName] = source[propName];
                    }
                }
            }
        },

        extendWithPropList : function(target, source, propList) {
            if (source) {
                for (var i = 0; i < propList.length; i++) {
                    var propName = propList[i];
                    target[propName] = source[propName];
                }
            }
            return target;
        },

        defaultsWithPropList : function(target, source, propList) {
            if (source) {
                for (var i = 0; i < propList.length; i++) {
                    var propName = propList[i];
                    if (target[propName] === undefined) {
                        target[propName] = source[propName];
                    }
                }
            }
            return target;
        },

        each : function(obj, iterator, context) {
            if (!(obj && iterator)) {
                return;
            }
            if (obj.forEach) {
                obj.forEach(iterator, context);
            } else if (obj.length === + obj.length) {
                for (var i = 0, len = obj.length; i < len; i++) {
                    iterator.call(context, obj[i], i, obj);
                }
            } else {
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        iterator.call(context, obj[key], key, obj);
                    }
                }
            }
        },

        isObject : function(obj) {
            return obj === Object(obj);
        },

        isArray : function(obj) {
            return obj instanceof Array;
        },

        // Can be TypedArray
        isArrayLike : function(obj) {
            if (!obj) {
                return false;
            } else {
                return obj.length === + obj.length;
            }
        },

        clone : function(obj) {
            if (!util.isObject(obj)) {
                return obj;
            } else if (util.isArray(obj)) {
                return obj.slice();
            } else if (util.isArrayLike(obj)) { // is typed array
                var ret = new obj.constructor(obj.length);
                for (var i = 0; i < obj.length; i++) {
                    ret[i] = obj[i];
                }
                return ret;
            } else {
                return util.extend({}, obj);
            }
        }
	}

    return util;
});
define('qtek/core/Base',['require','./mixin/derive','./mixin/notifier','./util'],function(require){

    var deriveMixin = require("./mixin/derive");
    var notifierMixin = require("./mixin/notifier");
    var util = require("./util");

    var Base = function(){
        this.__GUID__ = util.genGUID();
    }
    util.extend(Base, deriveMixin);
    util.extend(Base.prototype, notifierMixin);

    return Base;
});
/**
 * @fileoverview gl-matrix - High performance matrix and vector operations
 * @author Brandon Jones
 * @author Colin MacKenzie IV
 * @version 2.2.0
 */

/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */


(function(_global) {
  

  var shim = {};
  if (typeof(exports) === 'undefined') {
    if(typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
      shim.exports = {};
      define('glmatrix',[],function() {
        return shim.exports;
      });
    } else {
      // gl-matrix lives in a browser, define its namespaces in global
      shim.exports = typeof(window) !== 'undefined' ? window : _global;
    }
  }
  else {
    // gl-matrix lives in commonjs, define its namespaces in exports
    shim.exports = exports;
  }

  (function(exports) {
    /* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */


if(!GLMAT_EPSILON) {
    var GLMAT_EPSILON = 0.000001;
}

if(!GLMAT_ARRAY_TYPE) {
    var GLMAT_ARRAY_TYPE = (typeof Float32Array !== 'undefined') ? Float32Array : Array;
}

if(!GLMAT_RANDOM) {
    var GLMAT_RANDOM = Math.random;
}

/**
 * @class Common utilities
 * @name glMatrix
 */
var glMatrix = {};

/**
 * Sets the type of array used when creating new vectors and matricies
 *
 * @param {Type} type Array type, such as Float32Array or Array
 */
glMatrix.setMatrixArrayType = function(type) {
    GLMAT_ARRAY_TYPE = type;
}

if(typeof(exports) !== 'undefined') {
    exports.glMatrix = glMatrix;
}

var degree = Math.PI / 180;

/**
* Convert Degree To Radian
*
* @param {Number} Angle in Degrees
*/
glMatrix.toRadian = function(a){
     return a * degree;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 2 Dimensional Vector
 * @name vec2
 */

var vec2 = {};

/**
 * Creates a new, empty vec2
 *
 * @returns {vec2} a new 2D vector
 */
vec2.create = function() {
    var out = new GLMAT_ARRAY_TYPE(2);
    out[0] = 0;
    out[1] = 0;
    return out;
};

/**
 * Creates a new vec2 initialized with values from an existing vector
 *
 * @param {vec2} a vector to clone
 * @returns {vec2} a new 2D vector
 */
vec2.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(2);
    out[0] = a[0];
    out[1] = a[1];
    return out;
};

/**
 * Creates a new vec2 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @returns {vec2} a new 2D vector
 */
vec2.fromValues = function(x, y) {
    var out = new GLMAT_ARRAY_TYPE(2);
    out[0] = x;
    out[1] = y;
    return out;
};

/**
 * Copy the values from one vec2 to another
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the source vector
 * @returns {vec2} out
 */
vec2.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    return out;
};

/**
 * Set the components of a vec2 to the given values
 *
 * @param {vec2} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @returns {vec2} out
 */
vec2.set = function(out, x, y) {
    out[0] = x;
    out[1] = y;
    return out;
};

/**
 * Adds two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.add = function(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.subtract = function(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    return out;
};

/**
 * Alias for {@link vec2.subtract}
 * @function
 */
vec2.sub = vec2.subtract;

/**
 * Multiplies two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.multiply = function(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    return out;
};

/**
 * Alias for {@link vec2.multiply}
 * @function
 */
vec2.mul = vec2.multiply;

/**
 * Divides two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.divide = function(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    return out;
};

/**
 * Alias for {@link vec2.divide}
 * @function
 */
vec2.div = vec2.divide;

/**
 * Returns the minimum of two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.min = function(out, a, b) {
    out[0] = Math.min(a[0], b[0]);
    out[1] = Math.min(a[1], b[1]);
    return out;
};

/**
 * Returns the maximum of two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.max = function(out, a, b) {
    out[0] = Math.max(a[0], b[0]);
    out[1] = Math.max(a[1], b[1]);
    return out;
};

/**
 * Scales a vec2 by a scalar number
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec2} out
 */
vec2.scale = function(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    return out;
};

/**
 * Adds two vec2's after scaling the second operand by a scalar value
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec2} out
 */
vec2.scaleAndAdd = function(out, a, b, scale) {
    out[0] = a[0] + (b[0] * scale);
    out[1] = a[1] + (b[1] * scale);
    return out;
};

/**
 * Calculates the euclidian distance between two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} distance between a and b
 */
vec2.distance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1];
    return Math.sqrt(x*x + y*y);
};

/**
 * Alias for {@link vec2.distance}
 * @function
 */
vec2.dist = vec2.distance;

/**
 * Calculates the squared euclidian distance between two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} squared distance between a and b
 */
vec2.squaredDistance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1];
    return x*x + y*y;
};

/**
 * Alias for {@link vec2.squaredDistance}
 * @function
 */
vec2.sqrDist = vec2.squaredDistance;

/**
 * Calculates the length of a vec2
 *
 * @param {vec2} a vector to calculate length of
 * @returns {Number} length of a
 */
vec2.length = function (a) {
    var x = a[0],
        y = a[1];
    return Math.sqrt(x*x + y*y);
};

/**
 * Alias for {@link vec2.length}
 * @function
 */
vec2.len = vec2.length;

/**
 * Calculates the squared length of a vec2
 *
 * @param {vec2} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
vec2.squaredLength = function (a) {
    var x = a[0],
        y = a[1];
    return x*x + y*y;
};

/**
 * Alias for {@link vec2.squaredLength}
 * @function
 */
vec2.sqrLen = vec2.squaredLength;

/**
 * Negates the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a vector to negate
 * @returns {vec2} out
 */
vec2.negate = function(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    return out;
};

/**
 * Normalize a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a vector to normalize
 * @returns {vec2} out
 */
vec2.normalize = function(out, a) {
    var x = a[0],
        y = a[1];
    var len = x*x + y*y;
    if (len > 0) {
        //TODO: evaluate use of glm_invsqrt here?
        len = 1 / Math.sqrt(len);
        out[0] = a[0] * len;
        out[1] = a[1] * len;
    }
    return out;
};

/**
 * Calculates the dot product of two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} dot product of a and b
 */
vec2.dot = function (a, b) {
    return a[0] * b[0] + a[1] * b[1];
};

/**
 * Computes the cross product of two vec2's
 * Note that the cross product must by definition produce a 3D vector
 *
 * @param {vec3} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec3} out
 */
vec2.cross = function(out, a, b) {
    var z = a[0] * b[1] - a[1] * b[0];
    out[0] = out[1] = 0;
    out[2] = z;
    return out;
};

/**
 * Performs a linear interpolation between two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec2} out
 */
vec2.lerp = function (out, a, b, t) {
    var ax = a[0],
        ay = a[1];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec2} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec2} out
 */
vec2.random = function (out, scale) {
    scale = scale || 1.0;
    var r = GLMAT_RANDOM() * 2.0 * Math.PI;
    out[0] = Math.cos(r) * scale;
    out[1] = Math.sin(r) * scale;
    return out;
};

/**
 * Transforms the vec2 with a mat2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat2} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat2 = function(out, a, m) {
    var x = a[0],
        y = a[1];
    out[0] = m[0] * x + m[2] * y;
    out[1] = m[1] * x + m[3] * y;
    return out;
};

/**
 * Transforms the vec2 with a mat2d
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat2d} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat2d = function(out, a, m) {
    var x = a[0],
        y = a[1];
    out[0] = m[0] * x + m[2] * y + m[4];
    out[1] = m[1] * x + m[3] * y + m[5];
    return out;
};

/**
 * Transforms the vec2 with a mat3
 * 3rd vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat3} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat3 = function(out, a, m) {
    var x = a[0],
        y = a[1];
    out[0] = m[0] * x + m[3] * y + m[6];
    out[1] = m[1] * x + m[4] * y + m[7];
    return out;
};

/**
 * Transforms the vec2 with a mat4
 * 3rd vector component is implicitly '0'
 * 4th vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat4 = function(out, a, m) {
    var x = a[0], 
        y = a[1];
    out[0] = m[0] * x + m[4] * y + m[12];
    out[1] = m[1] * x + m[5] * y + m[13];
    return out;
};

/**
 * Perform some operation over an array of vec2s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
vec2.forEach = (function() {
    var vec = vec2.create();

    return function(a, stride, offset, count, fn, arg) {
        var i, l;
        if(!stride) {
            stride = 2;
        }

        if(!offset) {
            offset = 0;
        }
        
        if(count) {
            l = Math.min((count * stride) + offset, a.length);
        } else {
            l = a.length;
        }

        for(i = offset; i < l; i += stride) {
            vec[0] = a[i]; vec[1] = a[i+1];
            fn(vec, vec, arg);
            a[i] = vec[0]; a[i+1] = vec[1];
        }
        
        return a;
    };
})();

/**
 * Returns a string representation of a vector
 *
 * @param {vec2} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
vec2.str = function (a) {
    return 'vec2(' + a[0] + ', ' + a[1] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.vec2 = vec2;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 3 Dimensional Vector
 * @name vec3
 */

var vec3 = {};

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */
vec3.create = function() {
    var out = new GLMAT_ARRAY_TYPE(3);
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    return out;
};

/**
 * Creates a new vec3 initialized with values from an existing vector
 *
 * @param {vec3} a vector to clone
 * @returns {vec3} a new 3D vector
 */
vec3.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(3);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return out;
};

/**
 * Creates a new vec3 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} a new 3D vector
 */
vec3.fromValues = function(x, y, z) {
    var out = new GLMAT_ARRAY_TYPE(3);
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
};

/**
 * Copy the values from one vec3 to another
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the source vector
 * @returns {vec3} out
 */
vec3.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return out;
};

/**
 * Set the components of a vec3 to the given values
 *
 * @param {vec3} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} out
 */
vec3.set = function(out, x, y, z) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
};

/**
 * Adds two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.add = function(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.subtract = function(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
};

/**
 * Alias for {@link vec3.subtract}
 * @function
 */
vec3.sub = vec3.subtract;

/**
 * Multiplies two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.multiply = function(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    out[2] = a[2] * b[2];
    return out;
};

/**
 * Alias for {@link vec3.multiply}
 * @function
 */
vec3.mul = vec3.multiply;

/**
 * Divides two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.divide = function(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    out[2] = a[2] / b[2];
    return out;
};

/**
 * Alias for {@link vec3.divide}
 * @function
 */
vec3.div = vec3.divide;

/**
 * Returns the minimum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.min = function(out, a, b) {
    out[0] = Math.min(a[0], b[0]);
    out[1] = Math.min(a[1], b[1]);
    out[2] = Math.min(a[2], b[2]);
    return out;
};

/**
 * Returns the maximum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.max = function(out, a, b) {
    out[0] = Math.max(a[0], b[0]);
    out[1] = Math.max(a[1], b[1]);
    out[2] = Math.max(a[2], b[2]);
    return out;
};

/**
 * Scales a vec3 by a scalar number
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec3} out
 */
vec3.scale = function(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    out[2] = a[2] * b;
    return out;
};

/**
 * Adds two vec3's after scaling the second operand by a scalar value
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec3} out
 */
vec3.scaleAndAdd = function(out, a, b, scale) {
    out[0] = a[0] + (b[0] * scale);
    out[1] = a[1] + (b[1] * scale);
    out[2] = a[2] + (b[2] * scale);
    return out;
};

/**
 * Calculates the euclidian distance between two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} distance between a and b
 */
vec3.distance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2];
    return Math.sqrt(x*x + y*y + z*z);
};

/**
 * Alias for {@link vec3.distance}
 * @function
 */
vec3.dist = vec3.distance;

/**
 * Calculates the squared euclidian distance between two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} squared distance between a and b
 */
vec3.squaredDistance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2];
    return x*x + y*y + z*z;
};

/**
 * Alias for {@link vec3.squaredDistance}
 * @function
 */
vec3.sqrDist = vec3.squaredDistance;

/**
 * Calculates the length of a vec3
 *
 * @param {vec3} a vector to calculate length of
 * @returns {Number} length of a
 */
vec3.length = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2];
    return Math.sqrt(x*x + y*y + z*z);
};

/**
 * Alias for {@link vec3.length}
 * @function
 */
vec3.len = vec3.length;

/**
 * Calculates the squared length of a vec3
 *
 * @param {vec3} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
vec3.squaredLength = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2];
    return x*x + y*y + z*z;
};

/**
 * Alias for {@link vec3.squaredLength}
 * @function
 */
vec3.sqrLen = vec3.squaredLength;

/**
 * Negates the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to negate
 * @returns {vec3} out
 */
vec3.negate = function(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    return out;
};

/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to normalize
 * @returns {vec3} out
 */
vec3.normalize = function(out, a) {
    var x = a[0],
        y = a[1],
        z = a[2];
    var len = x*x + y*y + z*z;
    if (len > 0) {
        //TODO: evaluate use of glm_invsqrt here?
        len = 1 / Math.sqrt(len);
        out[0] = a[0] * len;
        out[1] = a[1] * len;
        out[2] = a[2] * len;
    }
    return out;
};

/**
 * Calculates the dot product of two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} dot product of a and b
 */
vec3.dot = function (a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
};

/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.cross = function(out, a, b) {
    var ax = a[0], ay = a[1], az = a[2],
        bx = b[0], by = b[1], bz = b[2];

    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
};

/**
 * Performs a linear interpolation between two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec3} out
 */
vec3.lerp = function (out, a, b, t) {
    var ax = a[0],
        ay = a[1],
        az = a[2];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    out[2] = az + t * (b[2] - az);
    return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec3} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec3} out
 */
vec3.random = function (out, scale) {
    scale = scale || 1.0;

    var r = GLMAT_RANDOM() * 2.0 * Math.PI;
    var z = (GLMAT_RANDOM() * 2.0) - 1.0;
    var zScale = Math.sqrt(1.0-z*z) * scale;

    out[0] = Math.cos(r) * zScale;
    out[1] = Math.sin(r) * zScale;
    out[2] = z * scale;
    return out;
};

/**
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec3} out
 */
vec3.transformMat4 = function(out, a, m) {
    var x = a[0], y = a[1], z = a[2];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    return out;
};

/**
 * Transforms the vec3 with a mat3.
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {mat4} m the 3x3 matrix to transform with
 * @returns {vec3} out
 */
vec3.transformMat3 = function(out, a, m) {
    var x = a[0], y = a[1], z = a[2];
    out[0] = x * m[0] + y * m[3] + z * m[6];
    out[1] = x * m[1] + y * m[4] + z * m[7];
    out[2] = x * m[2] + y * m[5] + z * m[8];
    return out;
};

/**
 * Transforms the vec3 with a quat
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {quat} q quaternion to transform with
 * @returns {vec3} out
 */
vec3.transformQuat = function(out, a, q) {
    // benchmarks: http://jsperf.com/quaternion-transform-vec3-implementations

    var x = a[0], y = a[1], z = a[2],
        qx = q[0], qy = q[1], qz = q[2], qw = q[3],

        // calculate quat * vec
        ix = qw * x + qy * z - qz * y,
        iy = qw * y + qz * x - qx * z,
        iz = qw * z + qx * y - qy * x,
        iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return out;
};

/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
vec3.forEach = (function() {
    var vec = vec3.create();

    return function(a, stride, offset, count, fn, arg) {
        var i, l;
        if(!stride) {
            stride = 3;
        }

        if(!offset) {
            offset = 0;
        }
        
        if(count) {
            l = Math.min((count * stride) + offset, a.length);
        } else {
            l = a.length;
        }

        for(i = offset; i < l; i += stride) {
            vec[0] = a[i]; vec[1] = a[i+1]; vec[2] = a[i+2];
            fn(vec, vec, arg);
            a[i] = vec[0]; a[i+1] = vec[1]; a[i+2] = vec[2];
        }
        
        return a;
    };
})();

/**
 * Returns a string representation of a vector
 *
 * @param {vec3} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
vec3.str = function (a) {
    return 'vec3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.vec3 = vec3;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 4 Dimensional Vector
 * @name vec4
 */

var vec4 = {};

/**
 * Creates a new, empty vec4
 *
 * @returns {vec4} a new 4D vector
 */
vec4.create = function() {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    return out;
};

/**
 * Creates a new vec4 initialized with values from an existing vector
 *
 * @param {vec4} a vector to clone
 * @returns {vec4} a new 4D vector
 */
vec4.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Creates a new vec4 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} a new 4D vector
 */
vec4.fromValues = function(x, y, z, w) {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = w;
    return out;
};

/**
 * Copy the values from one vec4 to another
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the source vector
 * @returns {vec4} out
 */
vec4.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Set the components of a vec4 to the given values
 *
 * @param {vec4} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} out
 */
vec4.set = function(out, x, y, z, w) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = w;
    return out;
};

/**
 * Adds two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.add = function(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    out[3] = a[3] + b[3];
    return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.subtract = function(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    out[3] = a[3] - b[3];
    return out;
};

/**
 * Alias for {@link vec4.subtract}
 * @function
 */
vec4.sub = vec4.subtract;

/**
 * Multiplies two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.multiply = function(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    out[2] = a[2] * b[2];
    out[3] = a[3] * b[3];
    return out;
};

/**
 * Alias for {@link vec4.multiply}
 * @function
 */
vec4.mul = vec4.multiply;

/**
 * Divides two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.divide = function(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    out[2] = a[2] / b[2];
    out[3] = a[3] / b[3];
    return out;
};

/**
 * Alias for {@link vec4.divide}
 * @function
 */
vec4.div = vec4.divide;

/**
 * Returns the minimum of two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.min = function(out, a, b) {
    out[0] = Math.min(a[0], b[0]);
    out[1] = Math.min(a[1], b[1]);
    out[2] = Math.min(a[2], b[2]);
    out[3] = Math.min(a[3], b[3]);
    return out;
};

/**
 * Returns the maximum of two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.max = function(out, a, b) {
    out[0] = Math.max(a[0], b[0]);
    out[1] = Math.max(a[1], b[1]);
    out[2] = Math.max(a[2], b[2]);
    out[3] = Math.max(a[3], b[3]);
    return out;
};

/**
 * Scales a vec4 by a scalar number
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec4} out
 */
vec4.scale = function(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    out[2] = a[2] * b;
    out[3] = a[3] * b;
    return out;
};

/**
 * Adds two vec4's after scaling the second operand by a scalar value
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec4} out
 */
vec4.scaleAndAdd = function(out, a, b, scale) {
    out[0] = a[0] + (b[0] * scale);
    out[1] = a[1] + (b[1] * scale);
    out[2] = a[2] + (b[2] * scale);
    out[3] = a[3] + (b[3] * scale);
    return out;
};

/**
 * Calculates the euclidian distance between two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} distance between a and b
 */
vec4.distance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2],
        w = b[3] - a[3];
    return Math.sqrt(x*x + y*y + z*z + w*w);
};

/**
 * Alias for {@link vec4.distance}
 * @function
 */
vec4.dist = vec4.distance;

/**
 * Calculates the squared euclidian distance between two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} squared distance between a and b
 */
vec4.squaredDistance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2],
        w = b[3] - a[3];
    return x*x + y*y + z*z + w*w;
};

/**
 * Alias for {@link vec4.squaredDistance}
 * @function
 */
vec4.sqrDist = vec4.squaredDistance;

/**
 * Calculates the length of a vec4
 *
 * @param {vec4} a vector to calculate length of
 * @returns {Number} length of a
 */
vec4.length = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2],
        w = a[3];
    return Math.sqrt(x*x + y*y + z*z + w*w);
};

/**
 * Alias for {@link vec4.length}
 * @function
 */
vec4.len = vec4.length;

/**
 * Calculates the squared length of a vec4
 *
 * @param {vec4} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
vec4.squaredLength = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2],
        w = a[3];
    return x*x + y*y + z*z + w*w;
};

/**
 * Alias for {@link vec4.squaredLength}
 * @function
 */
vec4.sqrLen = vec4.squaredLength;

/**
 * Negates the components of a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a vector to negate
 * @returns {vec4} out
 */
vec4.negate = function(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] = -a[3];
    return out;
};

/**
 * Normalize a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a vector to normalize
 * @returns {vec4} out
 */
vec4.normalize = function(out, a) {
    var x = a[0],
        y = a[1],
        z = a[2],
        w = a[3];
    var len = x*x + y*y + z*z + w*w;
    if (len > 0) {
        len = 1 / Math.sqrt(len);
        out[0] = a[0] * len;
        out[1] = a[1] * len;
        out[2] = a[2] * len;
        out[3] = a[3] * len;
    }
    return out;
};

/**
 * Calculates the dot product of two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} dot product of a and b
 */
vec4.dot = function (a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
};

/**
 * Performs a linear interpolation between two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec4} out
 */
vec4.lerp = function (out, a, b, t) {
    var ax = a[0],
        ay = a[1],
        az = a[2],
        aw = a[3];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    out[2] = az + t * (b[2] - az);
    out[3] = aw + t * (b[3] - aw);
    return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec4} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec4} out
 */
vec4.random = function (out, scale) {
    scale = scale || 1.0;

    //TODO: This is a pretty awful way of doing this. Find something better.
    out[0] = GLMAT_RANDOM();
    out[1] = GLMAT_RANDOM();
    out[2] = GLMAT_RANDOM();
    out[3] = GLMAT_RANDOM();
    vec4.normalize(out, out);
    vec4.scale(out, out, scale);
    return out;
};

/**
 * Transforms the vec4 with a mat4.
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec4} out
 */
vec4.transformMat4 = function(out, a, m) {
    var x = a[0], y = a[1], z = a[2], w = a[3];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
};

/**
 * Transforms the vec4 with a quat
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to transform
 * @param {quat} q quaternion to transform with
 * @returns {vec4} out
 */
vec4.transformQuat = function(out, a, q) {
    var x = a[0], y = a[1], z = a[2],
        qx = q[0], qy = q[1], qz = q[2], qw = q[3],

        // calculate quat * vec
        ix = qw * x + qy * z - qz * y,
        iy = qw * y + qz * x - qx * z,
        iz = qw * z + qx * y - qy * x,
        iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return out;
};

/**
 * Perform some operation over an array of vec4s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec4. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
vec4.forEach = (function() {
    var vec = vec4.create();

    return function(a, stride, offset, count, fn, arg) {
        var i, l;
        if(!stride) {
            stride = 4;
        }

        if(!offset) {
            offset = 0;
        }
        
        if(count) {
            l = Math.min((count * stride) + offset, a.length);
        } else {
            l = a.length;
        }

        for(i = offset; i < l; i += stride) {
            vec[0] = a[i]; vec[1] = a[i+1]; vec[2] = a[i+2]; vec[3] = a[i+3];
            fn(vec, vec, arg);
            a[i] = vec[0]; a[i+1] = vec[1]; a[i+2] = vec[2]; a[i+3] = vec[3];
        }
        
        return a;
    };
})();

/**
 * Returns a string representation of a vector
 *
 * @param {vec4} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
vec4.str = function (a) {
    return 'vec4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.vec4 = vec4;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 2x2 Matrix
 * @name mat2
 */

var mat2 = {};

/**
 * Creates a new identity mat2
 *
 * @returns {mat2} a new 2x2 matrix
 */
mat2.create = function() {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Creates a new mat2 initialized with values from an existing matrix
 *
 * @param {mat2} a matrix to clone
 * @returns {mat2} a new 2x2 matrix
 */
mat2.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Copy the values from one mat2 to another
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Set a mat2 to the identity matrix
 *
 * @param {mat2} out the receiving matrix
 * @returns {mat2} out
 */
mat2.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Transpose the values of a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.transpose = function(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
        var a1 = a[1];
        out[1] = a[2];
        out[2] = a1;
    } else {
        out[0] = a[0];
        out[1] = a[2];
        out[2] = a[1];
        out[3] = a[3];
    }
    
    return out;
};

/**
 * Inverts a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.invert = function(out, a) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],

        // Calculate the determinant
        det = a0 * a3 - a2 * a1;

    if (!det) {
        return null;
    }
    det = 1.0 / det;
    
    out[0] =  a3 * det;
    out[1] = -a1 * det;
    out[2] = -a2 * det;
    out[3] =  a0 * det;

    return out;
};

/**
 * Calculates the adjugate of a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.adjoint = function(out, a) {
    // Caching this value is nessecary if out == a
    var a0 = a[0];
    out[0] =  a[3];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] =  a0;

    return out;
};

/**
 * Calculates the determinant of a mat2
 *
 * @param {mat2} a the source matrix
 * @returns {Number} determinant of a
 */
mat2.determinant = function (a) {
    return a[0] * a[3] - a[2] * a[1];
};

/**
 * Multiplies two mat2's
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the first operand
 * @param {mat2} b the second operand
 * @returns {mat2} out
 */
mat2.multiply = function (out, a, b) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
    var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = a0 * b0 + a1 * b2;
    out[1] = a0 * b1 + a1 * b3;
    out[2] = a2 * b0 + a3 * b2;
    out[3] = a2 * b1 + a3 * b3;
    return out;
};

/**
 * Alias for {@link mat2.multiply}
 * @function
 */
mat2.mul = mat2.multiply;

/**
 * Rotates a mat2 by the given angle
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2} out
 */
mat2.rotate = function (out, a, rad) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
        s = Math.sin(rad),
        c = Math.cos(rad);
    out[0] = a0 *  c + a1 * s;
    out[1] = a0 * -s + a1 * c;
    out[2] = a2 *  c + a3 * s;
    out[3] = a2 * -s + a3 * c;
    return out;
};

/**
 * Scales the mat2 by the dimensions in the given vec2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the matrix to rotate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat2} out
 **/
mat2.scale = function(out, a, v) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
        v0 = v[0], v1 = v[1];
    out[0] = a0 * v0;
    out[1] = a1 * v1;
    out[2] = a2 * v0;
    out[3] = a3 * v1;
    return out;
};

/**
 * Returns a string representation of a mat2
 *
 * @param {mat2} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat2.str = function (a) {
    return 'mat2(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.mat2 = mat2;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 2x3 Matrix
 * @name mat2d
 * 
 * @description 
 * A mat2d contains six elements defined as:
 * <pre>
 * [a, b,
 *  c, d,
 *  tx,ty]
 * </pre>
 * This is a short form for the 3x3 matrix:
 * <pre>
 * [a, b, 0
 *  c, d, 0
 *  tx,ty,1]
 * </pre>
 * The last column is ignored so the array is shorter and operations are faster.
 */

var mat2d = {};

/**
 * Creates a new identity mat2d
 *
 * @returns {mat2d} a new 2x3 matrix
 */
mat2d.create = function() {
    var out = new GLMAT_ARRAY_TYPE(6);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    out[4] = 0;
    out[5] = 0;
    return out;
};

/**
 * Creates a new mat2d initialized with values from an existing matrix
 *
 * @param {mat2d} a matrix to clone
 * @returns {mat2d} a new 2x3 matrix
 */
mat2d.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(6);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    return out;
};

/**
 * Copy the values from one mat2d to another
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the source matrix
 * @returns {mat2d} out
 */
mat2d.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    return out;
};

/**
 * Set a mat2d to the identity matrix
 *
 * @param {mat2d} out the receiving matrix
 * @returns {mat2d} out
 */
mat2d.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    out[4] = 0;
    out[5] = 0;
    return out;
};

/**
 * Inverts a mat2d
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the source matrix
 * @returns {mat2d} out
 */
mat2d.invert = function(out, a) {
    var aa = a[0], ab = a[1], ac = a[2], ad = a[3],
        atx = a[4], aty = a[5];

    var det = aa * ad - ab * ac;
    if(!det){
        return null;
    }
    det = 1.0 / det;

    out[0] = ad * det;
    out[1] = -ab * det;
    out[2] = -ac * det;
    out[3] = aa * det;
    out[4] = (ac * aty - ad * atx) * det;
    out[5] = (ab * atx - aa * aty) * det;
    return out;
};

/**
 * Calculates the determinant of a mat2d
 *
 * @param {mat2d} a the source matrix
 * @returns {Number} determinant of a
 */
mat2d.determinant = function (a) {
    return a[0] * a[3] - a[1] * a[2];
};

/**
 * Multiplies two mat2d's
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the first operand
 * @param {mat2d} b the second operand
 * @returns {mat2d} out
 */
mat2d.multiply = function (out, a, b) {
    var aa = a[0], ab = a[1], ac = a[2], ad = a[3],
        atx = a[4], aty = a[5],
        ba = b[0], bb = b[1], bc = b[2], bd = b[3],
        btx = b[4], bty = b[5];

    out[0] = aa*ba + ab*bc;
    out[1] = aa*bb + ab*bd;
    out[2] = ac*ba + ad*bc;
    out[3] = ac*bb + ad*bd;
    out[4] = ba*atx + bc*aty + btx;
    out[5] = bb*atx + bd*aty + bty;
    return out;
};

/**
 * Alias for {@link mat2d.multiply}
 * @function
 */
mat2d.mul = mat2d.multiply;


/**
 * Rotates a mat2d by the given angle
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2d} out
 */
mat2d.rotate = function (out, a, rad) {
    var aa = a[0],
        ab = a[1],
        ac = a[2],
        ad = a[3],
        atx = a[4],
        aty = a[5],
        st = Math.sin(rad),
        ct = Math.cos(rad);

    out[0] = aa*ct + ab*st;
    out[1] = -aa*st + ab*ct;
    out[2] = ac*ct + ad*st;
    out[3] = -ac*st + ct*ad;
    out[4] = ct*atx + st*aty;
    out[5] = ct*aty - st*atx;
    return out;
};

/**
 * Scales the mat2d by the dimensions in the given vec2
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to translate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat2d} out
 **/
mat2d.scale = function(out, a, v) {
    var vx = v[0], vy = v[1];
    out[0] = a[0] * vx;
    out[1] = a[1] * vy;
    out[2] = a[2] * vx;
    out[3] = a[3] * vy;
    out[4] = a[4] * vx;
    out[5] = a[5] * vy;
    return out;
};

/**
 * Translates the mat2d by the dimensions in the given vec2
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to translate
 * @param {vec2} v the vec2 to translate the matrix by
 * @returns {mat2d} out
 **/
mat2d.translate = function(out, a, v) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4] + v[0];
    out[5] = a[5] + v[1];
    return out;
};

/**
 * Returns a string representation of a mat2d
 *
 * @param {mat2d} a matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat2d.str = function (a) {
    return 'mat2d(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + 
                    a[3] + ', ' + a[4] + ', ' + a[5] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.mat2d = mat2d;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 3x3 Matrix
 * @name mat3
 */

var mat3 = {};

/**
 * Creates a new identity mat3
 *
 * @returns {mat3} a new 3x3 matrix
 */
mat3.create = function() {
    var out = new GLMAT_ARRAY_TYPE(9);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 1;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    return out;
};

/**
 * Copies the upper-left 3x3 values into the given mat3.
 *
 * @param {mat3} out the receiving 3x3 matrix
 * @param {mat4} a   the source 4x4 matrix
 * @returns {mat3} out
 */
mat3.fromMat4 = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[4];
    out[4] = a[5];
    out[5] = a[6];
    out[6] = a[8];
    out[7] = a[9];
    out[8] = a[10];
    return out;
};

/**
 * Creates a new mat3 initialized with values from an existing matrix
 *
 * @param {mat3} a matrix to clone
 * @returns {mat3} a new 3x3 matrix
 */
mat3.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(9);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return out;
};

/**
 * Copy the values from one mat3 to another
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return out;
};

/**
 * Set a mat3 to the identity matrix
 *
 * @param {mat3} out the receiving matrix
 * @returns {mat3} out
 */
mat3.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 1;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    return out;
};

/**
 * Transpose the values of a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.transpose = function(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
        var a01 = a[1], a02 = a[2], a12 = a[5];
        out[1] = a[3];
        out[2] = a[6];
        out[3] = a01;
        out[5] = a[7];
        out[6] = a02;
        out[7] = a12;
    } else {
        out[0] = a[0];
        out[1] = a[3];
        out[2] = a[6];
        out[3] = a[1];
        out[4] = a[4];
        out[5] = a[7];
        out[6] = a[2];
        out[7] = a[5];
        out[8] = a[8];
    }
    
    return out;
};

/**
 * Inverts a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.invert = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        b01 = a22 * a11 - a12 * a21,
        b11 = -a22 * a10 + a12 * a20,
        b21 = a21 * a10 - a11 * a20,

        // Calculate the determinant
        det = a00 * b01 + a01 * b11 + a02 * b21;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = b01 * det;
    out[1] = (-a22 * a01 + a02 * a21) * det;
    out[2] = (a12 * a01 - a02 * a11) * det;
    out[3] = b11 * det;
    out[4] = (a22 * a00 - a02 * a20) * det;
    out[5] = (-a12 * a00 + a02 * a10) * det;
    out[6] = b21 * det;
    out[7] = (-a21 * a00 + a01 * a20) * det;
    out[8] = (a11 * a00 - a01 * a10) * det;
    return out;
};

/**
 * Calculates the adjugate of a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.adjoint = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8];

    out[0] = (a11 * a22 - a12 * a21);
    out[1] = (a02 * a21 - a01 * a22);
    out[2] = (a01 * a12 - a02 * a11);
    out[3] = (a12 * a20 - a10 * a22);
    out[4] = (a00 * a22 - a02 * a20);
    out[5] = (a02 * a10 - a00 * a12);
    out[6] = (a10 * a21 - a11 * a20);
    out[7] = (a01 * a20 - a00 * a21);
    out[8] = (a00 * a11 - a01 * a10);
    return out;
};

/**
 * Calculates the determinant of a mat3
 *
 * @param {mat3} a the source matrix
 * @returns {Number} determinant of a
 */
mat3.determinant = function (a) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8];

    return a00 * (a22 * a11 - a12 * a21) + a01 * (-a22 * a10 + a12 * a20) + a02 * (a21 * a10 - a11 * a20);
};

/**
 * Multiplies two mat3's
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the first operand
 * @param {mat3} b the second operand
 * @returns {mat3} out
 */
mat3.multiply = function (out, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        b00 = b[0], b01 = b[1], b02 = b[2],
        b10 = b[3], b11 = b[4], b12 = b[5],
        b20 = b[6], b21 = b[7], b22 = b[8];

    out[0] = b00 * a00 + b01 * a10 + b02 * a20;
    out[1] = b00 * a01 + b01 * a11 + b02 * a21;
    out[2] = b00 * a02 + b01 * a12 + b02 * a22;

    out[3] = b10 * a00 + b11 * a10 + b12 * a20;
    out[4] = b10 * a01 + b11 * a11 + b12 * a21;
    out[5] = b10 * a02 + b11 * a12 + b12 * a22;

    out[6] = b20 * a00 + b21 * a10 + b22 * a20;
    out[7] = b20 * a01 + b21 * a11 + b22 * a21;
    out[8] = b20 * a02 + b21 * a12 + b22 * a22;
    return out;
};

/**
 * Alias for {@link mat3.multiply}
 * @function
 */
mat3.mul = mat3.multiply;

/**
 * Translate a mat3 by the given vector
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to translate
 * @param {vec2} v vector to translate by
 * @returns {mat3} out
 */
mat3.translate = function(out, a, v) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],
        x = v[0], y = v[1];

    out[0] = a00;
    out[1] = a01;
    out[2] = a02;

    out[3] = a10;
    out[4] = a11;
    out[5] = a12;

    out[6] = x * a00 + y * a10 + a20;
    out[7] = x * a01 + y * a11 + a21;
    out[8] = x * a02 + y * a12 + a22;
    return out;
};

/**
 * Rotates a mat3 by the given angle
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat3} out
 */
mat3.rotate = function (out, a, rad) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        s = Math.sin(rad),
        c = Math.cos(rad);

    out[0] = c * a00 + s * a10;
    out[1] = c * a01 + s * a11;
    out[2] = c * a02 + s * a12;

    out[3] = c * a10 - s * a00;
    out[4] = c * a11 - s * a01;
    out[5] = c * a12 - s * a02;

    out[6] = a20;
    out[7] = a21;
    out[8] = a22;
    return out;
};

/**
 * Scales the mat3 by the dimensions in the given vec2
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to rotate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat3} out
 **/
mat3.scale = function(out, a, v) {
    var x = v[0], y = v[1];

    out[0] = x * a[0];
    out[1] = x * a[1];
    out[2] = x * a[2];

    out[3] = y * a[3];
    out[4] = y * a[4];
    out[5] = y * a[5];

    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return out;
};

/**
 * Copies the values from a mat2d into a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat2d} a the matrix to copy
 * @returns {mat3} out
 **/
mat3.fromMat2d = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = 0;

    out[3] = a[2];
    out[4] = a[3];
    out[5] = 0;

    out[6] = a[4];
    out[7] = a[5];
    out[8] = 1;
    return out;
};

/**
* Calculates a 3x3 matrix from the given quaternion
*
* @param {mat3} out mat3 receiving operation result
* @param {quat} q Quaternion to create matrix from
*
* @returns {mat3} out
*/
mat3.fromQuat = function (out, q) {
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        yx = y * x2,
        yy = y * y2,
        zx = z * x2,
        zy = z * y2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - yy - zz;
    out[3] = yx - wz;
    out[6] = zx + wy;

    out[1] = yx + wz;
    out[4] = 1 - xx - zz;
    out[7] = zy - wx;

    out[2] = zx - wy;
    out[5] = zy + wx;
    out[8] = 1 - xx - yy;

    return out;
};

/**
* Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
*
* @param {mat3} out mat3 receiving operation result
* @param {mat4} a Mat4 to derive the normal matrix from
*
* @returns {mat3} out
*/
mat3.normalFromMat4 = function (out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        // Calculate the determinant
        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;

    out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;

    out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;

    return out;
};

/**
 * Returns a string representation of a mat3
 *
 * @param {mat3} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat3.str = function (a) {
    return 'mat3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + 
                    a[3] + ', ' + a[4] + ', ' + a[5] + ', ' + 
                    a[6] + ', ' + a[7] + ', ' + a[8] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.mat3 = mat3;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 4x4 Matrix
 * @name mat4
 */

var mat4 = {};

/**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */
mat4.create = function() {
    var out = new GLMAT_ARRAY_TYPE(16);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
};

/**
 * Creates a new mat4 initialized with values from an existing matrix
 *
 * @param {mat4} a matrix to clone
 * @returns {mat4} a new 4x4 matrix
 */
mat4.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(16);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};

/**
 * Copy the values from one mat4 to another
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};

/**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */
mat4.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
};

/**
 * Transpose the values of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.transpose = function(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
        var a01 = a[1], a02 = a[2], a03 = a[3],
            a12 = a[6], a13 = a[7],
            a23 = a[11];

        out[1] = a[4];
        out[2] = a[8];
        out[3] = a[12];
        out[4] = a01;
        out[6] = a[9];
        out[7] = a[13];
        out[8] = a02;
        out[9] = a12;
        out[11] = a[14];
        out[12] = a03;
        out[13] = a13;
        out[14] = a23;
    } else {
        out[0] = a[0];
        out[1] = a[4];
        out[2] = a[8];
        out[3] = a[12];
        out[4] = a[1];
        out[5] = a[5];
        out[6] = a[9];
        out[7] = a[13];
        out[8] = a[2];
        out[9] = a[6];
        out[10] = a[10];
        out[11] = a[14];
        out[12] = a[3];
        out[13] = a[7];
        out[14] = a[11];
        out[15] = a[15];
    }
    
    return out;
};

/**
 * Inverts a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.invert = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        // Calculate the determinant
        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return out;
};

/**
 * Calculates the adjugate of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.adjoint = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    out[0]  =  (a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22));
    out[1]  = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
    out[2]  =  (a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12));
    out[3]  = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
    out[4]  = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
    out[5]  =  (a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22));
    out[6]  = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
    out[7]  =  (a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12));
    out[8]  =  (a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21));
    out[9]  = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
    out[10] =  (a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11));
    out[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
    out[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
    out[13] =  (a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21));
    out[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
    out[15] =  (a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11));
    return out;
};

/**
 * Calculates the determinant of a mat4
 *
 * @param {mat4} a the source matrix
 * @returns {Number} determinant of a
 */
mat4.determinant = function (a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32;

    // Calculate the determinant
    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
};

/**
 * Multiplies two mat4's
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the first operand
 * @param {mat4} b the second operand
 * @returns {mat4} out
 */
mat4.multiply = function (out, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    // Cache only the current line of the second matrix
    var b0  = b[0], b1 = b[1], b2 = b[2], b3 = b[3];  
    out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    return out;
};

/**
 * Alias for {@link mat4.multiply}
 * @function
 */
mat4.mul = mat4.multiply;

/**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to translate
 * @param {vec3} v vector to translate by
 * @returns {mat4} out
 */
mat4.translate = function (out, a, v) {
    var x = v[0], y = v[1], z = v[2],
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23,
        a30, a31, a32, a33;

        a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
        a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
        a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];
        a30 = a[12]; a31 = a[13]; a32 = a[14]; a33 = a[15];
    
    out[0] = a00 + a03*x;
    out[1] = a01 + a03*y;
    out[2] = a02 + a03*z;
    out[3] = a03;

    out[4] = a10 + a13*x;
    out[5] = a11 + a13*y;
    out[6] = a12 + a13*z;
    out[7] = a13;

    out[8] = a20 + a23*x;
    out[9] = a21 + a23*y;
    out[10] = a22 + a23*z;
    out[11] = a23;
    out[12] = a30 + a33*x;
    out[13] = a31 + a33*y;
    out[14] = a32 + a33*z;
    out[15] = a33;

    return out;
};
/**
 * Scales the mat4 by the dimensions in the given vec3
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to scale
 * @param {vec3} v the vec3 to scale the matrix by
 * @returns {mat4} out
 **/
mat4.scale = function(out, a, v) {
    var x = v[0], y = v[1], z = v[2];

    out[0] = a[0] * x;
    out[1] = a[1] * x;
    out[2] = a[2] * x;
    out[3] = a[3] * x;
    out[4] = a[4] * y;
    out[5] = a[5] * y;
    out[6] = a[6] * y;
    out[7] = a[7] * y;
    out[8] = a[8] * z;
    out[9] = a[9] * z;
    out[10] = a[10] * z;
    out[11] = a[11] * z;
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};

/**
 * Rotates a mat4 by the given angle
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @param {vec3} axis the axis to rotate around
 * @returns {mat4} out
 */
mat4.rotate = function (out, a, rad, axis) {
    var x = axis[0], y = axis[1], z = axis[2],
        len = Math.sqrt(x * x + y * y + z * z),
        s, c, t,
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23,
        b00, b01, b02,
        b10, b11, b12,
        b20, b21, b22;

    if (Math.abs(len) < GLMAT_EPSILON) { return null; }
    
    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;

    s = Math.sin(rad);
    c = Math.cos(rad);
    t = 1 - c;

    a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
    a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
    a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

    // Construct the elements of the rotation matrix
    b00 = x * x * t + c; b01 = y * x * t + z * s; b02 = z * x * t - y * s;
    b10 = x * y * t - z * s; b11 = y * y * t + c; b12 = z * y * t + x * s;
    b20 = x * z * t + y * s; b21 = y * z * t - x * s; b22 = z * z * t + c;

    // Perform rotation-specific matrix multiplication
    out[0] = a00 * b00 + a10 * b01 + a20 * b02;
    out[1] = a01 * b00 + a11 * b01 + a21 * b02;
    out[2] = a02 * b00 + a12 * b01 + a22 * b02;
    out[3] = a03 * b00 + a13 * b01 + a23 * b02;
    out[4] = a00 * b10 + a10 * b11 + a20 * b12;
    out[5] = a01 * b10 + a11 * b11 + a21 * b12;
    out[6] = a02 * b10 + a12 * b11 + a22 * b12;
    out[7] = a03 * b10 + a13 * b11 + a23 * b12;
    out[8] = a00 * b20 + a10 * b21 + a20 * b22;
    out[9] = a01 * b20 + a11 * b21 + a21 * b22;
    out[10] = a02 * b20 + a12 * b21 + a22 * b22;
    out[11] = a03 * b20 + a13 * b21 + a23 * b22;

    if (a !== out) { // If the source and destination differ, copy the unchanged last row
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }
    return out;
};

/**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
mat4.rotateX = function (out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    if (a !== out) { // If the source and destination differ, copy the unchanged rows
        out[0]  = a[0];
        out[1]  = a[1];
        out[2]  = a[2];
        out[3]  = a[3];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
};

/**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
mat4.rotateY = function (out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    if (a !== out) { // If the source and destination differ, copy the unchanged rows
        out[4]  = a[4];
        out[5]  = a[5];
        out[6]  = a[6];
        out[7]  = a[7];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
};

/**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
mat4.rotateZ = function (out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];

    if (a !== out) { // If the source and destination differ, copy the unchanged last row
        out[8]  = a[8];
        out[9]  = a[9];
        out[10] = a[10];
        out[11] = a[11];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[0] = a00 * c + a10 * s;
    out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s;
    out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s;
    out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s;
    out[7] = a13 * c - a03 * s;
    return out;
};

/**
 * Creates a matrix from a quaternion rotation and vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, vec);
 *     var quatMat = mat4.create();
 *     quat4.toMat4(quat, quatMat);
 *     mat4.multiply(dest, quatMat);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @param {vec3} v Translation vector
 * @returns {mat4} out
 */
mat4.fromRotationTranslation = function (out, q, v) {
    // Quaternion math
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        xy = x * y2,
        xz = x * z2,
        yy = y * y2,
        yz = y * z2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;
    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;
    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;
    
    return out;
};

mat4.fromQuat = function (out, q) {
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        yx = y * x2,
        yy = y * y2,
        zx = z * x2,
        zy = z * y2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - yy - zz;
    out[1] = yx + wz;
    out[2] = zx - wy;
    out[3] = 0;

    out[4] = yx - wz;
    out[5] = 1 - xx - zz;
    out[6] = zy + wx;
    out[7] = 0;

    out[8] = zx + wy;
    out[9] = zy - wx;
    out[10] = 1 - xx - yy;
    out[11] = 0;

    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;

    return out;
};

/**
 * Generates a frustum matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {Number} left Left bound of the frustum
 * @param {Number} right Right bound of the frustum
 * @param {Number} bottom Bottom bound of the frustum
 * @param {Number} top Top bound of the frustum
 * @param {Number} near Near bound of the frustum
 * @param {Number} far Far bound of the frustum
 * @returns {mat4} out
 */
mat4.frustum = function (out, left, right, bottom, top, near, far) {
    var rl = 1 / (right - left),
        tb = 1 / (top - bottom),
        nf = 1 / (near - far);
    out[0] = (near * 2) * rl;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = (near * 2) * tb;
    out[6] = 0;
    out[7] = 0;
    out[8] = (right + left) * rl;
    out[9] = (top + bottom) * tb;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (far * near * 2) * nf;
    out[15] = 0;
    return out;
};

/**
 * Generates a perspective projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fovy Vertical field of view in radians
 * @param {number} aspect Aspect ratio. typically viewport width/height
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
mat4.perspective = function (out, fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(fovy / 2),
        nf = 1 / (near - far);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) * nf;
    out[15] = 0;
    return out;
};

/**
 * Generates a orthogonal projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} left Left bound of the frustum
 * @param {number} right Right bound of the frustum
 * @param {number} bottom Bottom bound of the frustum
 * @param {number} top Top bound of the frustum
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
mat4.ortho = function (out, left, right, bottom, top, near, far) {
    var lr = 1 / (left - right),
        bt = 1 / (bottom - top),
        nf = 1 / (near - far);
    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 2 * nf;
    out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
};

/**
 * Generates a look-at matrix with the given eye position, focal point, and up axis
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {vec3} eye Position of the viewer
 * @param {vec3} center Point the viewer is looking at
 * @param {vec3} up vec3 pointing up
 * @returns {mat4} out
 */
mat4.lookAt = function (out, eye, center, up) {
    var x0, x1, x2, y0, y1, y2, z0, z1, z2, len,
        eyex = eye[0],
        eyey = eye[1],
        eyez = eye[2],
        upx = up[0],
        upy = up[1],
        upz = up[2],
        centerx = center[0],
        centery = center[1],
        centerz = center[2];

    if (Math.abs(eyex - centerx) < GLMAT_EPSILON &&
        Math.abs(eyey - centery) < GLMAT_EPSILON &&
        Math.abs(eyez - centerz) < GLMAT_EPSILON) {
        return mat4.identity(out);
    }

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;

    len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;

    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len) {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    } else {
        len = 1 / len;
        x0 *= len;
        x1 *= len;
        x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;

    len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
    if (!len) {
        y0 = 0;
        y1 = 0;
        y2 = 0;
    } else {
        len = 1 / len;
        y0 *= len;
        y1 *= len;
        y2 *= len;
    }

    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;

    return out;
};

/**
 * Returns a string representation of a mat4
 *
 * @param {mat4} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat4.str = function (a) {
    return 'mat4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' +
                    a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ', ' +
                    a[8] + ', ' + a[9] + ', ' + a[10] + ', ' + a[11] + ', ' + 
                    a[12] + ', ' + a[13] + ', ' + a[14] + ', ' + a[15] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.mat4 = mat4;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class Quaternion
 * @name quat
 */

var quat = {};

/**
 * Creates a new identity quat
 *
 * @returns {quat} a new quaternion
 */
quat.create = function() {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Sets a quaternion to represent the shortest rotation from one
 * vector to another.
 *
 * Both vectors are assumed to be unit length.
 *
 * @param {quat} out the receiving quaternion.
 * @param {vec3} a the initial vector
 * @param {vec3} b the destination vector
 * @returns {quat} out
 */
quat.rotationTo = (function() {
    var tmpvec3 = vec3.create();
    var xUnitVec3 = vec3.fromValues(1,0,0);
    var yUnitVec3 = vec3.fromValues(0,1,0);

    return function(out, a, b) {
        var dot = vec3.dot(a, b);
        if (dot < -0.999999) {
            vec3.cross(tmpvec3, xUnitVec3, a);
            if (vec3.length(tmpvec3) < 0.000001)
                vec3.cross(tmpvec3, yUnitVec3, a);
            vec3.normalize(tmpvec3, tmpvec3);
            quat.setAxisAngle(out, tmpvec3, Math.PI);
            return out;
        } else if (dot > 0.999999) {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            out[3] = 1;
            return out;
        } else {
            vec3.cross(tmpvec3, a, b);
            out[0] = tmpvec3[0];
            out[1] = tmpvec3[1];
            out[2] = tmpvec3[2];
            out[3] = 1 + dot;
            return quat.normalize(out, out);
        }
    };
})();

/**
 * Sets the specified quaternion with values corresponding to the given
 * axes. Each axis is a vec3 and is expected to be unit length and
 * perpendicular to all other specified axes.
 *
 * @param {vec3} view  the vector representing the viewing direction
 * @param {vec3} right the vector representing the local "right" direction
 * @param {vec3} up    the vector representing the local "up" direction
 * @returns {quat} out
 */
quat.setAxes = (function() {
    var matr = mat3.create();

    return function(out, view, right, up) {
        matr[0] = right[0];
        matr[3] = right[1];
        matr[6] = right[2];

        matr[1] = up[0];
        matr[4] = up[1];
        matr[7] = up[2];

        matr[2] = -view[0];
        matr[5] = -view[1];
        matr[8] = -view[2];

        return quat.normalize(out, quat.fromMat3(out, matr));
    };
})();

/**
 * Creates a new quat initialized with values from an existing quaternion
 *
 * @param {quat} a quaternion to clone
 * @returns {quat} a new quaternion
 * @function
 */
quat.clone = vec4.clone;

/**
 * Creates a new quat initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} a new quaternion
 * @function
 */
quat.fromValues = vec4.fromValues;

/**
 * Copy the values from one quat to another
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the source quaternion
 * @returns {quat} out
 * @function
 */
quat.copy = vec4.copy;

/**
 * Set the components of a quat to the given values
 *
 * @param {quat} out the receiving quaternion
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} out
 * @function
 */
quat.set = vec4.set;

/**
 * Set a quat to the identity quaternion
 *
 * @param {quat} out the receiving quaternion
 * @returns {quat} out
 */
quat.identity = function(out) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Sets a quat from the given angle and rotation axis,
 * then returns it.
 *
 * @param {quat} out the receiving quaternion
 * @param {vec3} axis the axis around which to rotate
 * @param {Number} rad the angle in radians
 * @returns {quat} out
 **/
quat.setAxisAngle = function(out, axis, rad) {
    rad = rad * 0.5;
    var s = Math.sin(rad);
    out[0] = s * axis[0];
    out[1] = s * axis[1];
    out[2] = s * axis[2];
    out[3] = Math.cos(rad);
    return out;
};

/**
 * Adds two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {quat} out
 * @function
 */
quat.add = vec4.add;

/**
 * Multiplies two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {quat} out
 */
quat.multiply = function(out, a, b) {
    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bx = b[0], by = b[1], bz = b[2], bw = b[3];

    out[0] = ax * bw + aw * bx + ay * bz - az * by;
    out[1] = ay * bw + aw * by + az * bx - ax * bz;
    out[2] = az * bw + aw * bz + ax * by - ay * bx;
    out[3] = aw * bw - ax * bx - ay * by - az * bz;
    return out;
};

/**
 * Alias for {@link quat.multiply}
 * @function
 */
quat.mul = quat.multiply;

/**
 * Scales a quat by a scalar number
 *
 * @param {quat} out the receiving vector
 * @param {quat} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {quat} out
 * @function
 */
quat.scale = vec4.scale;

/**
 * Rotates a quaternion by the given angle about the X axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
quat.rotateX = function (out, a, rad) {
    rad *= 0.5; 

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bx = Math.sin(rad), bw = Math.cos(rad);

    out[0] = ax * bw + aw * bx;
    out[1] = ay * bw + az * bx;
    out[2] = az * bw - ay * bx;
    out[3] = aw * bw - ax * bx;
    return out;
};

/**
 * Rotates a quaternion by the given angle about the Y axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
quat.rotateY = function (out, a, rad) {
    rad *= 0.5; 

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        by = Math.sin(rad), bw = Math.cos(rad);

    out[0] = ax * bw - az * by;
    out[1] = ay * bw + aw * by;
    out[2] = az * bw + ax * by;
    out[3] = aw * bw - ay * by;
    return out;
};

/**
 * Rotates a quaternion by the given angle about the Z axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
quat.rotateZ = function (out, a, rad) {
    rad *= 0.5; 

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bz = Math.sin(rad), bw = Math.cos(rad);

    out[0] = ax * bw + ay * bz;
    out[1] = ay * bw - ax * bz;
    out[2] = az * bw + aw * bz;
    out[3] = aw * bw - az * bz;
    return out;
};

/**
 * Calculates the W component of a quat from the X, Y, and Z components.
 * Assumes that quaternion is 1 unit in length.
 * Any existing W component will be ignored.
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate W component of
 * @returns {quat} out
 */
quat.calculateW = function (out, a) {
    var x = a[0], y = a[1], z = a[2];

    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = -Math.sqrt(Math.abs(1.0 - x * x - y * y - z * z));
    return out;
};

/**
 * Calculates the dot product of two quat's
 *
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {Number} dot product of a and b
 * @function
 */
quat.dot = vec4.dot;

/**
 * Performs a linear interpolation between two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {quat} out
 * @function
 */
quat.lerp = vec4.lerp;

/**
 * Performs a spherical linear interpolation between two quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {quat} out
 */
quat.slerp = function (out, a, b, t) {
    // benchmarks:
    //    http://jsperf.com/quaternion-slerp-implementations

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bx = b[0], by = b[1], bz = b[2], bw = b[3];

    var        omega, cosom, sinom, scale0, scale1;

    // calc cosine
    cosom = ax * bx + ay * by + az * bz + aw * bw;
    // adjust signs (if necessary)
    if ( cosom < 0.0 ) {
        cosom = -cosom;
        bx = - bx;
        by = - by;
        bz = - bz;
        bw = - bw;
    }
    // calculate coefficients
    if ( (1.0 - cosom) > 0.000001 ) {
        // standard case (slerp)
        omega  = Math.acos(cosom);
        sinom  = Math.sin(omega);
        scale0 = Math.sin((1.0 - t) * omega) / sinom;
        scale1 = Math.sin(t * omega) / sinom;
    } else {        
        // "from" and "to" quaternions are very close 
        //  ... so we can do a linear interpolation
        scale0 = 1.0 - t;
        scale1 = t;
    }
    // calculate final values
    out[0] = scale0 * ax + scale1 * bx;
    out[1] = scale0 * ay + scale1 * by;
    out[2] = scale0 * az + scale1 * bz;
    out[3] = scale0 * aw + scale1 * bw;
    
    return out;
};

/**
 * Calculates the inverse of a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate inverse of
 * @returns {quat} out
 */
quat.invert = function(out, a) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
        dot = a0*a0 + a1*a1 + a2*a2 + a3*a3,
        invDot = dot ? 1.0/dot : 0;
    
    // TODO: Would be faster to return [0,0,0,0] immediately if dot == 0

    out[0] = -a0*invDot;
    out[1] = -a1*invDot;
    out[2] = -a2*invDot;
    out[3] = a3*invDot;
    return out;
};

/**
 * Calculates the conjugate of a quat
 * If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate conjugate of
 * @returns {quat} out
 */
quat.conjugate = function (out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] = a[3];
    return out;
};

/**
 * Calculates the length of a quat
 *
 * @param {quat} a vector to calculate length of
 * @returns {Number} length of a
 * @function
 */
quat.length = vec4.length;

/**
 * Alias for {@link quat.length}
 * @function
 */
quat.len = quat.length;

/**
 * Calculates the squared length of a quat
 *
 * @param {quat} a vector to calculate squared length of
 * @returns {Number} squared length of a
 * @function
 */
quat.squaredLength = vec4.squaredLength;

/**
 * Alias for {@link quat.squaredLength}
 * @function
 */
quat.sqrLen = quat.squaredLength;

/**
 * Normalize a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quaternion to normalize
 * @returns {quat} out
 * @function
 */
quat.normalize = vec4.normalize;

/**
 * Creates a quaternion from the given 3x3 rotation matrix.
 *
 * NOTE: The resultant quaternion is not normalized, so you should be sure
 * to renormalize the quaternion yourself where necessary.
 *
 * @param {quat} out the receiving quaternion
 * @param {mat3} m rotation matrix
 * @returns {quat} out
 * @function
 */
quat.fromMat3 = function(out, m) {
    // Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
    // article "Quaternion Calculus and Fast Animation".
    var fTrace = m[0] + m[4] + m[8];
    var fRoot;

    if ( fTrace > 0.0 ) {
        // |w| > 1/2, may as well choose w > 1/2
        fRoot = Math.sqrt(fTrace + 1.0);  // 2w
        out[3] = 0.5 * fRoot;
        fRoot = 0.5/fRoot;  // 1/(4w)
        out[0] = (m[7]-m[5])*fRoot;
        out[1] = (m[2]-m[6])*fRoot;
        out[2] = (m[3]-m[1])*fRoot;
    } else {
        // |w| <= 1/2
        var i = 0;
        if ( m[4] > m[0] )
          i = 1;
        if ( m[8] > m[i*3+i] )
          i = 2;
        var j = (i+1)%3;
        var k = (i+2)%3;
        
        fRoot = Math.sqrt(m[i*3+i]-m[j*3+j]-m[k*3+k] + 1.0);
        out[i] = 0.5 * fRoot;
        fRoot = 0.5 / fRoot;
        out[3] = (m[k*3+j] - m[j*3+k]) * fRoot;
        out[j] = (m[j*3+i] + m[i*3+j]) * fRoot;
        out[k] = (m[k*3+i] + m[i*3+k]) * fRoot;
    }
    
    return out;
};

/**
 * Returns a string representation of a quatenion
 *
 * @param {quat} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
quat.str = function (a) {
    return 'quat(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.quat = quat;
}
;













  })(shim.exports);
})(this);

define('qtek/math/Vector2',['require','glmatrix'],function(require) {

    

    var glMatrix = require("glmatrix");
    var vec2 = glMatrix.vec2;

    var Vector2 = function(x, y) {
        
        x = x || 0;
        y = y || 0;

        this._array = vec2.fromValues(x, y);
        // Dirty flag is used by the Node to determine
        // if the matrix is updated to latest
        this._dirty = true;
    }

    Vector2.prototype = {

        constructor : Vector2,

        get x() {
            return this._array[0];
        },

        set x(value) {
            this._array[0] = value;
            this._dirty = true;
        },

        get y() {
            return this._array[1];
        },

        set y(value) {
            this._array[1] = value;
            this._dirty = true;
        },

        add : function(b) {
            vec2.add(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        set : function(x, y) {
            this._array[0] = x;
            this._array[1] = y;
            this._dirty = true;
            return this;
        },

        setArray : function(arr) {
            this._array[0] = arr[0];
            this._array[1] = arr[1];

            this._dirty = true;
            return this;
        },

        clone : function() {
            return new Vector2(this.x, this.y);
        },

        copy : function(b) {
            vec2.copy(this._array, b._array);
            this._dirty = true;
            return this;
        },

        cross : function(out, b) {
            vec2.cross(out._array, this._array, b._array);
            return this;
        },

        dist : function(b) {
            return vec2.dist(this._array, b._array);
        },

        distance : function(b) {
            return vec2.distance(this._array, b._array);
        },

        div : function(b) {
            vec2.div(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        divide : function(b) {
            vec2.divide(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        dot : function(b) {
            return vec2.dot(this._array, b._array);
        },

        len : function() {
            return vec2.len(this._array);
        },

        length : function() {
            return vec2.length(this._array);
        },
        /**
         * Perform linear interpolation between a and b
         */
        lerp : function(a, b, t) {
            vec2.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        min : function(b) {
            vec2.min(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        max : function(b) {
            vec2.max(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        mul : function(b) {
            vec2.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        multiply : function(b) {
            vec2.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        negate : function() {
            vec2.negate(this._array, this._array);
            this._dirty = true;
            return this;
        },

        normalize : function() {
            vec2.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },

        random : function(scale) {
            vec2.random(this._array, scale);
            this._dirty = true;
            return this;
        },

        scale : function(s) {
            vec2.scale(this._array, this._array, s);
            this._dirty = true;
            return this;
        },
        /**
         * add b by a scaled factor
         */
        scaleAndAdd : function(b, s) {
            vec2.scaleAndAdd(this._array, this._array, b._array, s);
            this._dirty = true;
            return this;
        },

        sqrDist : function(b) {
            return vec2.sqrDist(this._array, b._array);
        },

        squaredDistance : function(b) {
            return vec2.squaredDistance(this._array, b._array);
        },

        sqrLen : function() {
            return vec2.sqrLen(this._array);
        },

        squaredLength : function() {
            return vec2.squaredLength(this._array);
        },

        sub : function(b) {
            vec2.sub(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        subtract : function(b) {
            vec2.subtract(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        transformMat2 : function(m) {
            vec2.transformMat2(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },
        transformMat2d : function(m) {
            vec2.transformMat2d(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },
        transformMat3 : function(m) {
            vec2.transformMat3(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },
        transformMat4 : function(m) {
            vec2.transformMat4(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },

        toString : function() {
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        },
    }

    // Supply methods that are not in place
    Vector2.add = function(out, a, b) {
        vec2.add(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector2.set = function(out, x, y) {
        vec2.set(out._array, x, y);
        out._dirty = true;
    }

    Vector2.copy = function(out, b) {
        vec2.copy(out._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector2.cross = function(out, a, b) {
        vec2.cross(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector2.dist = function(a, b) {
        return vec2.distance(a._array, b._array);
    }

    Vector2.distance = Vector2.dist;

    Vector2.div = function(out, a, b) {
        vec2.divide(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector2.divide = Vector2.div;

    Vector2.dot = function(a, b) {
        return vec2.dot(a._array, b._array);
    }

    Vector2.len = function(b) {
        return vec2.length(b._array);
    }

    // Vector2.length = Vector2.len;

    Vector2.lerp = function(out, a, b, t) {
        vec2.lerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    }

    Vector2.min = function(out, a, b) {
        vec2.min(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector2.max = function(out, a, b) {
        vec2.max(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector2.mul = function(out, a, b) {
        vec2.multiply(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector2.multiply = Vector2.mul;

    Vector2.negate = function(out, a) {
        vec2.negate(out._array, a._array);
        out._dirty = true;
        return out;
    }

    Vector2.normalize = function(out, a) {
        vec2.normalize(out._array, a._array);
        out._dirty = true;
        return out;
    }

    Vector2.random = function(out, scale) {
        vec2.random(out._array, scale);
        out._dirty = true;
        return out;
    }

    Vector2.scale = function(out, a, scale) {
        vec2.scale(out._array, a._array, scale);
        out._dirty = true;
        return out;
    }

    Vector2.scaleAndAdd = function(out, a, b, scale) {
        vec2.scale(out._array, a._array, b._array, scale);
        out._dirty = true;
        return out;
    }

    Vector2.sqrDist = function(a, b) {
        return vec2.sqrDist(a._array, b._array);
    }

    Vector2.squaredDistance = Vector2.sqrDist;

    Vector2.sqrLen = function(a) {
        return vec2.sqrLen(a._array);
    }
    Vector2.squaredLength = Vector2.sqrLen;

    Vector2.sub = function(out, a, b) {
        vec2.subtract(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }
    Vector2.subtract = Vector2.sub;

    Vector2.transformMat2 = function(out, a, m) {
        vec2.transformMat2(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    }

    Vector2.transformMat2d = function(out, a, m) {
        vec2.transformMat2d(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    }

    Vector2.transformMat3 = function(out, a, m) {
        vec2.transformMat3(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    }

    Vector2.transformMat4 = function(out, a, m) {
        vec2.transformMat4(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    }

    return Vector2;

});
define('qtek/math/Matrix2d',['require','glmatrix'],function(require) {

    

    var glMatrix = require("glmatrix");
    var mat2d = glMatrix.mat2d;

    function makeProperty(n) {
        return {
            configurable : false,
            set : function(value) {
                this._array[n] = value;
                this._dirty = true;
            },
            get : function() {
                return this._array[n];
            }
        }
    }

    var Matrix2d = function() {

        this._array = mat2d.create();
    };

    Matrix2d.prototype = {

        constructor : Matrix2d,

        clone : function() {
            return (new Matrix2d()).copy(this);
        },
        copy : function(b) {
            mat2d.copy(this._array, b._array);
            return this;
        },
        determinant : function() {
            return mat2d.determinant(this._array);
        },
        identity : function() {
            mat2d.identity(this._array);
            return this;
        },
        invert : function() {
            mat2d.invert(this._array, this._array);
            return this;
        },
        mul : function(b) {
            mat2d.mul(this._array, this._array, b._array);
            return this;
        },
        mulLeft : function(b) {
            mat2d.mul(this._array, b._array, this._array);
            return this;
        },
        multiply : function(b) {
            mat2d.multiply(this._array, this._array, b._array);
            return this;
        },
        multiplyLeft : function(b) {
            mat2d.multiply(this._array, b._array, this._array);
            return this;
        },
        rotate : function(rad) {
            mat2d.rotate(this._array, this._array, rad);
            return this;
        },
        scale : function(s) {
            mat2d.scale(this._array, this._array, s._array);
        },
        translate : function(v) {
            mat2d.translate(this._array, this._array, v._array);
        },
        toString : function() {
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    Matrix2d.adjoint = function(out, a) {
        mat2d.adjoint(out._array, a._array);
        return out;
    }

    Matrix2d.copy = function(out, a) {
        mat2d.copy(out._array, a._array);
        return out;
    }

    Matrix2d.determinant = function(a) {
        return mat2d.determinant(a._array);
    }

    Matrix2d.identity = function(out) {
        mat2d.identity(out._array);
        return out;
    }

    Matrix2d.invert = function(out, a) {
        mat2d.invert(out._array, a._array);
        return out;
    }

    Matrix2d.mul = function(out, a, b) {
        mat2d.mul(out._array, a._array, b._array);
        return out;
    }

    Matrix2d.multiply = Matrix2d.mul;

    Matrix2d.rotate = function(out, a, rad) {
        mat2d.rotate(out._array, a._array, rad);
        return out;
    }

    Matrix2d.scale = function(out, a, v) {
        mat2d.scale(out._array, a._array, v._array);
        return out;
    }

    Matrix2d.translate = function(out, a, v) {
        mat2d.translate(out._array, a._array, v._array);
        return out;
    }

    return Matrix2d;
});
/**
 * Style
 * @config  fillStyle | fill,
 * @config  strokeStyle | stroke,
 * @config  lineWidth,
 * @config  lineCap,
 * @config  lineJoin,
 * @config  lineDash,
 * @config  lineDashOffset,
 * @config  miterLimit,
 * @config  shadowColor,
 * @config  shadowOffsetX,
 * @config  shadowOffsetY,
 * @config  shadowBlur,
 * @config  globalAlpha | alpha,
 * @config  globalCompositeOperation,
 * @config  alpha,
 * @config  shadow
 */
define('qtek/2d/Style',['require','../core/Base'],function(require) {
    
    var Base = require('../core/Base');

    var shadowSyntaxRegex = /([0-9\-]+)\s+([0-9\-]+)\s+([0-9]+)\s+(.+)/;
    
    var Style = Base.derive({}, {

        bind : function(ctx) {
            // Alias
            var fillStyle = this.fillStyle || this.fill;
            var strokeStyle = this.strokeStyle || this.stroke;
            var globalAlpha = this.globalAlpha || this.alpha;
            var globalCompositeOperation = this.globalCompositeOperation || this.composite;
            // parse shadow string
            if (this.shadow) {
                var res = shadowSyntaxRegex.exec(trim(this.shadow));
                if (res) {
                    var shadowOffsetX = parseInt(res[1]);
                    var shadowOffsetY = parseInt(res[2]);
                    var shadowBlur = res[3];
                    var shadowColor = res[4];
                }
            }
            shadowOffsetX = this.shadowOffsetX || shadowOffsetX;
            shadowOffsetY = this.shadowOffsetY || shadowOffsetY;
            shadowBlur = this.shadowBlur || shadowBlur;
            shadowColor = this.shadowColor || shadowColor;

            (globalAlpha !== undefined) &&
                (ctx.globalAlpha = globalAlpha);
            globalCompositeOperation &&
                (ctx.globalCompositeOperation = globalCompositeOperation);
            (this.lineWidth !== undefined) &&
                (ctx.lineWidth = this.lineWidth);
            (this.lineCap !== undefined) && 
                (ctx.lineCap = this.lineCap);
            (this.lineJoin !== undefined) &&
                (ctx.lineJoin = this.lineJoin);
            (this.miterLimit !== undefined) &&
                (ctx.miterLimit = this.miterLimit);
            (shadowOffsetX !== undefined) &&
                (ctx.shadowOffsetX = shadowOffsetX);
            (shadowOffsetY !== undefined) &&
                (ctx.shadowOffsetY = shadowOffsetY);
            (shadowBlur !== undefined) &&
                (ctx.shadowBlur = shadowBlur);
            (shadowColor !== undefined) &&
                (ctx.shadowColor = shadowColor);
            this.font &&
                (ctx.font = this.font);
            this.textAlign &&
                (ctx.textAlign = this.textAlign);
            this.textBaseline &&
                (ctx.textBaseline = this.textBaseline);

            if (fillStyle) {
                // Fill style is gradient or pattern
                if (fillStyle.getInstance) {
                    ctx.fillStyle = fillStyle.getInstance(ctx);
                } else {
                    ctx.fillStyle = fillStyle;
                }
            }
            if (strokeStyle) {
                // Stroke style is gradient or pattern
                if (strokeStyle.getInstance) {
                    ctx.strokeStyle = strokeStyle.getInstance(ctx);
                } else {
                    ctx.strokeStyle = strokeStyle;
                }
            }
            // Set line dash individually
            if (this.lineDash) {
                if (ctx.setLineDash) {
                    ctx.setLineDash(this.lineDash);
                    if (typeof(this.lineDashOffset) === 'number') {
                        ctx.lineDashOffset = this.lineDashOffset;
                    }
                } else {
                    console.warn("Browser does not support setLineDash method");
                }
            }
        }
    })

    function trim(str) {
        return (str || '').replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '');
    }

    return Style;
});
/**
 * Node of the scene tree
 * And it is the base class of all elements
 */
define('qtek/2d/Node',['require','../core/Base','../core/util','../math/Vector2','../math/Matrix2d','./Style','glmatrix'],function(require) {
    
    var Base = require("../core/Base");
    var util = require("../core/util");
    var Vector2 = require("../math/Vector2");
    var Matrix2d = require("../math/Matrix2d");
    var Style = require("./Style");

    var glMatrix = require('glmatrix');
    var mat2d = glMatrix.mat2d;
    var vec2 = glMatrix.vec2;

    var Node = Base.derive(function() {
        return {
            
            name : '',
            
            //Axis Aligned Bounding Box
            boundingBox : {
                min : new Vector2(),
                max : new Vector2()
            },
            // z index
            z : 0,
            
            style : null,
            
            position : new Vector2(0, 0),
            rotation : 0,
            scale : new Vector2(1, 1),

            autoUpdate : true,
            transform : new Matrix2d(),
            // inverse matrix of transform matrix
            transformInverse : new Matrix2d(),
            _prevRotation : 0,

            // visible flag
            visible : true,

            _children : [],
            // virtual width of the stroke line for intersect
            intersectLineWidth : 0,

            // Clip flag
            // If it is true, this element can be used as a mask
            // and all the children will be clipped in its shape
            //
            // TODO: add an other mask flag to distinguish with the clip?
            clip : false,

            // flag of fill when drawing the element
            fill : true,
            // flag of stroke when drawing the element
            stroke : false,
            // Enable picking
            enablePicking : true
        }
    }, {
        updateTransform : function() {
            var m2d = this.transform._array;
            if (! this.autoUpdate) {
                return;
            }
            if (! this.scale._dirty &&
                ! this.position._dirty &&
                this.rotation === this._prevRotation) {
                return;
            }
            mat2d.identity(m2d, m2d)
            mat2d.scale(m2d, m2d, this.scale._array);
            mat2d.rotate(m2d, m2d, this.rotation);
            mat2d.translate(m2d, m2d, this.position._array);

            this._prevRotation = this.rotation;
            this.scale._dirty = false;
            this.position._dirty = false;
        },
        updateTransformInverse : function() {
            mat2d.invert(this.transformInverse._array, this.transform._array);
        },
        // intersect with the bounding box
        intersectBoundingBox : function(x, y) {
            var boundingBox = this.boundingBox;
            return  (boundingBox.min.x < x && x < boundingBox.max.x) && (boundingBox.min.y < y && y< boundingBox.max.y);
        },
        add : function(elem) {
            if (elem) {
                this._children.push(elem);
                if (elem.parent) {
                    elem.parent.remove(elem);
                }
                elem.parent = this;
            }
        },
        remove : function(elem) {
            if (elem) {
                this._children.splice(this._children.indexOf(elem), 1);
                elem.parent = null;
            }
        },
        children : function() {
            // get a copy of children
            return this._children.slice();
        },
        childAt : function(idx) {
            return this._children[idx];
        },
        draw : null,

        render : function(context) {
            
            this.trigger("beforerender", context);

            var renderQueue = this.getSortedRenderQueue();
            if (this.style) {
                if (!this.style instanceof Array) {
                    for (var i = 0; i < this.style.length; i++) {
                        this.style[i].bind(context);
                    }
                } else if(this.style.bind) {
                    this.style.bind(context);
                }
            }
            // TODO : some style should not be inherited ?
            context.save();
            this.updateTransform();
            var m = this.transform._array;
            context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);

            if (this.draw) {
                this.trigger("beforedraw", context);
                this.draw(context);
                this.trigger("afterdraw", context);
            }

            //clip from current path;
            this.clip && context.clip();

            for (var i = 0; i < renderQueue.length; i++) {
                renderQueue[i].render(context);
            }
            context.restore();

            this.trigger("afterrender", context);
        },

        traverse : function(callback) {
            var stopTraverse = callback && callback(this);
            if (! stopTraverse) {
                var children = this._children;
                for (var i = 0, len = children.length; i < len; i++) {
                    children[i].traverse(callback);
                }
            }
        },

        intersect : function(x, y, eventName) {},

        // Get transformed bounding rect
        // getBoundingRect : function() {
        //     return {
        //         left : null,
        //         top : null,
        //         width : null,
        //         height : null
        //     }
        // },

        getSortedRenderQueue : function() {
            var renderQueue = this._children.slice();
            renderQueue.sort(_zSortFunction);
            return renderQueue; 
        }
    });

    function _zSortFunction(x, y) {
        if (x.z === y.z)
            return x.__GUID__ > y.__GUID__ ? 1 : -1;
        return x.z > y.z ? 1 : -1 ;
    }

    return Node;
});
define('qtek/2d/Camera',['require','./Node','../math/Matrix2d','glmatrix'],function(require) {

    var Node = require('./Node');
    var Matrix2d = require("../math/Matrix2d");
    var glMatrix = require('glmatrix');
    var mat2d = glMatrix.mat2d;

    var Camera = Node.derive(function() {
        return {
        }
    }, {
        getViewMatrix : function() {
            this.updateTransform();
            this.updateTransformInverse();
            return this.transformInverse;
        }
    });

    return Camera;
});
define('qtek/2d/CanvasRenderer',['require','../core/Base'],function(require) {

    var Base = require('../core/Base');

    var Renderer = Base.derive(function() {
        return {
            canvas : null,

            ctx : null,
            
            width : 0,
            
            height : 0,
            
        }
    }, function() {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
        }

        if (this.width) {
            this.canvas.width = this.width;
        } else {
            this.width = this.canvas.width;
        }
        if (this.height) {
            this.canvas.height = this.height;
        } else {
            this.height = this.canvas.height;
        }

        this.canvas.style.zIndex = this.z;

        this.ctx = this.canvas.getContext('2d');

        this.ctx.__GUID__ = this.__GUID__;
    }, {

        resize : function(width, height) {
            this.canvas.width = width;
            this.canvas.height = height;

            this.width = width;
            this.height = height;
        },

        render : function(scene, camera) {
            if (this.clearColor) {
                this.ctx.fillStyle = this.clearColor;
                this.ctx.fillRect(0, 0, this.width, this.height);
            } else {
                this.ctx.clearRect(0, 0, this.width, this.height);
            }
            if (camera) {
                var vm = camera.getViewMatrix()._array;
                this.ctx.transform(vm[0], vm[1], vm[2], vm[3], vm[4], vm[5]);   
            }
            scene.render(this.ctx);
        }
    });

    return Renderer;
});
define('qtek/core/Cache',[],function() {

    var Cache = function() {

        this._contextId = 0;

        this._caches = [];

        this._context = {};
    }

    Cache.prototype = {

        use : function(contextId, documentSchema) {

            if (! this._caches[contextId]) {
                this._caches[contextId] = {};

                if (documentSchema) {
                    this._caches[contextId] = documentSchema();
                }
            }
            this._contextId = contextId;

            this._context = this._caches[contextId];
        },

        put : function(key, value) {
            this._context[key] = value;
        },

        get : function(key) {
            return this._context[key];
        },

        dirty : function(field) {
            field = field || "";
            var key = "__dirty__" + field;
            this.put(key, true)
        },
        
        dirtyAll : function(field) {
            field = field || "";
            var key = "__dirty__" + field;
            for (var i = 0; i < this._caches.length; i++) {
                if (this._caches[i]) {
                    this._caches[i][key] = true;
                }
            }
        },

        fresh : function(field) {
            field = field || "";
            var key = "__dirty__" + field;
            this.put(key, false);
        },

        freshAll : function(field) {
            field = field || "";
            var key = "__dirty__" + field;
            for (var i = 0; i < this._caches.length; i++) {
                if (this._caches[i]) {
                    this._caches[i][key] = false;
                }
            }
        },

        isDirty : function(field) {
            field = field || "";
            var key = "__dirty__" + field;
            return  !this._context.hasOwnProperty(key)
                    || this._context[key] === true
        },

        clearContext : function() {
            this._caches[this._contextId] = {};
            this._context = {};
        },

        deleteContext : function(contextId) {
            this._caches[contextId] = {};
            this._context = {};
        },

        'delete' : function(key) {
            delete this._context[key];
        },

        clearAll : function() {
            this._caches = {};
        },

        getContext : function() {
            return this._context;
        },

        miss : function(key) {
            return ! this._context.hasOwnProperty(key);
        }
    }

    Cache.prototype.constructor = Cache;

    return Cache;

});
/**
 * Adapter to CanvasGradient
 * base of linear gradient and radial gradient
 *
 * @export{class} Gradient
 */
define('qtek/2d/Gradient',['require','../core/Base','../math/Vector2','../core/Cache'],function(require) {

    var Base = require('../core/Base');
    var Vector2 = require("../math/Vector2");
    var Cache = require("../core/Cache");

    var Gradient = Base.derive(function(){
        return {
            stops : []
        }
    }, function() {
        this.cache = new Cache();
    }, {
        addColorStop : function(offset, color){
            this.stops.push([offset, color]);
            this.dirty();
        },
        removeAt : function(idx){
            this.stops.splice(idx, 1);
            this.dirty();
        },
        dirty : function(){
            for (var contextId in this.cache._caches){
                this.cache._caches[contextId]['dirty'] = true;
            }
        },
        getInstance : function(ctx){
            this.cache.use(ctx.__GUID__);
            if (this.cache.get("dirty") ||
                this.cache.miss("gradient")) {
                this.update(ctx);
            }
            return this.cache.get("gradient");
        },
        update : function(ctx){}
    });

    return Gradient;
});
/**
 * Adapter to CanvasLinearGradient
 *
 * @export{class} LinearGradient
 */
define('qtek/2d/LinearGradient',['require','./Gradient','../math/Vector2'],function(require) {

    var Gradient = require('./Gradient');
    var Vector2 = require("../math/Vector2");

    var LinearGradient = Gradient.derive(function(){
        return {
            start : new Vector2(),
            end : new Vector2(100, 0)
        }
    }, {
        update : function(ctx){
            var gradient = ctx.createLinearGradient(this.start.x, this.start.y, this.end.x, this.end.y);
            for (var i = 0; i < this.stops.length; i++) {
                var stop = this.stops[i];
                gradient.addColorStop(stop[0], stop[1]);
            }
            this.cache.put('gradient', gradient);
        }
    });

    return LinearGradient;
});
/**
 * Adapter to CanvasPattern
 *
 * @export{class} Pattern
 */
define('qtek/2d/Pattern',['require','../core/Base','../math/Vector2','../core/Cache'],function(require) {

    var Base = require('../core/Base');
    var Vector2 = require("../math/Vector2");
    var Cache = require("../core/Cache");

    var Pattern = Base.derive(function(){
        return {
            image : null,
            // 'repeat', 'repeat-x', 'repeat-y', 'no-repeat'
            repetition : 'repeat'
        }
    }, function() {
        this.cache = new Cache();
    }, {
        getInstance : function(ctx){
            this.cache.use(ctx.__GUID__);
            if (this.cache.get("dirty") ||
                this.cache.miss("pattern")) {
                var pattern = ctx.createPattern(this.image, this.repetition);
                this.cache.put("pattern", pattern);
                return pattern;
            }
            return this.cache.get("pattern");
        },
    });

    return Pattern;
});
/**
 * Adapter to CanvasRadialGradient
 *
 * @export{class} RadialGradient
 */
define('qtek/2d/RadialGradient',['require','./Gradient','../math/Vector2'],function(require) {

    var Gradient = require('./Gradient');
    var Vector2 = require("../math/Vector2");

    var RadialGradient = Gradient.derive(function(){
        return {
            start : new Vector2(),
            startRadius : 0,
            end : new Vector2(),
            endRadius : 0
        }
    }, {
        update : function(ctx){
            var gradient = ctx.createRadialGradient(this.start.x, this.start.y, this.startRadius, this.end.x, this.end.y, this.endRadius);
            for (var i = 0; i < this.stops.length; i++) {
                var stop = this.stops[i];
                gradient.addColorStop(stop[0], stop[1]);
            }
            this.cache.put('gradient', gradient);
        }
    });

    return RadialGradient;
});
define('qtek/2d/Scene',['require','./Node'],function(require) {

    var Node = require('./Node');

    var Scene = Node.derive(function() {
        return {
        }
    }, {

    });

    return Scene;
});
;
define("qtek/2d/picking/Box", function(){});

define('qtek/2d/picking/Pixel',['require','../../core/Base'],function(require) {

    var Base = require('../../core/Base');

    var PixelPicking = Base.derive(function() {

        return {
            downSampleRatio : 1,
            width : 100,
            height : 100,

            lookupOffset : 1,

            _canvas : null,
            _context : null,
            _imageData : null,

            _lookupTable : [],
        }

    }, function(){
        this.init();
    }, {
        init : function() {
            var canvas = document.createElement("canvas");
            this._canvas = canvas;
            this._context = canvas.getContext("2d");

            this.resize(this.width, this.height);
        },
        setPrecision : function(ratio) {
            this._canvas.width = this.width * ratio;
            this._canvas.height = this.height * ratio;
            this.downSampleRatio = ratio;
        },
        resize : function(width, height) {
            this._canvas.width = width * this.downSampleRatio;
            this._canvas.height = height * this.downSampleRatio;
            this.width = width;
            this.height = height;
        },
        update : function(scene, camera) {
            var ctx = this._context;
            ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
            ctx.save();
            ctx.scale(this.downSampleRatio, this.downSampleRatio);
            this._lookupTable.length = 0;
            if (camera) {
                var vm = camera.getViewMatrix()._array;
                ctx.transform(vm[0], vm[1], vm[2], vm[3], vm[4], vm[5]);   
            }
            this._renderNode(scene, ctx);
            ctx.restore();
            // Cache the image data
            // Get image data is slow
            // http://jsperf.com/getimagedata-multi-vs-once
            var imageData = ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
            this._imageData = imageData.data;
        },
        _renderNode : function(node, ctx) {
            ctx.save();
            node.updateTransform();
            var m = node.transform._array;
            ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
            node.clip && ctx.clip();

            if (node.draw && node.enablePicking === true) {
                var lut = this._lookupTable;
                var rgb = packID(lut.length + this.lookupOffset);
                var color = 'rgb(' + rgb.join(',') + ')';
                this._lookupTable.push(node);
                
                ctx.fillStyle = color;
                ctx.strokeStyle = color;
                node.draw(ctx, true);
            }
            var renderQueue = node.getSortedRenderQueue();
            for (var i = 0; i < renderQueue.length; i++) {
                var child = renderQueue[i];
                this._renderNode(child, ctx);
            }
            ctx.restore();
        },
        pick : function(x, y) {
            var ratio = this.downSampleRatio;
            var width = this._canvas.width;
            var height = this._canvas.height;
            x = Math.ceil(ratio * x);
            y = Math.ceil(ratio * y);

            // Box sampler, to avoid the problem of anti aliasing
            var ids = [
                this._sample(x, y),
                this._sample(x-1, y),
                this._sample(x+1, y),
                this._sample(x, y-1),
                this._sample(x, y+1),
            ];
            var count = {};
            var max = 0;
            var maxId;
            for (var i = 0; i < ids.length; i++) {
                var id = ids[i];
                if (!count[id]) {
                    count[id]  = 1;
                } else {
                    count[id] ++;
                }
                if (count[id] > max) {
                    max = count[id];
                    maxId = id;
                }
            }

            var id = maxId - this.lookupOffset;

            if (id && max >=2) {
                var el = this._lookupTable[id];
                return el;
            }
        },

        _sample : function(x, y) {
            x = Math.max(Math.min(x, this._canvas.width), 1);
            y = Math.max(Math.min(y, this._canvas.height), 1);
            var offset = ((y-1) * this._canvas.width + (x-1))*4;
            var data = this._imageData;
            var r = data[offset];
            var g = data[offset+1];
            var b = data[offset+2];

            return unpackID(r, g, b);
        }
    });


    function packID(id){
        var r = id >> 16;
        var g = (id - (r << 8)) >> 8;
        var b = id - (r << 16) - (g<<8);
        return [r, g, b];
    }

    function unpackID(r, g, b){
        return (r << 16) + (g<<8) + b;
    }

    return PixelPicking;
});
define('qtek/2d/shape/Arc',['require','../Node','../../math/Vector2'],function(require){

    var Node = require('../Node');
    var Vector2 = require("../../math/Vector2");

    var Arc = Node.derive(function() {
        return {
            center      : new Vector2(),
            radius      : 0,
            startAngle  : 0,
            endAngle    : Math.PI*2,
            clockwise   : true
        }
    }, {
        computeBoundingBox : function() {
             util.computeArcBoundingBox(
                this.center, this.radius, this.startAngle, 
                this.endAngle, this.clockwise,
                this.boundingBox.min, this.boundingBox.max
            );
        },
        draw : function(contex) {

            ctx.beginPath();
            ctx.arc(this.center.x, this.center.y, this.radius, this.startAngle, this.endAngle,  ! this.clockwise);
            if (this.stroke) {
                ctx.stroke();
            }
            if (this.fill) {
                ctx.fill();
            }   
        },
        intersect : function(x, y){
            // TODO
            return false;
        }
    })

    return Arc;
});
define('qtek/2d/shape/Circle',['require','../Node','../../math/Vector2'],function(require){

    var Node = require('../Node');
    var Vector2 = require("../../math/Vector2");

    var Circle = Node.derive(function() {
        return {
            center : new Vector2(),
            radius : 0   
        }

    }, {
        computeBoundingBox : function() {
            this.boundingBox = {
                min : new Vector2(this.center.x-this.radius, this.center.y-this.radius),
                max : new Vector2(this.center.x+this.radius, this.center.y+this.radius)
            }
        },
        draw : function(ctx) {

            ctx.beginPath();
            ctx.arc(this.center.x, this.center.y, this.radius, 0, 2*Math.PI, false);
            
            if (this.stroke) {
                ctx.stroke();
            }
            if (this.fill) {
                ctx.fill();
            }
        },
        intersect : function() {

            return vec2.len([this.center[0]-x, this.center[1]-y]) < this.radius;
        }
    } )

    return Circle;
});
define('qtek/2d/shape/Ellipse',['require','../Node','../../math/Vector2'],function(require){

    var Node = require('../Node');
    var Vector2 = require("../../math/Vector2");

    var Ellipse = Node.derive(function() {
        return {
            center : new Vector2(),
            radius : new Vector2()   
        }

    }, {
        computeBoundingBox : function() {
            this.boundingBox = {
                min : this.center.clone().sub(this.radius),
                max : this.center.clone().add(this.radius)
            }
        },
        draw : function(ctx) {
            ctx.save();
            ctx.translate(this.center.x, this.center.y);
            ctx.scale(1, this.radius.y / this.radius.x);
            ctx.beginPath();
            ctx.arc(0, 0, this.radius.x, 0, 2*Math.PI, false);
            
            if (this.stroke) {
                ctx.stroke();
            }
            if (this.fill) {
                ctx.fill();
            }
            ctx.restore();
        },
        intersect : function() {

            return vec2.len([this.center[0]-x, this.center[1]-y]) < this.radius;
        }
    } )

    return Ellipse;
});
/**
 * https://developer.mozilla.org/en-US/docs/HTML/Canvas/Drawing_DOM_objects_into_a_canvas
 * @export{class} HTML
 */
define('qtek/2d/shape/HTML',['require','../Node'],function(require){

    var Node = require("../Node");

    var tpl = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">\
                    <foreignObject>\
                        {html}\
                    </foreignObject>';

    var HTML = Node.derive(function() {
        return {
            // html string
            html : '',

            _img : null
        }
    }, {
        draw : function(ctx){
            
            var html = this.html;
            var svg = tpl.replace('{html}', html);

            if (!this._img) {
                this.update();
            }

            if (this._img.complete) {
                ctx.drawImage(this._img, 0, 0);
            }
        },

        update : function(){
            var _blob = new Blob([svg], {type:'image/svg+xml;charset=utf-8'});
            var img = new Image();
            var URL = window.URL || window.webkitURL || window;
            var url = URL.createObjectURL(_blob);

            img.onload = function(){
                this.trigger("load");
                URL.revokeObjectURL(url);
            }

            img.src = url;
        }
    });

    return HTML;
});
define('qtek/2d/shape/Image',['require','../Node','../../math/Vector2'],function(require) {

    var Node = require('../Node');
    var Vector2 = require("../../math/Vector2");

    var _imageCache = {};
    
    var QTImage = Node.derive(function() {
        return {
            image     : null,
            start   : new Vector2(),
            size    : null
        }
    }, {
        computeBoundingBox : function() {
            if (this.size){
                this.boundingBox = {
                    min : this.start.clone(),
                    max : this.start.clone().add(this.size)
                }   
            }
        },
        draw : function(ctx, isPicker) {
            if (this.image && ! isPicker) {
                this.size ? 
                    ctx.drawImage(this.image, this.start.x, this.start.y, this.size.x, this.size.y) :
                    ctx.drawImage(this.image, this.start.x, this.start.y);
            }
        },
        intersect : function(x, y) {
            return this.intersectBoundingBox(x, y);
        }
    });

    QTImage.load = function(src, callback){
        if (_imageCache[src]) {
            var img = _imageCache[src];
            if (img.constructor == Array) {
                img.push(callback);
            } else {
                callback(img);
            }
        } else {
            _imageCache[src] = [callback];
            var img = new Image();
            img.onload = function() {
                _imageCache[src].forEach(function(cb) {
                    cb(img);
                });
                _imageCache[src] = img;

                img.onload = null;
            }
            img.src = src;
        }
    }
    
    return QTImage;
});
/**
 *
 * @export{object}
 */
define('qtek/2d/util',['require','../math/Vector2','glmatrix'],function(require) {
    
    var Vector2 = require("../math/Vector2");
    var glMatrix = require("glmatrix");
    var vec2 = glMatrix.vec2;

    var tmp = new Vector2();

    var util =  {
        fixPos: function(pos) {
            pos.x += 0.5;
            pos.y += 0.5;
            return pos;
        },
        fixPosArray : function(poslist) {
            var len = poslist.length;
            for(var i = 0; i < len; i++) {
                this.fixPos(poslist[i]);
            }
            return poslist;
        },
        computeBoundingBox : function(points, min, max) {
            var left = points[0].x;
            var right = points[0].x;
            var top = points[0].y;
            var bottom = points[0].y;
            
            for (var i = 1; i < points.length; i++) {
                var p = points[i];
                if (p.x < left) {
                    left = p.x;
                }
                if (p.x > right) {
                    right = p.x;
                }
                if (p.y < top) {
                    top = p.y;
                }
                if (p.y > bottom) {
                    bottom = p.y;
                }
            }
            min.set(left, top);
            max.set(right, bottom);
        },

        // http://pomax.github.io/bezierinfo/#extremities
        computeCubeBezierBoundingBox : function(p0, p1, p2, p3, min, max) {
            // var seg = (p0.dist(p1) + p2.dist(p3) + p0.dist(p3)) / 20;

            // min.copy(p0).min(p3);
            // max.copy(p0).max(p3);

            // for (var i = 1; i < seg; i++) {
            //     var t = i / seg;
            //     var t2 = t * t;
            //     var ct = 1 - t;
            //     var ct2 = ct * ct;
            //     var x = ct2 * ct * p0.x + 3 * ct2 * t * p1.x + 3 * ct * t2 * p2.x + t2 * t * p3.x;
            //     var y = ct2 * ct * p0.y + 3 * ct2 * t * p1.y + 3 * ct * t2 * p2.y + t2 * t * p3.y;

            //     tmp.set(x, y);
            //     min.min(tmp);
            //     max.max(tmp);
            // }
            var xDim = util._computeCubeBezierExtremitiesDim(p0.x, p1.x, p2.x, p3.x);
            var yDim = util._computeCubeBezierExtremitiesDim(p0.y, p1.y, p2.y, p3.y);

            xDim.push(p0.x, p3.x);
            yDim.push(p0.y, p3.y);

            var left = Math.min.apply(null, xDim);
            var right = Math.max.apply(null, xDim);
            var top = Math.min.apply(null, yDim);
            var bottom = Math.max.apply(null, yDim);

            min.set(left, top);
            max.set(right, bottom);
        },

        _computeCubeBezierExtremitiesDim : function(p0, p1, p2, p3) {
            var extremities = [];

            var b = 6 * p2 - 12 * p1 + 6 * p0;
            var a = 9 * p1 + 3 * p3 - 3 * p0 - 9 * p2;
            var c = 3 * p1 - 3 * p0;

            var tmp = b * b - 4 * a * c;
            if (tmp > 0){
                var tmpSqrt = Math.sqrt(tmp);
                var t1 = (-b + tmpSqrt) / (2 * a);
                var t2 = (-b - tmpSqrt) / (2 * a);
                extremities.push(t1, t2);
            } else if(tmp == 0) {
                extremities.push(-b / (2 * a));
            }
            var result = [];
            for (var i = 0; i < extremities.length; i++) {
                var t = extremities[i];
                if (Math.abs(2 * a * t + b) > 0.0001 && t < 1 && t > 0) {
                    var ct = 1 - t;
                    var val = ct * ct * ct * p0 
                            + 3 * ct * ct * t * p1
                            + 3 * ct * t * t * p2
                            + t * t *t * p3;

                    result.push(val);
                }
            }

            return result;
        },

        // http://pomax.github.io/bezierinfo/#extremities
        computeQuadraticBezierBoundingBox : function(p0, p1, p2, min, max) {
            // Find extremities, where derivative in x dim or y dim is zero
            var tmp = (p0.x + p2.x - 2 * p1.x);
            // p1 is center of p0 and p2 in x dim
            if (tmp === 0) {
                var t1 = 0.5;
            } else {
                var t1 = (p0.x - p1.x) / tmp;
            }

            tmp = (p0.y + p2.y - 2 * p1.y);
            // p1 is center of p0 and p2 in y dim
            if (tmp === 0) {
                var t2 = 0.5;
            } else {
                var t2 = (p0.y - p1.y) / tmp;
            }

            t1 = Math.max(Math.min(t1, 1), 0);
            t2 = Math.max(Math.min(t2, 1), 0);

            var ct1 = 1-t1;
            var ct2 = 1-t2;

            var x1 = ct1 * ct1 * p0.x + 2 * ct1 * t1 * p1.x + t1 * t1 * p2.x;
            var y1 = ct1 * ct1 * p0.y + 2 * ct1 * t1 * p1.y + t1 * t1 * p2.y;

            var x2 = ct2 * ct2 * p0.x + 2 * ct2 * t2 * p1.x + t2 * t2 * p2.x;
            var y2 = ct2 * ct2 * p0.y + 2 * ct2 * t2 * p1.y + t2 * t2 * p2.y;

            return util.computeBoundingBox(
                        [p0.clone(), p2.clone(), new Vector2(x1, y1), new Vector2(x2, y2)],
                        min, max
                    );
        },
        // http://stackoverflow.com/questions/1336663/2d-bounding-box-of-a-sector
        computeArcBoundingBox : (function(){
            var start = new Vector2();
            var end = new Vector2();
            // At most 4 extremities
            var extremities = [new Vector2(), new Vector2(), new Vector2(), new Vector2()];
            return function(center, radius, startAngle, endAngle, clockwise, min, max) {
                clockwise = clockwise ? 1 : -1;
                start
                    .set(Math.cos(startAngle), Math.sin(startAngle) * clockwise)
                    .scale(radius)
                    .add(center);
                end
                    .set(Math.cos(endAngle), Math.sin(endAngle) * clockwise)
                    .scale(radius)
                    .add(center);
                
                startAngle = startAngle % (Math.PI * 2);
                if (startAngle < 0) {
                    startAngle = startAngle + Math.PI * 2;
                }
                endAngle = endAngle % (Math.PI * 2);
                if (endAngle < 0) {
                    endAngle = endAngle + Math.PI * 2;
                }

                if (startAngle > endAngle) {
                    endAngle += Math.PI * 2;
                }
                var number = 0;
                for (var angle = 0; angle < endAngle; angle += Math.PI / 2) {
                    if (angle > startAngle) {
                        extremities[number++]
                            .set(Math.cos(angle), Math.sin(angle) * clockwise)
                            .scale(radius)
                            .add(center);
                    }
                }
                var points = extremities.slice(0, number)
                points.push(start, end);
                util.computeBoundingBox(points, min, max);
            }
        })()
    }

    return util;
} );
define('qtek/2d/shape/Line',['require','../Node','../util','../../math/Vector2'],function(require) {

    var Node = require('../Node');
    var util = require('../util');
    var Vector2 = require("../../math/Vector2");

    var Line = Node.derive(function() {
        return {
            start : new Vector2(),
            end : new Vector2(),
            width : 0   //virtual width of the line for intersect computation 
        }
    }, {
        computeBoundingBox : function() {

            this.boundingBox = util.computeBoundingBox(
                                    [this.start, this.end],
                                    this.boundingBox.min,
                                    this.boundingBox.max
                                );
            
            if (this.boundingBox.min.x == this.boundingBox.max.x) { //line is vertical
                this.boundingBox.min.x -= this.width/2;
                this.boundingBox.max.x += this.width/2;
            }
            if (this.boundingBox.min.y == this.boundingBox.max.y) { //line is horizontal
                this.boundingBox.min.y -= this.width/2;
                this.boundingBox.max.y += this.width/2;
            }
        },
        draw : function(ctx) {
            
            var start = this.start,
                end = this.end;

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

        },
        intersect : function() {
            var a = new Vector2();
            var ba = new Vector2();
            var bc = new Vector2();

            return function(x, y) {
                if (!this.intersectBoundingBox(x, y)) {
                    return false;
                }
                var b = this.start;
                var c = this.end;

                a.set(x, y);
                ba.copy(a).sub(b);
                bc.copy(c).sub(b);

                var bal = ba.length();
                var bcl = bc.length();

                var tmp = bal * ba.scale(1/bal).dot(bcl.scale(1/bcl));

                var distSquare = bal * bal -  tmp * tmp;
                return distSquare < this.width * this.width * 0.25;
            }
        }
    });

    return Line;
});
/**
 *
 * Inspired by path in paper.js
 */
define('qtek/2d/shape/Path',['require','../Node','../util','../../math/Vector2'],function(require) {

    var Node = require('../Node');
    var util = require('../util');
    var Vector2 = require("../../math/Vector2");

    var minTmp = new Vector2();
    var maxTmp = new Vector2();

    var Path = Node.derive(function() {
        return {
            segments : [],
            closePath : false
        }
    }, {
        computeBoundingBox : function() {
            var l = this.segments.length;
            var segs = this.segments;

            var min = this.boundingBox.min;
            var max = this.boundingBox.max;
            min.set(999999, 999999);
            max.set(-999999, -999999);
            
            for (var i = 1; i < l; i++) {
                if (segs[i-1].handleOut || segs[i].handleIn) {
                    var bb = util.computeCubeBezierBoundingBox(
                                segs[i-1].point,
                                segs[i-1].handleOut || segs[i-1].point,
                                segs[i].handleIn || segs[i].point,
                                segs[i].point,
                                minTmp, maxTmp
                            );
                    min.min(minTmp);
                    max.max(maxTmp);
                } else {
                    min.min(segs[i-1].point);
                    min.min(segs[i].point);

                    max.max(segs[i-1].point);
                    max.max(segs[i].point);
                }
            }
        },
        draw : function(ctx) {
            
            var l = this.segments.length;
            var segs = this.segments;
            
            ctx.beginPath();
            ctx.moveTo(segs[0].point.x, segs[0].point.y);
            for (var i = 1; i < l; i++) {
                if (segs[i-1].handleOut || segs[i].handleIn) {
                    var prevHandleOut = segs[i-1].handleOut || segs[i-1].point;
                    var handleIn = segs[i].handleIn || segs[i].point;
                    ctx.bezierCurveTo(prevHandleOut.x, prevHandleOut.y,
                            handleIn.x, handleIn.y, segs[i].point.x, segs[i].point.y);
                } else {
                    ctx.lineTo(segs[i].point.x, segs[i].point.y);
                }
            }
            if (this.closePath) {
                if (segs[l-1].handleOut || segs[0].handleIn) {
                    var prevHandleOut = segs[l-1].handleOut || segs[l-1].point;
                    var handleIn = segs[0].handleIn || segs[0].point;
                    ctx.bezierCurveTo(prevHandleOut.x, prevHandleOut.y,
                            handleIn.x, handleIn.y, segs[0].point.x, segs[0].point.y);
                } else {
                    ctx.lineTo(segs[0].point.x, segs[0].point.y);
                }
            }
            if (this.fill) {
                ctx.fill();
            }
            if (this.stroke) {
                ctx.stroke();
            }
        },
        smooth : function(degree) {

            var len = this.segments.length;
            var segs = this.segments;

            var v = new Vector2();
            for (var i = 0; i < len; i++) {
                var point = segs[i].point;
                var prevPoint = (i == 0) ? segs[len-1].point : segs[i-1].point;
                var nextPoint = (i == len-1) ? segs[0].point : segs[i+1].point;
                var degree = segs[i].smoothLevel || degree || 1;

                v.copy(nextPoint).sub(prevPoint).scale(0.25);

                //use degree to scale the handle length
                v.scale(degree);
                if (!segs[i].handleIn) {
                    segs[i].handleIn = point.clone().sub(v);
                } else {
                    segs[i].handleIn.copy(point).sub(v);
                }
                if (!segs[i].handleOut) {
                    segs[i].handleOut = point.clone().add(v);
                } else {
                    segs[i].handleOut.copy(point).add(v);
                }
            }
        },
        pushPoints : function(points) {
            for (var i = 0; i < points.length; i++) {
                this.segments.push({
                    point : points[i],
                    handleIn : null,
                    handleOut : null
                })
            }
        }
    })

    return Path;
});
define('qtek/2d/shape/Polygon',['require','../Node','../util','../../math/Vector2'],function(require) {

    var Node = require('../Node');
    var util = require('../util');
    var Vector2 = require("../../math/Vector2");

    var Polygon = Node.derive(function() {
        return {
            points : []
        }
    }, {
        computeBoundingBox : function() {
            this.boundingBox = util.computeBoundingBox(
                                    this.points,
                                    this.boundingBox.min,
                                    this.boundingBox.max
                                );
        },
        draw : function(ctx) {

            var points = this.points;

            ctx.beginPath();
            
            ctx.moveTo(points[0].x, points[0].y);
            for (var i =1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.closePath();
            if (this.stroke) {
                ctx.stroke();
            }
            if (this.fill) {
                ctx.fill();
            }
        },
        intersect : function(x, y) {
    
            if (!this.intersectBoundingBox(x, y)) {
                return false;
            }

            var len = this.points.length;
            var angle = 0;
            var points = this.points;
            var vec1 = new Vector2();
            var vec2 = new Vector2();
            for (var i =0; i < len; i++) {
                vec1.set(x, y).sub(points[i]).normalize().negate();
                var j = (i+1)%len;
                vec2.set(x, y).sub(points[j]).normalize().negate();
                var piece = Math.acos(vec1.dot(vec2));
                angle += piece;
            }
            return Math.length(angle - 2*Math.PI) < 0.001;
        }
    })

    return Polygon;
});
define('qtek/2d/shape/Rectangle',['require','../Node','../util','../../math/Vector2'],function(require){

    var Node = require('../Node');
    var util = require('../util');
    var Vector2 = require("../../math/Vector2");

    var Rectangle = Node.derive( function() {
        return {
            start : new Vector2(0, 0),
            size : new Vector2(0, 0)
        }
    }, {
        computeBoundingBox : function() {
            return {
                min : this.start.clone(),
                max : this.size.clone().add(this.start)
            }
        },
        draw : function(ctx) {

            var start = this.start;

            ctx.beginPath();
            ctx.rect(start.x, start.y, this.size.x, this.size.y);
            if (this.stroke){
                ctx.stroke();
            }
            if (this.fill){
                ctx.fill();
            }
        },
        intersect : function(x, y) {
            return this.intersectBoundingBox(x, y);
        }
    })

    return Rectangle;
});
/**
 * @export{class} RoundedRectangle
 */
define('qtek/2d/shape/RoundedRectangle',['require','../Node','../util','../../math/Vector2'],function(require) {

    var Node = require('../Node');
    var util = require('../util');
    var Vector2 = require("../../math/Vector2");

    var RoundedRectange = Node.derive(function() {
        return {
            start   : new Vector2(),
            size    : new Vector2(),
            radius  : 0
        }
    }, {
        computeBoundingBox : function() {
            this.boundingBox = {
                min : this.start.clone(),
                max : this.size.clone().add(this.start)
            }
        },
        draw : function(ctx) {

            if (this.radius.constructor == Number) {
                // topleft, topright, bottomright, bottomleft
                var radius = [this.radius, this.radius, this.radius, this.radius];
            } else if (this.radius.length == 2) {
                var radius = [this.radius[0], this.radius[1], this.radius[0], this.radius[1]];
            } else {
                var radius = this.radius;
            }

            var start = this.fixAA ? util.fixPos(this.start.clone()) : this.start;
            var size = this.size;
            var v1 = new Vector2().copy(start).add(new Vector2(radius[0], 0));   //left top
            var v2 = new Vector2().copy(start).add(new Vector2(size.x, 0));     //right top
            var v3 = new Vector2().copy(start).add(size);                        //right bottom
            var v4 = new Vector2().copy(start).add(new Vector2(0, size.y));     //left bottom
            ctx.beginPath();
            ctx.moveTo(v1.x, v1.y);
            radius[1] ? 
                ctx.arcTo(v2.x, v2.y, v3.x, v3.y, radius[1]) :
                ctx.lineTo(v2.x, v2.y);
            radius[2] ?
                ctx.arcTo(v3.x, v3.y, v4.x, v4.y, radius[2]) :
                ctx.lineTo(v3.x, v3.y);
            radius[3] ?
                ctx.arcTo(v4.x, v4.y, start.x, start.y, radius[3]) :
                ctx.lineTo(v4.x, v4.y);
            radius[0] ? 
                ctx.arcTo(start.x, start.y, v2.x, v2.y, radius[0]) :
                ctx.lineTo(start.x, start.y);
            
            if (this.stroke) {
                ctx.stroke();
            }
            if (this.fill) {
                ctx.fill();
            }
        },
        intersect : function(x, y) {
            // TODO
            return false;
        }
    })

    return RoundedRectange;
});
/**
 * 
 * @export{class} SVGPath
 */
define('qtek/2d/shape/SVGPath',['require','../Node','../util','../../math/Vector2'],function(require) {

    var Node = require("../Node");
    var util = require("../util");
    var Vector2 = require("../../math/Vector2");

    var availableCommands = {'m':1,'M':1,'z':1,'Z':1,'l':1,'L':1,'h':1,'H':1,'v':1,'V':1,'c':1,'C':1,'s':1,'S':1,'q':1,'Q':1,'t':1,'T':1,'a':1,'A':1}

    var SVGPath = Node.derive(function() {
        return {
            description : '',
            _ops : []
        }
    }, {
        draw : function(ctx) {
            if (!this._ops.length) {
                this.parse();
            }

            ctx.beginPath();
            for (var i = 0; i < this._ops.length; i++) {
                var op = this._ops[i];
                switch(op[0]) {
                    case 'm':
                        ctx.moveTo(op[1], op[2]);
                        break;
                    case 'l':
                        ctx.lineTo(op[1], op[2]);
                        break;
                    case 'c':
                        ctx.bezierCurveTo(op[1], op[2], op[3], op[4], op[5], op[6]);
                        break;
                    case 'q':
                        ctx.quadraticCurveTo(op[1], op[2], op[3], op[4]);
                        break;
                    case 'z':
                        ctx.closePath();
                        if (this.fill) {
                            ctx.fill();
                        }
                        if (this.stroke) {
                            ctx.stroke();
                        }
                        ctx.beginPath();
                        break;
                }
            }
            if (this.fill) {
                ctx.fill();
            }
            if (this.stroke) {
                ctx.stroke();
            }
        },

        computeBoundingBox : (function() {
            // Temp variables
            var current = new Vector2();
            var p1 = new Vector2();
            var p2 = new Vector2();
            var p3 = new Vector2();

            var minTmp = new Vector2();
            var maxTmp = new Vector2();

            return function() {
                if (!this._ops.length) {
                    this.parse();
                }
                var min = new Vector2(999999, 999999);
                var max = new Vector2(-999999, -999999);

                for (var i = 0; i < this._ops.length; i++) {
                    var op = this._ops[i];
                    switch(op[0]) {
                        case 'm':
                            current.set(op[1], op[2]);
                            break;
                        case 'l':
                            p1.set(op[1], op[2]);
                            current.copy(p1);
                            min.min(current).min(p1);
                            max.max(current).max(p1);
                            break;
                        case 'c':
                            p1.set(op[1], op[2]);
                            p2.set(op[3], op[4]);
                            p3.set(op[5], op[6]);
                            util.computeCubeBezierBoundingBox(current, p1, p2, p3, minTmp, maxTmp);
                            current.copy(p3);
                            min.min(minTmp);
                            max.max(maxTmp);
                            break;
                        case 'q':
                            p1.set(op[1], op[2]);
                            p2.set(op[3], op[4]);
                            var bb = util.computeQuadraticBezierBoundingBox(current, p1, p2, minTmp, maxTmp);
                            current.copy(p2);
                            min.min(minTmp);
                            min.max(maxTmp);
                            break;
                        case 'z':
                            break;
                    }
                }

                this.boundingBox = {
                    min : min,
                    max : max
                }
            }
        })(),

        parse : function(description) {
            // point x, y
            var x = 0;
            var y = 0;
            // control point 1(in cube bezier curve and quadratic bezier curve)
            var x1 = 0;
            var y1 = 0;
            // control point 2(in cube bezier curve)
            var x2 = 0;
            var y2 = 0;

            // pre process
            description = description || this.description;
            var d = description.replace(/\s*,\s*/g, ' ');
            d = d.replace(/(-)/g, ' $1');
            d = d.replace(/([mMzZlLhHvVcCsSqQtTaA])/g, ' $1 ');
            d = d.split(/\s+/);

            var command = "";
            // Save the previous command specially for shorthand/smooth curveto(s/S, t/T)
            var prevCommand = "";
            var offset = 0;
            var len = d.length;
            var next = d[0];

            while (offset <= len) {
                // Skip empty
                if(!next) {
                    next = d[++offset];
                    continue;
                }
                if (availableCommands[next]) {
                    prevCommand = command;
                    command = next;
                    offset++;
                }
                // http://www.w3.org/TR/SVG/paths.html
                switch (command) {
                    case "m":
                        x = pickValue() + x;
                        y = pickValue() + y;
                        this._ops.push(['m', x, y]);
                        break;
                    case "M":
                        x = pickValue();
                        y = pickValue();
                        this._ops.push(['m', x, y]);
                        break;
                    case "z":
                    case "Z":
                        next = d[offset];
                        this._ops.push(['z']);
                        break;
                    case "l":
                        x = pickValue() + x;
                        y = pickValue() + y;
                        this._ops.push(['l', x, y]);
                        break;
                    case "L":
                        x = pickValue();
                        y = pickValue();
                        this._ops.push(['l', x, y]);
                        break;
                    case "h":
                        x = pickValue() + x;
                        this._ops.push(['l', x, y]);
                        break;
                    case "H":
                        x = pickValue();
                        this._ops.push(['l', x, y]);
                        break;
                    case "v":
                        y = pickValue() + y;
                        this._ops.push(['l', x, y]);
                        break;
                    case "V":
                        y = pickValue();
                        this._ops.push(['l', x, y]);
                        break;
                    case "c":
                        x1 = pickValue() + x;
                        y1 = pickValue() + y;
                        x2 = pickValue() + x;
                        y2 = pickValue() + y;
                        x = pickValue() + x;
                        y = pickValue() + y;
                        this._ops.push(['c', x1, y1, x2, y2, x, y]);
                        break;
                    case "C":
                        x1 = pickValue();
                        y1 = pickValue();
                        x2 = pickValue();
                        y2 = pickValue();
                        x = pickValue();
                        y = pickValue();
                        this._ops.push(['c', x1, y1, x2, y2, x, y]);
                        break;
                    case "s":
                        if (prevCommand === "c" || prevCommand === "C" ||
                            prevCommand === "s" || prevCommand === "S") {
                            // Reflection of the second control point on the previous command
                            x1 = x * 2 - x2;
                            y1 = y * 2 - y2;
                        } else {
                            x1 = x;
                            y1 = y;
                        }
                        x2 = pickValue() + x;
                        y2 = pickValue() + y;
                        x = pickValue() + x;
                        y = pickValue() + y;
                        this._ops.push(['c', x1, y1, x2, y2, x, y]);
                        break;
                    case "S":
                        if (prevCommand === "c" || prevCommand === "C" ||
                            prevCommand === "s" || prevCommand === "S") {
                            // Reflection of the second control point on the previous command
                            x1 = x * 2 - x2; 
                            y1 = y * 2 - y2;
                        } else {
                            x1 = x;
                            y1 = y;
                        }
                        x2 = pickValue();
                        y2 = pickValue();
                        x = pickValue();
                        y = pickValue();
                        this._ops.push(['c', x1, y1, x2, y2, x, y]);
                        break;
                    case "q":
                        x1 = pickValue() + x;
                        y1 = pickValue() + y;
                        x = pickValue() + x;
                        y = pickValue() + y;
                        this._ops.push(['q', x1, y1, x, y]);
                        break;
                    case "Q":
                        x1 = pickValue();
                        y1 = pickValue();
                        x = pickValue();
                        y = pickValue();
                        this._ops.push(['q', x1, y1, x, y]);
                        break;
                    case "t":
                        if (prevCommand === "q" || prevCommand === "Q" ||
                            prevCommand === "t" || prevCommand === "T") {
                            // Reflection of the second control point on the previous command
                            x1 = x * 2 - x1; 
                            y1 = y * 2 - y1;
                        } else {
                            x1 = x;
                            y1 = y;
                        }
                        x = pickValue() + x;
                        y = pickValue() + y;
                        this._ops.push(['q', x1, y1, x, y]);
                        break;
                    case "T":
                        if (prevCommand === "q" || prevCommand === "Q" ||
                            prevCommand === "t" || prevCommand === "T") {
                            // Reflection of the second control point on the previous command
                            x1 = x * 2 - x1; 
                            y1 = y * 2 - y1;
                        } else {
                            x1 = x;
                            y1 = y;
                        }
                        x = pickValue();
                        y = pickValue();
                        this._ops.push(['q', x1, y1, x, y]);
                        break;
                    case "a":
                    case "A":
                        pickValue();
                        pickValue();
                        pickValue();
                        pickValue();
                        pickValue();
                        pickValue();
                        pickValue();
                        console.warn("Elliptical arc is not supported yet");
                        break;
                    default:
                        pick();
                        continue;
                }
            }
            
            function pick() {
                next = d[offset+1];
                return d[offset++];
            }

            var _val;
            function pickValue() {
                next = d[offset+1];
                _val = d[offset++];
                return parseFloat(_val);
            }
        }
    });

    return SVGPath;
});
define('qtek/2d/shape/Sector',['require','../Node','../util','../../math/Vector2'],function(require) {

    var Node = require('../Node');
    var util = require('../util');
    var Vector2 = require("../../math/Vector2");

    var Sector = Node.derive(function() {
        return {
            center      : new Vector2(),
            innerRadius : 0,
            outerRadius : 0,
            startAngle  : 0,
            endAngle    : 0,
            clockwise   : true
        }
    }, {
        computeBoundingBox : function() {
            var min = new Vector2();
            var max = new Vector2();

            util.computeArcBoundingBox(
                this.center, this.innerRadius, this.startAngle, 
                this.endAngle, this.clockwise, min, max
            );
            this.boundingBox.min
                .set(99999, 99999)
                .min(min);
            this.boundingBox.max
                .set(-99999, -99999)
                .max(max);

            util.computeArcBoundingBox(
                this.center, this.outerRadius, this.startAngle, 
                this.endAngle, this.clockwise, min, max
            );
            this.boundingBox.min.min(min);
            this.boundingBox.max.max(max);
        },
        intersect : function(x, y) {

            var startAngle = this.startAngle;
            var endAngle = this.endAngle;
            var r1 = this.innerRadius;
            var r2 = this.outerRadius;
            var c = this.center;
            var v = new Vector2(x, y).sub(c);
            var r = v.length();
            var pi2 = Math.PI * 2;

            if (r < r1 || r > r2) {
                return false;
            }
            var angle = Math.atan2(v.y, v.x);

            //need to constraint the angle between 0 - 360
            if (angle < 0) {
                angle = angle+pi2;
            }
            
            if (this.clockwise) {
                return angle < endAngle && angle > startAngle;
            } else {
                startAngle =  pi2 - startAngle;
                endAngle = pi2 - endAngle;
                return angle > endAngle && angle < startAngle;
            }   
        },
        draw : function(ctx) {

            var startAngle = this.startAngle;
            var endAngle = this.endAngle;
            var r1 = this.innerRadius;
            var r2 = this.outerRadius;
            var c = this.center;

            if (! this.clockwise) {
                startAngle =  Math.PI*2 - startAngle;
                endAngle =  Math.PI*2 - endAngle;
            }

            var startInner = new Vector2(r1 * Math.cos(startAngle), r1 * Math.sin(startAngle)).add(c);
            var startOuter = new Vector2(r2 * Math.cos(startAngle), r2 * Math.sin(startAngle)).add(c);
            var endInner = new Vector2(r1 * Math.cos(endAngle), r1 * Math.sin(endAngle)).add(c);
            var endOuter = new Vector2(r2 * Math.cos(endAngle), r2 * Math.sin(endAngle)).add(c);

            ctx.beginPath();
            ctx.moveTo(startInner.x, startInner.y);
            ctx.lineTo(startOuter.x, startOuter.y);
            ctx.arc(c.x, c.y, r2, startAngle, endAngle, ! this.clockwise);
            ctx.lineTo(endInner.x, endInner.y);
            ctx.arc(c.x, c.y, r1, endAngle, startAngle, this.clockwise);
            ctx.closePath();

            if (this.stroke) {
                ctx.stroke();
            }
            if (this.fill) {
                ctx.fill();
            }
        }
    })

    return Sector;
});
define('qtek/2d/shape/Text',['require','../Node','../util','../../math/Vector2'],function(require) {

    var Node = require('../Node');
    var util = require('../util');
    var Vector2 = require("../../math/Vector2");

    var Text = Node.derive( function() {
        return {
            text : '',
            start : new Vector2(),
            size : new Vector2()
        }
    }, {
        computeBoundingBox : function() {
            this.boundingBox = {
                min : this.start.clone(),
                max : this.start.clone().add(this.size)
            }
        },
        draw : function(ctx) {
            var start = this.start;
            if (this.fill) {
                this.size.length && this.size.x ?
                    ctx.fillText(this.text, start.x, start.y, this.size.x) :
                    ctx.fillText(this.text, start.x, start.y);
            }
            if (this.stroke) {
                this.size.length && this.size.x ?
                    ctx.strokeText(this.text, start.x, start.y, this.size.x) :
                    ctx.strokeText(this.text, start.x, start.y);
            }
        },
        resize : function(ctx) {
            if (! this.size.x || this.needResize) {
                this.size.x = ctx.measureText(this.text).width;
                this.size.y = ctx.measureText('m').width;
            }
        },
        intersect : function(x, y) {
            return this.intersectBoundingBox(x, y);
        }
    })

    return Text;
});
/**
 * Text Box
 * Support word wrap and word break
 * Drawing is based on the Text
 * @export{class} TextBox
 *
 * TODO: support word wrap of non-english text
 *      shift first line by (lineHeight-fontSize)/2
 */
define('qtek/2d/shape/TextBox',['require','../Node','../../math/Vector2','./Text'],function(require) {

    var Node = require('../Node');
    var Vector2 = require("../../math/Vector2");
    var Text = require('./Text');

    var TextBox = Node.derive(function() {
        return {
            start           : new Vector2(),
            width           : 0,
            wordWrap        : false,
            wordBreak       : false,
            lineHeight      : 0,
            stroke          : false,
            // private prop, save Text instances
            _texts          : []
        }
    }, function() {
        // to verify if the text is changed
        this._oldText = "";
    }, {
        computeBoundingBox : function() {
            // TODO
        },
        draw : function(ctx) {
            if (this.text != this._oldText) {
                this._oldText = this.text;

                //set font for measureText
                if (this.font) {
                    ctx.font = this.font;
                }
                if (this.wordBreak) {
                    this._texts = this.computeWordBreak(ctx);
                }
                else if (this.wordWrap) {
                    this._texts = this.computeWordWrap(ctx);
                }
                else{
                    var txt = new Text({
                        text : this.text
                    })
                    this.extendCommonProperties(txt);
                    this._texts = [txt]
                }
            }

            ctx.save();
            ctx.textBaseline = 'top';
            for (var i = 0; i < this._texts.length; i++) {
                var _text = this._texts[i];
                _text.draw(ctx);
            }
            ctx.restore();
        },
        computeWordWrap : function(ctx) {
            if (! this.text) {
                return;
            }
            var words = this.text.split(' ');
            var len = words.length;
            var lineWidth = 0;
            var wordWidth;
            var wordText;
            var texts = [];
            var txt;

            var wordHeight = ctx.measureText("m").width;

            for(var i = 0; i < len; i++) {
                wordText = i == len-1 ? words[i] : words[i]+' ';
                wordWidth = ctx.measureText(wordText).width;
                if (lineWidth + wordWidth > this.width ||
                    ! txt) {    //first line
                    // create a new text line and put current word
                    // in the head of new line
                    txt = new Text({
                        text : wordText, //append last word
                        start : this.start.clone().add(new Vector2(0, this.lineHeight*(texts.length+1) - wordHeight))
                    })
                    this.extendCommonProperties(txt);
                    texts.push(txt);

                    lineWidth = wordWidth;
                }else{
                    lineWidth += wordWidth;
                    txt.text += wordText;
                }
            }
            return texts;
        },
        computeWordBreak : function(ctx) {
            if (! this.text) {
                return;
            }
            var len = this.text.length;
            var letterWidth;
            var letter;
            var lineWidth = ctx.measureText(this.text[0]).width;
            var texts = [];
            var txt;

            var wordHeight = ctx.measureText("m").width;

            for (var i = 0; i < len; i++) {
                letter = this.text[i];
                letterWidth = ctx.measureText(letter).width;
                if (lineWidth + letterWidth > this.width || 
                    ! txt) {    //first line
                    var txt = new Text({
                        text : letter,
                        start : this.start.clone().add(new Vector2(0, this.lineHeight*(texts.length+1) - wordHeight))
                    });
                    this.extendCommonProperties(txt);
                    texts.push(txt);
                    // clear prev line states
                    lineWidth = letterWidth;
                } else {
                    lineWidth += letterWidth;
                    txt.text += letter;
                }
            }
            return texts;
        },
        extendCommonProperties : function(txt) {
            var props = {};
            _.extend(txt, {
                fill : this.fill,
                stroke : this.stroke
            })
        },
        intersect : function(x, y) {
        }
    })

    return TextBox;
});
define('qtek/math/Vector3',['require','glmatrix'],function(require) {
    
    

    var glMatrix = require("glmatrix");
    var vec3 = glMatrix.vec3;

    var Vector3 = function(x, y, z) {
        
        x = x || 0;
        y = y || 0;
        z = z || 0;

        this._array = vec3.fromValues(x, y, z);
        // Dirty flag is used by the Node to determine
        // if the localTransform is updated to latest
        this._dirty = true;
    }

    Vector3.prototype= {

        constructor : Vector3,

        get x() {
            return this._array[0];
        },

        set x(value) {
            this._array[0] = value;
            this._dirty = true;
        },

        get y() {
            return this._array[1];
        },

        set y(value) {
            this._array[1] = value;
            this._dirty = true;
        },

        get z() {
            return this._array[2];
        },

        set z(value) {
            this._array[2] = value;
            this._dirty = true;
        },

        add : function(b) {
            vec3.add(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        set : function(x, y, z) {
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._dirty = true;
            return this;
        },

        setArray : function(arr) {
            this._array[0] = arr[0];
            this._array[1] = arr[1];
            this._array[2] = arr[2];

            this._dirty = true;
            return this;
        },

        clone : function() {
            return new Vector3( this.x, this.y, this.z );
        },

        copy : function(b) {
            vec3.copy( this._array, b._array );
            this._dirty = true;
            return this;
        },

        cross : function(out, b) {
            vec3.cross(out._array, this._array, b._array);
            return this;
        },

        dist : function(b) {
            return vec3.dist(this._array, b._array);
        },

        distance : function(b) {
            return vec3.distance(this._array, b._array);
        },

        div : function(b) {
            vec3.div(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        divide : function(b) {
            vec3.divide(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        dot : function(b) {
            return vec3.dot(this._array, b._array);
        },

        len : function() {
            return vec3.len(this._array);
        },

        length : function() {
            return vec3.length(this._array);
        },
        /**
         * Perform linear interpolation between a and b
         */
        lerp : function(a, b, t) {
            vec3.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        min : function(b) {
            vec2.min(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        max : function(b) {
            vec2.max(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        mul : function(b) {
            vec3.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        multiply : function(b) {
            vec3.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        negate : function() {
            vec3.negate(this._array, this._array);
            this._dirty = true;
            return this;
        },

        normalize : function() {
            vec3.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },

        random : function(scale) {
            vec3.random(this._array, scale);
            this._dirty = true;
            return this;
        },

        scale : function(s) {
            vec3.scale(this._array, this._array, s);
            this._dirty = true;
            return this;
        },
        /**
         * add b by a scaled factor
         */
        scaleAndAdd : function(b, s) {
            vec3.scaleAndAdd(this._array, this._array, b._array, s);
            this._dirty = true;
            return this;
        },

        sqrDist : function(b) {
            return vec3.sqrDist(this._array, b._array);
        },

        squaredDistance : function(b) {
            return vec3.squaredDistance(this._array, b._array);
        },

        sqrLen : function() {
            return vec3.sqrLen(this._array);
        },

        squaredLength : function() {
            return vec3.squaredLength(this._array);
        },

        sub : function(b) {
            vec3.sub(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        subtract : function(b) {
            vec3.subtract(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        transformMat3 : function(m) {
            vec3.transformMat3(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },

        transformMat4 : function(m) {
            vec3.transformMat4(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },

        transformQuat : function(q) {
            vec3.transformQuat(this._array, this._array, q._array);
            this._dirty = true;
            return this;
        },

        applyProjection : function(m) {
            var v = this._array;
            m = m._array;

            // Perspective projection
            if (m[15] === 0) {
                var w = -1 / v[2];
                v[0] = m[0] * v[0] * w;
                v[1] = m[5] * v[1] * w;
                v[2] = (m[10] * v[2] + m[14]) * w;
            } else {
                v[0] = m[0] * v[0] + m[12];
                v[1] = m[5] * v[1] + m[13];
                v[2] = m[10] * v[2] + m[14];
            }
            this._dirty = true;

            return this;
        },
        /**
         * Set euler angle from queternion
         */
        setEulerFromQuaternion : function(q) {
            // var sqx = q.x * q.x;
            // var sqy = q.y * q.y;
            // var sqz = q.z * q.z;
            // var sqw = q.w * q.w;
            // this.x = Math.atan2( 2 * ( q.y * q.z + q.x * q.w ), ( -sqx - sqy + sqz + sqw ) );
            // this.y = Math.asin( -2 * ( q.x * q.z - q.y * q.w ) );
            // this.z = Math.atan2( 2 * ( q.x * q.y + q.z * q.w ), ( sqx - sqy - sqz + sqw ) );

            // return this;
        },

        toString : function() {
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        },
    }

    // Supply methods that are not in place
    Vector3.add = function(out, a, b) {
        vec3.add(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector3.set = function(out, x, y, z) {
        vec3.set(out._array, x, y, z);
        out._dirty = true;
    }

    Vector3.copy = function(out, b) {
        vec3.copy(out._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector3.cross = function(out, a, b) {
        vec3.cross(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector3.dist = function(a, b) {
        return vec3.distance(a._array, b._array);
    }

    Vector3.distance = Vector3.dist;

    Vector3.div = function(out, a, b) {
        vec3.divide(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector3.divide = Vector3.div;

    Vector3.dot = function(a, b) {
        return vec3.dot(a._array, b._array);
    }

    Vector3.len = function(b) {
        return vec3.length(b._array);
    }

    // Vector3.length = Vector3.len;

    Vector3.lerp = function(out, a, b, t) {
        vec3.lerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    }

    Vector3.min = function(out, a, b) {
        vec3.min(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector3.max = function(out, a, b) {
        vec3.max(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector3.mul = function(out, a, b) {
        vec3.multiply(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector3.multiply = Vector3.mul;

    Vector3.negate = function(out, a) {
        vec3.negate(out._array, a._array);
        out._dirty = true;
        return out;
    }

    Vector3.normalize = function(out, a) {
        vec3.normalize(out._array, a._array);
        out._dirty = true;
        return out;
    }

    Vector3.random = function(out, scale) {
        vec3.random(out._array, scale);
        out._dirty = true;
        return out;
    }

    Vector3.scale = function(out, a, scale) {
        vec3.scale(out._array, a._array, scale);
        out._dirty = true;
        return out;
    }

    Vector3.scaleAndAdd = function(out, a, b, scale) {
        vec3.scale(out._array, a._array, b._array, scale);
        out._dirty = true;
        return out;
    }

    Vector3.sqrDist = function(a, b) {
        return vec3.sqrDist(a._array, b._array);
    }

    Vector3.squaredDistance = Vector3.sqrDist;

    Vector3.sqrLen = function(a) {
        return vec3.sqrLen(a._array);
    }
    Vector3.squaredLength = Vector3.sqrLen;

    Vector3.sub = function(out, a, b) {
        vec3.subtract(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }
    Vector3.subtract = Vector3.sub;

    Vector3.transformMat3 = function(out, a, m) {
        vec3.transformMat3(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    }

    Vector3.transformMat4 = function(out, a, m) {
        vec3.transformMat4(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    }

    Vector3.transformQuat = function(out, a, q) {
        vec3.transformQuat(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    }

    Vector3.POSITIVE_X = new Vector3(1, 0, 0);
    Vector3.NEGATIVE_X = new Vector3(-1, 0, 0);
    Vector3.POSITIVE_Y = new Vector3(0, 1, 0);
    Vector3.NEGATIVE_Y = new Vector3(0, -1, 0);
    Vector3.POSITIVE_Z = new Vector3(0, 0, 1);
    Vector3.NEGATIVE_Z = new Vector3(0, 0, -1);

    Vector3.UP = new Vector3(0, 1, 0);
    Vector3.ZERO = new Vector3(0, 0, 0);

    return Vector3;
} );
define('qtek/math/Quaternion',['require','glmatrix'],function(require) {

    

    var glMatrix = require("glmatrix");
    var quat = glMatrix.quat;

    var Quaternion = function(x, y, z, w) {

        x = x || 0;
        y = y || 0;
        z = z || 0;
        w = w === undefined ? 1 : w;

        this._array = quat.fromValues(x, y, z, w);
        // Dirty flag is used by the Node to determine
        // if the matrix is updated to latest
        this._dirty = true;
    }

    Quaternion.prototype = {

        constructor : Quaternion,

        get x() {
            return this._array[0];
        },

        set x(value) {
            this._array[0] = value;
            this._dirty = true;
        },

        get y() {
            this._array[1] = value;
            this._dirty = true;
        },

        set y(value) {
            return this._array[1];
        },

        get z() {
            return this._array[2];
        },

        set z(value) {
            this._array[2] = value;
            this._dirty = true;
        },

        get w() {
            return this._array[3];
        },

        set w(value) {
            this._array[3] = value;
            this._dirty = true;
        },

        add : function(b) {
            quat.add( this._array, this._array, b._array );
            this._dirty = true;
            return this;
        },

        calculateW : function() {
            quat.calculateW(this._array, this._array);
            this._dirty = true;
            return this;
        },

        set : function(x, y, z, w) {
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._array[3] = w;
            this._dirty = true;
            return this;
        },

        setArray : function(arr) {
            this._array[0] = arr[0];
            this._array[1] = arr[1];
            this._array[2] = arr[2];
            this._array[3] = arr[3];

            this._dirty = true;
            return this;
        },

        clone : function() {
            return new Quaternion( this.x, this.y, this.z, this.w );
        },

        /**
         * Calculates the conjugate of a quat If the quaternion is normalized, 
         * this function is faster than quat.inverse and produces the same result.
         */
        conjugate : function() {
            quat.conjugate(this._array, this._array);
            this._dirty = true;
            return this;
        },

        copy : function(b) {
            quat.copy( this._array, b._array );
            this._dirty = true;
            return this;
        },

        dot : function(b) {
            return quat.dot(this._array, b._array);
        },

        fromMat3 : function(m) {
            quat.fromMat3(this._array, m._array);
            this._dirty = true;
            return this;
        },

        fromMat4 : (function() {
            var mat3 = glMatrix.mat3;
            var m3 = mat3.create();
            return function(m) {
                mat3.fromMat4(m3, m._array);
                // TODO Not like mat4, mat3 in glmatrix seems to be row-based
                mat3.transpose(m3, m3);
                quat.fromMat3(this._array, m3);
                this._dirty = true;
                return this;
            }
        })(),

        identity : function() {
            quat.identity(this._array);
            this._dirty = true;
            return this;
        },

        invert : function() {
            quat.invert(this._array, this._array);
            this._dirty = true;
            return this;
        },

        len : function() {
            return quat.len(this._array);
        },

        length : function() {
            return quat.length(this._array);
        },

        lerp : function(a, b, t) {
            quat.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        mul : function(b) {
            quat.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        mulLeft : function() {
            quat.multiply(this._array, a._array, this._array);
            this._dirty = true;
            return this;
        },

        multiply : function(b) {
            quat.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        multiplyLeft : function(a) {
            quat.multiply(this._array, a._array, this._array);
            this._dirty = true;
            return this;
        },

        normalize : function() {
            quat.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },

        rotateX : function(rad) {
            quat.rotateX(this._array, this._array, rad); 
            this._dirty = true;
            return this;
        },

        rotateY : function(rad) {
            quat.rotateY(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },

        rotateZ : function(rad) {
            quat.rotateZ(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },

        rotationTo : function(a, b) {
            quat.rotationTo(this._array, a._array, b._array);
            this._dirty = true;
            return this;
        },

        setAxes : function(view, right, up) {
            quat.setAxes(this._array, view._array, right._array, up._array);
            this._dirty = true;
            return this;
        },

        setAxisAngle : function(axis, rad) {
            quat.setAxisAngle(this._array, axis._array, rad);
            this._dirty = true;
            return this;
        },

        slerp : function(a, b, t) {
            quat.slerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        sqrLen : function() {
            return quat.sqrLen(this._array);
        },

        squaredLength : function() {
            return quat.squaredLength(this._array);
        },
        /**
         * Set quaternion from euler angle
         */
        setFromEuler : function(v) {
            
        },

        toString : function() {
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    // Supply methods that are not in place
    Quaternion.add = function(out, a, b) {
        quat.add(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Quaternion.set = function(out, x, y, z, w) {
        quat.set(out._array, x, y, z, w);
        out._dirty = true;
    }

    Quaternion.copy = function(out, b) {
        quat.copy(out._array, b._array);
        out._dirty = true;
        return out;
    }

    Quaternion.calculateW = function(out, a) {
        quat.calculateW(out._array, a._array);
        out._dirty = true;
        return out;
    }

    Quaternion.conjugate = function(out, a) {
        quat.conjugate(out._array, a._array);
        out._dirty = true;
        return out;
    }

    Quaternion.identity = function(out) {
        quat.identity(out._array);
        out._dirty = true;
        return out;
    }

    Quaternion.invert = function(out, a) {
        quat.invert(out._array, a._array);
        out._dirty = true;
        return out;
    }

    Quaternion.dot = function(a, b) {
        return quat.dot(a._array, b._array);
    }

    Quaternion.len = function(b) {
        return quat.length(b._array);
    }

    // Quaternion.length = Quaternion.len;

    Quaternion.lerp = function(out, a, b, t) {
        quat.lerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    }

    Quaternion.slerp = function(out, a, b, t) {
        quat.slerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    }

    Quaternion.mul = function(out, a, b) {
        quat.multiply(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Quaternion.multiply = Quaternion.mul;

    Quaternion.rotateX = function(out, a, rad) {
        quat.rotateX(out._array, a._array, rad);
        out._dirty = true;
        return out;
    }

    Quaternion.rotateY = function(out, a, rad) {
        quat.rotateY(out._array, a._array, rad);
        out._dirty = true;
        return out;
    }

    Quaternion.rotateZ = function(out, a, rad) {
        quat.rotateZ(out._array, a._array, rad);
        out._dirty = true;
        return out;
    }

    Quaternion.setAxisAngle = function(out, axis, rad) {
        quat.setAxisAngle(out._array, axis._array, rad);
        out._dirty = true;
        return out;
    }

    Quaternion.normalize = function(out, a) {
        quat.normalize(out._array, a._array);
        out._dirty = true;
        return out;
    }

    Quaternion.sqrLen = function(a) {
        return quat.sqrLen(a._array);
    }

    Quaternion.squaredLength = Quaternion.sqrLen;

    Quaternion.fromMat3 = function(out, m) {
        quat.fromMat3(out._array, m._array);
        out._dirty = true;
        return out;
    }

    Quaternion.setAxes = function(out, view, right, up) {
        quat.setAxes(out._array, view._array, right._array, up._array);
        out._dirty = true;
        return out;
    }

    Quaternion.rotationTo = function(out, a, b) {
        quat.rotationTo(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    return Quaternion;
} );
define('qtek/math/Matrix4',['require','glmatrix','./Vector3'],function(require) {

    

    var glMatrix = require("glmatrix");
    var Vector3 = require("./Vector3");
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var mat3 = glMatrix.mat3;
    var quat = glMatrix.quat;

    function makeProperty(n) {
        return {
            set : function(value) {
                this._array[n] = value;
                this._dirty = true;
            },
            get : function() {
                return this._array[n];
            }
        }
    }
    var Matrix4 = function() {

        this._axisX = new Vector3();
        this._axisY = new Vector3();
        this._axisZ = new Vector3();

        this._array = mat4.create();
    };

    Matrix4.prototype = {

        constructor : Matrix4,

        get forward() {
            var el = this._array;
            this._axisZ.set(el[8], el[9], el[10]);
            return this._axisZ;
        },

        // TODO Here has a problem
        // If only set an item of vector will not work
        set forward(v) {
            var el = this._array;
            v = v._array;
            el[8] = v[0];
            el[9] = v[1];
            el[10] = v[2];
        },

        get up() {
            var el = this._array;
            this._axisY.set(el[4], el[5], el[6]);
            return this._axisY;
        },

        set up(v) {
            var el = this._array;
            v = v._array;
            el[4] = v[0];
            el[5] = v[1];
            el[6] = v[2];
        },

        get right() {
            var el = this._array;
            this._axisX.set(el[0], el[1], el[2]);
            return this._axisX;
        },

        set right(v) {
            var el = this._array;
            v = v._array;
            el[0] = v[0];
            el[1] = v[1];
            el[2] = v[2];
        },

        adjoint : function() {
            mat4.adjoint(this._array, this._array);
            return this;
        },
        clone : function() {
            return (new Matrix4()).copy(this);
        },
        copy : function(b) {
            mat4.copy(this._array, b._array);
            return this;
        },
        determinant : function() {
            return mat4.determinant(this._array);
        },
        fromQuat : function(q) {
            mat4.fromQuat(this._array, q._array);
            return this;
        },
        fromRotationTranslation : function(q, v) {
            mat4.fromRotationTranslation(this._array, q._array, v._array);
            return this;
        },
        frustum : function(left, right, bottom, top, near, far) {
            mat4.frustum(this._array, left, right, bottom, top, near, far);
            return this;
        },
        identity : function() {
            mat4.identity(this._array);
            return this;
        },
        invert : function() {
            mat4.invert(this._array, this._array);
            return this;
        },
        lookAt : function(eye, center, up) {
            mat4.lookAt(this._array, eye._array, center._array, up._array);
            return this;
        },
        mul : function(b) {
            mat4.mul(this._array, this._array, b._array);
            return this;
        },
        mulLeft : function(b) {
            mat4.mul(this._array, b._array, this._array);
            return this;
        },
        multiply : function(b) {
            mat4.multiply(this._array, this._array, b._array);
            return this;
        },
        // Apply left multiply
        multiplyLeft : function(b) {
            mat4.multiply(this._array, b._array, this._array);
            return this;
        },
        ortho : function(left, right, bottom, top, near, far) {
            mat4.ortho(this._array, left, right, bottom, top, near, far);
            return this;
        },
        perspective : function(fovy, aspect, near, far) {
            mat4.perspective(this._array, fovy, aspect, near, far);
            return this;
        },
        rotate : function(rad, axis /*Vector3*/) {
            mat4.rotate(this._array, this._array, rad, axis._array);
            return this;
        },
        rotateX : function(rad) {
            mat4.rotateX(this._array, this._array, rad);
            return this;
        },
        rotateY : function(rad) {
            mat4.rotateY(this._array, this._array, rad);
            return this;
        },
        rotateZ : function(rad) {
            mat4.rotateZ(this._array, this._array, rad);
            return this;
        },
        scale : function(v) {
            mat4.scale(this._array, this._array, v._array);
            return this;
        },
        translate : function(v) {
            mat4.translate(this._array, this._array, v._array);
            return this;
        },
        transpose : function() {
            mat4.transpose(this._array, this._array);
            return this;
        },

        // Static method
        // Decompose a matrix to SRT
        // http://msdn.microsoft.com/en-us/library/microsoft.xna.framework.matrix.decompose.aspx
        decomposeMatrix : (function() {

            var x = vec3.create();
            var y = vec3.create();
            var z = vec3.create();

            var m3 = mat3.create();

            return function(scale, rotation, position) {

                var el = this._array;
                vec3.set(x, el[0], el[1], el[2]);
                vec3.set(y, el[4], el[5], el[6]);
                vec3.set(z, el[8], el[9], el[10]);

                scale.x = vec3.length(x);
                scale.y = vec3.length(y);
                scale.z = vec3.length(z);

                position.set(el[12], el[13], el[14]);

                mat3.fromMat4(m3, el);
                // Not like mat4, mat3 in glmatrix seems to be row-based
                mat3.transpose(m3, m3);

                m3[0] /= scale.x;
                m3[1] /= scale.x;
                m3[2] /= scale.x;

                m3[3] /= scale.y;
                m3[4] /= scale.y;
                m3[5] /= scale.y;

                m3[6] /= scale.z;
                m3[7] /= scale.z;
                m3[8] /= scale.z;

                quat.fromMat3(rotation._array, m3);
                quat.normalize(rotation._array, rotation._array);

                scale._dirty = true;
                rotation._dirty = true;
                position._dirty = true;
            }
        })(),

        toString : function() {
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    // Object.defineProperty(Matrix4.prototype, 'm00', makeProperty(0));
    // Object.defineProperty(Matrix4.prototype, 'm01', makeProperty(1));
    // Object.defineProperty(Matrix4.prototype, 'm02', makeProperty(2));
    // Object.defineProperty(Matrix4.prototype, 'm03', makeProperty(3));
    // Object.defineProperty(Matrix4.prototype, 'm10', makeProperty(4));
    // Object.defineProperty(Matrix4.prototype, 'm11', makeProperty(5));
    // Object.defineProperty(Matrix4.prototype, 'm12', makeProperty(6));
    // Object.defineProperty(Matrix4.prototype, 'm13', makeProperty(7));
    // Object.defineProperty(Matrix4.prototype, 'm20', makeProperty(8));
    // Object.defineProperty(Matrix4.prototype, 'm21', makeProperty(9));
    // Object.defineProperty(Matrix4.prototype, 'm22', makeProperty(10));
    // Object.defineProperty(Matrix4.prototype, 'm23', makeProperty(11));
    // Object.defineProperty(Matrix4.prototype, 'm30', makeProperty(12));
    // Object.defineProperty(Matrix4.prototype, 'm31', makeProperty(13));
    // Object.defineProperty(Matrix4.prototype, 'm32', makeProperty(14));
    // Object.defineProperty(Matrix4.prototype, 'm33', makeProperty(15));

    Matrix4.adjoint = function(out, a) {
        mat4.adjoint(out._array, a._array);
        return out;
    }

    Matrix4.copy = function(out, a) {
        mat4.copy(out._array, a._array);
        return out;
    }

    Matrix4.determinant = function(a) {
        return mat4.determinant(a._array);
    }

    Matrix4.identity = function(out) {
        mat4.identity(out._array);
        return out;
    }
    
    Matrix4.ortho = function(out, left, right, bottom, top, near, far) {
        mat4.ortho(out._array, left, right, bottom, top, near, far);
        return out;
    }

    Matrix4.perspective = function(out, fovy, aspect, near, far) {
        mat4.perspective(out._array, fovy, aspect, near, far);
        return out;
    }

    Matrix4.lookAt = function(out, eye, center, up) {
        mat4.lookAt(out._array, eye._array, center._array, up._array);
        return out;
    }

    Matrix4.invert = function(out, a) {
        mat4.invert(out._array, a._array);
        return out;
    }

    Matrix4.mul = function(out, a, b) {
        mat4.mul(out._array, a._array, b._array);
        return out;
    }

    Matrix4.multiply = Matrix4.mul;

    Matrix4.fromQuat = function(out, q) {
        mat4.fromQuat(out._array, q._array);
        return out;
    }

    Matrix4.fromRotationTranslation = function(out, q, v) {
        mat4.fromRotationTranslation(out._array, q._array, v._array);
        return out;
    }

    Matrix4.rotate = function(out, a, rad, axis) {
        mat4.rotate(out._array, a._array, rad, axis._array);
        return out;
    }

    Matrix4.rotateX = function(out, a, rad) {
        mat4.rotateX(out._array, a._array, rad);
        return out;
    }

    Matrix4.rotateY = function(out, a, rad) {
        mat4.rotateY(out._array, a._array, rad);
        return out;
    }

    Matrix4.rotateZ = function(out, a, rad) {
        mat4.rotateZ(out._array, a._array, rad);
        return out;
    }

    Matrix4.scale = function(out, a, v) {
        mat4.scale(out._array, a._array, v._array);
        return out;
    }

    Matrix4.transpose = function(out, a) {
        mat4.transpose(out._array, a._array);
        return out;
    }

    Matrix4.translate = function(out, a, v) {
        mat4.translate(out._array, a._array, v._array);
        return out;
    }

    return Matrix4;
});
define('qtek/math/Matrix3',['require','glmatrix'],function(require) {

    

    var glMatrix = require("glmatrix");
    var mat3 = glMatrix.mat3;

    function makeProperty(n) {
        return {
            configurable : false,
            set : function(value) {
                this._array[n] = value;
                this._dirty = true;
            },
            get : function() {
                return this._array[n];
            }
        }
    }

    var Matrix3 = function() {

        this._array = mat3.create();
    };

    Matrix3.prototype = {

        constructor : Matrix3,

        adjoint : function() {
            mat3.adjoint(this._array, this._array);
            return this;
        },
        clone : function() {
            return (new Matrix3()).copy(this);
        },
        copy : function(b) {
            mat3.copy(this._array, b._array);
            return this;
        },
        determinant : function() {
            return mat3.determinant(this._array);
        },
        fromMat2d : function(a) {
            return mat3.fromMat2d(this._array, a._array);
        },
        fromMat4 : function(a) {
            return mat3.fromMat4(this._array, a._array);
        },
        fromQuat : function(q) {
            mat3.fromQuat(this._array, q._array);
            return this;
        },
        identity : function() {
            mat3.identity(this._array);
            return this;
        },
        invert : function() {
            mat3.invert(this._array, this._array);
            return this;
        },
        mul : function(b) {
            mat3.mul(this._array, this._array, b._array);
            return this;
        },
        mulLeft : function(b) {
            mat3.mul(this._array, b._array, this._array);
            return this;
        },
        multiply : function(b) {
            mat3.multiply(this._array, this._array, b._array);
            return this;
        },
        multiplyLeft : function(b) {
            mat3.multiply(this._array, b._array, this._array);
            return this;
        },
        /**
         * Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
         */
        normalFromMat4 : function(a) {
            mat3.normalFromMat4(this._array, a._array);
            return this;
        },
        transpose : function() {
            mat3.transpose(this._array, this._array);
            return this;
        },
        toString : function() {
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    Matrix3.adjoint = function(out, a) {
        mat3.adjoint(out._array, a._array);
        return out;
    }

    Matrix3.copy = function(out, a) {
        mat3.copy(out._array, a._array);
        return out;
    }

    Matrix3.determinant = function(a) {
        return mat3.determinant(a._array);
    }

    Matrix3.identity = function(out) {
        mat3.identity(out._array);
        return out;
    }

    Matrix3.invert = function(out, a) {
        mat3.invert(out._array, a._array);
        return out;
    }

    Matrix3.mul = function(out, a, b) {
        mat3.mul(out._array, a._array, b._array);
        return out;
    }

    Matrix3.multiply = Matrix3.mul;

    Matrix3.fromMat2d = function(out, a) {
        mat3.fromMat2d(out._array, a._array);
        return out;
    }
    
    Matrix3.fromMat4 = function(out, a) {
        mat3.fromMat4(out._array, a._array);
        return out;
    }

    Matrix3.fromQuat = function(out, q) {
        mat3.fromQuat(out._array, q._array);
        return out;
    }

    Matrix3.normalFromMat4 = function(out, a) {
        mat3.normalFromMat4(out._array, a._array);
        return out;
    }

    Matrix3.rotate = function(out, a, rad) {
        mat3.rotate(out._array, a._array, rad);
        return out;
    }

    Matrix3.scale = function(out, a, v) {
        mat3.scale(out._array, a._array, v._array);
        return out;
    }

    Matrix3.transpose = function(out, a) {
        mat3.transpose(out._array, a._array);
        return out;
    }

    Matrix3.translate = function(out, a, v) {
        mat3.translate(out._array, a._array, v._array);
        return out;
    }

    return Matrix3;
});
define('qtek/Node',['require','./core/Base','./core/util','./math/Vector3','./math/Quaternion','./math/Matrix4','./math/Matrix3','glmatrix'],function(require) {
    
    

    var Base = require("./core/Base");
    var util = require("./core/util");
    var Vector3 = require("./math/Vector3");
    var Quaternion = require("./math/Quaternion");
    var Matrix4 = require("./math/Matrix4");
    var Matrix3 = require("./math/Matrix3");
    var glMatrix = require('glmatrix');
    var mat4 = glMatrix.mat4;

    var nameId = 0;

    var Node = Base.derive({
        
        parent : null,
        
        scene : null,

        autoUpdateLocalTransform : true,

        _needsUpdateWorldTransform : true,

        _inIterating : false,

        // Depth for transparent queue sorting
        __depth : 0

    }, function() {

        if (!this.name) {
            this.name = 'NODE_' + (nameId++);
        }

        if (!this.position) {
            this.position = new Vector3();
        }
        if (!this.rotation) {
            this.rotation = new Quaternion();
        }
        if (!this.scale) {
            this.scale = new Vector3(1, 1, 1);
        }

        this.worldTransform = new Matrix4();
        this.localTransform = new Matrix4();

        this._children = [];

    }, {
        isRenderable : function() {
            return false;
        },

        setName : function(name) {
            if (this.scene) {
                this.scene._nodeRepository[name] = null;
                this.scene._nodeRepository[newName] = this;
            }
            name = newName;
        },

        add : function(node) {
            if (this._inIterating) {
                console.warn('Add operation can cause unpredictable error when in iterating');
            }
            if (node.parent === this) {
                return;
            }
            if (node.parent) {
                node.parent.remove(node);
            }
            node.parent = this;
            this._children.push(node);

            if (this.scene && this.scene !== node.scene) {
                node.traverse(this._addSelfToScene, this);
            }
        },

        remove : function(node) {
            if (this._inIterating) {
                console.warn('Remove operation can cause unpredictable error when in iterating');
            }

            this._children.splice(this._children.indexOf(node), 1);
            node.parent = null;

            if (this.scene) {
                node.traverse(this._removeSelfFromScene, this);
            }
        },

        _removeSelfFromScene : function(descendant) {
            descendant.scene.removeFromScene(descendant);
            descendant.scene = null;
        },

        _addSelfToScene : function(descendant, parent) {
            parent.scene.addToScene(descendant);
            descendant.scene = parent.scene;
        },

        isAscendant : function(node) {
            var parent = node.parent;
            while(parent) {
                if (parent === this) {
                    return true;
                }
                parent = parent.parent;
            }
            return false;
        },

        children : function() {
            return this._children.slice();
        },

        childAt : function(idx) {
            return this._children[idx];
        },

        getChildByName : function(name) {
            for (var i = 0; i < this._children.length; i++) {
                if (this._children[i].name === name) {
                    return this._children[i];
                }
            }
        },

        getDescendantByName : function(name) {
            for (var i = 0; i < this._children.length; i++) {
                var child = this._children[i];
                if (child.name === name) {
                    return child;
                } else {
                    var res = child.getDescendantByName(name);
                    if (res) {
                        return res;
                    }
                }
            }
        },

        // pre-order traverse
        traverse : function(callback, parent) {
            
            this._inIterating = true;

            var stopTraverse = callback(this, parent);
            if(!stopTraverse) {
                var _children = this._children;
                for(var i = 0, len = _children.length; i < len; i++) {
                    _children[i].traverse(callback, this);
                }
            }

            this._inIterating = false;
        },

        setLocalTransform : function(matrix) {
            mat4.copy(this.localTransform._array, matrix._array);
            this.decomposeLocalTransform();
        },

        decomposeLocalTransform : function() {
            this.localTransform.decomposeMatrix(this.scale, this.rotation, this.position);
        },

        setWorldTransform : function(matrix) {
            mat4.copy(this.worldTransform._array, matrix._array);
            this.decomposeWorldTransform();
        },

        decomposeWorldTransform : (function() {
            
            var tmp = mat4.create();

            return function(matrix) {
                // Assume world transform is updated
                if (this.parent) {
                    mat4.invert(tmp, this.parent.worldTransform._array);
                    mat4.multiply(this.localTransform._array, tmp, this.worldTransform._array);
                } else {
                    mat4.copy(this.localTransform._array, matrix._array);
                }
                this.localTransform.decomposeMatrix(this.scale, this.rotation, this.position);
            }
        })(),

        updateLocalTransform : function() {
            var position = this.position;
            var rotation = this.rotation;
            var scale = this.scale;

            if (position._dirty || scale._dirty || rotation._dirty) {
                var m = this.localTransform._array;

                // Transform order, scale->rotation->position
                mat4.fromRotationTranslation(m, rotation._array, position._array);

                mat4.scale(m, m, scale._array);

                rotation._dirty = false;
                scale._dirty = false;
                position._dirty = false;

                this._needsUpdateWorldTransform = true;
            }
        },

        // Update world transform individually
        // Assume its parent world transform have been updated
        updateWorldTransform : function() {
            if (this.parent) {
                mat4.multiply(
                    this.worldTransform._array,
                    this.parent.worldTransform._array,
                    this.localTransform._array
                )
            } else {
                mat4.copy(
                    this.worldTransform._array, this.localTransform._array 
                )
            }
        },

        // Update the node status in each frame
        update : function(force) {
            if (this.autoUpdateLocalTransform) {
                this.updateLocalTransform();
            } else {
                // Transform is manually setted
                force = true;
            }

            if (force || this._needsUpdateWorldTransform) {
                this.updateWorldTransform();
                force = true;
                this._needsUpdateWorldTransform = false;
            }
            
            for(var i = 0, len = this._children.length; i < len; i++) {
                this._children[i].update(force);
            }
        },

        getWorldPosition : function(out) {
            var m = this.worldTransform._array;
            if (out) {
                out._array[0] = m[12];
                out._array[1] = m[13];
                out._array[2] = m[14];
                return out;
            } else {
                return new Vector3(m[12], m[13], m[14]);
            }
        },

        clone : function() {
            // TODO Name
            var node = new this.constructor();
            node.position.copy(this.position);
            node.rotation.copy(this.rotation);
            node.scale.copy(this.scale);

            for (var i = 0; i < this._children.length; i++) {
                node.add(this._children[i].clone());
            }
            return node;
        },

        // http://docs.unity3d.com/Documentation/ScriptReference/Transform.RotateAround.html
        // TODO improve performance
        rotateAround : (function() {
            var v = new Vector3();
            var RTMatrix = new Matrix4();

            return function(point, axis, angle) {

                v.copy(this.position).subtract(point);

                this.localTransform.identity();
                // parent node
                this.localTransform.translate(point);
                this.localTransform.rotate(angle, axis);

                RTMatrix.fromRotationTranslation(this.rotation, v);
                this.localTransform.multiply(RTMatrix);
                this.localTransform.scale(this.scale);

                this.decomposeLocalTransform();
                this._needsUpdateWorldTransform = true;
            }
        })(),

        lookAt : (function() {
            var m = new Matrix4();
            var scaleVector = new Vector3();
            return function(target, up) {
                m.lookAt(this.position, target, up || this.localTransform.up).invert();
                m.decomposeMatrix(scaleVector, this.rotation, this.position);
            }
        })()
    });

    return Node;
});
define('qtek/math/BoundingBox',['require','../core/Base','./Vector3','glmatrix'],function(require) {

    var Base = require("../core/Base");
    var Vector3 = require("./Vector3");
    var glMatrix = require('glmatrix');
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;

    var vec3TransformMat4 = vec3.transformMat4;
    var vec3Copy = vec3.copy;
    var vec3Set = vec3.set;

    var BoundingBox = function(min, max) {
        this.min = min || new Vector3(Infinity, Infinity, Infinity);
        this.max = max || new Vector3(-Infinity, -Infinity, -Infinity);

        // Cube vertices
        var vertices = [];
        for (var i = 0; i < 8; i++) {
            vertices[i] = vec3.fromValues(0, 0, 0);
        }
        this.vertices = vertices;
    }
    BoundingBox.prototype = {
        
        constructor : BoundingBox,

        updateFromVertices : function(vertices) {
            if (vertices.length > 0) {
                var _min = this.min._array;
                var _max = this.max._array;
                vec3Copy(_min, vertices[0]);
                vec3Copy(_max, vertices[0]);
                for (var i = 1; i < vertices.length; i++) {
                    var vertex = vertices[i];

                    _min[0] = Math.min(vertex[0], _min[0]);
                    _min[1] = Math.min(vertex[1], _min[1]);
                    _min[2] = Math.min(vertex[2], _min[2]);

                    _max[0] = Math.max(vertex[0], _max[0]);
                    _max[1] = Math.max(vertex[1], _max[1]);
                    _max[2] = Math.max(vertex[2], _max[2]);
                }
                this.min._dirty = true;
                this.max._dirty = true;
            }
        },

        union : function(bbox) {
            vec3.min(this.min._array, this.min._array, bbox.min._array);
            vec3.max(this.max._array, this.max._array, bbox.max._array);
            this.min._dirty = true;
            this.max._dirty = true;
        },

        intersectBoundingBox : function(bbox) {
            var _min = this.min._array;
            var _max = this.max._array;

            var _min2 = bbox.min._array;
            var _max2 = bbox.max._array;

            return ! (_min[0] > _max2[0] || _min[1] > _max2[1] || _min[2] > _max2[1]
                || _max[0] < _min2[0] || _max[1] < _min2[1] || _max[2] < _min2[2]);
        },

        applyTransform : function(matrix) {
            if (this.min._dirty || this.max._dirty) {
                this.updateVertices();
                this.min._dirty = false;
                this.max._dirty = false;
            }

            var m4 = matrix._array;
            var _min = this.min._array;
            var _max = this.max._array;
            var vertices = this.vertices;

            var v = vertices[0];
            vec3TransformMat4(v, v, m4);
            vec3Copy(_min, v);
            vec3Copy(_max, v);

            for (var i = 1; i < 8; i++) {
                v = vertices[i];
                vec3TransformMat4(v, v, m4);

                _min[0] = Math.min(v[0], _min[0]);
                _min[1] = Math.min(v[1], _min[1]);
                _min[2] = Math.min(v[2], _min[2]);

                _max[0] = Math.max(v[0], _max[0]);
                _max[1] = Math.max(v[1], _max[1]);
                _max[2] = Math.max(v[2], _max[2]);
            }

            this.min._dirty = true;
            this.max._dirty = true;

            return this;
        },

        applyProjection : function(matrix) {
            if (this.min._dirty || this.max._dirty) {
                this.updateVertices();
                this.min._dirty = false;
                this.max._dirty = false;
            }

            var m = matrix._array;
            // min in min z
            var v1 = this.vertices[0];
            // max in min z
            var v2 = this.vertices[3];
            // max in max z
            var v3 = this.vertices[7];

            var _min = this.min._array;
            var _max = this.max._array;

            if (m[15] === 1) {  // Orthographic projection
                _min[0] = m[0] * v1[0] + m[12];
                _min[1] = m[5] * v1[1] + m[13];
                _max[2] = m[10] * v1[2] + m[14];

                _max[0] = m[0] * v3[0] + m[12];
                _max[1] = m[5] * v3[1] + m[13];
                _min[2] = m[10] * v3[2] + m[14];
            } else {
                var w = -1 / v1[2];
                _min[0] = m[0] * v1[0] * w;
                _min[1] = m[5] * v1[1] * w;
                _max[2] = (m[10] * v1[2] + m[14]) * w;

                w = -1 / v2[2];
                _max[0] = m[0] * v2[0] * w;
                _max[1] = m[5] * v2[1] * w;

                w = -1 / v3[2];
                _min[2] = (m[10] * v3[2] + m[14]) * w;
            }
            this.min._dirty = true;
            this.max._dirty = true;

            return this;
        },

        updateVertices : function() {
            var min = this.min._array;
            var max = this.max._array;
            var vertices = this.vertices;
            //--- min z
            // min x
            vec3Set(vertices[0], min[0], min[1], min[2]);
            vec3Set(vertices[1], min[0], max[1], min[2]);
            // max x
            vec3Set(vertices[2], max[0], min[1], min[2]);
            vec3Set(vertices[3], max[0], max[1], min[2]);

            //-- max z
            vec3Set(vertices[4], min[0], min[1], max[2]);
            vec3Set(vertices[5], min[0], max[1], max[2]);
            vec3Set(vertices[6], max[0], min[1], max[2]);
            vec3Set(vertices[7], max[0], max[1], max[2]);
        },

        copy : function(boundingBox) {
            vec3Copy(this.min._array, boundingBox.min._array);
            vec3Copy(this.max._array, boundingBox.max._array);
            this.min._dirty = true;
            this.max._dirty = true;

            return this;
        },

        clone : function() {
            var boundingBox = new BoundingBox();
            boundingBox.copy(this);
            return boundingBox;
        }
    };

    return BoundingBox;
});
define('qtek/math/Plane',['require','./Vector3','glmatrix'],function(require) {

    var Vector3 = require('./Vector3');
    var glmatrix = require('glmatrix');
    var vec3 = glmatrix.vec3;
    var mat4 = glmatrix.mat4;
    var vec4 = glmatrix.vec4;

    var Plane = function(normal, distance) {
        this.normal = normal || new Vector3(0, 1, 0);
        this.distance = distance || 0;
    }

    Plane.prototype = {

        constructor : Plane,

        distanceToPoint : function(point) {
            return vec3.dot(point._array, this.normal._array) - this.distance;
        },

        projectPoint : function(point, out) {
            if (!out) {
                out = new Vector3();
            }
            var d = this.distanceToPoint(point);
            vec3.scaleAndAdd(out._array, point._array, this.normal._array, -d);
            out._dirty = true;
            return out;
        },

        normalize : function() {
            var invLen = 1 / vec3.len(this.normal._array);
            vec3.scale(this.normal._array, invLen);
            this.distance *= invLen;

            return this;
        },

        intersectFrustum : function(frustum) {
            // Check if all coords of frustum is on plane all under plane
            var coords = frustum.vertices;
            var normal = this.normal._array;
            var onPlane = vec3.dot(coords[0]._array, normal) > this.distance;
            for (var i = 1; i < 8; i++) {
                if ((vec3.dot(coords[i]._array, normal) > this.distance) != onPlane) {
                    return true;
                } 
            }
        },

        intersectLine : (function() {
            var rd = vec3.create();
            return function(start, end, out) {
                var d0 = this.distanceToPoint(start);
                var d1 = this.distanceToPoint(end);
                if ((d0 > 0 && d1 > 0) || (d0 < 0 && d1 < 0)) {
                    return null;
                }
                // Ray intersection
                var pn = this.normal._array;
                var d = this.distance;
                var ro = start._array;
                // direction
                vec3.sub(rd, end._array, start._array);
                vec3.normalize(rd, rd);

                var divider = vec3.dot(pn, rd);
                // ray is parallel to the plane
                if (divider == 0) {
                    return null;
                }
                if (!out) {
                    out = new Vector3();
                }
                var t = (vec3.dot(pn, ro) - d) / divider;
                vec3.scaleAndAdd(out._array, ro, rd, -t);
                out._dirty = true;
                return out;
            };
        })(),

        applyTransform : (function() {
            var inverseTranspose = mat4.create();
            var normalv4 = vec4.create();
            var pointv4 = vec4.create();
            pointv4[3] = 1;
            return function(m4) {
                m4 = m4._array;
                // Transform point on plane
                vec3.scale(pointv4, this.normal._array, this.distance);
                vec4.transformMat4(pointv4, pointv4, m4);
                this.distance = vec3.dot(pointv4, this.normal._array);
                // Transform plane normal
                mat4.invert(inverseTranspose, m4);
                mat4.transpose(inverseTranspose, inverseTranspose);
                normalv4[3] = 0;
                vec3.copy(normalv4, this.normal._array);
                vec4.transformMat4(normalv4, normalv4, inverseTranspose);
                vec3.copy(this.normal._array, normalv4);

                return this;
            }
        })(),

        copy : function(plane) {
            vec3.copy(this.normal._array, plane.normal._array);
            this.normal._dirty = true;
            this.distance = plane.distance;
            return this;
        },

        clone : function() {
            var plane = new Plane();
            plane.copy(this);
            return plane;
        }
    }

    return Plane;
});
define('qtek/math/Frustum',['require','./Vector3','./BoundingBox','./Plane','glmatrix'],function(require) {

    var Vector3 = require('./Vector3');
    var BoundingBox = require('./BoundingBox');
    var Plane = require('./Plane');
    var glmatrix = require('glmatrix');

    var vec3 = glmatrix.vec3;

    var Frustum = function() {

        this.planes = [];

        for (var i = 0; i < 6; i++) {
            this.planes.push(new Plane());
        }

        this.boundingBox = new BoundingBox();

        this.vertices = [];
        for (var i = 0; i < 8; i++) {
            this.vertices[i] = vec3.fromValues(0, 0, 0);
        }
    };

    Frustum.prototype = {

        // http://web.archive.org/web/20120531231005/http://crazyjoke.free.fr/doc/3D/plane%20extraction.pdf
        setFromProjection : function(projectionMatrix) {

            var planes = this.planes;
            var m = projectionMatrix._array;
            var m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3];
            var m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7];
            var m8 = m[8], m9 = m[9], m10 = m[10], m11 = m[11];
            var m12 = m[12], m13 = m[13], m14 = m[14], m15 = m[15];

            // Update planes
            vec3.set(planes[0].normal._array, m3 - m0, m7 - m4, m11 - m8);
            planes[0].distance = -(m15 - m12);
            planes[0].normalize();

            vec3.set(planes[1].normal._array, m3 + m0, m7 + m4, m11 + m8);
            planes[1].distance = -(m15 + m12);
            planes[1].normalize();
            
            vec3.set(planes[2].normal._array, m3 + m1, m7 + m5, m11 + m9);
            planes[2].distance = -(m15 + m13);
            planes[2].normalize();
            
            vec3.set(planes[3].normal._array, m3 - m1, m7 - m5, m11 - m9);
            planes[3].distance = -(m15 - m13);
            planes[3].normalize();
            
            vec3.set(planes[4].normal._array, m3 - m2, m7 - m6, m11 - m10);
            planes[4].distance = -(m15 - m14);
            planes[4].normalize();
            
            vec3.set(planes[5].normal._array, m3 + m2, m7 + m6, m11 + m10);
            planes[5].distance = -(m15 + m14);
            planes[5].normalize();

            // Perspective projection
            if (m15 === 0)  {
                var aspect = m5 / m0;
                var zNear = -m14 / (m10 - 1);
                var zFar = -m14 / (m10 + 1);
                var farY = -zFar / m5;
                var nearY = -zNear / m5;
                // Update bounding box
                this.boundingBox.min.set(-farY * aspect, -farY, zFar);
                this.boundingBox.max.set(farY * aspect, farY, zNear);
                // update vertices
                var vertices = this.vertices;
                //--- min z
                // min x
                vec3.set(vertices[0], -farY * aspect, -farY, zFar);
                vec3.set(vertices[1], -farY * aspect, farY, zFar);
                // max x
                vec3.set(vertices[2], farY * aspect, -farY, zFar);
                vec3.set(vertices[3], farY * aspect, farY, zFar);
                //-- max z
                vec3.set(vertices[4], -nearY * aspect, -nearY, zNear);
                vec3.set(vertices[5], -nearY * aspect, nearY, zNear);
                vec3.set(vertices[6], nearY * aspect, -nearY, zNear);
                vec3.set(vertices[7], nearY * aspect, nearY, zNear);
            } else { // Orthographic projection
                var left = (-1 - m12) / m0;
                var right = (1 - m12) / m0;
                var top = (1 - m13) / m5;
                var bottom = (-1 - m13) / m5;
                var near = (-1 - m14) / m10;
                var far = (1 - m14) / m10;

                this.boundingBox.min.set(left, bottom, far);
                this.boundingBox.max.set(right, top, near);
                // Copy the vertices from bounding box directly
                for (var i = 0; i < 8; i++) {
                    vec3.copy(this.vertices[i], this.boundingBox.vertices[i]);
                }
            }

            return this;
        },

        getTransformedBoundingBox : (function() {
            
            var tmpVec3 = vec3.create();

            return function(bbox, matrix) {
                var vertices = this.vertices;

                var m4 = matrix._array;
                var _min = bbox.min._array;
                var _max = bbox.max._array;
                var v = vertices[0];
                vec3.transformMat4(tmpVec3, v, m4);
                vec3.copy(_min, tmpVec3);
                vec3.copy(_max, tmpVec3);

                for (var i = 1; i < 8; i++) {
                    v = vertices[i];
                    vec3.transformMat4(tmpVec3, v, m4);

                    _min[0] = Math.min(tmpVec3[0], _min[0]);
                    _min[1] = Math.min(tmpVec3[1], _min[1]);
                    _min[2] = Math.min(tmpVec3[2], _min[2]);

                    _max[0] = Math.max(tmpVec3[0], _max[0]);
                    _max[1] = Math.max(tmpVec3[1], _max[1]);
                    _max[2] = Math.max(tmpVec3[2], _max[2]);
                }

                bbox.min._dirty = true;
                bbox.max._dirty = true;
            };
        }) ()
    }
    return Frustum;
});
define('qtek/math/Ray',['require','../core/Base','./Vector3','glmatrix'],function(require) {

    var Base = require('../core/Base');
    var Vector3 = require('./Vector3');
    var glMatrix = require('glmatrix');
    var vec3 = glMatrix.vec3;

    var Ray = function(origin, direction) {
        this.origin = origin || new Vector3();
        this.direction = direction || new Vector3();
    }
    Ray.prototype = {
        
        constructor : Ray,

        // http://www.siggraph.org/education/materials/HyperGraph/raytrace/rayplane_intersection.htm
        intersectPlane : function(plane, out) {
            var pn = plane.normal._array;
            var d = plane.distance;
            var ro = this.origin._array;
            var rd = this.direction._array;

            var divider = vec3.dot(pn, rd);
            // ray is parallel to the plane
            if (divider == 0) {
                return null;
            }
            if (!out) {
                out = new Vector3();
            }
            var t = (vec3.dot(pn, ro) - d) / divider;
            vec3.scaleAndAdd(out._array, ro, rd, -t);
            out._dirty = true;
            return out;
        },

        // Mirror the ray against plane
        mirrorAgainstPlane : function(plane) {
            // Distance to plane
            var d = vec3.dot(plane.normal._array, this.direction._array);
            vec3.scaleAndAdd(this.direction._array, this.direction._array, plane.normal._array, -d * 2);
            this.direction_dirty = true;
            return this;
        },

        // http://www.graphics.cornell.edu/pubs/1997/MT97.html
        intersectTriangle : function() {
            
        }
    };

    return Ray;
});
define('qtek/Camera',['require','./Node','./math/Matrix4','./math/Frustum','./math/BoundingBox','./math/Ray','glmatrix'],function(require) {

    var Node = require("./Node");
    var Matrix4 = require("./math/Matrix4");
    var Frustum = require("./math/Frustum");
    var BoundingBox = require("./math/BoundingBox");
    var Ray = require("./math/Ray");

    var glMatrix = require('glmatrix');
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var vec4 = glMatrix.vec4;

    var Camera = Node.derive(function() {
        return {
            
            projectionMatrix : new Matrix4(),

            invProjectionMatrix : new Matrix4(),

            viewMatrix : new Matrix4(),

            // Frustum bounding box in view space
            frustum : new Frustum(),

            // Scene bounding box in view space
            // mainly for the camera to adujst the near and far plane,
            // so that the view frustum contains the visible objects as tightly as possible.
            // Notice:
            //  updated after rendering (in the step of frustum culling passingly)
            //  So may be not so accurate, but saved a lot of calculation !!
            //  TODO : In case of one camera to multiple scenes
            sceneBoundingBoxLastFrame : new BoundingBox()
        }
    }, function() {
        this.update(true);
    }, {
        
        update : function(force) {
            Node.prototype.update.call(this, force);
            mat4.invert(this.viewMatrix._array, this.worldTransform._array);
            
            this.updateProjectionMatrix();
            mat4.invert(this.invProjectionMatrix._array, this.projectionMatrix._array);

            this.frustum.setFromProjection(this.projectionMatrix);
        },
        updateProjectionMatrix : function(){},

        castRay : (function() {
            var v4 = vec4.create();
            return function(ndc, out) {
                var ray = out !== undefined ? out : new Ray();
                var x = ndc._array[0];
                var y = ndc._array[1];
                vec4.set(v4, x, y, -1, 1);
                vec4.transformMat4(v4, v4, this.invProjectionMatrix._array);
                vec4.transformMat4(v4, v4, this.worldTransform._array);
                vec3.scale(ray.origin._array, v4, 1 / v4[3]);

                vec4.set(v4, x, y, 1, 1);
                vec4.transformMat4(v4, v4, this.invProjectionMatrix._array);
                vec4.transformMat4(v4, v4, this.worldTransform._array);
                vec3.scale(v4, v4, 1 / v4[3]);
                vec3.sub(ray.direction._array, v4, ray.origin._array);

                vec3.normalize(ray.direction._array, ray.direction._array);
                ray.direction._dirty = true;
                ray.origin._dirty = true;
                
                return ray;
            }
        })()
    });

    return Camera;
});
/**
 * http://www.khronos.org/registry/webgl/specs/latest/1.0/#5.14
 */
define('qtek/core/glenum',[],function() {

return {
    /* ClearBufferMask */
    DEPTH_BUFFER_BIT               : 0x00000100,
    STENCIL_BUFFER_BIT             : 0x00000400,
    COLOR_BUFFER_BIT               : 0x00004000,
    
    /* BeginMode */
    POINTS                         : 0x0000,
    LINES                          : 0x0001,
    LINE_LOOP                      : 0x0002,
    LINE_STRIP                     : 0x0003,
    TRIANGLES                      : 0x0004,
    TRIANGLE_STRIP                 : 0x0005,
    TRIANGLE_FAN                   : 0x0006,
    
    /* AlphaFunction (not supported in ES20) */
    /*      NEVER */
    /*      LESS */
    /*      EQUAL */
    /*      LEQUAL */
    /*      GREATER */
    /*      NOTEQUAL */
    /*      GEQUAL */
    /*      ALWAYS */
    
    /* BlendingFactorDest */
    ZERO                           : 0,
    ONE                            : 1,
    SRC_COLOR                      : 0x0300,
    ONE_MINUS_SRC_COLOR            : 0x0301,
    SRC_ALPHA                      : 0x0302,
    ONE_MINUS_SRC_ALPHA            : 0x0303,
    DST_ALPHA                      : 0x0304,
    ONE_MINUS_DST_ALPHA            : 0x0305,
    
    /* BlendingFactorSrc */
    /*      ZERO */
    /*      ONE */
    DST_COLOR                      : 0x0306,
    ONE_MINUS_DST_COLOR            : 0x0307,
    SRC_ALPHA_SATURATE             : 0x0308,
    /*      SRC_ALPHA */
    /*      ONE_MINUS_SRC_ALPHA */
    /*      DST_ALPHA */
    /*      ONE_MINUS_DST_ALPHA */
    
    /* BlendEquationSeparate */
    FUNC_ADD                       : 0x8006,
    BLEND_EQUATION                 : 0x8009,
    BLEND_EQUATION_RGB             : 0x8009, /* same as BLEND_EQUATION */
    BLEND_EQUATION_ALPHA           : 0x883D,
    
    /* BlendSubtract */
    FUNC_SUBTRACT                  : 0x800A,
    FUNC_REVERSE_SUBTRACT          : 0x800B,
    
    /* Separate Blend Functions */
    BLEND_DST_RGB                  : 0x80C8,
    BLEND_SRC_RGB                  : 0x80C9,
    BLEND_DST_ALPHA                : 0x80CA,
    BLEND_SRC_ALPHA                : 0x80CB,
    CONSTANT_COLOR                 : 0x8001,
    ONE_MINUS_CONSTANT_COLOR       : 0x8002,
    CONSTANT_ALPHA                 : 0x8003,
    ONE_MINUS_CONSTANT_ALPHA       : 0x8004,
    BLEND_COLOR                    : 0x8005,
    
    /* Buffer Objects */
    ARRAY_BUFFER                   : 0x8892,
    ELEMENT_ARRAY_BUFFER           : 0x8893,
    ARRAY_BUFFER_BINDING           : 0x8894,
    ELEMENT_ARRAY_BUFFER_BINDING   : 0x8895,
    
    STREAM_DRAW                    : 0x88E0,
    STATIC_DRAW                    : 0x88E4,
    DYNAMIC_DRAW                   : 0x88E8,
    
    BUFFER_SIZE                    : 0x8764,
    BUFFER_USAGE                   : 0x8765,
    
    CURRENT_VERTEX_ATTRIB          : 0x8626,
    
    /* CullFaceMode */
    FRONT                          : 0x0404,
    BACK                           : 0x0405,
    FRONT_AND_BACK                 : 0x0408,
    
    /* DepthFunction */
    /*      NEVER */
    /*      LESS */
    /*      EQUAL */
    /*      LEQUAL */
    /*      GREATER */
    /*      NOTEQUAL */
    /*      GEQUAL */
    /*      ALWAYS */
    
    /* EnableCap */
    /* TEXTURE_2D */
    CULL_FACE                      : 0x0B44,
    BLEND                          : 0x0BE2,
    DITHER                         : 0x0BD0,
    STENCIL_TEST                   : 0x0B90,
    DEPTH_TEST                     : 0x0B71,
    SCISSOR_TEST                   : 0x0C11,
    POLYGON_OFFSET_FILL            : 0x8037,
    SAMPLE_ALPHA_TO_COVERAGE       : 0x809E,
    SAMPLE_COVERAGE                : 0x80A0,
    
    /* ErrorCode */
    NO_ERROR                       : 0,
    INVALID_ENUM                   : 0x0500,
    INVALID_VALUE                  : 0x0501,
    INVALID_OPERATION              : 0x0502,
    OUT_OF_MEMORY                  : 0x0505,
    
    /* FrontFaceDirection */
    CW                             : 0x0900,
    CCW                            : 0x0901,
    
    /* GetPName */
    LINE_WIDTH                     : 0x0B21,
    ALIASED_POINT_SIZE_RANGE       : 0x846D,
    ALIASED_LINE_WIDTH_RANGE       : 0x846E,
    CULL_FACE_MODE                 : 0x0B45,
    FRONT_FACE                     : 0x0B46,
    DEPTH_RANGE                    : 0x0B70,
    DEPTH_WRITEMASK                : 0x0B72,
    DEPTH_CLEAR_VALUE              : 0x0B73,
    DEPTH_FUNC                     : 0x0B74,
    STENCIL_CLEAR_VALUE            : 0x0B91,
    STENCIL_FUNC                   : 0x0B92,
    STENCIL_FAIL                   : 0x0B94,
    STENCIL_PASS_DEPTH_FAIL        : 0x0B95,
    STENCIL_PASS_DEPTH_PASS        : 0x0B96,
    STENCIL_REF                    : 0x0B97,
    STENCIL_VALUE_MASK             : 0x0B93,
    STENCIL_WRITEMASK              : 0x0B98,
    STENCIL_BACK_FUNC              : 0x8800,
    STENCIL_BACK_FAIL              : 0x8801,
    STENCIL_BACK_PASS_DEPTH_FAIL   : 0x8802,
    STENCIL_BACK_PASS_DEPTH_PASS   : 0x8803,
    STENCIL_BACK_REF               : 0x8CA3,
    STENCIL_BACK_VALUE_MASK        : 0x8CA4,
    STENCIL_BACK_WRITEMASK         : 0x8CA5,
    VIEWPORT                       : 0x0BA2,
    SCISSOR_BOX                    : 0x0C10,
    /*      SCISSOR_TEST */
    COLOR_CLEAR_VALUE              : 0x0C22,
    COLOR_WRITEMASK                : 0x0C23,
    UNPACK_ALIGNMENT               : 0x0CF5,
    PACK_ALIGNMENT                 : 0x0D05,
    MAX_TEXTURE_SIZE               : 0x0D33,
    MAX_VIEWPORT_DIMS              : 0x0D3A,
    SUBPIXEL_BITS                  : 0x0D50,
    RED_BITS                       : 0x0D52,
    GREEN_BITS                     : 0x0D53,
    BLUE_BITS                      : 0x0D54,
    ALPHA_BITS                     : 0x0D55,
    DEPTH_BITS                     : 0x0D56,
    STENCIL_BITS                   : 0x0D57,
    POLYGON_OFFSET_UNITS           : 0x2A00,
    /*      POLYGON_OFFSET_FILL */
    POLYGON_OFFSET_FACTOR          : 0x8038,
    TEXTURE_BINDING_2D             : 0x8069,
    SAMPLE_BUFFERS                 : 0x80A8,
    SAMPLES                        : 0x80A9,
    SAMPLE_COVERAGE_VALUE          : 0x80AA,
    SAMPLE_COVERAGE_INVERT         : 0x80AB,
    
    /* GetTextureParameter */
    /*      TEXTURE_MAG_FILTER */
    /*      TEXTURE_MIN_FILTER */
    /*      TEXTURE_WRAP_S */
    /*      TEXTURE_WRAP_T */
    
    COMPRESSED_TEXTURE_FORMATS     : 0x86A3,
    
    /* HintMode */
    DONT_CARE                      : 0x1100,
    FASTEST                        : 0x1101,
    NICEST                         : 0x1102,
    
    /* HintTarget */
    GENERATE_MIPMAP_HINT            : 0x8192,
    
    /* DataType */
    BYTE                           : 0x1400,
    UNSIGNED_BYTE                  : 0x1401,
    SHORT                          : 0x1402,
    UNSIGNED_SHORT                 : 0x1403,
    INT                            : 0x1404,
    UNSIGNED_INT                   : 0x1405,
    FLOAT                          : 0x1406,
    
    /* PixelFormat */
    DEPTH_COMPONENT                : 0x1902,
    ALPHA                          : 0x1906,
    RGB                            : 0x1907,
    RGBA                           : 0x1908,
    LUMINANCE                      : 0x1909,
    LUMINANCE_ALPHA                : 0x190A,
    
    /* PixelType */
    /*      UNSIGNED_BYTE */
    UNSIGNED_SHORT_4_4_4_4         : 0x8033,
    UNSIGNED_SHORT_5_5_5_1         : 0x8034,
    UNSIGNED_SHORT_5_6_5           : 0x8363,
    
    /* Shaders */
    FRAGMENT_SHADER                  : 0x8B30,
    VERTEX_SHADER                    : 0x8B31,
    MAX_VERTEX_ATTRIBS               : 0x8869,
    MAX_VERTEX_UNIFORM_VECTORS       : 0x8DFB,
    MAX_VARYING_VECTORS              : 0x8DFC,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS : 0x8B4D,
    MAX_VERTEX_TEXTURE_IMAGE_UNITS   : 0x8B4C,
    MAX_TEXTURE_IMAGE_UNITS          : 0x8872,
    MAX_FRAGMENT_UNIFORM_VECTORS     : 0x8DFD,
    SHADER_TYPE                      : 0x8B4F,
    DELETE_STATUS                    : 0x8B80,
    LINK_STATUS                      : 0x8B82,
    VALIDATE_STATUS                  : 0x8B83,
    ATTACHED_SHADERS                 : 0x8B85,
    ACTIVE_UNIFORMS                  : 0x8B86,
    ACTIVE_ATTRIBUTES                : 0x8B89,
    SHADING_LANGUAGE_VERSION         : 0x8B8C,
    CURRENT_PROGRAM                  : 0x8B8D,
    
    /* StencilFunction */
    NEVER                          : 0x0200,
    LESS                           : 0x0201,
    EQUAL                          : 0x0202,
    LEQUAL                         : 0x0203,
    GREATER                        : 0x0204,
    NOTEQUAL                       : 0x0205,
    GEQUAL                         : 0x0206,
    ALWAYS                         : 0x0207,
    
    /* StencilOp */
    /*      ZERO */
    KEEP                           : 0x1E00,
    REPLACE                        : 0x1E01,
    INCR                           : 0x1E02,
    DECR                           : 0x1E03,
    INVERT                         : 0x150A,
    INCR_WRAP                      : 0x8507,
    DECR_WRAP                      : 0x8508,
    
    /* StringName */
    VENDOR                         : 0x1F00,
    RENDERER                       : 0x1F01,
    VERSION                        : 0x1F02,
    
    /* TextureMagFilter */
    NEAREST                        : 0x2600,
    LINEAR                         : 0x2601,
    
    /* TextureMinFilter */
    /*      NEAREST */
    /*      LINEAR */
    NEAREST_MIPMAP_NEAREST         : 0x2700,
    LINEAR_MIPMAP_NEAREST          : 0x2701,
    NEAREST_MIPMAP_LINEAR          : 0x2702,
    LINEAR_MIPMAP_LINEAR           : 0x2703,
    
    /* TextureParameterName */
    TEXTURE_MAG_FILTER             : 0x2800,
    TEXTURE_MIN_FILTER             : 0x2801,
    TEXTURE_WRAP_S                 : 0x2802,
    TEXTURE_WRAP_T                 : 0x2803,
    
    /* TextureTarget */
    TEXTURE_2D                     : 0x0DE1,
    TEXTURE                        : 0x1702,
    
    TEXTURE_CUBE_MAP               : 0x8513,
    TEXTURE_BINDING_CUBE_MAP       : 0x8514,
    TEXTURE_CUBE_MAP_POSITIVE_X    : 0x8515,
    TEXTURE_CUBE_MAP_NEGATIVE_X    : 0x8516,
    TEXTURE_CUBE_MAP_POSITIVE_Y    : 0x8517,
    TEXTURE_CUBE_MAP_NEGATIVE_Y    : 0x8518,
    TEXTURE_CUBE_MAP_POSITIVE_Z    : 0x8519,
    TEXTURE_CUBE_MAP_NEGATIVE_Z    : 0x851A,
    MAX_CUBE_MAP_TEXTURE_SIZE      : 0x851C,
    
    /* TextureUnit */
    TEXTURE0                       : 0x84C0,
    TEXTURE1                       : 0x84C1,
    TEXTURE2                       : 0x84C2,
    TEXTURE3                       : 0x84C3,
    TEXTURE4                       : 0x84C4,
    TEXTURE5                       : 0x84C5,
    TEXTURE6                       : 0x84C6,
    TEXTURE7                       : 0x84C7,
    TEXTURE8                       : 0x84C8,
    TEXTURE9                       : 0x84C9,
    TEXTURE10                      : 0x84CA,
    TEXTURE11                      : 0x84CB,
    TEXTURE12                      : 0x84CC,
    TEXTURE13                      : 0x84CD,
    TEXTURE14                      : 0x84CE,
    TEXTURE15                      : 0x84CF,
    TEXTURE16                      : 0x84D0,
    TEXTURE17                      : 0x84D1,
    TEXTURE18                      : 0x84D2,
    TEXTURE19                      : 0x84D3,
    TEXTURE20                      : 0x84D4,
    TEXTURE21                      : 0x84D5,
    TEXTURE22                      : 0x84D6,
    TEXTURE23                      : 0x84D7,
    TEXTURE24                      : 0x84D8,
    TEXTURE25                      : 0x84D9,
    TEXTURE26                      : 0x84DA,
    TEXTURE27                      : 0x84DB,
    TEXTURE28                      : 0x84DC,
    TEXTURE29                      : 0x84DD,
    TEXTURE30                      : 0x84DE,
    TEXTURE31                      : 0x84DF,
    ACTIVE_TEXTURE                 : 0x84E0,
    
    /* TextureWrapMode */
    REPEAT                         : 0x2901,
    CLAMP_TO_EDGE                  : 0x812F,
    MIRRORED_REPEAT                : 0x8370,
    
    /* Uniform Types */
    FLOAT_VEC2                     : 0x8B50,
    FLOAT_VEC3                     : 0x8B51,
    FLOAT_VEC4                     : 0x8B52,
    INT_VEC2                       : 0x8B53,
    INT_VEC3                       : 0x8B54,
    INT_VEC4                       : 0x8B55,
    BOOL                           : 0x8B56,
    BOOL_VEC2                      : 0x8B57,
    BOOL_VEC3                      : 0x8B58,
    BOOL_VEC4                      : 0x8B59,
    FLOAT_MAT2                     : 0x8B5A,
    FLOAT_MAT3                     : 0x8B5B,
    FLOAT_MAT4                     : 0x8B5C,
    SAMPLER_2D                     : 0x8B5E,
    SAMPLER_CUBE                   : 0x8B60,
    
    /* Vertex Arrays */
    VERTEX_ATTRIB_ARRAY_ENABLED        : 0x8622,
    VERTEX_ATTRIB_ARRAY_SIZE           : 0x8623,
    VERTEX_ATTRIB_ARRAY_STRIDE         : 0x8624,
    VERTEX_ATTRIB_ARRAY_TYPE           : 0x8625,
    VERTEX_ATTRIB_ARRAY_NORMALIZED     : 0x886A,
    VERTEX_ATTRIB_ARRAY_POINTER        : 0x8645,
    VERTEX_ATTRIB_ARRAY_BUFFER_BINDING : 0x889F,
    
    /* Shader Source */
    COMPILE_STATUS                 : 0x8B81,
    
    /* Shader Precision-Specified Types */
    LOW_FLOAT                      : 0x8DF0,
    MEDIUM_FLOAT                   : 0x8DF1,
    HIGH_FLOAT                     : 0x8DF2,
    LOW_INT                        : 0x8DF3,
    MEDIUM_INT                     : 0x8DF4,
    HIGH_INT                       : 0x8DF5,
    
    /* Framebuffer Object. */
    FRAMEBUFFER                    : 0x8D40,
    RENDERBUFFER                   : 0x8D41,
    
    RGBA4                          : 0x8056,
    RGB5_A1                        : 0x8057,
    RGB565                         : 0x8D62,
    DEPTH_COMPONENT16              : 0x81A5,
    STENCIL_INDEX                  : 0x1901,
    STENCIL_INDEX8                 : 0x8D48,
    DEPTH_STENCIL                  : 0x84F9,
    
    RENDERBUFFER_WIDTH             : 0x8D42,
    RENDERBUFFER_HEIGHT            : 0x8D43,
    RENDERBUFFER_INTERNAL_FORMAT   : 0x8D44,
    RENDERBUFFER_RED_SIZE          : 0x8D50,
    RENDERBUFFER_GREEN_SIZE        : 0x8D51,
    RENDERBUFFER_BLUE_SIZE         : 0x8D52,
    RENDERBUFFER_ALPHA_SIZE        : 0x8D53,
    RENDERBUFFER_DEPTH_SIZE        : 0x8D54,
    RENDERBUFFER_STENCIL_SIZE      : 0x8D55,
    
    FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE           : 0x8CD0,
    FRAMEBUFFER_ATTACHMENT_OBJECT_NAME           : 0x8CD1,
    FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL         : 0x8CD2,
    FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE : 0x8CD3,
    
    COLOR_ATTACHMENT0              : 0x8CE0,
    DEPTH_ATTACHMENT               : 0x8D00,
    STENCIL_ATTACHMENT             : 0x8D20,
    DEPTH_STENCIL_ATTACHMENT       : 0x821A,
    
    NONE                           : 0,
    
    FRAMEBUFFER_COMPLETE                      : 0x8CD5,
    FRAMEBUFFER_INCOMPLETE_ATTACHMENT         : 0x8CD6,
    FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT : 0x8CD7,
    FRAMEBUFFER_INCOMPLETE_DIMENSIONS         : 0x8CD9,
    FRAMEBUFFER_UNSUPPORTED                   : 0x8CDD,
    
    FRAMEBUFFER_BINDING            : 0x8CA6,
    RENDERBUFFER_BINDING           : 0x8CA7,
    MAX_RENDERBUFFER_SIZE          : 0x84E8,
    
    INVALID_FRAMEBUFFER_OPERATION  : 0x0506,
    
    /* WebGL-specific enums */
    UNPACK_FLIP_Y_WEBGL            : 0x9240,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL : 0x9241,
    CONTEXT_LOST_WEBGL             : 0x9242,
    UNPACK_COLORSPACE_CONVERSION_WEBGL : 0x9243,
    BROWSER_DEFAULT_WEBGL          : 0x9244,
}
});
define('qtek/Geometry',['require','./core/Base','./core/util','./core/glenum','./core/Cache'],function(require) {
    
    'use strict'

    var Base = require("./core/Base");
    var util = require("./core/util");
    var glenum = require("./core/glenum");
    var Cache = require("./core/Cache");

    function Attribute(name, type, size, semantic, isDynamic) {
        this.name = name;
        this.type = type;
        this.size = size;
        if (semantic) {
            this.semantic = semantic;
        }
        if (isDynamic) {
            this._isDynamic = true;
            this.value = [];
        } else {
            this._isDynamic = false;
            this.value = null
        }

    }

    Attribute.prototype.clone = function(copyValue) {
        var ret = new Attribute(this.name, this.type, this.size, this.semantic, this._isDynamic);
        if (copyValue) {
            console.warn('todo');
        }
    }

    function AttributeBuffer(name, type, buffer, size, semantic) {
        this.name = name;
        this.type = type;
        this.buffer = buffer;
        this.size = size;
        this.semantic = semantic;

        // To be set in mesh
        // symbol in the shader
        this.symbol = '';
    }

    function IndicesBuffer(buffer, count) {
        this.buffer = buffer;
        this.count = count;
    }

    function notImplementedWarn() {
        console.warn('Geometry doesn\'t implement this method, use DynamicGeometry or StaticGeometry instead');
    }

    var Geometry = Base.derive(function() {
        return {     
            boundingBox : null,
            
            attributes : {},

            faces : null,

            useFace : true,

            //Max Value of Uint16, i.e. 0xffff
            chunkSize : 65535,
        }
    }, function() {
        // Use cache
        this.cache = new Cache();
    }, {
        dirty : notImplementedWarn,
        getVertexNumber : notImplementedWarn,
        getFaceNumber : notImplementedWarn,
        isUseFace : notImplementedWarn,
        isStatic : notImplementedWarn,
        getEnabledAttributes : notImplementedWarn,
        getBufferChunks : notImplementedWarn,
        generateVertexNormals : notImplementedWarn,
        generateFaceNormals : notImplementedWarn,
        isUniqueVertex : notImplementedWarn,
        generateUniqueVertex : notImplementedWarn,
        generateTangents : notImplementedWarn,
        generateBarycentric : notImplementedWarn,
        applyTransform : notImplementedWarn,
        dispose : notImplementedWarn
    });

    Geometry.STATIC_DRAW = glenum.STATIC_DRAW;
    Geometry.DYNAMIC_DRAW = glenum.DYNAMIC_DRAW;
    Geometry.STREAM_DRAW = glenum.STREAM_DRAW;

    Geometry.AttributeBuffer = AttributeBuffer;
    Geometry.IndicesBuffer = IndicesBuffer;
    Geometry.Attribute = Attribute;

    return Geometry
});
/**
 *
 * PENDING: use perfermance hint and remove the array after the data is transfered?
 * static draw & dynamic draw?
 */
define('qtek/DynamicGeometry',['require','./Geometry','./core/util','./math/Vector3','./math/BoundingBox','./core/glenum','glmatrix'],function(require) {

    'use strict'

    var Geometry = require("./Geometry");
    var util = require("./core/util");
    var Vector3 = require("./math/Vector3");
    var BoundingBox = require("./math/BoundingBox");
    var glenum = require("./core/glenum");
    var glMatrix = require("glmatrix");
    var vec3 = glMatrix.vec3;
    var vec2 = glMatrix.vec2;
    var mat2 = glMatrix.mat2;
    var mat4 = glMatrix.mat4;

    var arrSlice = Array.prototype.slice;

    var DynamicGeometry = Geometry.derive(function() {
        return {
            attributes : {
                 position : new Geometry.Attribute('position', 'float', 3, 'POSITION', true),
                 texcoord0 : new Geometry.Attribute('texcoord0', 'float', 2, 'TEXCOORD_0', true),
                 texcoord1 : new Geometry.Attribute('texcoord1', 'float', 2, 'TEXCOORD_1', true),
                 normal : new Geometry.Attribute('normal', 'float', 3, 'NORMAL', true),
                 tangent : new Geometry.Attribute('tangent', 'float', 4, 'TANGENT', true),
                 color : new Geometry.Attribute('color', 'float', 4, 'COLOR', true),
                 // Skinning attributes
                 // Each vertex can be bind to 4 bones, because the 
                 // sum of weights is 1, so the weights is stored in vec3 and the last
                 // can be calculated by 1-w.x-w.y-w.z
                 weight : new Geometry.Attribute('weight', 'float', 3, 'WEIGHT', true),
                 joint : new Geometry.Attribute('joint', 'float', 4, 'JOINT', true),
                 // For wireframe display
                 // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
                 barycentric : new Geometry.Attribute('barycentric', 'float', 3, null, true),
            },

            hint : glenum.DYNAMIC_DRAW,

            // Face is list of triangles, each face
            // is an array of the vertex indices of triangle
            faces : [],
            
            _enabledAttributes : null,

            // Typed Array of each geometry chunk
            // [{
            //     attributeArrays:{
            //         position : TypedArray
            //     },
            //     indicesArray : null
            // }]
            _arrayChunks : []
        }
    }, {
        updateBoundingBox : function() {
            if (!this.boundingBox) {
                this.boundingBox = new BoundingBox();
            }
            this.boundingBox.updateFromVertices(this.attributes.position.value);
        },
        // Overwrite the dirty method
        dirty : function(field) {
            if (! field) {
                this.dirty("indices");
                for (var name in this.attributes) {
                    this.dirty(name);
                }
                return;
            }
            this.cache.dirtyAll(field);

            this._enabledAttributes = null;
        },

        getVertexNumber : function() {
            return this.attributes.position.value.length;
        },

        getFaceNumber : function() {
            return this.faces.length;
        },

        isUseFace : function() {
            return this.useFace && (this.faces.length > 0);
        },

        isSplitted : function() {
            return this.getVertexNumber() > this.chunkSize;
        },
        
        isStatic : function() {
            return false;
        },

        getEnabledAttributes : function() {
            // Cache
            if (this._enabledAttributes) {
                return this._enabledAttributes;
            }

            var result = {};
            var nVertex = this.getVertexNumber();

            for (var name in this.attributes) {
                var attrib = this.attributes[name];
                if (attrib.value.length) {
                    if (attrib.value.length === nVertex) {
                        result[name] = attrib;
                    }
                }
            }

            this._enabledAttributes = result;

            return result;
        },

        _getDirtyAttributes : function() {

            var attributes = this.getEnabledAttributes();
            
            if (this.cache.miss('chunks')) {
                return attributes;
            } else {
                var result = {};
                var noDirtyAttributes = true;
                for (var name in attributes) {
                    var attrib = attributes[name];
                    if (this.cache.isDirty(name)) {
                        result[name] = attributes[name];
                        noDirtyAttributes = false;
                    }
                }
                if (! noDirtyAttributes) {
                    return result;
                }
            }
        },

        getChunkNumber : function() {
            return this._arrayChunks.length;
        },

        getBufferChunks : function(_gl) {

            this.cache.use(_gl.__GLID__);

            var dirtyAttributes = this._getDirtyAttributes();

            var isFacesDirty = this.cache.isDirty('indices');
            isFacesDirty = isFacesDirty && this.isUseFace();
            
            if (dirtyAttributes) {
                this._updateAttributesAndIndicesArrays(dirtyAttributes, isFacesDirty);
                this._updateBuffer(_gl, dirtyAttributes, isFacesDirty);

                for (var name in dirtyAttributes) {
                    this.cache.fresh(name);
                }
                this.cache.fresh('indices');
            }
            return this.cache.get("chunks");
        },

        _updateAttributesAndIndicesArrays : function(attributes, isFacesDirty) {

            var self = this
            var nVertex = this.getVertexNumber();
            
            var verticesReorganizedMap = [];
            var reorganizedFaces = [];

            var ArrayConstructors = {};
            for (var name in attributes) {
                // Type can be byte, ubyte, short, ushort, float
                switch(type) {
                    case "byte":
                        ArrayConstructors[name] = Int8Array;
                        break;
                    case "ubyte":
                        ArrayConstructors[name] = Uint8Array;
                        break;
                    case "short":
                        ArrayConstructors[name] = Int16Array;
                        break;
                    case "ushort":
                        ArrayConstructors[name] = Uint16Array;
                        break;
                    default:
                        ArrayConstructors[name] = Float32Array;
                        break;
                }
            }

            var newChunk = function(chunkIdx) {
                if (self._arrayChunks[chunkIdx]) {
                    return self._arrayChunks[chunkIdx];
                }
                var chunk = {
                    attributeArrays : {},
                    indicesArray : null
                };

                for (var name in attributes) {
                    chunk.attributeArrays[name] = null;
                }

                for (var i = 0; i < nVertex; i++) {
                    verticesReorganizedMap[i] = -1;
                }
                
                self._arrayChunks.push(chunk);
                return chunk;
            }

            var attribNameList = Object.keys(attributes);
            // Split large geometry into chunks because index buffer
            // only support uint16 which means each draw call can only
             // have at most 65535 vertex data
            if (nVertex > this.chunkSize && this.isUseFace()) {
                var vertexCursor = 0;
                var chunkIdx = 0;
                var currentChunk;

                var chunkFaceStart = [0];
                var vertexUseCount = [];

                for (i = 0; i < nVertex; i++) {
                    vertexUseCount[i] = -1;
                    verticesReorganizedMap[i] = -1;
                }
                if (isFacesDirty) {
                    for (i = 0; i < this.faces.length; i++) {
                        reorganizedFaces[i] = [0, 0, 0];
                    }
                }

                currentChunk = newChunk(chunkIdx);

                var vertexCount = 0;
                for (var i = 0; i < this.faces.length; i++) {
                    var face = this.faces[i];
                    var reorganizedFace = reorganizedFaces[i];

                    // newChunk
                    if (vertexCount+3 > this.chunkSize) {
                        chunkIdx++;
                        chunkFaceStart[chunkIdx] = i;
                        vertexCount = 0;
                        currentChunk = newChunk(chunkIdx);
                    }

                    for (var f = 0; f < 3; f++) {
                        var ii = face[f];
                        var isNew = verticesReorganizedMap[ii] === -1; 

                        for (var k = 0; k < attribNameList.length; k++) {
                            var name = attribNameList[k];
                            var attribArray = currentChunk.attributeArrays[name];
                            var values = attributes[name].value;
                            var size = attributes[name].size;
                            if (! attribArray) {
                                // Here use array to put data temporary because i can't predict
                                // the size of chunk precisely.
                                attribArray = currentChunk.attributeArrays[name] = [];
                            }
                            if (isNew) {
                                if (size === 1) {
                                    attribArray[vertexCount] = values[ii];
                                }
                                for (var j = 0; j < size; j++) {
                                    attribArray[vertexCount * size + j] = values[ii][j];
                                }
                            }
                        }
                        if (isNew) {
                            verticesReorganizedMap[ii] = vertexCount;
                            reorganizedFace[f] = vertexCount;
                            vertexCount++;
                        } else {
                            reorganizedFace[f] = verticesReorganizedMap[ii];
                        }
                    }
                }
                //Create typedArray from existed array
                for (var c = 0; c < this._arrayChunks.length; c++) {
                    var chunk = this._arrayChunks[c];
                    for (var name in chunk.attributeArrays) {
                        var array = chunk.attributeArrays[name];
                        if (array instanceof Array) {
                            chunk.attributeArrays[name] = new ArrayConstructors[name](array);
                        }
                    }
                }

                if (isFacesDirty) {
                    var chunkStart, chunkEnd, cursor, chunk;
                    for (var c = 0; c < this._arrayChunks.length; c++) {
                        chunkStart = chunkFaceStart[c];
                        chunkEnd = chunkFaceStart[c+1] || this.faces.length;
                        cursor = 0;
                        chunk = this._arrayChunks[c];
                        var indicesArray = chunk.indicesArray;
                        if (! indicesArray) {
                            indicesArray = chunk.indicesArray = new Uint16Array((chunkEnd-chunkStart)*3);
                        }

                        for (var i = chunkStart; i < chunkEnd; i++) {
                            indicesArray[cursor++] = reorganizedFaces[i][0];
                            indicesArray[cursor++] = reorganizedFaces[i][1];
                            indicesArray[cursor++] = reorganizedFaces[i][2];
                        }
                    }
                }
            } else {
                var chunk = newChunk(0);
                // Use faces
                if (isFacesDirty) {
                    var indicesArray = chunk.indicesArray;
                    if (! indicesArray) {
                        indicesArray = chunk.indicesArray = new Uint16Array(this.faces.length*3);
                    }
                    var cursor = 0;
                    for (var i = 0; i < this.faces.length; i++) {
                        indicesArray[cursor++] = this.faces[i][0];
                        indicesArray[cursor++] = this.faces[i][1];
                        indicesArray[cursor++] = this.faces[i][2];
                    }
                }
                for (var name in attributes) {
                    var values = attributes[name].value;
                    var type = attributes[name].type;
                    var size = attributes[name].size;
                    var attribArray = chunk.attributeArrays[name];
                    
                    var arrSize = nVertex * size;
                    if (! attribArray || attribArray.length !== arrSize) {
                        attribArray = new ArrayConstructors[name](arrSize);
                        chunk.attributeArrays[name] = attribArray;
                    }

                    if (size === 1) {
                        for (var i = 0; i < values.length; i++) {
                            attribArray[i] = values[i];
                        }
                    } else {
                        var cursor = 0;
                        for (var i = 0; i < values.length; i++) {
                            for (var j = 0; j < size; j++) {
                                attribArray[cursor++] = values[i][j];
                            }
                        }
                    }
                }
            }
        },

        _updateBuffer : function(_gl, dirtyAttributes, isFacesDirty) {

            var chunks = this.cache.get("chunks");
            if (! chunks) {
                chunks = [];
                // Intialize
                for (var i = 0; i < this._arrayChunks.length; i++) {
                    chunks[i] = {
                        attributeBuffers : [],
                        indicesBuffer : null
                    }
                }
                this.cache.put("chunks", chunks);
            }
            for (var cc = 0; cc < this._arrayChunks.length; cc++) {
                var chunk = chunks[cc];
                if (! chunk) {
                    chunk = chunks[cc] = {
                        attributeBuffers : [],
                        indicesBuffer : null
                    }
                }
                var attributeBuffers = chunk.attributeBuffers;
                var indicesBuffer = chunk.indicesBuffer;
                
                var arrayChunk = this._arrayChunks[cc];
                var attributeArrays = arrayChunk.attributeArrays;
                var indicesArray = arrayChunk.indicesArray;

                var count = 0;
                var prevSearchIdx = 0;
                for (var name in dirtyAttributes) {
                    var attribute = dirtyAttributes[name];
                    var type = attribute.type;
                    var semantic = attribute.semantic;
                    var size = attribute.size;

                    var bufferInfo;
                    for (var i = prevSearchIdx; i < attributeBuffers.length; i++) {
                        if (attributeBuffers[i].name === name) {
                            bufferInfo = attributeBuffers[i];
                            prevSearchIdx = i + 1;
                            break;
                        }
                    }
                    for (var i = prevSearchIdx - 1; i >= 0; i--) {
                        if (attributeBuffers[i].name === name) {
                            bufferInfo = attributeBuffers[i];
                            prevSearchIdx = i;
                            break;
                        }
                    }

                    var buffer;
                    if (bufferInfo) {
                        buffer = bufferInfo.buffer
                    } else {
                        buffer = _gl.createBuffer();
                    }
                    //TODO: Use BufferSubData?
                    _gl.bindBuffer(_gl.ARRAY_BUFFER, buffer);
                    _gl.bufferData(_gl.ARRAY_BUFFER, attributeArrays[name], this.hint);

                    attributeBuffers[count++] = new Geometry.AttributeBuffer(name, type, buffer, size, semantic);
                }
                attributeBuffers.length = count;

                if (isFacesDirty) {
                    if (! indicesBuffer) {
                        indicesBuffer = new Geometry.IndicesBuffer(_gl.createBuffer(), indicesArray.length);
                        chunk.indicesBuffer = indicesBuffer;
                    }
                    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer);
                    _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, indicesArray, this.hint);   
                }
            }
        },

        generateVertexNormals : function() {
            var faces = this.faces
            var len = faces.length
            var positions = this.attributes.position.value
            var normals = this.attributes.normal.value
            var normal = vec3.create();

            var v12 = vec3.create(), v23 = vec3.create();

            var difference = positions.length - normals.length;
            for (var i = 0; i < normals.length; i++) {
                vec3.set(normals[i], 0.0, 0.0, 0.0);
            }
            for (var i = normals.length; i < positions.length; i++) {
                //Use array instead of Float32Array
                normals[i] = [0.0, 0.0, 0.0];
            }

            for (var f = 0; f < len; f++) {

                var face = faces[f];
                var i1 = face[0];
                var i2 = face[1];
                var i3 = face[2];
                var p1 = positions[i1];
                var p2 = positions[i2];
                var p3 = positions[i3];

                vec3.sub(v12, p1, p2);
                vec3.sub(v23, p2, p3);
                vec3.cross(normal, v12, v23);
                // Weighted by the triangle area
                vec3.add(normals[i1], normals[i1], normal);
                vec3.add(normals[i2], normals[i2], normal);
                vec3.add(normals[i3], normals[i3], normal);
            }
            for (var i = 0; i < normals.length; i++) {
                vec3.normalize(normals[i], normals[i]);
            }
        },

        generateFaceNormals : function() {
            if (! this.isUniqueVertex()) {
                this.generateUniqueVertex();
            }

            var faces = this.faces;
            var len = faces.length;
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            var normal = vec3.create();

            var v12 = vec3.create(), v23 = vec3.create();

            var isCopy = normals.length === positions.length;
            //   p1
            //  /  \
            // p3---p2
            for (var i = 0; i < len; i++) {
                var face = faces[i];
                var i1 = face[0];
                var i2 = face[1];
                var i3 = face[2];
                var p1 = positions[i1];
                var p2 = positions[i2];
                var p3 = positions[i3];

                vec3.sub(v12, p1, p2);
                vec3.sub(v23, p2, p3);
                vec3.cross(normal, v12, v23);

                if (isCopy) {
                    vec3.copy(normals[i1], normal);
                    vec3.copy(normals[i2], normal);
                    vec3.copy(normals[i3], normal);
                } else {
                    normals[i1] = normals[i2] = normals[i3] = arrSlice.call(normal);
                }
            }
        },
        // "Mathmatics for 3D programming and computer graphics, third edition"
        // section 7.8.2
        // http://www.crytek.com/download/Triangle_mesh_tangent_space_calculation.pdf
        generateTangents : function() {
            
            var texcoords = this.attributes.texcoord0.value;
            var positions = this.attributes.position.value;
            var tangents = this.attributes.tangent.value;
            var normals = this.attributes.normal.value;

            var tan1 = [];
            var tan2 = [];
            var nVertex = this.getVertexNumber();
            for (var i = 0; i < nVertex; i++) {
                tan1[i] = [0.0, 0.0, 0.0];
                tan2[i] = [0.0, 0.0, 0.0];
            }

            var sdir = [0.0, 0.0, 0.0];
            var tdir = [0.0, 0.0, 0.0];
            for (var i = 0; i < this.faces.length; i++) {
                var face = this.faces[i],
                    i1 = face[0],
                    i2 = face[1],
                    i3 = face[2],

                    st1 = texcoords[i1],
                    st2 = texcoords[i2],
                    st3 = texcoords[i3],

                    p1 = positions[i1],
                    p2 = positions[i2],
                    p3 = positions[i3];

                var x1 = p2[0] - p1[0],
                    x2 = p3[0] - p1[0],
                    y1 = p2[1] - p1[1],
                    y2 = p3[1] - p1[1],
                    z1 = p2[2] - p1[2],
                    z2 = p3[2] - p1[2];

                var s1 = st2[0] - st1[0],
                    s2 = st3[0] - st1[0],
                    t1 = st2[1] - st1[1],
                    t2 = st3[1] - st1[1];

                var r = 1.0 / (s1 * t2 - t1 * s2);
                sdir[0] = (t2 * x1 - t1 * x2) * r;
                sdir[1] = (t2 * y1 - t1 * y2) * r; 
                sdir[2] = (t2 * z1 - t1 * z2) * r;

                tdir[0] = (s1 * x2 - s2 * x1) * r;
                tdir[1] = (s1 * y2 - s2 * y1) * r;
                tdir[2] = (s1 * z2 - s2 * z1) * r;

                vec3.add(tan1[i1], tan1[i1], sdir);
                vec3.add(tan1[i2], tan1[i2], sdir);
                vec3.add(tan1[i3], tan1[i3], sdir);
                vec3.add(tan2[i1], tan2[i1], tdir);
                vec3.add(tan2[i2], tan2[i2], tdir);
                vec3.add(tan2[i3], tan2[i3], tdir);
            }
            var tmp = [0, 0, 0, 0];
            var nCrossT = [0, 0, 0];
            for (var i = 0; i < nVertex; i++) {
                var n = normals[i];
                var t = tan1[i];

                // Gram-Schmidt orthogonalize
                vec3.scale(tmp, n, vec3.dot(n, t));
                vec3.sub(tmp, t, tmp);
                vec3.normalize(tmp, tmp);
                // Calculate handedness.
                vec3.cross(nCrossT, n, t);
                tmp[3] = vec3.dot(nCrossT, tan2[i]) < 0.0 ? -1.0 : 1.0;
                tangents[i] = tmp.slice();
            }
        },

        isUniqueVertex : function() {
            if (this.isUseFace()) {
                return this.getVertexNumber() === this.faces.length * 3;
            } else {
                return true;
            }
        },

        generateUniqueVertex : function() {

            var vertexUseCount = [];
            // Intialize with empty value, read undefined value from array
            // is slow
            // http://jsperf.com/undefined-array-read
            for (var i = 0; i < this.getVertexNumber(); i++) {
                vertexUseCount[i] = 0;
            }

            var cursor = this.getVertexNumber();
            var attributes = this.getEnabledAttributes();
            var faces = this.faces;

            var attributeNameList = Object.keys(attributes);

            for (var i = 0; i < faces.length; i++) {
                var face = faces[i];
                for (var j = 0; j < 3; j++) {
                    var ii = face[j];
                    if (vertexUseCount[ii] > 0) {
                        for (var a = 0; a < attributeNameList.length; a++) {
                            var name = attributeNameList[a];
                            var array = attributes[name].value;
                            var size = attributes[name].size;
                            if (size === 1) {
                                array.push(array[ii]);
                            } else {
                                array.push(arrSlice.call(array[ii]));
                            }
                        }
                        face[j] = cursor;
                        cursor++;
                    }
                    vertexUseCount[ii]++;
                }
            }

            this.dirty();
        },

        // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
        // http://en.wikipedia.org/wiki/Barycentric_coordinate_system_(mathematics)
        generateBarycentric : (function() {
            var a = [1, 0, 0],
                b = [0, 0, 1],
                c = [0, 1, 0];
            return function() {

                if (! this.isUniqueVertex()) {
                    this.generateUniqueVertex();
                }

                var array = this.attributes.barycentric.value;
                // Already existed;
                if (array.length == this.faces.length * 3) {
                    return;
                }
                var i1, i2, i3, face;
                for (var i = 0; i < this.faces.length; i++) {
                    face = this.faces[i];
                    i1 = face[0];
                    i2 = face[1];
                    i3 = face[2];
                    array[i1] = a;
                    array[i2] = b;
                    array[i3] = c;
                }
            }
        })(),

        convertToStatic : function(geometry) {
            this._updateAttributesAndIndicesArrays(this.getEnabledAttributes(), true);

            if (this._arrayChunks.length > 1) {
                console.warn('Large geometry will discard chunks when convert to StaticGeometry');
            }
            else if (this._arrayChunks.length === 0) {
                return geometry;
            }
            var chunk = this._arrayChunks[0];

            var attributes = this.getEnabledAttributes();
            for (var name in attributes) {
                var attrib = attributes[name];
                var geoAttrib = geometry.attributes[name];
                if (!geoAttrib) {
                    geoAttrib = geometry.attributes[name] = {
                        type : attrib.type,
                        size : attrib.size,
                        value : null
                    }
                    if (attrib.semantic) {
                        geoAttrib.semantic = attrib.semantic;
                    }
                }
                geoAttrib.value = chunk.attributeArrays[name];
            }
            geometry.faces = chunk.indicesArray;

            if (this.boundingBox) {
                geometry.boundingBox = new BoundingBox();
                geometry.boundingBox.min.copy(this.boundingBox.min);
                geometry.boundingBox.max.copy(this.boundingBox.max);
            }
            // PENDING : copy buffer ?
            return geometry
        },

        applyTransform : function(matrix) {
            
            if (this.boundingBox) {
                this.boundingBox.applyTransform(matrix);
            }

            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            var tangents = this.attributes.tangent.value;

            matrix = matrix._array;
            for (var i = 0; i < positions.length; i++) {
                vec3.transformMat4(positions[i], positions[i], matrix);
            }
            // Normal Matrix
            var inverseTransposeMatrix = mat4.create();
            mat4.invert(inverseTransposeMatrix, matrix);
            mat4.transpose(inverseTransposeMatrix, inverseTransposeMatrix);

            for (var i = 0; i < normals.length; i++) {
                vec3.transformMat4(normals[i], normals[i], inverseTransposeMatrix);
            }

            for (var i = 0; i < tangents.length; i++) {
                vec3.transformMat4(tangents[i], tangents[i], inverseTransposeMatrix);
            }
        },

        dispose : function(_gl) {
            this.cache.use(_gl.__GLID__);
            var chunks = this.cache.get('chunks');
            if (chunks) {
                for (var c = 0; c < chunks.length; c++) {
                    var chunk = chunks[c];

                    for (var name in chunk.attributeBuffers) {
                        var attribs = chunk.attributeBuffers[name];
                        _gl.deleteBuffer(attribs.buffer);
                    }
                }
            }
            this.cache.deleteContext(_gl.__GLID__);
        }
    });
    
    return DynamicGeometry;
});
/**
 * Base class for all textures like compressed texture, texture2d, texturecube
 * TODO mapping
 */
define('qtek/Texture',['require','./core/Base','./core/util','./core/glenum','./core/Cache'],function(require) {

    var Base = require("./core/Base");
    var util = require("./core/util");
    var glenum = require("./core/glenum");
    var Cache = require("./core/Cache");

    var Texture = Base.derive({
        // Width and height is used when the image is null and want
        // to use it as a texture attach to framebuffer(RTT)
        width : 512,
        height : 512,

        type : glenum.UNSIGNED_BYTE,

        format : glenum.RGBA,

        wrapS : glenum.CLAMP_TO_EDGE,
        wrapT : glenum.CLAMP_TO_EDGE,

        minFilter : glenum.LINEAR_MIPMAP_LINEAR,

        magFilter : glenum.LINEAR,

        useMipmap : true,

        // http://blog.tojicode.com/2012/03/anisotropic-filtering-in-webgl.html
        anisotropic : 1,
        // pixelStorei parameters
        // http://www.khronos.org/opengles/sdk/docs/man/xhtml/glPixelStorei.xml
        flipY : true,
        unpackAlignment : 4,
        premultiplyAlpha : false,

        // Dynamic option for texture like video
        dynamic : false,

        NPOT : false
    }, function() {
        this.cache = new Cache();
    }, {

        getWebGLTexture : function(_gl) {

            this.cache.use(_gl.__GLID__);

            if (this.cache.miss("webgl_texture")) {
                // In a new gl context, create new texture and set dirty true
                this.cache.put("webgl_texture", _gl.createTexture());
            }
            if (this.dynamic) {
                this.update(_gl);
            }
            else if (this.cache.isDirty()) {
                this.update(_gl);
                this.cache.fresh();
            }

            return this.cache.get("webgl_texture");
        },

        bind : function() {},
        unbind : function() {},
        
        // Overwrite the dirty method
        dirty : function() {
            this.cache.dirtyAll();
        },

        update : function(_gl) {},

        // Update the common parameters of texture
        beforeUpdate : function(_gl) {
            _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, this.flipY);
            _gl.pixelStorei(_gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha);
            _gl.pixelStorei(_gl.UNPACK_ALIGNMENT, this.unpackAlignment);

            this.fallBack();
        },

        fallBack : function() {

            // Use of none-power of two texture
            // http://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences
            
            var isPowerOfTwo = this.isPowerOfTwo();

            if (this.format === glenum.DEPTH_COMPONENT) {
                this.useMipmap = false;
            }

            if (! isPowerOfTwo || ! this.useMipmap) {
                // none-power of two flag
                this.NPOT = true;
                // Save the original value for restore
                this._minFilterOriginal = this.minFilter;
                this._magFilterOriginal = this.magFilter;
                this._wrapSOriginal = this.wrapS;
                this._wrapTOriginal = this.wrapT;

                if (this.minFilter == glenum.NEAREST_MIPMAP_NEAREST ||
                    this.minFilter == glenum.NEAREST_MIPMAP_LINEAR) {
                    this.minFilter = glenum.NEAREST;
                } else if (
                    this.minFilter == glenum.LINEAR_MIPMAP_LINEAR ||
                    this.minFilter == glenum.LINEAR_MIPMAP_NEAREST
                ) {
                    this.minFilter = glenum.LINEAR
                }

                this.wrapS = glenum.CLAMP_TO_EDGE;
                this.wrapT = glenum.CLAMP_TO_EDGE;
            } else {
                if (this._minFilterOriginal) {
                    this.minFilter = this._minFilterOriginal;
                }
                if (this._magFilterOriginal) {
                    this.magFilter = this._magFilterOriginal;
                }
                if (this._wrapSOriginal) {
                    this.wrapS = this._wrapSOriginal;
                }
                if (this._wrapTOriginal) {
                    this.wrapT = this._wrapTOriginal;
                }
            }

        },

        nextHighestPowerOfTwo : function(x) {
            --x;
            for (var i = 1; i < 32; i <<= 1) {
                x = x | x >> i;
            }
            return x + 1;
        },

        dispose : function(_gl) {
            this.cache.use(_gl.__GLID__);
            if (this.cache.get("webgl_texture")){
                _gl.deleteTexture(this.cache.get("webgl_texture"));
            }
            this.cache.deleteContext(_gl.__GLID__);
        },

        isRenderable : function() {},
        
        isPowerOfTwo : function() {},
    });
    
    /* DataType */
    Texture.BYTE = glenum.BYTE;
    Texture.UNSIGNED_BYTE = glenum.UNSIGNED_BYTE;
    Texture.SHORT = glenum.SHORT;
    Texture.UNSIGNED_SHORT = glenum.UNSIGNED_SHORT;
    Texture.INT = glenum.INT;
    Texture.UNSIGNED_INT = glenum.UNSIGNED_INT;
    Texture.FLOAT = glenum.FLOAT;
    
    /* PixelFormat */
    Texture.DEPTH_COMPONENT = glenum.DEPTH_COMPONENT;
    Texture.ALPHA = glenum.ALPHA;
    Texture.RGB = glenum.RGB;
    Texture.RGBA = glenum.RGBA;
    Texture.LUMINANCE = glenum.LUMINANCE;
    Texture.LUMINANCE_ALPHA = glenum.LUMINANCE_ALPHA;

    /* Compressed Texture */
    Texture.COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83F0;
    Texture.COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
    Texture.COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
    Texture.COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;

    /* TextureMagFilter */
    Texture.NEAREST = glenum.NEAREST;
    Texture.LINEAR = glenum.LINEAR;
    
    /* TextureMinFilter */
    /*      NEAREST */
    /*      LINEAR */
    Texture.NEAREST_MIPMAP_NEAREST = glenum.NEAREST_MIPMAP_NEAREST;
    Texture.LINEAR_MIPMAP_NEAREST = glenum.LINEAR_MIPMAP_NEAREST;
    Texture.NEAREST_MIPMAP_LINEAR = glenum.NEAREST_MIPMAP_LINEAR;
    Texture.LINEAR_MIPMAP_LINEAR = glenum.LINEAR_MIPMAP_LINEAR;
    
    /* TextureParameterName */
    Texture.TEXTURE_MAG_FILTER = glenum.TEXTURE_MAG_FILTER;
    Texture.TEXTURE_MIN_FILTER = glenum.TEXTURE_MIN_FILTER;

    /* TextureWrapMode */
    Texture.REPEAT = glenum.REPEAT;
    Texture.CLAMP_TO_EDGE = glenum.CLAMP_TO_EDGE;
    Texture.MIRRORED_REPEAT = glenum.MIRRORED_REPEAT;


    return Texture;
});
define('qtek/core/glinfo',[],function() {
    // http://www.khronos.org/registry/webgl/extensions/
    var EXTENSION_LIST = [
                            "OES_texture_float",
                            "OES_texture_half_float",
                            "OES_texture_float_linear",
                            "OES_texture_half_float_linear",
                            "OES_standard_derivatives",
                            "OES_vertex_array_object",
                            "OES_element_index_uint",
                            "WEBGL_compressed_texture_s3tc",
                            'WEBGL_depth_texture',
                            "EXT_texture_filter_anisotropic",
                            "WEBGL_draw_buffers"
                        ];

    var extensions = {};

    var glinfo = {

        initialize : function(_gl) {

            if (extensions[_gl.__GLID__]) {
                return;
            }
            extensions[_gl.__GLID__] = {};
            // Get webgl extension
            for (var i = 0; i < EXTENSION_LIST.length; i++) {
                var extName = EXTENSION_LIST[i];

                var ext = _gl.getExtension(extName);
                // Try vendors
                if (! ext) {
                    ext = _gl.getExtension("MOZ_" + extName);
                }
                if (! ext) {
                    ext = _gl.getExtension("WEBKIT_" + extName);
                }

                extensions[_gl.__GLID__][extName] = ext;
            }
        },

        getExtension : function(_gl, name) {
            var guid = _gl.__GLID__;
            if (extensions[guid]) {
                return extensions[guid][name];
            }
        }
    }

    return glinfo;
});
define('qtek/texture/Texture2D',['require','../Texture','../core/glinfo'],function(require) {

    var Texture = require('../Texture');
    var glinfo = require('../core/glinfo');

    var Texture2D = Texture.derive(function() {
        return {
            image : null,
            pixels : null,
            mipmaps : []
        }
    }, {
        update : function(_gl) {

            _gl.bindTexture(_gl.TEXTURE_2D, this.cache.get("webgl_texture"));
            
            this.beforeUpdate( _gl);

            var glFormat = this.format;
            var glType = this.type;

            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, this.wrapS);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, this.wrapT);

            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, this.magFilter);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, this.minFilter);
            
            var anisotropicExt = glinfo.getExtension(_gl, "EXT_texture_filter_anisotropic");
            if (anisotropicExt && this.anisotropic > 1) {
                _gl.texParameterf(_gl.TEXTURE_2D, anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic);
            }

            // Fallback to float type if browser don't have half float extension
            if (glType === 36193) {
                var halfFloatExt = glinfo.getExtension(_gl, 'OES_texture_half_float');
                if (!halfFloatExt) {
                    glType = glenum.FLOAT;
                }
            }

            if (this.image) {
                _gl.texImage2D(_gl.TEXTURE_2D, 0, glFormat, glFormat, glType, this.image);
            }
            // Can be used as a blank texture when writing render to texture(RTT)
            else {
                if (
                    glFormat <= Texture.COMPRESSED_RGBA_S3TC_DXT5_EXT 
                    && glFormat >= Texture.COMPRESSED_RGB_S3TC_DXT1_EXT
                ) {
                    _gl.compressedTexImage2D(_gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, this.pixels);
                } else {
                    _gl.texImage2D(_gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, glFormat, glType, this.pixels);
                }
            }
            if (this.useMipmap) {
                if (this.mipmaps.length) {
                    if (this.image) {
                        for (var i = 0; i < this.mipmaps.length; i++) {
                            if (this.mipmaps[i]) {
                                _gl.texImage2D(_gl.TEXTURE_2D, i, glFormat, glFormat, glType, this.mipmaps[i]);
                            }
                        }
                    } else if (this.pixels) {
                        var width = this.width;
                        var height = this.height;
                        for (var i = 0; i < this.mipmaps.length; i++) {
                            if (this.mipmaps[i]) {
                                if (
                                    glFormat <= Texture.COMPRESSED_RGBA_S3TC_DXT5_EXT
                                    && glFormat >= Texture.COMPRESSED_RGB_S3TC_DXT1_EXT
                                ) {
                                    _gl.compressedTexImage2D(_gl.TEXTURE_2D, 0, glFormat, width, height, 0, this.mipmaps[i]);
                                } else {
                                    _gl.texImage2D(_gl.TEXTURE_2D, i, glFormat, width, height, 0, glFormat, glType, this.mipmaps[i]);
                                }
                            }
                            width /= 2;
                            height /= 2;
                        }
                    }
                } else if (!this.NPOT && !this.mipmaps.length) {
                    _gl.generateMipmap(_gl.TEXTURE_2D);
                }
            }
            
            _gl.bindTexture(_gl.TEXTURE_2D, null);

        },
        generateMipmap : function(_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, this.cache.get("webgl_texture"));
            _gl.generateMipmap(_gl.TEXTURE_2D);    
        },
        isPowerOfTwo : function() {
            if (this.image) {
                var width = this.image.width;
                var height = this.image.height;   
            } else {
                var width = this.width;
                var height = this.height;
            }
            return (width & (width-1)) === 0
                    && (height & (height-1)) === 0;
        },

        isRenderable : function() {
            if (this.image) {
                return this.image.nodeName === "CANVAS" ||
                        this.image.complete;
            } else {
                return this.width && this.height;
            }
        },

        bind : function(_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, this.getWebGLTexture(_gl));
        },
        unbind : function(_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, null);
        },
        load : function(src) {
            var image = new Image();
            var self = this;
            image.onload = function() {
                self.dirty();
                self.trigger("success", self);
                image.onload = null;
            }
            image.onerror = function() {
                self.trigger('error', self);
                image.onerror = null;
            }

            image.src = src;
            this.image = image;
        }
    });

    return Texture2D;
});
define('qtek/texture/TextureCube',['require','../Texture','../core/glinfo','../core/util'],function(require) {

    var Texture = require('../Texture');
    var glinfo = require('../core/glinfo');
    var util = require('../core/util');

    var targetMap = {
        'px' : 'TEXTURE_CUBE_MAP_POSITIVE_X',
        'py' : 'TEXTURE_CUBE_MAP_POSITIVE_Y',
        'pz' : 'TEXTURE_CUBE_MAP_POSITIVE_Z',
        'nx' : 'TEXTURE_CUBE_MAP_NEGATIVE_X',
        'ny' : 'TEXTURE_CUBE_MAP_NEGATIVE_Y',
        'nz' : 'TEXTURE_CUBE_MAP_NEGATIVE_Z',
    }

    var TextureCube = Texture.derive(function() {
        return {
            image : {
                px : null,
                nx : null,
                py : null,
                ny : null,
                pz : null,
                nz : null
            },
            pixels : {
                px : null,
                nx : null,
                py : null,
                ny : null,
                pz : null,
                nz : null
            }
       }
    }, {
        update : function(_gl) {

            _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, this.cache.get("webgl_texture"));

            this.beforeUpdate(_gl);

            var glFormat = this.format;
            var glType = this.type;

            _gl.texParameteri(_gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_WRAP_S, this.wrapS);
            _gl.texParameteri(_gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_WRAP_T, this.wrapT);

            _gl.texParameteri(_gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_MAG_FILTER, this.magFilter);
            _gl.texParameteri(_gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_MIN_FILTER, this.minFilter);
            
            var anisotropicExt = glinfo.getExtension(_gl, "EXT_texture_filter_anisotropic");
            if (anisotropicExt && this.anisotropic > 1) {
                _gl.texParameterf(_gl.TEXTURE_CUBE_MAP, anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic);
            }

            for (var target in this.image) {
                var img = this.image[target];
                if (img) {
                    _gl.texImage2D(_gl[targetMap[target]], 0, glFormat, glFormat, glType, img);
                }
                else {
                    _gl.texImage2D(_gl[targetMap[target]], 0, glFormat, this.width, this.height, 0, glFormat, glType, this.pixels[target]);
                }
            }

            if (!this.NPOT && this.useMipmap) {
                _gl.generateMipmap(_gl.TEXTURE_CUBE_MAP);
            }

            _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, null);
        },
        generateMipmap : function(_gl) {
            _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, this.cache.get("webgl_texture"));
            _gl.generateMipmap(_gl.TEXTURE_CUBE_MAP);    
        },
        bind : function(_gl) {

            _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, this.getWebGLTexture(_gl));
        },
        unbind : function(_gl) {
            _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, null);
        },
        // Overwrite the isPowerOfTwo method
        isPowerOfTwo : function() {
            if (this.image.px) {
                return isPowerOfTwo(this.image.px.width)
                        && isPowerOfTwo(this.image.px.height);
            } else {
                return isPowerOfTwo(this.width)
                        && isPowerOfTwo(this.height);
            }

            function isPowerOfTwo(value) {
                return value & (value-1) === 0
            }
        },
        isRenderable : function() {
            if (this.image.px) {
                return isImageRenderable(this.image.px) &&
                       isImageRenderable(this.image.nx) &&
                       isImageRenderable(this.image.py) &&
                       isImageRenderable(this.image.ny) &&
                       isImageRenderable(this.image.pz) &&
                       isImageRenderable(this.image.nz);
            } else {
                return this.width && this.height;
            }
        },
        load : function(imageList) {
            var loading = 0;
            var self = this;
            util.each(imageList, function(src, target){
                var image = new Image();
                image.onload = function() {
                    loading --;
                    if (loading === 0){
                        self.dirty();
                        self.trigger("success", self);
                    }
                    image.onload = null;
                }
                image.onerror = function() {
                    loading --;
                    image.onerror = null;
                }
                
                loading++;
                image.src = src;
                self.image[target] = image;
            });
        }
    });

    function isImageRenderable(image) {
        return image.nodeName === "CANVAS" ||
                image.complete;
    }

    return TextureCube;
});
define('qtek/FrameBuffer',['require','./core/Base','./texture/Texture2D','./texture/TextureCube','./core/glinfo','./core/glenum','./core/Cache'],function(require) {
    
    
    
    var Base = require("./core/Base");
    var Texture2D = require("./texture/Texture2D");
    var TextureCube = require("./texture/TextureCube");
    var glinfo = require('./core/glinfo');
    var glenum = require("./core/glenum");
    var Cache = require("./core/Cache");

    var FrameBuffer = Base.derive(function() {

        return {
            depthBuffer : true,

            //Save attached texture and target
            _attachedTextures : {},

            _width : 0,
            _height : 0,
            _depthTextureAttached : false,

            _renderBufferWidth : 0,
            _renderBufferHeight : 0
        }
    }, function() {
        // Use cache
        this.cache = new Cache();
    }, {

        bind : function(renderer) {

            var _gl = renderer.gl;

            _gl.bindFramebuffer(_gl.FRAMEBUFFER, this.getFrameBuffer(_gl));

            this.cache.put("viewport", renderer.viewport);
            renderer.setViewport(0, 0, this._width, this._height);
            // Create a new render buffer
            if (this.cache.miss("renderbuffer") && this.depthBuffer && ! this._depthTextureAttached) {
                this.cache.put("renderbuffer", _gl.createRenderbuffer());
            }
            if (! this._depthTextureAttached && this.depthBuffer) {

                var width = this._width;
                var height = this._height;
                var renderbuffer = this.cache.get('renderbuffer');

                if (width !== this._renderBufferWidth
                     || height !== this._renderBufferHeight) {
                    _gl.bindRenderbuffer(_gl.RENDERBUFFER, renderbuffer);
                    _gl.renderbufferStorage(_gl.RENDERBUFFER, _gl.DEPTH_COMPONENT16, width, height);
                    this._renderBufferWidth = width;
                    this._renderBufferHeight = height;
                    _gl.bindRenderbuffer(_gl.RENDERBUFFER, null);                 
                }
                if (! this.cache.get("renderbuffer_attached")) {
                    
                    _gl.framebufferRenderbuffer(_gl.FRAMEBUFFER, _gl.DEPTH_ATTACHMENT, _gl.RENDERBUFFER, renderbuffer);
                    this.cache.put("renderbuffer_attached", true);

                }
            }
            
        },

        unbind : function(renderer) {
            var _gl = renderer.gl;
            
            _gl.bindFramebuffer(_gl.FRAMEBUFFER, null);

            this.cache.use(_gl.__GLID__);
            var viewport = this.cache.get("viewport");
            // Reset viewport;
            if (viewport) {
                renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
            }

            // Because the data of texture is changed over time,
            // Here update the mipmaps of texture each time after rendered;
            for (var attachment in this._attachedTextures) {
                var texture = this._attachedTextures[attachment];
                if (! texture.NPOT && texture.useMipmap) {
                    var target = texture instanceof TextureCube ? _gl.TEXTURE_CUBE_MAP : _gl.TEXTURE_2D;
                    _gl.bindTexture(target, texture.getWebGLTexture(_gl));
                    _gl.generateMipmap(target);
                    _gl.bindTexture(target, null);
                }
            }
        },

        getFrameBuffer : function(_gl) {

            this.cache.use(_gl.__GLID__);

            if (this.cache.miss("framebuffer")) {
                this.cache.put("framebuffer", _gl.createFramebuffer());
            }

            return this.cache.get("framebuffer");
        },

        attach : function(_gl, texture, attachment, target, mipmapLevel) {

            if (! texture.width) {
                throw new Error("The texture attached to color buffer is not a valid.");
                return;
            }

            _gl.bindFramebuffer(_gl.FRAMEBUFFER, this.getFrameBuffer(_gl));

            this._width = texture.width;
            this._height = texture.height;

            // If the depth_texture extension is enabled, developers
            // Can attach a depth texture to the depth buffer
            // http://blog.tojicode.com/2012/07/using-webgldepthtexture.html
            attachment = attachment || _gl.COLOR_ATTACHMENT0;
            target = target || _gl.TEXTURE_2D;
            mipmapLevel = mipmapLevel || 0
            
            if (attachment === _gl.DEPTH_ATTACHMENT) {

                var extension = glinfo.getExtension(_gl, "WEBGL_depth_texture");

                if (!extension) {
                    console.error(" Depth texture is not supported by the browser ");
                    return;
                }
                if (texture.format !== glenum.DEPTH_COMPONENT) {
                    console.error("The texture attached to depth buffer is not a valid.");
                    return;
                }
                this.cache.put("renderbuffer_attached", false);
                this._depthTextureAttached = true;
            }

            this._attachedTextures[attachment] = texture;

            _gl.framebufferTexture2D(_gl.FRAMEBUFFER, attachment, target, texture.getWebGLTexture(_gl), mipmapLevel);

            _gl.bindFramebuffer(_gl.FRAMEBUFFER, null);
        },

        detach : function() {},

        dispose : function(_gl) {
            this.cache.use(_gl.__GLID__);

            if (this.cache.get("renderbuffer"))
                _gl.deleteRenderbuffer(this.cache.get("renderbuffer"));
            if (this.cache.get("framebuffer"))
                _gl.deleteFramebuffer(this.cache.get("framebuffer"));

            this.cache.deleteContext(_gl.__GLID__);
        }
    });

    FrameBuffer.COLOR_ATTACHMENT0 = glenum.COLOR_ATTACHMENT0;
    FrameBuffer.DEPTH_ATTACHMENT = glenum.DEPTH_ATTACHMENT;
    FrameBuffer.STENCIL_ATTACHMENT = glenum.STENCIL_ATTACHMENT;
    FrameBuffer.DEPTH_STENCIL_ATTACHMENT = glenum.DEPTH_STENCIL_ATTACHMENT;

    return FrameBuffer;
});
define('qtek/Joint',['require','./Node','./core/Base'],function(require) {

    var Node = require("./Node");
    var Base = require("./core/Base");
    
    var Joint = Base.derive(function() {
        return {
            // https://github.com/KhronosGroup/glTF/issues/193#issuecomment-29216576
            name : '',
            // Index of joint
            index : -1,
            // Parent joint index
            parentIndex : -1,

            // Scene node attached to
            node : null,

            rootNode : null
        }
    }, {
    });

    return Joint;
});
define('qtek/Layer',['require','./core/Base'],function(require) {

    var Base = require('./core/Base');

    var Layer = Base.derive(function() {
        return {
            renderer : null,
            scene : null,
            camera : null,

            picking : null
        }
    }, {
        render : function() {
            if (this.picking) {
                this.picking.update(this.scene, this.camera);
            }
            this.renderer.render(this.scene, this.camera);
        },

        setPicking : function(picking) {
            this.picking = picking;
            if (this.renderer) {
                picking.resize(this.renderer.width, this.renderer.height);
            }
        },

        resize : function(width, height) {
            if (this.renderer) {
                this.renderer.resize(width, height);
            }
            if (this.picking) {
                this.picking.resize(width, height);
            }
        },

        setZ : function(z) {
            this.z = z;
            this.renderer.canvas.style.zIndex = z;
        },

        pick : function(x, y) {
            // Mouse picking
            if (this.picking) {
                return this.picking.pick(x, y);
            }
        }
    });

    return Layer;
} );
/**
 * Mainly do the parse and compile of shader string
 * Support shader code chunk import and export
 * Support shader semantics
 * http://www.nvidia.com/object/using_sas.html
 * https://github.com/KhronosGroup/collada2json/issues/45
 *
 */
define('qtek/Shader',['require','./core/Base','./core/util','./core/Cache','glmatrix'],function(require) {
    
    

    var Base = require("./core/Base");
    var util = require("./core/util");
    var Cache = require("./core/Cache");
    var glMatrix = require("glmatrix");
    var mat2 = glMatrix.mat2;
    var mat3 = glMatrix.mat3;
    var mat4 = glMatrix.mat4;

    var uniformRegex = /uniform\s+(bool|float|int|vec2|vec3|vec4|ivec2|ivec3|ivec4|mat2|mat3|mat4|sampler2D|samplerCube)\s+([\w\,]+)?(\[.*?\])?\s*(:\s*([\S\s]+?))?;/g;
    var attributeRegex = /attribute\s+(float|int|vec2|vec3|vec4)\s+(\w*)\s*(:\s*(\w+))?;/g;
    var defineRegex = /#define\s+(\w+)?(\s+[\w-.]+)?\s*\n/g;

    var uniformTypeMap = {
        "bool" : "1i",
        "int" : "1i",
        "sampler2D" : "t",
        "samplerCube" : "t",
        "float" : "1f",
        "vec2" : "2f",
        "vec3" : "3f",
        "vec4" : "4f",
        "ivec2" : "2i",
        "ivec3" : "3i",
        "ivec4" : "4i",
        "mat2" : "m2",
        "mat3" : "m3",
        "mat4" : "m4"
    }
    var uniformValueConstructor = {
        'bool' : function() {return true;},
        'int' : function() {return 0;},
        'float' : function() {return 0;},
        'sampler2D' : function() {return null;},
        'samplerCube' : function() {return null;},

        'vec2' : function() {return [0, 0];},
        'vec3' : function() {return [0, 0, 0];},
        'vec4' : function() {return [0, 0, 0, 0];},

        'ivec2' : function() {return [0, 0];},
        'ivec3' : function() {return [0, 0, 0];},
        'ivec4' : function() {return [0, 0, 0, 0];},

        'mat2' : function() {return mat2.create();},
        'mat3' : function() {return mat3.create();},
        'mat4' : function() {return mat4.create();},

        'array' : function() {return [];}
    }
    var attribSemantics = [
        'POSITION', 
        'NORMAL',
        'BINORMAL',
        'TANGENT',
        'TEXCOORD',
        'TEXCOORD_0',
        'TEXCOORD_1',
        'COLOR',
        // Skinning
        // https://github.com/KhronosGroup/glTF/blob/master/specification/README.md#semantics
        'JOINT',
        'WEIGHT',
        'SKIN_MATRIX'
    ];
    var matrixSemantics = [
        'WORLD',
        'VIEW',
        'PROJECTION',
        'WORLDVIEW',
        'VIEWPROJECTION',
        'WORLDVIEWPROJECTION',
        'WORLDINVERSE',
        'VIEWINVERSE',
        'PROJECTIONINVERSE',
        'WORLDVIEWINVERSE',
        'VIEWPROJECTIONINVERSE',
        'WORLDVIEWPROJECTIONINVERSE',
        'WORLDTRANSPOSE',
        'VIEWTRANSPOSE',
        'PROJECTIONTRANSPOSE',
        'WORLDVIEWTRANSPOSE',
        'VIEWPROJECTIONTRANSPOSE',
        'WORLDVIEWPROJECTIONTRANSPOSE',
        'WORLDINVERSETRANSPOSE',
        'VIEWINVERSETRANSPOSE',
        'PROJECTIONINVERSETRANSPOSE',
        'WORLDVIEWINVERSETRANSPOSE',
        'VIEWPROJECTIONINVERSETRANSPOSE',
        'WORLDVIEWPROJECTIONINVERSETRANSPOSE',
    ];
    
    var errorShader = {};

    // Enable attribute operation is global to all programs
    // Here saved the list of all enabled attribute index 
    // http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
    var enabledAttributeList = {};

    var Shader = Base.derive(function() {

        return {
            vertex : "",
            
            fragment : "",

            precision : "mediump",
            // Properties follow will be generated by the program
            attribSemantics : {},
            matrixSemantics : {},
            matrixSemanticKeys : [],

            uniformTemplates : {},
            attributeTemplates : {},

            // Custom defined values in the shader
            vertexDefines : {},
            fragmentDefines : {},
            // Glue code
            // Defines the each type light number in the scene
            // AMBIENT_LIGHT
            // POINT_LIGHT
            // SPOT_LIGHT
            // AREA_LIGHT
            lightNumber : {},

            _uniformList : [],
            // {
            //  enabled : true
            //  shaderType : "vertex",
            // }
            _textureStatus : {},

            _vertexProcessed : "",
            _fragmentProcessed : "",

            _currentLocationsMap : {}
        }
    }, function() {
        
        this.cache = new Cache();

        this._updateShaderString();
    }, {

        setVertex : function(str) {
            this.vertex = str;
            this._updateShaderString();
            this.dirty();
        },
        setFragment : function(str) {
            this.fragment = str;
            this._updateShaderString();
            this.dirty();
        },
        bind : function(_gl) {
            this.cache.use(_gl.__GLID__, getCacheSchema);

            this._currentLocationsMap = this.cache.get('locations');

            if (this.cache.isDirty()) {
                this._updateShaderString();
                this._buildProgram(_gl, this._vertexProcessed, this._fragmentProcessed);
                this.cache.fresh();
            }

            _gl.useProgram(this.cache.get("program"));
        },

        dirty : function() {
            this.cache.dirtyAll();
            for (var i = 0; i < this.cache._caches.length; i++) {
                if (this.cache._caches[i]) {
                    var context = this.cache._caches[i];
                    context["locations"] = {};
                    context["attriblocations"] = {};
                }
            }
        },

        _updateShaderString : function() {

            if (this.vertex !== this._vertexPrev ||
                this.fragment !== this._fragmentPrev) {

                this._parseImport();
                
                this.attribSemantics = {};
                this.matrixSemantics = {};
                this._textureStatus = {};

                this._parseUniforms();
                this._parseAttributes();
                this._parseDefines();

                this._vertexPrev = this.vertex;
                this._fragmentPrev = this.fragment;
            }
            this._addDefine();
        },

        define : function(type, key, val) {
            val = val !== undefined ? val : null;
            if (type == 'vertex' || type == 'both') {
                if (this.vertexDefines[key] !== val) {
                    this.vertexDefines[key] = val;
                    // Mark as dirty
                    this.dirty();
                }
            }
            if (type == 'fragment' || type == 'both') {
                if (this.fragmentDefines[key] !== val) {
                    this.fragmentDefines[key] = val;
                    if (type !== 'both') {
                        this.dirty();
                    }
                }
            }
        },

        unDefine : function(type, key) {
            if (type == 'vertex' || type == 'both') {
                if (this.isDefined('vertex', key)) {
                    delete this.vertexDefines[key];
                    // Mark as dirty
                    this.dirty();
                }
            }
            if (type == 'fragment' || type == 'both') {
                if (this.isDefined('fragment', key)) {
                    delete this.fragmentDefines[key];
                    if (type !== 'both') {
                        this.dirty();
                    }
                }
            }
        },

        isDefined : function(type, key) {
            switch(type) {
                case "vertex":
                    return this.vertexDefines[key] !== undefined;
                case "fragment":
                    return this.fragmentDefines[key] !== undefined;
            }
        },

        getDefine : function(type, key) {
            switch(type) {
                case "vertex":
                    return this.vertexDefines[key];
                case "fragment":
                    return this.fragmentDefines[key];
            }
        },

        enableTexture : function(symbol) {
            var status = this._textureStatus[symbol];
            if (status) {
                var isEnabled = status.enabled;
                if (!isEnabled) {
                    status.enabled = true;
                    this.dirty();
                }
            }
        },

        enableTexturesAll : function() {
            for (var symbol in this._textureStatus) {
                this._textureStatus[symbol].enabled = true;
            }

            this.dirty();
        },

        disableTexture : function(symbol) {
            var status = this._textureStatus[symbol];
            if (status) {
                var isDisabled = ! status.enabled;
                if (!isDisabled) {
                    status.enabled = false;
                    this.dirty();
                }
            }
        },

        disableTexturesAll : function(symbol) {
            for (var symbol in this._textureStatus) {
                this._textureStatus[symbol].enabled = false;
            }

            this.dirty();
        },

        isTextureEnabled : function(symbol) {
            return this._textureStatus[symbol].enabled;
        },

        hasUniform : function(symbol) {
            var location = this._currentLocationsMap[symbol];
            return location !== null && location !== undefined;
        },

        setUniform : function(_gl, type, symbol, value) {
            var locationMap = this._currentLocationsMap;
            var location = locationMap[symbol];
            // Uniform is not existed in the shader
            if (location === null || location === undefined) {
                return false;
            }
            switch (type) {
                case 'm4':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix4fv(location, false, value);
                    break;
                case '2i':
                    _gl.uniform2i(location, value[0], value[1]);
                    break;
                case '2f':
                    _gl.uniform2f(location, value[0], value[1]);
                    break;
                case '3i':
                    _gl.uniform3i(location, value[0], value[1], value[2]);
                    break;
                case '3f':
                    _gl.uniform3f(location, value[0], value[1], value[2]);
                    break;
                case '4i':
                    _gl.uniform4i(location, value[0], value[1], value[2], value[3]);
                    break;
                case '4f':
                    _gl.uniform4f(location, value[0], value[1], value[2], value[3]);
                    break;
                case '1i':
                    _gl.uniform1i(location, value);
                    break;
                case '1f':
                    _gl.uniform1f(location, value);
                    break;
                case "1fv":
                    _gl.uniform1fv(location, value);
                    break;
                case "1iv":
                    _gl.uniform1iv(location, value);
                    break;
                case '2iv':
                    _gl.uniform2iv(location, value);
                    break;
                case '2fv':
                    _gl.uniform2fv(location, value);
                    break;
                case '3iv':
                    _gl.uniform3iv(location, value);
                    break;
                case '3fv':
                    _gl.uniform3fv(location, value);
                    break;
                case "4iv":
                    _gl.uniform4iv(location, value);
                    break;
                case "4fv":
                    _gl.uniform4fv(location, value);
                    break;
                case 'm2':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix2fv(location, false, value);
                    break;
                case 'm3':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix3fv(location, false, value);
                    break;
                case "m2v":
                    var size = 4;
                case "m3v":
                    var size = 9;
                case 'm4v':
                    var size = 16;
                    if (value instanceof Array) {
                        var array = new Float32Array(value.length * size);
                        var cursor = 0;
                        for (var i = 0; i < value.length; i++) {
                            var item = value[i];
                            for (var j = 0; j < item.length; j++) {
                                array[cursor++] = item[j];
                            }
                        }
                        _gl.uniformMatrix4fv(location, false, array);
                    // Raw value
                    }else if (value instanceof Float32Array) {   // ArrayBufferView
                        _gl.uniformMatrix4fv(location, false, value);
                    }
                    break;
            }
            return true
        },

        setUniformBySemantic : function(_gl, semantic, val) {
            var semanticInfo = this.attribSemantics[semantic];
            if (semanticInfo) {
                return this.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, val);
            }
            return false;
        },
        /**
         * Enable the attributes passed in and disable the rest
         * Example Usage:
         * enableAttributes(_gl, "position", "texcoords")
         * OR
         * enableAttributes(_gl, ["position", "texcoords"])
         */
        enableAttributes : function(_gl, attribList) {
            
            var program = this.cache.get("program");

            var locationMap = this.cache.get("attriblocations");

            if (typeof(attribList) === "string") {
                attribList = Array.prototype.slice.call(arguments, 1);
            }

            var enabledAttributeListInContext = enabledAttributeList[_gl.__GLID__];
            if (! enabledAttributeListInContext) {
                enabledAttributeListInContext
                    = enabledAttributeList[_gl.__GLID__] 
                    = [];
            }
            var locationList = [];
            for (var i = 0; i < attribList.length; i++) {
                var symbol = attribList[i];
                if (!this.attributeTemplates[symbol]) {
                    locationList[i] = -1;
                    continue;
                }
                var location = locationMap[symbol];
                if (location === undefined) {
                    location = _gl.getAttribLocation(program, symbol);
                    // Attrib location is a number from 0 to ...
                    if (location === -1) {
                        locationList[i] = -1;
                        continue;
                    }
                    locationMap[symbol] = location;
                }
                locationList[i] = location;
                // 2 is going to enable(not enabled yet), 
                // 3 has beend enabled, and marked not to be disable
                if (!enabledAttributeListInContext[location]) {
                    enabledAttributeListInContext[location] = 2;
                } else {
                    enabledAttributeListInContext[location] = 3;
                }
            }

            for (var i = 0; i < enabledAttributeListInContext.length; i++) {
                switch(enabledAttributeListInContext[i]){
                    case 2:
                        _gl.enableVertexAttribArray(i);
                        enabledAttributeListInContext[i] = 1;
                        break;
                    case 3:
                        enabledAttributeListInContext[i] = 1;
                        break;
                    // Expired
                    case 1:
                        _gl.disableVertexAttribArray(i);
                        enabledAttributeListInContext[i] = 0;
                        break;
                }
            }

            return locationList;
        },

        _parseImport : function() {

            this._vertexProcessedWithoutDefine = Shader.parseImport(this.vertex);
            this._fragmentProcessedWithoutDefine = Shader.parseImport(this.fragment);

        },

        _addDefine : function() {

            // Add defines
            // VERTEX
            var defineStr = [];
            for (var lightType in this.lightNumber) {
                var count = this.lightNumber[lightType];
                if (count > 0) {
                    defineStr.push("#define "+lightType.toUpperCase()+"_NUMBER "+count);
                }
            }
            for (var symbol in this._textureStatus) {
                var status = this._textureStatus[symbol];
                if (status.enabled) {
                    defineStr.push("#define "+symbol.toUpperCase()+"_ENABLED");
                }
            }
            // Custom Defines
            for (var symbol in this.vertexDefines) {
                var value = this.vertexDefines[symbol];
                if (value === null) {
                    defineStr.push("#define "+symbol);
                }else{
                    defineStr.push("#define "+symbol+" "+value.toString());
                }
            }
            this._vertexProcessed = defineStr.join("\n") + "\n" + this._vertexProcessedWithoutDefine;

            // FRAGMENT
            defineStr = [];
            for (var lightType in this.lightNumber) {
                var count = this.lightNumber[lightType];
                if (count > 0) {
                    defineStr.push("#define "+lightType.toUpperCase()+"_NUMBER "+count);
                }
            }
            for (var symbol in this._textureStatus) {
                var status = this._textureStatus[symbol];
                if (status.enabled) {
                    defineStr.push("#define "+symbol.toUpperCase()+"_ENABLED");
                }
            }
            // Custom Defines
            for (var symbol in this.fragmentDefines) {
                var value = this.fragmentDefines[symbol];
                if (value === null) {
                    defineStr.push("#define "+symbol);
                }else{
                    defineStr.push("#define "+symbol+" "+value.toString());
                }
            }
            var tmp = defineStr.join("\n") + "\n" + this._fragmentProcessedWithoutDefine;
            
            // Add precision
            this._fragmentProcessed = ['precision', this.precision, 'float'].join(' ')+';\n' + tmp;
        },

        _parseUniforms : function() {
            var uniforms = {};
            var self = this;
            var shaderType = "vertex";
            this._uniformList = [];

            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace(uniformRegex, _uniformParser);
            shaderType = "fragment";
            this._fragmentProcessedWithoutDefine = this._fragmentProcessedWithoutDefine.replace(uniformRegex, _uniformParser);

            self.matrixSemanticKeys = Object.keys(this.matrixSemantics);

            function _uniformParser(str, type, symbol, isArray, semanticWrapper, semantic) {
                if (type && symbol) {
                    var uniformType = uniformTypeMap[type];
                    var isConfigurable = true;
                    if (uniformType) {
                        self._uniformList.push(symbol);
                        if (type === "sampler2D" || type === "samplerCube") {
                            // Texture is default disabled
                            self._textureStatus[symbol] = {
                                enabled : false,
                                shaderType : shaderType
                            };
                        }
                        if (isArray) {
                            uniformType += 'v';
                        }
                        if (semantic) {
                            // This case is only for SKIN_MATRIX
                            if (attribSemantics.indexOf(semantic) >= 0) {
                                self.attribSemantics[semantic] = {
                                    symbol : symbol,
                                    type : uniformType
                                }
                                isConfigurable = false;
                            }
                            else if (matrixSemantics.indexOf(semantic) >= 0) {
                                var isTranspose = false;
                                var semanticNoTranspose = semantic;
                                if (semantic.match(/TRANSPOSE$/)) {
                                    isTranspose = true;
                                    semanticNoTranspose = semantic.slice(0, -9)
                                }
                                self.matrixSemantics[semantic] = {
                                    symbol : symbol,
                                    type : uniformType,
                                    isTranspose : isTranspose,
                                    semanticNoTranspose : semanticNoTranspose
                                }
                                isConfigurable = false;
                            }
                            else {
                                // The uniform is not configurable, which means it will not appear
                                // in the material uniform properties
                                if (semantic === "unconfigurable") {
                                    isConfigurable = false;
                                }else{
                                    var defaultValueFunc = self._parseDefaultValue(type, semantic);
                                    if (! defaultValueFunc)
                                        throw new Error('Unkown semantic "' + semantic + '"');
                                    else
                                        semantic = "";
                                }
                            }
                        }
                        if (isConfigurable) {
                            uniforms[symbol] = {
                                type : uniformType,
                                value : isArray ? uniformValueConstructor['array'] : (defaultValueFunc || uniformValueConstructor[type]),
                                semantic : semantic || null
                            }
                        }
                    }
                    return ["uniform", type, symbol, isArray].join(" ")+";\n";
                }
            }

            this.uniformTemplates = uniforms;
        },

        _parseDefaultValue : function(type, str) {
            var arrayRegex = /\[\s*(.*)\s*\]/
            if (type === "vec2" ||
                type === "vec3" ||
                type === "vec4") {
                var arrayStr = arrayRegex.exec(str)[1];
                if (arrayStr) {
                    var arr = arrayStr.split(/\s*,\s*/);
                    return function() {
                        return new Float32Array(arr);
                    }
                }else{
                    // Invalid value
                    return;
                }
            }
            else if (type === "bool") {
                return function() {
                    return str.toLowerCase() === "true" ? true : false;
                }
            }
            else if (type === "float") {
                return function() {
                    return parseFloat(str);
                }
            }
        },

        // Create a new uniform instance for material
        createUniforms : function() {
            var uniforms = {};
            
            for (var symbol in this.uniformTemplates){
                var uniformTpl = this.uniformTemplates[symbol];
                uniforms[symbol] = {
                    type : uniformTpl.type,
                    value : uniformTpl.value()
                }
            }
            return uniforms;
        },

        _parseAttributes : function() {
            var attributes = {};
            var self = this;
            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace(attributeRegex, _attributeParser);

            function _attributeParser(str, type, symbol, semanticWrapper, semantic) {
                if (type && symbol) {
                    var size = 1;
                    switch (type) {
                        case "vec4":
                            size = 4;
                            break;
                        case "vec3":
                            size = 3;
                            break;
                        case "vec2":
                            size = 2;
                            break;
                        case "float":
                            size = 1;
                            break;
                    }

                    attributes[symbol] = {
                        // Force float
                        type : "float",
                        size : size,
                        semantic : semantic || null
                    }

                    if (semantic) {
                        if (attribSemantics.indexOf(semantic) < 0) {
                            throw new Error('Unkown semantic "' + semantic + '"');
                        }else{
                            self.attribSemantics[semantic] = {
                                symbol : symbol,
                                type : type
                            }
                        }
                    }
                }

                return ["attribute", type, symbol].join(" ")+";\n";
            }

            this.attributeTemplates = attributes;
        },

        _parseDefines : function() {
            var self = this;
            var shaderType = 'vertex';
            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace(defineRegex, _defineParser);
            shaderType = 'fragment';
            this._fragmentProcessedWithoutDefine = this._fragmentProcessedWithoutDefine.replace(defineRegex, _defineParser);

            function _defineParser(str, symbol, value) {
                var defines = shaderType === 'vertex' ? self.vertexDefines : self.fragmentDefines;
                if (!defines[symbol]) { // Haven't been defined by user
                    defines[symbol] = value ? parseFloat(value) : null;

                }
                return '';
            }
        },

        _buildProgram : function(_gl, vertexShaderString, fragmentShaderString) {

            if (this.cache.get("program")) {
                _gl.deleteProgram(this.cache.get("program"));
            }
            var program = _gl.createProgram();

            try {

                var vertexShader = this._compileShader(_gl, "vertex", vertexShaderString);
                var fragmentShader = this._compileShader(_gl, "fragment", fragmentShaderString);
                _gl.attachShader(program, vertexShader);
                _gl.attachShader(program, fragmentShader);
                // Force the position bind to index 0;
                if (this.attribSemantics['POSITION']) {
                    _gl.bindAttribLocation(program, 0, this.attribSemantics['POSITION'].symbol);
                }
                _gl.linkProgram(program);

                if (!_gl.getProgramParameter(program, _gl.LINK_STATUS)) {
                    throw new Error("Could not initialize shader\n" + "VALIDATE_STATUS: " + _gl.getProgramParameter(program, _gl.VALIDATE_STATUS) + ", gl error [" + _gl.getError() + "]");
                }
                // Cache uniform locations
                for (var i = 0; i < this._uniformList.length; i++) {
                    var uniformSymbol = this._uniformList[i];
                    var locationMap = this.cache.get("locations");
                    locationMap[uniformSymbol] = _gl.getUniformLocation(program, uniformSymbol);
                }

            } catch(e) {
                if (errorShader[this.__GUID__]) {
                    return;
                }
                errorShader[this.__GUID__] = this;
                throw e; 
            }

            _gl.deleteShader(vertexShader);
            _gl.deleteShader(fragmentShader);

            this.cache.put("program", program);
        },

        _compileShader : function(_gl, type, shaderString) {
            var shader = _gl.createShader(type === "fragment" ? _gl.FRAGMENT_SHADER : _gl.VERTEX_SHADER);
            _gl.shaderSource(shader, shaderString);
            _gl.compileShader(shader);

            if (!_gl.getShaderParameter(shader, _gl.COMPILE_STATUS)) {
                throw new Error([_gl.getShaderInfoLog(shader), addLineNumbers(shaderString)].join("\n"));
            }
            return shader;
        },

        clone : function() {
            var shader = new Shader({
                vertex : this.vertex,
                fragment : this.fragment,
                vertexDefines : util.clone(this.vertexDefines),
                fragmentDefines : util.clone(this.fragmentDefines)
            });
            for (var name in this._textureStatus) {
                shader._textureStatus[name] = util.clone(this._textureStatus[name]);
            }
            return shader;
        },

        dispose : function(_gl) {
            this.cache.use(_gl.__GLID__);
            if (program) {
                var program = this.cache.get('program');
            }
            _gl.deleteProgram(program);
            this.cache.deleteContext(_gl.__GLID__);
            this._locations = {};
        }
    });
    
    function getCacheSchema() {
        return {
            "locations" : {},
            "attriblocations" : {}
        }
    }

    // some util functions
    function addLineNumbers(string) {
        var chunks = string.split("\n");
        for (var i = 0, il = chunks.length; i < il; i ++) {
            // Chrome reports shader errors on lines
            // starting counting from 1
            chunks[i] = (i + 1) + ": " + chunks[i];
        }
        return chunks.join("\n");
    }

    var importRegex = /(@import)\s*([0-9a-zA-Z_\-\.]*)/g;
    Shader.parseImport = function(shaderStr) {
        shaderStr = shaderStr.replace(importRegex, function(str, importSymbol, importName) {
            if (_source[importName]) {
                // Recursively parse
                return Shader.parseImport(_source[importName]);
            } else {
                console.warn('Shader chunk "' + importName + '" not existed in library');
                return '';
            }
        })
        return shaderStr;
    }

    var exportRegex = /(@export)\s*([0-9a-zA-Z_\-\.]*)\s*\n([\s\S]*?)@end/g;
    // Import the shader to library and chunks
    Shader.import = function(shaderStr) {
        shaderStr.replace(exportRegex, function(str, exportSymbol, exportName, code) {
            _source[exportName] = code;
            return code;
        })
    }

    // Library to store all the loaded shader strings
    var _source = {};

    Shader.source = function(name) {
        var shaderStr = _source[name];
        if (! shaderStr) {
            console.warn('Shader "' + name + '" not existed in library');
            return;
        }
        return shaderStr;
    }

    return Shader;
});
define('qtek/light/light.essl',[],function () { return '@export buildin.header.directional_light\nuniform vec3 directionalLightDirection[ DIRECTIONAL_LIGHT_NUMBER ] : unconfigurable;\nuniform vec3 directionalLightColor[ DIRECTIONAL_LIGHT_NUMBER ] : unconfigurable;\n@end\n\n@export buildin.header.ambient_light\nuniform vec3 ambientLightColor[ AMBIENT_LIGHT_NUMBER ] : unconfigurable;\n@end\n\n@export buildin.header.point_light\nuniform vec3 pointLightPosition[ POINT_LIGHT_NUMBER ] : unconfigurable;\nuniform float pointLightRange[ POINT_LIGHT_NUMBER ] : unconfigurable;\nuniform vec3 pointLightColor[ POINT_LIGHT_NUMBER ] : unconfigurable;\n@end\n\n@export buildin.header.spot_light\nuniform vec3 spotLightPosition[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform vec3 spotLightDirection[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform float spotLightRange[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform float spotLightUmbraAngleCosine[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform float spotLightPenumbraAngleCosine[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform float spotLightFalloffFactor[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform vec3 spotLightColor[SPOT_LIGHT_NUMBER] : unconfigurable;\n@end';});

define('qtek/Light',['require','./Node','./Shader','./light/light.essl'],function(require){

    var Node = require("./Node");
    var Shader = require("./Shader");

    var Light = Node.derive(function(){
        return {
            color : [1, 1, 1],
            intensity : 1.0,
            
            // Config for shadow map
            castShadow : true,
            shadowResolution : 512
        }
    });

    Shader.import(require('./light/light.essl'));

    return Light;
});
define('qtek/Material',['require','./core/Base','./Shader','./core/util','./core/glenum','./Texture','./texture/Texture2D','./texture/TextureCube'],function(require) {

    var Base = require("./core/Base");
    var Shader = require("./Shader");
    var util = require("./core/util");
    var glenum = require("./core/glenum");
    var Texture = require('./Texture');
    var Texture2D = require('./texture/Texture2D');
    var TextureCube = require('./texture/TextureCube');

    var nameId = 0;

    var Material = Base.derive({
        name : 'MATERIAL_' + (nameId++),

        //{
        // type
        // value
        // semantic
        //}
        uniforms : null,

        shader : null,

        depthTest : true,
        depthMask : true,

        transparent : false,
        // Blend func is a callback function when the material 
        // have custom blending
        // The gl context will be the only argument passed in tho the
        // blend function
        // Detail of blend function in WebGL:
        // http://www.khronos.org/registry/gles/specs/2.0/es_full_spec_2.0.25.pdf
        //
        // Example :
        // function(_gl) {
        //  _gl.blendEquation(_gl.FUNC_ADD);
        //  _gl.blendFunc(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);
        // }
        blend : null,

        // shadowTransparentMap : null

        _enabledUniforms : null,
    }, function() {
        if (this.shader) {
            this.attachShader(this.shader);
        }
    }, {

        bind : function(_gl) {

            var slot = 0;

            // Set uniforms
            for (var u = 0; u < this._enabledUniforms.length; u++) {
                var symbol = this._enabledUniforms[u];
                var uniform = this.uniforms[symbol];
                if (uniform.value === undefined) {
                    console.warn('Uniform value "' + symbol + '" is undefined');
                    continue;
                }
                else if (uniform.value === null) {
                    continue;
                }
                else if (uniform.value instanceof Array
                    && ! uniform.value.length) {
                    continue;
                }
                else if (uniform.value instanceof Texture) {
                    var res = this.shader.setUniform(_gl, '1i', symbol, slot);
                    if (!res) { // Texture is not enabled
                        continue;
                    }
                    var texture = uniform.value;
                    _gl.activeTexture(_gl.TEXTURE0 + slot);
                    // Maybe texture is not loaded yet;
                    if (texture.isRenderable()) {
                        texture.bind(_gl);
                    } else {
                        // Bind texture to null
                        texture.unbind(_gl);
                    }

                    slot++;
                }
                else if (uniform.value instanceof Array) {
                    if (uniform.value.length === 0) {
                        continue;
                    }
                    // Texture Array
                    var exampleValue = uniform.value[0];

                    if (exampleValue instanceof Texture) {
                        if (!this.shader.hasUniform(symbol)) {
                            continue;
                        }

                        var arr = [];
                        for (var i = 0; i < uniform.value.length; i++) {
                            var texture = uniform.value[i];
                            _gl.activeTexture(_gl.TEXTURE0 + slot);
                            // Maybe texture is not loaded yet;
                            if (texture.isRenderable()) {
                                texture.bind(_gl);
                            } else {
                                texture.unbind(_gl);
                            }

                            arr.push(slot++);
                        }

                        this.shader.setUniform(_gl, '1iv', symbol, arr);
                    } else {
                        this.shader.setUniform(_gl, uniform.type, symbol, uniform.value);
                    }
                }
                else{
                    this.shader.setUniform(_gl, uniform.type, symbol, uniform.value);
                }
            }
        },

        setUniform : function(symbol, value) {
            var uniform = this.uniforms[symbol];
            if (uniform) {
                uniform.value = value;
            }
        },

        setUniforms : function(object) {
            for (var key in object) {
                var val = object[key];
                this.setUniform(key, val);
            }
        },

        enableUniform : function(symbol) {
            if (this.uniforms[symbol] && !this.isUniformEnabled(symbol)) {
                this._enabledUniforms.push(symbol);
            }
        },

        disableUniform : function(symbol) {
            var idx = this._enabledUniforms.indexOf(symbol);
            if (idx >= 0) {
                this._enabledUniforms.splice(idx, 1);
            }
        },

        isUniformEnabled : function(symbol) {
            return this._enabledUniforms.indexOf(symbol) >= 0;
        },

        // Alias of setUniform and setUniforms
        set : function(symbol, value) {
            if (typeof(symbol) === 'object') {
                for (var key in symbol) {
                    var val = symbol[key];
                    this.set(key, val);
                }
            } else {
                var uniform = this.uniforms[symbol];
                if (uniform) {
                    uniform.value = value;
                }
            }
        },

        get : function(symbol) {
            var uniform = this.uniforms[symbol];
            if (uniform) {
                return uniform.value;
            } else {
                // console.warn('Uniform '+symbol+' not exist');
            }
        },

        attachShader : function(shader, keepUniform) {
            var originalUniforms = this.uniforms;
            this.uniforms = shader.createUniforms();
            this.shader = shader;
            
            this._enabledUniforms = Object.keys(this.uniforms);

            if (keepUniform) {
                for (var symbol in originalUniforms) {
                    if (this.uniforms[symbol]) {
                        this.uniforms[symbol].value = originalUniforms[symbol].value;
                    }
                }
            }
        },

        detachShader : function() {
            this.shader = null;
            this.uniforms = {};
        },

        dispose : function() {
            //TODO
        }
    });

    return Material;
});
/**
 * StaticGeometry can not be changed once they've been setup
 */
define('qtek/StaticGeometry',['require','./Geometry','./core/util','./math/BoundingBox','glmatrix','./core/glenum'],function(require) {

    

    var Geometry = require("./Geometry");
    var util = require("./core/util");
    var BoundingBox = require("./math/BoundingBox");
    var glMatrix = require("glmatrix");
    var glenum = require("./core/glenum");
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;

    var StaticGeometry = Geometry.derive(function() {
        return {
            attributes : {
                 position : new Geometry.Attribute('position', 'float', 3, 'POSITION', false),
                 texcoord0 : new Geometry.Attribute('texcoord0', 'float', 2, 'TEXCOORD_0', false),
                 texcoord1 : new Geometry.Attribute('texcoord1', 'float', 2, 'TEXCOORD_1', false),
                 normal : new Geometry.Attribute('normal', 'float', 3, 'NORMAL', false),
                 tangent : new Geometry.Attribute('tangent', 'float', 4, 'TANGENT', false),
                 color : new Geometry.Attribute('color', 'float', 4, 'COLOR', false),
                 // Skinning attributes
                 // Each vertex can be bind to 4 bones, because the 
                 // sum of weights is 1, so the weights is stored in vec3 and the last
                 // can be calculated by 1-w.x-w.y-w.z
                 weight : new Geometry.Attribute('weight', 'float', 3, 'WEIGHT', false),
                 joint : new Geometry.Attribute('joint', 'float', 4, 'JOINT', false),
                 // For wireframe display
                 // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
                 barycentric : new Geometry.Attribute('barycentric', 'float', 3, null, false),
            },

            hint : glenum.STATIC_DRAW,

            _normalType : 'vertex',

            _enabledAttributes : null,

        }
    }, {
        dirty : function() {
            this.cache.dirtyAll("chunks");
            this._enabledAttributes = null;
        },
        
        getVertexNumber : function() {
            return this.attributes.position.value.length / 3;
        },

        getFaceNumber : function() {
            return this.faces.length / 3;
        },
        
        isUseFace : function() {
            return this.useFace && this.faces;
        },

        isStatic : function() {
            return true;
        },

        getEnabledAttributes : function() {
            // Cache
            if (this._enabledAttributes) {
                return this._enabledAttributes;
            }

            var result = {};
            var nVertex = this.getVertexNumber();

            for (var name in this.attributes) {
                var attrib = this.attributes[name];
                if (attrib.value) {
                    if (attrib.value.length === nVertex * attrib.size) {
                        result[name] = attrib;
                    }
                }
            }

            this._enabledAttributes = result;

            return result;
        },

        getBufferChunks : function(_gl) {
            this.cache.use(_gl.__GLID__);
            if (this.cache.isDirty("chunks")) {
                this._updateBuffer(_gl);
                this.cache.fresh("chunks");
            }
            return this.cache.get("chunks");
        },
        
        _updateBuffer : function(_gl) {
            var chunks = this.cache.get("chunks");
            if (! chunks) {
                chunks = [];
                // Intialize
                chunks[0] = {
                    attributeBuffers : [],
                    indicesBuffer : null
                }
                this.cache.put("chunks", chunks);
            }
            var chunk = chunks[0];
            var attributeBuffers = chunk.attributeBuffers;
            var indicesBuffer = chunk.indicesBuffer;

            var attributes = this.getEnabledAttributes();
            var prevSearchIdx = 0;
            var count = 0;
            for (var name in attributes) {
                var attribute = attributes[name];
                if (!attribute.value) {
                    continue;
                }

                var bufferInfo;
                for (var i = prevSearchIdx; i < attributeBuffers.length; i++) {
                    if (attributeBuffers[i].name === name) {
                        bufferInfo = attributeBuffers[i];
                        prevSearchIdx = i + 1;
                        break;
                    }
                }
                for (var i = prevSearchIdx - 1; i >= 0; i--) {
                    if (attributeBuffers[i].name === name) {
                        bufferInfo = attributeBuffers[i];
                        prevSearchIdx = i;
                        break;
                    }
                }

                var buffer;
                if (bufferInfo) {
                    buffer = bufferInfo.buffer;
                } else {
                    buffer = _gl.createBuffer();
                }
                //TODO: Use BufferSubData?
                _gl.bindBuffer(_gl.ARRAY_BUFFER, buffer);
                _gl.bufferData(_gl.ARRAY_BUFFER, attribute.value, this.hint);

                attributeBuffers[count++] = new Geometry.AttributeBuffer(name, attribute.type, buffer, attribute.size, attribute.semantic);
            }
            attributeBuffers.length = count;

            if (! indicesBuffer && this.isUseFace()) {
                indicesBuffer = new Geometry.IndicesBuffer(_gl.createBuffer(), this.faces.length);
                chunk.indicesBuffer = indicesBuffer;
                _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer);
                _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, this.faces, this.hint);
            }
        },

        generateVertexNormals : function() {
            console.warn('Static Geometry doesn\'t support normal generate');
        },

        generateFaceNormals : function() {
            console.warn('Static Geometry doesn\'t support normal generate');
        },

        generateTangents : function() {
            var nVertex = this.getVertexNumber();
            if (!this.attributes.tangent.value) {
                this.attributes.tangent.value = new Float32Array(nVertex * 4);
            }
            var texcoords = this.attributes.texcoord0.value;
            var positions = this.attributes.position.value;
            var tangents = this.attributes.tangent.value;
            var normals = this.attributes.normal.value;

            var tan1 = [];
            var tan2 = [];
            for (var i = 0; i < nVertex; i++) {
                tan1[i] = [0.0, 0.0, 0.0];
                tan2[i] = [0.0, 0.0, 0.0];
            }

            var sdir = [0.0, 0.0, 0.0];
            var tdir = [0.0, 0.0, 0.0];
            for (var i = 0; i < this.faces.length;) {
                var i1 = this.faces[i++],
                    i2 = this.faces[i++],
                    i3 = this.faces[i++],

                    st1s = texcoords[i1 * 2],
                    st2s = texcoords[i2 * 2],
                    st3s = texcoords[i3 * 2],
                    st1t = texcoords[i1 * 2 + 1],
                    st2t = texcoords[i2 * 2 + 1],
                    st3t = texcoords[i3 * 2 + 1],

                    p1x = positions[i1 * 3],
                    p2x = positions[i2 * 3],
                    p3x = positions[i3 * 3],
                    p1y = positions[i1 * 3 + 1],
                    p2y = positions[i2 * 3 + 1],
                    p3y = positions[i3 * 3 + 1],
                    p1z = positions[i1 * 3 + 2],
                    p2z = positions[i2 * 3 + 2],
                    p3z = positions[i3 * 3 + 2];

                var x1 = p2x - p1x,
                    x2 = p3x - p1x,
                    y1 = p2y - p1y,
                    y2 = p3y - p1y,
                    z1 = p2z - p1z,
                    z2 = p3z - p1z;

                var s1 = st2s - st1s,
                    s2 = st3s - st1s,
                    t1 = st2t - st1t,
                    t2 = st3t - st1t;

                var r = 1.0 / (s1 * t2 - t1 * s2);
                sdir[0] = (t2 * x1 - t1 * x2) * r;
                sdir[1] = (t2 * y1 - t1 * y2) * r; 
                sdir[2] = (t2 * z1 - t1 * z2) * r;

                tdir[0] = (s1 * x2 - s2 * x1) * r;
                tdir[1] = (s1 * y2 - s2 * y1) * r;
                tdir[2] = (s1 * z2 - s2 * z1) * r;

                vec3.add(tan1[i1], tan1[i1], sdir);
                vec3.add(tan1[i2], tan1[i2], sdir);
                vec3.add(tan1[i3], tan1[i3], sdir);
                vec3.add(tan2[i1], tan2[i1], tdir);
                vec3.add(tan2[i2], tan2[i2], tdir);
                vec3.add(tan2[i3], tan2[i3], tdir);
            }
            var tmp = vec3.create();
            var nCrossT = vec3.create();
            var n = vec3.create();
            for (var i = 0; i < nVertex; i++) {
                n[0] = normals[i * 3];
                n[1] = normals[i * 3 + 1];
                n[2] = normals[i * 3 + 2];
                var t = tan1[i];

                // Gram-Schmidt orthogonalize
                vec3.scale(tmp, n, vec3.dot(n, t));
                vec3.sub(tmp, t, tmp);
                vec3.normalize(tmp, tmp);
                // Calculate handedness.
                vec3.cross(nCrossT, n, t);
                tangents[i * 4] = tmp[0];
                tangents[i * 4 + 1] = tmp[1];
                tangents[i * 4 + 2] = tmp[2];
                tangents[i * 4 + 3] = vec3.dot(nCrossT, tan2[i]) < 0.0 ? -1.0 : 1.0;;
            }
        },

        isUniqueVertex : function() {
            if (this.isUseFace()) {
                return this.getVertexNumber() === this.faces.length;
            } else {
                return true;
            }
        },

        generateUniqueVertex : function() {
            var vertexUseCount = [];

            for (var i = 0, len = this.getVertexNumber(); i < len; i++) {
                vertexUseCount[i] = 0;
            }

            var cursor = this.getVertexNumber();
            var attributes = this.getEnabledAttributes();
            var faces = this.faces;

            var attributeNameList = Object.keys(attributes);

            for (var name in attributes) {
                var expandedArray = new Float32Array(this.faces.length * attributes[name].size);
                var len = attributes[name].value.length;
                for (var i = 0; i < len; i++) {
                    expandedArray[i] = attributes[name].value[i];
                }
                attributes[name].value = expandedArray;
            }

            for (var i = 0; i < faces.length; i++) {
                var ii = faces[i];
                if (vertexUseCount[ii] > 0) {
                    for (var a = 0; a < attributeNameList.length; a++) {
                        var name = attributeNameList[a];
                        var array = attributes[name].value;
                        var size = attributes[name].size;

                        for (var k = 0; k < size; k++) {
                            array[cursor * size + k] = array[ii * size + k];
                        }
                    }
                    faces[i] = cursor;
                    cursor++;
                }
                vertexUseCount[ii]++;
            }
        },

        generateBarycentric : function() {

            if (! this.isUniqueVertex()) {
                this.generateUniqueVertex();
            }

            var array = this.attributes.barycentric.value;
            // Already existed;
            if (array && array.length === this.faces.length * 3) {
                return;
            }
            array = this.attributes.barycentric.value = new Float32Array(this.faces.length * 3);
            var i1, i2, i3, face;
            for (var i = 0; i < this.faces.length;) {
                for (var j = 0; j < 3; j++) {
                    var ii = this.faces[i++];
                    array[ii + j] = 1;
                }
            }
        },

        convertToDynamic : function(geometry) {
            var offset = 0;
            var chunk = this._arrayChunks[c];

            for (var i = 0; i < this.faces.length; i+=3) {
                geometry.faces.push(this.face.subarray(i, i + 3));
            }

            var attributes = this.getEnabledAttributes();
            for (var name in attributes) {
                var attrib = attributes[name];
                var geoAttrib = geometry.attributes[name];
                if (!geoAttrib) {
                    geoAttrib = geometry.attributes[name] = {
                        type : attrib.type,
                        size : attrib.size,
                        value : []
                    }
                    if (attrib.semantic) {
                        geoAttrib.semantic = attrib.semantic;
                    }
                }
                for (var i = 0; i < attrib.value.length; i+= attrib.size) {
                    if (attrib.size === 1) {
                        geoAttrib.value.push(attrib.array[i]);
                    } else {
                        geoAttrib.value.push(attrib.subarray(i, i + attrib.size));
                    }
                }
            }

            if (this.boundingBox) {
                geometry.boundingBox = new BoundingBox();
                geometry.boundingBox.min.copy(this.boundingBox.min);
                geometry.boundingBox.max.copy(this.boundingBox.max);
            }
            // PENDING : copy buffer ?
            
            return geometry;
        },

        applyTransform : function(matrix) {

            if (this.boundingBox) {
                this.boundingBox.applyTransform(matrix);
            }

            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            var tangents = this.attributes.tangent.value;

            matrix = matrix._array;
            // Normal Matrix
            var inverseTransposeMatrix = mat4.create();
            mat4.invert(inverseTransposeMatrix, matrix);
            mat4.transpose(inverseTransposeMatrix, inverseTransposeMatrix);

            vec3.forEach(positions, 3, 0, null, vec3.transformMat4, matrix);
            if (normals) {
                vec3.forEach(normals, 3, 0, null, vec3.transformMat4, inverseTransposeMatrix);
            }
            if (tangents) {
                vec3.forEach(tangents, 4, 0, null, vec3.transformMat4, inverseTransposeMatrix);   
            }
        },

        dispose : function(_gl) {
            this.cache.use(_gl.__GLID__);
            var chunks = this.cache.get('chunks');
            if (chunks) {
                for (var c = 0; c < chunks.length; c++) {
                    var chunk = chunks[c];

                    for (var name in chunk.attributeBuffers) {
                        var attribs = chunk.attributeBuffers[name];
                        _gl.deleteBuffer(attribs.buffer);
                    }
                }
            }
            this.cache.deleteContext(_gl.__GLID__);
        }
    });

    return StaticGeometry;
});
define('qtek/Mesh',['require','./Node','./core/glenum','./math/Vector3','./StaticGeometry'],function(require) {

    

    var Node = require("./Node");
    var glenum = require("./core/glenum");
    var Vector3 = require("./math/Vector3");
    var StaticGeometry = require('./StaticGeometry');

    // Cache
    var prevDrawID = 0;
    var prevDrawIndicesBuffer = null;
    var prevDrawIsUseFace = true;

    var needsBindAttributes;
    var currentDrawID;

    var RenderInfo = function() {
        this.faceNumber = 0;
        this.vertexNumber = 0;
        this.drawCallNumber = 0;
    }

    function DrawDetail(
        availableAttributes,
        availableAttributeSymbols,
        indicesBuffer
    ) {
        this.availableAttributes = availableAttributes;
        this.availableAttributeSymbols = availableAttributeSymbols;
        this.indicesBuffer = indicesBuffer;
    }

    var Mesh = Node.derive(function() {
        return {
            
            material : null,

            geometry : null,
            
            mode : glenum.TRIANGLES,

            // // Skinned Mesh
            skeleton : null,
            // Joints indices
            // Meshes can share the one skeleton instance
            // and each mesh can use one part of joints
            // Joints indeces indicate the index of joint in the skeleton instance
            joints : [],

            _drawCache : {},

            _renderInfo : new RenderInfo()
        }
    }, {

        visible : true,

        // Only if mode is LINES
        lineWidth : 1,
        
        // Culling
        culling : true,
        cullFace : glenum.BACK,
        frontFace : glenum.CCW,

        // Software frustum culling
        frustumCulling : true,

        receiveShadow : true,
        castShadow : true,

        isRenderable : function() {
            return this.geometry && this.material && this.material.shader && this.visible;
        },

        render : function(_gl, globalMaterial) {
            var material = globalMaterial || this.material;
            var shader = material.shader;
            var geometry = this.geometry;

            var glDrawMode = this.mode;
            
            // Set pose matrices of skinned mesh
            if (this.skeleton) {
                var skinMatricesArray = this.skeleton.getSubSkinMatrices(this.__GUID__, this.joints);
                shader.setUniformBySemantic(_gl, "SKIN_MATRIX", skinMatricesArray);
            }

            var nVertex = geometry.getVertexNumber();
            var renderInfo = this._renderInfo;
            renderInfo.vertexNumber = nVertex;
            renderInfo.faceNumber = 0;
            renderInfo.drawCallNumber = 0;
            // Draw each chunk
            needsBindAttributes = false;
            if (nVertex > geometry.chunkSize) {
                needsBindAttributes = true;
            } else {
                // Hash with shader id in case previous material has less attributes than next material
                currentDrawID = _gl.__GLID__ + '-' + geometry.__GUID__ + '-' + shader.__GUID__;
                if (currentDrawID !== prevDrawID) {
                    needsBindAttributes = true;
                    prevDrawID = currentDrawID;
                }
            }
            if (!needsBindAttributes) {
                // Direct draw
                if (prevDrawIsUseFace) {
                    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, prevDrawIndicesBuffer.buffer);
                    _gl.drawElements(glDrawMode, prevDrawIndicesBuffer.count, _gl.UNSIGNED_SHORT, 0);
                    renderInfo.faceNumber = prevDrawIndicesBuffer.count / 3;
                }
                else {
                    _gl.drawArrays(glDrawMode, 0, nVertex);
                }
                renderInfo.drawCallNumber = 1;
            } else {
                // Use the cache of static geometry
                // TODO : machanism to change to the DynamicGeometry automatically
                // when the geometry is not static any more
                var drawDetails = this._drawCache[currentDrawID];
                if (!drawDetails) {
                    var chunks = geometry.getBufferChunks(_gl);
                    if (!chunks) {  // Empty mesh
                        return;
                    }
                    drawDetails = [];
                    for (var c = 0; c < chunks.length; c++) {
                        var chunk = chunks[c];
                        var attributeBuffers = chunk.attributeBuffers;
                        var indicesBuffer = chunk.indicesBuffer;

                        var availableAttributes = [];
                        var availableAttributeSymbols = [];
                        for (var a = 0; a < attributeBuffers.length; a++) {
                            var attributeBufferInfo = attributeBuffers[a];
                            var name = attributeBufferInfo.name;
                            var semantic = attributeBufferInfo.semantic;

                            if (semantic) {
                                var semanticInfo = shader.attribSemantics[semantic];
                                var symbol = semanticInfo && semanticInfo.symbol;
                            } else {
                                var symbol = name;
                            }
                            if (symbol && shader.attributeTemplates[symbol]) {
                                availableAttributes.push(attributeBufferInfo);
                                availableAttributeSymbols.push(symbol);
                            }
                        }
                        var drawDetail = new DrawDetail(
                            availableAttributes,
                            availableAttributeSymbols,
                            indicesBuffer
                        );
                        drawDetails.push(drawDetail);
                    }
                    if (geometry.hint == glenum.STATIC_DRAW) {
                        this._drawCache[currentDrawID] = drawDetails;
                    }
                }

                for (var i = 0; i < drawDetails.length; i++) {
                    var drawDetail = drawDetails[i];
                    var availableAttributes = drawDetail.availableAttributes;
                    var availableAttributeSymbols = drawDetail.availableAttributeSymbols;
                    var indicesBuffer = drawDetail.indicesBuffer;

                    var locationList = shader.enableAttributes(_gl, availableAttributeSymbols);
                    // Setting attributes;
                    for (var a = 0; a < availableAttributes.length; a++) {
                        var location = locationList[a];
                        if (location === -1) {
                            continue;
                        }
                        var attributeBufferInfo = availableAttributes[a];
                        var buffer = attributeBufferInfo.buffer;
                        var symbol = availableAttributeSymbols[a];
                        var size = attributeBufferInfo.size;
                        var glType;
                        switch (attributeBufferInfo.type) {
                            case "float":
                                glType = _gl.FLOAT;
                                break;
                            case "byte":
                                glType = _gl.BYTE;
                                break;
                            case "ubyte":
                                glType = _gl.UNSIGNED_BYTE;
                                break;
                            case "short":
                                glType = _gl.SHORT;
                                break;
                            case "ushort":
                                glType = _gl.UNSIGNED_SHORT;
                                break;
                            default:
                                glType = _gl.FLOAT;
                                break;
                        }

                        _gl.bindBuffer(_gl.ARRAY_BUFFER, buffer);
                        _gl.vertexAttribPointer(location, size, glType, false, 0, 0);
                    }
                    
                    if (glDrawMode === glenum.LINES) {
                        _gl.lineWidth(this.lineWidth);
                    }
                    
                    prevDrawIsUseFace = geometry.isUseFace();
                    prevDrawIndicesBuffer = indicesBuffer;
                    //Do drawing
                    if (prevDrawIsUseFace) {
                        _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer);
                        _gl.drawElements(glDrawMode, indicesBuffer.count, _gl.UNSIGNED_SHORT, 0);
                        renderInfo.faceNumber += indicesBuffer.count / 3;
                    } else {
                        _gl.drawArrays(glDrawMode, 0, nVertex);
                    }
                    renderInfo.drawCallNumber++;
                }
            }

            return renderInfo;
        },

        clone : function() {
            var mesh = Node.prototype.clone.call(this);

            mesh.geometry = this.geometry;
            mesh.material = this.material;

            return mesh;
        }
    });

    // Enums
    Mesh.POINTS = glenum.POINTS;
    Mesh.LINES = glenum.LINES;
    Mesh.LINE_LOOP = glenum.LINE_LOOP;
    Mesh.LINE_STRIP = glenum.LINE_STRIP;
    Mesh.TRIANGLES = glenum.TRIANGLES;
    Mesh.TRIANGLE_STRIP = glenum.TRIANGLE_STRIP;
    Mesh.TRIANGLE_FAN = glenum.TRIANGLE_FAN;

    Mesh.BACK = glenum.BACK;
    Mesh.FRONT = glenum.FRONT;
    Mesh.FRONT_AND_BACK = glenum.FRONT_AND_BACK;
    Mesh.CW = glenum.CW;
    Mesh.CCW = glenum.CCW;

    Mesh.RenderInfo = RenderInfo;

    return Mesh;
});
define('qtek/shader/source/basic.essl',[],function () { return '@export buildin.basic.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\n\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 position : POSITION;\n\nattribute vec3 barycentric;\n\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\nuniform mat4 skinMatrix[JOINT_NUMBER] : SKIN_MATRIX;\n#endif\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Barycentric;\n\nvoid main()\n{\n\n    vec3 skinnedPosition = position;\n\n    #ifdef SKINNING\n        \n        @import buildin.chunk.skin_matrix\n        \n        skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n    #endif\n\n    v_Texcoord = texcoord * uvRepeat;\n    v_Barycentric = barycentric;\n\n    gl_Position = worldViewProjection * vec4(skinnedPosition, 1.0);\n}\n\n@end\n\n\n\n\n@export buildin.basic.fragment\n\nvarying vec2 v_Texcoord;\nuniform sampler2D diffuseMap;\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform vec3 emission : [0.0, 0.0, 0.0];\nuniform float alpha : 1.0;\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#extension GL_OES_standard_derivatives : enable\n@import buildin.util.edge_factor\n\nvoid main()\n{\n\n    gl_FragColor = vec4(color, alpha);\n    \n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D( diffuseMap, v_Texcoord );\n\n        #ifdef SRGB_DECODE\n            tex.rgb = pow(tex.rgb, vec3(2.2));\n        #endif\n        \n        #if defined(DIFFUSEMAP_ALPHA_ALPHA)\n            gl_FragColor.a = tex.a;\n        #endif\n\n        gl_FragColor.rgb *= tex.rgb;\n    #endif\n\n    gl_FragColor.rgb += emission;\n    if( lineWidth > 0.01)\n    {\n        gl_FragColor.rgb = gl_FragColor.rgb * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n}\n\n@end';});

define('qtek/shader/source/lambert.essl',[],function () { return '/**\n * http://en.wikipedia.org/wiki/Lambertian_reflectance\n */\n\n@export buildin.lambert.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;\nuniform mat4 world : WORLD;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\n\nattribute vec3 barycentric;\n\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\nuniform mat4 skinMatrix[JOINT_NUMBER] : SKIN_MATRIX;\n#endif\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\nvarying vec3 v_Barycentric;\n\nvoid main()\n{\n\n    vec3 skinnedPosition = position;\n    vec3 skinnedNormal = normal;\n\n    #ifdef SKINNING\n        \n        @import buildin.chunk.skin_matrix\n\n        skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n        // Normal matrix ???\n        skinnedNormal = (skinMatrixWS * vec4(normal, 0.0)).xyz;\n    #endif\n\n    gl_Position = worldViewProjection * vec4( skinnedPosition, 1.0 );\n\n    v_Texcoord = texcoord * uvRepeat;\n    v_Normal = normalize( ( worldInverseTranspose * vec4(skinnedNormal, 0.0) ).xyz );\n    v_WorldPosition = ( world * vec4( skinnedPosition, 1.0) ).xyz;\n\n    v_Barycentric = barycentric;\n}\n\n@end\n\n\n\n\n@export buildin.lambert.fragment\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\nuniform sampler2D diffuseMap;\nuniform sampler2D alphaMap;\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform vec3 emission : [0.0, 0.0, 0.0];\nuniform float alpha : 1.0;\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#ifdef AMBIENT_LIGHT_NUMBER\n@import buildin.header.ambient_light\n#endif\n#ifdef POINT_LIGHT_NUMBER\n@import buildin.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_NUMBER\n@import buildin.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_NUMBER\n@import buildin.header.spot_light\n#endif\n\n#extension GL_OES_standard_derivatives : enable\n// Import util functions and uniforms needed\n@import buildin.util.calculate_attenuation\n\n@import buildin.util.edge_factor\n\n@import buildin.plugin.compute_shadow_map\n\nvoid main()\n{\n    #ifdef RENDER_NORMAL\n        gl_FragColor = vec4(v_Normal, 1.0);\n        return;\n    #endif\n    #ifdef RENDER_TEXCOORD\n        gl_FragColor = vec4(v_Texcoord, 1.0, 1.0);\n        return;\n    #endif\n\n    gl_FragColor = vec4(color, alpha);\n\n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D( diffuseMap, v_Texcoord );\n        #ifdef SRGB_DECODE\n            tex.rgb = pow(tex.rgb, vec3(2.2));\n        #endif\n        gl_FragColor.rgb *= tex.rgb;\n        #ifdef DIFFUSEMAP_ALPHA_ALPHA\n            gl_FragColor.a *= tex.a;\n        #endif\n    #endif\n\n    vec3 diffuseColor = vec3(0.0, 0.0, 0.0);\n    \n    #ifdef AMBIENT_LIGHT_NUMBER\n        for(int i = 0; i < AMBIENT_LIGHT_NUMBER; i++)\n        {\n            diffuseColor += ambientLightColor[i];\n        }\n    #endif\n    // Compute point light color\n    #ifdef POINT_LIGHT_NUMBER\n        #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowContribs[POINT_LIGHT_NUMBER];\n            if( shadowEnabled )\n            {\n                computeShadowOfPointLights( v_WorldPosition, shadowContribs );\n            }\n        #endif\n        for(int i = 0; i < POINT_LIGHT_NUMBER; i++)\n        {\n\n            vec3 lightPosition = pointLightPosition[i];\n            vec3 lightColor = pointLightColor[i];\n            float range = pointLightRange[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n\n            // Calculate point light attenuation\n            float dist = length(lightDirection);\n            float attenuation = lightAttenuation(dist, range);\n\n            // Normalize vectors\n            lightDirection /= dist;\n\n            float ndl = dot( v_Normal, lightDirection );\n\n            float shadowContrib = 1.0;\n            #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled )\n                {\n                    shadowContrib = shadowContribs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * clamp(ndl, 0.0, 1.0) * attenuation * shadowContrib;\n        }\n    #endif\n    #ifdef DIRECTIONAL_LIGHT_NUMBER\n        #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n            float shadowContribs[DIRECTIONAL_LIGHT_NUMBER];\n            if(shadowEnabled)\n            {\n                computeShadowOfDirectionalLights( v_WorldPosition, shadowContribs );\n            }\n        #endif\n        for(int i = 0; i < DIRECTIONAL_LIGHT_NUMBER; i++)\n        {\n            vec3 lightDirection = -directionalLightDirection[i];\n            vec3 lightColor = directionalLightColor[i];\n            \n            float ndl = dot( v_Normal, normalize( lightDirection ) );\n\n            float shadowContrib = 1.0;\n            #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled )\n                {\n                    shadowContrib = shadowContribs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * clamp(ndl, 0.0, 1.0) * shadowContrib;\n        }\n    #endif\n    \n    #ifdef SPOT_LIGHT_NUMBER\n        #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowContribs[SPOT_LIGHT_NUMBER];\n            if( shadowEnabled )\n            {\n                computeShadowOfSpotLights( v_WorldPosition, shadowContribs );\n            }\n        #endif\n        for(int i = 0; i < SPOT_LIGHT_NUMBER; i++)\n        {\n            vec3 lightPosition = -spotLightPosition[i];\n            vec3 spotLightDirection = -normalize( spotLightDirection[i] );\n            vec3 lightColor = spotLightColor[i];\n            float range = spotLightRange[i];\n            float a = spotLightUmbraAngleCosine[i];\n            float b = spotLightPenumbraAngleCosine[i];\n            float falloffFactor = spotLightFalloffFactor[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n            // Calculate attenuation\n            float dist = length(lightDirection);\n            float attenuation = lightAttenuation(dist, range); \n\n            // Normalize light direction\n            lightDirection /= dist;\n            // Calculate spot light fall off\n            float c = dot(spotLightDirection, lightDirection);\n\n            float falloff;\n            falloff = clamp((c - a) /( b - a), 0.0, 1.0);\n            falloff = pow(falloff, falloffFactor);\n\n            float ndl = dot(v_Normal, lightDirection);\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowContrib = 1.0;\n            #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled )\n                {\n                    shadowContrib = shadowContribs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * ndl * attenuation * (1.0-falloff) * shadowContrib;\n\n        }\n    #endif\n\n    gl_FragColor.rgb *= diffuseColor;\n    gl_FragColor.rgb += emission;\n    if(lineWidth > 0.01)\n    {\n        gl_FragColor.rgb = gl_FragColor.rgb * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n}\n\n@end';});

define('qtek/shader/source/phong.essl',[],function () { return '\n// http://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_shading_model\n\n@export buildin.phong.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;\nuniform mat4 world : WORLD;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\nattribute vec4 tangent : TANGENT;\n\n#ifdef VERTEX_COLOR\nattribute vec4 color : COLOR;\n#endif\n\nattribute vec3 barycentric;\n\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\nuniform mat4 skinMatrix[JOINT_NUMBER] : SKIN_MATRIX;\n#endif\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\nvarying vec3 v_Barycentric;\n\n#ifdef NORMALMAP_ENABLED\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\n#endif\n\n#ifdef VERTEX_COLOR\nvarying vec4 v_Color;\n#endif\n\nvoid main()\n{\n    \n    vec3 skinnedPosition = position;\n    vec3 skinnedNormal = normal;\n    vec3 skinnedTangent = tangent.xyz;\n    #ifdef SKINNING\n        \n        @import buildin.chunk.skin_matrix\n\n        skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n        // Normal matrix ???\n        skinnedNormal = (skinMatrixWS * vec4(normal, 0.0)).xyz;\n        skinnedTangent = (skinMatrixWS * vec4(tangent.xyz, 0.0)).xyz;\n    #endif\n\n    gl_Position = worldViewProjection * vec4(skinnedPosition, 1.0);\n\n    v_Texcoord = texcoord * uvRepeat;\n    v_WorldPosition = (world * vec4(skinnedPosition, 1.0)).xyz;\n    v_Barycentric = barycentric;\n\n    v_Normal = normalize((worldInverseTranspose * vec4(skinnedNormal, 0.0)).xyz);\n    \n    #ifdef NORMALMAP_ENABLED\n        v_Tangent = normalize((worldInverseTranspose * vec4(skinnedTangent, 0.0)).xyz);\n        v_Bitangent = normalize(cross(v_Normal, v_Tangent) * tangent.w);\n    #endif\n\n    #ifdef VERTEX_COLOR\n        v_Color = color;\n    #endif\n}\n\n@end\n\n\n@export buildin.phong.fragment\n\nuniform mat4 viewInverse : VIEWINVERSE;\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\n#ifdef NORMALMAP_ENABLED\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\n#endif\n\nuniform sampler2D diffuseMap;\nuniform sampler2D normalMap;\nuniform samplerCube environmentMap;\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\nuniform float shininess : 30;\n\nuniform vec3 specularColor : [1.0, 1.0, 1.0];\nuniform vec3 emission : [0.0, 0.0, 0.0];\n\nuniform float reflectivity : 0.5;\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#ifdef AMBIENT_LIGHT_NUMBER\n@import buildin.header.ambient_light\n#endif\n#ifdef POINT_LIGHT_NUMBER\n@import buildin.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_NUMBER\n@import buildin.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_NUMBER\n@import buildin.header.spot_light\n#endif\n\n#extension GL_OES_standard_derivatives : enable\n// Import util functions and uniforms needed\n@import buildin.util.calculate_attenuation\n\n@import buildin.util.edge_factor\n\n@import buildin.plugin.compute_shadow_map\n\nvoid main()\n{\n    #ifdef RENDER_TEXCOORD\n        gl_FragColor = vec4(v_Texcoord, 1.0, 1.0);\n        return;\n    #endif\n\n    vec4 finalColor = vec4(color, alpha);\n\n    vec3 eyePos = viewInverse[3].xyz;\n    vec3 viewDirection = normalize(eyePos - v_WorldPosition);\n\n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D(diffuseMap, v_Texcoord);\n        #ifdef SRGB_DECODE\n            tex.rgb = pow(tex.rgb, vec3(2.2));\n        #endif\n        finalColor.rgb *= tex.rgb;\n        #ifdef DIFFUSEMAP_ALPHA_ALPHA\n            finalColor.a *= tex.a;\n        #endif\n    #endif\n\n    vec3 normal = v_Normal;\n    #ifdef NORMALMAP_ENABLED\n        normal = texture2D(normalMap, v_Texcoord).xyz * 2.0 - 1.0;\n        mat3 tbn = mat3(v_Tangent, v_Bitangent, v_Normal);\n        normal = normalize(tbn * normal);\n    #endif\n\n    #ifdef RENDER_NORMAL\n        gl_FragColor = vec4(normal, 1.0);\n        return;\n    #endif\n\n    // Diffuse part of all lights\n    vec3 diffuseTerm = vec3(0.0, 0.0, 0.0);\n    // Specular part of all lights\n    vec3 specularTerm = vec3(0.0, 0.0, 0.0);\n    \n    #ifdef AMBIENT_LIGHT_NUMBER\n        for(int i = 0; i < AMBIENT_LIGHT_NUMBER; i++)\n        {\n            diffuseTerm += ambientLightColor[i];\n        }\n    #endif\n    #ifdef POINT_LIGHT_NUMBER\n        #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowContribs[POINT_LIGHT_NUMBER];\n            if(shadowEnabled)\n            {\n                computeShadowOfPointLights(v_WorldPosition, shadowContribs);\n            }\n        #endif\n        for(int i = 0; i < POINT_LIGHT_NUMBER; i++)\n        {\n            vec3 lightPosition = pointLightPosition[i];\n            vec3 lightColor = pointLightColor[i];\n            float range = pointLightRange[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n\n            // Calculate point light attenuation\n            float dist = length(lightDirection);\n            float attenuation = lightAttenuation(dist, range); \n\n            // Normalize vectors\n            lightDirection /= dist;\n            vec3 halfVector = normalize(lightDirection + viewDirection);\n\n            float ndh = dot(normal, halfVector);\n            ndh = clamp(ndh, 0.0, 1.0);\n\n            float ndl = dot(normal,  lightDirection);\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowContrib = 1.0;\n            #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n                if(shadowEnabled)\n                {\n                    shadowContrib = shadowContribs[i];\n                }\n            #endif\n\n            vec3 li = lightColor * ndl * attenuation * shadowContrib;\n\n            diffuseTerm += li;\n            if (shininess > 0.0)\n            {\n                specularTerm += li * pow(ndh, shininess);\n            }\n\n        }\n    #endif\n\n    #ifdef DIRECTIONAL_LIGHT_NUMBER\n        #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n            float shadowContribs[DIRECTIONAL_LIGHT_NUMBER];\n            if(shadowEnabled)\n            {\n                computeShadowOfDirectionalLights(v_WorldPosition, shadowContribs);\n            }\n        #endif\n        for(int i = 0; i < DIRECTIONAL_LIGHT_NUMBER; i++)\n        {\n\n            vec3 lightDirection = -normalize(directionalLightDirection[i]);\n            vec3 lightColor = directionalLightColor[i];\n\n            vec3 halfVector = normalize(lightDirection + viewDirection);\n\n            float ndh = dot(normal, halfVector);\n            ndh = clamp(ndh, 0.0, 1.0);\n\n            float ndl = dot(normal, lightDirection);\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowContrib = 1.0;\n            #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n                if(shadowEnabled)\n                {\n                    shadowContrib = shadowContribs[i];\n                }\n            #endif\n\n            vec3 li = lightColor * ndl * shadowContrib;\n\n            diffuseTerm += li;\n            if (shininess > 0.0)\n            {\n                specularTerm += li * pow(ndh, shininess);\n            }\n        }\n    #endif\n\n    #ifdef SPOT_LIGHT_NUMBER\n        #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowContribs[SPOT_LIGHT_NUMBER];\n            if(shadowEnabled)\n            {\n                computeShadowOfSpotLights(v_WorldPosition, shadowContribs);\n            }\n        #endif\n        for(int i = 0; i < SPOT_LIGHT_NUMBER; i++)\n        {\n            vec3 lightPosition = spotLightPosition[i];\n            vec3 spotLightDirection = -normalize(spotLightDirection[i]);\n            vec3 lightColor = spotLightColor[i];\n            float range = spotLightRange[i];\n            float a = spotLightUmbraAngleCosine[i];\n            float b = spotLightPenumbraAngleCosine[i];\n            float falloffFactor = spotLightFalloffFactor[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n            // Calculate attenuation\n            float dist = length(lightDirection);\n            float attenuation = lightAttenuation(dist, range); \n\n            // Normalize light direction\n            lightDirection /= dist;\n            // Calculate spot light fall off\n            float c = dot(spotLightDirection, lightDirection);\n\n            float falloff;\n            // Fomular from real-time-rendering\n            falloff = clamp((c - a) /( b - a), 0.0, 1.0);\n            falloff = pow(falloff, falloffFactor);\n\n            vec3 halfVector = normalize(lightDirection + viewDirection);\n\n            float ndh = dot(normal, halfVector);\n            ndh = clamp(ndh, 0.0, 1.0);\n\n            float ndl = dot(normal, lightDirection);\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowContrib = 1.0;\n            #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n                if (shadowEnabled)\n                {\n                    shadowContrib = shadowContribs[i];\n                }\n            #endif\n\n            vec3 li = lightColor * ndl * attenuation * (1.0-falloff) * shadowContrib;\n\n            diffuseTerm += li;\n            if (shininess > 0.0)\n            {\n                specularTerm += li * pow(ndh, shininess);\n            }\n        }\n    #endif\n\n    finalColor.rgb *= diffuseTerm;\n    finalColor.rgb += specularTerm * specularColor;\n    finalColor.rgb += emission;\n\n    #ifdef ENVIRONMENTMAP_ENABLED\n        vec3 envTex = textureCube(environmentMap, reflect(-viewDirection, normal)).xyz;\n        finalColor.rgb = finalColor.rgb + envTex * reflectivity;\n    #endif\n\n    if(lineWidth > 0.01)\n    {\n        finalColor.rgb = finalColor.rgb * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n\n    #ifdef GAMMA_ENCODE\n        finalColor.rgb = pow(finalColor.rgb, vec3(1 / 2.2));\n    #endif\n\n    gl_FragColor = finalColor;\n}\n\n@end';});

define('qtek/shader/source/physical.essl',[],function () { return '\n// http://blog.selfshadow.com/publications/s2013-shading-course/\n\n@export buildin.physical.vertex\n\n@import buildin.phong.vertex\n\n@end\n\n\n@export buildin.physical.fragment\n\n#define PI 3.14159265358979\n\nuniform mat4 viewInverse : VIEWINVERSE;\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\n#ifdef NORMALMAP_ENABLED\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\n#endif\n\nuniform sampler2D diffuseMap;\nuniform sampler2D normalMap;\nuniform samplerCube environmentMap;\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\nuniform float glossiness : 0.5;\n\nuniform vec3 specularColor : [0.1, 0.1, 0.1];\nuniform vec3 emission : [0.0, 0.0, 0.0];\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#ifdef AMBIENT_LIGHT_NUMBER\n@import buildin.header.ambient_light\n#endif\n#ifdef POINT_LIGHT_NUMBER\n@import buildin.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_NUMBER\n@import buildin.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_NUMBER\n@import buildin.header.spot_light\n#endif\n\n#extension GL_OES_standard_derivatives : enable\n\n// Import util functions and uniforms needed\n@import buildin.util.calculate_attenuation\n\n@import buildin.util.edge_factor\n\n@import buildin.plugin.compute_shadow_map\n\n\nfloat G_Smith(float glossiness, float ndv, float ndl)\n{\n    // float k = (roughness+1.0) * (roughness+1.0) * 0.125;\n    float roughness = 1.0 - glossiness;\n    float k = roughness * roughness / 2.0;\n    float G1V = ndv / (ndv * (1.0 - k) + k);\n    float G1L = ndl / (ndl * (1.0 - k) + k);\n    return G1L * G1V;\n}\n\nvec3 F_Schlick(float ldn) {\n    return specularColor + (1.0 - specularColor) * pow(1.0 - ldn, 5.0);\n}\n\nfloat D_Phong(float g, float ndh) {\n    // from black ops 2\n    float a = pow(8192.0, g);\n    return (a + 2.0) / 8.0 * pow(ndh, a);\n}\n\nfloat D_GGX(float g, float ndh) {\n    float r = 1.0 - g;\n    float a = r * r;\n    float tmp = ndh * ndh * (a - 1.0) + 1.0;\n    return a / (PI * tmp * tmp);\n}\n\nvoid main()\n{\n    #ifdef RENDER_TEXCOORD\n        gl_FragColor = vec4(v_Texcoord, 1.0, 1.0);\n        return;\n    #endif\n\n    vec4 finalColor = vec4(color, alpha);\n\n    vec3 eyePos = viewInverse[3].xyz;\n    vec3 V = normalize(eyePos - v_WorldPosition);\n    float g = glossiness;\n\n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D(diffuseMap, v_Texcoord);\n        #ifdef SRGB_DECODE\n            tex.rgb = pow(tex.rgb, vec3(2.2));\n        #endif\n        finalColor.rgb *= tex.rgb;\n        #ifdef DIFFUSEMAP_ALPHA_ALPHA\n            finalColor.a *= tex.a;\n        #endif\n        #ifdef DIFFUSEMAP_ALPHA_GLOSS\n            g *= tex.a;\n        #endif\n    #endif\n\n    vec3 N = v_Normal;\n    #ifdef NORMALMAP_ENABLED\n        N = texture2D(normalMap, v_Texcoord).xyz * 2.0 - 1.0;\n        mat3 tbn = mat3(v_Tangent, v_Bitangent, v_Normal);\n        N = normalize(tbn * N);\n    #endif\n\n    #ifdef RENDER_NORMAL\n        gl_FragColor = vec4(N, 1.0);\n        return;\n    #endif\n\n    #ifdef RENDER_GLOSSINESS\n        gl_FragColor = vec4(vec3(g), 1.0);\n        return;\n    #endif\n\n    float ndv = dot(N, V);\n\n    // Diffuse part of all lights\n    vec3 diffuseTerm = vec3(0.0, 0.0, 0.0);\n    // Specular part of all lights\n    vec3 specularTerm = vec3(0.0, 0.0, 0.0);\n    \n    #ifdef AMBIENT_LIGHT_NUMBER\n        for(int i = 0; i < AMBIENT_LIGHT_NUMBER; i++)\n        {\n            // Hemisphere ambient lighting from cryengine\n            diffuseTerm += ambientLightColor[i] * (clamp(N.y * 0.7, 0.0, 1.0) + 0.3);\n            // diffuseTerm += ambientLightColor[i];\n        }\n    #endif\n    #ifdef POINT_LIGHT_NUMBER\n        #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowContribs[POINT_LIGHT_NUMBER];\n            if(shadowEnabled)\n            {\n                computeShadowOfPointLights(v_WorldPosition, shadowContribs);\n            }\n        #endif\n        for(int i = 0; i < POINT_LIGHT_NUMBER; i++)\n        {\n\n            vec3 lightPosition = pointLightPosition[i];\n            vec3 lc = pointLightColor[i];\n            float range = pointLightRange[i];\n\n            vec3 L = lightPosition - v_WorldPosition;\n\n            // Calculate point light attenuation\n            float dist = length(L);\n            float attenuation = lightAttenuation(dist, range); \n            L /= dist;\n            vec3 H = normalize(L + V);\n            float ndl = clamp(dot(N, L), 0.0, 1.0);\n            float ndh = clamp(dot(N, H), 0.0, 1.0);\n            float ldn = clamp(dot(L, N), 0.0, 1.0);\n\n            float shadowContrib = 1.0;\n            #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n                if(shadowEnabled)\n                {\n                    shadowContrib = shadowContribs[i];\n                }\n            #endif\n\n            vec3 li = lc * ndl * attenuation * shadowContrib;\n            diffuseTerm += li;\n            specularTerm += li * F_Schlick(ldn) * D_Phong(g, ndh);\n        }\n    #endif\n\n    #ifdef DIRECTIONAL_LIGHT_NUMBER\n        #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n            float shadowContribs[DIRECTIONAL_LIGHT_NUMBER];\n            if(shadowEnabled)\n            {\n                computeShadowOfDirectionalLights(v_WorldPosition, shadowContribs);\n            }\n        #endif\n        for(int i = 0; i < DIRECTIONAL_LIGHT_NUMBER; i++)\n        {\n\n            vec3 L = -normalize(directionalLightDirection[i]);\n            vec3 lc = directionalLightColor[i];\n\n            vec3 H = normalize(L + V);\n            float ndl = clamp(dot(N, L), 0.0, 1.0);\n            float ndh = clamp(dot(N, H), 0.0, 1.0);\n            float ldn = clamp(dot(L, N), 0.0, 1.0);\n\n            float shadowContrib = 1.0;\n            #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n                if(shadowEnabled)\n                {\n                    shadowContrib = shadowContribs[i];\n                }\n            #endif\n\n            vec3 li = lc * ndl * shadowContrib;\n\n            diffuseTerm += li;\n            specularTerm += li * F_Schlick(ldn) * D_Phong(g, ndh);\n        }\n    #endif\n\n    #ifdef SPOT_LIGHT_NUMBER\n        #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowContribs[SPOT_LIGHT_NUMBER];\n            if(shadowEnabled)\n            {\n                computeShadowOfSpotLights(v_WorldPosition, shadowContribs);\n            }\n        #endif\n        for(int i = 0; i < SPOT_LIGHT_NUMBER; i++)\n        {\n            vec3 lightPosition = spotLightPosition[i];\n            vec3 spotLightDirection = -normalize(spotLightDirection[i]);\n            vec3 lc = spotLightColor[i];\n            float range = spotLightRange[i];\n            float a = spotLightUmbraAngleCosine[i];\n            float b = spotLightPenumbraAngleCosine[i];\n            float falloffFactor = spotLightFalloffFactor[i];\n\n            vec3 L = lightPosition - v_WorldPosition;\n            // Calculate attenuation\n            float dist = length(L);\n            float attenuation = lightAttenuation(dist, range); \n\n            // Normalize light direction\n            L /= dist;\n            // Calculate spot light fall off\n            float c = dot(spotLightDirection, L);\n\n            float falloff;\n            // Fomular from real-time-rendering\n            falloff = clamp((c - a) /( b - a), 0.0, 1.0);\n            falloff = pow(falloff, falloffFactor);\n\n            vec3 H = normalize(L + V);\n            float ndl = clamp(dot(N, L), 0.0, 1.0);\n            float ndh = clamp(dot(N, H), 0.0, 1.0);\n            float ldn = clamp(dot(L, N), 0.0, 1.0);\n\n            float shadowContrib = 1.0;\n            #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n                if (shadowEnabled)\n                {\n                    shadowContrib = shadowContribs[i];\n                }\n            #endif\n\n            vec3 li = lc * attenuation * (1.0-falloff) * shadowContrib * ndl;\n\n            diffuseTerm += li;\n            specularTerm += li * F_Schlick(ldn) * D_Phong(g, ndh);\n        }\n    #endif\n\n    finalColor.rgb *= diffuseTerm;\n    finalColor.rgb += specularTerm;\n    finalColor.rgb += emission;\n\n    #ifdef ENVIRONMENTMAP_ENABLED\n        vec3 envTex = textureCube(environmentMap, reflect(-V, N)).xyz;\n        finalColor.rgb = finalColor.rgb + envTex * g;\n    #endif\n\n    if(lineWidth > 0.)\n    {\n        finalColor.rgb = finalColor.rgb * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n\n    #ifdef GAMMA_ENCODE\n        finalColor.rgb = pow(finalColor.rgb, vec3(1 / 2.2));\n    #endif\n    gl_FragColor = finalColor;\n}\n\n@end';});

define('qtek/shader/source/wireframe.essl',[],function () { return '@export buildin.wireframe.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 world : WORLD;\n\nattribute vec3 position : POSITION;\nattribute vec3 barycentric;\n\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\nuniform mat4 skinMatrix[JOINT_NUMBER] : SKIN_MATRIX;\n#endif\n\nvarying vec3 v_Barycentric;\n\nvoid main()\n{\n\n    vec3 skinnedPosition = position;\n    #ifdef SKINNING\n\n        @import buildin.chunk.skin_matrix\n\n        skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n    #endif\n\n    gl_Position = worldViewProjection * vec4(skinnedPosition, 1.0 );\n\n    v_Barycentric = barycentric;\n}\n\n@end\n\n\n@export buildin.wireframe.fragment\n\nuniform vec3 color : [0.0, 0.0, 0.0];\n\nuniform float alpha : 1.0;\nuniform float lineWidth : 1.0;\n\nvarying vec3 v_Barycentric;\n\n#extension GL_OES_standard_derivatives : enable\n\n@import buildin.util.edge_factor\n\nvoid main()\n{\n\n    gl_FragColor.rgb = color;\n    gl_FragColor.a = ( 1.0-edgeFactor(lineWidth) ) * alpha;\n}\n\n@end';});

define('qtek/shader/source/skybox.essl',[],function () { return '@export buildin.skybox.vertex\n\nuniform mat4 world : WORLD;\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\n\nvarying vec3 v_WorldPosition;\n\nvoid main()\n{\n    v_WorldPosition = (world * vec4(position, 1.0)).xyz;\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n}\n\n@end\n\n@export buildin.skybox.fragment\n\nuniform mat4 viewInverse : VIEWINVERSE;\nuniform samplerCube environmentMap;\n\nvarying vec3 v_WorldPosition;\n\nvoid main()\n{\n    vec3 eyePos = viewInverse[3].xyz;\n    vec3 viewDirection = normalize(v_WorldPosition - eyePos);\n\n    vec3 tex = textureCube(environmentMap, viewDirection).xyz;\n\n    #ifdef SRGB_DECODE\n        tex.rgb = pow(tex.rgb, vec3(2.2));\n    #endif\n    \n    gl_FragColor = vec4(tex, 1.0);\n}\n@end';});

define('qtek/shader/source/util.essl',[],function () { return '// Use light attenuation formula in\n// http://blog.slindev.com/2011/01/10/natural-light-attenuation/\n@export buildin.util.calculate_attenuation\n\nuniform float attenuationFactor : 5.0;\n\nfloat lightAttenuation(float dist, float range)\n{\n    float attenuation = 1.0;\n    if( range > 0.0)\n    {\n        attenuation = dist*dist/(range*range);\n        float att_s = attenuationFactor;\n        attenuation = 1.0/(attenuation*att_s+1.0);\n        att_s = 1.0/(att_s+1.0);\n        attenuation = attenuation - att_s;\n        attenuation /= 1.0 - att_s;\n    }\n    return attenuation;\n}\n\n@end\n\n//http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/\n@export buildin.util.edge_factor\n\nfloat edgeFactor(float width)\n{\n    vec3 d = fwidth(v_Barycentric);\n    vec3 a3 = smoothstep(vec3(0.0), d * width, v_Barycentric);\n    return min(min(a3.x, a3.y), a3.z);\n}\n\n@end\n\n// Pack depth\n// Float value can only be [0.0 - 1.0) ?\n@export buildin.util.encode_float\nvec4 encodeFloat( const in float depth )\n{\n\n    const vec4 bitShifts = vec4( 256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0 );\n\n    const vec4 bit_mask  = vec4( 0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0 );\n    vec4 res = fract( depth * bitShifts );\n    res -= res.xxyz * bit_mask;\n\n    return res;\n}\n@end\n\n@export buildin.util.decode_float\nfloat decodeFloat(const in vec4 colour)\n{\n    const vec4 bitShifts = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );\n    return dot(colour, bitShifts);\n}\n@end\n\n// http://graphicrants.blogspot.com/2009/04/rgbm-color-encoding.html\n@export buildin.util.rgbm_decode\nvec3 RGBMDecode(vec4 rgbm, float range) {\n  return range * rgbm.rgb * rgbm.a;\n}\n@end\n\n@export buildin.util.rgbm_encode\nvec4 RGBMEncode(vec3 color, float range) {\n    vec4 rgbm;\n    color *= 1.0 / range;\n    rgbm.a = clamp(max(max(color.r, color.g), max(color.b, 1e-6 ) ), 0.0, 1.0);\n    rgbm.a = ceil(rgbm.a * 255.0) / 255.0;\n    rgbm.rgb = color / rgbm.a;\n    return rgbm;\n}\n@end\n\n\n@export buildin.chunk.skin_matrix\n\n// Weighted Sum Skinning Matrix\nmat4 skinMatrixWS;\nif (joint.x >= 0.0)\n{\n    skinMatrixWS = skinMatrix[int(joint.x)] * weight.x;\n}\nif (joint.y >= 0.0)\n{\n    skinMatrixWS += skinMatrix[int(joint.y)] * weight.y;\n}\nif (joint.z >= 0.0)\n{\n    skinMatrixWS += skinMatrix[int(joint.z)] * weight.z;\n}\nif (joint.w >= 0.0)\n{\n    skinMatrixWS += skinMatrix[int(joint.w)] * (1.0-weight.x-weight.y-weight.z);\n}\n@end\n';});

define('qtek/shader/source/prez.essl',[],function () { return '// Shader for prez pass\n@export buildin.prez.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\n\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\nuniform mat4 skinMatrix[JOINT_NUMBER] : SKIN_MATRIX;\n#endif\n\nvoid main()\n{\n\n    vec3 skinnedPosition = position;\n\n    #ifdef SKINNING\n        \n        @import buildin.chunk.skin_matrix\n        \n        skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n    #endif\n    \n    gl_Position = worldViewProjection * vec4(skinnedPosition, 1.0);\n}\n\n@end\n\n\n@export buildin.prez.fragment\n\nvoid main()\n{\n    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n}\n\n@end';});

/**
 * @export{object} library
 */
define('qtek/shader/library',['require','../Shader','./source/basic.essl','./source/lambert.essl','./source/phong.essl','./source/physical.essl','./source/wireframe.essl','./source/skybox.essl','./source/util.essl','./source/prez.essl'],function(require) {

    var Shader = require("../Shader");

    _library = {};

    _pool = {};

    // Example
    // ShaderLibrary.get("buildin.phong", "diffuseMap", "normalMap");
    // Or
    // ShaderLibrary.get("buildin.phong", ["diffuseMap", "normalMap"]);
    // Or
    // ShaderLibrary.get("buildin.phong", {
    //      textures : ["diffuseMap"],
    //      vertexDefines : {},
    //      fragmentDefines : {}
    // })
    function get(name, config) {
        var enabledTextures = [];
        var vertexDefines = {};
        var fragmentDefines = {};
        if (typeof(config) === "string") {
            enabledTextures = Array.prototype.slice.call(arguments, 1);
        }
        else if (toString.call(config) == '[object Object]') {
            enabledTextures = config.textures || [];
            vertexDefines = config.vertexDefines || {};
            fragmentDefines = config.fragmentDefines || {};
        } 
        else if(config instanceof Array) {
            enabledTextures = config;
        }
        var vertexDefineKeys = Object.keys(vertexDefines);
        var fragmentDefineKeys = Object.keys(fragmentDefines);
        enabledTextures.sort(); 
        vertexDefineKeys.sort();
        fragmentDefineKeys.sort();

        var keyArr = [name];
        keyArr = keyArr.concat(enabledTextures);
        for (var i = 0; i < vertexDefineKeys.length; i++) {
            keyArr.push(vertexDefines[vertexDefineKeys[i]]);
        }
        for (var i = 0; i < fragmentDefineKeys.length; i++) {
            keyArr.push(fragmentDefines[fragmentDefineKeys[i]]);
        }
        var key = keyArr.join('_');

        if (_pool[key]) {
            return _pool[key];
        } else {
            var source = _library[name];
            if (!source) {
                console.error('Shader "'+name+'"'+' is not in the library');
                return;
            }
            var shader = new Shader({
                "vertex" : source.vertex,
                "fragment" : source.fragment
            });
            for (var i = 0; i < enabledTextures.length; i++) {
                shader.enableTexture(enabledTextures[i]);
            }
            for (var name in vertexDefines) {
                shader.define('vertex', name, vertexDefines[name]);
            }
            for (var name in fragmentDefines) {
                shader.define('fragment', name, fragmentDefines[name]);
            }
            _pool[key] = shader;
            return shader;
        }
    }

    function put(name, vertex, fragment) {
        _library[name] = {
            vertex : vertex,
            fragment : fragment
        }
    }

    // Some build in shaders
    Shader.import(require('./source/basic.essl'));
    Shader.import(require('./source/lambert.essl'));
    Shader.import(require('./source/phong.essl'));
    Shader.import(require('./source/physical.essl'));
    Shader.import(require('./source/wireframe.essl'));
    Shader.import(require('./source/skybox.essl'));
    Shader.import(require('./source/util.essl'));
    Shader.import(require('./source/prez.essl'));

    put("buildin.basic", Shader.source("buildin.basic.vertex"), Shader.source("buildin.basic.fragment"));
    put("buildin.lambert", Shader.source("buildin.lambert.vertex"), Shader.source("buildin.lambert.fragment"));
    put("buildin.phong", Shader.source("buildin.phong.vertex"), Shader.source("buildin.phong.fragment"));
    put("buildin.wireframe", Shader.source("buildin.wireframe.vertex"), Shader.source("buildin.wireframe.fragment"));
    put("buildin.skybox", Shader.source("buildin.skybox.vertex"), Shader.source("buildin.skybox.fragment"));
    put("buildin.prez", Shader.source("buildin.prez.vertex"), Shader.source("buildin.prez.fragment"));
    put("buildin.physical", Shader.source("buildin.physical.vertex"), Shader.source("buildin.physical.fragment"));

    return {
        get : get,
        put : put
    }
});
define('qtek/Renderer',['require','./core/Base','./core/util','./Light','./Mesh','./Texture','./core/glinfo','./core/glenum','./math/BoundingBox','./math/Matrix4','./Shader','./shader/library','./Material','./math/Vector3','./math/Vector2','glmatrix'],function(require) {

    var Base = require("./core/Base");
    var util = require("./core/util");
    var Light = require("./Light");
    var Mesh = require("./Mesh");
    var Texture = require("./Texture");
    var glinfo = require('./core/glinfo');
    var glenum = require('./core/glenum');
    var BoundingBox = require('./math/BoundingBox');
    var Matrix4 = require('./math/Matrix4');
    var Shader = require('./Shader');
    var shaderLibrary = require('./shader/library');
    var Material = require('./Material');
    var Vector3 = require('./math/Vector3');
    var Vector2 = require('./math/Vector2');

    var glMatrix = require("glmatrix");
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var vec4 = glMatrix.vec4;

    var glid = 0;

    var preZPassShader = shaderLibrary.get('buildin.prez');
    var preZPassMaterial = new Material({
        shader : preZPassShader
    });

    var Renderer = Base.derive(function() {
        return {

            canvas : null,
            width : 100,
            height : 100,
            // Device Pixel Ratio is for high defination disply
            // like retina display
            // http://www.khronos.org/webgl/wiki/HandlingHighDPI
            devicePixelRatio : window.devicePixelRatio || 1.0,

            color : [0.0, 0.0, 0.0, 0.0],
            
            // _gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT | _gl.STENCIL_BUFFER_BIT
            clear : 17664,  

            // Settings when getting context
            // http://www.khronos.org/registry/webgl/specs/latest/#2.4
            alhpa : true,
            depth : true,
            stencil : false,
            antialias : true,
            premultipliedAlpha : true,
            preserveDrawingBuffer : false,

            gl : null,

            viewport : {},

            _viewportSettings : [],
            _clearSettings : [],

            _sceneRendering : null
        }
    }, function() {

        if (! this.canvas) {
            this.canvas = document.createElement("canvas");
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
        try {
            this.gl = this.canvas.getContext('experimental-webgl', {
                alhpa : this.alhpa,
                depth : this.depth,
                stencil : this.stencil,
                antialias : this.antialias,
                premultipliedAlpha : this.premultipliedAlpha,
                preserveDrawingBuffer : this.preserveDrawingBuffer,
            });
            this.gl.__GLID__ = glid++;

            this.width = this.canvas.width; 
            this.height = this.canvas.height;
            this.resize(this.width, this.height);

            glinfo.initialize(this.gl);
        }
        catch(e) {
            throw "Error creating WebGL Context";
        }
    }, {

        resize : function(width, height) {
            var canvas = this.canvas;
            // http://www.khronos.org/webgl/wiki/HandlingHighDPI
            // set the display size of the canvas.
            // if (this.devicePixelRatio !== 1.0) {
                canvas.style.width = width + "px";
                canvas.style.height = height + "px";
            // }
             
            // set the size of the drawingBuffer
            canvas.width = width * this.devicePixelRatio;
            canvas.height = height * this.devicePixelRatio;

            this.width = width;
            this.height = height;

            this.setViewport(0, 0, canvas.width, canvas.height);
        },

        setDevicePixelRatio : function(devicePixelRatio) {
            this.devicePixelRatio = devicePixelRatio;
            this.resize(this.width, this.height);
        },

        setViewport : function(x, y, width, height) {

            if (typeof(x) === "object") {
                var obj = x;
                x = obj.x;
                y = obj.y;
                width = obj.width;
                height = obj.height;
            }
            this.gl.viewport(x, y, width, height);

            this.viewport = {
                x : x,
                y : y,
                width : width,
                height : height
            }
        },

        saveViewport : function() {
            this._viewportSettings.push(this.viewport);
        },

        restoreViewport : function() {
            if (this._viewportSettings.length > 0) {
                this.setViewport(this._viewportSettings.pop());
            }
        },

        saveClear : function() {
            this._clearSettings.push(this.clear);
        },

        restoreClear : function() {
            if (this._clearSettings.length > 0) {
                this.clear = this._clearSettings.pop();   
            }
        },

        render : function(scene, camera, notUpdateScene, preZ) {
            var _gl = this.gl;

            this._sceneRendering = scene;

            var color = this.color;
            _gl.clearColor(color[0], color[1], color[2], color[3]);
            _gl.clear(this.clear);

            // If the scene have been updated in the prepass like shadow map
            // There is no need to update it again
            if (!notUpdateScene) {
                scene.update(false);
            }
            if (!camera.scene) {
                camera.update(true);
            }

            var opaqueQueue = scene.opaqueQueue;
            var transparentQueue = scene.transparentQueue;
            var sceneMaterial = scene.material;

            scene.trigger('beforerender', this, scene, camera);
            // Sort render queue
            // Calculate the object depth
            if (transparentQueue.length > 0) {
                var worldViewMat = mat4.create();
                var posViewSpace = vec3.create();
                for (var i = 0; i < transparentQueue.length; i++) {
                    var node = transparentQueue[i];
                    mat4.multiply(worldViewMat, camera.viewMatrix._array, node.worldTransform._array);
                    vec3.transformMat4(posViewSpace, node.position._array, worldViewMat);
                    node.__depth = posViewSpace[2];
                }
            }
            opaqueQueue.sort(Renderer.opaqueSortFunc);
            transparentQueue.sort(Renderer.transparentSortFunc);

            // Render Opaque queue
            scene.trigger("beforerender:opaque", this, opaqueQueue);

            // Reset the scene bounding box;
            camera.sceneBoundingBoxLastFrame.min.set(Infinity, Infinity, Infinity);
            camera.sceneBoundingBoxLastFrame.max.set(-Infinity, -Infinity, -Infinity);

            _gl.disable(_gl.BLEND);
            _gl.enable(_gl.DEPTH_TEST);
            var opaqueRenderInfo = this.renderQueue(opaqueQueue, camera, sceneMaterial, preZ);

            scene.trigger("afterrender:opaque", this, opaqueQueue, opaqueRenderInfo);
            scene.trigger("beforerender:transparent", this, transparentQueue);

            // Render Transparent Queue
            _gl.enable(_gl.BLEND);
            var transparentRenderInfo = this.renderQueue(transparentQueue, camera, sceneMaterial);

            scene.trigger("afterrender:transparent", this, transparentQueue, transparentRenderInfo);
            var renderInfo = {}
            for (name in opaqueRenderInfo) {
                renderInfo[name] = opaqueRenderInfo[name] + transparentRenderInfo[name];
            }

            scene.trigger('afterrender', this, scene, camera, renderInfo);
            return renderInfo;
        },

        renderQueue : function(queue, camera, globalMaterial, preZ) {
            var renderInfo = {
                faceNumber : 0,
                vertexNumber : 0,
                drawCallNumber : 0,
                meshNumber : 0
            };

            // Calculate view and projection matrix
            mat4.copy(matrices.VIEW, camera.viewMatrix._array);
            mat4.copy(matrices.PROJECTION, camera.projectionMatrix._array);
            mat4.multiply(matrices.VIEWPROJECTION, camera.projectionMatrix._array, matrices.VIEW);
            mat4.copy(matrices.VIEWINVERSE, camera.worldTransform._array);
            mat4.invert(matrices.PROJECTIONINVERSE, matrices.PROJECTION);
            mat4.invert(matrices.VIEWPROJECTIONINVERSE, matrices.VIEWPROJECTION);

            var _gl = this.gl;
            var scene = this._sceneRendering;
            
            var prevMaterialID;
            var prevShaderID;
                
            // Status 
            var depthTest, depthMask;
            var culling, cullFace, frontFace;

            var culledRenderQueue;
            if (preZ) {
                culledRenderQueue = [];
                preZPassShader.bind(_gl);
                _gl.colorMask(false, false, false, false);
                _gl.depthMask(true);
                for (var i = 0; i < queue.length; i++) {
                    var renderable = queue[i];
                    var worldM = renderable.worldTransform._array;
                    var geometry = renderable.geometry;
                    mat4.multiply(matrices.WORLDVIEW, matrices.VIEW , worldM);
                    mat4.multiply(matrices.WORLDVIEWPROJECTION, matrices.VIEWPROJECTION , worldM);

                    if (geometry.boundingBox) {
                        if (!this._frustumCulling(renderable, camera)) {
                            continue;
                        }
                    }
                    if (renderable.skeleton) {  // Skip skinned mesh
                        continue;
                    }
                    if (renderable.cullFace !== cullFace) {
                        cullFace = renderable.cullFace;
                        _gl.cullFace(cullFace);
                    }
                    if (renderable.frontFace !== frontFace) {
                        frontFace = renderable.frontFace;
                        _gl.frontFace(frontFace);
                    }
                    if (renderable.culling !== culling) {
                        culling = renderable.culling;
                        culling ? _gl.enable(_gl.CULL_FACE) : _gl.disable(_gl.CULL_FACE)
                    }

                    var semanticInfo = preZPassShader.matrixSemantics.WORLDVIEWPROJECTION;
                    preZPassShader.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, matrices.WORLDVIEWPROJECTION);
                    renderable.render(_gl, preZPassMaterial);
                    culledRenderQueue.push(renderable);
                }
                _gl.depthFunc(_gl.LEQUAL);
                _gl.colorMask(true, true, true, true);
                _gl.depthMask(false);
            } else {
                culledRenderQueue = queue;
            }

            for (var i =0; i < culledRenderQueue.length; i++) {
                var renderable = culledRenderQueue[i];
                var material = globalMaterial || renderable.material;
                var shader = material.shader;
                var geometry = renderable.geometry;

                var worldM = renderable.worldTransform._array;
                // All matrices ralated to world matrix will be updated on demand;
                mat4.copy(matrices.WORLD, worldM);
                mat4.multiply(matrices.WORLDVIEW, matrices.VIEW , worldM);
                mat4.multiply(matrices.WORLDVIEWPROJECTION, matrices.VIEWPROJECTION , worldM);
                if (shader.matrixSemantics.WORLDINVERSE ||
                    shader.matrixSemantics.WORLDINVERSETRANSPOSE) {
                    mat4.invert(matrices.WORLDINVERSE, worldM);
                }
                if (shader.matrixSemantics.WORLDVIEWINVERSE ||
                    shader.matrixSemantics.WORLDVIEWINVERSETRANSPOSE) {
                    mat4.invert(matrices.WORLDVIEWINVERSE, matrices.WORLDVIEW);
                }
                if (shader.matrixSemantics.WORLDVIEWPROJECTIONINVERSE ||
                    shader.matrixSemantics.WORLDVIEWPROJECTIONINVERSETRANSPOSE) {
                    mat4.invert(matrices.WORLDVIEWPROJECTIONINVERSE, matrices.WORLDVIEWPROJECTION);
                }
                if (geometry.boundingBox && ! preZ) {
                    if (!this._frustumCulling(renderable, camera)) {
                        continue;
                    }
                }

                if (prevShaderID !== shader.__GUID__) {
                    // Set lights number
                    if (scene && scene.isShaderLightNumberChanged(shader)) {
                        scene.setShaderLightNumber(shader);
                    }

                    shader.bind(_gl);

                    // Set lights uniforms
                    // TODO needs optimized
                    if (scene) {
                        for (var symbol in scene.lightUniforms) {
                            var lu = scene.lightUniforms[symbol];
                            shader.setUniform(_gl, lu.type, symbol, lu.value);
                        }
                    }
                    prevShaderID = shader.__GUID__;
                }
                if (prevMaterialID !== material.__GUID__) {
                    if (!preZ) {
                        if (material.depthTest !== depthTest) {
                            material.depthTest ? 
                                _gl.enable(_gl.DEPTH_TEST) : 
                                _gl.disable(_gl.DEPTH_TEST);
                            depthTest = material.depthTest;
                        }
                        if (material.depthMask !== depthMask) {
                            _gl.depthMask(material.depthMask);
                            depthMask = material.depthMask;
                        }
                    }
                    material.bind(_gl);
                    prevMaterialID = material.__GUID__;

                    if (material.transparent) {
                        if (material.blend) {
                            material.blend(_gl);
                        } else {    // Default blend function
                            _gl.blendEquationSeparate(_gl.FUNC_ADD, _gl.FUNC_ADD);
                            _gl.blendFuncSeparate(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA, _gl.ONE, _gl.ONE_MINUS_SRC_ALPHA);
                        } 
                    }
                }

                var matrixSemanticKeys = shader.matrixSemanticKeys;
                for (var k = 0; k < matrixSemanticKeys.length; k++) {
                    var semantic = matrixSemanticKeys[k];
                    var semanticInfo = shader.matrixSemantics[semantic];
                    var matrix = matrices[semantic];
                    if (semanticInfo.isTranspose) {
                        var matrixNoTranspose = matrices[semanticInfo.semanticNoTranspose];
                        mat4.transpose(matrix, matrixNoTranspose);
                    }
                    shader.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, matrix);
                }

                if (renderable.cullFace !== cullFace) {
                    cullFace = renderable.cullFace;
                    _gl.cullFace(cullFace);
                }
                if (renderable.frontFace !== frontFace) {
                    frontFace = renderable.frontFace;
                    _gl.frontFace(frontFace);
                }
                if (renderable.culling !== culling) {
                    culling = renderable.culling;
                    culling ? _gl.enable(_gl.CULL_FACE) : _gl.disable(_gl.CULL_FACE)
                }

                var objectRenderInfo = renderable.render(_gl, globalMaterial);

                if (objectRenderInfo) {
                    renderInfo.faceNumber += objectRenderInfo.faceNumber;
                    renderInfo.vertexNumber += objectRenderInfo.vertexNumber;
                    renderInfo.drawCallNumber += objectRenderInfo.drawCallNumber;
                    renderInfo.meshNumber ++;
                }
            }

            return renderInfo;
        },

        _frustumCulling : (function() {
            // Frustum culling
            // http://www.cse.chalmers.se/~uffe/vfc_bbox.pdf
            var cullingBoundingBox = new BoundingBox();
            var cullingMatrix = new Matrix4();
            return function(renderable, camera) {
                var geoBBox = renderable.geometry.boundingBox;
                cullingMatrix._array = matrices.WORLDVIEW;
                cullingBoundingBox.copy(geoBBox);
                cullingBoundingBox.applyTransform(cullingMatrix);

                // Passingly update the scene bounding box
                // TODO : exclude very large mesh like ground plane or terrain ?
                camera.sceneBoundingBoxLastFrame.union(cullingBoundingBox);

                if (renderable.frustumCulling)  {
                    if (!cullingBoundingBox.intersectBoundingBox(camera.frustum.boundingBox)) {
                        return false;
                    }

                    cullingMatrix._array = matrices.PROJECTION;
                    if (
                        cullingBoundingBox.max._array[2] > 0 &&
                        cullingBoundingBox.min._array[2] < 0
                    ) {
                        // Clip in the near plane
                        cullingBoundingBox.max._array[2] = -1e-20;
                    }
                    
                    cullingBoundingBox.applyProjection(cullingMatrix);

                    var min = cullingBoundingBox.min._array;
                    var max = cullingBoundingBox.max._array;
                    
                    if (
                        max[0] < -1 || min[0] > 1
                        || max[1] < -1 || min[1] > 1
                        || max[2] < -1 || min[2] > 1
                    ) {
                        return false;
                    }   
                }
                return true;
            }
        })(),

        disposeScene : function(scene) {
            this.disposeNode(scene);
            scene.dispose();
        },

        disposeNode : function(root) {
            var materials = {};
            var _gl = this.gl;

            root.traverse(function(node) {
                if (node.geometry) {
                    node.geometry.dispose(_gl);
                }
                if (node.material) {
                    materials[node.material.__GUID__] = node.material;
                }
            });
            for (var guid in materials) {
                var mat = materials[guid];
                mat.shader.dispose(_gl);
                for (var name in mat.uniforms) {
                    var val = mat.uniforms[name].value;
                    if (!val ) {
                        continue;
                    }
                    if (val instanceof Texture) {
                        val.dispose(_gl);
                    }
                    else if (val instanceof Array) {
                        for (var i = 0; i < val.length; i++) {
                            if (val[i] instanceof Texture) {
                                val[i].dispose(_gl);
                            }
                        }
                    }
                }
            }
            root._children = [];
        },

        disposeShader : function(shader) {
            shader.dispose(this.gl);
        },

        disposeGeometry : function(geometry) {
            geometry.dispose(this.gl);
        },

        disposeTexture : function(texture) {
            texture.dispose(this.gl);
        },

        disposeFrameBuffer : function(frameBuffer) {
            frameBuffer.dispose(this.gl);
        },

        screenToNdc : function(x, y, out) {
            if (!out) {
                out = new Vector2();
            }
            // Invert y;
            y = this.height - y;

            out._array[0] = (x - this.viewport.x) / this.viewport.width;
            out._array[0] = out._array[0] * 2 - 1;
            out._array[1] = (y - this.viewport.y) / this.viewport.height;
            out._array[1] = out._array[1] * 2 - 1;

            return out;
        }
    })

    Renderer.opaqueSortFunc = function(x, y) {
        // Priority shader -> material -> geometry
        if (x.material.shader === y.material.shader) {
            if (x.material === y.material) {
                return x.geometry.__GUID__ - y.geometry.__GUID__;
            }
            return x.material.__GUID__ - y.material.__GUID__;
        }
        return x.material.shader.__GUID__ - y.material.shader.__GUID__;
    }
    Renderer.transparentSortFunc = function(x, y) {
        // Priority depth -> shader -> material -> geometry
        if (x.__depth === y.__depth) {
            if (x.material.shader === y.material.shader) {
                if (x.material === y.material) {
                    return x.geometry.__GUID__ - y.geometry.__GUID__;
                }
                return x.material.__GUID__ - y.material.__GUID__;
            }
            return x.material.shader.__GUID__ - y.material.shader.__GUID__;
        }
        // Depth is negative because of right hand coord
        // So farther object has smaller depth value
        return x.__depth - y.__depth
    }

    // Temporary variables
    var matrices = {
        'WORLD' : mat4.create(),
        'VIEW' : mat4.create(),
        'PROJECTION' : mat4.create(),
        'WORLDVIEW' : mat4.create(),
        'VIEWPROJECTION' : mat4.create(),
        'WORLDVIEWPROJECTION' : mat4.create(),

        'WORLDINVERSE' : mat4.create(),
        'VIEWINVERSE' : mat4.create(),
        'PROJECTIONINVERSE' : mat4.create(),
        'WORLDVIEWINVERSE' : mat4.create(),
        'VIEWPROJECTIONINVERSE' : mat4.create(),
        'WORLDVIEWPROJECTIONINVERSE' : mat4.create(),

        'WORLDTRANSPOSE' : mat4.create(),
        'VIEWTRANSPOSE' : mat4.create(),
        'PROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDVIEWTRANSPOSE' : mat4.create(),
        'VIEWPROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDVIEWPROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDINVERSETRANSPOSE' : mat4.create(),
        'VIEWINVERSETRANSPOSE' : mat4.create(),
        'PROJECTIONINVERSETRANSPOSE' : mat4.create(),
        'WORLDVIEWINVERSETRANSPOSE' : mat4.create(),
        'VIEWPROJECTIONINVERSETRANSPOSE' : mat4.create(),
        'WORLDVIEWPROJECTIONINVERSETRANSPOSE' : mat4.create()
    };

    Renderer.COLOR_BUFFER_BIT = glenum.COLOR_BUFFER_BIT
    Renderer.DEPTH_BUFFER_BIT = glenum.DEPTH_BUFFER_BIT
    Renderer.STENCIL_BUFFER_BIT = glenum.STENCIL_BUFFER_BIT

    return Renderer;
});
define('qtek/Scene',['require','./Node','./Light','glmatrix','./math/BoundingBox'],function(require){

    var Node = require('./Node');
    var Light = require('./Light');
    var glMatrix = require("glmatrix");
    var BoundingBox = require('./math/BoundingBox');
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;

    var Scene = Node.derive(function(){
        return {
            // Global material of scene
            material : null,
            autoUpdate : true,

            // Properties auto updated by self
            scene : null,
            lights : {},
            // Properties to save the light information in the scene
            // Will be set in the render function
            lightNumber : {
                'POINT_LIGHT' : 0,
                'DIRECTIONAL_LIGHT' : 0,
                'SPOT_LIGHT' : 0,
                'AMBIENT_LIGHT' : 0
            },
            lightUniforms : {},

            opaqueQueue : [],
            transparentQueue : [],
            lights : [],

            _opaqueObjectCount : 0,
            _transparentObjectCount : 0,

            _nodeRepository : {}
        }
    }, function() {
        this.scene = this;
    }, {

        addToScene : function(node) {
            if (node.name) {
                this._nodeRepository[node.name] = node;
            }
        },

        removeFromScene : function(node) {
            if (node.name) {
                delete this._nodeRepository[node.name];
            }
        },

        getNode : function(name) {
            return this._nodeRepository[name];
        },

        update : function(force) {
            if (!(this.autoUpdate || force)) {
                return;
            }
            Node.prototype.update.call(this, force);

            var lights = this.lights;
            var opaqueQueue = this.opaqueQueue;
            var transparentQueue = this.transparentQueue;
            var sceneMaterialTransparent = this.material && this.material.transparent;

            this._opaqueObjectCount = 0;
            this._transparentObjectCount = 0;

            lights.length = 0;

            this._updateRenderQueue(this, sceneMaterialTransparent);

            this.opaqueQueue.length = this._opaqueObjectCount;
            this.transparentQueue.length = this._transparentObjectCount;

            // reset
            for (type in this.lightNumber) {
                this.lightNumber[type] = 0;
            }
            for (var i = 0; i < lights.length; i++) {
                var light = lights[i];
                this.lightNumber[light.type]++;
            }
            this._updateLightUniforms();
        },

        // Traverse the scene and add the renderable
        // object to the render queue
        _updateRenderQueue : function(parent, sceneMaterialTransparent) {
            for (var i = 0; i < parent._children.length; i++) {
                var child = parent._children[i];
                
                if (child instanceof Light) {
                    this.lights.push(child);
                }
                if (child.isRenderable()) {
                    if (child.material.transparent || sceneMaterialTransparent) {
                        this.transparentQueue[this._transparentObjectCount++] = child;
                    } else {
                        this.opaqueQueue[this._opaqueObjectCount++] = child;
                    }
                }
                if (child._children.length > 0) {
                    this._updateRenderQueue(child);
                }
            }
        },

        _updateLightUniforms : function() {
            var lights = this.lights;
            // Put the light cast shadow before the light not cast shadow
            lights.sort(lightSortFunc);

            var lightUniforms = this.lightUniforms;
            for (var symbol in lightUniforms) {
                lightUniforms[symbol].value.length = 0;
            }
            for (var i = 0; i < lights.length; i++) {
                
                var light = lights[i];
                
                for (symbol in light.uniformTemplates) {

                    var uniformTpl = light.uniformTemplates[symbol];
                    if (! lightUniforms[symbol]) {
                        lightUniforms[symbol] = {
                            type : "",
                            value : []
                        }
                    }
                    var value = uniformTpl.value(light);
                    var lu = lightUniforms[symbol];
                    lu.type = uniformTpl.type + "v";
                    switch (uniformTpl.type) {
                        case "1i":
                        case "1f":
                            lu.value.push(value);
                            break;
                        case "2f":
                        case "3f":
                        case "4f":
                            for (var j =0; j < value.length; j++) {
                                lu.value.push(value[j]);
                            }
                            break;
                        default:
                            console.error("Unkown light uniform type "+uniformTpl.type);
                    }
                }
            }
        },

        isShaderLightNumberChanged : function(shader) {
            return shader.lightNumber.POINT_LIGHT !== this.lightNumber.POINT_LIGHT
                || shader.lightNumber.DIRECTIONAL_LIGHT !== this.lightNumber.DIRECTIONAL_LIGHT
                || shader.lightNumber.SPOT_LIGHT !== this.lightNumber.SPOT_LIGHT
                || shader.lightNumber.AMBIENT_LIGHT !== this.lightNumber.AMBIENT_LIGHT
        },

        setShaderLightNumber : function(shader) {
            for (var type in this.lightNumber) {
                shader.lightNumber[type] = this.lightNumber[type];
            }
            shader.dirty();
        },

        dispose : function() {
            this.lights = [];
            this.lightNumber = {};
            this.lightUniforms = {};
            this.material = {};
            this.opaqueQueue = [];
            this.transparentQueue = [];

            this._nodeRepository = {};
        }
    });

    function lightSortFunc(a, b) {
        if (b.castShadow && !a.castShadow) {
            return true;
        }
    }

    return Scene;
});
define('qtek/Skeleton',['require','./core/Base','./core/util','./math/Matrix4','glmatrix'],function(require) {

    var Base = require("./core/Base");
    var util = require("./core/util");
    var Matrix4 = require("./math/Matrix4");

    var glMatrix = require("glmatrix");
    var quat = glMatrix.quat;
    var vec3 = glMatrix.vec3;
    var mat4 = glMatrix.mat4;

    var Skeleton = Base.derive(function() {

        return {
            name : '',

            // Root joints
            roots : [],
            joints : [],

            _clips : [],

            // Matrix to joint space (relative to root joint)
            _invBindPoseMatricesArray : null,

            // Use subarray instead of copy back each time computing matrix
            // http://jsperf.com/subarray-vs-copy-for-array-transform/5
            _jointMatricesSubArrays : [],

            // jointMatrix * currentPoseMatrix
            // worldTransform is relative to the root bone
            // still in model space not world space
            _skinMatricesArray : null,

            _skinMatricesSubArrays : [],

            _subSkinMatricesArray : {}
        }
    }, {

        updateHierarchy : function() {
            this.roots = [];
            var joints = this.joints;
            for (var i = 0; i < joints.length; i++) {
                var joint = joints[i];
                if (joint.parentIndex >= 0) {
                    var parent = joints[joint.parentIndex].node;
                    parent.add(joint.node);
                }else{
                    this.roots.push(joint);
                }
            }
        },

        addClip : function(clip, mapRule) {

            // Map the joint index in skeleton to joint pose index in clip
            var maps = [];
            for (var i = 0; i < this.joints.length; i++) {
                maps[i] = -1;
            }
            // Create avatar
            for (var i = 0; i < clip.jointClips.length; i++) {
                for (var j = 0; j < this.joints.length; j++) {
                    var joint = this.joints[j];
                    var jointPose = clip.jointClips[i];
                    var jointName = joint.name;
                    if (mapRule) {
                        jointName = mapRule[jointName];
                    }
                    if (jointPose.name === jointName) {
                        maps[j] = i;
                        break;
                    }
                }
            }

            this._clips.push({
                maps : maps,
                clip : clip
            });

            return this._clips.length - 1;
        },

        removeClip : function(clip) {
            var idx = -1;
            for (var i = 0; i < this._clips.length; i++) {
                if (this._clips[i].clip === clip) {
                    idx = i;
                    break;
                }
            }
            if (idx > 0) {
                this._clips.splice(idx, 1);
            }
        },

        removeClipsAll : function() {
            this._clips = [];
        },

        getClip : function(index) {
            if (this._clips[index]) {
                return this._clips[index].clip;
            }
        },

        getClipNumber : function() {
            return this._clips.length;
        },

        updateJointMatrices : (function() {

            var m4 = mat4.create();

            return function() {
                for (var i = 0; i < this.roots.length; i++) {
                    this.roots[i].node.update(true);
                }
                this._invBindPoseMatricesArray = new Float32Array(this.joints.length * 16);
                this._skinMatricesArray = new Float32Array(this.joints.length * 16);

                for (var i = 0; i < this.joints.length; i++) {
                    var joint = this.joints[i];
                    // Joint space is relative to root joint's parent, if have
                    if (joint.rootNode) {
                        mat4.invert(m4, joint.rootNode.worldTransform._array);
                        // TODO is the order right?
                        mat4.multiply(
                            m4,
                            m4,
                            joint.node.worldTransform._array
                        );   
                        mat4.invert(m4, m4);
                    } else {
                        mat4.copy(m4, joint.node.worldTransform._array);
                        mat4.invert(m4, m4);
                    }

                    var offset = i * 16;
                    for (var j = 0; j < 16; j++) {
                        this._invBindPoseMatricesArray[offset + j] = m4[j];
                    }
                }

                this.updateMatricesSubArrays();
            }
        })(),

        updateMatricesSubArrays : function() {
            for (var i = 0; i < this.joints.length; i++) {
                this._jointMatricesSubArrays[i] = this._invBindPoseMatricesArray.subarray(i * 16, (i+1) * 16);
                this._skinMatricesSubArrays[i] = this._skinMatricesArray.subarray(i * 16, (i+1) * 16);
            }
        },

        update : (function() {
            var m4 = mat4.create();
            return function() {
                for (var i = 0; i < this.roots.length; i++) {
                    // Update the transform if joint node not attached to the scene
                    if (!this.roots[i].node.scene) {
                        this.roots[i].node.update(true);
                    }
                }

                for (var i = 0; i < this.joints.length; i++) {
                    var joint = this.joints[i];
                    mat4.multiply(
                        this._skinMatricesSubArrays[i],
                        joint.node.worldTransform._array,
                        this._jointMatricesSubArrays[i]
                    );

                    // Joint space is relative to root joint's parent, if have
                    // PENDING
                    if (joint.rootNode && joint.rootNode.parent) {
                        mat4.invert(m4, joint.rootNode.parent.worldTransform._array);
                        mat4.multiply(
                            this._skinMatricesSubArrays[i],
                            m4,
                            this._skinMatricesSubArrays[i]
                        );
                    }
                }
            }
        })(),

        getSubSkinMatrices : function(meshId, joints) {
            var subArray = this._subSkinMatricesArray[meshId]
            if (!subArray) {
                subArray 
                    = this._subSkinMatricesArray[meshId]
                    = new Float32Array(joints.length * 16);
            }
            var cursor = 0;
            for (var i = 0; i < joints.length; i++) {
                var idx = joints[i];
                for (var j = 0; j < 16; j++) {
                    subArray[cursor++] = this._skinMatricesArray[idx * 16 + j];
                }
            }
            return subArray;
        },

        setPose : function(clipIndex) {
            var clip = this._clips[clipIndex].clip;
            var maps = this._clips[clipIndex].maps;
            for (var i = 0; i < this.joints.length; i++) {
                var joint = this.joints[i];
                if (maps[i] === -1) {
                    continue;
                }
                var pose = clip.jointClips[maps[i]];

                vec3.copy(joint.node.position._array, pose.position);
                quat.copy(joint.node.rotation._array, pose.rotation);
                vec3.copy(joint.node.scale._array, pose.scale);

                joint.node.position._dirty = true;
                joint.node.rotation._dirty = true;
                joint.node.scale._dirty = true;
            }
            this.update();
        }
    });

    return Skeleton;
});
/**
 * ?????????????????? https://github.com/sole/tween.js/blob/master/src/Tween.js
 * author: lang(shenyi01@baidu.com)
 */
define('qtek/animation/easing',[],function() {
    var Easing = {
        Linear: function(k) {
            return k;
        },

        QuadraticIn: function(k) {
            return k * k;
        },
        QuadraticOut: function(k) {
            return k * (2 - k);
        },
        QuadraticInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k;
            }
            return - 0.5 * (--k * (k - 2) - 1);
        },

        CubicIn: function(k) {
            return k * k * k;
        },
        CubicOut: function(k) {
            return --k * k * k + 1;
        },
        CubicInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k * k;
            }
            return 0.5 * ((k -= 2) * k * k + 2);
        },

        QuarticIn: function(k) {
            return k * k * k * k;
        },
        QuarticOut: function(k) {
            return 1 - (--k * k * k * k);
        },
        QuarticInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k * k * k;
            }
            return - 0.5 * ((k -= 2) * k * k * k - 2);
        },

        QuinticIn: function(k) {
            return k * k * k * k * k;
        },

        QuinticOut: function(k) {
            return --k * k * k * k * k + 1;
        },
        QuinticInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k * k * k * k;
            }
            return 0.5 * ((k -= 2) * k * k * k * k + 2);
        },

        SinusoidalIn: function(k) {
            return 1 - Math.cos(k * Math.PI / 2);
        },
        SinusoidalOut: function(k) {
            return Math.sin(k * Math.PI / 2);
        },
        SinusoidalInOut: function(k) {
            return 0.5 * (1 - Math.cos(Math.PI * k));
        },

        ExponentialIn: function(k) {
            return k === 0 ? 0 : Math.pow(1024, k - 1);
        },
        ExponentialOut: function(k) {
            return k === 1 ? 1 : 1 - Math.pow(2, - 10 * k);
        },
        ExponentialInOut: function(k) {
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if ((k *= 2) < 1) {
                return 0.5 * Math.pow(1024, k - 1);
            }
            return 0.5 * (- Math.pow(2, - 10 * (k - 1)) + 2);
        },

        CircularIn: function(k) {
            return 1 - Math.sqrt(1 - k * k);
        },
        CircularOut: function(k) {
            return Math.sqrt(1 - (--k * k));
        },
        CircularInOut: function(k) {
            if ((k *= 2) < 1) {
                return - 0.5 * (Math.sqrt(1 - k * k) - 1);
            }
            return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
        },

        ElasticIn: function(k) {
            var s, a = 0.1, p = 0.4;
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if (!a || a < 1) {
                a = 1; s = p / 4;
            }else{
                s = p * Math.asin(1 / a) / (2 * Math.PI);
            }
            return - (a * Math.pow(2, 10 * (k -= 1)) *
                        Math.sin((k - s) * (2 * Math.PI) / p));
        },
        ElasticOut: function(k) {
            var s, a = 0.1, p = 0.4;
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if (!a || a < 1) {
                a = 1; s = p / 4;
            }
            else{
                s = p * Math.asin(1 / a) / (2 * Math.PI);
            }
            return (a * Math.pow(2, - 10 * k) *
                    Math.sin((k - s) * (2 * Math.PI) / p) + 1);
        },
        ElasticInOut: function(k) {
            var s, a = 0.1, p = 0.4;
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if (!a || a < 1) {
                a = 1; s = p / 4;
            }
            else{
                s = p * Math.asin(1 / a) / (2 * Math.PI);
            }
            if ((k *= 2) < 1) {
                return - 0.5 * (a * Math.pow(2, 10 * (k -= 1))
                    * Math.sin((k - s) * (2 * Math.PI) / p));
            }
            return a * Math.pow(2, -10 * (k -= 1))
                    * Math.sin((k - s) * (2 * Math.PI) / p) * 0.5 + 1;

        },

        BackIn: function(k) {
            var s = 1.70158;
            return k * k * ((s + 1) * k - s);
        },
        BackOut: function(k) {
            var s = 1.70158;
            return --k * k * ((s + 1) * k + s) + 1;
        },
        BackInOut: function(k) {
            var s = 1.70158 * 1.525;
            if ((k *= 2) < 1) {
                return 0.5 * (k * k * ((s + 1) * k - s));
            }
            return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
        },

        BounceIn: function(k) {
            return 1 - Easing.BounceOut(1 - k);
        },
        BounceOut: function(k) {
            if (k < (1 / 2.75)) {
                return 7.5625 * k * k;
            }
            else if (k < (2 / 2.75)) {
                return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
            } else if (k < (2.5 / 2.75)) {
                return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
            } else {
                return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
            }
        },
        BounceInOut: function(k) {
            if (k < 0.5) {
                return Easing.BounceIn(k * 2) * 0.5;
            }
            return Easing.BounceOut(k * 2 - 1) * 0.5 + 0.5;
        }
    };

    return Easing;
});


define('qtek/animation/Clip',['require','./easing'],function(require) {

    var Easing = require('./easing');

    var Clip = function(options) {

        options = options || {};

        this.target = options.target;

        if (options.life !== undefined) {
            this.life = options.life;
        }
        if (options.delay !== undefined) {
            this.delay = options.delay;
        }
        if (options.gap !== undefined) {
            this.gap = options.gap;
        }
        
        this._startTime = new Date().getTime() + this.delay;

        this._endTime = this._startTime + this.life;

        this._loop = options.loop === undefined ? false : options.loop;
        this.setLoop(this._loop);

        if (options.easing !== undefined) {
            this.setEasing(options.easing);
        }

        if (options.onframe !== undefined) {
            this.onframe = options.onframe;
        }

        if (options.ondestroy !== undefined) {
            this.ondestroy = options.ondestroy;
        }

        if (options.onrestart !== undefined) {
            this.onrestart = options.onrestart;
        }

    };

    Clip.prototype = {

        gap : 0,

        life : 0,

        delay : 0,

        gap : 0,

        setLoop : function(loop) {
            this._loop = loop;
            if (loop) {
                if (typeof(loop) == 'number') {
                    this._loopRemained = loop;
                } else {
                    this._loopRemained = 1e8;
                }   
            }
        },

        setEasing : function(easing) {
            if (typeof(easing) === 'string') {
                easing = Easing[easing];
            }
            this.easing = easing;
        },

        step : function(time) {
            
            this._elapsedTime = time - this._startTime;

            var percent = this._elapsedTime / this.life;

            if (percent < 0) {
                return;
            }

            percent = Math.min(percent, 1);

            var schedule;
            if (this.easing) {
                schedule = this.easing(percent);
            }else{
                schedule = percent;
            }
            this.fire('frame', schedule);

            if (percent == 1) {
                if (this._loop && this._loopRemained > 0) {
                    this.restart();
                    this._loopRemained--;
                    return 'restart';
                }else{
                    // Mark this clip to be deleted
                    // In the animation.update
                    this._needsRemove = true;

                    return 'destroy';
                }
            }else{
                return null;
            }
        },

        setTime : function(time) {console.warn('set time is not implented in Clip')},

        restart : function() {
            this._startTime = new Date().getTime() + this.gap;
        },
        
        fire : function(eventType, arg) {
            var eventName = 'on' + eventType;
            if (this[eventName]) {
                this[eventName](this.target, arg);
            }
        }
    };
    Clip.prototype.constructor = Clip;

    return Clip;
});
define('qtek/animation/Animation',['require','./Clip','../core/Base'],function(require) {
    
    

    var Clip = require('./Clip');
    var Base = require('../core/Base');

    var requestAnimationFrame = window.requestAnimationFrame
                                || window.msRequestAnimationFrame
                                || window.mozRequestAnimationFrame
                                || window.webkitRequestAnimationFrame
                                || function(func){setTimeout(func, 16)};

    var arraySlice = Array.prototype.slice;

    var Animation = Base.derive(function() {
        return {
            stage : null,

            _clips : [],

            _running : false,
            
            _time : 0
        }
    }, {
        addClip : function(clip) {
            this._clips.push(clip);
        },
        removeClip : function(clip) {
            var idx = this._clips.indexOf(clip);
            clip = this._clips.pop();
            this._clips[idx] = clip;
        },
        update : function() {
            
            var time = new Date().getTime();
            var delta = time - this._time;
            var clips = this._clips;
            var len = clips.length;

            var deferredEvents = [];
            var deferredClips = [];
            for (var i = 0; i < len; i++) {
                var clip = clips[i];
                var e = clip.step(time);
                // Throw out the events need to be called after
                // stage.render, like destroy
                if (e) {
                    deferredEvents.push(e);
                    deferredClips.push(clip);
                }
            }
            if (this.stage
                && this.stage.render
                && this._clips.length
            ) {
                this.stage.render();
            }

            // Remove the finished clip
            for (var i = 0; i < len;) {
                if (clips[i]._needsRemove) {
                    clips[i] = clips[len-1];
                    clips.pop();
                    len--;
                } else {
                    i++;
                }
            }

            len = deferredEvents.length;
            for (var i = 0; i < len; i++) {
                deferredClips[i].fire(deferredEvents[i]);
            }

            this._time = time;

            this.trigger('frame', delta);
        },
        start : function() {
            var self = this;

            this._running = true;
            this._time = new Date().getTime();

            function step() {
                if (self._running) {
                    
                    requestAnimationFrame(step);

                    self.update();
                }
            }

            requestAnimationFrame(step);
        },
        stop : function() {
            this._running = false;
        },
        removeClipsAll : function() {
            this._clips = [];
        },
        animate : function(target, options) {
            options = options || {};
            var deferred = new Deferred(
                target,
                options.loop,
                options.getter, 
                options.setter
            );
            deferred.animation = this;
            return deferred;
        }
    });

    function _defaultGetter(target, key) {
        return target[key];
    }
    function _defaultSetter(target, key, value) {
        target[key] = value;
    }

    function _interpolateNumber(p0, p1, percent) {
        return (p1 - p0) * percent + p0;
    }

    function _interpolateArray(p0, p1, percent, out, arrDim) {
        var len = p0.length;
        if (arrDim == 1) {
            for (var i = 0; i < len; i++) {
                out[i] = _interpolateNumber(p0[i], p1[i], percent); 
            }
        } else {
            var len2 = p0[0].length;
            for (var i = 0; i < len; i++) {
                for (var j = 0; j < len2; j++) {
                    out[i][j] = _interpolateNumber(
                        p0[i][j], p1[i][j], percent
                    );
                }
            }
        }
    }

    function _isArrayLike(data) {
        if (data === undefined) {
            return false;
        } else if (typeof(data) == 'string') {
            return false;
        } else {
            return data.length !== undefined;
        }
    }

    function _catmullRomInterpolateArray(
        p0, p1, p2, p3, t, t2, t3, out, arrDim
    ) {
        var len = p0.length;
        if (arrDim == 1) {
            for (var i = 0; i < len; i++) {
                out[i] = _catmullRomInterpolate(
                    p0[i], p1[i], p2[i], p3[i], t, t2, t3
                );
            }
        } else {
            var len2 = p0[0].length;
            for (var i = 0; i < len; i++) {
                for (var j = 0; j < len2; j++) {
                    out[i][j] = _catmullRomInterpolate(
                        p0[i][j], p1[i][j], p2[i][j], p3[i][j],
                        t, t2, t3
                    );
                }
            }
        }
    }
    
    function _catmullRomInterpolate(p0, p1, p2, p3, t, t2, t3) {
        var v0 = (p2 - p0) * 0.5;
        var v1 = (p3 - p1) * 0.5;
        return (2 * (p1 - p2) + v0 + v1) * t3 
                + (- 3 * (p1 - p2) - 2 * v0 - v1) * t2
                + v0 * t + p1;
    };
    
    function Deferred(target, loop, getter, setter) {
        this._tracks = {};
        this._target = target;

        this._loop = loop || false;

        this._getter = getter || _defaultGetter;
        this._setter = setter || _defaultSetter;

        this._clipCount = 0;

        this._delay = 0;

        this._doneList = [];

        this._onframeList = [];

        this._clipList = [];
    }

    Deferred.prototype = {
        when : function(time /* ms */, props) {
            for (var propName in props) {
                if (! this._tracks[propName]) {
                    this._tracks[propName] = [];
                    // Initialize value
                    this._tracks[propName].push({
                        time : 0,
                        value : this._getter(this._target, propName)
                    });
                }
                this._tracks[propName].push({
                    time : parseInt(time),
                    value : props[propName]
                });
            }
            return this;
        },
        during : function(callback) {
            this._onframeList.push(callback);
            return this;
        },
        start : function(easing) {

            var self = this;
            var setter = this._setter;
            var getter = this._getter;
            var onFrameListLen = self._onframeList.length;
            var useSpline = easing === 'spline';

            var ondestroy = function() {
                self._clipCount--;
                if (self._clipCount === 0) {
                    // Clear all tracks
                    self._tracks = {};

                    var len = self._doneList.length;
                    for (var i = 0; i < len; i++) {
                        self._doneList[i].call(self);
                    }
                }
            }

            var createTrackClip = function(keyframes, propName) {
                var trackLen = keyframes.length;
                if (!trackLen) {
                    return;
                }
                // Guess data type
                var firstVal = keyframes[0].value;
                var isValueArray = _isArrayLike(firstVal);

                // For vertices morphing
                var arrDim = (
                        isValueArray 
                        && _isArrayLike(firstVal[0])
                    )
                    ? 2 : 1;
                // Sort keyframe as ascending
                keyframes.sort(function(a, b) {
                    return a.time - b.time;
                });
                if (trackLen) {
                    var trackMaxTime = keyframes[trackLen-1].time;
                }else{
                    return;
                }
                // Percents of each keyframe
                var kfPercents = [];
                // Value of each keyframe
                var kfValues = [];
                for (var i = 0; i < trackLen; i++) {
                    kfPercents.push(keyframes[i].time / trackMaxTime);
                    if (isValueArray) {
                        if (arrDim == 2) {
                            kfValues[i] = [];
                            for (var j = 0; j < firstVal.length; j++) {
                                kfValues[i].push(arraySlice.call(keyframes[i].value[j]));
                            }
                        } else {
                            kfValues.push(arraySlice.call(keyframes[i].value));
                        }
                    } else {
                        kfValues.push(keyframes[i].value);
                    }
                }

                // Cache the key of last frame to speed up when 
                // animation playback is sequency
                var cacheKey = 0;
                var cachePercent = 0;
                var start;
                var i, w;
                var p0, p1, p2, p3;

                var onframe = function(target, percent) {
                    // Find the range keyframes
                    // kf1-----kf2---------current--------kf3
                    // find kf2(i) and kf3(i+1) and do interpolation
                    if (percent < cachePercent) {
                        // Start from next key
                        start = Math.min(cacheKey + 1, trackLen - 1);
                        for (i = start; i >= 0; i--) {
                            if (kfPercents[i] <= percent) {
                                break;
                            }
                        }
                        i = Math.min(i, trackLen-2);
                    } else {
                        for (i = cacheKey; i < trackLen; i++) {
                            if (kfPercents[i] > percent) {
                                break;
                            }
                        }
                        i = Math.min(i-1, trackLen-2);
                    }
                    cacheKey = i;
                    cachePercent = percent;

                    var range = (kfPercents[i+1] - kfPercents[i]);
                    if (range == 0) {
                        return;
                    } else {
                        w = (percent - kfPercents[i]) / range;
                    }
                    if (useSpline) {
                        p1 = kfValues[i];
                        p0 = kfValues[i == 0 ? i : i - 1];
                        p2 = kfValues[i > trackLen - 2 ? trackLen - 1 : i + 1];
                        p3 = kfValues[i > trackLen - 3 ? trackLen - 1 : i + 2];
                        if (isValueArray) {
                            _catmullRomInterpolateArray(
                                p0, p1, p2, p3, w, w*w, w*w*w,
                                getter(target, propName),
                                arrDim
                            );
                        } else {
                            setter(
                                target,
                                propName,
                                _catmullRomInterpolate(p0, p1, p2, p3, w, w*w, w*w*w)
                            );
                        }
                    } else {
                        if (isValueArray) {
                            _interpolateArray(
                                kfValues[i], kfValues[i+1], w,
                                getter(target, propName),
                                arrDim
                            );
                        } else {
                            setter(
                                target,
                                propName,
                                _interpolateNumber(kfValues[i], kfValues[i+1], w)
                            );
                        }
                    }

                    for (i = 0; i < onFrameListLen; i++) {
                        self._onframeList[i](target, percent);
                    }
                };

                var clip = new Clip({
                    target : self._target,
                    life : trackMaxTime,
                    loop : self._loop,
                    delay : self._delay,
                    onframe : onframe,
                    ondestroy : ondestroy
                });

                if (easing && easing !== 'spline') {
                    clip.setEasing(easing);
                }
                self._clipList.push(clip);
                self._clipCount++;
                self.animation.addClip(clip);
            }


            for (var propName in this._tracks) {
                createTrackClip(this._tracks[propName], propName);
            }
            return this;
        },
        stop : function() {
            for (var i = 0; i < this._clipList.length; i++) {
                var clip = this._clipList[i];
                this.animation.removeClip(clip);
            }
            this._clipList = [];
        },
        delay : function(time){
            this._delay = time;
            return this;
        },
        done : function(func) {
            this._doneList.push(func);
            return this;
        }
    };

    return Animation;
});

define('qtek/core/Event',['require','./Base'], function(require) {

    var Base = require('./Base');

    var QEvent = Base.derive({
        cancelBubble : false
    }, {
        stopPropagation : function() {
            this.cancelBubble = true;
        }
    });

    QEvent.throw = function(eventType, target, props) {
        
        var e = new QEvent(props);

        e.type = eventType;
        e.target = target;

        // enable bubbling
        while (target && !e.cancelBubble ) {
            e.currentTarget = target;
            target.trigger(eventType, e);

            target = target.parent;
        }
    }

    return QEvent;
} );
define('qtek/camera/Perspective',['require','../Camera'],function(require) {

    var Camera = require('../Camera');

    var Perspective = Camera.derive(function() {
        return {

            fov : 50,
            
            aspect : 1,
            
            near : 0.1,

            far : 2000
        }
    }, {
        
        updateProjectionMatrix : function() {
            var rad = this.fov / 180 * Math.PI;
            this.projectionMatrix.perspective(rad, this.aspect, this.near, this.far);
        }
    });

    return Perspective;
} );
define('qtek/Stage',['require','./core/Base','./Layer','./animation/Animation','./core/Event','./Scene','./Renderer','./camera/Perspective','./2d/Scene','./2d/CanvasRenderer','./2d/Camera'],function(require) {

    var Base = require('./core/Base');
    var Layer = require('./Layer');
    var Animation = require('./animation/Animation');
    var QEvent = require('./core/Event');

    var Scene3D = require('./Scene');
    var Renderer3D = require('./Renderer');
    var Camera3D = require('./camera/Perspective');
    
    var Scene2D = require('./2d/Scene');
    var Renderer2D = require('./2d/CanvasRenderer');
    var Camera2D = require('./2d/Camera');

    var Stage = Base.derive(function() {
        return {
            container : null,

            width : 100,
            height : 100,

            _layers : [],

            _layersSorted : [],

            _mouseOverEl : null
        }
    }, function() {
        
        if (!this.container) {
            this.container = document.createElement('div');
        }
        if (this.container.style.position !== 'absolute' &&
            this.container.style.position !== 'fixed') {
            this.container.style.position = 'relative';
        }

        if (this.width) {
            this.container.style.width = this.width + 'px';
        } else {
            this.width = Math.max(this.container.clientWidth, 1);
        }
        if (this.height) {
            this.container.style.height = this.height + 'px';
        } else {
            this.height = Math.max(this.container.clientHeight, 1);
        }

        this.container.addEventListener("click", this._eventProxy.bind(this, 'click'));
        this.container.addEventListener("dblclick", this._eventProxy.bind(this, 'dblclick'));
        this.container.addEventListener("mousemove", this._mouseMoveHandler.bind(this));
        this.container.addEventListener("mousedown", this._eventProxy.bind(this, 'mousedown'));
        this.container.addEventListener("mouseup", this._eventProxy.bind(this, 'mouseup'));
        this.container.addEventListener("mouseout", this._mouseOutHandler.bind(this));

        this.animation = new Animation();
        this.animation.start();

        this.animation.on('frame', function(frameTime) {
            this.trigger('frame', frameTime);
        }, this);
    }, {

        /**
         * Create a new 2d layer
         * @param {qtek.2d.Renderer} [renderer]
         * @param {qtek.2d.Scene} [scene]
         * @param {qtek.2d.Camera} [camera]
         * @return {qtek.Layer}
         */
        createLayer2D : function(options) {
            options = options || {};
            options.renderer = options.renderer || new Renderer2D();
            options.camera = options.camera || new Camera2D();
            options.scene = options.scene || new Scene2D();

            var layer = new Layer(options);
            this.addLayer(layer);

            return layer;
        },

        /**
         * Create a new 3d layer
         * @param {qtek.3d.Renderer} [renderer]
         * @param {qtek.3d.Scene} [scene]
         * @param {qtek.3d.Camera} [camera]
         * @return {qtek.Layer}
         */
        createLayer3D : function(options) {
            options = options || {};
            options.renderer = options.renderer || new Renderer3D();
            if (!options.camera) {
                options.camera = new Camera3D();
                options.camera.position.z = 1;
                options.camera.aspect = this.width / this.height;
            }
            options.scene = options.scene || new Scene3D();

            var layer = new Layer(options);
            this.addLayer(layer);

            return layer;
        },

        addLayer : function(layer) {
            if (!layer.renderer) {
                console.warn('Layer don\'t have renderer');
                return;
            } else if (!layer.renderer.canvas) {
                console.warn('Layer renderer don\'t have canvas');
                return;
            }
            var canvas = layer.renderer.canvas;

            layer.renderer.resize(this.width, this.height);

            canvas.style.position = 'absolute';
            canvas.style.left = '0px';
            canvas.style.top = '0px';

            this.container.appendChild(canvas);

            this._layers.push(layer);
            this._layersSorted = this._layers.slice().sort(function(a, b){
                if (a.z === b.z)
                    return a.__GUID__ > b.__GUID__ ? 1 : -1;
                return a.z > b.z ? 1 : -1 ;
            });
        },

        removeLayer : function(layer) {
            this._layers.splice(this._layers.indexOf(layer), 1);

            this.container.removeChild(layer.canvas);
        },

        resize : function(width, height) {
            this.width = width;
            this.height = height;

            for (var i = 0; i < this._layers.length; i++) {
                this._layers[i].resize(width, height);
                if (this._layers[i].camera instanceof Camera3D) {
                    this._layers[i].camera.aspect = width / height;
                }
            }
        },

        render : function() {
            for (var i = 0; i < this._layers.length; i++) {
                this._layers[i].render();
            }
        },

        _eventProxy : function(type, e) {
            var e2 = this._assembleEvent(e);
            var el = this._findTrigger(e2);
            if (el) {
                QEvent.throw(type, el, e2);
            }
            this.trigger(type, e2);
        },

        _mouseMoveHandler : function(e) {
            var el = this._findTrigger(e);
            if (el) {
                QEvent.throw('mousemove', el, this._assembleEvent(e));
            }

            if (this._mouseOverEl !== el) {
                if (this._mouseOverEl) {
                    QEvent.throw('mouseout', this._mouseOverEl, this._assembleEvent(e));
                }
                if (el) {
                    QEvent.throw('mouseover', el, this._assembleEvent(e));
                }
                this._mouseOverEl = el;
            }
        },

        _mouseOutHandler : function(e) {
            if (this._mouseOverEl) {
                QEvent.throw('mouseout', this._mouseOverEl, this._assembleEvent(e));
            }
        },

        _findTrigger : function(e) {
            var container = this.container;
            var x = e.x;
            var y = e.y;

            for (var i = this._layersSorted.length - 1; i >= 0 ; i--) {
                var layer = this._layersSorted[i];
                var el = layer.pick(x, y);
                if (el) {
                    return el;
                }
            }
        },

        _assembleEvent : function(e){
            var clientRect = this.container.getBoundingClientRect();
            return {
                pageX : e.pageX,
                pageY : e.pageY,
                x : e.pageX - clientRect.left - document.body.scrollLeft,
                y : e.pageY - clientRect.top - document.body.scrollTop
            }
        }

    });

    return Stage;
});
// 1D Blend clip of blend tree
// http://docs.unity3d.com/Documentation/Manual/1DBlending.html
define('qtek/animation/Blend1DClip',['require','./Clip'],function(require) {

    var Clip = require('./Clip');

    var clipSortFunc = function(a, b) {
        return a.position < b.position;
    }

    var Blend1DClip = function(opts) {

        opts = opts || {};

        Clip.call(this, opts);

        this.output = opts.output || null;
        // 
        // {
        //  position : 
        //  clip : 
        //  offset : 0
        // }
        this.inputs = opts.inputs || [];

        this.position = 0;

        this._cacheKey = 0;
        this._cachePosition = -Infinity;

        this.inputs.sort(clipSortFunc);
    }

    Blend1DClip.prototype = new Clip();
    Blend1DClip.prototype.constructor = Blend1DClip;

    Blend1DClip.prototype.addInput = function(position, inputClip, offset) {
        var obj = {
            position : position,
            clip : inputClip,
            offset : offset || 0
        }
        this.life = Math.max(inputClip.life, this.life);

        if (!this.inputs.length) {
            this.inputs.push(obj);
            return obj;
        }
        var len = this.inputs.length;
        if (this.inputs[0].position > position) {
            this.inputs.unshift(obj);
        } else if (this.inputs[len - 1].position <= position) {
            this.inputs.push(obj);
        } else {
            var key = this._findKey(position);
            this.inputs.splice(key, obj);
        }

        return obj;
    }

    Blend1DClip.prototype.step = function(time) {

        var ret = Clip.prototype.step.call(this, time);

        if (ret !== 'destroy') {
            this.setTime(this._elapsedTime);
        }

        return ret;
    }

    Blend1DClip.prototype.setTime = function(time) {
        var position = this.position;
        var inputs = this.inputs;
        var len = inputs.length;
        var min = inputs[0].position;
        var max = inputs[len-1].position;

        if (position <= min || position >= max) {
            var in0 = position <= min ? inputs[0] : inputs[len-1];
            var clip = in0.clip;
            var offset = in0.offset;
            clip.setTime((time + offset) % clip.life);
            // Input clip is a blend clip
            // PENDING
            if (clip.output instanceof Clip) {
                this.output.copy(clip.output);
            } else {
                this.output.copy(clip);
            }
        } else {
            var key = this._findKey(position);
            var in1 = inputs[key];
            var in2 = inputs[key + 1];
            var clip1 = in1.clip;
            var clip2 = in2.clip;
            clip1.setTime((time + in1.offset) % clip1.life);
            clip2.setTime((time + in2.offset) % clip2.life);

            var w = (this.position - in1.position) / (in2.position - in1.position);

            var c1 = clip1.output instanceof Clip ? clip1.output : clip1;
            var c2 = clip2.output instanceof Clip ? clip2.output : clip2;
            this.output.blend1D(c1, c2, w);
        }
    }
    
    // Find the key where position in range [inputs[key].position, inputs[key+1].position)
    Blend1DClip.prototype._findKey = function(position) {
        var key = -1;
        var inputs = this.inputs;
        var len = inputs.length;
        if (this._cachePosition < position) {
            for (var i = this._cacheKey; i < len-1; i++) {
                if (position >= inputs[i].position && position < inputs[i+1].position) {
                    key = i;
                }
            }
        } else {
            var s = Math.min(len-2, this._cacheKey);
            for (var i = s; i >= 0; i--) {
                if (position >= inputs[i].position && position < inputs[i+1].position) {
                    key = i;
                }
            }
        }
        if (key >= 0) {
            this._cacheKey = key;
            this._cachePosition = position;
        }

        return key;
    }

    return Blend1DClip;
});
// Delaunay Triangulation
// Modified from https://github.com/ironwallaby/delaunay

define('qtek/util/delaunay',['require'],function(require) {
    

    function appendSupertriangleVertices(vertices) {
        var xmin = Number.POSITIVE_INFINITY,
            ymin = Number.POSITIVE_INFINITY,
            xmax = Number.NEGATIVE_INFINITY,
            ymax = Number.NEGATIVE_INFINITY,
            i, dx, dy, dmax, xmid, ymid;

        for(i = vertices.length; i--; ) {
            if(vertices[i][0] < xmin) xmin = vertices[i][0];
            if(vertices[i][0] > xmax) xmax = vertices[i][0];
            if(vertices[i][1] < ymin) ymin = vertices[i][1];
            if(vertices[i][1] > ymax) ymax = vertices[i][1];
        }

        dx = xmax - xmin;
        dy = ymax - ymin;
        dmax = Math.max(dx, dy);
        xmid = xmin + dx * 0.5;
        ymid = ymin + dy * 0.5;

        vertices.push(
            [xmid - 20 * dmax, ymid -      dmax],
            [xmid            , ymid + 20 * dmax],
            [xmid + 20 * dmax, ymid -      dmax]
        );
    }

    function triangle(vertices, i, j, k) {
        var a = vertices[i],
            b = vertices[j],
            c = vertices[k],
            A = b[0] - a[0],
            B = b[1] - a[1],
            C = c[0] - a[0],
            D = c[1] - a[1],
            E = A * (a[0] + b[0]) + B * (a[1] + b[1]),
            F = C * (a[0] + c[0]) + D * (a[1] + c[1]),
            G = 2 * (A * (c[1] - b[1]) - B * (c[0] - b[0])),
            minx, miny, dx, dy, x, y;

        /* If the points of the triangle are collinear, then just find the
         * extremes and use the midpoint as the center of the circumcircle. */
        if (Math.abs(G) < 0.000001) {
            minx = Math.min(a[0], b[0], c[0]);
            miny = Math.min(a[1], b[1], c[1]);
            dx   = (Math.max(a[0], b[0], c[0]) - minx) * 0.5;
            dy   = (Math.max(a[1], b[1], c[1]) - miny) * 0.5;
            x    = minx + dx;
            y    = miny + dy;
        }
        else {
            x  = (D*E - B*F) / G;
            y  = (A*F - C*E) / G;
            dx = x - a[0];
            dy = y - a[1];
        }

        return {i: i, j: j, k: k, x: x, y: y, r: dx * dx + dy * dy};
    }

    function dedup(edges) {
        var j = edges.length,
            a, b, i, m, n;

        outer: while (j) {
            b = edges[--j];
            a = edges[--j];
            i = j;
            while (i) {
                n = edges[--i]
                m = edges[--i]
                if ((a === m && b === n) || (a === n && b === m)) {
                    edges.splice(j, 2);
                    edges.splice(i, 2);
                    j -= 2;
                    continue outer;
                }
            }
        }
    }

    var delaunay = {
        triangulate: function(vertices, key) {
            var n = vertices.length,
                i, j, indices, open, closed, edges, dx, dy, a, b, c;

            /* Bail if there aren't enough vertices to form any triangles. */
            if (n < 3) {
                return [];
            }

            /* Slice out the actual vertices from the passed objects. (Duplicate the
            * array even if we don't, though, since we need to make a supertriangle
            * later on!) */
            vertices = vertices.slice(0);
            
            if (key) {
                for (i = n; i--; ) {
                    vertices[i] = vertices[i][key];
                }
            }

            /* Make an array of indices into the vertex array, sorted by the vertices'
            * x-position. */
            indices = new Array(n);

            for (i = n; i--; ) {
                indices[i] = i;
            }

            indices.sort(function(i, j) { return vertices[j][0] - vertices[i][0]; });

            /* Next, find the vertices of the supertriangle (which contains all other
            * triangles), and append them onto the end of a (copy of) the vertex
            * array. */
            appendSupertriangleVertices(vertices);

            /* Initialize the open list (containing the supertriangle and nothing else)
            * and the closed list (which is empty since we havn't processed any
            * triangles yet). */
            open   = [triangle(vertices, n + 0, n + 1, n + 2)];
            closed = [];
            edges  = [];

            /* Incrementally add each vertex to the mesh. */
            for (i = indices.length; i--; ) {
                c = indices[i];
                edges.length = 0;

                /* For each open triangle, check to see if the current point is
                 * inside it's circumcircle. If it is, remove the triangle and add
                 * it's edges to an edge list. */
                for (j = open.length; j--; ) {
                    /* If this point is to the right of this triangle's circumcircle,
                    * then this triangle should never get checked again. Remove it
                    * from the open list, add it to the closed list, and skip. */
                    dx = vertices[c][0] - open[j].x;
                    if (dx > 0.0 && dx * dx > open[j].r) {
                        closed.push(open[j]);
                        open.splice(j, 1);
                        continue;
                    }

                    /* If we're outside the circumcircle, skip this triangle. */
                    dy = vertices[c][1] - open[j].y;
                    if (dx * dx + dy * dy > open[j].r) {
                        continue;
                    }

                    /* Remove the triangle and add it's edges to the edge list. */
                    edges.push(
                        open[j].i, open[j].j,
                        open[j].j, open[j].k,
                        open[j].k, open[j].i
                    );
                    open.splice(j, 1);
                }

                /* Remove any doubled edges. */
                dedup(edges);

                /* Add a new triangle for each edge. */
                for(j = edges.length; j; ) {
                    b = edges[--j];
                    a = edges[--j];
                    open.push(triangle(vertices, a, b, c));
                }
            }

            /* Copy any remaining open triangles to the closed list, and then
            * remove any triangles that share a vertex with the supertriangle, building
            * a list of triplets that represent triangles. */
            for (i = open.length; i--; ) {
                closed.push(open[i]);
            }
            open.length = 0;

            for(i = closed.length; i--; ) {
                if(closed[i].i < n && closed[i].j < n && closed[i].k < n) {
                    var i1 = closed[i].i,
                        i2 = closed[i].j,
                        i3 = closed[i].k;
                    var tri = {
                        indices : [i1, i2, i3],
                        vertices : [vertices[i1], vertices[i2], vertices[i3]]
                    };
                    open.push(tri);
                }
            }

            /* Yay, we're done! */
            return open;
        },

        contains: function(tri, p) {
            /* Bounding box test first, for quick rejections. */
            if((p[0] < tri[0][0] && p[0] < tri[1][0] && p[0] < tri[2][0]) ||
              (p[0] > tri[0][0] && p[0] > tri[1][0] && p[0] > tri[2][0]) ||
              (p[1] < tri[0][1] && p[1] < tri[1][1] && p[1] < tri[2][1]) ||
              (p[1] > tri[0][1] && p[1] > tri[1][1] && p[1] > tri[2][1])) {

                return null;
            }

            var a = tri[1][0] - tri[0][0],
                b = tri[2][0] - tri[0][0],
                c = tri[1][1] - tri[0][1],
                d = tri[2][1] - tri[0][1],
                i = a * d - b * c;

            /* Degenerate tri. */
            if(i === 0.0) {
                return null;
            }

            var u = (d * (p[0] - tri[0][0]) - b * (p[1] - tri[0][1])) / i,
                v = (a * (p[1] - tri[0][1]) - c * (p[0] - tri[0][0])) / i;

            /* If we're outside the tri, fail. */
            if(u < 0.0 || v < 0.0 || (u + v) > 1.0) {
                return null;
            }
            
            // normalize
            // u = Math.max(0.0, u);
            // v = Math.max(0.0, v);
            // var s = u + v;
            // if (s > 1.0) {
            //     u = u / s;
            //     v = v / s;
            // }
            return [u, v];
        }
    }

    return delaunay;
});
// 2D Blend clip of blend tree
// http://docs.unity3d.com/Documentation/Manual/2DBlending.html
define('qtek/animation/Blend2DClip',['require','./Clip','../util/delaunay','../math/Vector2','glmatrix'],function(require) {

    var Clip = require('./Clip');

    var delaunay = require('../util/delaunay');
    var Vector2 = require('../math/Vector2');

    var glMatrix = require("glmatrix");
    var quat = glMatrix.quat;
    var vec3 = glMatrix.vec3;

    var Blend2DClip = function(opts) {

        opts = opts || {};
        
        Clip.call(this, opts);

        this.output = opts.output || null;

        // {
        //  position : Vector2()
        //  clip : Clip()
        //  offset : 0
        // }
        this.inputs = opts.inputs || [];

        this.position = new Vector2();

        this._cacheTriangle = null;

        this._triangles = [];

        this.updateTriangles();
    }

    Blend2DClip.prototype = new Clip();
    Blend2DClip.prototype.constructor = Blend2DClip;

    Blend2DClip.prototype.addInput = function(position, inputClip, offset) {
        var obj = {
            position : position,
            clip : inputClip,
            offset : offset || 0
        }
        this.inputs.push(obj);
        this.life = Math.max(inputClip.life, this.life);
        // TODO Change to incrementally adding
        this.updateTriangles();

        return obj;
    }

    // Delaunay triangulate
    Blend2DClip.prototype.updateTriangles = function() {
        var inputs = this.inputs.map(function(a) {
            return a.position;
        });
        this._triangles = delaunay.triangulate(inputs, '_array');
    }

    Blend2DClip.prototype.step = function(time) {

        var ret = Clip.prototype.step.call(this, time);

        if (ret !== 'destroy') {
            this.setTime(this._elapsedTime);
        }

        return ret;
    }

    Blend2DClip.prototype.setTime = function(time) {
        var res = this._findTriangle(this.position);
        if (!res) {
            return;
        }
        // In Barycentric
        var a = res[1]; // Percent of clip2
        var b = res[2]; // Percent of clip3

        var tri = res[0];

        var in1 = this.inputs[tri.indices[0]];
        var in2 = this.inputs[tri.indices[1]];
        var in3 = this.inputs[tri.indices[2]];
        var clip1 = in1.clip;
        var clip2 = in2.clip;
        var clip3 = in3.clip;

        clip1.setTime((time + in1.offset) % clip1.life);
        clip2.setTime((time + in2.offset) % clip2.life);
        clip3.setTime((time + in3.offset) % clip3.life);
        
        var c1 = clip1.output instanceof Clip ? clip1.output : clip1;
        var c2 = clip2.output instanceof Clip ? clip2.output : clip2;
        var c3 = clip3.output instanceof Clip ? clip3.output : clip3;

        this.output.blend2D(c1, c2, c3, a, b);
    }

    // Find the key where position in range [inputs[key].position, inputs[key+1].position)
    Blend2DClip.prototype._findTriangle = function(position) {
        if (this._cacheTriangle) {
            var res = delaunay.contains(this._cacheTriangle.vertices, position._array);
            if (res) {
                return [this._cacheTriangle, res[0], res[1]];
            }
        }
        for (var i = 0; i < this._triangles.length; i++) {
            var tri = this._triangles[i];
            var res = delaunay.contains(tri.vertices, this.position._array);
            if (res) {
                this._cacheTriangle = tri;
                return [tri, res[0], res[1]];
            }
        }
    }

    return Blend2DClip;
});
define('qtek/animation/TransformClip',['require','./Clip','glmatrix'],function(require) {

    
    
    var Clip = require('./Clip');

    var glMatrix = require("glmatrix");
    var quat = glMatrix.quat;
    var vec3 = glMatrix.vec3;

    function keyframeSort(a, b) {
        return a.time - b.time;
    }

    var TransformClip = function(options) {
        
        options = options || {};

        this.name = options.name || '';

        Clip.call(this, options);

        //[{
        //  time : //ms
        //  position :  // optional
        //  rotation :  // optional
        //  scale :     // optional
        //}]
        this.keyFrames = []
        if (options.keyFrames) {
            this.addKeyFrames(options.keyFrames)
        }

        this.position = vec3.create();
        this.rotation = quat.create();
        this.scale = vec3.fromValues(1, 1, 1);

        this._cacheKey = 0;
        this._cacheTime = 0;
    }

    TransformClip.prototype = Object.create(Clip.prototype);

    TransformClip.prototype.constructor = TransformClip;

    TransformClip.prototype.step = function(time) {

        var ret = Clip.prototype.step.call(this, time);

        if (ret !== 'destroy') {
            this.setTime(this._elapsedTime);
        }

        return ret;
    }

    TransformClip.prototype.setTime = function(time) {
        this._interpolateField(time, 'position');
        this._interpolateField(time, 'rotation');
        this._interpolateField(time, 'scale');   
    }

    TransformClip.prototype.addKeyFrame = function(kf) {
        for (var i = 0; i < this.keyFrames.length - 1; i++) {
            var prevFrame = this.keyFrames[i];
            var nextFrame = this.keyFrames[i+1];
            if (prevFrame.time <= kf.time && nextFrame.time >= kf.time) {
                this.keyFrames.splice(i, 0, kf);
                return i;
            }
        }

        this.life = kf.time;
        this.keyFrames.push(kf);
    }

    TransformClip.prototype.addKeyFrames = function(kfs) {
        for (var i = 0; i < kfs.length; i++) {
            this.keyFrames.push(kfs[i]);
        }

        this.keyFrames.sort(keyframeSort);

        this.life = this.keyFrames[this.keyFrames.length - 1].time;
    }

    TransformClip.prototype._interpolateField = function(time, fieldName) {
        var kfs = this.keyFrames;
        var len = kfs.length;
        var start;
        var end;

        if (!kfs.length) {
            return;
        }
        if (time < kfs[0].time || time > kfs[kfs.length-1].time) {
            return;
        }
        if (time < this._cacheTime) {
            var s = this._cacheKey >= len-1 ? len-1 : this._cacheKey+1;
            for (var i = s; i >= 0; i--) {
                if (kfs[i].time <= time && kfs[i][fieldName]) {
                    start = kfs[i];
                    this._cacheKey = i;
                    this._cacheTime = time;
                } else if (kfs[i][fieldName]) {
                    end = kfs[i];
                    break;
                }
            }
        } else {
            for (var i = this._cacheKey; i < len; i++) {
                if (kfs[i].time <= time && kfs[i][fieldName]) {
                    start = kfs[i];
                    this._cacheKey = i;
                    this._cacheTime = time;
                } else if (kfs[i][fieldName]) {
                    end = kfs[i];
                    break;
                }
            }
        }

        if (start && end) {
            var percent = (time-start.time) / (end.time-start.time);
            percent = Math.max(Math.min(percent, 1), 0);
            if (fieldName === "rotation") {
                quat.slerp(this[fieldName], start[fieldName], end[fieldName], percent);
            } else {
                vec3.lerp(this[fieldName], start[fieldName], end[fieldName], percent);
            }
        } else {
            this._cacheKey = 0;
            this._cacheTime = 0;
        }
    }

    TransformClip.prototype.blend1D = function(c1, c2, w) {
        vec3.lerp(this.position, c1.position, c2.position, w);
        vec3.lerp(this.scale, c1.scale, c2.scale, w);
        quat.slerp(this.rotation, c1.rotation, c2.rotation, w);
    }

    TransformClip.prototype.blend2D = (function() {
        var q1 = quat.create();
        var q2 = quat.create();
        return function(c1, c2, c3, f, g) {
            var a = 1 - f - g;

            this.position[0] = c1.position[0] * a + c2.position[0] * f + c3.position[0] * g;
            this.position[1] = c1.position[1] * a + c2.position[1] * f + c3.position[1] * g;
            this.position[2] = c1.position[2] * a + c2.position[2] * f + c3.position[2] * g;

            this.scale[0] = c1.scale[0] * a + c2.scale[0] * f + c3.scale[0] * g;
            this.scale[1] = c1.scale[1] * a + c2.scale[1] * f + c3.scale[1] * g;
            this.scale[2] = c1.scale[2] * a + c2.scale[2] * f + c3.scale[2] * g;

            // http://msdn.microsoft.com/en-us/library/windows/desktop/bb205403(v=vs.85).aspx
            // http://msdn.microsoft.com/en-us/library/windows/desktop/microsoft.directx_sdk.quaternion.xmquaternionbarycentric(v=vs.85).aspx
            var s = f + g;
            if (s === 0) {
                quat.copy(this.rotation, c1.rotation);
            } else {
                quat.slerp(q1, c1.rotation, c2.rotation, s);
                quat.slerp(q2, c1.rotation, c3.rotation, s);
                quat.slerp(this.rotation, q1, q2, g / s);
            }
        }
    })(),

    TransformClip.prototype.additiveBlend = function(c1, c2) {
        vec3.add(this.position, c1.position, c2.position);
        vec3.add(this.scale, c1.scale, c2.scale);
        quat.multiply(this.rotation, c2.rotation, c1.rotation);
    }

    TransformClip.prototype.subtractiveBlend = function(c1, c2) {
        vec3.sub(this.position, c1.position, c2.position);
        vec3.sub(this.scale, c1.scale, c2.scale);
        quat.invert(this.rotation, c2.rotation);
        quat.multiply(this.rotation, this.rotation, c1.rotation);
    }

    TransformClip.prototype.getSubClip = function(startTime, endTime) {
        // TODO
        console.warn('TODO');
    }

    return TransformClip;
});
// Sampler clip is especially for the animation sampler in glTF
// Use Typed Array can reduce a lot of heap memory
define('qtek/animation/SamplerClip',['require','./Clip','./TransformClip','glmatrix'],function(require) {

    

    var Clip = require('./Clip');
    var TransformClip = require('./TransformClip');

    var glMatrix = require("glmatrix");
    var quat = glMatrix.quat;
    var vec3 = glMatrix.vec3;

    // lerp function with offset in large array
    function vec3lerp(out, a, b, t, oa, ob) {
        var ax = a[oa];
        var ay = a[oa + 1];
        var az = a[oa + 2];
        out[0] = ax + t * (b[ob] - ax);
        out[1] = ay + t * (b[ob + 1] - ay);
        out[2] = az + t * (b[ob + 2] - az);

        return out;
    }

    function quatSlerp(out, a, b, t, oa, ob) {
        // benchmarks:
        //    http://jsperf.com/quaternion-slerp-implementations

        var ax = a[0 + oa], ay = a[1 + oa], az = a[2 + oa], aw = a[3 + oa],
            bx = b[0 + ob], by = b[1 + ob], bz = b[2 + ob], bw = b[3 + ob];

        var omega, cosom, sinom, scale0, scale1;

        // calc cosine
        cosom = ax * bx + ay * by + az * bz + aw * bw;
        // adjust signs (if necessary)
        if (cosom < 0.0) {
            cosom = -cosom;
            bx = - bx;
            by = - by;
            bz = - bz;
            bw = - bw;
        }
        // calculate coefficients
        if ((1.0 - cosom) > 0.000001) {
            // standard case (slerp)
            omega  = Math.acos(cosom);
            sinom  = Math.sin(omega);
            scale0 = Math.sin((1.0 - t) * omega) / sinom;
            scale1 = Math.sin(t * omega) / sinom;
        } else {        
            // "from" and "to" quaternions are very close 
            //  ... so we can do a linear interpolation
            scale0 = 1.0 - t;
            scale1 = t;
        }
        // calculate final values
        out[0] = scale0 * ax + scale1 * bx;
        out[1] = scale0 * ay + scale1 * by;
        out[2] = scale0 * az + scale1 * bz;
        out[3] = scale0 * aw + scale1 * bw;
        
        return out;
    };

    var SamplerClip = function(options) {

        options = options || {};

        this.name = options.name || '';

        Clip.call(this, options);

        this.position = vec3.create();
        this.rotation = quat.create();
        this.scale = vec3.fromValues(1, 1, 1);

        this.channels = {
            time : null,
            position : null,
            rotation : null,
            scale : null
        }

        this._cacheKey = 0;
        this._cacheTime = 0;
    }

    SamplerClip.prototype = Object.create(Clip.prototype);

    SamplerClip.prototype.constructor = SamplerClip;

    SamplerClip.prototype.step = function(time) {

        var ret = Clip.prototype.step.call(this, time);

        if (ret !== 'destroy') {
            this.setTime(this._elapsedTime);
        }

        return ret;
    }

    SamplerClip.prototype.setTime = function(time) {
        if (!this.channels.time) {
            return;
        }
        var channels = this.channels;
        var len = channels.time.length;
        var key = -1;
        if (time < this._cacheTime) {
            var s = Math.min(len-2, this._cacheKey);
            for (var i = s; i >= 0; i--) {
                if (channels.time[i-1] <= time && channels.time[i] > time) {
                    key = i - 1;
                    break;
                }
            }
        } else {
            for (var i = this._cacheKey; i < len-1; i++) {
                if (channels.time[i] <= time && channels.time[i+1] > time) {
                    key = i;
                    break;
                }
            }
        }

        if (key > -1) {
            this._cacheKey = i;
            this._cacheTime = time;
            var start = key;
            var end = key+1;
            var startTime = channels.time[start];
            var endTime = channels.time[end];
            var percent = (time-startTime) / (endTime-startTime);

            if (channels.rotation) {
                quatSlerp(this.rotation, channels.rotation, channels.rotation, percent, start * 4, end * 4);
            }
            if (channels.position) {
                vec3lerp(this.position, channels.position, channels.position, percent, start * 3, end * 3);
            }
            if (channels.scale) {
                vec3lerp(this.scale, channels.scale, channels.scale, percent, start * 3, end * 3);
            }
        }
        // Loop handling
        if (key == len - 2) {
            this._cacheKey = 0;
            this._cacheTime = 0;
        }
    }

    SamplerClip.prototype.getSubClip = function(startTime, endTime) {

        var subClip = new SamplerClip({
            name : this.name
        });
        var minTime = this.channels.time[0];
        startTime = Math.min(Math.max(startTime, minTime), this.life);
        endTime = Math.min(Math.max(endTime, minTime), this.life);
            
        var rangeStart = this._findRange(startTime);
        var rangeEnd = this._findRange(endTime);

        var count = rangeEnd[0] - rangeStart[0] + 1;
        if (rangeStart[1] === 0 && rangeEnd[1] === 0) {
            count -= 1;
        }
        if (this.channels.rotation) {
            subClip.channels.rotation = new Float32Array(count * 4);
        }
        if (this.channels.position) {
            subClip.channels.position = new Float32Array(count * 3);
        }
        if (this.channels.scale) {
            subClip.channels.scale = new Float32Array(count * 3);
        }
        if (this.channels.time) {
            subClip.channels.time = new Float32Array(count);
        }
        // Clip at the start
        this.setTime(startTime);
        for (var i = 0; i < 3; i++) {
            subClip.channels.rotation[i] = this.rotation[i];
            subClip.channels.position[i] = this.position[i];
            subClip.channels.scale[i] = this.scale[i];
        }
        subClip.channels.time[0] = 0;
        subClip.channels.rotation[3] = this.rotation[3];

        for (var i = 1; i < count-1; i++) {
            for (var j = 0; j < 3; j++) {
                var i2 = rangeStart[0] + i;
                subClip.channels.rotation[i * 4 + j] = this.channels.rotation[i2 * 4 + j];
                subClip.channels.position[i * 3 + j] = this.channels.position[i2 * 3 + j];
                subClip.channels.scale[i * 3 + j] = this.channels.scale[i2 * 3 + j];
            }   
            subClip.channels.time[i] = this.channels.time[i2] - startTime;
            subClip.channels.rotation[i * 4 + 3] = this.channels.rotation[i2 * 4 + 3];
        }
        // Clip at the end
        this.setTime(endTime);
        for (var i = 0; i < 3; i++) {
            subClip.channels.rotation[(count - 1) * 4 + i] = this.rotation[i];
            subClip.channels.position[(count - 1) * 3 + i] = this.position[i];
            subClip.channels.scale[(count - 1) * 3 + i] = this.scale[i];
        }
        subClip.channels.time[(count - 1)] = endTime - startTime;
        subClip.channels.rotation[(count - 1) * 4 + 3] = this.rotation[3];

        // TODO set back ?
        subClip.life = endTime - startTime;
        return subClip;
    },

    SamplerClip.prototype._findRange = function(time) {
        var channels = this.channels;
        var len = channels.time.length;
        var start = -1;
        for (var i = 0; i < len - 1; i++) {
            if (channels.time[i] <= time && channels.time[i+1] > time) {
                start = i;
            }
        }
        var percent = 0;
        if (start >= 0) {
            var startTime = channels.time[start];
            var endTime = channels.time[start+1];
            var percent = (time-startTime) / (endTime-startTime);
        }
        // Percent [0, 1)
        return [start, percent];
    }

    SamplerClip.prototype.blend1D = TransformClip.prototype.blend1D;
    SamplerClip.prototype.blend2D = TransformClip.prototype.blend2D;
    SamplerClip.prototype.additiveBlend = TransformClip.prototype.additiveBlend;
    SamplerClip.prototype.subtractiveBlend = TransformClip.prototype.subtractiveBlend;

    return SamplerClip;
});
define('qtek/animation/SkinningClip',['require','./Clip','./TransformClip','glmatrix'],function(require) {

    

    var Clip = require('./Clip');

    var TransformClip = require('./TransformClip');

    var glMatrix = require("glmatrix");
    var quat = glMatrix.quat;
    var vec3 = glMatrix.vec3;

    var SkinningClip = function(options) {

        options = options || {};

        this.name = options.name || '';

        Clip.call(this, options);

        this.jointClips = [];

        this.life = 0;
        if (options.jointClips && options.jointClips.length > 0) {    
            for (var j = 0; j < options.jointClips.length; j++) {
                var jointPoseCfg = options.jointClips[j];
                var jointClip = new TransformClip({
                    keyFrames : jointPoseCfg.keyFrames
                });
                jointClip.name = jointPoseCfg.name || '';
                this.jointClips[j] = jointClip;

                this.life = Math.max(jointClip.life, this.life);
            }
        }
    }

    SkinningClip.prototype = Object.create(Clip.prototype);

    SkinningClip.prototype.constructor = SkinningClip;

    SkinningClip.prototype.step = function(time) {

        var ret = Clip.prototype.step.call(this, time);

        if (ret !== 'destroy') {
            this.setTime(this._elapsedTime);
        }

        return ret;
    }

    SkinningClip.prototype.setTime = function(time) {
        for (var i = 0; i < this.jointClips.length; i++) {
            this.jointClips[i].setTime(time);
        }
    }

    SkinningClip.prototype.addJointClip = function(jointClip) {
        this.jointClips.push(jointClip);
        this.life = Math.max(jointClip.life, this.life);
    }

    SkinningClip.prototype.removeJointClip = function(jointClip) {
        this.jointClips.splice(this.jointClips.indexOf(jointClip), 1);
    }

    SkinningClip.prototype.getSubClip = function(startTime, endTime, isLoop) {
        var subClip = new SkinningClip({
            name : this.name
        });

        for (var i = 0; i < this.jointClips.length; i++) {
            var subJointClip = this.jointClips[i].getSubClip(startTime, endTime);
            subClip.addJointClip(subJointClip);
        }

        if (isLoop !== undefined) {
            subClip.setLoop(isLoop);
        }

        return subClip; 
    }

    SkinningClip.prototype.blend1D = function(clip1, clip2, w) {
        for (var i = 0; i < this.jointClips.length; i++) {
            var c1 = clip1.jointClips[i];
            var c2 = clip2.jointClips[i];
            var tClip = this.jointClips[i];

            tClip.blend1D(c1, c2, w);
        }
    }

    SkinningClip.prototype.additiveBlend = function(clip1, clip2) {
        for (var i = 0; i < this.jointClips.length; i++) {
            var c1 = clip1.jointClips[i];
            var c2 = clip2.jointClips[i];
            var tClip = this.jointClips[i];

            tClip.additiveBlend(c1, c2);
        }
    }

    SkinningClip.prototype.subtractiveBlend = function(clip1, clip2) {
        for (var i = 0; i < this.jointClips.length; i++) {
            var c1 = clip1.jointClips[i];
            var c2 = clip2.jointClips[i];
            var tClip = this.jointClips[i];

            tClip.subtractiveBlend(c1, c2);
        }
    }

    SkinningClip.prototype.blend2D = function(clip1, clip2, clip3, f, g) {
        for (var i = 0; i < this.jointClips.length; i++) {
            var c1 = clip1.jointClips[i];
            var c2 = clip2.jointClips[i];
            var c3 = clip3.jointClips[i];
            var tClip = this.jointClips[i];

            tClip.blend2D(c1, c2, c3, f, g);
        }
    }

    SkinningClip.prototype.copy = function(clip) {
        for (var i = 0; i < this.jointClips.length; i++) {
            var sClip = clip.jointClips[i];
            var tClip = this.jointClips[i];

            vec3.copy(tClip.position, sClip.position);
            vec3.copy(tClip.scale, sClip.scale);
            quat.copy(tClip.rotation, sClip.rotation);
        }
    }

    return SkinningClip;
});
/**
 *  @export{object} request
 */
define('qtek/core/request',['require'],function(require) {

    function get(options) {

        var xhr = new XMLHttpRequest();

        xhr.open("get", options.url);
        // With response type set browser can get and put binary data
        // https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest/Sending_and_Receiving_Binary_Data
        // Default is text, and it can be set
        // arraybuffer, blob, document, json, text
        xhr.responseType = options.responseType || "text";

        if (options.onprogress) {
            //https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest/Using_XMLHttpRequest
            xhr.onprogress = function(e) {
                if (e.lengthComputable) {
                    var percent = e.loaded / e.total;
                    options.onprogress(percent, e.loaded, e.total);
                } else {
                    options.onprogress(null);
                }
            }
        }
        xhr.onload = function(e) {
            options.onload && options.onload(xhr.response);
        }
        if (options.onerror) {
            xhr.onerror = options.onerror;
        }
        xhr.send(null);
    }

    return {
        get : get
    }
});
define('qtek/async/Task',['require','../core/mixin/notifier','../core/request','../core/util'],function(require) {

    var notifier = require('../core/mixin/notifier');
    var request = require('../core/request');
    var util  = require('../core/util');
    
    var Task = function() {
        this._fullfilled = false;
        this._rejected = false;
    }
    Task.prototype.resolve = function(data) {
        this._fullfilled = true;
        this._rejected = false;
        this.trigger('success', data);
    }
    Task.prototype.reject = function(err) {
        this._rejected = true;
        this._fullfilled = false;
        this.trigger('error', err);
    }
    Task.prototype.isFullfilled = function() {
        return this._fullfilled;
    }
    Task.prototype.isRejected = function() {
        return this._rejected;
    }
    Task.prototype.isSettled = function() {
        return this._fullfilled || this._rejected;
    }
    
    util.extend(Task.prototype, notifier);

    function makeRequestTask(url, responseType) {
        var task = new Task();
        request.get({
            url : url,
            responseType : responseType,
            onload : function(res) {
                task.resolve(res);
            },
            onerror : function() {
                self.reject(error);
            }
        });
        return task;
    };

    Task.makeRequestTask = function(url, responseType) {
        var self = this;
        if (typeof url === 'string') {
            return makeRequestTask(url, responseType);
        } else if (url.url) {   //  Configure object
            var obj = url;
            return makeRequestTask(obj.url, obj.responseType);
        } else if (url instanceof Array) {  // Url list
            var count = 0;
            var urlList = url;
            var tasks = [];
            urlList.forEach(function(obj) {
                var url, responseType;
                if (typeof obj === 'string') {
                    url = obj;
                } else if (Object(obj) === obj) {
                    url = obj.url;
                    responseType = obj.responseType;
                }
                tasks.push(makeRequestTask(url, responseType));
            });
            return tasks;
        }
    }

    Task.makeTask = function(obj) {
        return new Task(obj);
    }

    util.extend(Task.prototype, notifier);

    return Task;
});
define('qtek/async/TaskGroup',['require','../core/util','./Task'],function(require) {

    var util  = require('../core/util');
    var Task = require('./Task');

    var TaskGroup = function() {

        Task.apply(this, arguments);

        this._tasks = [];

        this._fulfilledNumber = 0;

        this._rejectedNumber = 0;
    };

    var Ctor = function(){};
    Ctor.prototype = Task.prototype;
    TaskGroup.prototype = new Ctor();

    TaskGroup.prototype.constructor = TaskGroup;

    TaskGroup.prototype.all = function(tasks) {
        var count = tasks.length;
        var self = this;
        var data = [];
        if (tasks.length == 0) {
            setTimeout(function() {
                self.resolve(data);
            });
            return;
        }
        this._tasks = tasks;
        this._fulfilledNumber = 0;
        this._rejectedNumber = 0;

        util.each(tasks, function(task, idx) {
            task.once('success', function(res) {
                count--;

                self._fulfilledNumber++;
                // TODO
                // Some tasks like texture, loader are not inherited from task
                // We need to set the deferred status here
                task._fulfilled = true;
                task._rejected = false;

                data[idx] = res;
                if (count === 0) {
                    self.resolve(data);
                }
            });
            task.once('error', function() {
                
                self._rejectedNumber ++;

                task._fulfilled = false;
                task._rejected = true;

                self.reject(task);
            });
        });
        return this;
    };

    TaskGroup.prototype.allSettled = function(tasks) {
        var count = tasks.length;
        var success = false;
        var self = this;
        var data = [];
        if (tasks.length == 0) {
            setTimeout(function() {
                self.trigger('success', data);
            });
            return;
        }
        this._tasks = tasks;

        util.each(tasks, function(task, idx) {
            task.once('success', function(res) {
                count--;
                
                self._fulfilledNumber++;

                task._fulfilled = true;
                task._rejected = false;

                data[idx] = res;
                success = true;
                if (count === 0) {
                    self.resolve(data);
                }
            });
            task.once('error', function(err) {
                count--;

                self._rejectedNumber++;

                task._fulfilled = false;
                task._rejected = true;

                // TODO 
                data[idx] = null;
                if (count === 0) {
                    if (success) {
                        self.resolve(data);
                    } else {
                        self.reject(data);
                    }
                }
            });
        });
        return this;
    }

    TaskGroup.prototype.getFulfilledNumber = function(recursive) {
        if (recursive) {
            var nFulfilled = 0;
            for (var i = 0; i < this._tasks.length; i++) {
                var task = this._tasks[i];
                if (task instanceof TaskGroup) {
                    nFulfilled += task.getFulfilledNumber(recursive);
                } else if(task._fulfilled) {
                    nFulfilled += 1;
                }
            }
            return nFulfilled;
        } else {
            return this._fulfilledNumber;
        }
    }

    TaskGroup.prototype.getRejectedNumber = function(recursive) {
        if (recursive) {
            var nRejected = 0;
            for (var i = 0; i < this._tasks.length; i++) {
                var task = this._tasks[i];
                if (task instanceof TaskGroup) {
                    nRejected += task.getRejectedNumber(recursive);
                } else if(task._rejected) {
                    nRejected += 1;
                }
            }
            return nRejected;
        } else {
            return this._rejectedNumber;
        }
    }

    TaskGroup.prototype.getSettledNumber = function(recursive) {

        if (recursive) {
            var nSettled = 0;
            for (var i = 0; i < this._tasks.length; i++) {
                var task = this._tasks[i];
                if (task instanceof TaskGroup) {
                    nSettled += task.getSettledNumber(recursive);
                } else if(task._rejected || task._fulfilled) {
                    nSettled += 1;
                }
            }
            return nSettled;
        } else {
            return this._fulfilledNumber + this._rejectedNumber;
        }
    }

    TaskGroup.prototype.getTaskNumber = function(recursive) {
        if (recursive) {
            var nTask = 0;
            for (var i = 0; i < this._tasks.length; i++) {
                var task = this._tasks[i];
                if (task instanceof TaskGroup) {
                    nTask += task.getTaskNumber(recursive);
                } else {
                    nTask += 1;
                }
            }
            return nTask;
        } else {
            return this._tasks.length;
        }
    }

    return TaskGroup;
});
define('qtek/camera/Orthographic',['require','../Camera'],function(require) {

    var Camera = require('../Camera');

    var Orthographic = Camera.derive(function() {
        return {
            left : -1,
            right : 1,
            near : -1,
            far : 1,
            top : 1,
            bottom : -1,
        }
    }, {
        
        updateProjectionMatrix : function() {
            this.projectionMatrix.ortho(this.left, this.right, this.bottom, this.top, this.near, this.far);
        }
    });

    return Orthographic;
} );
define('qtek/compositor/Graph',['require','../core/Base'], function( require ) {

    var Base = require("../core/Base");

    var Graph = Base.derive( function() {
        return {
            nodes : []
        }
    }, {
        
        add : function(node) {

            this.nodes.push(node);

            this._dirty = true;
        },

        remove : function(node) {
            this.nodes.splice(this.nodes.indexOf(node), 1);

            this._dirty = true;
        },

        findNode : function(name) {
            for (var i = 0; i < this.nodes.length; i++) {
                if (this.nodes[i].name === name) {
                    return this.nodes[i];
                }
            }
        },

        update : function() {
            for (var i = 0; i < this.nodes.length; i++) {
                this.nodes[i].clear();
            }
            // Traverse all the nodes and build the graph
            for (var i = 0; i < this.nodes.length; i++) {
                var node = this.nodes[i];

                if (!node.inputs) {
                    continue;
                }
                for (var inputName in node.inputs) {
                    var fromPinInfo = node.inputs[inputName];

                    var fromPin = this.findPin(fromPinInfo);
                    if (fromPin) {
                        node.link(inputName, fromPin.node, fromPin.pin);
                    }else{
                        console.warn("Pin of "+fromPinInfo.node+"."+fromPinInfo.pin+" not exist");
                    }
                }
            }
        },

        findPin : function(info) {
            var node;
            if (typeof(info.node) === 'string') {
                for (var i = 0; i < this.nodes.length; i++) {
                    var tmp = this.nodes[i];
                    if (tmp.name === info.node) {
                        node = tmp;
                    }
                }
            }else{
                node = info.node;
            }
            if (node) {
                if (node.outputs[info.pin]) {
                    return {
                        node : node,
                        pin : info.pin
                    }
                }
            }
        },

        fromJSON : function( json ) {

        }
    })
    
    return Graph;
});
define('qtek/compositor/Compositor',['require','./Graph'],function(require){

    

    var Graph = require("./Graph");

    var Compositor = Graph.derive(function() {
        return {
            // Output node
            _outputs : []
        }
    }, {
        add : function(node) {
            Graph.prototype.add.call(this, node);
            if (!node.outputs) {
                this.addOutput(node);
            }
        },

        render : function(renderer) {
            if (this._dirty) {
                this.update();
                this._dirty = false;
            }
            for (var i = 0; i < this.nodes.length; i++) {
                // Update the reference number of each output texture
                this.nodes[i].beforeFrame();
            }

            for (var i = 0; i < this._outputs.length; i++) {
                this._outputs[i].updateReference();
            }
            for (var i = 0; i < this._outputs.length; i++) {
                this._outputs[i].render(renderer);
            }

            for (var i = 0; i < this.nodes.length; i++) {
                // Clear up
                this.nodes[i].afterFrame();
            }
        },

        addOutput : function(node) {
            if (this._outputs.indexOf(node) < 0) {
                this._outputs.push(node);
            }
        },

        removeOutput : function(node) {
            this._outputs.splice(this._outputs.indexOf(node), 1);
        }
    })

    return Compositor;
});
define('qtek/geometry/Plane',['require','../DynamicGeometry','../math/BoundingBox'],function(require) {

    var DynamicGeometry = require('../DynamicGeometry');
    var BoundingBox = require('../math/BoundingBox');

    var Plane = DynamicGeometry.derive(function() {

        return {
            widthSegments : 1,
            heightSegments : 1
        }
    }, function() {

        var heightSegments = this.heightSegments;
        var widthSegments = this.widthSegments;
        var positions = this.attributes.position.value;
        var texcoords = this.attributes.texcoord0.value;
        var normals = this.attributes.normal.value;
        var faces = this.faces;         

        for (var y = 0; y <= heightSegments; y++) {
            var t = y / heightSegments;
            for (var x = 0; x <= widthSegments; x++) {
                var s = x / widthSegments;

                positions.push([2 * s - 1, 2 * t - 1, 0]);
                if (texcoords) {
                    texcoords.push([s, t]);
                }
                if (normals) {
                    normals.push([0, 0, 1]);
                }
                if (x < widthSegments && y < heightSegments) {
                    var i = x + y * (widthSegments + 1);
                    faces.push([i, i + 1, i + widthSegments + 1]);
                    faces.push([i + widthSegments + 1, i + 1, i + widthSegments + 2]);
                }
            }
        }

        this.boundingBox = new BoundingBox();
        this.boundingBox.min.set(-1, -1, 0);
        this.boundingBox.max.set(1, 1, 0);
    })

    return Plane;
});
define('qtek/compositor/shaders/vertex.essl',[],function () { return 'uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n\n    v_Texcoord = texcoord;\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n}';});

define('qtek/compositor/shaders/coloradjust.essl',[],function () { return '@export buildin.compositor.coloradjust\n\nvarying vec2 v_Texcoord;\nuniform sampler2D texture;\n\nuniform float brightness : 0.0;\nuniform float contrast : 1.0;\nuniform float exposure : 0.0;\nuniform float gamma : 1.0;\nuniform float saturation : 1.0;\n\n// Values from "Graphics Shaders: Theory and Practice" by Bailey and Cunningham\nconst vec3 w = vec3(0.2125, 0.7154, 0.0721);\n\nvoid main()\n{\n    vec4 tex = texture2D( texture, v_Texcoord);\n\n    // brightness\n    vec3 color = clamp(tex.rgb + vec3(brightness), 0.0, 1.0);\n    // contrast\n    color = clamp( (color-vec3(0.5))*contrast+vec3(0.5), 0.0, 1.0);\n    // exposure\n    color = clamp( color * pow(2.0, exposure), 0.0, 1.0);\n    // gamma\n    color = clamp( pow(color, vec3(gamma)), 0.0, 1.0);\n    // saturation\n    float luminance = dot( color, w );\n    color = mix(vec3(luminance), color, saturation);\n    \n    gl_FragColor = vec4(color, tex.a);\n}\n\n@end\n\n// Seperate shader for float texture\n@export buildin.compositor.brightness\nvarying vec2 v_Texcoord;\nuniform sampler2D texture;\n\nuniform float brightness : 0.0;\n\nvoid main()\n{\n    vec4 tex = texture2D( texture, v_Texcoord);\n    vec3 color = tex.rgb + vec3(brightness);\n    gl_FragColor = vec4(color, tex.a);\n}\n@end\n\n@export buildin.compositor.contrast\nvarying vec2 v_Texcoord;\nuniform sampler2D texture;\n\nuniform float contrast : 1.0;\n\nvoid main()\n{\n    vec4 tex = texture2D( texture, v_Texcoord);\n    vec3 color = (tex.rgb-vec3(0.5))*contrast+vec3(0.5);\n    gl_FragColor = vec4(color, tex.a);\n}\n@end\n\n@export buildin.compositor.exposure\nvarying vec2 v_Texcoord;\nuniform sampler2D texture;\n\nuniform float exposure : 0.0;\n\nvoid main()\n{\n    vec4 tex = texture2D(texture, v_Texcoord);\n    vec3 color = tex.rgb * pow(2.0, exposure);\n    gl_FragColor = vec4(color, tex.a);\n}\n@end\n\n@export buildin.compositor.gamma\nvarying vec2 v_Texcoord;\nuniform sampler2D texture;\n\nuniform float gamma : 1.0;\n\nvoid main()\n{\n    vec4 tex = texture2D(texture, v_Texcoord);\n    vec3 color = pow(tex.rgb, vec3(gamma));\n    gl_FragColor = vec4(color, tex.a);\n}\n@end\n\n@export buildin.compositor.saturation\nvarying vec2 v_Texcoord;\nuniform sampler2D texture;\n\nuniform float saturation : 1.0;\n\nconst vec3 w = vec3(0.2125, 0.7154, 0.0721);\n\nvoid main()\n{\n    vec4 tex = texture2D(texture, v_Texcoord);\n    vec3 color = tex.rgb;\n    float luminance = dot(color, w);\n    color = mix(vec3(luminance), color, saturation);\n    gl_FragColor = vec4(color, tex.a);\n}\n@end';});

define('qtek/compositor/shaders/blur.essl',[],function () { return '@export buildin.compositor.gaussian_blur_h\n\nuniform sampler2D texture; // the texture with the scene you want to blur\nvarying vec2 v_Texcoord;\n \nuniform float blurSize : 2.0; \nuniform float textureWidth : 512.0;\n\nvoid main(void)\n{\n   vec4 sum = vec4(0.0);\n   float blurOffset = blurSize / textureWidth;\n   // blur in y (vertical)\n   // take nine samples, with the distance blurSize between them\n   sum += texture2D(texture, vec2(max(v_Texcoord.x - 4.0*blurOffset, 0.0), v_Texcoord.y)) * 0.05;\n   sum += texture2D(texture, vec2(max(v_Texcoord.x - 3.0*blurOffset, 0.0), v_Texcoord.y)) * 0.09;\n   sum += texture2D(texture, vec2(max(v_Texcoord.x - 2.0*blurOffset, 0.0), v_Texcoord.y)) * 0.12;\n   sum += texture2D(texture, vec2(max(v_Texcoord.x - blurOffset, 0.0), v_Texcoord.y)) * 0.15;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y)) * 0.18;\n   sum += texture2D(texture, vec2(min(v_Texcoord.x + blurOffset, 1.0), v_Texcoord.y)) * 0.15;\n   sum += texture2D(texture, vec2(min(v_Texcoord.x + 2.0*blurOffset, 1.0), v_Texcoord.y)) * 0.12;\n   sum += texture2D(texture, vec2(min(v_Texcoord.x + 3.0*blurOffset, 1.0), v_Texcoord.y)) * 0.09;\n   sum += texture2D(texture, vec2(min(v_Texcoord.x + 4.0*blurOffset, 1.0), v_Texcoord.y)) * 0.05;\n \n   gl_FragColor = sum;\n}\n\n@end\n\n@export buildin.compositor.gaussian_blur_v\n\nuniform sampler2D texture;\nvarying vec2 v_Texcoord;\n \nuniform float blurSize : 2.0;\nuniform float textureHeight : 512.0;\n \nvoid main(void)\n{\n   vec4 sum = vec4(0.0);\n   float blurOffset = blurSize / textureHeight;\n   // blur in y (vertical)\n   // take nine samples, with the distance blurSize between them\n   sum += texture2D(texture, vec2(v_Texcoord.x, max(v_Texcoord.y - 4.0*blurOffset, 0.0))) * 0.05;\n   sum += texture2D(texture, vec2(v_Texcoord.x, max(v_Texcoord.y - 3.0*blurOffset, 0.0))) * 0.09;\n   sum += texture2D(texture, vec2(v_Texcoord.x, max(v_Texcoord.y - 2.0*blurOffset, 0.0))) * 0.12;\n   sum += texture2D(texture, vec2(v_Texcoord.x, max(v_Texcoord.y - blurOffset, 0.0))) * 0.15;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y)) * 0.18;\n   sum += texture2D(texture, vec2(v_Texcoord.x, min(v_Texcoord.y + blurOffset, 1.0))) * 0.15;\n   sum += texture2D(texture, vec2(v_Texcoord.x, min(v_Texcoord.y + 2.0*blurOffset, 1.0))) * 0.12;\n   sum += texture2D(texture, vec2(v_Texcoord.x, min(v_Texcoord.y + 3.0*blurOffset, 1.0))) * 0.09;\n   sum += texture2D(texture, vec2(v_Texcoord.x, min(v_Texcoord.y + 4.0*blurOffset, 1.0))) * 0.05;\n \n   gl_FragColor = sum;\n}\n\n@end\n\n@export buildin.compositor.box_blur\n\nuniform sampler2D texture;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 3.0;\nuniform vec2 textureSize : [512.0, 512.0];\n\nvoid main(void){\n\n   vec4 tex = texture2D(texture, v_Texcoord);\n   vec2 offset = blurSize / textureSize;\n\n   tex += texture2D(texture, v_Texcoord + vec2(offset.x, 0.0) );\n   tex += texture2D(texture, v_Texcoord + vec2(offset.x, offset.y) );\n   tex += texture2D(texture, v_Texcoord + vec2(-offset.x, offset.y) );\n   tex += texture2D(texture, v_Texcoord + vec2(0.0, offset.y) );\n   tex += texture2D(texture, v_Texcoord + vec2(-offset.x, 0.0) );\n   tex += texture2D(texture, v_Texcoord + vec2(-offset.x, -offset.y) );\n   tex += texture2D(texture, v_Texcoord + vec2(offset.x, -offset.y) );\n   tex += texture2D(texture, v_Texcoord + vec2(0.0, -offset.y) );\n\n   tex /= 9.0;\n\n   gl_FragColor = tex;\n}\n\n@end\n\n// http://www.slideshare.net/DICEStudio/five-rendering-ideas-from-battlefield-3-need-for-speed-the-run\n@export buildin.compositor.hexagonal_blur_mrt_1\n\n// MRT in chrome\n// https://www.khronos.org/registry/webgl/sdk/tests/conformance/extensions/webgl-draw-buffers.html\n#extension GL_EXT_draw_buffers : require\n\nuniform sampler2D texture;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 2.0;\n\nuniform vec2 textureSize : [512.0, 512.0];\n\nvoid main(void){\n   vec2 offset = blurSize / textureSize;\n\n   vec4 color = vec4(0.0);\n   // Top\n   for(int i = 0; i < 10; i++){\n      color += 1.0/10.0 * texture2D(texture, v_Texcoord + vec2(0.0, offset.y * float(i)) );\n   }\n   gl_FragData[0] = color;\n   vec4 color2 = vec4(0.0);\n   // Down left\n   for(int i = 0; i < 10; i++){\n      color2 += 1.0/10.0 * texture2D(texture, v_Texcoord - vec2(offset.x * float(i), offset.y * float(i)) );\n   }\n   gl_FragData[1] = (color + color2) / 2.0;\n}\n\n@end\n\n@export buildin.compositor.hexagonal_blur_mrt_2\n\nuniform sampler2D texture0;\nuniform sampler2D texture1;\n\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 2.0;\n\nuniform vec2 textureSize : [512.0, 512.0];\n\nvoid main(void){\n   vec2 offset = blurSize / textureSize;\n\n   vec4 color1 = vec4(0.0);\n   // Down left\n   for(int i = 0; i < 10; i++){\n      color1 += 1.0/10.0 * texture2D(texture0, v_Texcoord - vec2(offset.x * float(i), offset.y * float(i)) );\n   }\n   vec4 color2 = vec4(0.0);\n   // Down right\n   for(int i = 0; i < 10; i++){\n      color2 += 1.0/10.0 * texture2D(texture1, v_Texcoord + vec2(offset.x * float(i), -offset.y * float(i)) );\n   }\n\n   gl_FragColor = (color1 + color2) / 2.0;\n}\n\n@end\n\n\n@export buildin.compositor.hexagonal_blur_1\n\nuniform sampler2D texture;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 1.0;\n\nuniform vec2 textureSize : [512.0, 512.0];\n\nvoid main(void){\n   vec2 offset = blurSize / textureSize;\n\n   vec4 color = vec4(0.0);\n   // Top\n   for(int i = 0; i < 10; i++){\n      color += 1.0/10.0 * texture2D(texture, v_Texcoord + vec2(0.0, offset.y * float(i)) );\n   }\n   gl_FragColor = color;\n}\n\n@end\n\n@export buildin.compositor.hexagonal_blur_2\n\nuniform sampler2D texture;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 1.0;\n\nuniform vec2 textureSize : [512.0, 512.0];\n\nvoid main(void){\n   vec2 offset = blurSize / textureSize;\n\n   vec4 color = vec4(0.0);\n   // Down left\n   for(int i = 0; i < 10; i++){\n      color += 1.0/10.0 * texture2D(texture, v_Texcoord - vec2(offset.x * float(i), offset.y * float(i)) );\n   }\n   gl_FragColor = color;\n}\n@end\n\n@export buildin.compositor.hexagonal_blur_3\n\nuniform sampler2D texture1;\nuniform sampler2D texture2;\n\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 1.0;\n\nuniform vec2 textureSize : [512.0, 512.0];\n\nvoid main(void){\n   vec2 offset = blurSize / textureSize;\n\n   vec4 color1 = vec4(0.0);\n   // Down left\n   for(int i = 0; i < 10; i++){\n      color1 += 1.0/10.0 * texture2D(texture1, v_Texcoord - vec2(offset.x * float(i), offset.y * float(i)) );\n   }\n   vec4 color2 = vec4(0.0);\n   // Down right\n   for(int i = 0; i < 10; i++){\n      color2 += 1.0/10.0 * texture2D(texture1, v_Texcoord + vec2(offset.x * float(i), -offset.y * float(i)) );\n   }\n\n   vec4 color3 = vec4(0.0);\n   // Down right\n   for(int i = 0; i < 10; i++){\n      color3 += 1.0/10.0 * texture2D(texture2, v_Texcoord + vec2(offset.x * float(i), -offset.y * float(i)) );\n   }\n\n   gl_FragColor = (color1 + color2 + color3) / 3.0;\n}\n\n@end';});

define('qtek/compositor/shaders/lum.essl',[],function () { return '\n@export buildin.compositor.lum\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\n\nconst vec3 w = vec3(0.2125, 0.7154, 0.0721);\n\nvoid main()\n{\n    vec4 tex = texture2D( texture, v_Texcoord );\n    float luminance = dot(tex.rgb, w);\n\n    gl_FragColor = vec4(vec3(luminance), 1.0);\n}\n\n@end';});

define('qtek/compositor/shaders/lut.essl',[],function () { return '\n// https://github.com/BradLarson/GPUImage?source=c\n@export buildin.compositor.lut\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\nuniform sampler2D lookup;\n\nvoid main()\n{\n    vec4 tex = texture2D(texture, v_Texcoord);\n\n    float blueColor = tex.b * 63.0;\n    \n    vec2 quad1;\n    quad1.y = floor(floor(blueColor) / 8.0);\n    quad1.x = floor(blueColor) - (quad1.y * 8.0);\n    \n    vec2 quad2;\n    quad2.y = floor(ceil(blueColor) / 8.0);\n    quad2.x = ceil(blueColor) - (quad2.y * 8.0);\n    \n    vec2 texPos1;\n    texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.r);\n    texPos1.y = (quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.g);\n    \n    vec2 texPos2;\n    texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.r);\n    texPos2.y = (quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.g);\n    \n    vec4 newColor1 = texture2D(lookup, texPos1);\n    vec4 newColor2 = texture2D(lookup, texPos2);\n    \n    vec4 newColor = mix(newColor1, newColor2, fract(blueColor));\n    gl_FragColor = vec4(newColor.rgb, tex.w);\n}\n\n@end';});

define('qtek/compositor/shaders/output.essl',[],function () { return '@export buildin.compositor.output\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\n\nvoid main()\n{\n    vec3 tex = texture2D( texture, v_Texcoord ).rgb;\n\n    gl_FragColor = vec4(tex, 1.0);\n}\n\n@end';});

define('qtek/compositor/shaders/hdr.essl',[],function () { return '// HDR Pipeline\n@export buildin.compositor.hdr.bright\n\nuniform sampler2D texture;\nuniform float threshold : 1;\nuniform float scale : 1.0;\n\nvarying vec2 v_Texcoord;\n\nconst vec3 lumWeight = vec3(0.2125, 0.7154, 0.0721);\n\n@import buildin.util.rgbm_decode\n@import buildin.util.rgbm_encode\n\nvoid main()\n{\n    #ifdef TEXTURE_ENABLED\n        #ifdef RGBM_DECODE\n            vec3 tex = RGBMDecode(texture2D(texture, v_Texcoord));\n        #else\n            vec3 tex = texture2D(texture, v_Texcoord).rgb;\n        #endif\n    #else\n        vec3 tex = vec3(0.0);\n    #endif\n\n    float lum = dot(tex, lumWeight);\n    if (lum > threshold)\n    {\n        gl_FragColor.rgb = tex * scale;\n    }\n    else\n    {\n        gl_FragColor.rgb = vec3(0.0);\n    }\n    gl_FragColor.a = 1.0;\n\n    #ifdef RGBM_ENCODE\n        gl_FragColor.rgba = RGBMEncode(gl_FragColor.rgb);\n    #endif\n}\n@end\n\n@export buildin.compositor.hdr.log_lum\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\n\nconst vec3 w = vec3(0.2125, 0.7154, 0.0721);\n\nvoid main()\n{\n    vec4 tex = texture2D(texture, v_Texcoord);\n    float luminance = dot(tex.rgb, w);\n    luminance = log(luminance + 0.001);\n\n    gl_FragColor = vec4(vec3(luminance), 1.0);\n}\n\n@end\n\n@export buildin.compositor.hdr.lum_adaption\nvarying vec2 v_Texcoord;\n\nuniform sampler2D adaptedLum;\nuniform sampler2D currentLum;\n\nuniform float frameTime : 0.02;\n\nvoid main()\n{\n    float fAdaptedLum = texture2D(adaptedLum, vec2(0.5, 0.5)).r;\n    float fCurrentLum = exp(texture2D(currentLum, vec2(0.5, 0.5)).r);\n\n    fAdaptedLum += (fCurrentLum - fAdaptedLum) * (1.0 - pow(0.98, 30.0 * frameTime));\n    gl_FragColor.rgb = vec3(fAdaptedLum);\n    gl_FragColor.a = 1.0;\n}\n@end\n\n// Tone mapping with gamma correction\n// http://filmicgames.com/archives/75\n@export buildin.compositor.hdr.tonemapping\n\nuniform sampler2D texture;\nuniform sampler2D bloom;\nuniform sampler2D lensflare;\nuniform sampler2D lum;\n\nuniform float exposure : 1.0;\n\nvarying vec2 v_Texcoord;\n\nconst float A = 0.22;   // Shoulder Strength\nconst float B = 0.30;   // Linear Strength\nconst float C = 0.10;   // Linear Angle\nconst float D = 0.20;   // Toe Strength\nconst float E = 0.01;   // Toe Numerator\nconst float F = 0.30;   // Toe Denominator\nconst vec3 whiteScale = vec3(11.2);\n\nvec3 uncharted2ToneMap(vec3 x)\n{\n    return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;\n}\n\nvec3 filmicToneMap(vec3 color)\n{\n    vec3 x = max(vec3(0.0), color - 0.004);\n    return (x*(6.2*x+0.5))/(x*(6.2*x+1.7)+0.06);\n}\n\nfloat eyeAdaption(float fLum)\n{\n    return mix(0.2, fLum, 0.5);\n}\n\nvoid main()\n{\n    vec3 tex = vec3(0.0);\n    #ifdef TEXTURE_ENABLED\n        tex = texture2D(texture, v_Texcoord).rgb;\n    #endif\n\n    #ifdef BLOOM_ENABLED\n        tex += texture2D(bloom, v_Texcoord).rgb * 0.25;\n    #endif\n\n    #ifdef LENSFLARE_ENABLED\n        tex += texture2D(lensflare, v_Texcoord).rgb;\n    #endif\n\n    // Adjust exposure\n    // From KlayGE\n    #ifdef LUM_ENABLED\n        float fLum = texture2D(lum, vec2(0.5, 0.5)).r;\n        float adaptedLumDest = 3.0 / (max(0.1, 1.0 + 10.0*eyeAdaption(fLum)));\n        float exposureBias = adaptedLumDest * exposure;\n    #else\n        float exposureBias = exposure;\n    #endif\n    tex *= exposureBias;\n\n    // Do tone mapping\n    vec3 color = uncharted2ToneMap(tex) / uncharted2ToneMap(whiteScale);\n    color = pow(color, vec3(1.0/2.2));\n    // vec3 color = filmicToneMap(tex);\n\n    #ifdef RGBM_ENCODE\n        gl_FragColor.rgba = RGBMEncode(color);\n    #else\n        gl_FragColor = vec4(color, 1.0);\n    #endif\n}\n\n@end';});

define('qtek/compositor/shaders/lensflare.essl',[],function () { return '// john-chapman-graphics.blogspot.co.uk/2013/02/pseudo-lens-flare.html\n@export buildin.compositor.lensflare\n\n#define SAMPLE_NUMBER 8\n\nuniform sampler2D texture;\nuniform sampler2D lensColor;\n\nuniform vec2 textureSize : [512, 512];\n\nuniform float dispersal : 0.3;\nuniform float haloWidth : 0.4;\nuniform float distortion : 1.0;\n\nvarying vec2 v_Texcoord;\n\nvec4 textureDistorted(\n    in vec2 texcoord,\n    in vec2 direction,\n    in vec3 distortion\n) {\n    return vec4(\n        texture2D(texture, texcoord + direction * distortion.r).r,\n        texture2D(texture, texcoord + direction * distortion.g).g,\n        texture2D(texture, texcoord + direction * distortion.b).b,\n        1.0\n    );\n}\n\nvoid main()\n{\n    vec2 texcoord = -v_Texcoord + vec2(1.0); // Flip texcoords\n    vec2 textureOffset = 1.0 / textureSize;\n\n    vec2 ghostVec = (vec2(0.5) - texcoord) * dispersal;\n    vec2 haloVec = normalize(ghostVec) * haloWidth;\n\n    vec3 distortion = vec3(-textureOffset.x * distortion, 0.0, textureOffset.x * distortion);\n    //Sample ghost\n    vec4 result = vec4(0.0);\n    for (int i = 0; i < SAMPLE_NUMBER; i++)\n    {\n        vec2 offset = fract(texcoord + ghostVec * float(i));\n\n        float weight = length(vec2(0.5) - offset) / length(vec2(0.5));\n        weight = pow(1.0 - weight, 10.0);\n\n        result += textureDistorted(offset, normalize(ghostVec), distortion) * weight;\n    }\n\n    result *= texture2D(lensColor, vec2(length(vec2(0.5) - texcoord)) / length(vec2(0.5)));\n    //Sample halo\n    float weight = length(vec2(0.5) - fract(texcoord + haloVec)) / length(vec2(0.5));\n    weight = pow(1.0 - weight, 10.0);\n    vec2 offset = fract(texcoord + haloVec);\n    result += textureDistorted(offset, normalize(ghostVec), distortion) * weight;\n\n    gl_FragColor = result;\n}\n@end';});

define('qtek/compositor/shaders/blend.essl',[],function () { return '@export buildin.compositor.blend\n// Blend at most 4 textures\n#ifdef TEXTURE1_ENABLED\nuniform sampler2D texture1;\nuniform float weight1 : 1.0;\n#endif\n#ifdef TEXTURE2_ENABLED\nuniform sampler2D texture2;\nuniform float weight2 : 1.0;\n#endif\n#ifdef TEXTURE3_ENABLED\nuniform sampler2D texture3;\nuniform float weight3 : 1.0;\n#endif\n#ifdef TEXTURE4_ENABLED\nuniform sampler2D texture4;\nuniform float weight4 : 1.0;\n#endif\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n    vec3 tex = vec3(0.0);\n    #ifdef TEXTURE1_ENABLED\n        tex += texture2D(texture1, v_Texcoord).rgb * weight1;\n    #endif\n    #ifdef TEXTURE2_ENABLED\n        tex += texture2D(texture2, v_Texcoord).rgb * weight2;\n    #endif\n    #ifdef TEXTURE3_ENABLED\n        tex += texture2D(texture3, v_Texcoord).rgb * weight3;\n    #endif\n    #ifdef TEXTURE4_ENABLED\n        tex += texture2D(texture4, v_Texcoord).rgb * weight4;\n    #endif\n\n    gl_FragColor = vec4(tex, 1.0);\n}\n@end';});

define('qtek/compositor/shaders/fxaa.essl',[],function () { return '// https://github.com/mitsuhiko/webgl-meincraft/blob/master/assets/shaders/fxaa.glsl\n@export buildin.compositor.fxaa\n\nuniform sampler2D texture;\nuniform vec2 viewportSize : [512, 512];\n\nvarying vec2 v_Texcoord;\n\n#define FXAA_REDUCE_MIN   (1.0/128.0)\n#define FXAA_REDUCE_MUL   (1.0/8.0)\n#define FXAA_SPAN_MAX     8.0\n\nvoid main()\n{\n    vec2 resolution = 1.0 / viewportSize;\n    vec3 rgbNW = texture2D( texture, ( gl_FragCoord.xy + vec2( -1.0, -1.0 ) ) * resolution ).xyz;\n    vec3 rgbNE = texture2D( texture, ( gl_FragCoord.xy + vec2( 1.0, -1.0 ) ) * resolution ).xyz;\n    vec3 rgbSW = texture2D( texture, ( gl_FragCoord.xy + vec2( -1.0, 1.0 ) ) * resolution ).xyz;\n    vec3 rgbSE = texture2D( texture, ( gl_FragCoord.xy + vec2( 1.0, 1.0 ) ) * resolution ).xyz;\n    vec4 rgbaM  = texture2D( texture,  gl_FragCoord.xy  * resolution );\n    vec3 rgbM  = rgbaM.xyz;\n    float opacity  = rgbaM.w;\n\n    vec3 luma = vec3( 0.299, 0.587, 0.114 );\n\n    float lumaNW = dot( rgbNW, luma );\n    float lumaNE = dot( rgbNE, luma );\n    float lumaSW = dot( rgbSW, luma );\n    float lumaSE = dot( rgbSE, luma );\n    float lumaM  = dot( rgbM,  luma );\n    float lumaMin = min( lumaM, min( min( lumaNW, lumaNE ), min( lumaSW, lumaSE ) ) );\n    float lumaMax = max( lumaM, max( max( lumaNW, lumaNE) , max( lumaSW, lumaSE ) ) );\n\n    vec2 dir;\n    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));\n    dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));\n\n    float dirReduce = max( ( lumaNW + lumaNE + lumaSW + lumaSE ) * ( 0.25 * FXAA_REDUCE_MUL ), FXAA_REDUCE_MIN );\n\n    float rcpDirMin = 1.0 / ( min( abs( dir.x ), abs( dir.y ) ) + dirReduce );\n    dir = min( vec2( FXAA_SPAN_MAX,  FXAA_SPAN_MAX),\n          max( vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),\n                dir * rcpDirMin)) * resolution;\n\n    vec3 rgbA = texture2D( texture, gl_FragCoord.xy  * resolution + dir * ( 1.0 / 3.0 - 0.5 ) ).xyz;\n    rgbA += texture2D( texture, gl_FragCoord.xy  * resolution + dir * ( 2.0 / 3.0 - 0.5 ) ).xyz;\n    rgbA *= 0.5;\n\n    vec3 rgbB = texture2D( texture, gl_FragCoord.xy  * resolution + dir * -0.5 ).xyz;\n    rgbB += texture2D( texture, gl_FragCoord.xy  * resolution + dir * 0.5 ).xyz;\n    rgbB *= 0.25;\n    rgbB += rgbA * 0.5;\n\n    float lumaB = dot( rgbB, luma );\n\n    if ( ( lumaB < lumaMin ) || ( lumaB > lumaMax ) )\n    {\n\n        gl_FragColor = vec4( rgbA, opacity );\n\n    } else {\n\n        gl_FragColor = vec4( rgbB, opacity );\n\n    }\n}\n\n@end';});

define('qtek/compositor/Pass',['require','../core/Base','../Scene','../camera/Orthographic','../geometry/Plane','../Shader','../Material','../Mesh','../Scene','./shaders/vertex.essl','../Texture','../core/glinfo','../core/glenum','./shaders/coloradjust.essl','./shaders/blur.essl','./shaders/lum.essl','./shaders/lut.essl','./shaders/output.essl','./shaders/hdr.essl','./shaders/lensflare.essl','./shaders/blend.essl','./shaders/fxaa.essl'],function(require) {

    var Base = require("../core/Base");
    var Scene = require("../Scene");
    var OrthoCamera = require('../camera/Orthographic');
    var Plane = require('../geometry/Plane');
    var Shader = require('../Shader');
    var Material = require('../Material');
    var Mesh = require('../Mesh');
    var Scene = require('../Scene');
    var vertexShaderString = require('./shaders/vertex.essl');
    var Texture = require('../Texture');
    var glinfo = require('../core/glinfo');
    var glenum = require('../core/glenum');

    var planeGeo = new Plane();
    var mesh = new Mesh({
        geometry : planeGeo
    });
    var scene = new Scene();
    var camera = new OrthoCamera();
        
    scene.add(mesh);

    var Pass = Base.derive(function() {
        return {
            // Fragment shader string
            fragment : "",

            outputs : null,

            material : null

        }
    }, function() {

        var shader = new Shader({
            vertex : vertexShaderString,
            fragment : this.fragment
        })
        var material = new Material({
            shader : shader
        });
        shader.enableTexturesAll();

        this.material = material;

    }, {

        setUniform : function(name, value) {
            var uniform = this.material.uniforms[name];
            if (uniform) {
                uniform.value = value;
            }
        },

        getUniform : function(name) {
            var uniform = this.material.uniforms[name];
            if (uniform) {
                return uniform.value;
            }
        },

        attachOutput : function(texture, attachment) {
            if (!this.outputs) {
                this.outputs = {};
            }
            attachment = attachment || glenum.COLOR_ATTACHMENT0;
            this.outputs[attachment] = texture;
        },

        detachOutput : function(texture) {
            for (var attachment in this.outputs) {
                if (this.outputs[attachment] === texture) {
                    this.outputs[attachment] = null;
                }
            }
        },

        bind : function(renderer, frameBuffer) {
            
            if (this.outputs) {
                var haveAttachment = false;
                for (var attachment in this.outputs) {
                    var texture = this.outputs[attachment];
                    if (texture) {
                        haveAttachment = true;
                        frameBuffer.attach(renderer.gl, texture, attachment);
                    }
                }
                if (haveAttachment) {
                    frameBuffer.bind(renderer);
                }
            }
        },

        unbind : function(renderer, frameBuffer) {
            frameBuffer.unbind(renderer);
        },

        render : function(renderer, frameBuffer) {

            var _gl = renderer.gl;

            mesh.material = this.material;

            if (frameBuffer) {
                this.bind(renderer, frameBuffer);
            }

            // MRT Support in chrome
            // https://www.khronos.org/registry/webgl/sdk/tests/conformance/extensions/ext-draw-buffers.html
            var ext = glinfo.getExtension(_gl, "EXT_draw_buffers");
            if (ext) {
                var bufs = [];
                for (var attachment in this.outputs) {
                    attachment = parseInt(attachment);
                    if (attachment >= _gl.COLOR_ATTACHMENT0 && attachment <= _gl.COLOR_ATTACHMENT0 + 8) {
                        bufs.push(attachment);
                    }
                }
                ext.drawBuffersEXT(bufs);
            }

            this.trigger("beforerender", this, renderer);
            renderer.render(scene, camera);
            this.trigger("afterrender", this, renderer);

            if (frameBuffer) {
                this.unbind(renderer, frameBuffer);
            }
        }
    })

    // Some build in shaders
    Shader.import(require('./shaders/coloradjust.essl'));
    Shader.import(require('./shaders/blur.essl'));
    Shader.import(require('./shaders/lum.essl'));
    Shader.import(require('./shaders/lut.essl'));
    Shader.import(require('./shaders/output.essl'));
    Shader.import(require('./shaders/hdr.essl'));
    Shader.import(require('./shaders/lensflare.essl'));
    Shader.import(require('./shaders/blend.essl'));
    Shader.import(require('./shaders/fxaa.essl'));

    return Pass;
});
define('qtek/compositor/texturePool',['require','../texture/Texture2D','../core/glenum','../core/util'],function(require) {
    
    var Texture2D = require('../texture/Texture2D');
    var glenum = require('../core/glenum');
    var util = require('../core/util');

    var pool = {};

    var allocatedTextures = [];

    var texturePool = {

        get : function(parameters) {
            var key = generateKey(parameters);
            if (!pool.hasOwnProperty(key)) {
                pool[key] = [];
            }
            var list = pool[key];
            if (!list.length) {
                var texture = new Texture2D(parameters);
                allocatedTextures.push(texture);
                return texture;
            }
            return list.pop();
        },

        put : function(texture) {
            var key = generateKey(texture);
            if (!pool.hasOwnProperty(key)) {
                pool[key] = [];
            }
            var list = pool[key];
            list.push(texture);
        },

        clear : function(gl) {
            for (i = 0; i < allocatedTextures.length; i++) {
                allocatedTextures[i].dispose(gl);
            }
            pool = {};
            allocatedTextures = [];
        }
    }

    var defaultParams = {
        width : 512,
        height : 512,
        type : glenum.UNSIGNED_BYTE,
        format : glenum.RGBA,
        wrapS : glenum.CLAMP_TO_EDGE,
        wrapT : glenum.CLAMP_TO_EDGE,
        minFilter : glenum.LINEAR_MIPMAP_LINEAR,
        magFilter : glenum.LINEAR,
        useMipmap : true,
        anisotropic : 1,
        flipY : true,
        unpackAlignment : 4,
        premultiplyAlpha : false
    }

    var defaultParamPropList = Object.keys(defaultParams);

    function generateKey(parameters) {
        util.defaultsWithPropList(parameters, defaultParams, defaultParamPropList);
        fallBack(parameters);

        var key = '';
        for (var i = 0; i < defaultParamPropList.length; i++) {
            var name = defaultParamPropList[i];
            var chunk = parameters[name].toString();
            key += chunk;
        }
        return key;
    }

    function fallBack(target) {

        var IPOT = isPowerOfTwo(target.width, target.height);

        if (target.format === glenum.DEPTH_COMPONENT) {
            target.useMipmap = false;
        }

        if (!IPOT || !target.useMipmap) {
            if (target.minFilter == glenum.NEAREST_MIPMAP_NEAREST ||
                target.minFilter == glenum.NEAREST_MIPMAP_LINEAR) {
                target.minFilter = glenum.NEAREST;
            } else if (
                target.minFilter == glenum.LINEAR_MIPMAP_LINEAR ||
                target.minFilter == glenum.LINEAR_MIPMAP_NEAREST
            ) {
                target.minFilter = glenum.LINEAR
            }

            target.wrapS = glenum.CLAMP_TO_EDGE;
            target.wrapT = glenum.CLAMP_TO_EDGE;
        }
    }

    function isPowerOfTwo(width, height) {
        return (width & (width-1)) === 0 &&
                (height & (height-1)) === 0;
    }

    return texturePool;
});
/**
 * Example
 * {
 *  name : "xxx",
 *  shader : shader,
 *  inputs :{ 
 *      "texture" : {
 *          node : "xxx",
 *          pin : "diffuse"
        }
    },
    // Optional, only use for the node in group
    groupInputs : {
        // Group input pin name : node input pin name
        "texture" : "texture"
    },
    outputs : {
            color : {
                attachment : FrameBuffer.COLOR_ATTACHMENT0
                parameters : {
                    format : Texture.RGBA,
                    width : 512,
                    height : 512
                },
                // Node will keep the texture rendered in last frame
                keepLastFrame : true,
                // Force the node output the texture rendered in last frame
                outputLastFrame : true
            }
        }
    },
    // Optional, only use for the node in group
    groupOutputs : {
        // Node output pin name : group output pin name
        "diffuse" : "diffuse"
    }
 * Multiple outputs is reserved for MRT support in WebGL2.0
 *
 * TODO blending 
 */
define('qtek/compositor/Node',['require','../core/Base','./Pass','../FrameBuffer','../Shader','./texturePool'],function(require) {

    

    var Base = require("../core/Base");
    var Pass = require("./Pass");
    var FrameBuffer = require("../FrameBuffer");
    var Shader = require("../Shader");
    var texturePool = require("./texturePool");

    var Node = Base.derive(function() {
        return {

            name : "",

            inputs : {},
            
            outputs : null,

            shader : '',
            /**
             * Input links, will be auto updated by the graph
             * Example:
             * inputName : {
             *     node : [Node],
             *     pin : 'xxxx'    
             * }
             * @type {Object}
             */
            inputLinks : {},
            /**
             * Output links, will be auto updated by the graph
             * Example:
             * outputName : {
             *     node : [Node],
             *     pin : 'xxxx'    
             * }
             * @type {Object}
             */
            outputLinks : {},
            /**
             * @type {qtek.compositor.Pass}
             */
            pass : null,

            // Save the output texture of previous frame
            // Will be used when there exist a circular reference
            _prevOutputTextures : {},
            _outputTextures : {},
            //{
            //  name : 2
            //}
            _outputReferences : {},

            _rendering : false,
            // If rendered in this frame
            _rendered : false
        }
    }, function() {
        
        var pass = new Pass({
            fragment : this.shader
        });
        this.pass = pass;

        if (this.outputs) {
            this.frameBuffer = new FrameBuffer({
                depthBuffer : false
            })
        }
    }, {
        /**
         * Do rendering
         * @param  {qtek.Renderer} renderer
         */
        render : function(renderer) {
                        
            this._rendering = true;

            var _gl = renderer.gl;

            for (var inputName in this.inputLinks) {
                var link = this.inputLinks[inputName];
                var inputTexture = link.node.getOutput(renderer, link.pin);
                this.pass.setUniform(inputName, inputTexture);
            }
            // Output
            if (! this.outputs) {
                this.pass.outputs = null;
                this.pass.render(renderer);
            } else {
                this.pass.outputs = {};

                for (var name in this.outputs) {
                    var parameters = this.updateParameter(name, renderer);
                    var outputInfo = this.outputs[name];
                    var texture = texturePool.get(parameters);
                    this._outputTextures[name] = texture;
                    var attachment = outputInfo.attachment || _gl.COLOR_ATTACHMENT0;
                    if (typeof(attachment) == "string") {
                        attachment = _gl[attachment];
                    }
                    this.pass.outputs[attachment] = texture;
                }

                this.pass.render(renderer, this.frameBuffer);
            }
            
            for (var inputName in this.inputLinks) {
                var link = this.inputLinks[inputName];
                link.node.removeReference(link.pin);
            }

            this._rendering = false;
            this._rendered = true;
        },

        updateParameter : function(name, renderer) {
            var outputInfo = this.outputs[name];
            var parameters = outputInfo.parameters;
            var parametersCopy = outputInfo._parametersCopy;
            if (!parametersCopy) {
                parametersCopy = outputInfo._parametersCopy = {};
            }
            if (parameters) {
                for (var key in parameters) {
                    if (key !== 'width' && key !== 'height') {
                        parametersCopy[key] = parameters[key];
                    }
                }
            }
            var width, height;
            if (parameters.width instanceof Function) {
                width = parameters.width(renderer);
            } else {
                width = parameters.width;
            }
            if (parameters.height instanceof Function) {
                height = parameters.height(renderer);
            } else {
                height = parameters.height;
            }
            if (
                parametersCopy.width !== width
                || parametersCopy.height !== height
            ) {
                if (this._outputTextures[name]) {
                    this._outputTextures[name].dispose(renderer.gl);
                }
            }
            parametersCopy.width = width;
            parametersCopy.height = height;

            return parametersCopy;
        },

        setParameter : function(name, value) {
            this.pass.setUniform(name, value);
        },

        getParameter : function(name) {
            return this.pass.getUniform(name);
        },

        setParameters : function(obj) {
            for (var name in obj) {
                this.setParameter(name, obj[name]);
            }
        },

        setShader : function(shaderStr) {
            var material = this.pass.material;
            material.shader.setFragment(shaderStr);
            material.attachShader(shader, true);
        },

        getOutput : function(renderer /*optional*/, name) {
            if (name === undefined) {
                // Return the output texture without rendering
                name = renderer;
                return this._outputTextures[name];
            }
            var outputInfo = this.outputs[name];
            if (! outputInfo) {
                return ;
            }

            // Already been rendered in this frame
            if (this._rendered) {
                // Force return texture in last frame
                if (outputInfo.outputLastFrame) {
                    return this._prevOutputTextures[name];
                } else {
                    return this._outputTextures[name];
                }
            } else if (
                // TODO
                this._rendering   // Solve Circular Reference
            ) {
                if (!this._prevOutputTextures[name]) {
                    // Create a blank texture at first pass
                    this._prevOutputTextures[name] = texturePool.get(outputInfo.parameters || {});
                }
                return this._prevOutputTextures[name];
            }

            this.render(renderer);
            
            return this._outputTextures[name];
        },

        removeReference : function(name) {
            this._outputReferences[name]--;
            if (this._outputReferences[name] === 0) {
                var outputInfo = this.outputs[name];
                if (outputInfo.keepLastFrame) {
                    if (this._prevOutputTextures[name]) {
                        texturePool.put(this._prevOutputTextures[name]);
                    }
                    this._prevOutputTextures[name] = this._outputTextures[name];
                } else {
                    // Output of this node have alreay been used by all other nodes
                    // Put the texture back to the pool.
                    texturePool.put(this._outputTextures[name]);
                }
            }
        },

        link : function(inputPinName, fromNode, fromPinName) {

            // The relationship from output pin to input pin is one-on-multiple
            this.inputLinks[inputPinName] = {
                node : fromNode,
                pin : fromPinName
            }
            if (! fromNode.outputLinks[fromPinName]) {
                fromNode.outputLinks[fromPinName] = [];
            }
            fromNode.outputLinks[ fromPinName ].push({
                node : this,
                pin : inputPinName
            });
            // Enabled the pin texture in shader
            var shader = this.pass.material.shader;
            shader.enableTexture(inputPinName);
        },

        clear : function() {
            this.inputLinks = {};
            this.outputLinks = {};

            var shader = this.pass.material.shader;
            shader.disableTexturesAll();   
        },

        updateReference : function(name) {
            if (!this._rendering) {
                this._rendering = true;
                for (var inputName in this.inputLinks) {
                    var link = this.inputLinks[inputName];
                    link.node.updateReference(link.pin);
                }
                this._rendering = false;
            }
            if (name) {
                this._outputReferences[name] ++;
            }
        },

        beforeFrame : function() {
            this._rendered = false;

            for (var name in this.outputLinks) {
                this._outputReferences[name] = 0;
            }
        },

        afterFrame : function() {
            // Put back all the textures to pool
            for (var name in this.outputLinks) {
                if (this._outputReferences[name] > 0) {
                    var outputInfo = this.outputs[name];
                    if (outputInfo.keepLastFrame) {
                        if (this._prevOutputTextures[name]) {
                            texturePool.put(this._prevOutputTextures[name]);
                        }
                        this._prevOutputTextures[name] = this._outputTextures[name];
                    } else {
                        texturePool.put(this._outputTextures[name]);
                    }
                }
            }
        }
    })

    return Node;
});
/**
 * Node Group
 */
define('qtek/compositor/Group',['require','./Node','./Graph'],function(require) {

    var Node = require("./Node");
    var Graph = require("./Graph");

    var Group = Node.derive(function() {
        return {
            nodes : [],

            _outputTextures : {}
        }
    }, {
        add : function(node) {
            return Graph.prototype.add.call(this, node);
        },

        remove : function(node) {
            return Graph.prototype.remove.call(this, node);
        },

        update : function() {
            return Graph.prototype.update.call(this);
        },

        findNode : function(name) {
            return Graph.prototype.findNode.call(this);
        },

        findPin : function(info) {
            return Graph.prototype.findPin.call(this, info);
        },

        render : function(renderer) {
            if(this._dirty) {
                this.update();
                this._dirty = false;
            }
            
            var groupInputTextures = {};

            for (var inputName in this.inputLinks) {
                var link = this.inputLinks[inputName];
                var inputTexture = link.node.getOutput(renderer, link.pin);
                groupInputTextures[inputName] = inputTexture;
            }

            for (var i = 0; i < this.nodes.length; i++) {
                var node = this.nodes[i];
                // Update the reference number of each output texture
                node.beforeFrame();
                // Set the input texture to portal node of group
                if (node.groupInputs) {
                    this._updateGroupInputs(node, groupInputTextures);
                }
            }
            for (var i = 0; i < this.nodes.length; i++) {
                var node = this.nodes[i];
                if (node.groupOutputs) {
                    this._updateGroupOutputs(node, renderer);
                }
                // Direct output
                if ( ! node.outputs) {
                    node.render(renderer);
                }
            }
            for (var name in this.groupOutputs) {
                if ( ! this._outputTextures[name]) {
                    console.error('Group output pin "' + name + '" is not attached');
                }
            }

            for (var inputName in this.inputLinks) {
                var link = this.inputLinks[inputName];
                link.node.removeReference( link.pin );
            }
        },

        _updateGroupInputs : function(node, groupInputTextures) {
            for (var name in groupInputTextures) {
                var texture = groupInputTextures[name];
                if (node.groupInputs[name]) {
                    var pin  = node.groupInputs[name];
                    node.pass.setUniform(pin, texture);
                }
            }
        },

        _updateGroupOutputs : function(node, renderer) {
            for (var name in node.groupOutputs) {
                var groupOutputPinName = node.groupOutputs[name];
                var texture = node.getOutput(renderer, name);
                this._outputTextures[groupOutputPinName] = texture;
            }
        }
    });

    return Group;
});
define('qtek/compositor/SceneNode',['require','./Node','./Pass','../FrameBuffer','./texturePool','../core/glinfo'],function(require) {

    var Node = require("./Node");
    var Pass = require("./Pass");
    var FrameBuffer = require("../FrameBuffer");
    var texturePool = require("./texturePool");
    var glinfo = require('../core/glinfo');

    var SceneNode = Node.derive({
            
        name : 'scene',
        
        scene : null,
        
        camera : null,
        
        autoUpdateScene : true,

        preZ : false
        
    }, function() {
        if (this.frameBuffer) {
            this.frameBuffer.depthBuffer = true;
        }
    }, {
        render : function(renderer) {
            
            this._rendering = true;
            var _gl = renderer.gl;

            this.trigger('beforerender');

            if (! this.outputs) {
                
                var renderInfo = renderer.render(this.scene, this.camera, !this.autoUpdateScene, this.preZ);

            } else {

                var frameBuffer = this.frameBuffer;
                for (var name in this.outputs) {
                    var parameters = this.updateParameter(name, renderer);
                    var outputInfo = this.outputs[name];
                    var texture = texturePool.get(parameters);
                    this._outputTextures[name] = texture;

                    var attachment = outputInfo.attachment || _gl.COLOR_ATTACHMENT0;
                    if (typeof(attachment) == "string") {
                        attachment = _gl[attachment];
                    }
                    frameBuffer.attach(renderer.gl, texture, attachment);
                }
                frameBuffer.bind(renderer);

                // MRT Support in chrome
                // https://www.khronos.org/registry/webgl/sdk/tests/conformance/extensions/ext-draw-buffers.html
                var ext = glinfo.getExtension(_gl, "EXT_draw_buffers");
                if (ext) {
                    var bufs = [];
                    for (var attachment in this.outputs) {
                        attachment = parseInt(attachment);
                        if (attachment >= _gl.COLOR_ATTACHMENT0 && attachment <= _gl.COLOR_ATTACHMENT0 + 8) {
                            bufs.push(attachment);
                        }
                    }
                    ext.drawBuffersEXT(bufs);
                }

                var renderInfo = renderer.render(this.scene, this.camera, !this.autoUpdateScene, this.preZ);

                frameBuffer.unbind(renderer);
            }

            this.trigger('afterrender', renderInfo);

            this._rendering = false;
            this._rendered = true;
        }
    })

    return SceneNode;
});
define('qtek/compositor/TextureNode',['require','./Node','../FrameBuffer','./texturePool','../Shader'],function(require) {

    var Node = require("./Node");
    var FrameBuffer = require("../FrameBuffer");
    var texturePool = require("./texturePool");
    var Shader = require("../Shader");

    var TextureNode = Node.derive(function() {
        return {
            
            shader : Shader.source("buildin.compositor.output"),

            texture : null
        }
    }, {
        render : function(renderer) {

            this._rendering = true;

            var _gl = renderer.gl;
            this.pass.setUniform("texture", this.texture);
            
            if (! this.outputs) {
                this.pass.outputs = null;
                this.pass.render(renderer);
            } else {
                
                this.pass.outputs = {};

                for (var name in this.outputs) {
                    var parameters = this.updateParameter(name, renderer);
                    var outputInfo = this.outputs[name];
                    var texture = texturePool.get(parameters);
                    this._outputTextures[name] = texture;

                    var attachment = outputInfo.attachment || _gl.COLOR_ATTACHMENT0;
                    if (typeof(attachment) == "string") {
                        attachment = _gl[attachment];
                    }
                    this.pass.outputs[ attachment ] = texture;

                }

                this.pass.render(renderer, this.frameBuffer);
            }

            this._rendering = false;
            this._rendered = true;
        }
    })

    return TextureNode;
});
;
define("qtek/geometry/Capsule", function(){});

define('qtek/geometry/Cone',['require','../DynamicGeometry','../math/BoundingBox','glmatrix'],function(require) {

    var DynamicGeometry = require('../DynamicGeometry');
    var BoundingBox = require('../math/BoundingBox');
    var glMatrix = require('glmatrix');
    var vec3 = glMatrix.vec3;
    var vec2 = glMatrix.vec2;

    var Cone = DynamicGeometry.derive({

        topRadius : 0,
        bottomRadius : 1,

        height : 2,

        capSegments : 50,
        heightSegments : 1
    }, function() {
        this.build();
    }, {
        build : function() {
            var positions = this.attributes.position.value;
            var texcoords = this.attributes.texcoord0.value;
            var faces = this.faces;
            positions.length = 0;
            texcoords.length = 0;
            faces.length = 0;
            // Top cap
            var capSegRadial = Math.PI * 2 / this.capSegments;

            var topCap = [];
            var bottomCap = [];

            var r1 = this.topRadius;
            var r2 = this.bottomRadius;
            var y = this.height / 2;

            var c1 = vec3.fromValues(0, y, 0);
            var c2 = vec3.fromValues(0, -y, 0);
            for (var i = 0; i < this.capSegments; i++) {
                var theta = i * capSegRadial;
                var x = r1 * Math.sin(theta);
                var z = r1 * Math.cos(theta);
                topCap.push(vec3.fromValues(x, y, z));

                x = r2 * Math.sin(theta);
                z = r2 * Math.cos(theta);
                bottomCap.push(vec3.fromValues(x, -y, z));
            }

            // Build top cap
            positions.push(c1);
            // TODO
            texcoords.push(vec2.fromValues(0, 1));
            var n = this.capSegments;
            for (var i = 0; i < n; i++) {
                positions.push(topCap[i]);
                // TODO
                texcoords.push(vec2.fromValues(i / n, 0));
                faces.push([0, i+1, (i+1) % n + 1]);
            }

            // Build bottom cap
            var offset = positions.length;
            positions.push(c2);
            texcoords.push(vec2.fromValues(0, 1));
            for (var i = 0; i < n; i++) {
                positions.push(bottomCap[i]);
                // TODO
                texcoords.push(vec2.fromValues(i / n, 0));
                faces.push([offset, offset+((i+1) % n + 1), offset+i+1]);
            }

            // // Build side
            offset = positions.length;
            var n2 = this.heightSegments;
            for (var i =0; i < n; i++) {
                for (var j = 0; j < n2+1; j++) {
                    var v = j / n2;
                    positions.push(vec3.lerp(vec3.create(), topCap[i], bottomCap[i], v));
                    texcoords.push(vec2.fromValues(i / n, v));
                }
            }
            for (var i = 0; i < n; i++) {
                for (var j = 0; j < n2; j++) {
                    var i1 = i * (n2 + 1) + j;
                    var i2 = ((i + 1) % n) * (n2 + 1) + j;
                    var i3 = ((i + 1) % n) * (n2 + 1) + j + 1;
                    var i4 = i * (n2 + 1) + j + 1;
                    faces.push([offset+i2, offset+i1, offset+i4]);
                    faces.push([offset+i4, offset+i3, offset+i2]);
                }
            }

            this.generateVertexNormals();

            this.boundingBox = new BoundingBox();
            var r = Math.max(this.topRadius, this.bottomRadius);
            this.boundingBox.min.set(-r, -this.height/2, -r);
            this.boundingBox.max.set(r, this.height/2, r);
        }
    });

    return Cone;
});

define('qtek/geometry/Cube',['require','../DynamicGeometry','./Plane','../math/Matrix4','../math/Vector3','../math/BoundingBox'],function(require) {

    var DynamicGeometry = require('../DynamicGeometry');
    var Plane = require('./Plane');
    var Matrix4 = require('../math/Matrix4');
    var Vector3 = require('../math/Vector3');
    var BoundingBox = require('../math/BoundingBox');

    var planeMatrix = new Matrix4();
    
    var Cube = DynamicGeometry.derive(function() {

        return {
            widthSegments : 1,
            heightSegments : 1,
            depthSegments : 1,
            // TODO double side material
            inside : false
        }
    }, function() {
        var planes = {
            "px" : createPlane("px", this.depthSegments, this.heightSegments),
            "nx" : createPlane("nx", this.depthSegments, this.heightSegments),
            "py" : createPlane("py", this.widthSegments, this.depthSegments),
            "ny" : createPlane("ny", this.widthSegments, this.depthSegments),
            "pz" : createPlane("pz", this.widthSegments, this.heightSegments),
            "nz" : createPlane("nz", this.widthSegments, this.heightSegments),
        };
        var cursor = 0;
        var self = this;
        for (var pos in planes) {
            ['position', 'texcoord0', 'normal'].forEach(function(attrName) {
                var attrArray = planes[pos].attributes[attrName].value;
                for (var i = 0; i < attrArray.length; i++) {
                    var value = attrArray[i];
                    if (this.inside && attrName === "normal") {
                        value[0] = -value[0];
                        value[1] = -value[1];
                        value[2] = -value[2];
                    }
                    self.attributes[attrName].value.push(value);
                }
                var plane = planes[pos];
                for (var i = 0; i < plane.faces.length; i++) {
                    var face = plane.faces[i];
                    self.faces.push([face[0]+cursor, face[1]+cursor, face[2]+cursor]);
                }
            });
            cursor += planes[pos].getVertexNumber();
        }

        this.boundingBox = new BoundingBox();
        this.boundingBox.max.set(1, 1, 1);
        this.boundingBox.min.set(-1, -1, -1);
    })

    function createPlane(pos, widthSegments, heightSegments) {

        planeMatrix.identity();

        var plane = new Plane({
            widthSegments : widthSegments,
            heightSegments : heightSegments
        })

        switch(pos) {
            case "px":
                planeMatrix.translate(new Vector3(1, 0, 0));
                planeMatrix.rotateY(Math.PI/2);
                break;
            case "nx":
                planeMatrix.translate(new Vector3(-1, 0, 0));
                planeMatrix.rotateY(-Math.PI/2);
                break;
            case "py":
                planeMatrix.translate(new Vector3(0, 1, 0));
                planeMatrix.rotateX(-Math.PI/2);
                break;
            case "ny":
                planeMatrix.translate(new Vector3(0, -1, 0));
                planeMatrix.rotateX(Math.PI/2);
                break;
            case "pz":
                planeMatrix.translate(new Vector3(0, 0, 1));
                break;
            case "nz":
                planeMatrix.translate(new Vector3(0, 0, -1));
                planeMatrix.rotateY(Math.PI);
                break;
        }
        plane.applyTransform(planeMatrix);
        return plane;
    }

    return Cube;
});
define('qtek/geometry/Cylinder',['require','../DynamicGeometry','../math/BoundingBox','./Cone'],function(require) {

    var DynamicGeometry = require('../DynamicGeometry');
    var BoundingBox = require('../math/BoundingBox');
    var ConeGeometry = require('./Cone');

    var Cylinder = DynamicGeometry.derive({
        radius : 1,
        height : 2,

        capSegments : 50,
        heightSegments : 1
    }, function() {
        this.build();
    }, {
        build : function() {
            var cone = new ConeGeometry({
                topRadius : this.radius,
                bottomRadius : this.radius,
                capSegments : this.capSegments,
                heightSegments : this.heightSegments,
                height : this.height
            });

            this.attributes.position.value = cone.attributes.position.value;
            this.attributes.normal.value = cone.attributes.normal.value;
            this.attributes.texcoord0.value = cone.attributes.texcoord0.value;
            this.faces = cone.faces;

            this.boundingBox = cone.boundingBox;
        }
    })

    return Cylinder;
});
define('qtek/geometry/Sphere',['require','../DynamicGeometry','glmatrix','../math/BoundingBox'],function(require) {

    var DynamicGeometry = require('../DynamicGeometry');
    var glMatrix = require('glmatrix');
    var vec3 = glMatrix.vec3;
    var vec2 = glMatrix.vec2;
    var BoundingBox = require('../math/BoundingBox');

	// From three.js SphereGeometry
    var Sphere = DynamicGeometry.derive(function() {

        return {
            widthSegments : 20,
            heightSegments : 20,

            phiStart : 0,
            phiLength : Math.PI * 2,

            thetaStart : 0,
            thetaLength : Math.PI,

            radius : 1
        }
    }, function() {
        
        var positions = this.attributes.position.value;
        var texcoords = this.attributes.texcoord0.value;
        var normals = this.attributes.normal.value;

        var x, y, z,
            u, v,
            i, j;
        var normal;

        var heightSegments = this.heightSegments;
        var widthSegments = this.widthSegments;
        var radius = this.radius;
        var phiStart = this.phiStart;
        var phiLength = this.phiLength;
        var thetaStart = this.thetaStart;
        var thetaLength = this.thetaLength;
        var radius = this.radius;

        for (j = 0; j <= heightSegments; j ++) {
            for (i = 0; i <= widthSegments; i ++) {
                u = i / widthSegments;
                v = j / heightSegments;

                x = -radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
                y = radius * Math.cos(thetaStart + v * thetaLength);
                z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);

                positions.push(vec3.fromValues(x, y, z));
                texcoords.push(vec2.fromValues(u, v));

                normal = vec3.fromValues(x, y, z);
                vec3.normalize(normal, normal)
                normals.push(normal);
            }
        }

        var p1, p2, p3,
            i1, i2, i3, i4;
        var faces = this.faces;

        var len = widthSegments + 1;

        for (j = 0; j < heightSegments; j ++) {
            for (i = 0; i < widthSegments; i ++) {
                i2 = j * len + i;
                i1 = (j * len + i + 1);
                i4 = (j + 1) * len + i + 1;
                i3 = (j + 1) * len + i;

                faces.push(vec3.fromValues(i1, i2, i4));
                faces.push(vec3.fromValues(i2, i3, i4));
            }
        }

        this.boundingBox = new BoundingBox();
        this.boundingBox.max.set(radius, radius, radius);
        this.boundingBox.min.set(-radius, -radius, -radius);
    })

    return Sphere;
});
define('qtek/light/Ambient',['require','../Light','../Shader'],function(require) {

    var Light = require('../Light');
    var Shader = require('../Shader');

    var AmbientLight = Light.derive(function() {
        return {
            castShadow : false
        }
    }, {

        type : 'AMBIENT_LIGHT',

        uniformTemplates : {
            'ambientLightColor' : {
                type : '3f',
                value : function(instance) {
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [color[0]*intensity, color[1]*intensity, color[1]*intensity];
                }
            }
        }
    })

    return AmbientLight;
});
define('qtek/light/Directional',['require','../Light','../Shader','../math/Vector3'],function(require) {

    var Light = require('../Light');
    var Shader = require('../Shader');
    var Vector3 = require('../math/Vector3');

    var DirectionalLight = Light.derive(function() {

        return {

            shadowBias : 0.0002,
            shadowSlopeScale : 2.0
        }
    }, {

        type : 'DIRECTIONAL_LIGHT',

        uniformTemplates : {
            'directionalLightDirection' : {
                type : '3f',
                value : (function() {
                    var z = new Vector3();
                    return function(instance) {
                        return z.copy(instance.worldTransform.forward).negate()._array;
                    }
                })()
            },
            'directionalLightColor' : {
                type : '3f',
                value : function(instance) {
                    var color = instance.color;
                    var intensity = instance.intensity;
                    return [color[0]*intensity, color[1]*intensity, color[1]*intensity];
                }
            }
        }
    })

    return DirectionalLight;
} );
define('qtek/light/Point',['require','../Light','../Shader'],function(require) {

    var Light = require('../Light');
    var Shader = require('../Shader');

    var PointLight = Light.derive(function() {

        return {
            range : 100,

            castShadow : false,
        }
    }, {

        type : 'POINT_LIGHT',

        uniformTemplates : {
            'pointLightPosition' : {
                type : '3f',
                value : function(instance) {
                    return instance.getWorldPosition()._array;
                }
            },
            'pointLightRange' : {
                type : '1f',
                value : function(instance) {
                    return instance.range;
                }
            },
            'pointLightColor' : {
                type : '3f',
                value : function(instance) {
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [ color[0]*intensity, color[1]*intensity, color[1]*intensity ];
                }
            }
        }
    })

    return PointLight;
});
define('qtek/light/Spot',['require','../Light','../Shader','../math/Vector3'],function(require) {

    var Light = require('../Light');
    var Shader = require('../Shader');
    var Vector3 = require('../math/Vector3');

    var SpotLight = Light.derive(function() {

        return {
            range : 20,
            umbraAngle : 30,
            penumbraAngle : 45,
            falloffFactor : 2.0,
            
            shadowBias : 0.0002,
            shadowSlopeScale : 2.0
        }
    },{

        type : 'SPOT_LIGHT',

        uniformTemplates : {
            'spotLightPosition' : {
                type : '3f',
                value : function(instance) {
                    return instance.getWorldPosition()._array;
                }
            },
            'spotLightRange' : {
                type : '1f',
                value : function(instance) {
                    return instance.range;
                }
            },
            'spotLightUmbraAngleCosine' : {
                type : '1f',
                value : function(instance) {
                    return Math.cos(instance.umbraAngle * Math.PI / 180);
                }
            },
            'spotLightPenumbraAngleCosine' : {
                type : '1f',
                value : function(instance) {
                    return Math.cos(instance.penumbraAngle * Math.PI / 180);
                }
            },
            'spotLightFalloffFactor' : {
                type : '1f',
                value : function(instance) {
                    return instance.falloffFactor
                }
            },
            'spotLightDirection' : {
                type : '3f',
                value : (function() {
                    var z = new Vector3();
                    return function(instance) {
                        // Direction is target to eye
                        return z.copy(instance.worldTransform.forward).negate()._array;
                    }
                })()
            },
            'spotLightColor' : {
                type : '3f',
                value : function(instance) {
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [ color[0]*intensity, color[1]*intensity, color[1]*intensity ];
                }
            }
        }
    })

    return SpotLight;
} );
define('qtek/loader/FX',['require','../core/Base','../core/request','../core/util','../compositor/Compositor','../compositor/Node','../compositor/Group','../compositor/SceneNode','../compositor/TextureNode','../Shader','../Texture','../texture/Texture2D','../texture/TextureCube'],function(require) {
    
    

    var Base = require('../core/Base');
    var request = require('../core/request');
    var util = require('../core/util');
    var Compositor = require('../compositor/Compositor');
    var CompoNode = require('../compositor/Node');
    var CompoGroup = require('../compositor/Group');
    var CompoSceneNode = require('../compositor/SceneNode');
    var CompoTextureNode = require('../compositor/TextureNode');
    var Shader = require('../Shader');
    var Texture = require('../Texture');
    var Texture2D = require('../texture/Texture2D');
    var TextureCube = require('../texture/TextureCube');

    var shaderSourceReg = /#source\((.*?)\)/;
    var urlReg = /#url\((.*?)\)/;

    var FXLoader = Base.derive(function() {
        return {
            rootPath : "",
            textureRootPath : "",
            shaderRootPath : ""
        }
    }, {
        load : function(url) {
            var self = this;

            if (!this.rootPath) {
                this.rootPath = url.slice(0, url.lastIndexOf("/"));
            }

            request.get({
                url : url,
                onprogress : function(percent, loaded, total) {
                    self.trigger("progress", percent, loaded, total);
                },
                onerror : function(e) {
                    self.trigger("error", e);
                },
                responseType : "text",
                onload : function(data) {
                    self.parse(JSON.parse(data));
                }
            });
        },

        parse : function(json) {
            var self = this;
            var compositor = new Compositor();

            var lib = {
                textures : {},
                shaders : {},
                parameters : {}
            }
            var afterLoad = function(shaderLib, textureLib) {
                for (var i = 0; i < json.nodes.length; i++) {
                    var nodeInfo = json.nodes[i];
                    var node = self._createNode(nodeInfo, lib);
                    if (node) {
                        compositor.add(node);
                    }
                    if (nodeInfo.output) {
                        compositor.addOutput(node);
                    }
                }

                self.trigger('success', compositor);
            }

            for (var name in json.parameters) {
                var paramInfo = json.parameters[name];
                lib.parameters[name] = this._convertParameter(paramInfo);
            }
            this._loadShaders(json, function(shaderLib) {
                self._loadTextures(json, lib, function(textureLib) {
                    lib.textures = textureLib;
                    lib.shaders = shaderLib;
                    afterLoad();
                });
            });

            return compositor;
        },

        _createNode : function(nodeInfo, lib) {
            if (!nodeInfo.shader) {
                return;
            }
            var type = nodeInfo.type || 'processor';
            var shaderSource;
            var inputs;
            var outputs;

            if (type === 'processor') {
                var shaderExp = nodeInfo.shader.trim();
                var res = shaderSourceReg.exec(shaderExp);
                if (res) {
                    shaderSource = Shader.source(res[1].trim());
                } else if (shaderExp.charAt(0) === '#') {
                    shaderSource = lib.shaders[shaderExp.substr(1)];
                }
                if (!shaderSource) {
                    shaderSource = shaderExp;
                }
                if (!shaderSource) {
                    return;
                }
            }

            if (nodeInfo.inputs) {
                inputs = {};      
                for (var name in nodeInfo.inputs) {
                    inputs[name] = {
                        node : nodeInfo.inputs[name].node,
                        pin : nodeInfo.inputs[name].pin
                    }
                }
            }
            if (nodeInfo.outputs) {
                outputs = {};
                for (var name in nodeInfo.outputs) {
                    var outputInfo = nodeInfo.outputs[name];
                    outputs[name] = {};
                    if (outputInfo.attachment !== undefined) {
                        outputs[name].attachment = outputInfo.attachment;
                    }
                    if (outputInfo.keepLastFrame !== undefined) {
                        outputs[name].keepLastFrame = outputInfo.keepLastFrame;
                    }
                    if (outputInfo.outputLastFrame !== undefined) {
                        outputs[name].outputLastFrame = outputInfo.outputLastFrame;
                    }
                    if (typeof(outputInfo.parameters) === 'string') {
                        var paramExp = outputInfo.parameters;
                        if (paramExp.charAt(0) === '#') {
                            outputs[name].parameters = lib.parameters[paramExp.substr(1)];
                        }
                    } else if (outputInfo.parameters) {
                        outputs[name].parameters = this._convertParameter(outputInfo.parameters);
                    }
                }   
            }
            var node;
            if (type === 'processor') {
                node = new CompoNode({
                    name : nodeInfo.name,
                    shader : shaderSource,
                    inputs : inputs,
                    outputs : outputs
                });
            }
            if (node) {
                if (nodeInfo.parameters) {
                    for (var name in nodeInfo.parameters) {
                        var val = nodeInfo.parameters[name];
                        if (typeof(val) === 'string') {
                            val = val.trim();
                            if (val.charAt(0) === '#'){
                                val = lib.textures[val.substr(1)];
                            }
                        }
                        node.setParameter(name, val);
                    }
                }
                if (nodeInfo.defines) {
                    for (var name in nodeInfo.defines) {
                        var val = nodeInfo.defines[name];
                        node.pass.material.shader.define('fragment', name, val);
                    }
                }
            }
            return node;
        },

        _convertParameter : function(paramInfo) {
            var param = {};
            if (!paramInfo) {
                return param;
            }
            ['type', 'minFilter', 'magFilter', 'wrapS', 'wrapT']
                .forEach(function(name) {
                    var val = paramInfo[name];
                    if (val !== undefined) {
                        // Convert string to enum
                        if (typeof(val) === 'string') {
                            val = Texture[val];
                        }
                        param[name] = val;
                    }
                });
            ['width', 'height']
                .forEach(function(name) {
                    if (paramInfo[name] !== undefined) {
                        var val = paramInfo[name];
                        if (typeof val === 'string') {
                            val = val.trim();
                            if (val.match(/%$/)) {
                                if (name === 'width') {
                                    param[name] = percentToWidth.bind(null, val);
                                } else {
                                    param[name] = percentToHeight.bind(null, val);
                                }
                            }
                        } else {
                            param[name] = val;
                        }
                    }
                });
            if (paramInfo.useMipmap !== undefined) {
                param.useMipmap = paramInfo.useMipmap;
            }
            return param;
        },
        
        _loadShaders : function(json, callback) {
            if (!json.shaders) {
                callback({});
                return;
            }
            var shaders = {};
            var loading = 0;
            var cbd = false;
            var shaderRootPath = this.shaderRootPath || this.rootPath;
            util.each(json.shaders, function(shaderExp, name) {
                var res = urlReg.exec(shaderExp);
                if (res) {
                    var path = res[1];
                    path = util.relative2absolute(path, shaderRootPath);
                    loading++;
                    request.get({
                        url : path,
                        onload : function(shaderSource) {
                            shaders[name] = shaderSource;
                            Shader.import(shaderSource);
                            loading--;
                            if (loading === 0) {
                                callback(shaders);
                                cbd = true;
                            }
                        }
                    })
                } else {
                    shaders[name] = shaderExp;
                    Shader.import(shaderSource);
                }
            }, this);
            if (loading === 0 && !cbd) {
                callback(shaders);
            }
        },

        _loadTextures : function(json, lib, callback) {
            if (!json.textures) {
                callback({});
                return;
            }
            var textures = {};
            var loading = 0;

            var cbd = false;
            var textureRootPath = this.textureRootPath || this.rootPath;
            util.each(json.textures, function(textureInfo, name) {
                var texture;
                var path = textureInfo.path;
                var parameters = this._convertParameter(textureInfo.parameters);
                if (typeof(path) === 'array' && path.length === 6) {
                    path = path.map(function(item) {
                        return util.relative2absolute(item, textureRootPath);
                    })
                    texture = new TextureCube();
                } else if(typeof(path) === 'string') {
                    path = util.relative2absolute(path, textureRootPath);
                    texture = new Texture2D();
                } else {
                    return;
                }

                texture.load(path);
                loading++;
                texture.once('success', function() {
                    textures[name] = texture;
                    loading--;
                    if (loading === 0) {
                        callback(textures);
                        cbd = true;
                    }
                });
            }, this);

            if (loading === 0 && !cbd) {
                callback(textures);
            }
        }
    });

    function percentToWidth(percentStr, renderer) {
        var percent = parseFloat(percentStr.substr(0, percentStr.length-1));
        return Math.max(
            percent / 100 * renderer.width,
            1
        );
    }

    function percentToHeight(percentStr, renderer) {
        var percent = parseFloat(percentStr.substr(0, percentStr.length-1));
        return Math.max(
            percent / 100 * renderer.height,
            1
        );
    }

    return FXLoader;
});
/**
 * glTF Loader
 * Specification : https://github.com/KhronosGroup/glTF/blob/master/specification/README.md
 */
define('qtek/loader/GLTF',['require','../core/Base','../core/request','../core/util','../Scene','../Shader','../Material','../Mesh','../Node','../Texture','../texture/Texture2D','../texture/TextureCube','../shader/library','../Skeleton','../Joint','../camera/Perspective','../camera/Orthographic','../light/Point','../light/Spot','../light/Directional','../core/glenum','../math/Vector3','../math/Quaternion','../math/BoundingBox','../animation/SamplerClip','../animation/SkinningClip','../StaticGeometry','glmatrix'],function(require) {

    

    var Base = require('../core/Base');
    var request = require("../core/request");
    var util = require('../core/util');

    var Scene = require('../Scene');
    var Shader = require("../Shader");
    var Material = require("../Material");
    var Mesh = require("../Mesh");
    var Node = require("../Node");
    var Texture = require('../Texture');
    var Texture2D = require("../texture/Texture2D");
    var TextureCube = require("../texture/TextureCube");
    var shaderLibrary = require("../shader/library");
    var Skeleton = require("../Skeleton");
    var Joint = require("../Joint");
    var PerspectiveCamera = require("../camera/Perspective");
    var OrthographicCamera = require("../camera/Orthographic");
    var PointLight = require("../light/Point");
    var SpotLight = require("../light/Spot");
    var DirectionalLight = require("../light/Directional");
    var glenum = require("../core/glenum");

    var Vector3 = require("../math/Vector3");
    var Quaternion = require("../math/Quaternion");
    var BoundingBox = require('../math/BoundingBox');

    var SamplerClip = require("../animation/SamplerClip");
    var SkinningClip = require("../animation/SkinningClip");

    var StaticGeometry = require("../StaticGeometry");

    var glMatrix = require("glmatrix");
    var vec4 = glMatrix.vec4;
    var vec3 = glMatrix.vec3;
    var quat = glMatrix.quat;

    var semanticAttributeMap = {
        'NORMAL' : 'normal',
        'POSITION' : 'position',
        'TEXCOORD_0' : 'texcoord0',
        'WEIGHT' : 'weight',
        'JOINT' : 'joint',
        'COLOR' : 'color'
    }

    var Loader = Base.derive(function() {
        return {
            rootPath : "",
            textureRootPath : "",
            bufferRootPath : "",

            shaderName : 'buildin.physical'
        };
    }, {
        
        load : function(url) {
            var self = this;

            if (!this.rootPath) {
                this.rootPath = url.slice(0, url.lastIndexOf("/"));
            }

            request.get({
                url : url,
                onprogress : function(percent, loaded, total) {
                    self.trigger("progress", percent, loaded, total);
                },
                onerror : function(e) {
                    self.trigger("error", e);
                },
                responseType : "text",
                onload : function(data) {
                    self.parse(JSON.parse(data));
                }
            });
        },

        parse : function(json) {
            var self = this;
            var loading = 0;

            var lib = {
                buffers : {},
                materials : {},
                textures : {},
                meshes : {},
                joints : {},
                skeletons : {},
                cameras : {},
                nodes : {}
            };
            // Build scene
            var scene = new Scene();
            // Load buffers
            util.each(json.buffers, function(bufferInfo, name) {
                loading++;
                self._loadBuffer(bufferInfo.path, function(buffer) {
                    lib.buffers[name] = buffer;
                    loading--;
                    if (loading === 0) {
                        afterLoadBuffer();
                    }
                }, function() {
                    loading--;
                    if (loading === 0) {
                        afterLoadBuffer();
                    }
                });
            });

            function afterLoadBuffer() {
                self._parseTextures(json, lib);
                self._parseMaterials(json, lib);
                self._parseMeshes(json, lib);
                self._parseNodes(json, lib);

                var sceneInfo = json.scenes[json.scene];
                for (var i = 0; i < sceneInfo.nodes.length; i++) {
                    var node = lib.nodes[sceneInfo.nodes[i]];
                    node.update();
                    scene.add(node);
                }

                var isOldVersion = false;
                for (var name in json.skins) {
                    if (json.skins[name].roots) {
                        isOldVersion = true;
                        break;
                    }
                }
                if (isOldVersion) {
                    self._parseSkins(json, lib);
                } else {
                    self._parseSkins2(json, lib);
                }

                var clip = self._parseAnimations(json, lib);
                if (clip) {
                    for (var name in lib.skeletons) {
                        lib.skeletons[name].addClip(clip);
                    }
                }

                self.trigger("success", {
                    scene : scene,
                    cameras : lib.cameras,
                    textures : lib.textures,
                    materials : lib.materials,
                    skeletons : lib.skeletons,
                    clip : clip
                });
            }

            return {
                scene : scene,
                cameras : lib.cameras,
                textures : lib.textures,
                materials : lib.materials,
                skeletons : lib.skeletons,
                clip : null
            }
        },

        _loadBuffer : function(path, onsuccess, onerror) {
            var root = this.bufferRootPath || this.rootPath;
            if (root) {
                path = root + "/" + path;
            }
            request.get({
                url : path,
                responseType : "arraybuffer",
                onload : function(buffer) {
                    onsuccess && onsuccess(buffer);
                },
                onerror : function(buffer) {
                    onerror && onerror(buffer);
                }
            });
        },

        // https://github.com/KhronosGroup/glTF/issues/100
        // https://github.com/KhronosGroup/glTF/issues/193
        _parseSkins2 : function(json, lib) {
            var self = this;

            // Create skeletons and joints
            var haveInvBindMatrices = false;
            for (var name in json.skins) {
                var skinInfo = json.skins[name];
                var skeleton = new Skeleton({
                    name : name
                });
                for (var i = 0; i < skinInfo.joints.length; i++) {
                    var jointId = skinInfo.joints[i];
                    var joint = new Joint({
                        name : jointId,
                        index : skeleton.joints.length
                    });
                    skeleton.joints.push(joint);
                }
                if (skinInfo.inverseBindMatrices) {
                    haveInvBindMatrices = true;
                    var IBMInfo = skinInfo.inverseBindMatrices;
                    var bufferViewName = IBMInfo.bufferView;
                    var bufferViewInfo = json.bufferViews[bufferViewName];
                    var buffer = lib.buffers[bufferViewInfo.buffer];

                    var offset = IBMInfo.byteOffset + bufferViewInfo.byteOffset;
                    var size = IBMInfo.count * 16;

                    var array = new Float32Array(buffer, offset, size);

                    skeleton._invBindPoseMatricesArray = array;
                    skeleton._skinMatricesArray = new Float32Array(array.length);
                }
                lib.skeletons[name] = skeleton;
            }

            var bindNodeToJoint = function(jointsMap, nodeName, parentIndex, rootNode) {
                var node = lib.nodes[nodeName];
                var nodeInfo = json.nodes[nodeName];
                var joint = jointsMap[nodeInfo.jointId];
                // TODO 
                // collada2gltf may have jointId in node but corresponding skin doesn't have this jointId
                // maybe because the joint has no weight on the skinned mesh, so converter removed it for optimization
                // Skip it ??
                // wired
                if (joint) {
                    // throw new Error('Joint bind to ' + nodeInfo.name + ' doesn\'t exist in skin');
                    joint.node = node;
                    joint.parentIndex = parentIndex;
                    joint.rootNode = rootNode;
                    parentIndex = joint.index;
                }

                for (var i = 0; i < nodeInfo.children.length; i++) {
                    bindNodeToJoint(jointsMap, nodeInfo.children[i], parentIndex, rootNode);
                }

                return joint;
            }

            var instanceSkins = {};

            for (var name in json.nodes) {

                var nodeInfo = json.nodes[name];

                if (nodeInfo.instanceSkin) {
                    var skinName = nodeInfo.instanceSkin.skin;
                    var skeleton = lib.skeletons[skinName];
                    instanceSkins[skinName] = skeleton;

                    var node = lib.nodes[name];
                    var jointIndices = skeleton.joints.map(function(joint) {
                        return joint.index;
                    });
                    if (node instanceof Mesh) {
                        node.skeleton = skeleton;
                        node.joints = jointIndices;
                        var material = node.material;
                        material.shader = material.shader.clone();
                        material.shader.define('vertex', 'SKINNING');
                        material.shader.define('vertex', 'JOINT_NUMBER', jointIndices.length);
                    } else {
                        // Mesh have multiple primitives
                        for (var i = 0; i < node._children.length; i++) {
                            var child = node._children[i];
                            if (child.skeleton) {
                                child.skeleton = skeleton;
                                child.joints = jointIndices;
                                var material = child.material;
                                material.shader = material.shader.clone();
                                material.shader.define('vertex', 'SKINNING');
                                material.shader.define('vertex', 'JOINT_NUMBER', jointIndices.length);
                            }
                        }
                    }

                    var jointsMap = {};
                    for (var i = 0; i < skeleton.joints.length; i++) {
                        var joint = skeleton.joints[i];
                        jointsMap[joint.name] = joint;
                    }
                    // Build up hierarchy from root nodes
                    var rootNodes = nodeInfo.instanceSkin.skeletons;
                    for (i = 0; i < rootNodes.length; i++) {
                        var rootNode = lib.nodes[rootNodes[i]];
                        var rootJoint = bindNodeToJoint(jointsMap, rootNodes[i], -1, rootNode);
                        skeleton.roots.push(rootJoint);
                    }
                }
            }

            for (var name in instanceSkins) {
                var skeleton = instanceSkins[name];
                if (haveInvBindMatrices) {
                    skeleton.updateMatricesSubArrays();
                } else {
                    skeleton.updateJointMatrices();
                }
                skeleton.update();
            }
        },     

        // DEPRECATED
        _parseSkins : function(json, lib) {
            var self = this;

            var createJoint = function(nodeName, parentIndex, skeleton) {
                var nodeInfo = json.nodes[nodeName];
                nodeInfo._isJoint = true;
                // Cast node to joint
                var joint = new Joint();
                joint.name = nodeName;
                var node = lib.nodes[nodeName];
                joint.node = node;
                joint.index = skeleton.joints.length;
                if (parentIndex !== undefined) {
                    joint.parentIndex = parentIndex;
                }
                
                skeleton.joints.push(joint);
                lib.joints[nodeName] = joint;
                
                for (var i = 0; i < nodeInfo.children.length; i++) {
                    var child = createJoint(nodeInfo.children[i], joint.index, skeleton);
                }
                return joint;
            }

            for (var name in json.skins) {
                var skinInfo = json.skins[name];
                var skeleton = new Skeleton({
                    name : name
                });
                for (var i = 0; i < skinInfo.roots.length; i++) {
                    var rootJointName = skinInfo.roots[i];
                    var rootJoint = createJoint(rootJointName, undefined, skeleton);
                    if (rootJoint) {
                        skeleton.roots.push(rootJoint);
                    }
                }
                if (skeleton.joints.length) {
                    lib.skeletons[name] = skeleton;
                    skeleton.updateJointMatrices();
                    skeleton.update();
                }
            }

            for (var name in lib.meshes) {
                var meshList = lib.meshes[name];
                for (var i = 0; i < meshList.length; i++) {
                    var mesh = meshList[i];
                    if (mesh.skeleton) {
                        var material = mesh.material;
                        mesh.skeleton = lib.skeletons[mesh.skeleton];
                        if (mesh.skeleton) {
                            for (var j = 0; j < mesh.skeleton.joints.length; j++) {
                                mesh.joints.push(j);
                            }
                            material.shader = material.shader.clone();
                            material.shader.define('vertex', 'SKINNING');
                            material.shader.define('vertex', 'JOINT_NUMBER', mesh.joints.length);
                        } 
                    }
                }
            }
        },

        _parseTextures : function(json, lib) {
            var root = this.textureRootPath || this.rootPath;
            util.each(json.textures, function(textureInfo, name){
                var samplerInfo = json.samplers[textureInfo.sampler];
                var parameters = {};
                ['wrapS', 'wrapT', 'magFilter', 'minFilter']
                .forEach(function(name) {
                    var value = samplerInfo[name];
                    if (value !== undefined) {
                        if (typeof(value) === 'string') {
                            // DEPRECATED, sampler parameter now use gl enum instead of string
                            value = glenum[value];
                        }
                        parameters[name] = value;   
                    }
                });

                var target = textureInfo.target;
                var format = textureInfo.format;
                if (typeof(target) === 'string') {
                    // DEPRECATED
                    target = glenum[target];
                    format = glenum[format];
                }
                parameters.format = format;

                if (target === glenum.TEXTURE_2D) {
                    var texture = new Texture2D(parameters);
                    var imageInfo = json.images[textureInfo.source];
                    texture.load(util.relative2absolute(imageInfo.path, root));
                    lib.textures[name] = texture;
                } else if(target === glenum.TEXTURE_CUBE_MAP) {
                    // TODO
                }
            }, this);
        },

        // Only phong material is support yet
        // TODO : support custom material
        _parseMaterials : function(json, lib) {
            var self = this;
            var techniques = {};
            // Parse techniques
            for (var name in json.techniques) {
                var techniqueInfo = json.techniques[name];
                // Default phong shader
                // var shader = new Shader({
                //     vertex : Shader.source("buildin.phong.vertex"),
                //     fragment : Shader.source("buildin.phong.fragment")
                // });
                techniques[name] = {
                    // shader : shader,
                    pass : techniqueInfo.passes[techniqueInfo.pass]
                }
            }
            for (var name in json.materials) {
                var materialInfo = json.materials[name];

                var instanceTechniqueInfo = materialInfo.instanceTechnique;
                var technique = techniques[instanceTechniqueInfo.technique];
                var pass = technique.pass;
                var uniforms = {};
                // DEPRECATED
                // https://github.com/KhronosGroup/glTF/issues/108
                // https://github.com/KhronosGroup/glTF/issues/110
                if (instanceTechniqueInfo.values instanceof Array) {
                    instanceTechniqueInfo.values.forEach(function(item){
                        uniforms[item.parameter] = item.value;
                    });
                } else {
                    uniforms = instanceTechniqueInfo.values;
                }
                for (var symbol in uniforms) {
                    var value = uniforms[symbol];
                    // TODO: texture judgement should be more robust
                    if (typeof(value) === 'string' && lib.textures[value]) {
                        uniforms[symbol] = lib.textures[value];
                    }
                }
                var enabledTextures = [];
                if (uniforms['diffuse'] instanceof Texture2D) {
                    enabledTextures.push('diffuseMap');
                }
                if (uniforms['normalMap'] instanceof Texture2D) {
                    enabledTextures.push('normalMap');
                }
                var material = new Material({
                    name : materialInfo.name,
                    shader : shaderLibrary.get(this.shaderName, enabledTextures)
                });
                if (pass.states.depthMask !== undefined) {
                    material.depthMask = pass.states.depthMask;
                }
                if (pass.states.depthTestEnable !== undefined) {
                    material.depthTest = pass.states.depthTestEnable;
                }
                material.cullFace = pass.states.cullFaceEnable || false;
                if (pass.states.blendEnable) {
                    material.transparent = true;
                    // TODO blend Func and blend Equation
                }

                if (uniforms['diffuse']) {
                    // Color
                    if (uniforms['diffuse'] instanceof Array) {
                        material.set("color", uniforms['diffuse'].slice(0, 3));
                    } else { // Texture
                        material.set("diffuseMap", uniforms["diffuse"]);
                    }
                }
                if (uniforms['normalMap'] !== undefined) {
                    material.set("normalMap", uniforms["normalMap"]);
                }
                if (uniforms['emission'] !== undefined) {
                    material.set('emission', uniforms['emission'].slice(0, 3));
                }
                if (uniforms['shininess'] !== undefined) {
                    material.set("glossiness", Math.log(uniforms["shininess"]) / Math.log(8192));
                    material.set("shininess", uniforms["shininess"]);
                } else {
                    material.set("glossiness", 0.5);
                    material.set("shininess", 0.5);
                }
                if (uniforms["specular"] !== undefined) {
                    material.set("specularColor", uniforms["specular"].slice(0, 3));
                }
                if (uniforms["transparency"] !== undefined) {
                    material.set("alpha", uniforms["transparency"]);
                }

                lib.materials[name] = material;
            }
        },

        _parseMeshes : function(json, lib) {
            var self = this;

            var meshKeys = Object.keys(json.meshes);
            for (var nn = 0; nn < meshKeys.length; nn++) {
                var name = meshKeys[nn];
                var meshInfo = json.meshes[name];

                lib.meshes[name] = [];
                // Geometry
                for (var pp = 0; pp < meshInfo.primitives.length; pp++) {
                    var primitiveInfo = meshInfo.primitives[pp];
                    var geometry = new StaticGeometry({
                        boundingBox : new BoundingBox()
                    });
                    // Parse indices
                    if (json.indices) {
                        // DEPRECATED
                        // https://github.com/KhronosGroup/glTF/issues/161
                        var indicesInfo = json.indices[primitiveInfo.indices];
                    } else {
                        var indicesInfo = json.accessors[primitiveInfo.indices];
                    }
                    var bufferViewInfo = json.bufferViews[indicesInfo.bufferView];
                    var buffer = lib.buffers[bufferViewInfo.buffer];
                    var byteOffset = bufferViewInfo.byteOffset + indicesInfo.byteOffset;

                    geometry.faces = new Uint16Array(buffer, byteOffset, indicesInfo.count);

                    // DEPRECATED
                    // https://github.com/KhronosGroup/glTF/issues/162
                    if (primitiveInfo.semantics) {
                        primitiveInfo.attributes = primitiveInfo.semantics
                    }
                    // Parse attributes
                    var semantics = Object.keys(primitiveInfo.attributes);
                    for (var ss = 0; ss < semantics.length; ss++) {
                        var semantic = semantics[ss];
                        var accessorName = primitiveInfo.attributes[semantic];
                        if (json.attributes) {
                            // DEPRECATED
                            // https://github.com/KhronosGroup/glTF/issues/161
                            var attributeInfo = json.attributes[accessorName];
                        } else {
                            var attributeInfo = json.accessors[accessorName];
                        }
                        var attributeName = semanticAttributeMap[semantic];
                        if (!attributeName) {
                            continue;
                        }
                        var attributeType = attributeInfo.type;
                        var bufferViewInfo = json.bufferViews[attributeInfo.bufferView];
                        var buffer = lib.buffers[bufferViewInfo.buffer];
                        var byteOffset = bufferViewInfo.byteOffset + attributeInfo.byteOffset;

                        if (typeof(attributeType) === 'string') {
                            // DEPRECATED
                            attributeType = glenum[attributeType];
                        }
                        switch(attributeType) {
                            case 0x8B50:     // FLOAT_VEC2
                                var size = 2;
                                var type = 'float';
                                var arrayConstructor = Float32Array;
                                break;
                            case 0x8B51:     // FLOAT_VEC3
                                var size = 3;
                                var type = 'float';
                                var arrayConstructor = Float32Array;
                                break;
                            case 0x8B52:     // FLOAT_VEC4
                                var size = 4;
                                var type = 'float';
                                var arrayConstructor = Float32Array;
                                break;
                            case 0x1406:     // FLOAT
                                var size = 1;
                                var type = 'float';
                                var arrayConstructor = Float32Array;
                                break;
                            default:
                                console.warn("Attribute type "+attributeInfo.type+" not support yet");
                                break;
                        }
                        var attributeArray = new arrayConstructor(buffer, byteOffset, attributeInfo.count * size);
                        if (semantic === 'WEIGHT' && size === 4) {
                            // Weight data in QTEK has only 3 component, the last component can be evaluated since it is normalized
                            var weightArray = new arrayConstructor(attributeInfo.count * 3);
                            for (var i = 0; i < attributeInfo.count; i++) {
                                weightArray[i * 3] = attributeArray[i * 4];
                                weightArray[i * 3 + 1] = attributeArray[i * 4 + 1];
                                weightArray[i * 3 + 2] = attributeArray[i * 4 + 2];
                            }
                            geometry.attributes[attributeName].value = weightArray;
                        } else {
                            geometry.attributes[attributeName].value = attributeArray;
                        }
                        if (semantic === 'POSITION') {
                            // Bounding Box
                            var min = attributeInfo.min;
                            var max = attributeInfo.max;
                            if (min) {
                                geometry.boundingBox.min.set(min[0], min[1], min[2]);
                            }
                            if (max) {
                                geometry.boundingBox.max.set(max[0], max[1], max[2]);
                            }
                        }
                    }

                    var material = lib.materials[primitiveInfo.material];
                    //Collada export from blender may not have default material
                    if (!material) {
                        material = new Material({
                            shader : shaderLibrary.get(self.shaderName)
                        })
                    }
                    var mesh = new Mesh({
                        geometry : geometry,
                        material : material
                    });
                    if (material.shader.isTextureEnabled('normalMap')) {
                        if (!mesh.geometry.attributes.tangent.value) {
                            mesh.geometry.generateTangents();
                        }
                    }

                    // DEPRECATED
                    var skinName = primitiveInfo.skin;
                    if (skinName) {
                        mesh.skeleton = skinName;
                    }
                    if (meshInfo.name) {
                        if (meshInfo.primitives.length > 1) {
                            mesh.name = [meshInfo.name, pp].join('-');
                        }
                        else {
                            // PENDING name or meshInfo.name ?
                            mesh.name = meshInfo.name;
                        }
                    }

                    lib.meshes[name].push(mesh);
                }
            }
        },

        _parseNodes : function(json, lib) {

            for (var name in json.nodes) {
                var nodeInfo = json.nodes[name];
                var node;
                if (nodeInfo.camera) {
                    var cameraInfo = json.cameras[nodeInfo.camera];

                    if (cameraInfo.projection === "perspective") {
                        node = new PerspectiveCamera({
                            name : nodeInfo.name,
                            aspect : cameraInfo.aspect_ratio,
                            fov : cameraInfo.xfov,
                            far : cameraInfo.zfar,
                            near : cameraInfo.znear
                        });
                    } else {
                        // TODO
                        node = new OrthographicCamera();
                        console.warn("TODO:Orthographic camera")
                    }
                    lib.cameras[nodeInfo.name] = node;
                } else {
                    node = new Node({
                        name : nodeInfo.name
                    });
                }
                if (nodeInfo.lights) {
                    for (var i = 0; i < nodeInfo.lights.length; i++) {
                        var lightInfo = json.lights[nodeInfo.lights[i]];
                        var light = this._parseLight(lightInfo);
                        if (light) {
                            node.add(light);
                        }
                    }
                }
                if (nodeInfo.meshes || nodeInfo.instanceSkin) {
                    // TODO one node have multiple meshes ?
                    if (nodeInfo.meshes) {
                        var meshKey = nodeInfo.meshes[0];
                    } else {
                        var meshKey = nodeInfo.instanceSkin.sources[0];
                    }
                    if (meshKey) {
                        var primitives = lib.meshes[meshKey];
                        if (primitives) {
                            if (primitives.length === 1) {
                                // Replace the node with mesh directly
                                node = primitives[0];
                                node.name = nodeInfo.name;
                            } else {
                                for (var j = 0; j < primitives.length; j++) {                            
                                    if (nodeInfo.instanceSkin) {
                                        primitives[j].skeleton = nodeInfo.instanceSkin.skin;
                                    }
                                    node.add(primitives[j]);
                                }   
                            }
                        }
                    }
                }
                if (nodeInfo.matrix) {
                    for (var i = 0; i < 16; i++) {
                        node.localTransform._array[i] = nodeInfo.matrix[i];
                    }
                    node.decomposeLocalTransform();
                } else {
                    if (nodeInfo.translation) {
                        node.position.setArray(nodeInfo.translation);
                    }
                    if (nodeInfo.rotation) {
                        // glTF use axis angle in rotation
                        // https://github.com/KhronosGroup/glTF/issues/144
                        quat.setAxisAngle(node.rotation._array, nodeInfo.rotation.slice(0, 3), nodeInfo.rotation[3]);
                        node.rotation._dirty = true;
                    }
                    if (nodeInfo.scale) {
                        node.scale.setArray(nodeInfo.scale);
                    }
                }

                lib.nodes[name] = node;
            }

            // Build hierarchy
            for (var name in json.nodes) {
                var nodeInfo = json.nodes[name];
                var node = lib.nodes[name];
                if (nodeInfo.children) {
                    for (var i = 0; i < nodeInfo.children.length; i++) {
                        var childName = nodeInfo.children[i];
                        var child = lib.nodes[childName];
                        node.add(child);
                    }
                }
            }
         },

        _parseLight : function(lightInfo) {
            // TODO : Light parameters
            switch(lightInfo.type) {
                case "point":
                    var light = new PointLight({
                        name : lightInfo.id,
                        color : lightInfo.point.color,
                    });
                    break;
                case "spot":
                    var light = new SpotLight({
                        name : lightInfo.id,
                        color : lightInfo.spot.color
                    });
                    break;
                case "directional":
                    var light = new DirectionalLight({
                        name : lightInfo.id,
                        color : lightInfo.directional.color
                    });
                    break;
                default:
                    console.warn("Light " + lightInfo.type + " not support yet");
            }

            return light;
        },

        _parseAnimations : function(json, lib) {
            // TODO Only support nodes animation now
            var clip = new SkinningClip();
            var haveAnimation = false;

            var jointClips = {};

            var quatTmp = quat.create();

            for (var animName in json.animations) {
                haveAnimation = true;
                var animationInfo = json.animations[animName];
                var parameters = {};

                for (var paramName in animationInfo.parameters) {
                    var accessorName = animationInfo.parameters[paramName];
                    var accessorInfo = json.accessors[accessorName];

                    var bufferViewInfo = json.bufferViews[accessorInfo.bufferView];
                    var buffer = lib.buffers[bufferViewInfo.buffer];
                    var byteOffset = bufferViewInfo.byteOffset + accessorInfo.byteOffset;
                    switch(accessorInfo.type) {
                        case 0x8B50:     // FLOAT_VEC2
                            var size = 2;
                            break;
                        case 0x8B51:     // FLOAT_VEC3
                            var size = 3;
                            break;
                        case 0x8B52:     // FLOAT_VEC4
                            var size = 4;
                            break;
                        case 0x1406:     // FLOAT
                            var size = 1;
                            break;
                    }
                    parameters[paramName] = new Float32Array(buffer, byteOffset, size * accessorInfo.count);
                }

                if (!parameters.TIME) {
                    continue;
                }

                // Use the first channels target
                var targetId = animationInfo.channels[0].target.id;
                var targetNode = lib.nodes[targetId];

                // glTF use axis angle in rotation, convert to quaternion
                // https://github.com/KhronosGroup/glTF/issues/144
                var rotationArr = parameters.rotation;
                if (rotationArr) {
                    for (i = 0; i < parameters.TIME.length; i++) {
                        parameters.TIME[i] *= 1000;
                        var offset = i * 4;
                        if (rotationArr) {
                            quatTmp[0] = rotationArr[offset];
                            quatTmp[1] = rotationArr[offset + 1];
                            quatTmp[2] = rotationArr[offset + 2];
                            quat.setAxisAngle(quatTmp, quatTmp, rotationArr[offset + 3]);
                            parameters.rotation[offset] = quatTmp[0];
                            parameters.rotation[offset + 1] = quatTmp[1];
                            parameters.rotation[offset + 2] = quatTmp[2];
                            parameters.rotation[offset + 3] = quatTmp[3];
                        }
                    }
                }

                // TODO
                // if (jointClips[targetId]) {
                //     continue;
                // }
                jointClips[targetId] = new SamplerClip({
                    name : targetNode.name
                });
                var jointClip = jointClips[targetId];
                jointClip.channels.time = parameters.TIME;
                jointClip.channels.rotation = parameters.rotation || null;
                jointClip.channels.position = parameters.translation || null;
                jointClip.channels.scale = parameters.scale || null;
                jointClip.life = parameters.TIME[parameters.TIME.length - 1];
            }

            for (var targetId in jointClips) {
                clip.addJointClip(jointClips[targetId]);
            }

            if (haveAnimation) {
                return clip;
            } else {
                return null;
            }
        }
    });

    return Loader;
});
/**
 * shapes : circle, line, polygon, rect, polyline, ellipse, path
 */
define('qtek/loader/SVG',['require','../core/Base','../core/request','../2d/Node','../2d/shape/Circle','../2d/shape/Rectangle','../2d/shape/Ellipse','../2d/shape/Line','../2d/shape/Path','../2d/shape/Polygon','../2d/shape/TextBox','../2d/shape/SVGPath','../2d/LinearGradient','../2d/RadialGradient','../2d/Pattern','../2d/Style','../math/Vector2'],function(require) {

    var Base = require("../core/Base");

    var request = require("../core/request");

    var Node = require("../2d/Node");
    var Circle = require("../2d/shape/Circle");
    var Rectangle = require("../2d/shape/Rectangle");
    var Ellipse = require("../2d/shape/Ellipse");
    var Line = require("../2d/shape/Line");
    var Path = require("../2d/shape/Path");
    var Polygon = require("../2d/shape/Polygon");
    var TextBox = require("../2d/shape/TextBox");
    var SVGPath = require("../2d/shape/SVGPath");
    var LinearGradient = require("../2d/LinearGradient");
    var RadialGradient = require("../2d/RadialGradient");
    var Pattern = require("../2d/Pattern");
    var Style = require("../2d/Style");
    var Vector2 = require("../math/Vector2");

    var Loader = Base.derive(function() {
        return {
            defs : {},
            root : null
        };
    }, {
        load : function(url) {

            var self = this;
            this.defs = {};

            request.get({
                url : url,
                onprogress : function(percent, loaded, total) {
                    self.trigger("progress", percent, loaded, total);
                },
                onerror : function(e) {
                    self.trigger("error", e);
                },
                responseType : "text",
                onload : function(xmlString) {
                    self.parse(xmlString);
                }
            })
        },
        parse : function(xml) {
            if (typeof(xml) === "string") {
                var parser = new DOMParser();
                var doc = parser.parseFromString(xml, 'text/xml');
                var svg = doc.firstChild;
                while (svg.nodeName.toLowerCase() !== 'svg') {
                    svg = svg.nextSibling;
                }
            } else {
                var svg = xml;
            }
            var root = new Node();
            this.root = root;
            // parse view port
            var viewBox = svg.getAttribute("viewBox") || '';
            var viewBoxArr = viewBox.split(/\s+/);

            var width = parseFloat(svg.getAttribute("width") || 0);
            var height = parseFloat(svg.getAttribute("height") || 0);

            var x = parseFloat(viewBoxArr[0] || 0);
            var y = parseFloat(viewBoxArr[1] || 0);
            var vWidth = parseFloat(viewBoxArr[2]);
            var vHeight = parseFloat(viewBoxArr[3]);

            root.position.set(x, y);

            var child = svg.firstChild;
            while (child) {
                this._parseNode(child, root);
                child = child.nextSibling;
            }
            
            this.trigger('success', root);

            return root;
        },

        _parseNode : function(xmlNode, parent) {
            var nodeName = xmlNode.nodeName.toLowerCase();

            if (nodeName === 'defs') {
                // define flag
                this._isDefine = true;
            }

            if (this._isDefine) {
                var parser = defineParsers[nodeName];
                if (parser) {
                    var def = parser.call(this, xmlNode);
                    var id = xmlNode.getAttribute("id");
                    if (id) {
                        this.defs[id] = def;
                    }
                }
            } else {
                var parser = nodeParsers[nodeName];
                if (parser) {
                    var node = parser.call(this, xmlNode, parent);
                    parent.add(node);
                }
            }

            var child = xmlNode.firstChild;
            while (child) {
                if (child.nodeType === 1){
                    this._parseNode(child, node);
                }
                child = child.nextSibling;
            }

            // Quit define
            if (nodeName === 'defs') {
                this._isDefine = false;
            }
        }
    });
    
    var nodeParsers = {
        "g" : function(xmlNode, parentNode) {
            var node = new Node();
            if (parentNode) {
                _inheritStyle(parentNode, node);
            }
            _parseAttributes(xmlNode, node, this.defs);
            return node;
        },
        "rect" : function(xmlNode, parentNode) {
            var rect = new Rectangle();
            if (parentNode) {
                _inheritStyle(parentNode, rect);
            }
            _parseAttributes(xmlNode, rect, this.defs);

            var x = parseFloat(xmlNode.getAttribute("x") || 0);
            var y = parseFloat(xmlNode.getAttribute("y") || 0);
            var width = parseFloat(xmlNode.getAttribute("width") || 0);
            var height = parseFloat(xmlNode.getAttribute("height") || 0);
            rect.start.set(x, y);
            rect.size.set(x, y);

            return rect;
        },
        "circle" : function(xmlNode, parentNode) {
            var circle = new Circle();
            if (parentNode) {
                _inheritStyle(parentNode, circle);
            }
            _parseAttributes(xmlNode, circle, this.defs);

            var cx = parseFloat(xmlNode.getAttribute("cx") || 0);
            var cy = parseFloat(xmlNode.getAttribute("cy") || 0);
            var r = parseFloat(xmlNode.getAttribute("r") || 0);
            circle.center.set(cx, cy);
            circle.radius = r;

            return circle;
        },
        'line' : function(xmlNode, parentNode){
            var line = new Line();
            if (parentNode) {
                _inheritStyle(parentNode, line);
            }
            _parseAttributes(xmlNode, line, this.defs);

            var x1 = parseFloat(xmlNode.getAttribute("x1") || 0);
            var y1 = parseFloat(xmlNode.getAttribute("y1") || 0);
            var x2 = parseFloat(xmlNode.getAttribute("x2") || 0);
            var y2 = parseFloat(xmlNode.getAttribute("y2") || 0);
            line.start.set(x1, y1);
            line.end.set(x2, y2);

            return line;
        },
        "ellipse" : function(xmlNode, parentNode) {
            var ellipse = new Ellipse();
            if (parentNode) {
                _inheritStyle(parentNode, ellipse);
            }
            _parseAttributes(xmlNode, ellipse, this.defs);

            var cx = parseFloat(xmlNode.getAttribute("cx") || 0);
            var cy = parseFloat(xmlNode.getAttribute("cy") || 0);
            var rx = parseFloat(xmlNode.getAttribute("rx") || 0);
            var ry = parseFloat(xmlNode.getAttribute("ry") || 0);

            ellipse.center.set(cx, cy);
            ellipse.radius.set(rx, ry);
            return ellipse;
        },
        'polygon' : function(xmlNode, parentNode) {
            var points = xmlNode.getAttribute("points");
            if (points) {
                points = _parsePoints(points);
            }
            var polygon = new Polygon({
                points : points
            });
            if (parentNode) {
                _inheritStyle(parentNode, polygon);
            }
            _parseAttributes(xmlNode, polygon, this.defs);

            return polygon;
        },
        'polyline' : function(xmlNode, parentNode) {
            var path = new Path();
            if (parentNode) {
                _inheritStyle(parentNode, path);
            }
            _parseAttributes(xmlNode, path, this.defs);

            var points = xmlNode.getAttribute("points");
            if (points) {
                points = _parsePoints(points);
                path.pushPoints(points);
            }

            return path;
        },
        'image' : function(xmlNode, parentNode) {

        },
        'text' : function(xmlNode, parentNode) {
            
        },
        "path" : function(xmlNode, parentNode) {
            var path = new SVGPath();
            if (parentNode) {
                _inheritStyle(parentNode, path);
            }
            _parseAttributes(xmlNode, path, this.defs);

            // TODO svg fill rule
            // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule
            // path.style.globalCompositeOperation = 'xor';

            var d = xmlNode.getAttribute("d") || "";
            path.description = d;

            return path;
        }
    }

    var defineParsers = {

        'lineargradient' : function(xmlNode) {
            var x1 = parseInt(xmlNode.getAttribute("x1") || 0);
            var y1 = parseInt(xmlNode.getAttribute("y1") || 0);
            var x2 = parseInt(xmlNode.getAttribute("x2") || 10);
            var y2 = parseInt(xmlNode.getAttribute("y2") || 0);

            var gradient = new LinearGradient();
            gradient.start.set(x1, y1);
            gradient.end.set(x2, y2);

            _parseGradientColorStops(xmlNode, gradient);

            return gradient;
        },

        'radialgradient' : function(xmlNode) {

        }
    }

    function _parseGradientColorStops(xmlNode, gradient){

        var stop = xmlNode.firstChild;

        while (stop) {
            if (stop.nodeType === 1) {
                var offset = stop.getAttribute("offset");
                if (offset.indexOf("%") > 0) {  // percentage
                    offset = parseInt(offset) / 100;
                } else if(offset) {    // number from 0 to 1
                    offset = parseFloat(offset);
                } else {
                    offset = 0;
                }

                var stopColor = stop.getAttribute("stop-color") || '#000000';

                gradient.addColorStop(offset, stopColor);
            }
            stop = stop.nextSibling;
        }
    }

    function _inheritStyle(parent, child) {
        child.stroke = parent.stroke;
        child.fill = parent.fill;
    }

    function _parsePoints(pointsString) {
        var list = pointsString.trim().replace(/,/g, " ").split(/\s+/);
        var points = [];

        for (var i = 0; i < list.length; i+=2) {
            var x = parseFloat(list[i]);
            var y = parseFloat(list[i+1]);
            points.push(new Vector2(x, y));
        }
        return points;
    }

    function _parseAttributes(xmlNode, node, defs) {
        _parseTransformAttribute(xmlNode, node);

        var styleList = {
            fill : xmlNode.getAttribute('fill'),
            stroke : xmlNode.getAttribute("stroke"),
            lineWidth : xmlNode.getAttribute("stroke-width"),
            opacity : xmlNode.getAttribute('opacity'),
            lineDash : xmlNode.getAttribute('stroke-dasharray'),
            lineDashOffset : xmlNode.getAttribute('stroke-dashoffset'),
            lineCap : xmlNode.getAttribute('stroke-linecap'),
            lineJoin : xmlNode.getAttribute('stroke-linjoin'),
            miterLimit : xmlNode.getAttribute("stroke-miterlimit")
        }

        _.extend(styleList, _parseStyleAttribute(xmlNode));

        node.style = new Style({
            fill : _getPaint(styleList.fill, defs),
            stroke : _getPaint(styleList.stroke, defs),
            lineWidth : parseFloat(styleList.lineWidth),
            opacity : parseFloat(styleList.opacity),
            lineDashOffset : styleList.lineDashOffset,
            lineCap : styleList.lineCap,
            lineJoin : styleList.lineJoin,
            miterLimit : parseFloat(styleList.miterLimit)
        });
        if (styleList.lineDash) {
            node.style.lineDash = styleList.lineDash.trim().split(/\s*,\s*/);
        }

        if (styleList.stroke && styleList.stroke !== "none") {
            // enable stroke
            node.stroke = true;
        }
    }


    var urlRegex = /url\(\s*#(.*?)\)/;
    function _getPaint(str, defs) {
        // if (str === 'none') {
        //     return;
        // }
        var urlMatch = urlRegex.exec(str);
        if (urlMatch) {
            var url = urlMatch[1].trim();
            var def = defs[url];
            return def;
        }
        return str;
    }

    var transformRegex = /(translate|scale|rotate|skewX|skewY|matrix)\(([\-\s0-9\.,]*)\)/g;

    function _parseTransformAttribute(xmlNode, node) {
        var transform = xmlNode.getAttribute("transform");
        if (transform) {
            var m = node.transform;
            m.identity();
            var transformOps = [];
            transform.replace(transformRegex, function(str, type, value){
                transformOps.push(type, value);
            })
            for(var i = transformOps.length-1; i > 0; i-=2){
                var value = transformOps[i];
                var type = transformOps[i-1];
                switch(type) {
                    case "translate":
                        value = value.trim().split(/\s+/);
                        m.translate(new Vector2(parseFloat(value[0]), parseFloat(value[1] || 0)));
                        break;
                    case "scale":
                        value = value.trim().split(/\s+/);
                        m.scale(new Vector2(parseFloat(value[0]), parseFloat(value[1] || value[0])));
                        break;
                    case "rotate":
                        value = value.trim().split(/\s*/);
                        m.rotate(parseFloat(value[0]));
                        break;
                    case "skew":
                        value = value.trim().split(/\s*/);
                        console.warn("Skew transform is not supported yet");
                        break;
                    case "matrix":
                        var value = value.trim().split(/\s*,\s*/);
                        var arr = m._array;
                        arr[0] = parseFloat(value[0]);
                        arr[1] = parseFloat(value[1]);
                        arr[2] = parseFloat(value[2]);
                        arr[3] = parseFloat(value[3]);
                        arr[4] = parseFloat(value[4]);
                        arr[5] = parseFloat(value[5]);
                        break;
                }
            }
        }
        node.autoUpdate = false;
    }

    var styleRegex = /(\S*?):(.*?);/g;
    function _parseStyleAttribute(xmlNode) {
        var style = xmlNode.getAttribute("style");

        if (style) {
            var styleList = {};
            style = style.replace(/\s*([;:])\s*/g, "$1");
            style.replace(styleRegex, function(str, key, val){
                styleList[key] = val;
            });

            return {
                fill : styleList['fill'],
                stroke : styleList['stroke'],
                lineWidth : styleList['stroke-width'],
                opacity : styleList['opacity'],
                lineDash : styleList['stroke-dasharray'],
                lineDashOffset : styleList['stroke-dashoffset'],
                lineCap : styleList['stroke-linecap'],
                lineJoin : styleList['stroke-linjoin'],
                miterLimit : styleList['stroke-miterlimit']
            }
        }
        return {};
    }

    function _parseCSSRules(doc) {

    }


    return Loader
});
/**
 * Load three.js JSON Format model
 *
 * Format specification : https://github.com/mrdoob/three.js/wiki/JSON-Model-format-3.1
 */
define('qtek/loader/three/Model',['require','../../core/Base','../../core/request','../../core/util','../../Shader','../../Material','../../DynamicGeometry','../../Mesh','../../Node','../../texture/Texture2D','../../texture/TextureCube','../../shader/library','../../Skeleton','../../Joint','../../math/Vector3','../../math/Quaternion','../../core/glenum','../../animation/SkinningClip','glmatrix'],function(require) {

    var Base = require('../../core/Base');

    var request = require("../../core/request");
    var util = require('../../core/util');
    var Shader = require("../../Shader");
    var Material = require("../../Material");
    var DynamicGeometry = require("../../DynamicGeometry");
    var Mesh = require("../../Mesh");
    var Node = require("../../Node");
    var Texture2D = require("../../texture/Texture2D");
    var TextureCube = require("../../texture/TextureCube");
    var shaderLibrary = require("../../shader/library");
    var Skeleton = require("../../Skeleton");
    var Joint = require("../../Joint");
    var Vector3 = require("../../math/Vector3");
    var Quaternion = require("../../math/Quaternion");
    var glenum = require('../../core/glenum');
    var SkinningClip = require('../../animation/SkinningClip');

    var glMatrix = require("glmatrix");
    var vec3 = glMatrix.vec3;
    var vec2 = glMatrix.vec2;
    var quat = glMatrix.quat;

    var Loader = Base.derive(function() {
        return {
            rootPath : "",
            textureRootPath : "",
            textureNumber : 0
        };
    }, {
        load : function(url) {
            var self = this;
            this.textureNumber = 0;

            if (!this.rootPath) {
                this.rootPath = url.slice(0, url.lastIndexOf("/"));
            }

            request.get({
                url : url,
                onprogress : function(percent, loaded, total) {
                    self.trigger("progress", percent, loaded, total);
                },
                onerror : function(e) {
                    self.trigger("error", e);
                },
                responseType : "text",
                onload : function(data) {
                    self.parse(JSON.parse(data));
                }
            })
        },
        parse : function(data) {
            
            var geometryList = this.parseGeometry(data);

            var dSkinIndices = data.skinIndices,
                dSkinWeights = data.skinWeights;
            var skinned = dSkinIndices && dSkinIndices.length
                        && dSkinWeights && dSkinWeights.length;

            if (skinned) {
                var skeleton = this.parseSkeleton(data);
                var jointNumber = skeleton.joints.length;
            }else{
                var jointNumber = 0;
            }

            if (skinned) {
                var skeleton = this.parseSkeleton(data);
                var jointNumber = skeleton.joints.length;
            }else{
                var jointNumber = 0;
            }

            var meshList = [];
            for (var i = 0; i < data.materials.length; i++) {
                var geometry = geometryList[i];
                if (geometry 
                    && geometry.faces.length 
                    && geometry.attributes.position.value.length) {
                    geometry.updateBoundingBox();
                    var material = this.parseMaterial(data.materials[i], jointNumber);
                    var mesh = new Mesh({
                        geometry : geometryList[i],
                        material : material
                    }) ;
                    if (skinned) {
                        mesh.skeleton = skeleton;
                        for (var i = 0; i < skeleton.joints.length; i++) {
                            // Use all the joints of skeleton
                            mesh.joints[i] = i;
                        }
                    }
                    meshList.push(mesh);
                }
            }
            
            this.trigger('success', meshList);

            return meshList;
        },

        parseGeometry : function(data) {

            var geometryList = [];
            var cursorList = [];
            
            for (var i = 0; i < data.materials.length; i++) {
                geometryList[i] = null;
                cursorList[i] = 0;
            }
            geometryList[0] = new DynamicGeometry();

            var faceMaterial = data.materials && data.materials.length > 1;

            var dFaces = data.faces;
            var dVertices = data.vertices;
            var dNormals = data.normals;
            var dColors = data.colors;
            var dSkinIndices = data.skinIndices;
            var dSkinWeights = data.skinWeights;
            var dUvs = data.uvs;

            var skinned = dSkinIndices && dSkinIndices.length
                        && dSkinWeights && dSkinWeights.length;

            var geometry = geometryList[0];
            var attributes = geometry.attributes;
            var positions = attributes.position.value;
            var normals = attributes.normal.value;
            var texcoords = [attributes.texcoord0.value,
                            attributes.texcoord1.value];
            var colors = attributes.color.value;
            var jointIndices = attributes.joint.value;
            var jointWeights = attributes.weight.value;
            var faces = geometry.faces;

            var nUvLayers = 0;
            if (dUvs[0] && dUvs[0].length) {
                nUvLayers++;
            }
            if (dUvs[1] && dUvs[1].length) {
                nUvLayers++;
            }

            var offset = 0;
            var len = dFaces.length;

            // Cache the reorganized index
            var newIndexMap = [];
            var geoIndexMap = [];
            for (var i = 0; i < dVertices.length; i++) {
                newIndexMap[i] = -1;
                geoIndexMap[i] = -1;
            }

            var currentGeometryIndex = 0;
            var isNew = [];
            function getNewIndex(oi, faceIndex) {
                if ( newIndexMap[oi] >= 0) {
                    // Switch to the geometry of existed index 
                    currentGeometryIndex = geoIndexMap[oi];
                    geometry = geometryList[currentGeometryIndex];
                    attributes = geometry.attributes;
                    positions = attributes.position.value;
                    normals = attributes.normal.value;
                    texcoords = [attributes.texcoord0.value,
                                attributes.texcoord1.value];
                    colors = attributes.color.value;
                    jointWeights = attributes.weight.value;
                    jointIndices = attributes.joint.value;

                    isNew[faceIndex] = false;
                    return newIndexMap[oi];
                }else{

                    positions.push([dVertices[oi*3], dVertices[oi*3+1], dVertices[oi*3+2]]);
                    //Skin data
                    if (skinned) {
                        jointWeights.push([dSkinWeights[oi*2], dSkinWeights[oi*2+1], 0]);
                        jointIndices.push([dSkinIndices[oi*2], dSkinIndices[oi*2+1], -1, -1]);
                    }

                    newIndexMap[oi] = cursorList[materialIndex];
                    geoIndexMap[oi] = materialIndex;

                    isNew[faceIndex] = true;
                    return cursorList[materialIndex]++;
                }
            }
            // Put the vertex data of one face here
            // Incase the program create amount of tmp arrays and cause
            // GC bottleneck
            var faceUvs = [];
            var faceNormals = [];
            var faceColors = [];
            for (var i =0; i < 4; i++) {
                faceUvs[i] = [0, 0];
                faceNormals[i] = [0, 0, 0];
                faceColors[i] = [0, 0, 0];
            }
            var materialIndex = 0;

            while (offset < len) {
                var type = dFaces[offset++];
                var isQuad = isBitSet(type, 0),
                    hasMaterial = isBitSet(type, 1),
                    hasFaceUv = isBitSet(type, 2),
                    hasFaceVertexUv = isBitSet(type, 3),
                    hasFaceNormal = isBitSet(type, 4),
                    hasFaceVertexNormal = isBitSet(type, 5),
                    hasFaceColor = isBitSet(type, 6),
                    hasFaceVertexColor = isBitSet(type, 7);

                var nVertices = isQuad ? 4 : 3;

                if (hasMaterial) {
                    materialIndex = dFaces[ offset+ (isQuad ? 4 : 3) ];
                    if ( ! geometryList[materialIndex] ) {
                        geometryList[materialIndex] = new DynamicGeometry();
                    }
                    geometry = geometryList[materialIndex];
                    attributes = geometry.attributes;
                    positions = attributes.position.value;
                    normals = attributes.normal.value;
                    texcoords = [attributes.texcoord0.value,
                                attributes.texcoord1.value];
                    colors = attributes.color.value;
                    jointWeights = attributes.weight.value;
                    jointIndices = attributes.joint.value;
                    faces = geometry.faces;
                }
                if (isQuad) {
                    // Split into two triangle faces, 1-2-4 and 2-3-4
                    var i1o = dFaces[offset++],
                        i2o = dFaces[offset++],
                        i3o = dFaces[offset++],
                        i4o = dFaces[offset++];
                    // Face1
                    var i1 = getNewIndex(i1o, 0),
                        i2 = getNewIndex(i2o, 1),
                        i3 = getNewIndex(i4o, 2),
                    // Face2
                        i4 = getNewIndex(i2o, 3),
                        i5 = getNewIndex(i3o, 4),
                        i6 = getNewIndex(i4o, 5);
                    faces.push([i1, i2, i3], [i4, i5, i6]);
                } else {
                    var i1 = dFaces[offset++],
                        i2 = dFaces[offset++],
                        i3 = dFaces[offset++];
                    i1 = getNewIndex(i1, 0);
                    i2 = getNewIndex(i2, 1);
                    i3 = getNewIndex(i3, 2);
                    faces.push([i1, i2, i3]);
                }
                if (hasMaterial) {
                    offset++;
                }
                if (hasFaceUv) {
                    for (var i = 0; i < nUvLayers; i++) {
                        var uvLayer = dUvs[i];
                        var uvIndex = faces[offset++];
                        var u = uvLayer[uvIndex*2];
                        var v = uvLayer[uvIndex*2+1];
                        if (isQuad) {
                            // Random write of array seems not slow
                            // http://jsperf.com/random-vs-sequence-array-set
                            isNew[0] && (texcoords[i][i1] = [u, v]);
                            isNew[1] && (texcoords[i][i2] = [u, v]);
                            isNew[2] && (texcoords[i][i3] = [u, v]);
                            isNew[3] && (texcoords[i][i4] = [u, v]);
                            isNew[4] && (texcoords[i][i5] = [u, v]);
                            isNew[5] && (texcoords[i][i6] = [u, v]);
                        } else {
                            isNew[0] && (texcoords[i][i1] = [u, v]);
                            isNew[1] && (texcoords[i][i2] = [u, v]);
                            isNew[2] && (texcoords[i][i3] = [u, v]);
                        }
                    }
                }
                if (hasFaceVertexUv) {
                    for (var i = 0; i < nUvLayers; i++) {
                        var uvLayer = dUvs[i];
                        for (var j = 0; j < nVertices; j++) {
                            var uvIndex = dFaces[offset++];
                            faceUvs[j][0] = uvLayer[uvIndex*2];
                            faceUvs[j][1] = uvLayer[uvIndex*2+1];
                        }
                        if (isQuad) {
                            // Use array slice to clone array is incredibly faster than 
                            // Construct from Float32Array
                            // http://jsperf.com/typedarray-v-s-array-clone/2
                            isNew[0] && (texcoords[i][i1] = faceUvs[0].slice());
                            isNew[1] && (texcoords[i][i2] = faceUvs[1].slice());
                            isNew[2] && (texcoords[i][i3] = faceUvs[3].slice());
                            isNew[3] && (texcoords[i][i4] = faceUvs[1].slice());
                            isNew[4] && (texcoords[i][i5] = faceUvs[2].slice());
                            isNew[5] && (texcoords[i][i6] = faceUvs[3].slice());
                        } else {
                            isNew[0] && (texcoords[i][i1] = faceUvs[0].slice());
                            isNew[1] && (texcoords[i][i2] = faceUvs[1].slice());
                            isNew[2] && (texcoords[i][i3] = faceUvs[2].slice());
                        }
                    }
                }
                if (hasFaceNormal) {
                    var normalIndex = dFaces[offset++]*3;
                    var x = dNormals[normalIndex++];
                    var y = dNormals[normalIndex++];
                    var z = dNormals[normalIndex];
                    if (isQuad) {
                        isNew[0] && (normals[i1] = [x, y, z]);
                        isNew[1] && (normals[i2] = [x, y, z]);
                        isNew[2] && (normals[i3] = [x, y, z]);
                        isNew[3] && (normals[i4] = [x, y, z]);
                        isNew[4] && (normals[i5] = [x, y, z]);
                        isNew[5] && (normals[i6] = [x, y, z]);
                    }else{
                        isNew[0] && (normals[i1] = [x, y, z]);
                        isNew[1] && (normals[i2] = [x, y, z]);
                        isNew[2] && (normals[i3] = [x, y, z]);
                    }
                }
                if (hasFaceVertexNormal) {
                    for (var i = 0; i < nVertices; i++) {
                        var normalIndex = dFaces[offset++]*3;
                        faceNormals[i][0] = dNormals[normalIndex++];
                        faceNormals[i][1] = dNormals[normalIndex++];
                        faceNormals[i][2] = dNormals[normalIndex];
                    }
                    if (isQuad) {
                        isNew[0] && (normals[i1] = faceNormals[0].slice());
                        isNew[1] && (normals[i2] = faceNormals[1].slice());
                        isNew[2] && (normals[i3] = faceNormals[3].slice());
                        isNew[3] && (normals[i4] = faceNormals[1].slice());
                        isNew[4] && (normals[i5] = faceNormals[2].slice());
                        isNew[5] && (normals[i6] = faceNormals[3].slice());
                    } else {
                        isNew[0] && (normals[i1] = faceNormals[0].slice());
                        isNew[1] && (normals[i2] = faceNormals[1].slice());
                        isNew[2] && (normals[i3] = faceNormals[2].slice());
                    }
                }
                if (hasFaceColor) {
                    var colorIndex = dFaces[offset++];
                    var color = hex2rgb(dColors[colorIndex]);
                    if (isQuad) {
                        // Does't clone the color here
                        isNew[0] && (colors[i1] = color);
                        isNew[1] && (colors[i2] = color);
                        isNew[2] && (colors[i3] = color);
                        isNew[3] && (colors[i4] = color);
                        isNew[4] && (colors[i5] = color);
                        isNew[5] && (colors[i6] = color);
                    } else {
                        isNew[0] && (colors[i1] = color);
                        isNew[1] && (colors[i2] = color);
                        isNew[2] && (colors[i3] = color);
                    }
                }
                if (hasFaceVertexColor) {
                    for (var i = 0; i < nVertices; i++) {
                        var colorIndex = dFaces[offset++];
                        faceColors[i] = hex2rgb(dColors[colorIndex]);
                    }
                    if (isQuad) {
                        isNew[0] && (colors[i1] = faceColors[0].slice());
                        isNew[1] && (colors[i2] = faceColors[1].slice());
                        isNew[2] && (colors[i3] = faceColors[3].slice());
                        isNew[3] && (colors[i4] = faceColors[1].slice());
                        isNew[4] && (colors[i5] = faceColors[2].slice());
                        isNew[5] && (colors[i6] = faceColors[3].slice());
                    } else {
                        isNew[0] && (colors[i1] = faceColors[0].slice());
                        isNew[1] && (colors[i2] = faceColors[1].slice());
                        isNew[2] && (colors[i3] = faceColors[2].slice());
                    }
                }
            }

            return geometryList;
        },

        parseSkeleton : function(data) {
            var joints = [];
            var dBones = data.bones;
            for ( var i = 0; i < dBones.length; i++) {
                var dBone = dBones[i];
                var joint = new Joint({
                    index : i,
                    parentIndex : dBone.parent,
                    name : dBone.name
                });
                joint.node = new Node({
                    name : dBone.name,
                    position : new Vector3(dBone.pos[0], dBone.pos[1], dBone.pos[2]),
                    rotation : new Quaternion(dBone.rotq[0], dBone.rotq[1], dBone.rotq[2], dBone.rotq[3]),
                    scale : new Vector3(dBone.scl[0], dBone.scl[1], dBone.scl[2])
                })
                joints.push(joint);
            }

            var skeleton = new Skeleton({
                joints : joints
            });
            skeleton.updateHierarchy();
            skeleton.updateJointMatrices();
            skeleton.update();

            if (data.animation) {
                var dFrames = data.animation.hierarchy;

                var jointClips = [];
                // Parse Animations
                for (var i = 0; i < dFrames.length; i++) {
                    var channel = dFrames[i];
                    var jointPose = jointClips[i] = {
                        keyFrames : []
                    };
                    jointPose.name = joints[i].name;
                    for (var j = 0; j < channel.keys.length; j++) {
                        var key = channel.keys[j];
                        jointPose.keyFrames[j] = {};
                        var kf = jointPose.keyFrames[j];
                        kf.time = parseFloat(key.time) * 1000;
                        if (key.pos) {
                            kf.position = vec3.fromValues(key.pos[0], key.pos[1], key.pos[2]);
                        }
                        if (key.rot) {
                            kf.rotation = quat.fromValues(key.rot[0], key.rot[1], key.rot[2], key.rot[3]);
                        }
                        if (key.scl) {
                            kf.scale = vec3.fromValues(key.scl[0], key.scl[1], key.scl[2]);
                        }
                    }
                }

                var skinningClip = new SkinningClip({
                    jointClips : jointClips
                });

                skeleton.addClip(skinningClip);
            }

            return skeleton;
        },

        parseMaterial : function(mConfig, jointNumber) {
            var shaderName = "buildin.lambert";
            var shading = mConfig.shading && mConfig.shading.toLowerCase();
            if (shading === "phong" || shading === "lambert") {
                shaderName = "buildin." + shading;
            }
            var enabledTextures = [];
            if (mConfig.mapDiffuse) {
                enabledTextures.push("diffuseMap");
            }
            if (mConfig.mapNormal || mConfig.mapBump) {
                enabledTextures.push('normalMap');
            }
            if (jointNumber == 0) {
                var shader = shaderLibrary.get(shaderName, enabledTextures);
            } else {
                // Shader for skinned mesh
                var shader = new Shader({
                    vertex : Shader.source(shaderName+".vertex"),
                    fragment : Shader.source(shaderName+".fragment")
                })
                for (var i = 0; i < enabledTextures; i++) {
                    shader.enableTexture(enabledTextures[i]);
                }
                shader.define('vertex', "SKINNING");
                shader.define('vertex', "JOINT_NUMBER", jointNumber);
            }

            var material = new Material({
                shader : shader
            });
            if (mConfig.colorDiffuse) {
                material.set("color", mConfig.colorDiffuse );
            } else if (mConfig.DbgColor) {
                material.set("color", hex2rgb(mConfig.DbgColor));
            }
            if (mConfig.colorSpecular) {
                material.set("specular", mConfig.colorSpecular );
            }
            if (mConfig.transparent !== undefined && mConfig.transparent) {
                material.transparent = true;
            }
            if (mConfig.depthTest !== undefined) {
                material.depthTest = mConfig.depthTest;
            }
            if (mConfig.depthWrite !== undefined) {
                material.depthMask = mConfig.depthWrite;
            }
            
            if (mConfig.transparency && mConfig.transparency < 1) {
                material.set("opacity", mConfig.transparency);
            }
            if (mConfig.specularCoef) {
                material.set("shininess", mConfig.specularCoef);
            }

            // Textures
            if (mConfig.mapDiffuse) {
                material.set("diffuseMap", this.loadTexture(mConfig.mapDiffuse, mConfig.mapDiffuseWrap) );
            }
            if (mConfig.mapBump) {
                material.set("normalMap", this.loadTexture(mConfig.mapBump, mConfig.mapBumpWrap) );
            }
            if (mConfig.mapNormal) {
                material.set("normalMap", this.loadTexture(mConfig.mapNormal, mConfig.mapBumpWrap) );
            }

            return material;
        },

        loadTexture : function(path, wrap) {
            var self = this;

            var img = new Image();
            var texture = new Texture2D();
            texture.image = img;

            this.textureNumber++;

            if (wrap && wrap.length) {
                texture.wrapS = glenum[wrap[0].toUpperCase()];
                texture.wrapT = glenum[wrap[1].toUpperCase()];
            }
            img.onload = function() {
                texture.dirty();
            }
            var root = this.textureRootPath || this.rootPath;
            img.src = util.relative2absolute(path, root);

            return texture;
        }
    })


    function isBitSet(value, position) {
        return value & ( 1 << position );
    }


    function hex2rgb(hex) {
        var r = (hex >> 16) & 0xff,
            g = (hex >> 8) & 0xff,
            b = hex & 0xff;
        return [r/255, g/255, b/255];
    }

    function translateColor(color) {
        return [color[0]/255, color[1]/255, color[2]/255];
    }

    return Loader
} );
define('qtek/math/Matrix2',['require','glmatrix'],function(require) {

    

    var glMatrix = require("glmatrix");
    var mat2 = glMatrix.mat2;

    function makeProperty(n) {
        return {
            configurable : false,
            set : function(value) {
                this._array[n] = value;
                this._dirty = true;
            },
            get : function() {
                return this._array[n];
            }
        }
    }

    var Matrix2 = function() {

        this._array = mat2.create();
    };

    Matrix2.prototype = {

        constructor : Matrix2,

        clone : function() {
            return (new Matrix2()).copy(this);
        },
        copy : function(b) {
            mat2.copy(this._array, b._array);
            return this;
        },
        adjoint : function() {
            mat2.adjoint(this._array, this._array);
            return this;
        },
        determinant : function() {
            return mat2.determinant(this._array);
        },
        identity : function() {
            mat2.identity(this._array);
            return this;
        },
        invert : function() {
            mat2.invert(this._array, this._array);
            return this;
        },
        mul : function(b) {
            mat2.mul(this._array, this._array, b._array);
            return this;
        },
        mulLeft : function(b) {
            mat2.mul(this._array, b._array, this._array);
            return this;
        },
        multiply : function(b) {
            mat2.multiply(this._array, this._array, b._array);
            return this;
        },
        multiplyLeft : function(b) {
            mat2.multiply(this._array, b._array, this._array);
            return this;
        },
        rotate : function(rad) {
            mat2.rotate(this._array, this._array, rad);
            return this;
        },
        scale : function(s) {
            mat2.scale(this._array, this._array, s);
        },
        toString : function() {
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    Matrix2.adjoint = function(out, a) {
        mat2.adjoint(out._array, a._array);
        return out;
    }

    Matrix2.copy = function(out, a) {
        mat2.copy(out._array, a._array);
        return out;
    }

    Matrix2.determinant = function(a) {
        return mat2.determinant(a._array);
    }

    Matrix2.identity = function(out) {
        mat2.identity(out._array);
        return out;
    }

    Matrix2.invert = function(out, a) {
        mat2.invert(out._array, a._array);
        return out;
    }

    Matrix2.mul = function(out, a, b) {
        mat2.mul(out._array, a._array, b._array);
        return out;
    }

    Matrix2.multiply = Matrix2.mul;

    Matrix2.rotate = function(out, a, rad) {
        mat2.rotate(out._array, a._array, rad);
        return out;
    }

    Matrix2.scale = function(out, a, v) {
        mat2.scale(out._array, a._array, v._array);
        return out;
    }

    Matrix2.transpose = function(out, a) {
        mat2.transpose(out._array, a._array);
        return out;
    }

    return Matrix2;
});
define('qtek/math/Value',['require','./Vector3','./Vector2'],function(require) {

    var Vector3 = require('./Vector3');
    var Vector2 = require('./Vector2');

    var Value = function() {};
    Value.prototype.get = function() {};
    Value.prototype.set = function(val) {};

    // Constant
    var ConstantValue = function(val) {
        this.get = function() {
            return val;
        }
    }
    ConstantValue.prototype = new Value();
    ConstantValue.prototype.constructor = ConstantValue;

    // Vector
    var VectorValue = function(val) {
        var Constructor = val.constructor;
        this.get = function(out) {
            if (!out) {
                out = new Constructor();
            }
            out.copy(val);
            return out;
        }
    }
    VectorValue.prototype = new Value();
    VectorValue.prototype.constructor = VectorValue;
    //Random 1D
    var Random1D = function(min, max) {
        var range = max - min;
        this.get = function() {
            return Math.random() * range + min;
        }
    }
    Random1D.prototype = new Value();
    Random1D.prototype.constructor = Random1D;

    // Random2D
    var Random2D = function(min, max) {
        var rangeX = max.x - min.x;
        var rangeY = max.y - min.y;

        this.get = function(out) {
            if (!out) {
                out = new Vector2();
            }
            out.set(
                rangeX * Math.random() + min._array[0],
                rangeY * Math.random() + min._array[1]
            );

            return out;
        }
    }
    Random2D.prototype = new Value();
    Random2D.prototype.constructor = Random2D;

    var Random3D = function(min, max) {
        var rangeX = max.x - min.x;
        var rangeY = max.y - min.y;
        var rangeZ = max.z - min.z;

        this.get = function(out) {
            if (!out) {
                out = new Vector3();
            }
            out.set(
                rangeX * Math.random() + min._array[0],
                rangeY * Math.random() + min._array[1],
                rangeZ * Math.random() + min._array[2]
            );

            return out;
        }
    }
    Random3D.prototype = new Value()
    Random3D.prototype.constructor = Random3D;

    // Factory methods
    Value.constant = function(constant) {
        return new ConstantValue(constant);
    }
    Value.vector = function(vector) {
        return new VectorValue(vector);
    }

    Value.random1D = function(min, max) {
        return new Random1D(min, max);
    }

    Value.random2D = function(min, max) {
        return new Random2D(min, max);
    }

    Value.random3D = function(min, max) {
        return new Random3D(min, max);
    }

    return Value;
});
define('qtek/math/Vector4',['require','glmatrix'], function(require) {

    

    var glMatrix = require("glmatrix");
    var vec4 = glMatrix.vec4;

    var Vector4 = function(x, y, z, w) {
        
        x = x || 0;
        y = y || 0;
        z = z || 0;
        w = w || 0;

        this._array = vec4.fromValues(x, y, z, w);
        // Dirty flag is used by the Node to determine
        // if the matrix is updated to latest
        this._dirty = true;
    }

    Vector4.prototype = {

        constructor : Vector4,

        get x() {
            return this._array[0];
        },

        set x(value) {
            this._array[0] = value;
            this._dirty = true;
        },

        get y() {
            this._array[1] = value;
            this._dirty = true;
        },

        set y(value) {
            return this._array[1];
        },

        get z() {
            return this._array[2];
        },

        set z(value) {
            this._array[2] = value;
            this._dirty = true;
        },

        get w() {
            return this._array[3];
        },

        set w(value) {
            this._array[3] = value;
            this._dirty = true;
        },

        add : function(b) {
            vec4.add( this._array, this._array, b._array );
            this._dirty = true;
            return this;
        },

        set : function(x, y, z, w) {
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._array[3] = w;
            this._dirty = true;
            return this;
        },

        setArray : function(arr) {
            this._array[0] = arr[0];
            this._array[1] = arr[1];
            this._array[2] = arr[2];
            this._array[3] = arr[3];

            this._dirty = true;
            return this;
        },

        clone : function() {
            return new Vector4( this.x, this.y, this.z, this.w);
        },

        copy : function(b) {
            vec4.copy( this._array, b._array );
            this._dirty = true;
            return this;
        },

        dist : function(b) {
            return vec4.dist(this._array, b._array);
        },

        distance : function(b) {
            return vec4.distance(this._array, b._array);
        },

        div : function(b) {
            vec4.div(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        divide : function(b) {
            vec4.divide(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        dot : function(b) {
            return vec4.dot(this._array, b._array);
        },

        len : function() {
            return vec4.len(this._array);
        },

        length : function() {
            return vec4.length(this._array);
        },
        /**
         * Perform linear interpolation between a and b
         */
        lerp : function(a, b, t) {
            vec4.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        min : function(b) {
            vec2.min(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        max : function(b) {
            vec2.max(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        mul : function(b) {
            vec4.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        multiply : function(b) {
            vec4.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        negate : function() {
            vec4.negate(this._array, this._array);
            this._dirty = true;
            return this;
        },

        normalize : function() {
            vec4.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },

        random : function(scale) {
            vec4.random(this._array, scale);
            this._dirty = true;
            return this;
        },

        scale : function(s) {
            vec4.scale(this._array, this._array, s);
            this._dirty = true;
            return this;
        },
        /**
         * add b by a scaled factor
         */
        scaleAndAdd : function(b, s) {
            vec4.scaleAndAdd(this._array, this._array, b._array, s);
            this._dirty = true;
            return this;
        },

        sqrDist : function(b) {
            return vec4.sqrDist(this._array, b._array);
        },

        squaredDistance : function(b) {
            return vec4.squaredDistance(this._array, b._array);
        },

        sqrLen : function() {
            return vec4.sqrLen(this._array);
        },

        squaredLength : function() {
            return vec4.squaredLength(this._array);
        },

        sub : function(b) {
            vec4.sub(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        subtract : function(b) {
            vec4.subtract(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        transformMat4 : function(m) {
            vec4.transformMat4(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },

        transformQuat : function(q) {
            vec4.transformQuat(this._array, this._array, q._array);
            this._dirty = true;
            return this;
        },     

        toString : function() {
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    // Supply methods that are not in place
    Vector4.add = function(out, a, b) {
        vec4.add(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector4.set = function(out, x, y, z, w) {
        vec4.set(out._array, x, y, z, w);
        out._dirty = true;
    }

    Vector4.copy = function(out, b) {
        vec4.copy(out._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector4.dist = function(a, b) {
        return vec4.distance(a._array, b._array);
    }

    Vector4.distance = Vector4.dist;

    Vector4.div = function(out, a, b) {
        vec4.divide(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector4.divide = Vector4.div;

    Vector4.dot = function(a, b) {
        return vec4.dot(a._array, b._array);
    }

    Vector4.len = function(b) {
        return vec4.length(b._array);
    }

    // Vector4.length = Vector4.len;

    Vector4.lerp = function(out, a, b, t) {
        vec4.lerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    }

    Vector4.min = function(out, a, b) {
        vec4.min(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector4.max = function(out, a, b) {
        vec4.max(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector4.mul = function(out, a, b) {
        vec4.multiply(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }

    Vector4.multiply = Vector4.mul;

    Vector4.negate = function(out, a) {
        vec4.negate(out._array, a._array);
        out._dirty = true;
        return out;
    }

    Vector4.normalize = function(out, a) {
        vec4.normalize(out._array, a._array);
        out._dirty = true;
        return out;
    }

    Vector4.random = function(out, scale) {
        vec4.random(out._array, scale);
        out._dirty = true;
        return out;
    }

    Vector4.scale = function(out, a, scale) {
        vec4.scale(out._array, a._array, scale);
        out._dirty = true;
        return out;
    }

    Vector4.scaleAndAdd = function(out, a, b, scale) {
        vec4.scale(out._array, a._array, b._array, scale);
        out._dirty = true;
        return out;
    }

    Vector4.sqrDist = function(a, b) {
        return vec4.sqrDist(a._array, b._array);
    }

    Vector4.squaredDistance = Vector4.sqrDist;

    Vector4.sqrLen = function(a) {
        return vec4.sqrLen(a._array);
    }
    Vector4.squaredLength = Vector4.sqrLen;

    Vector4.sub = function(out, a, b) {
        vec4.subtract(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    }
    Vector4.subtract = Vector4.sub;

    Vector4.transformMat4 = function(out, a, m) {
        vec4.transformMat4(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    }

    Vector4.transformQuat = function(out, a, q) {
        vec4.transformQuat(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    }

    return Vector4;
} );
define('qtek/particleSystem/Particle',['require','../math/Vector3','glmatrix'],function(require) {

    var Vector3 = require('../math/Vector3');
    var glMatrix = require('glmatrix');
    var vec3 = glMatrix.vec3;

    var Particle = function() {
        
        this.position = new Vector3();

        // Use euler angle to represent rotation
        this.rotation = new Vector3();

        this.velocity = null;

        this.angularVelocity = null;

        this.life = 1;

        this.age = 0;

        this.spriteSize = 1;

        this.weight = 1;

        this.emitter = null;
    }

    Particle.prototype.update = function(deltaTime) {
        if (this.velocity) {
            vec3.scaleAndAdd(this.position._array, this.position._array, this.velocity._array, deltaTime);
        }
        if (this.angularVelocity) {
            vec3.scaleAndAdd(this.rotation._array, this.rotation._array, this.angularVelocity._array, deltaTime);
        }
    }

    return Particle;
});
define('qtek/particleSystem/Emitter',['require','../core/Base','../math/Vector3','./Particle','../math/Value','glmatrix'],function(require) {

    var Base = require('../core/Base');
    var Vector3 = require('../math/Vector3');
    var Particle = require('./Particle');
    var Value = require('../math/Value');
    var glMatrix = require('glmatrix');
    var vec3 =  glMatrix.vec3;

    var Emitter = Base.derive({

        max : 1000,
        amount : 20,

        // Init status for each particle
        life : null,
        position : null,
        rotation : null,
        velocity : null,
        angularVelocity : null,
        spriteSize : null,
        weight : null,

        _particlePool : null
        
    }, function() {
        
        this._particlePool = [];

        // TODO Reduce heap memory
        for (var i = 0; i < this.max; i++) {
            var particle = new Particle();
            particle.emitter = this;
            this._particlePool.push(particle);

            if (this.velocity) {
                particle.velocity = new Vector3();
            }
            if (this.angularVelocity) {
                particle.angularVelocity = new Vector3();
            }
        }

    }, {

        emit : function(out) {
            var amount = Math.min(this._particlePool.length, this.amount);

            var particle;
            for (var i = 0; i < amount; i++) {
                particle = this._particlePool.pop();
                // Initialize particle status
                if (this.position) {
                    this.position.get(particle.position);
                }
                if (this.rotation) {
                    this.rotation.get(particle.rotation);
                }
                if (this.velocity) {
                    this.velocity.get(particle.velocity);
                }
                if (this.angularVelocity) {
                    this.angularVelocity.get(particle.angularVelocity);
                }
                if (this.life) {
                    particle.life = this.life.get();
                }
                if (this.spriteSize) {
                    particle.spriteSize = this.spriteSize.get();
                }
                if (this.weight) {
                    particle.weight = this.weight.get();
                }
                particle.age = 0;

                out.push(particle);
            }
        },

        kill : function(particle) {
            this._particlePool.push(particle);
        }
    });
    
    Emitter.constant = Value.constant;
    Emitter.vector = Value.vector;
    Emitter.random1D = Value.random1D;
    Emitter.random2D = Value.random2D;
    Emitter.random3D = Value.random3D;

    return Emitter;
});
define('qtek/particleSystem/ForceField',['require','../core/Base','../math/Vector3','glmatrix'],function(require) {

    var Base = require('../core/Base');
    var Vector3 = require('../math/Vector3');
    var glMatrix = require('glmatrix');
    var vec3 =  glMatrix.vec3;

    var ForceField = Base.derive(function() {
        return {
            force : new Vector3()
        }
    }, {
        applyTo : function(velocity, position, weight, deltaTime) {
            if (weight > 0) {
                vec3.scaleAndAdd(velocity._array, velocity._array, this.force._array, deltaTime / weight);
            }
        }
    });

    return ForceField;
});
define('qtek/particleSystem/GravityField',['require','../core/Base','../math/Vector3','glmatrix'],function(require) {

    var Base = require('../core/Base');
    var Vector3 = require('../math/Vector3');
    var glMatrix = require('glmatrix');
    var vec3 =  glMatrix.vec3;

    var GravityField = Base.derive(function() {
        return {
            gravity : new Vector3(0, -10, 0)
        }
    }, {
        applyTo : function(velocity, position, weight, deltaTime) {
            if (weight > 0) {
                vec3.scaleAndAdd(velocity._array, velocity._array, this.gravity._array, deltaTime);
            }
        }
    });

    return GravityField;
});
define('qtek/particleSystem/particle.essl',[],function () { return '@export buildin.particle.vertex\n\nuniform mat4 worldView : WORLDVIEW;\nuniform mat4 projection : PROJECTION;\n\nattribute vec3 position : POSITION;\nattribute vec3 normal : NORMAL;\n\n#ifdef UV_ANIMATION\nattribute vec2 texcoord0 : TEXCOORD_0;\nattribute vec2 texcoord1 : TEXCOORD_1;\n\nvarying vec2 v_Uv0;\nvarying vec2 v_Uv1;\n#endif\n\nvarying float v_Age;\n\nvoid main() {\n    v_Age = normal.x;\n    float rotation = normal.y;\n\n    vec4 worldViewPosition = worldView * vec4(position, 1.0);\n    gl_Position = projection * worldViewPosition;\n    float w = gl_Position.w;\n    // TODO\n    gl_PointSize = normal.z * projection[0].x / w;\n\n    #ifdef UV_ANIMATION\n        v_Uv0 = texcoord0;\n        v_Uv1 = texcoord1;\n    #endif\n}\n\n@end\n\n@export buildin.particle.fragment\n\nuniform sampler2D sprite;\nuniform sampler2D gradient;\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\nvarying float v_Age;\n\n#ifdef UV_ANIMATION\nvarying vec2 v_Uv0;\nvarying vec2 v_Uv1;\n#endif\n\nvoid main() {\n    vec4 color = vec4(color, alpha);\n    #ifdef SPRITE_ENABLED\n        #ifdef UV_ANIMATION\n            color *= texture2D(sprite, mix(v_Uv0, v_Uv1, gl_PointCoord));\n        #else\n            color *= texture2D(sprite, gl_PointCoord);\n        #endif\n    #endif\n    #ifdef GRADIENT_ENABLED\n        color *= texture2D(gradient, vec2(v_Age, 0.5));\n    #endif\n\n    gl_FragColor = color;\n}\n\n@end';});

define('qtek/particleSystem/ParticleSystem',['require','../Node','../math/Vector3','../core/glenum','../StaticGeometry','../Mesh','../Material','../Shader','glmatrix','./particle.essl'],function(require) {

    

    var Node = require('../Node');
    var Vector3 = require('../math/Vector3');
    var glenum = require("../core/glenum");

    var StaticGeometry = require('../StaticGeometry');
    var Mesh = require('../Mesh');
    var Material = require('../Material');
    var Shader = require('../Shader');

    var glMatrix = require('glmatrix');
    var vec3 = glMatrix.vec3;

    Shader.import(require('./particle.essl'));

    // TODO shader with uv animation
    var particleShader = new Shader({
        vertex : Shader.source('buildin.particle.vertex'),
        fragment : Shader.source('buildin.particle.fragment')
    });
    particleShader.enableTexture('sprite');

    var ParticleSystem = Node.derive({
        
        loop : true,

        oneshot : false,

        duration : 1,

        // UV Animation
        spriteAnimationTileX : 1,
        spriteAnimationTileY : 1,
        spriteAnimationRepeat : 0,

        geometry : null,
        material : null,

        mode : Mesh.POINTS,

        _elapsedTime : 0,

        _emitting : true

    }, function(){

        this.geometry = new StaticGeometry({
            hint : glenum.DYNAMIC_DRAW
        });
        
        if (!this.material) {
            this.material = new Material({
                shader : particleShader,
                transparent : true,
                depthMask : false
            });
        }

        this._drawCache = {};
        this._particles = [];
        this._fields = [];
        this._emitters = [];

        this._renderInfo = new Mesh.RenderInfo();

    }, {

        visible : true,

        culling : false,
        cullFace : glenum.BACK,
        frontFace : glenum.CCW,

        frustumCulling : false,

        castShadow : false,
        receiveShadow : false,

        isRenderable : function() {
            return this.visible;
        },

        addEmitter : function(emitter) {
            this._emitters.push(emitter);
        },

        removeEmitter : function(emitter) {
            this._emitters.splice(this._emitters.indexOf(emitter), 1);
        },

        addField : function(field) {
            this._fields.push(field);
        },

        removeField : function(field) {
            this._fields.splice(this._fields.indexOf(field), 1);
        },

        updateParticles : function(deltaTime) {

            // MS => Seconds
            deltaTime /= 1000;
            this._elapsedTime += deltaTime;

            var particles = this._particles;

            if (this._emitting) {
                for (var i = 0; i < this._emitters.length; i++) {
                    this._emitters[i].emit(particles);
                }
                if (this.oneshot) {
                    this._emitting = false;
                }
            }

            // Aging
            var len = particles.length;
            for (var i = 0; i < len;) {
                var p = particles[i];
                p.age += deltaTime;
                if (p.age >= p.life) {
                    p.emitter.kill(p);
                    particles[i] = particles[len-1];
                    particles.pop();
                    len--;
                } else {
                    i++;
                }
            }

            for (var i = 0; i < len; i++) {
                // Update
                var p = particles[i];
                if (this._fields.length > 0) {
                    for (var j = 0; j < this._fields.length; j++) {
                        this._fields[j].applyTo(p.velocity, p.position, p.weight, deltaTime);
                    }
                }
                p.update(deltaTime);
            }
        },

        _updateVertices : function() {
            var particles = this._particles;
            var geometry = this.geometry;
            // If has uv animation
            var animTileX = this.spriteAnimationTileX;
            var animTileY = this.spriteAnimationTileY;
            var animRepeat = this.spriteAnimationRepeat;
            var nUvAnimFrame = animTileY * animTileX * animRepeat;
            var hasUvAnimation = nUvAnimFrame > 1;
            var positions = geometry.attributes.position.value;
            // Put particle status in normal
            var normals = geometry.attributes.normal.value;
            var uvs = geometry.attributes.texcoord0.value;
            var uvs2 = geometry.attributes.texcoord1.value;

            var len = this._particles.length;
            if (!positions || positions.length !== len * 3) {
                // TODO Optimize
                positions = geometry.attributes.position.value = new Float32Array(len * 3);
                normals = geometry.attributes.normal.value = new Float32Array(len * 3);
                if (hasUvAnimation) {
                    uvs = geometry.attributes.texcoord0.value = new Float32Array(len * 2);
                    uvs2 = geometry.attributes.texcoord1.value = new Float32Array(len * 2);
                }
            }

            var invAnimTileX = 1 / animTileX;
            for (var i = 0; i < len; i++) {
                var particle = this._particles[i];
                var offset = i * 3;
                for (var j = 0; j < 3; j++) {
                    positions[offset + j] = particle.position._array[j];
                    normals[offset] = particle.age / particle.life;
                    normals[offset + 1] = particle.rotation;
                    normals[offset + 2] = particle.spriteSize;
                }
                var offset2 = i * 2;
                if (hasUvAnimation) {
                    // TODO 
                    var p = particle.age / particle.life;
                    var stage = Math.round(p * (nUvAnimFrame - 1)) * animRepeat;
                    var v = Math.floor(stage * invAnimTileX);
                    var u = stage - v * animTileX;
                    uvs[offset2] = u / animTileX;
                    uvs[offset2 + 1] = 1 - v / animTileY;
                    uvs2[offset2] = (u + 1) / animTileX;
                    uvs2[offset2 + 1] = 1 - (v + 1) / animTileY;
                }
            }

            geometry.dirty('position');
            geometry.dirty('normal');

            if (hasUvAnimation) {
                geometry.dirty('texcoord0');
                geometry.dirty('texcoord1');
            }

        },

        render : function(_gl) {
            this._updateVertices();
            return Mesh.prototype.render.call(this, _gl);
        },

        isFinished : function() {
            return this._elapsedTime > this.duration && !this.loop;
        },

        dispose : function(_gl) {
            // Put all the particles back
            for (var i = 0; i < this._particles.length; i++) {
                var p = this._particles[i];
                p.emitter.kill(p);
            }
            this.geometry.dispose(_gl);
            // TODO Dispose texture, shader ?
        },

        clone : function() {
            var particleSystem = new ParticleSystem({
                material : this.material
            });
            particleSystem.loop = this.loop;
            particleSystem.duration = this.duration;
            particleSystem.oneshot = this.oneshot;
            particleSystem.spriteAnimationRepeat = this.spriteAnimationRepeat;
            particleSystem.spriteAnimationTileY = this.spriteAnimationTileY;
            particleSystem.spriteAnimationTileX = this.spriteAnimationTileX;

            particleSystem.position.copy(this.position);
            particleSystem.rotation.copy(this.rotation);
            particleSystem.scale.copy(this.scale);

            for (var i = 0; i < this._children.length; i++) {
                particleSystem.add(this._children[i].clone());
            }
            return particleSystem;
        }
    });

    

    return ParticleSystem;
});
define('qtek/picking/color.essl',[],function () { return '@export buildin.picking.color.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\n\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\nuniform mat4 skinMatrix[JOINT_NUMBER] : SKIN_MATRIX;\n#endif\n\nvoid main(){\n\n    vec3 skinnedPosition = position;\n\n    #ifdef SKINNING\n        \n        @import buildin.chunk.skin_matrix\n\n        skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n    #endif\n\n    gl_Position = worldViewProjection * vec4(skinnedPosition, 1.0);\n}\n\n@end\n\n@end\n@export buildin.picking.color.fragment\n\nuniform vec4 color : [1.0, 1.0, 1.0, 1.0];\n\nvoid main(){\n    gl_FragColor = color;\n}\n\n@end';});

define('qtek/picking/Pixel',['require','../core/Base','../FrameBuffer','../texture/Texture2D','../Shader','../Material','./color.essl'],function (require) {

    var Base = require('../core/Base');
    var FrameBuffer = require('../FrameBuffer');
    var Texture2D = require('../texture/Texture2D');
    var Shader = require('../Shader');
    var Material = require('../Material');

    Shader.import(require('./color.essl'));    

    var PixelPicking = Base.derive(function() {
        return {
            renderer : null,

            downSampleRatio : 1,
            width : 100,
            height : 100,

            lookupOffset : 1,

            _frameBuffer : null,
            _texture : null,
            _shader : null,

            _idMaterials : [],
            _lookupTable : [],

            _meshMaterials : [],

            _idOffset : 0
        }
    }, function() {
        this.init();
    }, {
        init : function() {
            this._texture = new Texture2D({
                width : this.width * this.downSampleRatio,
                height : this.height * this.downSampleRatio
            });
            this._frameBuffer = new FrameBuffer();

            this._shader = new Shader({
                vertex : Shader.source('buildin.picking.color.vertex'),
                fragment : Shader.source('buildin.picking.color.fragment')
            });
        },
        setPrecision : function(ratio) {
            this._texture.width = this.width * ratio;
            this._texture.height = this.height * ratio;
            this.downSampleRatio = ratio;
        },
        resize : function(width, height) {
            this._texture.width = width * this.downSampleRatio;
            this._texture.height = height * this.downSampleRatio;
            this.width = width;
            this.height = height;
        },
        update : function(scene, camera) {
            var renderer = this.renderer;
            this._frameBuffer.attach(renderer.gl, this._texture);
            this._frameBuffer.bind(renderer);
            this._idOffset = this.lookupOffset;
            this._setMaterial(scene);
            renderer.render(scene, camera);
            this._restoreMaterial();
            this._frameBuffer.unbind(renderer);
        },

        _setMaterial : function(root) {
            for (var i =0; i < root._children.length; i++) {
                var child = root._children[i];
                if (child.geometry && child.material && child.material.shader) {
                    var id = this._idOffset++;
                    var idx = id - this.lookupOffset;
                    var material = this._idMaterials[idx];
                    if (!material) {
                        material = new Material({
                            shader : this._shader
                        });
                        var color = packID(id);
                        color[0] /= 255;
                        color[1] /= 255;
                        color[2] /= 255;
                        color[3] = 1.0;
                        material.set('color', color);
                        this._idMaterials[idx] = material;
                    }
                    this._meshMaterials[idx] = child.material;
                    this._lookupTable[idx] = child;
                    child.material = material;
                }
                if (child._children.length) {
                    this._setMaterial(child);
                }
            }
        },

        pick : function(x, y) {
            var renderer = this.renderer;

            var ratio = this.downSampleRatio;
            var width = this._texture.width;
            var height = this._texture.height;
            x = Math.ceil(ratio * x);
            y = Math.ceil(ratio * (this.height - y));

            this._frameBuffer.bind(renderer);
            var pixel = new Uint8Array(4);
            var _gl = renderer.gl;
            // TODO out of bounds ?
            _gl.readPixels(x, y, 1, 1, _gl.RGBA, _gl.UNSIGNED_BYTE, pixel);
            this._frameBuffer.unbind(renderer);
            // Skip interpolated pixel because of anti alias
            if (pixel[3] === 255) {
                var id = unpackID(pixel[0], pixel[1], pixel[2]);
                if (id) {
                    var el = this._lookupTable[id - this.lookupOffset];
                    return el;
                }
            }
        },

        _restoreMaterial : function() {
            for (var i = 0; i < this._lookupTable.length; i++) {
                this._lookupTable[i].material = this._meshMaterials[i];
            }
        },

        dispose : function(_gl) {

        }
    });

    function packID(id){
        var r = id >> 16;
        var g = (id - (r << 8)) >> 8;
        var b = id - (r << 16) - (g<<8);
        return [r, g, b];
    }

    function unpackID(r, g, b){
        return (r << 16) + (g<<8) + b;
    }

    return PixelPicking;
});
define('qtek/plugin/FirstPersonControl',['require','../core/Base','../math/Vector3','../math/Matrix4','../math/Quaternion'],function(require) {

    var Base = require("../core/Base");
    var Vector3 = require("../math/Vector3");
    var Matrix4 = require("../math/Matrix4");
    var Quaternion = require("../math/Quaternion");

    var FirstPersonControl = Base.derive(function() {
        return {
            target : null,
            domElement : null,

            sensitivity : 1,
            speed : 0.4,

            up : new Vector3(0, 1, 0),

            verticalMoveLock : false,

            _moveForward : false,
            _moveBackward : false,
            _moveLeft : false,
            _moveRight : false,

            _offsetPitch : 0,
            _offsetRoll : 0
        }
    }, function() {
        this.enable();
    }, {
        enable : function() {
            this.target.eulerOrder = ["Y", "X", "Z"];
            // Use pointer lock
            // http://www.html5rocks.com/en/tutorials/pointerlock/intro/
            var el = this.domElement;

            //Must request pointer lock after click event, can't not do it directly
            //Why ? ?
            el.addEventListener("click", this.requestPointerLock);

            document.addEventListener("pointerlockchange", bindOnce(this._lockChange, this), false);
            document.addEventListener("mozpointerlockchange", bindOnce(this._lockChange, this), false);
            document.addEventListener("webkitpointerlockchange", bindOnce(this._lockChange, this), false);

            document.addEventListener("keydown", bindOnce(this._keyDown, this), false);
            document.addEventListener("keyup", bindOnce(this._keyUp, this), false);
        },

        disable : function() {

            this.target.off('beforeupdate', this._beforeUpdateCamera);

            var el = this.domElement;

            el.exitPointerLock = el.exitPointerLock ||
                                    el.mozExitPointerLock ||
                                    el.webkitExitPointerLock

            if (el.exitPointerLock) {
                el.exitPointerLock();
            }
            document.removeEventListener("pointerlockchange", bindOnce(this._lockChange, this));
            document.removeEventListener("mozpointerlockchange", bindOnce(this._lockChange, this));
            document.removeEventListener("webkitpointerlockchange", bindOnce(this._lockChange, this));
        
        },

        requestPointerLock : function() {
            var el = this;
            el.requestPointerLock = el.requestPointerLock ||
                                    el.mozRequestPointerLock ||
                                    el.webkitRequestPointerLock;

            el.requestPointerLock();
        },

        update : (function() {

            var rotateQuat = new Quaternion();
            
            return function(deltaTime) {
                
                var target = this.target;

                var position = this.target.position;
                var xAxis = target.localTransform.right.normalize();
                var zAxis = target.localTransform.forward.normalize();

                if (this.verticalMoveLock) {
                    zAxis.y = 0;
                }

                if (this._moveForward) {
                    // Opposite direction of z
                    position.scaleAndAdd(zAxis, -this.speed);
                }
                if (this._moveBackward) {
                    position.scaleAndAdd(zAxis, this.speed);
                }
                if (this._moveLeft) {
                    position.scaleAndAdd(xAxis, -this.speed/2);
                }
                if (this._moveRight) {
                    position.scaleAndAdd(xAxis, this.speed/2);
                }


                target.rotateAround(target.position, this.up, -this._offsetPitch * Math.PI / 180);
                var xAxis = target.localTransform.right;
                target.rotateAround(target.position, xAxis, -this._offsetRoll * Math.PI / 180);

                this._offsetRoll = this._offsetPitch = 0;
            }

        })(),

        _lockChange : function() {
            if (document.pointerlockElement === this.domElement ||
                document.mozPointerlockElement === this.domElement ||
                document.webkitPointerLockElement === this.domElement) {

                document.addEventListener('mousemove', bindOnce(this._mouseMove, this), false);
            }else{
                document.removeEventListener('mousemove', bindOnce(this._mouseMove, this));
            }
        },

        _mouseMove : function(e) {
            var dx = e.movementX || 
                    e.mozMovementX ||
                    e.webkitMovementX || 0;
            var dy = e.movementY ||
                    e.mozMovementY ||
                    e.webkitMovementY || 0;

            this._offsetPitch += dx * this.sensitivity / 10;
            this._offsetRoll += dy * this.sensitivity / 10;
            
        },

        _keyDown : function(e) {
            switch(e.keyCode) {
                case 87: //w
                case 37: //up arrow
                    this._moveForward = true;
                    break;
                case 83: //s
                case 40: //down arrow
                    this._moveBackward = true;
                    break;
                case 65: //a
                case 37: //left arrow
                    this._moveLeft = true;
                    break;
                case 68: //d
                case 39: //right arrow
                    this._moveRight = true;
                    break; 
            }
        },

        _keyUp : function(e) {
            this._moveForward = false;
            this._moveBackward = false;
            this._moveLeft = false;
            this._moveRight = false;
        }
    })

    function bindOnce(func, context) {
        if (!func.__bindfuc__) {
            func.__bindfuc__ = function() {
                return func.apply(context, arguments); 
            }
        }
        return func.__bindfuc__;
    }

    return FirstPersonControl;
});
define('qtek/plugin/InfinitePlane',['require','../Mesh','../DynamicGeometry','../math/Plane','../math/Vector3','../math/Matrix4','../math/Ray','../camera/Perspective','glmatrix'],function(require) {
    
    var Mesh = require('../Mesh');
    var DynamicGeometry = require('../DynamicGeometry');
    var Plane = require('../math/Plane');
    var Vector3 = require('../math/Vector3');
    var Matrix4 = require('../math/Matrix4');
    var Ray = require('../math/Ray');

    var PerspectiveCamera = require('../camera/Perspective');

    var glMatrix = require('glmatrix');
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var vec4 = glMatrix.vec4;

    var uvs = [[0, 0], [0, 1], [1, 1], [1, 0]];
    var tris = [0, 1, 2, 2, 3, 0];

    var InfinitePlane = Mesh.derive({
        
        camera : null,

        plane : null,

        gridSize : 1,

        maxGrid : 0,

        // TODO
        frustumCulling : false

    }, function() {
        if (!this.geometry) {
            this.geometry = new DynamicGeometry();
        }
        if (!this.plane) {
            this.plane = new Plane();
        }
    }, {

        updateGeometry : function() {

            var coords = this._unProjectGrid();
            if (!coords) {
                return;
            }
            var positions = this.geometry.attributes.position.value;
            var normals = this.geometry.attributes.normal.value;
            var texcoords = this.geometry.attributes.texcoord0.value;
            var faces = this.geometry.faces;
            var nVertices = 0;
            var normal = vec3.clone(this.plane.normal._array);

            // if (this.gridSize > 0) {
                // TODO

            // } else {
            for (var i = 0; i < 6; i++) {
                var idx = tris[i];
                positions[nVertices] = coords[idx]._array;
                normals[nVertices] = normal;
                texcoords[nVertices] = uvs[idx];
                nVertices++;
            }
            faces[0] = [0, 1, 2];
            faces[1] = [3, 4, 5];
            this.geometry.dirty();
            // }
        },

        // http://fileadmin.cs.lth.se/graphics/theses/projects/projgrid/
        _unProjectGrid : (function() {
            
            var planeViewSpace = new Plane();
            var lines = [
                0, 1, 0, 2, 1, 3, 2, 3,
                4, 5, 4, 6, 5, 7, 6, 7,
                0, 4, 1, 5, 2, 6, 3, 7
            ];

            var start = new Vector3();
            var end = new Vector3();

            var points = [];

            // 1----2
            // |    |
            // 0----3
            var coords = [];
            for (var i = 0; i < 4; i++) {
                coords[i] = new Vector3(0, 0);
            }

            var ray = new Ray();

            return function() {
                planeViewSpace.copy(this.plane);
                planeViewSpace.applyTransform(this.camera.viewMatrix);

                var frustumVertices = this.camera.frustum.vertices;

                var nPoints = 0;
                // Intersect with lines of frustum
                for (var i = 0; i < 12; i++) {
                    start._array = frustumVertices[lines[i * 2]];
                    end._array = frustumVertices[lines[i * 2 + 1]];

                    var point = planeViewSpace.intersectLine(start, end, points[nPoints]);
                    if (point) {
                        if (!points[nPoints]) {
                            points[nPoints] = point;
                        }
                        nPoints++;
                    }
                }
                if (nPoints == 0) {
                    return;
                }
                for (var i = 0; i < nPoints; i++) {
                    points[i].applyProjection(this.camera.projectionMatrix);
                }
                var minX = points[0]._array[0];
                var minY = points[0]._array[1];
                var maxX = points[0]._array[0];
                var maxY = points[0]._array[1];
                for (var i = 1; i < nPoints; i++) {
                    maxX = Math.max(maxX, points[i]._array[0]);
                    maxY = Math.max(maxY, points[i]._array[1]);
                    minX = Math.min(minX, points[i]._array[0]);
                    minY = Math.min(minY, points[i]._array[1]);
                }
                if (minX == maxX || minY == maxY) {
                    return;
                }
                coords[0]._array[0] = minX;
                coords[0]._array[1] = minY;
                coords[1]._array[0] = minX;
                coords[1]._array[1] = maxY;
                coords[2]._array[0] = maxX;
                coords[2]._array[1] = maxY;
                coords[3]._array[0] = maxX;
                coords[3]._array[1] = minY;

                for (var i = 0; i < 4; i++) {
                    this.camera.castRay(coords[i], ray);
                    ray.intersectPlane(this.plane, coords[i])
                }

                return coords;
            };
        })()
    });

    return InfinitePlane;
});
define('qtek/plugin/OrbitControl',['require','../core/Base','../math/Vector3','../math/Matrix4','../math/Quaternion'],function(require) {

    var Base = require("../core/Base");
    var Vector3 = require("../math/Vector3");
    var Matrix4 = require("../math/Matrix4");
    var Quaternion = require("../math/Quaternion");
    
    var tmpMatrix = new Matrix4();

    var OrbitControl = Base.derive(function() {
        return {
            
            target : null,
            domElement : null,

            sensitivity : 1,

            origin : new Vector3(),

            up : new Vector3(0, 1, 0),

            minDistance : 0,
            maxDistance : Infinity,

            minPolarAngle : 0, // [0, Math.PI/2]
            maxPolarAngle : Math.PI, // [Math.PI/2, Math.PI]

            // Rotate around origin
            _offsetPitch : 0,
            _offsetRoll : 0,

            // Pan the origin
            _panX : 0,
            _panY : 0,

            // Offset of mouse move
            _offsetX : 0,
            _offsetY : 0,

            // Zoom with mouse wheel
            _forward : 0,

            _op : -1  //0 : ROTATE, 1 : PAN
        }
    }, function() {
        if (this.domElement) {
            this.enable();
        }
    }, {

        enable : function() {
            this.domElement.addEventListener("mousedown", bindOnce(this._mouseDown, this), false);
            this.domElement.addEventListener("mousewheel", bindOnce(this._mouseWheel, this), false);
            this.domElement.addEventListener("DOMMouseScroll", bindOnce(this._mouseWheel, this), false);
        },

        disable : function() {
            this.domElement.removeEventListener("mousedown", bindOnce(this._mouseDown, this));
            this.domElement.removeEventListener("mousewheel", bindOnce(this._mouseWheel, this));
            this.domElement.removeEventListener("DOMMouseScroll", bindOnce(this._mouseWheel, this));
            this._mouseUp();
        },

        _mouseWheel : function(e) {
            e.preventDefault();
            var delta = e.wheelDelta // Webkit 
                        || -e.detail; // Firefox

            this._forward += delta * this.sensitivity;
        },

        _mouseDown : function(e) {
            document.addEventListener("mousemove", bindOnce(this._mouseMove, this), false);
            document.addEventListener("mouseup", bindOnce(this._mouseUp, this), false);
            document.addEventListener("mouseout", bindOnce(this._mouseOut, this), false);

            this._offsetX = e.pageX;
            this._offsetY = e.pageY;

            // Rotate
            if (e.button === 0) {
                this._op = 0;
            } else if (e.button === 1) {
                this._op = 1;
            }
        },

        _mouseMove : function(e) {
            var dx = e.pageX - this._offsetX;
            var dy = e.pageY - this._offsetY;

            if (this._op === 0) {
                this._offsetPitch += dx * this.sensitivity / 100;
                this._offsetRoll += dy * this.sensitivity / 100;
            } else if (this._op === 1) {
                var len = this.origin.distance(this.target.position);
                var tmp = Math.sin(this.target.fov/2) / 100;
                this._panX -= dx * this.sensitivity * len * tmp;
                this._panY -= dy * this.sensitivity * len * tmp;
            }

            this._offsetX = e.pageX;
            this._offsetY = e.pageY;
        },

        _mouseUp : function() {

            document.removeEventListener("mousemove", bindOnce(this._mouseMove, this));
            document.removeEventListener("mouseup", bindOnce(this._mouseUp, this));
            document.removeEventListener("mouseout", bindOnce(this._mouseOut, this));

            this._op = -1;
        },

        _mouseOut : function() {
            this._mouseUp();
        },

        update : function(delataTime) {
            var target = this.target;
            var zAxis = target.localTransform.forward.normalize();
            var yAxis = target.localTransform.up.normalize();
            if (this._op === 0) {
                // Rotate
                target.rotateAround(this.origin, this.up, -this._offsetPitch);
                tmpMatrix.copy(target.localTransform);
                var xAxis = target.localTransform.right;
                target.rotateAround(this.origin, xAxis, -this._offsetRoll);
                var zAxis = target.localTransform.forward.normalize();
                var yAxis = target.localTransform.up.normalize();
                var phi = Math.acos(this.up.dot(zAxis));
                var isUp = this.up.dot(yAxis) >= 0;
                if (
                    !(isUp && phi >= this.minPolarAngle && phi <= this.maxPolarAngle)
                ) {
                    // Rool back
                    target.localTransform.copy(tmpMatrix);
                    target.decomposeLocalTransform();
                }
                this._offsetRoll = this._offsetPitch = 0;
            } else if (this._op === 1) {
                // Pan
                var xAxis = target.localTransform.right.normalize().scale(-this._panX);
                var yAxis = target.localTransform.up.normalize().scale(this._panY);
                target.position.add(xAxis).add(yAxis);
                this.origin.add(xAxis).add(yAxis);
                this._panX = this._panY = 0;
            } 
            if (this._forward !== 0) {
                // Zoom
                var distance = target.position.distance(this.origin);
                var nextDistance = distance + this._forward * distance / 5000;
                if (nextDistance < this.maxDistance && nextDistance > this.minDistance) {
                    target.position.scaleAndAdd(zAxis, this._forward * distance / 5000);
                }
                this._forward = 0;
            }

        }
    });

    function bindOnce(func, context) {
        if (!func.__bindfuc__) {
            func.__bindfuc__ = function() {
                return func.apply(context, arguments); 
            }
        }
        return func.__bindfuc__;
    }

    return OrbitControl;
} );
define('qtek/plugin/Skybox',['require','../Mesh','../geometry/Cube','../Shader','../Material','../shader/library'],function(require) {

    var Mesh = require('../Mesh');
    var CubeGeometry = require('../geometry/Cube');
    var Shader = require('../Shader');
    var Material = require('../Material');
    var shaderLibrary = require('../shader/library');

    var skyboxShader = new Shader({
        vertex : Shader.source("buildin.skybox.vertex"), 
        fragment : Shader.source("buildin.skybox.fragment")
    });

    var Skybox = Mesh.derive(function() {

        var material = new Material({
            shader : skyboxShader,
            depthMask : false
        });
        
        return {
            scene : null,

            geometry : new CubeGeometry(),
            material : material,
            culling : false,

            _beforeRenderScene : function(renderer, scene, camera) {
                this.position.copy(camera.getWorldPosition());
                this.update();
                renderer.renderQueue([this], camera);
            }
        }
    }, function() {
        var scene = this.scene;
        if (scene) {
            this.attachScene(scene);
        }
    }, {
        attachScene : function(scene) {
            if (this.scene) {
                this.scene.off('beforerender', this._beforeRenderScene);
            }
            this.scene = scene;
            scene.on("beforerender", this._beforeRenderScene, this);
        },
        
        detachScene : function(scene) {
            scene.off("beforerender", this._beforeRenderScene, this);  
        }
    });

    return Skybox;
});
define('qtek/plugin/Skydome',['require','../Mesh','../geometry/Sphere','../Shader','../Material','../shader/library'],function(require) {

    var Mesh = require('../Mesh');
    var SphereGeometry = require('../geometry/Sphere');
    var Shader = require('../Shader');
    var Material = require('../Material');
    var shaderLibrary = require('../shader/library');

    var Skydome = Mesh.derive(function() {

        var skydomeShader = new Shader({
            vertex : Shader.source("buildin.basic.vertex"),
            fragment : Shader.source("buildin.basic.fragment")
        });
        skydomeShader.enableTexture("diffuseMap");

        var material = new Material({
            shader : skydomeShader,
            depthMask : false
        });
        
        return {
            scene : null,

            geometry : new SphereGeometry({
                widthSegments : 30,
                heightSegments : 30,
                // thetaLength : Math.PI / 2
            }),
            material : material,
            culling : false,

            _beforeRenderScene : function(renderer, scene, camera) {
                this.position.copy(camera.getWorldPosition());
                this.update();
                renderer.renderQueue([this], camera);
            }
        }
    }, function() {
        var scene = this.scene;
        if (scene) {
            this.attachScene(scene);
        }
    }, {
        attachScene : function(scene) {
            if (this.scene) {
                this.scene.off('beforerender', this._beforeRenderScene);
            }
            this.scene = scene;
            scene.on("beforerender", this._beforeRenderScene, this);
        },

        detachScene : function(scene) {
            scene.off("beforerender", this._beforeRenderScene, this);  
        }
    });

    return Skydome;
});
define('qtek/prePass/EnvironmentMap',['require','../core/Base','../math/Vector3','../camera/Perspective','../core/glenum','../FrameBuffer','../texture/TextureCube'],function (require) {

    var Base = require('../core/Base');
    var Vector3 = require('../math/Vector3');
    var PerspectiveCamera = require('../camera/Perspective');
    var glenum = require("../core/glenum");
    var FrameBuffer = require("../FrameBuffer");
    var TextureCube = require("../texture/TextureCube");

    var targets = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    var targetMap = {
        'px' : glenum.TEXTURE_CUBE_MAP_POSITIVE_X,
        'py' : glenum.TEXTURE_CUBE_MAP_POSITIVE_Y,
        'pz' : glenum.TEXTURE_CUBE_MAP_POSITIVE_Z,
        'nx' : glenum.TEXTURE_CUBE_MAP_NEGATIVE_X,
        'ny' : glenum.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        'nz' : glenum.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    }

    var EnvironmentMapPass = Base.derive(function() {
        var ret = {
            position : new Vector3(),
            far : 1000,
            near : 0.1,
            texture : null,
            frameBuffer : new FrameBuffer()
        }
        ret._cameras = {
            'px' : new PerspectiveCamera({fov : 90}),
            'nx' : new PerspectiveCamera({fov : 90}),
            'py' : new PerspectiveCamera({fov : 90}),
            'ny' : new PerspectiveCamera({fov : 90}),
            'pz' : new PerspectiveCamera({fov : 90}),
            'nz' : new PerspectiveCamera({fov : 90}),
        }
        ret._cameras.px.lookAt(Vector3.POSITIVE_X, Vector3.NEGATIVE_Y);
        ret._cameras.nx.lookAt(Vector3.NEGATIVE_X, Vector3.NEGATIVE_Y);
        ret._cameras.py.lookAt(Vector3.POSITIVE_Y, Vector3.POSITIVE_Z);
        ret._cameras.ny.lookAt(Vector3.NEGATIVE_Y, Vector3.NEGATIVE_Z);
        ret._cameras.pz.lookAt(Vector3.POSITIVE_Z, Vector3.NEGATIVE_Y);
        ret._cameras.nz.lookAt(Vector3.NEGATIVE_Z, Vector3.NEGATIVE_Y);

        return ret;
    }, {
        render : function(renderer, scene, notUpdateScene) {
            var _gl = renderer.gl;
            if (!notUpdateScene) {
                scene.update(true);
            }
            // Tweak fov
            // http://the-witness.net/news/2012/02/seamless-cube-map-filtering/
            var n = this.texture.width;
            var fov = 2 * Math.atan(n / (n - 0.5)) / Math.PI * 180;
            for (var i = 0; i < 6; i++) {
                var target = targets[i];
                var camera = this._cameras[target];
                camera.position.copy(this.position);
                camera.far = this.far;
                camera.near = this.near;
                camera.fov = fov;

                this.frameBuffer.attach(_gl, this.texture, _gl.COLOR_ATTACHMENT0, targetMap[target]);
                this.frameBuffer.bind(renderer);
                renderer.render(scene, camera, true);
                this.frameBuffer.unbind(renderer);
            }
        },
        dispose : function(renderer) {
            this.frameBuffer.dispose(renderer._gl);
        }
    });

    return EnvironmentMapPass;
});
define('qtek/prePass/Reflection',['require','../core/Base','../math/Vector4'],function(require) {

    var Base = require("../core/Base");
    var Vector4 = require("../math/Vector4");

    var ReflectionPass = Base.derive(function() {
        // Vector4
    }, {
        render : function(renderer, scene, camera) {

        }
    });

    return ReflectionPass;
});
define('qtek/prePass/shadowmap.essl',[],function () { return '\n@export buildin.sm.depth.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\n\n#ifdef SHADOW_TRANSPARENT \nattribute vec2 texcoord : TEXCOORD_0;\n#endif\n\n#ifdef SKINNING\nattribute vec3 weight : WEIGHT;\nattribute vec4 joint : JOINT;\n\nuniform mat4 skinMatrix[JOINT_NUMBER] : SKIN_MATRIX;\n#endif\n\nvarying vec4 v_ViewPosition;\n\n#ifdef SHADOW_TRANSPARENT\nvarying vec2 v_Texcoord;\n#endif\n\nvoid main(){\n    \n    vec3 skinnedPosition = position;\n    \n    #ifdef SKINNING\n\n        @import buildin.chunk.skin_matrix\n\n        skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n    #endif\n\n    v_ViewPosition = worldViewProjection * vec4(skinnedPosition, 1.0);\n    gl_Position = v_ViewPosition;\n\n    #ifdef SHADOW_TRANSPARENT\n        v_Texcoord = texcoord;\n    #endif\n}\n@end\n\n@export buildin.sm.depth.fragment\n\nvarying vec4 v_ViewPosition;\n\n#ifdef SHADOW_TRANSPARENT\nvarying vec2 v_Texcoord;\n#endif\n\nuniform float bias : 0.001;\nuniform float slopeScale : 1.0;\n\n#ifdef SHADOW_TRANSPARENT\nuniform sampler2D transparentMap;\n#endif\n\n#extension GL_OES_standard_derivatives : enable\n\n@import buildin.util.encode_float\n\nvoid main(){\n    // Whats the difference between gl_FragCoord.z and this v_ViewPosition\n    // gl_FragCoord consider the polygon offset ?\n    float depth = v_ViewPosition.z / v_ViewPosition.w;\n    // float depth = gl_FragCoord.z / gl_FragCoord.w;\n\n    #ifdef USE_VSM\n        depth = depth * 0.5 + 0.5;\n        float moment1 = depth;\n        float moment2 = depth * depth;\n\n        // Adjusting moments using partial derivative\n        float dx = dFdx(depth);\n        float dy = dFdy(depth);\n        moment2 += 0.25*(dx*dx+dy*dy);\n\n        gl_FragColor = vec4(moment1, moment2, 0.0, 1.0);\n    #else\n        // Add slope scaled bias using partial derivative\n        float dx = dFdx(depth);\n        float dy = dFdy(depth);\n        depth += sqrt(dx*dx + dy*dy) * slopeScale + bias;\n\n        #ifdef SHADOW_TRANSPARENT\n            if (texture2D(transparentMap, v_Texcoord).a <= 0.1) {\n                // Hi-Z\n                gl_FragColor = encodeFloat(0.9999);\n                return;\n            }\n        #endif\n\n        gl_FragColor = encodeFloat(depth * 0.5 + 0.5);\n    #endif\n}\n@end\n\n@export buildin.sm.debug_depth\n\nuniform sampler2D depthMap;\nvarying vec2 v_Texcoord;\n\n@import buildin.util.decode_float\n\nvoid main() {\n    vec4 tex = texture2D(depthMap, v_Texcoord);\n    #ifdef USE_VSM\n        gl_FragColor = vec4(tex.rgb, 1.0);\n    #else\n        float depth = decodeFloat(tex);\n        gl_FragColor = vec4(depth, depth, depth, 1.0);\n    #endif\n}\n\n@end\n\n\n@export buildin.sm.distance.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 world : WORLD;\n\nattribute vec3 position : POSITION;\n\n#ifdef SKINNING\nattribute vec3 boneWeight;\nattribute vec4 boneIndex;\n\nuniform mat4 skinMatrix[JOINT_NUMBER] : SKIN_MATRIX;\n#endif\n\nvarying vec3 v_WorldPosition;\n\nvoid main(){\n\n    vec3 skinnedPosition = position;\n    #ifdef SKINNING\n        @import buildin.chunk.skin_matrix\n\n        skinnedPosition = (skinMatrixWS * vec4(position, 1.0)).xyz;\n    #endif\n\n    gl_Position = worldViewProjection * vec4(skinnedPosition , 1.0);\n    v_WorldPosition = (world * vec4(skinnedPosition, 1.0)).xyz;\n}\n\n@end\n\n@export buildin.sm.distance.fragment\n\nuniform vec3 lightPosition;\nuniform float range : 100;\n\nvarying vec3 v_WorldPosition;\n\n@import buildin.util.encode_float\n\nvoid main(){\n    float dist = distance(lightPosition, v_WorldPosition);\n    #ifdef USE_VSM\n        gl_FragColor = vec4(dist, dist * dist, 0.0, 0.0);\n    #else\n        dist = dist / range;\n        gl_FragColor = encodeFloat(dist);\n    #endif\n}\n@end\n\n@export buildin.plugin.compute_shadow_map\n\n#if defined(SPOT_LIGHT_SHADOWMAP_NUMBER) || defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER) || defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n\n#ifdef SPOT_LIGHT_SHADOWMAP_NUMBER\nuniform sampler2D spotLightShadowMaps[SPOT_LIGHT_SHADOWMAP_NUMBER];\nuniform mat4 spotLightMatrices[SPOT_LIGHT_SHADOWMAP_NUMBER];\n#endif\n\n#ifdef DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER\n#if defined(SHADOW_CASCADE)\nuniform sampler2D directionalLightShadowMaps[SHADOW_CASCADE];\nuniform mat4 directionalLightMatrices[SHADOW_CASCADE];\nuniform float shadowCascadeClipsNear[SHADOW_CASCADE];\nuniform float shadowCascadeClipsFar[SHADOW_CASCADE];\n#else\nuniform sampler2D directionalLightShadowMaps[DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER];\nuniform mat4 directionalLightMatrices[DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER];\n#endif\n#endif\n\n#ifdef POINT_LIGHT_SHADOWMAP_NUMBER\nuniform samplerCube pointLightShadowMaps[POINT_LIGHT_SHADOWMAP_NUMBER];\nuniform float pointLightRanges[POINT_LIGHT_SHADOWMAP_NUMBER];\n#endif\n\nuniform bool shadowEnabled : true;\n\n@import buildin.util.decode_float\n\n#if defined(DIRECTIONAL_LIGHT_NUMBER) || defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n\nfloat tapShadowMap(sampler2D map, vec2 uv, float z){\n    vec4 tex = texture2D(map, uv);\n    return decodeFloat(tex) * 2.0 - 1.0< z ? 0.0 : 1.0;\n}\n\nfloat pcf(sampler2D map, vec2 uv, float z){\n\n    float shadowContrib = tapShadowMap(map, uv, z);\n    float offset = 1.0 / 2048.0;\n    shadowContrib += tapShadowMap(map, uv+vec2(offset, 0.0), z);\n    shadowContrib += tapShadowMap(map, uv+vec2(offset, offset), z);\n    shadowContrib += tapShadowMap(map, uv+vec2(-offset, offset), z);\n    shadowContrib += tapShadowMap(map, uv+vec2(0.0, offset), z);\n    shadowContrib += tapShadowMap(map, uv+vec2(-offset, 0.0), z);\n    shadowContrib += tapShadowMap(map, uv+vec2(-offset, -offset), z);\n    shadowContrib += tapShadowMap(map, uv+vec2(offset, -offset), z);\n    shadowContrib += tapShadowMap(map, uv+vec2(0.0, -offset), z);\n\n    return shadowContrib / 9.0;\n}\nfloat chebyshevUpperBound(vec2 moments, float z){\n    float p = 0.0;\n    z = z * 0.5 + 0.5;\n    if (z <= moments.x) {\n        p = 1.0;\n    }\n    float variance = moments.y - moments.x * moments.x;\n    // http://fabiensanglard.net/shadowmappingVSM/\n    variance = max(variance, 0.0000001);\n    // Compute probabilistic upper bound. \n    float mD = moments.x - z;\n    float pMax = variance / (variance + mD * mD);\n    // Now reduce light-bleeding by removing the [0, x] tail and linearly rescaling (x, 1]\n    // TODO : bleedBias parameter ?\n    pMax = clamp((pMax-0.4)/(1.0-0.4), 0.0, 1.0);\n    return max(p, pMax);\n}\nfloat computeShadowContrib(sampler2D map, mat4 lightVPM, vec3 position){\n    \n    vec4 posInLightSpace = lightVPM * vec4(v_WorldPosition, 1.0);\n    posInLightSpace.xyz /= posInLightSpace.w;\n    float z = posInLightSpace.z;\n    // In frustum\n    if(all(greaterThan(posInLightSpace.xyz, vec3(-0.99, -0.99, -1.0))) &&\n        all(lessThan(posInLightSpace.xyz, vec3(0.99, 0.99, 1.0)))){\n        // To texture uv\n        vec2 uv = (posInLightSpace.xy+1.0) / 2.0;\n\n        #ifdef USE_VSM\n            vec2 moments = texture2D(map, uv).xy;\n            return chebyshevUpperBound(moments, z);\n        #else\n            return pcf(map, uv, z);\n        #endif\n    }\n    return 1.0;\n}\n\n#endif\n\n#ifdef POINT_LIGHT_SHADOWMAP_NUMBER\n\nfloat computeShadowOfCube(samplerCube map, vec3 direction, float range){\n    vec4 shadowTex = textureCube(map, direction);\n    float dist = length(direction);\n\n    #ifdef USE_VSM\n        vec2 moments = shadowTex.xy;\n        float variance = moments.y - moments.x * moments.x;\n        float mD = moments.x - dist;\n        float p = variance / (variance + mD * mD);\n        if(moments.x + 0.001 < dist){\n            return clamp(p, 0.0, 1.0);\n        }else{\n            return 1.0;\n        }\n    #else\n        if((decodeFloat(shadowTex) + 0.0002) * range < dist){\n            return 0.0;\n        }else{\n            return 1.0;\n        }\n    #endif\n}\n#endif\n\n#if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n\nvoid computeShadowOfSpotLights(vec3 position, inout float shadowContribs[SPOT_LIGHT_NUMBER] ){\n    for(int i = 0; i < SPOT_LIGHT_SHADOWMAP_NUMBER; i++){\n        float shadowContrib = computeShadowContrib(spotLightShadowMaps[i], spotLightMatrices[i], position);\n        shadowContribs[i] = shadowContrib;\n    }\n    // set default fallof of rest lights\n    for(int i = SPOT_LIGHT_SHADOWMAP_NUMBER; i < SPOT_LIGHT_NUMBER; i++){\n        shadowContribs[i] = 1.0;\n    }\n}\n\n#endif\n\n\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n\n#ifdef SHADOW_CASCADE\n\nvoid computeShadowOfDirectionalLights(vec3 position, inout float shadowContribs[DIRECTIONAL_LIGHT_NUMBER]){\n    // http://www.opengl.org/wiki/Compute_eye_space_from_window_space\n    float depth = (2.0 * gl_FragCoord.z - gl_DepthRange.near - gl_DepthRange.far)\n                    / (gl_DepthRange.far - gl_DepthRange.near);\n\n    for (int i = 0; i < SHADOW_CASCADE; i++) {\n        if (\n            depth >= shadowCascadeClipsNear[i] &&\n            depth <= shadowCascadeClipsFar[i]\n        ) {\n            float shadowContrib = computeShadowContrib(directionalLightShadowMaps[i], directionalLightMatrices[i], position);\n            // TODO Will get a sampler needs to be be uniform error in native gl\n            shadowContribs[0] = shadowContrib;\n        }\n    }\n    // set default fallof of rest lights\n    for(int i = DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER; i < DIRECTIONAL_LIGHT_NUMBER; i++){\n        shadowContribs[i] = 1.0;\n    }\n}\n\n#else\n\nvoid computeShadowOfDirectionalLights(vec3 position, inout float shadowContribs[DIRECTIONAL_LIGHT_NUMBER]){\n    for(int i = 0; i < DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER; i++){\n        float shadowContrib = computeShadowContrib(directionalLightShadowMaps[i], directionalLightMatrices[i], position);\n        shadowContribs[i] = shadowContrib;\n    }\n    // set default fallof of rest lights\n    for(int i = DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER; i < DIRECTIONAL_LIGHT_NUMBER; i++){\n        shadowContribs[i] = 1.0;\n    }\n}\n#endif\n\n#endif\n\n\n#if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n\nvoid computeShadowOfPointLights(vec3 position, inout float shadowContribs[POINT_LIGHT_NUMBER] ){\n    for(int i = 0; i < POINT_LIGHT_SHADOWMAP_NUMBER; i++){\n        vec3 lightPosition = pointLightPosition[i];\n        vec3 direction = position - lightPosition;\n        shadowContribs[i] = computeShadowOfCube(pointLightShadowMaps[i], direction, pointLightRanges[i]);\n    }\n    for(int i = POINT_LIGHT_SHADOWMAP_NUMBER; i < POINT_LIGHT_NUMBER; i++){\n        shadowContribs[i] = 1.0;\n    }\n}\n\n#endif\n\n#endif\n\n@end';});

define('qtek/prePass/ShadowMap',['require','../core/Base','../core/glenum','../math/Vector3','../math/BoundingBox','../math/Frustum','../math/Matrix4','../Renderer','../Shader','../Light','../Mesh','../light/Spot','../light/Directional','../light/Point','../shader/library','../Material','../FrameBuffer','../texture/Texture2D','../texture/TextureCube','../camera/Perspective','../camera/Orthographic','../compositor/Pass','../compositor/texturePool','glmatrix','./shadowmap.essl'],function(require) {

    var Base = require("../core/Base");
    var glenum = require("../core/glenum");
    var Vector3 = require("../math/Vector3");
    var BoundingBox = require("../math/BoundingBox");
    var Frustum = require("../math/Frustum");
    var Matrix4 = require("../math/Matrix4");
    var Renderer = require('../Renderer');
    var Shader = require("../Shader");
    var Light = require("../Light");
    var Mesh = require("../Mesh");
    var SpotLight = require("../light/Spot");
    var DirectionalLight = require("../light/Directional");
    var PointLight = require("../light/Point");
    var shaderLibrary = require("../shader/library");
    var Material = require("../Material");
    var FrameBuffer = require("../FrameBuffer");
    var Texture2D = require("../texture/Texture2D");
    var TextureCube = require("../texture/TextureCube");
    var PerspectiveCamera = require("../camera/Perspective");
    var OrthoCamera = require("../camera/Orthographic");

    var Pass = require("../compositor/Pass");
    var texturePool = require("../compositor/texturePool");

    var glMatrix = require("glmatrix");
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;

    var frameBuffer = new FrameBuffer();

    Shader.import(require('./shadowmap.essl'));

    var targets = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    var targetMap = {
        'px' : glenum.TEXTURE_CUBE_MAP_POSITIVE_X,
        'py' : glenum.TEXTURE_CUBE_MAP_POSITIVE_Y,
        'pz' : glenum.TEXTURE_CUBE_MAP_POSITIVE_Z,
        'nx' : glenum.TEXTURE_CUBE_MAP_NEGATIVE_X,
        'ny' : glenum.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        'nz' : glenum.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    }

    var ShadowMapPass = Base.derive(function() {
        return {
            
            softShadow : ShadowMapPass.PCF,
            shadowBlur : 1.0,

            shadowCascade  : 1,
            cascadeSplitLogFactor : 0.2,

            _textures : {},
            _shadowMapNumber : {
                'POINT_LIGHT' : 0,
                'DIRECTIONAL_LIGHT' : 0,
                'SPOT_LIGHT' : 0
            },

            _meshMaterials : {},
            _depthMaterials : {},
            _depthShaders : {},
            _distanceMaterials : {},

            _opaqueCasters : [],
            _receivers : [],
            _lightsCastShadow : [],

            _lightCameras : {}
        }
    }, function() {
        // Gaussian filter pass for VSM
        this._gaussianPassH = new Pass({
            fragment : Shader.source('buildin.compositor.gaussian_blur_h')
        });
        this._gaussianPassV = new Pass({
            fragment : Shader.source('buildin.compositor.gaussian_blur_v')
        });
        this._gaussianPassH.setUniform("blurSize", this.shadowBlur);
        this._gaussianPassV.setUniform("blurSize", this.shadowBlur);

        this._outputDepthPass = new Pass({
            fragment : Shader.source('buildin.sm.debug_depth')
        });
        if (this.softShadow === ShadowMapPass.VSM) {
            this._outputDepthPass.material.shader.define("fragment", "USE_VSM");
        }
    }, {

        render : function(renderer, scene, sceneCamera) {
            this.trigger('beforerender', this, renderer, scene, sceneCamera);
            this._renderShadowPass(renderer, scene, sceneCamera);
            this.trigger('afterrender', this, renderer, scene, sceneCamera);
        },

        renderDebug : function(renderer, size) {
            var prevClear = renderer.clear;
            renderer.clear = glenum.DEPTH_BUFFER_BIT
            var viewport = renderer.viewport;
            var x = 0, y = 0;
            var width = size || viewport.width / 4;
            var height = width;
            for (var name in this._textures) {
                renderer.setViewport(x, y, width, height);
                this._outputDepthPass.setUniform('depthMap', this._textures[name]);
                this._outputDepthPass.render(renderer);
                x += width;
            }
            renderer.setViewport(viewport);
            renderer.clear = prevClear;
        },

        _bindDepthMaterial : function(casters, bias, slopeScale) {
            for (var i = 0; i < casters.length; i++) {
                var mesh = casters[i];
                var isShadowTransparent = mesh.material.shadowTransparentMap instanceof Texture2D;
                var transparentMap = mesh.material.shadowTransparentMap;
                if (isShadowTransparent) {
                    var matHashKey = mesh.joints.length + '-' + transparentMap.__GUID__;
                    var shaderHashKey = mesh.joints.length + 's';
                } else {
                    var matHashKey = mesh.joints.length;
                    var shaderHashKey = mesh.joints.length;
                }
                var depthMaterial = this._depthMaterials[matHashKey];
                var depthShader = this._depthShaders[shaderHashKey];

                if (mesh.material !== depthMaterial) {  // Not binded yet
                    if (!depthShader) {
                        depthShader = new Shader({
                            vertex : Shader.source("buildin.sm.depth.vertex"),
                            fragment : Shader.source("buildin.sm.depth.fragment")
                        });
                        if (mesh.joints.length > 0) {
                            depthShader.define('vertex', 'SKINNING');
                            depthShader.define('vertex', 'JOINT_NUMBER', mesh.joints.length);   
                        }
                        if (isShadowTransparent) {
                            depthShader.define('both', 'SHADOW_TRANSPARENT');
                        }
                        this._depthShaders[shaderHashKey] = depthShader;
                    }
                    if (!depthMaterial) {
                        // Skinned mesh
                        depthMaterial = new Material({
                            shader : depthShader
                        });
                        this._depthMaterials[matHashKey] = depthMaterial;
                    }

                    this._meshMaterials[mesh.__GUID__] = mesh.material;
                    mesh.material = depthMaterial;

                    if (this.softShadow === ShadowMapPass.VSM) {
                        depthShader.define("fragment", "USE_VSM");
                    } else {
                        depthShader.unDefine("fragment", "USE_VSM");
                    }

                    depthMaterial.setUniform('bias', bias);
                    depthMaterial.setUniform('slopeScale', slopeScale);
                    if (isShadowTransparent) {
                        depthMaterial.set('shadowTransparentMap', transparentMap);
                    }
                }
            }
        },

        _bindDistanceMaterial : function(casters, light) {
            for (var i = 0; i < casters.length; i++) {
                var mesh = casters[i];
                var distanceMaterial = this._distanceMaterials[mesh.joints.length];
                if (mesh.material !== distanceMaterial) {
                    if (!distanceMaterial) {
                        // Skinned mesh
                        distanceMaterial = new Material({
                            shader : new Shader({
                                vertex : Shader.source("buildin.sm.distance.vertex"),
                                fragment : Shader.source("buildin.sm.distance.fragment")
                            })
                        });
                        if (mesh.joints.length > 0) {
                            distanceMaterial.shader.define('vertex', 'SKINNING');
                            distanceMaterial.shader.define('vertex', 'JOINT_NUMBER', mesh.joints.length);   
                        }
                        this._distanceMaterials[mesh.joints.length] = distanceMaterial;
                    }

                    this._meshMaterials[mesh.__GUID__] = mesh.material;
                    mesh.material = distanceMaterial;

                    if (this.softShadow === ShadowMapPass.VSM) {
                        distanceMaterial.shader.define("fragment", "USE_VSM");
                    } else {
                        distanceMaterial.shader.unDefine("fragment", "USE_VSM");
                    }
                    distanceMaterial.set("lightPosition", light.position._array);
                    distanceMaterial.set("range", light.range * 5);
                }
            }
        },

        _restoreMaterial : function(casters) {
            for (var i = 0; i < casters.length; i++) {
                var mesh = casters[i];
                mesh.material = this._meshMaterials[mesh.__GUID__];
            }
        },

        _updateCaster : function(mesh) {
            if (mesh.castShadow) {
                this._opaqueCasters.push(mesh);
            }
            if (mesh.receiveShadow) {
                this._receivers.push(mesh);
                mesh.material.__shadowUniformUpdated = false;
                mesh.material.shader.__shadowDefineUpdated = false;
                mesh.material.set('shadowEnabled', 1);
            } else {
                mesh.material.set('shadowEnabled', 0);
            }
            if (this.softShadow === ShadowMapPass.VSM) {
                mesh.material.shader.define('fragment', 'USE_VSM');
            } else {
                mesh.material.shader.unDefine('fragment', 'USE_VSM');
            }
        },

        _update : function(scene) {
            for (var i = 0; i < scene.opaqueQueue.length; i++) {
                this._updateCaster(scene.opaqueQueue[i]);
            }
            for (var i = 0; i < scene.transparentQueue.length; i++) {
                // TODO Transparent object receive shadow will be very slow
                // in stealth demo, still not find the reason
                this._updateCaster(scene.transparentQueue[i]);
            }
            for (var i = 0; i < scene.lights.length; i++) {
                var light = scene.lights[i];
                if (light.castShadow) {
                    this._lightsCastShadow.push(light)
                }
            }
        },

        _renderShadowPass : function(renderer, scene, sceneCamera) {
            var self = this;

            // reset
            for (var name in this._shadowMapNumber) {
                this._shadowMapNumber[name] = 0;
            }
            this._lightsCastShadow.length = 0;
            this._opaqueCasters.length = 0;
            this._receivers.length = 0;

            var _gl = renderer.gl;

            scene.update();

            this._update(scene);

            if (!this._lightsCastShadow.length) {
                return;
            }

            _gl.enable(_gl.DEPTH_TEST);
            _gl.depthMask(true);
            _gl.disable(_gl.BLEND);

            _gl.clearColor(0.0, 0.0, 0.0, 0.0);
            _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

            var cursor = 0;

            // Shadow uniforms
            var spotLightShadowMaps = [];
            var spotLightMatrices = [];
            var directionalLightShadowMaps = [];
            var directionalLightMatrices = [];
            var shadowCascadeClips = [];
            var pointLightShadowMaps = [];
            var pointLightRanges = [];

            // Create textures for shadow map
            for (var i = 0; i < this._lightsCastShadow.length; i++) {
                var light = this._lightsCastShadow[i];
                if (light instanceof DirectionalLight) {
                    this._renderDirectionalLightShadow
                    (
                        renderer,
                        light,
                        scene,
                        sceneCamera,
                        this._opaqueCasters,
                        shadowCascadeClips,
                        directionalLightMatrices,
                        directionalLightShadowMaps
                    );
                } else if (light instanceof SpotLight) {
                    this._renderSpotLightShadow
                    (
                        renderer,
                        light,
                        this._opaqueCasters, 
                        spotLightMatrices,
                        spotLightShadowMaps
                    );
                } else if (light instanceof PointLight) {
                    this._renderPointLightShadow
                    (
                        renderer,
                        light,
                        this._opaqueCasters,
                        pointLightRanges,
                        pointLightShadowMaps
                    )
                }

                this._shadowMapNumber[light.type]++;
            };
            this._restoreMaterial(this._opaqueCasters);

            if (this.shadowCascade > 1 && this._shadowMapNumber.DIRECTIONAL_LIGHT > 1) {
                console.warn('There is only one directional light can cast shadow when using cascaded shadow map');
            }

            var shadowCascadeClipsNear = shadowCascadeClips.slice();
            var shadowCascadeClipsFar = shadowCascadeClips.slice();
            shadowCascadeClipsNear.pop();
            shadowCascadeClipsFar.shift();

            for (var i = 0; i < this._receivers.length; i++) {
                var mesh = this._receivers[i];
                var material = mesh.material;
                if (material.__shadowUniformUpdated) {
                    continue;
                }
                var shader = material.shader;

                if (!shader.__shadowDefineUpdated) {
                    var shaderNeedsUpdate = false;
                    for (var lightType in this._shadowMapNumber) {
                        var number = this._shadowMapNumber[lightType];
                        var key = lightType + "_SHADOWMAP_NUMBER";

                        if (shader.fragmentDefines[key] !== number && number > 0) {
                            shader.fragmentDefines[key] = number;
                            shaderNeedsUpdate = true;
                        }
                    }
                    if (shaderNeedsUpdate) {
                        shader.dirty();
                    }
                    if (this.shadowCascade > 1) {
                        shader.define('fragment', 'SHADOW_CASCADE', this.shadowCascade);
                    } else {
                        shader.unDefine('fragment', 'SHADOW_CASCADE');
                    }
                    shader.__shadowDefineUpdated = true;
                }

                if (spotLightShadowMaps.length > 0) {
                    material.setUniform("spotLightShadowMaps", spotLightShadowMaps);
                    material.setUniform("spotLightMatrices", spotLightMatrices);   
                }
                if (directionalLightShadowMaps.length > 0) {
                    material.setUniform("directionalLightShadowMaps", directionalLightShadowMaps);
                    if (this.shadowCascade > 1) {
                        material.setUniform('shadowCascadeClipsNear', shadowCascadeClipsNear);
                        material.setUniform('shadowCascadeClipsFar', shadowCascadeClipsFar);
                    }
                    material.setUniform("directionalLightMatrices", directionalLightMatrices);   
                }
                if (pointLightShadowMaps.length > 0) {
                    material.setUniform("pointLightShadowMaps", pointLightShadowMaps);
                    material.setUniform("pointLightRanges", pointLightRanges);   
                }
                material.__shadowUniformUpdated = true;
            }
        },

        _renderDirectionalLightShadow : (function() {

            var splitFrustum = new Frustum();
            var splitProjMatrix = new Matrix4();
            var cropBBox = new BoundingBox();
            var cropMatrix = new Matrix4();
            var lightViewProjMatrix = new Matrix4();
            var lightProjMatrix = new Matrix4();

            var prevDepth = 0;
            var deltaDepth = 0;
            return function(renderer, light, scene, sceneCamera, casters, shadowCascadeClips, directionalLightMatrices, directionalLightShadowMaps) {

                var shadowBias = light.shadowBias;
                this._bindDepthMaterial(casters, shadowBias, light.shadowSlopeScale);

                casters.sort(Renderer.opaqueSortFunc);

                // Adjust scene camera
                var originalFar = sceneCamera.far;

                // Considering moving speed since the bounding box is from last frame
                // verlet integration ?
                var depth = -sceneCamera.sceneBoundingBoxLastFrame.min.z;
                deltaDepth = Math.max(depth - prevDepth, 0);
                prevDepth = depth;
                depth += deltaDepth;
                // TODO: add a bias
                if (depth > sceneCamera.near) {
                    sceneCamera.far = Math.min(sceneCamera.far, depth);   
                }
                sceneCamera.updateProjectionMatrix();
                sceneCamera.frustum.setFromProjection(sceneCamera.projectionMatrix);
                var lightCamera = this._getDirectionalLightCamera(light, scene, sceneCamera);

                var lvpMat4Arr = lightViewProjMatrix._array;
                mat4.copy(lvpMat4Arr, lightCamera.worldTransform._array);
                mat4.invert(lvpMat4Arr, lvpMat4Arr);
                mat4.multiply(lvpMat4Arr, lightCamera.projectionMatrix._array, lvpMat4Arr);
                mat4.multiply(lvpMat4Arr, lvpMat4Arr, sceneCamera.worldTransform._array);

                lightProjMatrix.copy(lightCamera.projectionMatrix);

                var clipPlanes = [];
                var near = sceneCamera.near;
                var far = sceneCamera.far;
                var rad = sceneCamera.fov / 180 * Math.PI;
                var aspect = sceneCamera.aspect;

                var scaleZ = (near + originalFar) / (near - originalFar);
                var offsetZ = 2 * near * originalFar / (near - originalFar);
                for (var i = 0; i <= this.shadowCascade; i++) {
                    var clog = near * Math.pow(far / near, i / this.shadowCascade);
                    var cuni = near + (far - near) * i / this.shadowCascade;
                    var c = clog * this.cascadeSplitLogFactor + cuni * (1 - this.cascadeSplitLogFactor);
                    clipPlanes.push(c);
                    shadowCascadeClips.push(-(-c * scaleZ + offsetZ) / -c);
                }
                for (var i = 0; i < this.shadowCascade; i++) {
                    var texture = this._getTexture(light.__GUID__ + '_' + i, light);

                    // Get the splitted frustum
                    var nearPlane = clipPlanes[i];
                    var farPlane = clipPlanes[i+1];
                    mat4.perspective(splitProjMatrix._array, rad, aspect, nearPlane, farPlane);
                    splitFrustum.setFromProjection(splitProjMatrix);
                    splitFrustum.getTransformedBoundingBox(cropBBox, lightViewProjMatrix);
                    var _min = cropBBox.min._array;
                    var _max = cropBBox.max._array;
                    cropMatrix.ortho(_min[0], _max[0], _min[1], _max[1], 1, -1);
                    lightCamera.projectionMatrix.multiplyLeft(cropMatrix);

                    var _gl = renderer.gl;

                    frameBuffer.attach(_gl, texture);
                    frameBuffer.bind(renderer);

                    _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

                    // Set bias seperately for each cascade
                    // TODO Simply divide 1.5 ?
                    for (var key in this._depthMaterials) {
                        this._depthMaterials[key].set('shadowBias', shadowBias);
                    }

                    renderer.renderQueue(casters, lightCamera);

                    frameBuffer.unbind(renderer);

                    // Filter for VSM
                    if (this.softShadow === ShadowMapPass.VSM) {
                        this._gaussianFilter(renderer, texture, texture.width);
                    }

                    var matrix = new Matrix4();
                    matrix.copy(lightCamera.worldTransform)
                        .invert()
                        .multiplyLeft(lightCamera.projectionMatrix);

                    directionalLightShadowMaps.push(texture);
                    directionalLightMatrices.push(matrix._array);

                    lightCamera.projectionMatrix.copy(lightProjMatrix);
                }

                // set back
                sceneCamera.far = originalFar;
            }
        })(),

        _renderSpotLightShadow : function(renderer, light, casters, spotLightMatrices, spotLightShadowMaps) {

            this._bindDepthMaterial(casters, light.shadowBias, light.shadowSlopeScale);
            casters.sort(Renderer.opaqueSortFunc);

            var texture = this._getTexture(light.__GUID__, light);
            var camera = this._getSpotLightCamera(light);
            var _gl = renderer.gl;

            frameBuffer.attach(_gl, texture);
            frameBuffer.bind(renderer);

            _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

            renderer.renderQueue(casters, camera);

            frameBuffer.unbind(renderer);

            // Filter for VSM
            if (this.softShadow === ShadowMapPass.VSM) {
                this._gaussianFilter(renderer, texture, texture.width);
            }

            var matrix = new Matrix4();
            matrix.copy(camera.worldTransform)
                .invert()
                .multiplyLeft(camera.projectionMatrix);

            spotLightShadowMaps.push(texture);
            spotLightMatrices.push(matrix._array);
        },

        _renderPointLightShadow : function(renderer, light, casters, pointLightRanges, pointLightShadowMaps) {
            var texture = this._getTexture(light.__GUID__, light);
            var _gl = renderer.gl;
            pointLightShadowMaps.push(texture);
            pointLightRanges.push(light.range * 5);

            this._bindDistanceMaterial(casters, light);
            for (var i = 0; i < 6; i++) {
                var target = targets[i];
                var camera = this._getPointLightCamera(light, target);

                frameBuffer.attach(renderer.gl, texture, _gl.COLOR_ATTACHMENT0, targetMap[target]);
                frameBuffer.bind(renderer);

                _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

                renderer.renderQueue(casters, camera);

                frameBuffer.unbind(renderer);
            }
        },

        _gaussianFilter : function(renderer, texture, size) {
            var parameter = {
                width : size,
                height : size,
                type : glenum.FLOAT
            };
            var _gl = renderer.gl;
            var tmpTexture = texturePool.get(parameter);
            
            frameBuffer.attach(_gl, tmpTexture);
            frameBuffer.bind(renderer);
            this._gaussianPassH.setUniform("texture", texture);
            this._gaussianPassH.setUniform("textureWidth", size);
            this._gaussianPassH.render(renderer);
            frameBuffer.unbind(renderer);

            frameBuffer.attach(_gl, texture);
            frameBuffer.bind(renderer);
            this._gaussianPassV.setUniform("texture", tmpTexture);
            this._gaussianPassV.setUniform("textureHeight", size);
            this._gaussianPassV.render(renderer);
            frameBuffer.unbind(renderer);

            texturePool.put(tmpTexture);
        },

        _getTexture : function(key, light) {
            var texture = this._textures[key];
            var resolution = light.shadowResolution || 512;
            if (!texture) {
                if (light instanceof PointLight) {
                    texture = new TextureCube();
                } else {
                    texture = new Texture2D();
                }
                texture.width = resolution;
                texture.height = resolution;
                if (this.softShadow === ShadowMapPass.VSM) {
                    texture.type = glenum.FLOAT;
                    texture.anisotropic = 4;
                } else {
                    texture.minFilter = glenum.NEAREST;
                    texture.magFilter = glenum.NEAREST;
                    texture.useMipmap = false;
                }
                this._textures[key] = texture;
            }

            return texture;
        },

        _getPointLightCamera : function(light, target) {
            if (!this._lightCameras.point) {
                this._lightCameras.point = {
                    px : new PerspectiveCamera(),
                    nx : new PerspectiveCamera(),
                    py : new PerspectiveCamera(),
                    ny : new PerspectiveCamera(),
                    pz : new PerspectiveCamera(),
                    nz : new PerspectiveCamera()
                };
            }
            var camera = this._lightCameras.point[target];

            camera.far = light.range;
            camera.fov = 90;
            camera.position.set(0, 0, 0);
            switch (target) {
                case 'px':
                    camera.lookAt(Vector3.POSITIVE_X, Vector3.NEGATIVE_Y);
                    break;
                case 'nx':
                    camera.lookAt(Vector3.NEGATIVE_X, Vector3.NEGATIVE_Y);
                    break;
                case 'py':
                    camera.lookAt(Vector3.POSITIVE_Y, Vector3.POSITIVE_Z);
                    break;
                case 'ny':
                    camera.lookAt(Vector3.NEGATIVE_Y, Vector3.NEGATIVE_Z);
                    break;
                case 'pz':
                    camera.lookAt(Vector3.POSITIVE_Z, Vector3.NEGATIVE_Y);
                    break;
                case 'nz':
                    camera.lookAt(Vector3.NEGATIVE_Z, Vector3.NEGATIVE_Y);
                    break;
            }
            camera.position.copy(light.position);
            camera.update();

            return camera;
        },

        _getDirectionalLightCamera : (function() {
            var lightViewMatrix = new Matrix4();
            var lightViewBBox = new BoundingBox();
            // Camera of directional light will be adjusted
            // to contain the view frustum and scene bounding box as tightly as possible
            return function(light, scene, sceneCamera) {
                if (!this._lightCameras.directional) {
                    this._lightCameras.directional = new OrthoCamera();
                }
                var camera = this._lightCameras.directional;

                // Move to the center of frustum(in world space)
                camera.position
                    .copy(sceneCamera.frustum.boundingBox.min)
                    .add(sceneCamera.frustum.boundingBox.max)
                    .scale(0.5)
                    .transformMat4(sceneCamera.worldTransform);
                camera.rotation.copy(light.rotation);
                camera.scale.copy(light.scale);
                camera.updateLocalTransform();
                camera.updateWorldTransform();

                // Transform to light view space
                lightViewMatrix
                    .copy(camera.worldTransform)
                    .invert()
                    .multiply(sceneCamera.worldTransform);
                
                sceneCamera.frustum.getTransformedBoundingBox(lightViewBBox, lightViewMatrix);
                var min = lightViewBBox.min._array;
                var max = lightViewBBox.max._array;

                // Move camera to adjust the near to 0
                // TODO : some scene object cast shadow in view will also be culled
                // add a bias?
                camera.position.scaleAndAdd(camera.worldTransform.forward, max[2] + 10);
                camera.near = 0;
                camera.far = -min[2] + max[2] + 10;
                camera.left = min[0];
                camera.right = max[0];
                camera.top = max[1];
                camera.bottom = min[1];
                camera.update(true);

                return camera;
            }
        })(),

        _getSpotLightCamera : function(light) {
            if (!this._lightCameras.spot) {
                this._lightCameras.spot = new PerspectiveCamera();
            }
            var camera = this._lightCameras.spot;
            // Update properties
            camera.fov = light.penumbraAngle * 2;
            camera.far = light.range;
            camera.worldTransform.copy(light.worldTransform);
            camera.updateProjectionMatrix();
            mat4.invert(camera.viewMatrix._array, camera.worldTransform._array);

            return camera
        },

        dispose : function(_gl) {
            for (var guid in this._depthMaterials) {
                var mat = this._depthMaterials[guid];
                mat.dispose();
            }
            for (var guid in this._distanceMaterials) {
                var mat = this._distanceMaterials[guid];
                mat.dispose();
            }

            for (var name in this._textures) {
                this._textures[name].dispose(_gl);
            }

            this._depthMaterials = {};
            this._distanceMaterials = {};
            this._textures = {};
            this._lightCameras = {};
            this._shadowMapNumber = {
                'POINT_LIGHT' : 0,
                'DIRECTIONAL_LIGHT' : 0,
                'SPOT_LIGHT' : 0
            };
            this._meshMaterials = {};

            for (var i = 0; i < this._receivers.length; i++) {
                var mesh = this._receivers[i];
                var material = mesh.material;
                var shader = material.shader;
                shader.unDefine('fragment', 'POINT_LIGHT_SHADOW_NUMBER');
                shader.unDefine('fragment', 'DIRECTIONAL_LIGHT_SHADOW_NUMBER');
                shader.unDefine('fragment', 'AMBIENT_LIGHT_SHADOW_NUMBER');
                material.set('shadowEnabled', 0);
            }

            this._opaqueCasters = [];
            this._receivers = [];
            this._lightsCastShadow = [];
        }
    });

    ShadowMapPass.VSM = 1;
    ShadowMapPass.PCF = 2;
    
    return ShadowMapPass;
});
define('qtek/util/dds',['require','../Texture','../texture/Texture2D','../texture/TextureCube'],function(require) {

    var Texture = require('../Texture');
    var Texture2D = require('../texture/Texture2D');
    var TextureCube = require('../texture/TextureCube');

    // http://msdn.microsoft.com/en-us/library/windows/desktop/bb943991(v=vs.85).aspx
    // https://github.com/toji/webgl-texture-utils/blob/master/texture-util/dds.js
    var DDS_MAGIC = 0x20534444;

    var DDSD_CAPS = 0x1,
        DDSD_HEIGHT = 0x2,
        DDSD_WIDTH = 0x4,
        DDSD_PITCH = 0x8,
        DDSD_PIXELFORMAT = 0x1000,
        DDSD_MIPMAPCOUNT = 0x20000,
        DDSD_LINEARSIZE = 0x80000,
        DDSD_DEPTH = 0x800000;

    var DDSCAPS_COMPLEX = 0x8,
        DDSCAPS_MIPMAP = 0x400000,
        DDSCAPS_TEXTURE = 0x1000;

    var DDSCAPS2_CUBEMAP = 0x200,
        DDSCAPS2_CUBEMAP_POSITIVEX = 0x400,
        DDSCAPS2_CUBEMAP_NEGATIVEX = 0x800,
        DDSCAPS2_CUBEMAP_POSITIVEY = 0x1000,
        DDSCAPS2_CUBEMAP_NEGATIVEY = 0x2000,
        DDSCAPS2_CUBEMAP_POSITIVEZ = 0x4000,
        DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x8000,
        DDSCAPS2_VOLUME = 0x200000;

    var DDPF_ALPHAPIXELS = 0x1,
        DDPF_ALPHA = 0x2,
        DDPF_FOURCC = 0x4,
        DDPF_RGB = 0x40,
        DDPF_YUV = 0x200,
        DDPF_LUMINANCE = 0x20000;

    function fourCCToInt32(value) {
        return value.charCodeAt(0) +
            (value.charCodeAt(1) << 8) +
            (value.charCodeAt(2) << 16) +
            (value.charCodeAt(3) << 24);
    }

    function int32ToFourCC(value) {
        return String.fromCharCode(
            value & 0xff,
            (value >> 8) & 0xff,
            (value >> 16) & 0xff,
            (value >> 24) & 0xff
        );
    }

    var headerLengthInt = 31; // The header length in 32 bit ints

    var FOURCC_DXT1 = fourCCToInt32("DXT1");
    var FOURCC_DXT3 = fourCCToInt32("DXT3");
    var FOURCC_DXT5 = fourCCToInt32("DXT5");
     // Offsets into the header array
    var off_magic = 0;

    var off_size = 1;
    var off_flags = 2;
    var off_height = 3;
    var off_width = 4;

    var off_mipmapCount = 7;

    var off_pfFlags = 20;
    var off_pfFourCC = 21;

    var off_caps = 27;
    var off_caps2 = 28;
    var off_caps3 = 29;
    var off_caps4 = 30;

    var ret = {
        parse : function(arrayBuffer, out) {
            var header = new Int32Array(arrayBuffer, 0, headerLengthInt);
            if (header[off_magic] !== DDS_MAGIC) {
                return null;
            }
            if (!header(off_pfFlags) & DDPF_FOURCC) {
                return null;
            }

            var fourCC = header(off_pfFourCC);
            var width = header[off_width];
            var height = header[off_height];
            var isCubeMap = header[off_caps2] & DDSCAPS2_CUBEMAP;
            var hasMipmap = header[off_flags] & DDSD_MIPMAPCOUNT;
            var blockBytes, internalFormat;
            switch(fourCC) {
                case FOURCC_DXT1:
                    blockBytes = 8;
                    internalFormat = Texture.COMPRESSED_RGB_S3TC_DXT1_EXT;
                    break;
                case FOURCC_DXT3:
                    blockBytes = 16;
                    internalFormat = Texture.COMPRESSED_RGBA_S3TC_DXT3_EXT;
                    break;
                case FOURCC_DXT5:
                    blockBytes = 16;
                    internalFormat = Texture.COMPRESSED_RGBA_S3TC_DXT5_EXT;
                    break;
                default:
                    return null;
            }
            var dataOffset = header[off_size] + 4;
            // TODO: Suppose all face are existed
            var faceNumber = isCubeMap ? 6 : 1;
            var mipmapCount = 1;
            if (hasMipmap) {
                mipmapCount = Math.max(1, header[off_mipmapCount]);
            }

            var textures = [];
            for (var f = 0; f < faceNumber; f++) {
                var _width = width;
                var _height = height;
                textures[f] = new Texture2D({
                    width : _width,
                    height : _height,
                    format : internalFormat
                });
                var mipmaps = [];
                for (var i = 0; i < mipmapCount; i++) {
                    var dataLength = Math.max(4, _width) / 4 * Math.max(4, _height) / 4 * blockBytes;
                    var byteArray = new Uint8Array(arrayBuffer, dataOffset, dataLength);

                    dataOffset += dataLength;
                    _width *= 0.5;
                    _height *= 0.5;
                    mipmaps[i] = byteArray;
                }
                textures[f].pixels = mipmaps[0];
                if (hasMipmap) {
                    textures[f].mipmaps = mipmaps;
                }
            }
            // TODO
            // return isCubeMap ? textures : textures[0];
            if (out) {
                out.width = textures[0].width;
                out.height = textures[0].height;
                out.format = textures[0].format;
                out.pixels = textures[0].pixels;
                out.mipmaps = textures[0].mipmaps;
            } else {
                return textures[0];
            }
        }
    }
});
define('qtek/util/hdr',['require','../Texture','../texture/Texture2D'],function(require) {

    var Texture = require('../Texture');
    var Texture2D = require('../texture/Texture2D');
    var toChar = String.fromCharCode;

    var MINELEN = 8;
    var MAXELEN = 0x7fff;
    function rgbe2float(rgbe, buffer, offset, exposure) {
        if (rgbe[3] > 0) {
            var f = Math.pow(2.0, rgbe[3] - 128 - 8 + exposure);
            buffer[offset + 0] = rgbe[0] * f;
            buffer[offset + 1] = rgbe[1] * f;
            buffer[offset + 2] = rgbe[2] * f;
        } else {
            buffer[offset + 0] = 0;
            buffer[offset + 1] = 0;
            buffer[offset + 2] = 0;
        }
        buffer[offset + 3] = 1.0;
        return buffer;
    }

    function uint82string(array, offset, size) {
        var str = '';
        for (var i = offset; i < size; i++) {
            str += toChar(array[i]);
        }
        return str;
    }

    function copyrgbe(s, t) {
        t[0] = s[0];
        t[1] = s[1];
        t[2] = s[2];
        t[3] = s[3];
    }

    // TODO : check
    function oldReadColors(scan, buffer, offset, xmax) {
        var rshift = 0, x = 0, len = xmax;
        while (len > 0) {
            scan[x][0] = buffer[offset++];
            scan[x][1] = buffer[offset++];
            scan[x][2] = buffer[offset++];
            scan[x][3] = buffer[offset++];
            if (scan[x][0] === 1 && scan[x][1] === 1 && scan[x][2] === 1) {
                // exp is count of repeated pixels
                for (var i = (scan[x][3] << rshift) >>> 0; i > 0; i--) {
                    copy(scan[x-1], scan[x]);
                    x++;
                    len--;
                }
                rshift += 8;
            } else {
                x++;
                len--;
                rshift = 0;
            }
        }
        return offset;
    }

    function readColors(scan, buffer, offset, xmax) {
        if ((xmax < MINELEN) | (xmax > MAXELEN)) {
            return oldReadColors(scan, buffer, offset, xmax);
        }
        var i = buffer[offset++];
        if (i != 2) {
            return oldReadColors(scan, buffer, offset - 1, xmax);
        }
        scan[0][1] = buffer[offset++];
        scan[0][2] = buffer[offset++];

        i = buffer[offset++];
        if ((((scan[0][2] << 8) >>> 0) | i) >>> 0 !== xmax) {
            return null;
        }
        for (var i = 0; i < 4; i++) {
            for (var x = 0; x < xmax;) {
                var code = buffer[offset++];
                if (code > 128) {
                    code = (code & 127) >>> 0;
                    var val = buffer[offset++];
                    while (code--) {
                        scan[x++][i] = val;
                    }
                } else {
                    while (code--) {
                        scan[x++][i] = buffer[offset++];
                    }
                }
            }
        }
        return offset;
    }


    var ret = {
        // http://www.graphics.cornell.edu/~bjw/rgbe.html
        // Blender source
        // http://radsite.lbl.gov/radiance/refer/Notes/picture_format.html
        parseRGBE : function(arrayBuffer, texture, exposure) {
            if (exposure === undefined) {
                exposure = 0;
            }
            var data = new Uint8Array(arrayBuffer);
            var size = data.length;
            if (uint82string(data, 0, 2) !== '#?') {
                return;
            }
            // find empty line, next line is resolution info
            for (var i = 2; i < size; i++) {
                if (toChar(data[i]) === '\n' && toChar(data[i+1]) === '\n') {
                    break;
                }
            }
            if (i >= size) { // not found
                return;
            }
            // find resolution info line
            i += 2;
            var str = ''
            for (; i < size; i++) {
                var _char = toChar(data[i]);
                if (_char === '\n') {
                    break;
                }
                str += _char;
            }
            // -Y M +X N
            var tmp = str.split(' ');
            var height = parseInt(tmp[1]);
            var width = parseInt(tmp[3]);
            if (!width || !height) {
                return;
            }

            // read and decode actual data
            var offset = i+1;
            var scanline = [];
            // memzero
            for (var x = 0; x < width; x++) {
                scanline[x] = [];
                for (var j = 0; j < 4; j++) {
                    scanline[x][j] = 0;
                }
            }
            var pixels = new Float32Array(width * height * 4);
            var offset2 = 0;
            for (var y = 0; y < height; y++) {
                var offset = readColors(scanline, data, offset, width);
                if (!offset) {
                    return null;
                }
                for (var x = 0; x < width; x++) {
                    rgbe2float(scanline[x], pixels, offset2, exposure);
                    offset2 += 4;
                }
            }

            if (!texture) {
                texture = new Texture2D();
            }
            texture.width = width;
            texture.height = height;
            texture.pixels = pixels;
            texture.type = Texture.FLOAT;
            return texture;
        },

        parseRGBEFromPNG : function(png) {

        }
    }
    return ret;
});
/**
 *
 * @export{object} mesh
 */
define('qtek/util/mesh',['require','../Geometry','../DynamicGeometry','../StaticGeometry','../Mesh','../Node','../Material','../Shader','glmatrix','../math/BoundingBox'],function(require) {
    
    var Geometry = require("../Geometry");
    var DynamicGeometry = require("../DynamicGeometry");
    var StaticGeometry = require("../StaticGeometry");
    var Mesh = require("../Mesh");
    var Node = require("../Node");
    var Material = require("../Material");
    var Shader = require("../Shader");
    var glMatrix = require("glmatrix");
    var BoundingBox = require('../math/BoundingBox');
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;

    var arraySlice = Array.prototype.slice;

    var meshUtil = {
        /**
         * Merge multiple meshes to one.
         * Note that these meshes must have the same material
         */
        merge : function(meshes, applyWorldTransform) {

            if (! meshes.length) {
                return;
            }

            var templateMesh = meshes[0];
            var templateGeo = templateMesh.geometry;
            var material = templateMesh.material;
            var isStatic = templateGeo instanceof StaticGeometry;

            var geometry = isStatic ? new StaticGeometry() : new DynamicGeometry();
            geometry.boundingBox = new BoundingBox();
            var faces = geometry.faces;

            var attributeNames = Object.keys(templateGeo.getEnabledAttributes());

            for (var i = 0; i < attributeNames.length; i++) {
                var name = attributeNames[i];
                var attr = templateGeo.attributes[name];
                // Extend custom attributes
                if (! geometry.attributes[name]) {
                    geometry.attributes[name] = attr.clone(false)
                }
            }

            var inverseTransposeMatrix = mat4.create();
            // Initialize the array data and merge bounding box
            if (isStatic) {
                var nVertex = 0;
                var nFace = 0;
                for (var k = 0; k < meshes.length; k++) {
                    var currentGeo = meshes[k].geometry;
                    if (currentGeo.boundingBox) {
                        currentGeo.boundingBox.applyTransform(applyWorldTransform ? meshes[k].worldTransform : meshes[k].localTransform);
                        geometry.boundingBox.union(currentGeo.boundingBox);
                    }
                    nVertex += currentGeo.getVertexNumber();
                    nFace += currentGeo.getFaceNumber();
                }
                for (var n = 0; n < attributeNames.length; n++) {
                    var name = attributeNames[n];
                    var attrib = geometry.attributes[name];
                    // TODO other type
                    attrib.value = new Float32Array(nVertex * attrib.size);
                }
                // TODO Uint32Array
                geometry.faces = new Uint16Array(nFace * 3);
            }

            var vertexOffset = 0;
            var faceOffset = 0;
            var useFaces = templateGeo.isUseFace();
            
            for (var mm = 0; mm < meshes.length; mm++) {
                var mesh = meshes[mm];  
                var currentGeo = mesh.geometry;

                var nVertex = currentGeo.getVertexNumber();

                var matrix = applyWorldTransform ? mesh.worldTransform._array : mesh.localTransform._array;
                mat4.invert(inverseTransposeMatrix, matrix);
                mat4.transpose(inverseTransposeMatrix, inverseTransposeMatrix);

                for (var nn = 0; nn < attributeNames.length; nn++) {
                    var name = attributeNames[nn];
                    var currentAttr = currentGeo.attributes[name];
                    var targetAttr = geometry.attributes[name];
                    // Skip the unused attributes;
                    if (!currentAttr.value.length) {
                        continue;
                    }
                    if (isStatic) {
                        var len = currentAttr.value.length;
                        var size = currentAttr.size;
                        var offset = vertexOffset * size;
                        var count = len / size;
                        for (var i = 0; i < len; i++) {
                            targetAttr.value[offset + i] = currentAttr.value[i];
                        }
                        // Transform position, normal and tangent
                        if (name === 'position') {
                            vec3.forEach(targetAttr.value, size, offset, count, vec3.transformMat4, matrix);
                        } else if (name === 'normal' || name === 'tangent') {
                            vec3.forEach(targetAttr.value, size, offset, count, vec3.transformMat4, inverseTransposeMatrix);
                        }
                    } else {
                        for (var i = 0; i < nVertex; i++) {
                            // Transform position, normal and tangent
                            if (name === "position") {
                                var newValue = vec3.create();
                                vec3.transformMat4(newValue, currentAttr.value[i], matrix);
                                targetAttr.value.push(newValue);
                            }
                            else if (name === "normal" || name === 'tangent') {
                                var newValue = vec3.create();
                                vec3.transformMat4(newValue, currentAttr.value[i], inverseTransposeMatrix);
                                targetAttr.value.push(newValue);
                            } else {
                                targetAttr.value.push(currentAttr.value[i]);
                            }
                        }
                    }
                }

                if (useFaces) {
                    var len = currentGeo.faces.length;
                    if (isStatic) {
                        for (var i = 0; i < len; i++) {
                            geometry.faces[i + faceOffset] = currentGeo.faces[i] + vertexOffset;
                        }
                        faceOffset += len;
                    } else {
                        for (var i = 0; i < len; i++) {
                            var newFace = [];
                            var face = currentGeo.faces[i];
                            newFace[0] = face[0] + vertexOffset;
                            newFace[1] = face[1] + vertexOffset;
                            newFace[2] = face[2] + vertexOffset;

                            faces.push(newFace);
                        }   
                    }
                }

                vertexOffset += nVertex;
            }

            return new Mesh({
                material : material,
                geometry : geometry
            });
        },

        splitByJoints : function(mesh, maxJointNumber, inPlace) {
            var geometry = mesh.geometry;
            var skeleton = mesh.skeleton;
            var material = mesh.material;
            var shader = material.shader;
            var joints = mesh.joints;
            if (!geometry || !skeleton || !joints.length) {
                return;
            }
            if (joints.length < maxJointNumber) {
                return mesh;
            }
            var isStatic = geometry instanceof StaticGeometry;

            var shaders = {};

            var faces = geometry.faces;
            
            var meshNumber = Math.ceil(joints.length / maxJointNumber);
            var faceLen = geometry.getFaceNumber();
            var rest = faceLen;
            var isFaceAdded = [];
            var jointValues = geometry.attributes.joint.value;
            for (var i = 0; i < faceLen; i++) {
                isFaceAdded[i] = false;
            }
            var addedJointIdxPerFace = [];

            var buckets = [];
            while(rest > 0) {
                var bucketFaces = [];
                var bucketJointReverseMap = [];
                var bucketJoints = [];
                var subJointNumber = 0;
                for (var i = 0; i < joints.length; i++) {
                    bucketJointReverseMap[i] = -1;
                }
                for (var f = 0; f < faceLen; f++) {
                    if (isFaceAdded[f]) {
                        continue;
                    }
                    var canAddToBucket = true;
                    var addedNumber = 0;
                    for (var i = 0; i < 3; i++) {
                        
                        var idx = isStatic ? faces[f * 3 + i] : faces[f][i];
                        
                        for (var j = 0; j < 4; j++) {
                            if (isStatic) {
                                var jointIdx = jointValues[idx * 4 + j];
                            } else {
                                var jointIdx = jointValues[idx][j];
                            }
                            if (jointIdx >= 0) {
                                if (bucketJointReverseMap[jointIdx] === -1) {
                                    if (subJointNumber < maxJointNumber) {
                                        bucketJointReverseMap[jointIdx] = subJointNumber;
                                        bucketJoints[subJointNumber++] = jointIdx;
                                        addedJointIdxPerFace[addedNumber++] = jointIdx;
                                    } else {
                                        canAddToBucket = false;
                                    }
                                }
                            }
                        }
                    }
                    if (!canAddToBucket) {
                        // Reverse operation
                        for (var i = 0; i < addedNumber; i++) {
                            bucketJointReverseMap[addedJointIdxPerFace[i]] = -1;
                            bucketJoints.pop();
                            subJointNumber--;
                        }
                    } else {
                        if (isStatic) {
                            bucketFaces.push(faces.subarray(f * 3, (f + 1) * 3));
                        } else {
                            bucketFaces.push(faces[f]);
                        }
                        isFaceAdded[f] = true;
                        rest--;
                    }
                }
                buckets.push({
                    faces : bucketFaces,
                    joints : bucketJoints.map(function(idx){return joints[idx];}),
                    jointReverseMap : bucketJointReverseMap
                });
            }

            var root = new Node({
                name : mesh.name
            });
            var attribNames = Object.keys(geometry.getEnabledAttributes());
            attribNames.splice(attribNames.indexOf('joint'), 1);
            // Map from old vertex index to new vertex index
            var newIndices = [];
            for (var b = 0; b < buckets.length; b++) {
                var bucket = buckets[b];
                var jointReverseMap = bucket.jointReverseMap;
                var subJointNumber = bucket.joints.length;
                var subShader = shaders[subJointNumber];
                if (!subShader) {
                    subShader = shader.clone();
                    subShader.define('vertex', 'JOINT_NUMBER', subJointNumber);
                    shaders[subJointNumber] = subShader;
                }
                var subMat = new Material({
                    name : [material.name, b].join('-'),
                    shader : subShader,
                    transparent : material.transparent,
                    depthTest : material.depthTest,
                    depthMask : material.depthMask,
                    blend : material.blend
                });
                for (var name in material.uniforms) {
                    var uniform = material.uniforms[name];
                    subMat.set(name, uniform.value);
                }
                if (isStatic) {
                    var subGeo = new StaticGeometry();
                } else {
                    var subGeo = new DynamicGeometry();
                }
                var subMesh = new Mesh({
                    name : [mesh.name, i].join('-'),
                    material : subMat,
                    geometry : subGeo,
                    skeleton : skeleton,
                    joints : bucket.joints.slice()
                });
                var nVertex = 0;
                var nVertex2 = geometry.getVertexNumber();
                for (var i = 0; i < nVertex2; i++) {
                    newIndices[i] = -1;
                }
                // Count sub geo number
                for (var f = 0; f < bucket.faces.length; f++) {
                    var face = bucket.faces[f];
                    for (var i = 0; i < 3; i++) {
                        var idx = face[i];
                        if (newIndices[idx] === -1) {
                            newIndices[idx] = nVertex;
                            nVertex++;
                        }
                    }
                }
                if (isStatic) {
                    for (var a = 0; a < attribNames.length; a++) {
                        var attribName = attribNames[a];
                        var subAttrib = subGeo.attributes[attribName];
                        // TODO other type
                        subAttrib.value = new Float32Array(nVertex * subAttrib.size);
                    }
                    subGeo.attributes.joint.value = new Float32Array(nVertex * 4);
                    subGeo.faces = new Uint16Array(bucket.faces.length * 3);
                }

                var faceOffset = 0;
                nVertex = 0;
                for (var i = 0; i < nVertex2; i++) {
                    newIndices[i] = -1;
                }

                for (var f = 0; f < bucket.faces.length; f++) {
                    if (!isStatic) {
                        var newFace = [];
                    }
                    var face = bucket.faces[f];
                    for (var i = 0; i < 3; i++) {
                        
                        var idx = face[i];

                        if (newIndices[idx] === -1) {
                            newIndices[idx] = nVertex;
                            for (var a = 0; a < attribNames.length; a++) {
                                var attribName = attribNames[a];
                                var attrib = geometry.attributes[attribName];
                                var subAttrib = subGeo.attributes[attribName];
                                var size = attrib.size;

                                if (isStatic) {
                                    for (var j = 0; j < size; j++) {
                                        subAttrib.value[nVertex * size + j] = attrib.value[idx * size + j];
                                    }
                                } else {
                                    if (attrib.size === 1) {
                                        subAttrib.value[nVertex] = attrib.value[idx];
                                    } else {
                                        subAttrib.value[nVertex] = arraySlice.call(attrib.value[idx]);
                                    }   
                                }
                            }
                            if (isStatic) {
                                for (var j = 0; j < 4; j++) {
                                    var jointIdx = geometry.attributes.joint.value[idx * 4 + j];
                                    var offset = nVertex * 4 + j
                                    if (jointIdx >= 0) {
                                        subGeo.attributes.joint.value[offset] = jointReverseMap[jointIdx];
                                    } else {
                                        subGeo.attributes.joint.value[offset] = -1;
                                    }
                                }
                            } else {
                                var newJoints = subGeo.attributes.joint.value[nVertex] = [-1, -1, -1, -1];
                                // joints
                                for (var j = 0; j < 4; j++) {
                                    var jointIdx = geometry.attributes.joint.value[idx][j];
                                    if (jointIdx >= 0) {
                                        newJoints[j] = jointReverseMap[jointIdx];
                                    }
                                }
                            }
                            nVertex++;
                        }
                        if (isStatic) {
                            subGeo.faces[faceOffset++] = newIndices[idx];
                        } else {
                            newFace.push(newIndices[idx]);
                        }
                    }
                    if (!isStatic) {
                        subGeo.faces.push(newFace);
                    }
                }

                root.add(subMesh);
            }
            var children = mesh.children();
            for (var i = 0; i < children.length; i++) {
                root.add(children[i]);
            }
            root.position.copy(mesh.position);
            root.rotation.copy(mesh.rotation);
            root.scale.copy(mesh.scale);

            material.dispose();
            if (inPlace) {
                if (mesh.parent) {
                    var parent = mesh.parent;
                    parent.remove(mesh);
                    parent.add(root);
                }
            }
            return root;
        }
    }

    return meshUtil;
});
define('qtek/util/texture',['require','../Texture','../texture/Texture2D','../texture/TextureCube','../core/request','../prePass/EnvironmentMap','../plugin/Skydome','../Scene','./dds','./hdr'],function(require) {

    var Texture = require('../Texture');
    var Texture2D = require('../texture/Texture2D');
    var TextureCube = require('../texture/TextureCube');
    var request = require('../core/request');
    var EnvironmentMapPass = require('../prePass/EnvironmentMap');
    var Skydome = require('../plugin/Skydome');
    var Scene = require('../Scene');

    var dds = require('./dds');
    var hdr = require('./hdr');

    var environmentMapPass = new EnvironmentMapPass();

    var textureUtil = {
        loadTexture : function(path, onsuccess, onerror) {
            var texture;
            if (typeof(path) === 'string') {
                if (path.match(/.hdr$/)) {
                    texture = new Texture2D({
                        width : 0,
                        height : 0
                    });
                    textureUtil._fetchTexture(
                        path,
                        function (data) {
                            hdr.parseRGBE(data, texture);
                            texture.dirty();
                            onsuccess && onsuccess(texture);
                        },
                        onerror
                    );
                    return texture;
                } else if (path.match(/.dds$/)) {
                    texture = new Texture2D({
                        width : 0,
                        height : 0
                    });
                    textureUtil._fetchTexture(
                        path,
                        function (data) {
                            dds.parse(data, texture);
                            texture.dirty();
                            onsuccess && onsuccess(texture);
                        },
                        onerror
                    );
                } else {
                    texture = new Texture2D();
                    texture.load(path);
                    texture.success(onsuccess);
                    texture.error(onerror);
                }
            } else if (path instanceof Array) {
                var texture = new TextureCube();
                texture.load(path);
                texture.success(onsuccess);
                texture.error(onerror);
            }
            return texture;
        },

        loadPanorama : function(path, cubeMap, renderer, onsuccess, onerror) {
            var self = this;
            textureUtil.loadTexture(path, function(texture) {
                // PENDING 
                texture.flipY = false;
                self.panoramaToCubeMap(texture, cubeMap, renderer);
                texture.dispose(renderer.gl);
                onsuccess && onsuccess(cubeMap);
            }, onerror);
        },

        panoramaToCubeMap : function(panoramaMap, cubeMap, renderer) {
            var skydome = new Skydome({
                scene : new Scene
            });
            skydome.material.set('diffuseMap', panoramaMap);
            environmentMapPass.texture = cubeMap;
            environmentMapPass.render(renderer, skydome.scene);
            environmentMapPass.texture = null;
            return cubeMap;
        },

        _fetchTexture : function(path, onsuccess, onerror) {
            request.get({
                url : path,
                responseType : 'arraybuffer',
                onload : onsuccess,
                onerror : onerror
            });
        },

        createChessboard : function(size, unitSize, color1, color2) {
            size = size || 512;
            unitSize = unitSize || 64;
            color1 = color1 || 'black';
            color2 = color2 || 'white';

            var repeat = Math.ceil(size / unitSize);

            var canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = color2;
            ctx.fillRect(0, 0, size, size);

            ctx.fillStyle = color1;
            for (var i = 0; i < repeat; i++) {
                for (var j = 0; j < repeat; j++) {
                    var isFill = j % 2 ? (i % 2) : (i % 2 - 1);
                    if (isFill) {
                        ctx.fillRect(i * unitSize, j * unitSize, unitSize, unitSize);
                    }
                }
            }

            var texture = new Texture2D({
                image : canvas,
                anisotropic : 8
            });

            return texture;
        },

        createBlank : function(color) {
            var canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);

            var texture = new Texture2D({
                image : canvas
            });

            return texture;
        }
    }

    return textureUtil;
});
define('qtek/qtek',['require','qtek/2d/Camera','qtek/2d/CanvasRenderer','qtek/2d/Gradient','qtek/2d/LinearGradient','qtek/2d/Node','qtek/2d/Pattern','qtek/2d/RadialGradient','qtek/2d/Scene','qtek/2d/Style','qtek/2d/picking/Box','qtek/2d/picking/Pixel','qtek/2d/shape/Arc','qtek/2d/shape/Circle','qtek/2d/shape/Ellipse','qtek/2d/shape/HTML','qtek/2d/shape/Image','qtek/2d/shape/Line','qtek/2d/shape/Path','qtek/2d/shape/Polygon','qtek/2d/shape/Rectangle','qtek/2d/shape/RoundedRectangle','qtek/2d/shape/SVGPath','qtek/2d/shape/Sector','qtek/2d/shape/Text','qtek/2d/shape/TextBox','qtek/2d/util','qtek/Camera','qtek/DynamicGeometry','qtek/FrameBuffer','qtek/Geometry','qtek/Joint','qtek/Layer','qtek/Light','qtek/Material','qtek/Mesh','qtek/Node','qtek/Renderer','qtek/Scene','qtek/Shader','qtek/Skeleton','qtek/Stage','qtek/StaticGeometry','qtek/Texture','qtek/animation/Animation','qtek/animation/Blend1DClip','qtek/animation/Blend2DClip','qtek/animation/Clip','qtek/animation/SamplerClip','qtek/animation/SkinningClip','qtek/animation/TransformClip','qtek/animation/easing','qtek/async/Task','qtek/async/TaskGroup','qtek/camera/Orthographic','qtek/camera/Perspective','qtek/compositor/Compositor','qtek/compositor/Graph','qtek/compositor/Group','qtek/compositor/Node','qtek/compositor/Pass','qtek/compositor/SceneNode','qtek/compositor/TextureNode','qtek/compositor/texturePool','qtek/core/Base','qtek/core/Cache','qtek/core/Event','qtek/core/glenum','qtek/core/glinfo','qtek/core/mixin/derive','qtek/core/mixin/notifier','qtek/core/request','qtek/core/util','qtek/geometry/Capsule','qtek/geometry/Cone','qtek/geometry/Cube','qtek/geometry/Cylinder','qtek/geometry/Plane','qtek/geometry/Sphere','qtek/light/Ambient','qtek/light/Directional','qtek/light/Point','qtek/light/Spot','qtek/loader/FX','qtek/loader/GLTF','qtek/loader/SVG','qtek/loader/three/Model','qtek/math/BoundingBox','qtek/math/Frustum','qtek/math/Matrix2','qtek/math/Matrix2d','qtek/math/Matrix3','qtek/math/Matrix4','qtek/math/Plane','qtek/math/Quaternion','qtek/math/Ray','qtek/math/Value','qtek/math/Vector2','qtek/math/Vector3','qtek/math/Vector4','qtek/particleSystem/Emitter','qtek/particleSystem/ForceField','qtek/particleSystem/GravityField','qtek/particleSystem/Particle','qtek/particleSystem/ParticleSystem','qtek/picking/Pixel','qtek/plugin/FirstPersonControl','qtek/plugin/InfinitePlane','qtek/plugin/OrbitControl','qtek/plugin/Skybox','qtek/plugin/Skydome','qtek/prePass/EnvironmentMap','qtek/prePass/Reflection','qtek/prePass/ShadowMap','qtek/shader/library','qtek/texture/Texture2D','qtek/texture/TextureCube','qtek/util/dds','qtek/util/delaunay','qtek/util/hdr','qtek/util/mesh','qtek/util/texture','glmatrix'], function(require){
	
	var exportsObject =  {
	"2d": {
		"Camera": require('qtek/2d/Camera'),
		"CanvasRenderer": require('qtek/2d/CanvasRenderer'),
		"Gradient": require('qtek/2d/Gradient'),
		"LinearGradient": require('qtek/2d/LinearGradient'),
		"Node": require('qtek/2d/Node'),
		"Pattern": require('qtek/2d/Pattern'),
		"RadialGradient": require('qtek/2d/RadialGradient'),
		"Scene": require('qtek/2d/Scene'),
		"Style": require('qtek/2d/Style'),
		"picking": {
			"Box": require('qtek/2d/picking/Box'),
			"Pixel": require('qtek/2d/picking/Pixel')
		},
		"shape": {
			"Arc": require('qtek/2d/shape/Arc'),
			"Circle": require('qtek/2d/shape/Circle'),
			"Ellipse": require('qtek/2d/shape/Ellipse'),
			"HTML": require('qtek/2d/shape/HTML'),
			"Image": require('qtek/2d/shape/Image'),
			"Line": require('qtek/2d/shape/Line'),
			"Path": require('qtek/2d/shape/Path'),
			"Polygon": require('qtek/2d/shape/Polygon'),
			"Rectangle": require('qtek/2d/shape/Rectangle'),
			"RoundedRectangle": require('qtek/2d/shape/RoundedRectangle'),
			"SVGPath": require('qtek/2d/shape/SVGPath'),
			"Sector": require('qtek/2d/shape/Sector'),
			"Text": require('qtek/2d/shape/Text'),
			"TextBox": require('qtek/2d/shape/TextBox')
		},
		"util": require('qtek/2d/util')
	},
	"Camera": require('qtek/Camera'),
	"DynamicGeometry": require('qtek/DynamicGeometry'),
	"FrameBuffer": require('qtek/FrameBuffer'),
	"Geometry": require('qtek/Geometry'),
	"Joint": require('qtek/Joint'),
	"Layer": require('qtek/Layer'),
	"Light": require('qtek/Light'),
	"Material": require('qtek/Material'),
	"Mesh": require('qtek/Mesh'),
	"Node": require('qtek/Node'),
	"Renderer": require('qtek/Renderer'),
	"Scene": require('qtek/Scene'),
	"Shader": require('qtek/Shader'),
	"Skeleton": require('qtek/Skeleton'),
	"Stage": require('qtek/Stage'),
	"StaticGeometry": require('qtek/StaticGeometry'),
	"Texture": require('qtek/Texture'),
	"animation": {
		"Animation": require('qtek/animation/Animation'),
		"Blend1DClip": require('qtek/animation/Blend1DClip'),
		"Blend2DClip": require('qtek/animation/Blend2DClip'),
		"Clip": require('qtek/animation/Clip'),
		"SamplerClip": require('qtek/animation/SamplerClip'),
		"SkinningClip": require('qtek/animation/SkinningClip'),
		"TransformClip": require('qtek/animation/TransformClip'),
		"easing": require('qtek/animation/easing')
	},
	"async": {
		"Task": require('qtek/async/Task'),
		"TaskGroup": require('qtek/async/TaskGroup')
	},
	"camera": {
		"Orthographic": require('qtek/camera/Orthographic'),
		"Perspective": require('qtek/camera/Perspective')
	},
	"compositor": {
		"Compositor": require('qtek/compositor/Compositor'),
		"Graph": require('qtek/compositor/Graph'),
		"Group": require('qtek/compositor/Group'),
		"Node": require('qtek/compositor/Node'),
		"Pass": require('qtek/compositor/Pass'),
		"SceneNode": require('qtek/compositor/SceneNode'),
		"TextureNode": require('qtek/compositor/TextureNode'),
		"texturePool": require('qtek/compositor/texturePool')
	},
	"core": {
		"Base": require('qtek/core/Base'),
		"Cache": require('qtek/core/Cache'),
		"Event": require('qtek/core/Event'),
		"glenum": require('qtek/core/glenum'),
		"glinfo": require('qtek/core/glinfo'),
		"mixin": {
			"derive": require('qtek/core/mixin/derive'),
			"notifier": require('qtek/core/mixin/notifier')
		},
		"request": require('qtek/core/request'),
		"util": require('qtek/core/util')
	},
	"geometry": {
		"Capsule": require('qtek/geometry/Capsule'),
		"Cone": require('qtek/geometry/Cone'),
		"Cube": require('qtek/geometry/Cube'),
		"Cylinder": require('qtek/geometry/Cylinder'),
		"Plane": require('qtek/geometry/Plane'),
		"Sphere": require('qtek/geometry/Sphere')
	},
	"light": {
		"Ambient": require('qtek/light/Ambient'),
		"Directional": require('qtek/light/Directional'),
		"Point": require('qtek/light/Point'),
		"Spot": require('qtek/light/Spot')
	},
	"loader": {
		"FX": require('qtek/loader/FX'),
		"GLTF": require('qtek/loader/GLTF'),
		"SVG": require('qtek/loader/SVG'),
		"three": {
			"Model": require('qtek/loader/three/Model')
		}
	},
	"math": {
		"BoundingBox": require('qtek/math/BoundingBox'),
		"Frustum": require('qtek/math/Frustum'),
		"Matrix2": require('qtek/math/Matrix2'),
		"Matrix2d": require('qtek/math/Matrix2d'),
		"Matrix3": require('qtek/math/Matrix3'),
		"Matrix4": require('qtek/math/Matrix4'),
		"Plane": require('qtek/math/Plane'),
		"Quaternion": require('qtek/math/Quaternion'),
		"Ray": require('qtek/math/Ray'),
		"Value": require('qtek/math/Value'),
		"Vector2": require('qtek/math/Vector2'),
		"Vector3": require('qtek/math/Vector3'),
		"Vector4": require('qtek/math/Vector4')
	},
	"particleSystem": {
		"Emitter": require('qtek/particleSystem/Emitter'),
		"ForceField": require('qtek/particleSystem/ForceField'),
		"GravityField": require('qtek/particleSystem/GravityField'),
		"Particle": require('qtek/particleSystem/Particle'),
		"ParticleSystem": require('qtek/particleSystem/ParticleSystem')
	},
	"picking": {
		"Pixel": require('qtek/picking/Pixel')
	},
	"plugin": {
		"FirstPersonControl": require('qtek/plugin/FirstPersonControl'),
		"InfinitePlane": require('qtek/plugin/InfinitePlane'),
		"OrbitControl": require('qtek/plugin/OrbitControl'),
		"Skybox": require('qtek/plugin/Skybox'),
		"Skydome": require('qtek/plugin/Skydome')
	},
	"prePass": {
		"EnvironmentMap": require('qtek/prePass/EnvironmentMap'),
		"Reflection": require('qtek/prePass/Reflection'),
		"ShadowMap": require('qtek/prePass/ShadowMap')
	},
	"shader": {
		"library": require('qtek/shader/library')
	},
	"texture": {
		"Texture2D": require('qtek/texture/Texture2D'),
		"TextureCube": require('qtek/texture/TextureCube')
	},
	"util": {
		"dds": require('qtek/util/dds'),
		"delaunay": require('qtek/util/delaunay'),
		"hdr": require('qtek/util/hdr'),
		"mesh": require('qtek/util/mesh'),
		"texture": require('qtek/util/texture')
	}
};

    var glMatrix = require('glmatrix');
    exportsObject.glMatrix = glMatrix;
    
    return exportsObject;
});
define('qtek', ['qtek/qtek'], function (main) { return main; });

var qtek = require("qtek");

for(var name in qtek){
	_exports[name] = qtek[name];
}

})