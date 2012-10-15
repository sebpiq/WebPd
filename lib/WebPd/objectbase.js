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

    Pd.Object = function (patch, args) {
        // Base attributes.
        // `frame` corresponds to the last frame that was run. 
        this.patch = (patch || null);
        this.id = null;
        this.frame = -1;

        // Attributes mostly used for compatibility and GUIs.
        this._args = args = args || [];
        this._guiData = {};
  
        // create inlets and outlets specified in the object's proto
        this.inlets = [];
        this.outlets = [];
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

        // Object needs to be initialized when this is called
        if (this.type !== 'abstract') {
            Pd.register(this);
            if (patch) patch.addObject(this);
        }
    };
  
    Pd.extend(Pd.Object.prototype, Pd.EventsBase, Pd.UniqueIdsBase, {

        // set to true if this object is a dsp sink (e.g. [dac~], [outlet~], [print~]
        endPoint: false,

        // 'outlet' / 'outlet~'
        outletTypes: [],

        // 'inlet' / 'inlet~'  
        inletTypes: [],

        // Instances of those are not registered with `Pd.register`.
        type: 'abstract',

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
        toDspTickZeros: function() { this.dspTick = this.dspTickZeros; },

        dspTickId: function() {
            var outBuff = this.outlets[0].getBuffer(),
                inBuff = this.inlets[0].getBuffer(),
                i, length;
            for (i = 0, length = outBuff.length; i < length; i++) outBuff[i] = inBuff[i];
        },
        toDspTickId: function() { this.dspTick = this.dspTickId; }
    });

    Pd.Object.extend = Pd.chainExtend;


    /******************** Named Objects *****************/

    var NamedObjectMixin = {
        setName: function(name) {
            var errorMsg = 'unvalid name ' + name, oldName = this.name;
            this.assertIsString(name, errorMsg);
            if (!name) throw new Error(errorMsg);
            this.name = name;
            this.trigger('change:name', oldName, name);
        }
    };

    // Base for named objects, Those are handled a bit differently by patches.
    Pd.NamedObject = Pd.Object.extend(NamedObjectMixin);

    // Base for named objects, Those are handled a bit differently by patches.
    Pd.UniquelyNamedObject = Pd.Object.extend(NamedObjectMixin);

})(this.Pd);
