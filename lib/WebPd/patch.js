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

(function(Pd) {

    // !!! What we call "frame" here is a block of audio frames 
    // (i.e. : 1 frame = <channelsCount * blockSize> samples).
    Pd.Patch = function () {
        Pd.register(this);
        this.sampleRate = Pd.sampleRate;
        this.blockSize = Pd.blockSize;
        this.channelCount = Pd.channelCount;

        // setting up the graph
        this._graph = {
            // an array of every object we know about
            objects: [],
            // an array of all of the end-points of the dsp graph
            // (like dac~ or print~ or send~ or outlet~)
            endPoints: []
        };

        // arrays of callbacks which are scheduled to run at some point in time
        // keys are frames
        this._scheduled = {};

        // create the audio output driver
        this.audio = new Pd.AudioDriver(this.sampleRate, this.blockSize);
        // output buffer (stereo)
        this.output = Pd.newBuffer(2);
        // Next frame
        this.frame = 0;
    };

    Pd.extend(Pd.Patch.prototype, EventEmitter.prototype, Pd.UniqueIdsBase, {
  
    /************************* Send/receive ******************************/

        // Send a message to a named receiver inside the graph
        send: function(name) {
            this.emit.apply(this, ['msg:' + name]
                .concat(Array.prototype.slice.call(arguments, 1)));
        },

        // Receive a message from a named sender inside the graph
        receive: function(name, callback) {
            this.on('msg:' + name, callback);
        },

    /******************** Time/scheduling methods ************************/
  
        // gets the absolute current logical elapsed time in milliseconds
        getAbsTime: function() {
            return this.frameToTime(this.frame);
        },

        // Returns the time corresponding with `frame` in milliseconds.
        frameToTime: function(frame) {
            return frame * this.blockSize / (this.sampleRate / 1000);
        },

        // Returns the frame corresponding with `time` (given in milliseconds).
        timeToFrame: function(time) {
            return time / (this.blockSize / (this.sampleRate / 1000));
        },

        // Takes a time in milliseconds, returns the equivalent number of samples.
        millisToSamp: function(millis) {
            return this.sampleRate * millis / 1000;
        },

        // Takes a time in milliseconds, returns the equivalent number of samples.
        sampToMillis: function(samp) {
            return samp * 1000 / this.sampleRate;
        },

        // Schedules `callback` in `time` milliseconds.
        // Returns the timeout handle which can be used to unschedule it.
        timeout: function(time, callback, context) {
            return this._genericSchedule({
                callback: callback, context: context,   
                absTime: this.getAbsTime() + time, repeat: false
            });
        },

        // Schedules `callback` to be run every `time` milliseconds.
        // Returns the interval handle which can be used to stop it.
        // TODO: possible optimization : scheduling several cbs at once.  
        interval: function(time, callback, context) {
            return this._genericSchedule({
                callback: callback, context: context,
                absTime: this.getAbsTime() + time, repeat: true, time: time
            });
        },

        // Clears the timeout or interval whose handle is `id`.
        // TODO: not very efficient
        clear: function(id) {
            var frame, frameCbs, cbObj, i;

            for (frame in this._scheduled) {
                frameCbs = this._scheduled[frame];
                i = 0;
                while (cbObj = frameCbs[i]) {
                    if (cbObj.id === id) {
                        frameCbs.splice(i, 1);
                        return;
                    }
                    i++;
                }
            }
        },

        // Helper for scheduling a callback at an absolute time.
        _genericSchedule: function(cbObj, repeated) {
            if (!cbObj.callback || !cbObj.absTime) return;
            var frame = Math.ceil(this.timeToFrame(cbObj.absTime));
                cbs = this._scheduled[frame] = this._scheduled[frame] || [];

            cbs.push(cbObj);
            if (repeated !== true) return cbObj.id = this._generateId();
        },

    /******************** DSP stuff ************************/

        // Get a single frame of audio data from Pd.
        generateFrame: function() {
            var patch = this, output = this.output,
                i, obj, endPoints = this.getEndPoints(),
                cbs = this._scheduled[this.frame] || [], cbObj;
            delete this._scheduled[this.frame];

            // reset our output buffer (gets written to by dac~ objects)
            Pd.fillWithZeros(output);

            // run the dsp function on all endpoints to pull data
            for (i = 0; obj = endPoints[i]; i++) {
                patch.tick(obj);
            }
            this.frame++;

            // Runs all the callbacks scheduled at the current frame
            // !!! We have to execute this after the frame has been incremented, 
            // otherwise rescheduling will take wrong frame as reference.
            // TODO: respect absTime order
            for (i = 0; cbObj = cbs[i]; i++) {
                if (cbObj.repeat) {
                    cbObj.absTime += cbObj.time;
                    this._genericSchedule(cbObj, true);
                }
                cbObj.callback.call(cbObj.context);
            }

            return output;
        },
  
        // Dsp tick function. Pulls dsp data from `obj` and all its parents.
        tick: function(obj) {
            if (obj.frame < this.frame) {
                var inlets = obj.inlets, sources, i, j, len1, len2;
                
                // Update the frame here to avoid infinite recursion
                obj.frame = this.frame;

                // Recursively triggers tick on all DSP objects.
                for (i = 0, len1 = inlets.length; i < len1; i++) {
                    if (inlets[i] instanceof Pd['inlet~']) {
                        sources = inlets[i].sources;
                        for (j = 0, len2 = sources.length; j < len2; j++) this.tick(sources[j].obj);
                    }
                }

                // once all parents have run their dsp process,
                // we can proceed with the current object.
                if (obj.dspTick) obj.dspTick();
            }
        },
  
        // Starts this graph running
        play: function() {
            var patch = this;

            if (!this.isPlaying()) {
                console.debug('Starting audio.');
                // fetch the actual samplerate from the audio driver
                this.sampleRate = this.audio.getSampleRate();
                // TODO: should load called with post-order traversal,
                //        to ensure all children gets loaded before their parents ?
                this.getAllObjects()
                    .sort(function(obj1, obj2) { return obj2.loadPriority - obj1.loadPriority; })
                    .map(function(obj) { obj.load(); }, this);
                this.audio.play(function() { return patch.generateFrame(); });
                // reset frame counts
                this.frame = 0;
                this.getAllObjects().map(function(obj) { obj.frame = -1; });
            } else {
                console.debug('Already started.');
            }
        },
  
        // Stops this graph from running
        stop: function() {
            if (this.isPlaying()) {
                console.debug('Stopping audio.');
                this.audio.stop();
            } else {
                console.debug('Already stopped.');
            }
        },

        // Returns true if the patch is playing, false otherwise.
        isPlaying: function() {
            return this.audio.isPlaying();
        },

    /******************** Graph methods ************************/

        // Adds an object to the patch.
        // Also causes the patch to automatically assign an id to that object.
        // This id can be used to uniquely identify the object in the patch.
        // Also, if the patch is playing, the `load` method of the object will be called.
        addObject: function(obj) {
            if (this._graph.objects.indexOf(obj) === -1) {
                var id = this._generateId();
                obj.id = id;
                obj.patch = this;
                this._graph.objects[id] = obj;
                if (obj.endPoint) this._graph.endPoints.push(obj);
                if (this.isPlaying()) obj.load();
                console.debug('Added ' + obj.type + ' to the graph at position ' + id);
            }
        },

        // Remove the object from the patch.
        // If the object is not in the patch, nothing happens.
        removeObject: function(obj) {
            var conns = this.getAllConnections(obj),
                ind = this._graph.endPoints.indexOf(obj), 
                i, length;

            for (i = 0, length = conns.length; i < length; i++) {
                this.disconnect(conns[i][0], conns[i][1]);
            }
            delete this._graph.objects[obj.id];
            if (ind !== -1) this._graph.endPoints.splice(ind, 1);
        },

        // Returns an object given its id in the patch, or `null` if an object
        // with such an id doesn't exist.
        getObject: function(id) {
            return (this._graph.objects[id] || null);
        },

        // Returns an array of all end points of the patch
        getEndPoints: function() {
            return this._graph.endPoints.sort(function(obj1, obj2) {
                return obj2.endPointPriority - obj1.endPointPriority;
            });
        },

        // Connects an outlet to an inlet. If those are already connected, nothing happens
        connect: function(outlet, inlet) {
            this._checkContainsObj(outlet.obj);
            this._checkContainsObj(inlet.obj);
            outlet.connect(inlet);
        },

        // Disconnects two portlets. See `connect`.
        disconnect: function(outlet, inlet) {
            this._checkContainsObj(outlet.obj);
            this._checkContainsObj(inlet.obj);
            outlet.disconnect(inlet);
        },

        // Returns an array of all objects in the patch
        getAllObjects: function() {
            var objects = this._graph.objects,
                filtered = [], obj, i, length;

            for (i = 0, length = objects.length; i < length; i++) {
                if (objects[i]) filtered.push(objects[i]);
            }
            return filtered;
        },

        // Returns all connections in the graph as an array
        // of pairs `(outlet, inlet)`. If `obj` is provided, 
        // this returns only the connections from/to `obj`.
        getAllConnections: function(obj) {
            var connections = [], source, i, j, k;

            if (obj === undefined) {
                var allObjs = this.getAllObjects();
                for (i = 0; i < allObjs.length; i++) {
                    obj = allObjs[i];
                    for (j = 0; j < obj.outlets.length; j++) {
                        source = obj.o(j);
                        for (k = 0; k < source.sinks.length; k++) {
                            connections.push([source, source.sinks[k]]);
                        }
                    }
                }
            } else {
                var sink;
                for (j = 0; j < obj.outlets.length; j++) {
                    source = obj.o(j);
                    for (k = 0; k < source.sinks.length; k++) {
                        connections.push([source, source.sinks[k]]);
                    }
                }
                for (j = 0; j < obj.inlets.length; j++) {
                    sink = obj.i(j);
                    for (k = 0; k < sink.sources.length; k++) {
                        connections.push([sink.sources[k], sink]);
                    }
                }
            }
            return connections;
        },

        // Throws an error if `obj` is not in the patch.
        _checkContainsObj: function(obj) {
            if (this._graph.objects.indexOf(obj) === -1) {
                throw (new Error('this object is not in the patch'));
            }
        }

    });

})(this.Pd);
