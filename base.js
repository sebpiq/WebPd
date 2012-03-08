(function(){

    var extend = function(obj) {
        var sources = Array.prototype.slice.call(arguments, 1);
        for(var i=0; i<sources.length; i++) {
            var source = sources[i];
            for (var prop in source) {
                obj[prop] = source[prop];
            }
        }
        return obj;
    };

    var notImplemented = function() { throw new Error('Not implemented !'); };

    var AudioDriverInterface = function(desiredSampleRate, blockSize) {
        // what sample rate we will operate at (might change depending on driver so use getSampleRate()
        this._sampleRate = desiredSampleRate;
        this._blockSize = blockSize;
    };

    extend(AudioDriverInterface.prototype, {

        /** fetch the current sample rate we are operating at **/
        getSampleRate: function() { notImplemented(); },

        /** Stop the audio from playing **/
        stop: function() { notImplemented(); },

        /** Start the audio playing with the supplied function as the audio-block generator **/
        play: function(generator) { notImplemented(); },

        /** test whether this driver is currently playing audio **/
        is_playing: function() { notImplemented(); },

        arrayType: Array,

	    arraySlice: function (array, start) { return array.slice(start) }
    });

    // use a Float32Array if we have it
    if (typeof Float32Array != "undefined") {
        extend(AudioDriverInterface.prototype, {
	        arrayType: Float32Array,
	        arraySlice: function (array, start) { return array.subarray(start) }
        });
    }


    var SinkAdapter = function(desiredSampleRate, blockSize) {
        AudioDriverInterface.prototype.constructor.apply(this, arguments);
        this._sink = null;
	    // if there is any overflow writing to the hardware buffer we store it here
	    this._overflow = null;
    };

    extend(SinkAdapter.prototype, AudioDriverInterface.prototype, {

        /** fetch the current sample rate we are operating at **/
        getSampleRate: function() { 
            return (this._sink ? this._sink.sampleRate : this._sampleRate); 
        },

        /** Stop the audio from playing **/
        stop: function() {
            this._sink.kill();
            this._sink = null;
        },

        /** Start the audio playing with the supplied function as the audio-block generator **/
        play: function(generator) {
            var me = this;

            this._sink = Sink(function(buffer, channelCount){
                // this is the current writing position in buffer
                var pos = 0;

                // TODO: if we actually match Sink's buffer size to a multiple of block size,
                // we shouldn't need to handle overflows
 
		        // if we had some overflow last time, first append this to the buffer
                var overflow = me._overflow
		        if (overflow !== null) {
                    for (pos; pos<Math.min(overflow.length, buffer.length); pos++) {
                        buffer[pos] = overflow[pos];
                    }
                    // if buffer is full, no need to go further
                    if (pos === buffer.length) {
                        if (pos !== overflow.length) me._overflow = null;
                        else me._overflow = me.arraySlice(overflow, pos);
                        return;
                    }
                    // else, we can discard the previous overflow
                    me._overflow = null;
		        }

		        // how many blocks we should generate and add to the buffer
		        var howmany = Math.ceil((buffer.length - pos) / (2*me._blockSize));
		        for (var i=0; i<howmany; i++) {
                    var bPos = 0;
			        var block = generator();
                    for (pos, bPos; pos<buffer.length && bPos<block.length; pos++, bPos++) {
                        buffer[pos] = block[bPos];
                    }
		        }

                // save the overflow for next time
                if (bPos !== block.length) {
                    me._overflow = me.arraySlice(block, bPos);
                }
            }, 2, 8192, this._sampleRate);

            // activating sink.js debugging 
            this._sink.on('error', function(e){
	            console.error(e);
            });
        },

        /** test whether this driver is currently playing audio **/
        is_playing: function() {
            return this._sink !== null;
        },

    });

    this.AudioDriver = SinkAdapter;

}).call(this);

