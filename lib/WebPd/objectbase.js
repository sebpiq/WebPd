/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 *  This file is part of WebPd. See https://github.com/sebpiq/WebPd for documentation
 *
 *  WebPd is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  WebPd is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with WebPd.  If not, see <http://www.gnu.org/licenses/>.
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

        // initializes the object, handling the creation arguments
        if (this.resolveArgs) args = Pd.resolveArgs(args, patch);
        this.init.apply(this, args);
        if (this.type !== 'abstract') {
            Pd.register(this);
            if (patch) patch.addObject(this);
        }
    };
  
    Pd.extend(Pd.Object.prototype, EventEmitter.prototype, Pd.UniqueIdsBase, {

        // This is used to choose in which order objects must be loaded, when the patch
        // is started. For example [loadbang] must go last. Higher priorities go first.
        loadPriority: 0,

        // set to true if this object is a dsp sink (e.g. [dac~], [outlet~], [print~]
        endPoint: false,

        // if the object is an endpoint, this is used to choose in which order endpoints
        // dsp is run. Higher priorities go first.
        endPointPriority: 0,

        // 'outlet' / 'outlet~'
        outletTypes: [],

        // 'inlet' / 'inlet~'  
        inletTypes: [],

        // Type of the object. If type is 'abstract' `Pd.register` ignores the object.
        type: 'abstract',

        // List of available abbreviations for that object.
        abbreviations: undefined,

        // If this is true, `Pd.resolveArgs` is applied to the object's arguments.
        resolveArgs: true,

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

        assertIsBang: function(val, errorMsg) {
            if (val !== 'bang') throw (new Error(errorMsg));
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
            this.emit('change:name', oldName, name);
        }
    };

    // Base for named objects, Those are handled a bit differently by patches.
    Pd.NamedObject = Pd.Object.extend(NamedObjectMixin);

    // Base for named objects, Those are handled a bit differently by patches.
    Pd.UniquelyNamedObject = Pd.Object.extend(NamedObjectMixin);

})(this.Pd);
