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

    var Pd = this.Pd = {

        // Default sample rate to use for the patches. Beware, if the browser doesn't
        // support this sample rate, the actual sample rate of a patch might be different. 
        sampleRate: 44100,

        // Default block size to use for patches.
        blockSize: 128,

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

    // every new patch registers itself using this function
    Pd.register = function(patch) {
        if (this._patches.indexOf(patch) === -1) {
            this._patches.push(patch);
            patch.id = this._generateId();
        }
    };
    Pd._patches = [];
    Pd._idCounter = 0;

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
            console.log(this, this._idCounter);
            return this._idCounter;
        },

        // Counter used internally to assign a unique id to objects
        // this counter should never be decremented to ensure the id unicity
        _idCounter: -1
    };
    Pd.extend(Pd, Pd.UniqueIdsBase);


    // Simple mixin to add event management to objects.
    // To initialize the mixin, `initEvents` must be run at object initialization.
    // TODO: extract code common with scheduling in patch.js
    Pd.EventsBase = {

        // Must be run to initialize event management on a new object.
        initEvents: function() {
            this._cbs = {};
            this._cbsOne = {};
        },

        // Binds a `callback` to an `event`. Callback will be called in `context`.
        on: function(event, callback, context) {
            return this._genericOn(this._cbs, event, {callback: callback, context: context});
        },

        // Binds a `callback` to an `event`. Callback will be called in `context`.
        // Once the callback has been run one time, it is removed from the callback list.
        one: function(event, callback, context) {
            return this._genericOn(this._cbsOne, event, {callback: callback, context: context});
        },

        // Helper function to bind a callback.
        _genericOn: function(cbsRoot, event, cbObj) {
            if (!cbObj.callback || !event) return;
            var eventCbs = cbsRoot[event] || (cbsRoot[event] = []);
            eventCbs.push(cbObj);
            return cbObj.id = this._generateId();
        },

        // Unbinds using the pair (`event`, `callback`), or simply `id`. 
        off: function(arg1, arg2) {
            this._genericOff(this._cbs, arg1, arg2);
            this._genericOff(this._cbsOne, arg1, arg2);
        },

        // Helper function to unbind a callback.
        // If `arg2` is not provided, we assume `arg1` is `id`,
        // otherwise `arg1` is event, `arg2` callback.
        // TODO: check args better
        _genericOff: function(cbsRoot, arg1, arg2) {
            if (arg2 === undefined) {
                var id = arg1,
                    event, eventCbs, cbObj, i;

                for (event in cbsRoot) {
                    eventCbs = cbsRoot[event];
                    i = 0;
                    while (cbObj = eventCbs[i]) {
                        if (cbObj.id === id) {
                            eventCbs.splice(i, 1);
                            return;
                        }
                        i++;
                    }
                }
            } else {
                var event = arg1, callback = arg2;
                if (!callback || event === undefined || !cbsRoot[event]) return;
                var cbObj, i = 0, eventCbs = cbsRoot[event];
                while (cbObj = eventCbs[i]) {
                    if (cbObj.callback === callback) eventCbs.splice(i, 1);
                    else i++;
                }
            }
        },

        // Triggers `event` on the calling object, thus calling the bound callbacks.
        trigger: function(event) {
            var allCbs = (this._cbs[event] || []).concat(this._cbsOne[event] || []),
                args = Array.prototype.slice.call(arguments, 1),
                cbObj, i;

            if (allCbs.length === 0) return;
            for (i = 0; cbObj = allCbs[i]; i++) {
                cbObj.callback.apply(cbObj.context, args);
            }
            delete this._cbsOne[event];
        }

    };


    Pd.notImplemented = function() { throw new Error('Not implemented !'); };


    var dollarVarRe = /^\$(\d+)$/;

    // Returns a function `filter(msg)`, that takes a message array as input, and returns 
    // the filtered message. For example :
    //
    //     filter = Pd.makeMsgFilter([56, '$1', 'bla', '$2']);
    //     filter([89, 'bli']); // [56, 89, 'bla', 'bli']
    // TODO: $0
    Pd.makeMsgFilter = function(filterMsg) {
        var dollarVars = [], i, length, matched;

        for (i = 0, length = filterMsg.length;  i < length; i++) {
            matched = dollarVarRe.exec(filterMsg[i]);
            if (matched) dollarVars.push([i, parseInt(matched[1], 10)]);
        }
        return function(msg) {
            filtered = filterMsg.slice(0);
            var inInd, outInd;
            for (i = 0, length = dollarVars.length;  i < length; i++) {
                outInd = dollarVars[i][0];
                inInd = dollarVars[i][1] - 1;
                if (inInd >= msg.length) throw new Error('$' + inInd + ': argument number out of range');
                filtered[outInd] = msg[inInd];
            }
            return filtered;
        }; 
    };

    var isDollarVar = Pd.isDollarVar = function(val) {
        return Boolean(dollarVarRe.exec(val));
    };

    // Fills array with zeros
    Pd.fillWithZeros = function(array, start) {
        var i, length, start = start !== undefined ? start : 0;
        for (i = start, length = array.length; i < length; i++) {
            array[i] = 0;
        }
    };

    // Returns a brand, new, clean, buffer
    Pd.newBuffer = function(channels) {
        if (channels === undefined) channels = 1;
        return new Pd.arrayType(Pd.blockSize * channels);
    };

}).call(this);
