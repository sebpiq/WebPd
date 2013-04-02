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

    var AudioDriverInterface = function(desiredSampleRate, blockSize) {
        // what sample rate we will operate at (might change depending on driver so use getSampleRate()
        this._sampleRate = desiredSampleRate;
        this._blockSize = blockSize;
        this._channelCount = 2;
    };

    Pd.extend(AudioDriverInterface.prototype, {

        // fetch the current sample rate we are operating at
        getSampleRate: function() { Pd.notImplemented(); },

        // Stop the audio from playing
        stop: function() { Pd.notImplemented(); },

        // Start the audio playing with the supplied function as the audio-block generator
        play: function(generator) { Pd.notImplemented(); },

        // test whether this driver is currently playing audio
        isPlaying: function() { Pd.notImplemented(); }

    });

    var SinkAdapter = function(desiredSampleRate, blockSize) {
        AudioDriverInterface.prototype.constructor.apply(this, arguments);
        this._sink = null;
        this._batchSize = 4;
    };

    Pd.extend(SinkAdapter.prototype, AudioDriverInterface.prototype, {

        // fetch the current sample rate we are operating at
        getSampleRate: function() { 
            if (this._sink) return this._sink.sampleRate;
            else {
                var sink = Sink(null, this._channelCount, null, this._sampleRate);
                return sink.sampleRate;
            } 
        },

        // Stop the audio from playing
        stop: function() {
            this._sink.kill();
            this._sink = null;
        },

        // Start the audio playing with the supplied function as the audio-block generator
        play: function(generator) {
            var me = this,
                // We set the buffer size to an exact number of blocks,
                // that way we don't have to think about overflows
                bufferSize = this._blockSize * this._batchSize * this._channelCount,
                blockBufferSize = this._channelCount * me._blockSize,
                // Sink(callback, channelCount, preBufferSize, sampleRate)
                sink = Sink(null, this._channelCount, null, this._sampleRate),
                proxy = sink.createProxy(bufferSize);
            this._sink = sink;

            // this callback takes generated blocks, and copy them directly
            // to the buffer supplied by sink.js.
            proxy.on('audioprocess', function(buffer){
                var pos = 0, i, length, bPos, block;

                // how many blocks we should generate and add to the buffer
                for (i = 0, length = me._batchSize; i < length; i++) {
                    bPos = 0;
                    block = generator();
                    for (pos, bPos; bPos < blockBufferSize; pos++, bPos++) {
                        buffer[pos] = block[bPos];
                    }
                }
            });

            // activating sink.js debugging 
            sink.on('error', function(e){
                console.error(e);
            });
        },

        // test whether this driver is currently playing audio
        isPlaying: function() {
            return this._sink !== null;
        }

    });

    Pd.AudioDriver = SinkAdapter;

})(this.Pd);

