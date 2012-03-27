/***
	A very basic implementation of Pd's dsp engine for the web.
	
	Copyright Chris McCormick, 2010.
	Licensed under the terms of the AGPLv3, or a later version of that license.
	See the file COPYING for details.
	(Basically if you provide this software via the network you need to make the source code available, but read the license for details).
***/

/**********************************************************************************************
	This object contains a prototype for every type of Pd object implemented so far.
	
	properties:
		endpoint = set to true if this object is a dsp sink (e.g. [dac~], [outlet~], [print~]
		outletTypes = dsp/message
		dspinlets = which inlet numbers can do dsp
	
	methods:
		preinit = method which runs after object creation, but before the graph has been instantiated
		init = method which runs after the graph has been instantiated
		dsptick = method which runs every frame for this object
		message(inletnumber, message) = method which runs when this object receives a message at any inlet
 **********************************************************************************************/
(function(Pd){

    Pd.objects = {
	// null placeholder object for objects which don't exist
        'null': {},
        'cnv': {}
    };	

    Pd.objects['loadbang'] = Pd.Object.extend({

        outletTypes: ['message'],

        init: function() {
            var me = this;
            this.pd.schedule(0, function() {
                me.sendmessage(0, 'bang');
            });
        }

    });

    Pd.objects['print'] = Pd.Object.extend({

        preinit: function(printName) {
            this.printName = (printName || 'print');
        },

        message: function(inletnum, message) {
            Pd.log(this.printname + ": " + message);
        }

    });

    Pd.objects['table'] = Pd.Object.extend({

        preinit: function(name, size) {
            this.name = name || null;
            this.size = size;
            this.data = new Pd.arrayType(size);
        }

    });

	/************************** DSP objects ******************************/
	
	// basic oscillator
	Pd.objects['osc~'] = Pd.Object.extend({

		outletTypes: ['dsp'],
		dspinlets: [0],

		preinit: function(freq) {
			this.initFreq = freq;
			this.sampCount = 0;
		},

        init: function() {
            if (this.initFreq) this.inletbuffer[0][0] = this.initFreq;
        },

		dsptick: function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i<this.outletbuffer[0].length; i++) {
				this.outletbuffer[0][i] = Math.cos(2 * Math.PI * (this.sampCount));
				this.sampCount += i1[i % i1.length] / Pd.sampleRate;
			}
		},

		message: function(inlet, message) {
			if (inlet == 1) {
				// TODO: 2nd inlet receives phase message
			}
		}

	});
	
	// digital to analogue converter (sound output)
	Pd.objects['dac~'] = Pd.Object.extend({

		endpoint: true,
		outletTypes: [],
		dspinlets: [0, 1],

		dsptick: function() {
			var i1 = this.inletbuffer[0];
			var i2 = this.inletbuffer[1];
			// copy interleaved data from inlets to the graph's output buffer
			for (var i=0; i < Pd.blockSize; i++) {
				this.pd.output[i * 2] += i1[i % i1.length];
				this.pd.output[i * 2 + 1] += i2[i % i2.length];
			}
		}
	});

    // Let each object know of what type it is
    var proto;
    for (type in Pd.objects) {
        if (proto = Pd.objects[type].prototype) proto.type = type;
    }

})(this.Pd);
