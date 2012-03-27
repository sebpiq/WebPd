(function(){

    // TODO: handle the fact that actual sampleRate can be different than
    // desired sample rate
    var Pd = this.Pd = {
        sampleRate: 44100,
        blockSize: 128,
        debugMode: false,
        arrayType: Array,
	    arraySlice: function (array, start) { return array.slice(start) }
    };

    // use a Float32Array if we have it
    if (typeof Float32Array != "undefined") {
        Pd.arrayType = Float32Array;
	    Pd.arraySlice = function (array, start) { return array.subarray(start) };
    }

    /*
    Simple prototype inheritance. Used like so ::
        
        var ChildObject = function() {};

        Pd._extend({ChildObject.prototype, ParentObject.prototype,

            anOverridenMethod: function() {
                ParentObject.prototype.anOverridenMethod.apply(this, arguments);
                // do more stuff ...
            },

            aNewMethod: function() {
                // do stuff ...
            }

        });
    */
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

    Pd.notImplemented = function() { throw new Error('Not implemented !'); };

    /** log a message to console **/
	Pd.log = function(msg, debugconsole) {
	    if (typeof window.console != 'undefined' && typeof console.log != 'undefined') {
		    console.log(msg);
	    } else {
		    // log manually in HTML
		    var fakeconsole = document.getElementById(arguments.length == 2 ? 'debug' : 'console');
		    if (fakeconsole) fakeconsole.innerHTML += msg + '<br/>\n';
	    }
    };

    /** logs only when debug mode is set. **/
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

    /**
        Tokenizes a complex message with atoms, commas, and semicolons.
        Returns an array of arrays of strings. (array of lists of comma separated messages).
     **/
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

}).call(this);
