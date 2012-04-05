(function(Pd){

    /******************** Base Object *****************/

    Pd.Object = function (pd, args) {
        args = args || [];
        // the patch this object belong to
        this.patch = (pd || null);
        // id of the object in this patch
        this.id = null;
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

    /******************** Basic dspTicks ************************/
        dspTickNoOp: function() {},
        toDspTickNoOp: function() { this.dspTick = this.dspTickNoOp; },
        
        dspTickZeros: function() { Pd.fillWithZeros(this.outlets[0].getBuffer()); },
        toDspTickZeros: function() { this.dspTick = this.dspTickZeros; }

    });

    Pd.Object.extend = Pd.chainExtend;

})(this.Pd);
