/***
	A very basic implementation of Pd's dsp engine for the web.
	
	Copyright Chris McCormick, 2010.
	Licensed under the terms of the AGPLv3, or a later version of that license.
	See the file COPYING for details.
	(Basically if you provide this software via the network you need to make the source code available, but read the license for details).
***/

(function(Pd){

    Pd.objects = {
	// null placeholder object for objects which don't exist
        'null': {},
        'cnv': {}
    };

    Pd.objects['loadbang'] = Pd.Object.extend({

        outletTypes: ['outlet'],

        load: function() {
            this.outlets[0].sendMessage('bang');
        }

    });

    Pd.objects['print'] = Pd.Object.extend({

		inletTypes: ['inlet'],

        init: function(printName) {
            this.printName = (printName || 'print');
        },

        message: function(inletnum, message) {
            Pd.log(this.printname + ": " + message);
        }

    });

    Pd.objects['table'] = Pd.Object.extend({

        init: function(name, size) {
            this.name = name || null;
            this.size = size;
            this.data = new Pd.arrayType(size);
        }

    });

	/************************** DSP objects ******************************/
	
	// basic oscillator
	Pd.objects['osc~'] = Pd.Object.extend({

		outletTypes: ['outlet~'],
		inletTypes: ['inlet~', 'inlet'],

		init: function(freq) {
			this.freq = freq || 0;
			this.sampCount = 0;
		},

		dspTick: function() {
            var dspInlet = this.inlets[0];
            var outBuff = this.outlets[0].getBuffer();

            // We listen to the first inlet for frequency, only
            // if there's actually a dsp source connected to it.
            if (dspInlet.hasDspSources()) {
			    var inBuff = dspInlet.getBuffer();
                var J = 2 * Math.PI / Pd.sampleRate;
			    for (var i=0; i<outBuff.length; i++) {
				    outBuff[i] = Math.cos(J * inBuff[i] * this.sampCount);
				    this.sampCount++;
			    }
            } else {
                var K = 2 * Math.PI * this.freq / Pd.sampleRate;
			    for (var i=0; i<outBuff.length; i++) {
				    outBuff[i] = Math.cos(K * this.sampCount);
				    this.sampCount++;
			    }
            }
		},

		// TODO: 2nd inlet receives phase message
		message: function(inlet, msg) {
			if (inlet === 0) this.freq = this.toFloat(msg);
		}

	});
	
	// digital to analogue converter (sound output)
	Pd.objects['dac~'] = Pd.Object.extend({

		endPoint: true,
		outletTypes: [],
		inletTypes: ['inlet~', 'inlet~'],

		dspTick: function() {
			var inBuff1 = this.inlets[0].getBuffer();
			var inBuff2 = this.inlets[1].getBuffer();
            var output = this.getPatch().output;
			// copy interleaved data from inlets to the graph's output buffer
			for (var i=0; i < Pd.blockSize; i++) {
				output[i * 2] += inBuff1[i];
				output[i * 2 + 1] += inBuff2[i];
			}
		}
	});

    // Let each object know of what type it is
    var proto;
    for (type in Pd.objects) {
        if (proto = Pd.objects[type].prototype) proto.type = type;
    }

})(this.Pd);
