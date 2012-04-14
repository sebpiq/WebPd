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

		// set to true if this object is a dsp sink (e.g. [dac~], [outlet~], [print~]
		endPoint: false,

        // 'dsp'/'message'
		outletTypes: [],

        // Beware, inlet type doesn't have the exact same meaning as
        // outlet type, cause dsp capable inlets also take messages.  
		inletTypes: [],

    /******************** Methods to implement *****************/

        // This method is called when the object is created.
        // At this stage, the object can belong to a patch or not.
        init: function() {},

        // This method is called by the patch when it starts playing.
        load: function() {},

        // method run every frame for this object
		dspTick: function() {},

        // method run when this object receives a message at any inlet
		message: function(inletnumber, message) {},

        // methods run when a new connection is made to one of the object's inlets
        onInletConnect: function() {},

        // methods run when a connection is removed from one of the object's inlets
        onInletDisconnect: function() {},

    /********************** Helper methods *********************/

        assertIsNumber: function(val, errorMsg) {
            if (!(typeof val === 'number')) throw (new Error(errorMsg));
        },

        assertIsArray: function(val, errorMsg) {
            if (!Pd.isArray(val)) throw (new Error(errorMsg));
        },

    /******************** Basic dspTicks ************************/
        dspTickNoOp: function() {},
        toDspTickNoOp: function() { this.dspTick = this.dspTickNoOp; },
        
        dspTickZeros: function() { Pd.fillWithZeros(this.outlets[0].getBuffer()); },
        toDspTickZeros: function() { this.dspTick = this.dspTickZeros; }

    });

    Pd.Object.extend = Pd.chainExtend;

})(this.Pd);
