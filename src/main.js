(function(){

    // TODO: handle the fact that actual sampleRate can be different than
    // desired sample rate
    var Pd = this.Pd = {
        sampleRate: 44100,
        blockSize: 128,
        debugMode: false 
    };

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

}).call(this);
