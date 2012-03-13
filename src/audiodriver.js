(function(Pd){

    var AudioDriverInterface = function(desiredSampleRate, blockSize) {
        // what sample rate we will operate at (might change depending on driver so use getSampleRate()
        this._sampleRate = desiredSampleRate;
        this._blockSize = blockSize;
        this._channelCount = 2;
    };

    Pd.extend(AudioDriverInterface.prototype, {

        /** fetch the current sample rate we are operating at **/
        getSampleRate: function() { Pd.notImplemented(); },

        /** Stop the audio from playing **/
        stop: function() { Pd.notImplemented(); },

        /** Start the audio playing with the supplied function as the audio-block generator **/
        play: function(generator) { Pd.notImplemented(); },

        /** test whether this driver is currently playing audio **/
        is_playing: function() { Pd.notImplemented(); },

        arrayType: Array,

	    arraySlice: function (array, start) { return array.slice(start) }
    });

    // use a Float32Array if we have it
    if (typeof Float32Array != "undefined") {
        Pd.extend(AudioDriverInterface.prototype, {
	        arrayType: Float32Array,
	        arraySlice: function (array, start) { return array.subarray(start) }
        });
    }


    var SinkAdapter = function(desiredSampleRate, blockSize) {
        AudioDriverInterface.prototype.constructor.apply(this, arguments);
        this._sink = null;
        this._batchSize = 4;
    };

    Pd.extend(SinkAdapter.prototype, AudioDriverInterface.prototype, {

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

            // We set the buffer size to an exact number of blocks,
            // that way we don't have to think about overflows
            var bufferSize = this._blockSize * this._batchSize * this._channelCount;
            var blockBufferSize = this._channelCount * me._blockSize;
            // Sink(callback, channelCount, preBufferSize, sampleRate)
            this._sink = Sink(null, this._channelCount, null, this._sampleRate);
            var proxy = this._sink.createProxy(bufferSize);

            // this callback takes generated blocks, and copy them directly
            // to the buffer supplied by sink.js.
            proxy.on('audioprocess', function(buffer){
                var pos = 0;

		        // how many blocks we should generate and add to the buffer
		        for (var i=0; i<me._batchSize; i++) {
                    var bPos = 0;
			        var block = generator();
                    for (pos, bPos; bPos<blockBufferSize; pos++, bPos++) {
                        buffer[pos] = block[bPos];
                    }
		        }
            });

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

    Pd.AudioDriver = SinkAdapter;

})(this.Pd);

