(function(Pd){

    /******************** Base Object *****************/
    Pd.Object = function (pd, args) {
        // the patch this object belong to
        this.pd = pd || null;
        // id of the object in this patch
        this._id = null;
	    // frame counter - how many frames have we run for
	    this.frame = 0;
	
	    // create the inlets and outlets array for this object
	    // array holds 2-tuple entries of [src-object, src-outlet-number]
	    this.inlets = [];
	    // array holds 2-tuple entries of [dest-object, dest-inlet-number]
	    this.outlets = [];
	    // create inlets and outlets specified in the object's proto
        var outletTypes = this.outletTypes;
        var inletTypes = this.inletTypes;
	    for (var i=0; i<outletTypes.length; i++) {
		    this.outlets[i] = new Pd[outletTypes[i]](this, i);
	    }
	    for (var i=0; i<inletTypes.length; i++) {
		    this.inlets[i] = new Pd[inletTypes[i]](this, i);
	    }

        // pre-initializes the object, handling the creation arguments
        // TODO: if there's any reason the object needs to know his patch,
        // then this doesn't belong here
	    this.preinit.apply(this, args);
        // if object was created in a patch, we add it to the graph
	    if (this.pd) {
            // TODO: ugly check shouldn't be there ... most likely in the table subclass
            if (this instanceof Pd.objects['table']) this.pd.addTable(obj);
            else this.pd.addObject(this);
        }
    };
	
    Pd.extend(Pd.Object.prototype, {

	    /******************** Methods to implement *****************/
		// set to true if this object is a dsp sink (e.g. [dac~], [outlet~], [print~]
		endPoint: false,

        // 'dsp'/'message'
		outletTypes: [],

        // Beware, inlet type doesn't have the exact same meaning as
        // outlet type, cause dsp capable inlets also take messages.  
		inletTypes: [],

        preinit: function() {},

        init: function() {},

        // method which runs every frame for this object
		dspTick: function() {},

        // method which runs when this object receives a message at any inlet
		message: function(inletnumber, message) {},


	    /******************** Common methods *********************/
	    /** Converts a Pd message to a float **/
	    toFloat: function(data) {
		    // first check if we just got an actual float, return it if so
		    if (!isNaN(data)) return data;
		    // otherwise parse this thing
		    var element = data.split(" ")[0];
		    var foundfloat = parseFloat(element);
		    if (!isNaN(foundfloat)) {
			    element = foundfloat;
		    } else if (element != "symbol") {
			    Pd.log("error: trigger: can only convert 's' to 'b' or 'a'")
			    element = "";
		    } else {
			    element = 0;
		    }
		    return element;
	    },
	
	    /** Converts a Pd message to a symbol **/
	    toSymbol: function(data) {
		    var element = data.split(" ")[0];
		    if (!isNaN(parseFloat(element))) {
			    element = "symbol float";
		    } else if (element != "symbol") {
			    Pd.log("error: trigger: can only convert 's' to 'b' or 'a'")
			    element = "";
		    } else {
			    element = "symbol " + data.split(" ")[1];
		    }
		    return element;
	    },
	
	    /** Convert a Pd message to a bang **/
	    toBang: function(data) {
		    return "bang";
	    },
	
	    /** Convert a Pd message to a javascript array **/
	    toArray: function(msg) {
		    var type = typeof(msg);
		    // if it's a string, split the atom
		    if (type == "string") {
			    var parts = msg.split(" ");
			    if (parts[0] == "list")
				    parts.shift();
			    return parts;
		    // if it's an int, make a single valued array
		    } else if (type == "number") {
			    return [msg];
		    // otherwise it's proably an object/array and should stay that way
		    } else {
			    return msg;
		    }
	    },
	
	    /** Sends a message to a particular outlet **/
	    sendMessage: function(outletnum, msg) {
		    if (this.outlets[outletnum]) this.outlets[outletnum].message(msg);
		    else {
			    throw (new Error("object has no outlet #" + outletnum));
		    }
	    },

	    /******************** Graph methods ************************/
    	// Returns the a unique identifier of the object in its current patch.
        // This id is assigned automatically when the object is added to the patch.
        getId: function() {
            return this._id;
        }

    });

    // Convenience function for making it easier to extend Pd.Object
    Pd.Object.extend = Pd.chainExtend;


    /******************** Inlets/outlets *****************/
    var BasePortlet = function(obj, id) {
        this.obj = obj;
        this.id = id;
        this.init();
    };
    Pd.extend(BasePortlet.prototype, {

        init: function() { Pd.notImplemented(); },

        connect: function(other) { Pd.notImplemented(); }

    });
    BasePortlet.extend = Pd.chainExtend;

    var BaseInlet = BasePortlet.extend({

        init: function() {
            this.sources = [];
        },

        connect: function(source) {
            this.sources.push(source);
        },

        // message received callback
        message: function(msg) {
	        this.obj.message(this.id, msg);
        },

        // Returns a buffer to read dsp data from.
        getBuffer: function() { Pd.notImplemented(); },

        // Returns true if the inlet has dsp sources, false otherwise
        hasDspSources: function() { Pd.notImplemented(); }

    });

    var BaseOutlet = BasePortlet.extend({

        init: function() {
            this.sinks = [];
        },

        connect: function(sink) {
            this.sinks.push(sink);
        },

        // Returns a buffer to write dsp data to.
        getBuffer: function() { Pd.notImplemented(); },

        // Sends a message to all sinks
        sendMessage: function(msg) { Pd.notImplemented(); }

    });


    // message inlet. Simply receives messages and dispatches them to
    // the inlet's object.
    Pd['inlet'] = BaseInlet.extend({

        getBuffer: function() {
            throw (new Error ('No dsp buffer on a message inlet'));
        },

        hasDspSources: function() {
            throw (new Error ('A message inlet cannot have dsp sources'));
        }

    });

    // dsp inlet. Pulls dsp data from all sources. Also accepts messages.
    Pd['inlet~'] = BaseInlet.extend({

        init: function() {
            BaseInlet.prototype.init.apply(this, arguments);
            this.dspSources = [];
        },

        // TODO: sum input from multiple connections
        getBuffer: function() {
            return this.sources[0].buffer;
        },

        connect: function(source) {
            BaseInlet.prototype.connect.apply(this, arguments);
            if (source instanceof Pd['outlet~']) this.dspSources.push(source);  
        },

        hasDspSources: function() {
            return this.dspSources.length > 0;
        }

    });

    // message outlet. Dispatches messages to all the sinks
    Pd['outlet'] = BaseOutlet.extend({

        getBuffer: function() {
            throw (new Error ('No dsp buffer on a message outlet'));
        },

        sendMessage: function(msg) {
            for (var i=0; i<this.sinks.length; i++) {
                this.sinks[i].message(msg);
            }
        }

    });

    // dsp outlet. Only contains a buffer, written to by the outlet's object.
    Pd['outlet~'] = BaseOutlet.extend({

        init: function() {
            BaseOutlet.prototype.init.apply(this, arguments);
            this.buffer = new Pd.arrayType(Pd.blockSize);
        },

        getBuffer: function() {
            return this.buffer;
        },

        sendMessage: function() {
            throw (new Error ('message received on dsp outlet, pas bon'));
        }

    });

})(this.Pd);
