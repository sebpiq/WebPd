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
	    arraySlice: function (array, start) { return array.slice(start) }
    };

    // use a Float32Array if we have it
    if (typeof Float32Array != "undefined") {
        Pd.arrayType = Float32Array;
	    Pd.arraySlice = function (array, start) { return array.subarray(start) };
    }

    // every new patch registers itself using this function
    Pd.register = function(patch) {
        if (this._patches.indexOf(patch) == -1) {
            this._patches.push(patch);
        }
    };
    Pd._patches = [];

    // Returns true if an object is an array, false otherwise.
    Pd.isArray = Array.isArray || function(obj) {
        return toString.call(obj) == '[object Array]';
    };

    // Returns true if an object is a number, false otherwise.
    // If `val` is NaN, the function returns false.
    Pd.isNumber = function(val) {
        return typeof val === 'number' && !isNaN(val);
    },

    // Returns true if an object is a string, false otherwise.
    Pd.isString = function(val) {
        return typeof val === 'string';
    },

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
        var sources = Array.prototype.slice.call(arguments, 1);
        for(var i=0; i<sources.length; i++) {
            var source = sources[i];
            for (var prop in source) {
                obj[prop] = source[prop];
            }
        }
        return obj;
    };

    Pd.chainExtend = function() {
        var sources = Array.prototype.slice.call(arguments, 0);
        var parent = this;
        // Calls parent constructor
        var child = function() {parent.apply(this, arguments);};
        // Fix instanceof
        child.prototype = new parent();
        // extend with new properties
        Pd.extend.apply(this, [child.prototype, parent.prototype].concat(sources));
        child.extend = this.extend;
        return child;
    };

    // Simple mixin to add event management to objects.
    // To initialize the mixin, `initEvents` must be run at object initialization.
    Pd.EventsBase = {

        // Must be run to initialize event management on a new object.
        initEvents: function() {
            this._cbs = {};
            this._cbsOne = {};
        },

        // Binds a `callback` to an `event`. Callback will be called in `context`.
        on: function(event, callback, context) {
            this._genericOn(this._cbs, event, callback, context);
            return this;
        },

        // Binds a `callback` to an `event`. Callback will be called in `context`.
        // Once the callback has been run one time, it is removed from the callback list.
        one: function(event, callback, context) {
            this._genericOn(this._cbsOne, event, callback, context);
            return this;
        },

        // Helper function to bind a callback.
        _genericOn: function(cbsArray, event, callback, context) {
            if (!callback || !event) return this;
            var eventCbs = cbsArray[event] || (cbsArray[event] = []);
            eventCbs.push({callback: callback, context: context});
            return this;
        },

        // Unbinds `callback` from `event`.
        off: function(event, callback) {
            if (!callback || !event) return this;
            var cbObj;
            var removeCbs = function(array) {
                var i = 0;
                while (i < array.length) {
                    cbObj = array[i];
                    if (cbObj.callback == callback) array.splice(i, 1);
                    else i++;
                }
            };
            removeCbs(this._cbs[event] || []);
            removeCbs(this._cbsOne[event] || []);
            return this;
        },

        // Triggers `event` on the calling object, thus calling the bound callbacks.
        trigger: function(event) {
            var allCbs = (this._cbs[event] || []).concat(this._cbsOne[event] || []);
            var cbObj;
            for (var i=0; i<allCbs.length; i++) {
                cbObj = allCbs[i];
                cbObj.callback.apply(cbObj.context);
            }
            delete this._cbsOne[event];
            return this;
        }

    };


    Pd.notImplemented = function() { throw new Error('Not implemented !'); };

    // log a message to console
	Pd.log = function(msg, debugconsole) {
	    if (typeof window.console != 'undefined' && typeof console.log != 'undefined') {
		    console.log(msg);
	    } else {
		    // log manually in HTML
		    var fakeconsole = document.getElementById(arguments.length == 2 ? 'debug' : 'console');
		    if (fakeconsole) fakeconsole.innerHTML += msg + '<br/>\n';
	    }
    };

    // logs only when debug mode is set.
    Pd.debug = function(msg) {
	    if (Pd.debugMode) {
		    if (typeof(msg) == 'string')
			    this.log('debug: ' + msg, 'debug');
		    else
			    this.log(msg, 'debug');
	    }
    };

    var dollarVarRegExp = /^\$(\d+)$/;

    // Returns a function `filter(msg)`, that takes a message array as input, and returns 
    // the filtered message. For example :
    //
    //     filter = Pd.makeMsgFilter([56, '$1', 'bla', '$2']);
    //     filter([89, 'bli']); // [56, 89, 'bla', 'bli']
    // TODO: $0
    Pd.makeMsgFilter = function(filterMsg) {
        var dollarVars = [];
        for (var i=0; i<filterMsg.length; i++) {
            var matched = dollarVarRegExp.exec(filterMsg[i]);
            if (matched) dollarVars.push([i, parseInt(matched[1], 10)]);
        }
        return function(msg) {
            filtered = filterMsg.slice(0);
            var inInd, outInd;
            for (var i=0; i<dollarVars.length; i++) {
                outInd = dollarVars[i][0];
                inInd = dollarVars[i][1] - 1;
                if (inInd >= msg.length) throw new Error('$' + inInd + ': argument number out of range');
                filtered[outInd] = msg[inInd];
            }
            return filtered;
        }; 
    };

    // Fills array with zeros
    Pd.fillWithZeros = function(array) {
        for (var i=0; i<array.length; i++) {
            array[i] = 0;
        }
    }

    // Returns a brand, new, clean, buffer
    Pd.newBuffer = function(channels) {
        if (channels == undefined) var channels = 1
        return new Pd.arrayType(Pd.blockSize * channels);
    }

}).call(this);
