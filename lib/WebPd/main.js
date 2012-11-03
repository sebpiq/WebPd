/*
 * Copyright (c) 2012 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd for documentation
 *
 */

(function(){

    // EventEmitter2 offers the same API as node's EventEmitter
    this.EventEmitter = EventEmitter2;

    var Pd = this.Pd = {

        // Default sample rate to use for the patches. Beware, if the browser doesn't
        // support this sample rate, the actual sample rate of a patch might be different. 
        sampleRate: 44100,

        // Default block size to use for patches.
        blockSize: 128,

        // The number of audio channels on the output
        channelCount: 2,

        debugMode: false,

        // Array type to use. If the browser support Float arrays, this will be Float array type.
        arrayType: Array,

        // Array slice function, to unify slicing float arrays and normal arrays.
        arraySlice: function (array, start) { return array.slice(start); }
    };

    // use a Float32Array if we have it
    if (typeof Float32Array !== "undefined") {
        Pd.arrayType = Float32Array;
        Pd.arraySlice = function (array, start) { return array.subarray(start); };
    }

    // Returns true if the current browser supports WebPd, false otherwise.
    Pd.isSupported = function() {
        // Web audio API - Chrome, Safari
        var test = typeof window === 'undefined' ? null : window.webkitAudioContext || window.AudioContext;
        if (test) return true;

        // Audio data API - Firefox
        var audioDevice = new Audio();
        if (audioDevice.mozSetup) return true;

        // All the rest
        return false;
    };

    // Every new patch and object registers itself using this function.
    // Named objects are stored, so that they can be found with 
    // `Pd.getNamedObject` and `Pd.getUniquelyNamedObject`.
    // TODO: destroy object or patch, clean references
    Pd.register = function(obj) {
        if (obj.type === 'abstract') return;

        if (obj instanceof Pd.Patch) {
            if (this._patches.indexOf(obj) === -1) {
                this._patches.push(obj);
                obj.id = this._generateId();
            }

        // For normal named objects, we just find the right entry in the map,
        // and add the object to an array of objects with the same name.
        } else if (obj instanceof Pd.NamedObject) {
            var storeNamedObject = function(oldName, newName) {
                var objType = obj.type, nameMap = Pd._namedObjects[obj.type],
                    objList;
                if (!nameMap) nameMap = Pd._namedObjects[objType] = {};

                objList = nameMap[newName];
                if (!objList) objList = nameMap[newName] = [];
                if (objList.indexOf(obj) === -1) objList.push(obj);
                // Removing old mapping
                if (oldName) {
                    objList = nameMap[oldName];
                    objList.splice(objList.indexOf(obj), 1);
                }
            };
            obj.on('change:name', storeNamedObject);
            storeNamedObject(null, obj.name);

        // For uniquely named objects, we add directly the object to the corresponding
        // entry in the map (no arrays there).
        } else if (obj instanceof Pd.UniquelyNamedObject) {
            var storeNamedObject = function(oldName, newName) {
                var objType = obj.type, nameMap = Pd._uniquelyNamedObjects[obj.type],
                    objList;
                if (!nameMap) nameMap = Pd._uniquelyNamedObjects[objType] = {};

                if (nameMap.hasOwnProperty(newName) && nameMap[newName] !== obj)
                    throw new Error('there is already an object with name "' + newName + '"');
                nameMap[newName] = obj;
                // Removing old mapping
                if (oldName) nameMap[oldName] = undefined;
            };
            obj.on('change:name', storeNamedObject);
            storeNamedObject(null, obj.name);
        }
    };
    Pd._patches = [];
    Pd._namedObjects = {};
    Pd._uniquelyNamedObjects = {};

    // Returns an object list given the object `type` and `name`.
    Pd.getNamedObject = function(type, name) {
        return ((this._namedObjects[type] || {})[name] || []);
    };

    // Returns an object given the object `type` and `name`, or `null` if this object doesn't exist.
    Pd.getUniquelyNamedObject = function(type, name) {
        return ((this._uniquelyNamedObjects[type] || {})[name] || null);
    };

    // Returns true if an object is an array, false otherwise.
    Pd.isArray = Array.isArray || function(obj) {
        return toString.call(obj) === '[object Array]';
    };

    // Returns true if an object is a number, false otherwise.
    // If `val` is NaN, the function returns false.
    Pd.isNumber = function(val) {
        return typeof val === 'number' && !isNaN(val);
    };

    // Returns true if an object is a string, false otherwise.
    Pd.isString = function(val) {
        return typeof val === 'string';
    };

    // Returns true if an object is a function, false otherwise.
    // TODO: function vs [object Function] ?
    Pd.isFunction = function(obj) {
        return typeof obj === 'function';
    };

    // Simple prototype inheritance. Used like so :
    //    
    //    var ChildObject = function() {};
    //
    //    Pd.extend(ChildObject.prototype, ParentObject.prototype, {
    //
    //        anOverridenMethod: function() {
    //            ParentObject.prototype.anOverridenMethod.apply(this, arguments);
    //            // do more stuff ...
    //        },
    //
    //        aNewMethod: function() {
    //            // do stuff ...
    //        }
    //
    //    });
    Pd.extend = function(obj) {
        var sources = Array.prototype.slice.call(arguments, 1),
            i, length, source, prop;

        for (i = 0, length = sources.length; i < length; i++) {
            source = sources[i];
            for (prop in source) {
                obj[prop] = source[prop];
            }
        }
        return obj;
    };

    Pd.chainExtend = function() {
        var sources = Array.prototype.slice.call(arguments, 0),
            parent = this,
            child = function() { parent.apply(this, arguments); };

        // Fix instanceof
        child.prototype = new parent();

        // extend with new properties
        Pd.extend.apply(this, [child.prototype, parent.prototype].concat(sources));
        child.extend = this.extend;
        return child;
    };


    // Simple mixin to add functionalities for generating unique ids.
    // Each prototype inheriting from this mixin has a separate id counter.
    // Therefore ids are not unique globally but unique for each prototype.
    Pd.UniqueIdsBase = {

        // Every time it is called, this method returns a new unique id.
        _generateId: function() {
            this._idCounter++;
            return this._idCounter;
        },

        // Counter used internally to assign a unique id to objects
        // this counter should never be decremented to ensure the id unicity
        _idCounter: -1
    };
    Pd.extend(Pd, Pd.UniqueIdsBase);


    // Returns a function `transfer(msg)`, that takes a message array as input, and constructs 
    // the output message. For example :
    //
    //     transfer = Pd.makeMsgTransfer([56, '$1', 'bla', '$2-$1']);
    //     transfer([89, 'bli']); // [56, 89, 'bla', 'bli-89']
    //
    Pd.makeMsgTransfer = function(rawOutArray) {
        var transfer = [], i, length, rawOutVal, matchDollar, func;
        rawOutArray = rawOutArray.slice(0);

        // Creates an array of transfer functions `inVal -> outVal`.
        for (i = 0, length = rawOutArray.length;  i < length; i++) {
            rawOutVal = rawOutArray[i];
            matchDollar = dollarVarRe.exec(rawOutVal);

            // If the transfer is a dollar var :
            //      ['bla', 789] - ['$1'] -> ['bla']
            //      ['bla', 789] - ['$2'] -> [789]
            if (matchDollar && matchDollar[0] === rawOutVal) {
                transfer.push(
                    (function(rawOutVal) {
                        var inInd = parseInt(matchDollar[1], 10) - 1; // -1, because $1 corresponds to value 0.
                        return function(inArray) {
                            if (inInd >= inArray.length || inInd < 0 ) 
                                throw new Error('$' + (inInd + 1) + ': argument number out of range');
                            return inArray[inInd];
                        };
                    })(rawOutVal)
                );

            // If the transfer is a string containing dollar var :
            //      ['bla', 789] - ['bla$2'] -> ['bla789']
            } else if (matchDollar) {
                transfer.push(
                    (function(rawOutVal) {
                        var j, matched, dollarVars = [], inInd;
                        while (matched = dollarVarReGlob.exec(rawOutVal)) {
                            dollarVars.push([matched[0], parseInt(matched[1], 10) - 1]); // -1, because $1 corresponds to value 0.
                        }
                        return function(inArray) {
                            var outVal = rawOutVal.substr(0);
                            for (j = 0; matched = dollarVars[j]; j++) {
                                inInd = matched[1];
                                if (inInd >= inArray.length || inInd < 0 ) 
                                    throw new Error('$' + (inInd + 1) + ': argument number out of range');
                                outVal = outVal.replace(matched[0], inArray[inInd]);
                            }
                            return outVal;
                        };
                    })(rawOutVal)
                );

            // Else the input doesn't matter
            } else {
                transfer.push(
                    (function(outVal) {
                        return function() { return outVal; };
                    })(rawOutVal)
                );
            }
        }

        return function(inArray) {
            var outArray = [];
            for (i = 0; func = transfer[i]; i++) outArray[i] = func(inArray);
            return outArray;
        }; 
    };

    // Takes a list of object arguments which might contain abbreviations, and returns
    // a copy of that list, abbreviations replaced by the corresponding full word.
    // TODO: patch, $1, $2, ...
    Pd.resolveArgs = function(args, patch) {
        var i, length, arg, matchDollar, cleaned = args.slice(0),
            patchInd, patchArgs = (patch) ? [patch.id] : [];

        for (i = 0, length = args.length; i < length; i++) {
            arg = args[i];
            if (arg === 'b') cleaned[i] = 'bang';
            else if (arg === 'f') cleaned[i] = 'float';
            else if (arg === 's') cleaned[i] = 'symbol';
            else if (arg === 'a') cleaned[i] = 'anything';
            else if (arg === 'l') cleaned[i] = 'list';
            else if (matchDollar = dollarVarRe.exec(arg)) {
                // If the transfer is a dollar var :
                //      ['bla', 789] - ['$1'] -> ['bla']
                //      ['bla', 789] - ['$2'] -> [789]
                if (matchDollar[0] === arg) {
                    patchInd = parseInt(matchDollar[1], 10);
                    if (patchInd >= patchArgs.length || patchInd < 0 ) 
                        throw new Error('$' + patchInd + ': argument number out of range');
                    cleaned[i] = patchArgs[patchInd];

                // If the transfer is a string containing dollar var :
                //      ['bla', 789] - ['bla$2'] -> ['bla789']
                } else {
                    while (matchDollar = dollarVarReGlob.exec(arg)) {
                        patchInd = parseInt(matchDollar[1], 10);
                        if (patchInd >= patchArgs.length || patchInd < 0 ) 
                            throw new Error('$' + (patchInd + 1) + ': argument number out of range');
                        arg = arg.replace(matchDollar[0], patchArgs[patchInd]);
                    }
                    cleaned[i] = arg;
                }
            }
        }
        return cleaned;
    };

    // Regular expressions to deal with dollar-args
    var dollarVarRe = /\$(\d+)/,
        dollarVarReGlob = /\$(\d+)/g;

    // Fills array with zeros
    Pd.fillWithZeros = function(array, start) {
        var i, length, start = start !== undefined ? start : 0;
        for (i = start, length = array.length; i < length; i++) {
            array[i] = 0;
        }
        return array;
    };

    // Returns a brand, new, clean, buffer
    Pd.newBuffer = function(channels) {
        if (channels === undefined) channels = 1;
        return new Pd.arrayType(Pd.blockSize * channels);
    };

    Pd.notImplemented = function() { throw new Error('Not implemented !'); };

}).call(this);
