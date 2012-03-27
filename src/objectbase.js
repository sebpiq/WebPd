(function(Pd){

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
	    // holds a pointer to an existing outlet buffer, or a small buffer with a constant value
	    // (array of buffers)
	    this.inletbuffer = [];
	    // holds actual output buffers
	    // (array of two buffers)
	    this.outletbuffer = [];
	
	    if (this.outletTypes) {
		    // create the outlet buffers for this object
		    for (var o=0; o<this.outletTypes.length; o++) {
			    if (this.outletTypes[o] == "dsp") {
				    this.outletbuffer[o] = new Pd.arrayType(Pd.blockSize);
			    }
		    }
	    }

        // pre-initializes the object, handling the creation arguments
        // TODO: if there's any reason the object needs to know his patch,
        // then this doesn't belong here
	    this.preinit.apply(this, args);
        // if object was created in a patch, we add it to the graph
	    if (this.pd) {
            if (this.type === 'table') this.pd.addTable(obj);
            else this.pd.addObject(this);
        }
    };
	
    Pd.extend(Pd.Object.prototype, {

	    /** Converts a Pd message to a float **/
	    tofloat: function(data) {
		    // first check if we just got an actual float, return it if so
		    if (!isNaN(data)) {
			    return data;
		    }
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
	    tosymbol: function(data) {
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
	    tobang: function(data) {
		    return "bang";
	    },
	
	    /** Convert a Pd message to a javascript array **/
	    toarray: function(msg) {
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
	    sendmessage: function(outletnum, msg) {
		    if (this.outlets[outletnum]) {
			    // propagate this message to my outlet
			    this.outlets[outletnum][0].message(this.outlets[outletnum][1], msg);
		    } else {
			    // pd silently drops these messages into the ether
			    Pd.debug(this.type + ": No outlet #" + outletnum);
		    }
	    },
	
	    /** Run after the graph is created to set up DSP inlets specially (accept floats if not dsp) **/
	    setupdsp: function() {
		    if (this.dspinlets) {
			    for (var i=0; i<this.dspinlets.length; i++) {
				    // which inlet is supposed to be dsp friendly?
				    var idx = this.dspinlets[i];
				    // TODO: check for multiple incoming dsp data buffers and sum them
				    // see if the outlet that is connected to our inlet is of type 'dsp'
				    if (this.inlets[idx] && this.inlets[idx][0].outletTypes[this.inlets[idx][1]] == "dsp") {
					    // use that outlet's buffer as our inlet buffer
					    this.inletbuffer[idx] = this.inlets[idx][0].outletbuffer[this.inlets[idx][1]];
					    Pd.debug(this.getId() + " (" + this.type + ") at inlet " + idx + " dsp inlet real buffer");
				    } else {
					    // otherwise it's a message inlet and if we get a float we want to use that instead
					    // create a new single-valued buffer, initialised to 0
					    this.inletbuffer[idx] = [0];
					
					    // override the existing message input to check for incoming floats
					    // and use them to set the buffer value
					    // (remember the old message func so we can stack it on the end of the new one
					    // this is slightly complicated but oh well)
					    if (this.message) {
						    this["message_" + idx] = this.message;
					    }
					
					    // returns a new message function to replace the old one
					    function makeMessageFunc(myidx) {
						    return function (inletnum, msg) {
							    if (inletnum == myidx && !isNaN(parseFloat(msg))) {
								    // set our constant-buffer value to the incoming float value
								    this.inletbuffer[myidx][0] = parseFloat(msg);
							    }
							    // chain our old message function onto the end of this new one
							    if (this["message_" + myidx])
								    this["message_" + myidx](inletnum, msg);
						    }
					    }
					
					    // replace our message function 
					    this.message = makeMessageFunc(idx);
					    Pd.debug(this.getId() + " (" + this.type + ") dsp inlet " + idx + " single val buffer");
				    }
			    }
		    }
	    },

	    /******************** Graph methods ************************/
        getId: function() {
            return this._id;
        },

	    /******************** Object life-cycle ************************/
        preinit: function() {},
        init: function() {}

    });

    // Convenience function for making it easier to extend Pd.Object
    Pd.Object.extend = function() {
        var sources = Array.prototype.slice.call(arguments, 0);
        var parent = this;
        var child = function() {parent.apply(this, arguments);}
        Pd.extend.apply(this, [child.prototype, parent.prototype].concat(sources));
        child.extend = this.extend;
        return child;
    };


})(this.Pd);
