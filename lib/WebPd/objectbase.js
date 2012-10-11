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

(function(Pd){

    /******************** Base Object *****************/

    Pd.Object = function (pd, args) {
        // Attributes mostly used for compatibility and GUIs.
        this._args = args = args || [];
        this._guiData = {};

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
        var outletTypes = this.outletTypes,
            inletTypes = this.inletTypes,
            i, length;

        for (i = 0, length = outletTypes.length; i < length; i++) {
            this.outlets[i] = new Pd[outletTypes[i]](this, i);
        }
        for (i = 0, length = inletTypes.length; i < length; i++) {
            this.inlets[i] = new Pd[inletTypes[i]](this, i);
        }

        // initializes event management system
        this.initEvents();

        // pre-initializes the object, handling the creation arguments
        this.init.apply(this, args);
        // if object was created in a patch, we add it to the graph
        if (pd) {
            // TODO: ugly check shouldn't be there ... most likely in the table subclass
            if (this instanceof Pd.objects['table']) pd.addTable(this);
            else pd.addObject(this);
        }
    };
  
    Pd.extend(Pd.Object.prototype, Pd.EventsBase, {

        // set to true if this object is a dsp sink (e.g. [dac~], [outlet~], [print~]
        endPoint: false,

        // 'dsp'/'message'
        outletTypes: [],

        // Beware, inlet type doesn't have the exact same meaning as
        // outlet type, cause dsp capable inlets also take messages.  
        inletTypes: [],

        // Returns inlet `id` if it exists.
        i: function(id) {
            if (id < this.inlets.length) return this.inlets[id];
            else throw (new Error('invalid inlet ' + id));
        },

        // Returns outlet `id` if it exists.
        o: function(id) {
            if (id < this.outlets.length) return this.outlets[id];
            else throw (new Error('invalid outlet ' + id));
        },

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

    /********************** Helper methods *********************/

        assertIsNumber: function(val, errorMsg) {
            if (!Pd.isNumber(val)) throw (new Error(errorMsg));
        },

        assertIsArray: function(val, errorMsg) {
            if (!Pd.isArray(val)) throw (new Error(errorMsg));
        },

        assertIsString: function(val, errorMsg) {
            if (!Pd.isString(val)) throw (new Error(errorMsg));
        },

    /******************** Basic dspTicks ************************/
        dspTickNoOp: function() {},
        toDspTickNoOp: function() { this.dspTick = this.dspTickNoOp; },
        
        dspTickZeros: function() { Pd.fillWithZeros(this.outlets[0].getBuffer()); },
        toDspTickZeros: function() { this.dspTick = this.dspTickZeros; }

    });

    Pd.Object.extend = Pd.chainExtend;

})(this.Pd);
