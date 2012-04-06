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

    // Returns true if an object is an array, false otherwise 
    Pd.isArray = Array.isArray || function(obj) {
        return toString.call(obj) == '[object Array]';
    };

    // Simple prototype inheritance. Used like so ::
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

    // regular expression for delimiting messages
    var messages_re = /\\{0,1};/;
    // regular expression for delimiting comma separated messages
    var parts_re = /\\{0,1},/;

    // Tokenizes a complex message with atoms, commas, and semicolons.
    // Returns an array of arrays of strings. (array of lists of comma separated messages).
    Pd.messagetokenizer = function(message) {
	    var result = [];
	    var messages = message.split(messages_re);
	    for (var m=0; m<messages.length; m++) {
		    var submessagelist = [];
		    // TODO: replace $N with item N-1 from the incoming message
		    var submessages = messages[m].split(parts_re);
		    for (var s=0; s<submessages.length; s++) {
			    var atoms = submessages[s].split(' ');
			    var resultatoms = [];
			    for (var a=0; a<atoms.length; a++) {
				    if (atoms[a] != '') {
					    resultatoms.push(atoms[a]);
				    }
			    }
			    if (resultatoms.length)
				    submessagelist.push(resultatoms.join(' '));
		    }
		    if (submessagelist.length)
			    result.push(submessagelist);
	    }
	    return result;
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
