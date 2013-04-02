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

    var BasePortlet = function(obj, id) {
        this.obj = obj;
        this.id = id;
        this.init();
    };
    Pd.extend(BasePortlet.prototype, {

        init: function() {},

        connect: function(other) { Pd.notImplemented(); },

        disconnect: function(other) { Pd.notImplemented(); },

        // Generic function for connecting the calling portlet 
        // with `otherPortlet`.
        _genericConnect: function(allConn, otherPortlet) {
            if (allConn.indexOf(otherPortlet) !== -1) return;
            allConn.push(otherPortlet);
            otherPortlet.connect(this);
        },

        // Generic function for disconnecting the calling portlet 
        // from  `otherPortlet`.
        _genericDisconnect: function(allConn, otherPortlet) {
            var connInd = allConn.indexOf(otherPortlet);
            if (connInd === -1) return;
            allConn.splice(connInd, 1);
            otherPortlet.disconnect(this);
        }

    });
    BasePortlet.extend = Pd.chainExtend;

    var BaseInlet = BasePortlet.extend({

        init: function() {
            this.sources = [];
        },

        // Connects the inlet to the outlet `source`. 
        // If the connection already exists, nothing happens.
        connect: function(source) {
            this._genericConnect(this.sources, source);
            this.obj.emit('inletConnect');
        },

        // Disconnects the inlet from the outlet `source`.
        // If the connection didn't exist, nothing happens.
        disconnect: function(source) {
            this._genericDisconnect(this.sources, source);
            this.obj.emit('inletDisconnect');
        },

        // message received callback
        message: function() {
          this.obj.message.apply(this.obj, [this.id].concat(Array.prototype.slice.call(arguments)));
        },

        // Returns a buffer to read dsp data from.
        getBuffer: function() { Pd.notImplemented(); },

        // Returns true if the inlet has dsp sources, false otherwise
        hasDspSources: function() { Pd.notImplemented(); }

    });

    var BaseOutlet = BasePortlet.extend({

        init: function() {
            this.sinks = [];
        },

        // Connects the outlet to the inlet `sink`. 
        // If the connection already exists, nothing happens.
        connect: function(sink) {
            this._genericConnect(this.sinks, sink);
        },

        // Disconnects the outlet from the inlet `sink`.
        // If the connection didn't exist, nothing happens.
        disconnect: function(sink) {
            this._genericDisconnect(this.sinks, sink);
        },

        // Returns a buffer to write dsp data to.
        getBuffer: function() { Pd.notImplemented(); },

        // Sends a message to all sinks
        message: function() { Pd.notImplemented(); }

    });


    // message inlet. Simply receives messages and dispatches them to
    // the inlet's object.
    Pd['inlet'] = BaseInlet.extend({

        getBuffer: function() {
            throw (new Error ('No dsp buffer on a message inlet'));
        },

        hasDspSources: function() {
            throw (new Error ('A message inlet cannot have dsp sources'));
        }

    });

    // dsp inlet. Pulls dsp data from all sources. Also accepts messages.
    Pd['inlet~'] = BaseInlet.extend({

        init: function() {
            BaseInlet.prototype.init.apply(this, arguments);
            this.dspSources = [];
            this._buffer = Pd.newBuffer();
            this._zerosBuffer = Pd.newBuffer();
            Pd.fillWithZeros(this._zerosBuffer);
        },

        getBuffer: function() {
            var dspSources = this.dspSources;

            // if more than one dsp source, we have to sum the signals.
            if (dspSources.length > 1) {
                var buffer = this._buffer, sourceBuff, i, j, len1, len2;
                Pd.fillWithZeros(buffer);

                for (i = 0, len1 = dspSources.length; i < len1; i++) {
                    sourceBuff = dspSources[i].getBuffer();
                    for (j = 0, len2 = buffer.length; j < len2; j++) {
                        buffer[j] += sourceBuff[j];
                    }
                }
                return buffer;

            // if only one dsp source, we can pass the signal as is.
            } else if (dspSources.length === 1) {
                return dspSources[0].getBuffer();

            // if no dsp source, just pass some zeros
            } else {
                return this._zerosBuffer;
            }
        },

        connect: function(source) {
            if (source instanceof Pd['outlet~']) this.dspSources.push(source);
            BaseInlet.prototype.connect.apply(this, arguments);
        },

        disconnect: function(source) {
            var ind = this.dspSources.indexOf(source);
            if (ind !== -1) this.dspSources.splice(ind, 1);
            BaseInlet.prototype.disconnect.apply(this, arguments);
        },

        hasDspSources: function() {
            return this.dspSources.length > 0;
        }

    });

    // message outlet. Dispatches messages to all the sinks
    Pd['outlet'] = BaseOutlet.extend({

        getBuffer: function() {
            throw (new Error ('No dsp buffer on a message outlet'));
        },

        message: function() {
            var sinks = this.sinks,
                sink, i, length;

            for (i = 0, length = sinks.length; i < length; i++) {
                sink = sinks[i];
                sink.message.apply(sink, arguments);
            }
        }

    });

    // dsp outlet. Only contains a buffer, written to by the outlet's object.
    Pd['outlet~'] = BaseOutlet.extend({

        init: function() {
            BaseOutlet.prototype.init.apply(this, arguments);
            this._buffer = Pd.newBuffer();
        },

        getBuffer: function() {
            return this._buffer;
        },

        message: function() {
            throw (new Error ('message received on dsp outlet, pas bon'));
        }

    });

})(this.Pd);
