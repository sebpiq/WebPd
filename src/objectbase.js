(function(Pd){

    /******************** Base Object *****************/

    // TODO: since many objects need sampleRate, wouldn't it make sense to make it an attribute (simpler testing better decoupling)?
    Pd.Object = function (pd, args) {
        args = args || [];
        // the patch this object belong to
        this._setPatch((pd || null));
        // id of the object in this patch
        this._setId(null);
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
	    this.init.apply(this, args);
        // if object was created in a patch, we add it to the graph
	    if (pd) {
            // TODO: ugly check shouldn't be there ... most likely in the table subclass
            if (this instanceof Pd.objects['table']) pd.addTable(this);
            else pd.addObject(this);
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

        // This method is called when the object is created.
        // At this stage, the object can belong to a patch or not.
        init: function() {},

        // This method is called by the patch when it starts playing.
        load: function() {},

        // method which runs every frame for this object
		dspTick: function() {},

        // method which runs when this object receives a message at any inlet
		message: function(inletnumber, message) {},


    /******************** Common methods *********************/

	    // Converts a Pd message to a float
        // TODO: scientific notation, e.g. 2.999e-5
	    toFloat: function(data) {
		    // first check if we just got an actual float, return it if so
		    if (!isNaN(data)) return parseFloat(data);
		    // otherwise parse this thing
		    var element = data.split(' ')[0];
		    var foundfloat = parseFloat(element);
		    if (!isNaN(foundfloat)) {
			    element = foundfloat;
		    } else if (element != 'symbol') {
			    Pd.log("error: trigger: can only convert 's' to 'b' or 'a'")
			    element = '';
		    } else {
			    element = 0;
		    }
		    return element;
	    },
	
	    // Converts a Pd message to a symbol
	    toSymbol: function(data) {
		    var element = data.split(' ')[0];
		    if (!isNaN(parseFloat(element))) {
			    element = 'symbol float';
		    } else if (element != 'symbol') {
			    Pd.log("error: trigger: can only convert 's' to 'b' or 'a'")
			    element = '';
		    } else {
			    element = 'symbol ' + data.split(' ')[1];
		    }
		    return element;
	    },
	
	    // Convert a Pd message to a bang
	    toBang: function(data) {
		    return 'bang';
	    },
	
	    // Convert a Pd message to a javascript array
	    toArray: function(msg) {
		    // if it's a string, split the atom
		    if (typeof msg == 'string') {
			    var parts = msg.split(' ');
			    if (parts[0] == 'list') parts.shift();
			    return parts;
		    // if it's an int, make a single valued array
		    } else if (typeof msg == 'number') {
			    return [msg];
		    // otherwise it's proably an object/array and should stay that way
		    } else {
			    return msg;
		    }
	    },


    /******************** Accessors ************************/

    	// Returns the a unique identifier of the object in its current patch.
        // This id is assigned automatically when the object is added to the patch.
        getId: function() {
            return this._id;
        },

        // Returns the patch the object belongs to, or null.
        getPatch: function(pd) {
            return this._pd;
        },

        _setId: function(id) {
            this._id = id
        },

        _setPatch: function(pd) {
            this._pd = pd;
        },

    /******************** Basic dspTicks ************************/
        dspTickNoOp: function() {},
        toDspTickNoOp: function() { this.dspTick = this.dspTickNoOp; },
        
        dspTickZeros: function() { Pd.fillWithZeros(this.outlets[0].getBuffer()); },
        toDspTickZeros: function() { this.dspTick = this.dspTickZeros; }

    });

    // Convenience function for making it easier to extend Pd.Object
    Pd.Object.extend = Pd.chainExtend;


    /******************** Inlets/outlets *****************/

    var BasePortlet = function(obj, id) {
        this._obj = obj;
        this._id = id;
        this.init();
    };
    Pd.extend(BasePortlet.prototype, {

        init: function() {},

        connect: function(other) { Pd.notImplemented(); },

        disconnect: function(other) { Pd.notImplemented(); },

        getId: function() { return this._id; },

        getObject: function() { return this._obj; },

        // Generic function for connecting the calling portlet 
        // with `otherPortlet`.
        _genericConnect: function(allConn, otherPortlet) {
            if (allConn.indexOf(otherPortlet) != -1) return;
            allConn.push(otherPortlet);
            otherPortlet.connect(this);
        },

        // Generic function for disconnecting the calling portlet 
        // from  `otherPortlet`.
        _genericDisconnect: function(allConn, otherPortlet) {
            var connInd = allConn.indexOf(otherPortlet);
            if (connInd == -1) return;
            allConn.splice(connInd, 1);
            otherPortlet.disconnect(this);
        }

    });
    BasePortlet.extend = Pd.chainExtend;

    var BaseInlet = BasePortlet.extend({

        init: function() {
            this.sources = [];
        },

        // Connects the inlet to the outlet `source`. 
        // If the connection already exists, nothing happens.
        connect: function(source) {
            this._genericConnect(this.sources, source);
        },

        // Disconnects the inlet from the outlet `source`.
        // If the connection didn't exist, nothing happens.
        disconnect: function(source) {
            this._genericDisconnect(this.sources, source);
        },

        // message received callback
        message: function(msg) {
	        this.getObject().message(this.getId(), msg);
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

        // Connects the outlet to the inlet `sink`. 
        // If the connection already exists, nothing happens.
        connect: function(sink) {
            this._genericConnect(this.sinks, sink);
        },

        // Disconnects the outlet from the inlet `sink`.
        // If the connection didn't exist, nothing happens.
        disconnect: function(sink) {
            this._genericDisconnect(this.sinks, sink);
        },

        // Returns a buffer to write dsp data to.
        getBuffer: function() { Pd.notImplemented(); },

        // Sends a message to all sinks
        // TODO: uniformize names : 'sendMessage/message'
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
            this._dspSources = [];
            this._buffer = Pd.newBuffer();
            this._zerosBuffer = Pd.newBuffer();
            Pd.fillWithZeros(this._zerosBuffer);
        },

        getBuffer: function() {
            var dspSources = this._dspSources;

            // if more than one dsp source, we have to sum the signals.
            if (dspSources.length > 1) {
                var buffer = this._buffer;
                Pd.fillWithZeros(buffer);
                var sourceBuff;

                for (var i=0; i<dspSources.length; i++) {
                    sourceBuff = dspSources[i].getBuffer();
                    for (var j=0; j<buffer.length; j++) {
                        buffer[j] += sourceBuff[j];
                    }
                }
                return buffer;

            // if only one dsp source, we can pass the signal as is.
            } else if (dspSources.length == 1) {
                return dspSources[0].getBuffer();

            // if no dsp source, just pass some zeros
            } else {
                return this._zerosBuffer;
            }
        },

        // TODO: prevent duplicate connections
        connect: function(source) {
            BaseInlet.prototype.connect.apply(this, arguments);
            if (source instanceof Pd['outlet~']) this._dspSources.push(source);
        },

        hasDspSources: function() {
            return this._dspSources.length > 0;
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
            this._buffer = Pd.newBuffer();
        },

        getBuffer: function() {
            return this._buffer;
        },

        sendMessage: function() {
            throw (new Error ('message received on dsp outlet, pas bon'));
        }

    });

})(this.Pd);
