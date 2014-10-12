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

    var WAAAdapter = function(desiredSampleRate, blockSize) {
        AudioDriverInterface.prototype.constructor.apply(this, arguments);
        this._context = new AudioContext;
        this._scriptNode = this._context.createScriptProcessor(blockSize, 1, this._channelCount);
        this._buffer = [];
    };

    Pd.extend(WAAAdapter.prototype, AudioDriverInterface.prototype, {

        // fetch the current sample rate we are operating at
        getSampleRate: function() { 
            return this._context.sampleRate;
        },

        // Stop the audio from playing
        stop: function() {
            this._playing = false;
            this._scriptNode.disconnect();
        },

        // Start the audio playing with the supplied function as the audio-block generator
        play: function(generator) {
            var self = this
            this._playing = true;
            this._scriptNode.onaudioprocess = function(event) {
                var outputBuffer = event.outputBuffer
                    , ch, block = generator();
                for (ch = 0; ch < self._channelCount; ch++)
                    outputBuffer.getChannelData(ch).set(block[ch]);
            }
            this._scriptNode.connect(this._context.destination);
        },

        // test whether this driver is currently playing audio
        isPlaying: function() {
            return this._playing;
        }

    });

    Pd.AudioDriver = WAAAdapter;

})(this.Pd);

