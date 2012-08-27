(function(Pd) {

    // !!! What we call "frame" here is a block of audio frames 
    // (i.e. : 1 frame = <channelsCount * blockSize> samples).
    Pd.Patch = function () {
        Pd.register(this);

        this.initEvents();
        this.sampleRate = Pd.sampleRate;
        this.blockSize = Pd.blockSize;

        // setting up the graph
	    this._graph = {
		    // an array of every object we know about
		    objects: [],
		    // an array of all of the end-points of the dsp graph
		    // (like dac~ or print~ or send~ or outlet~)
		    endPoints: [],
	    };
        // counter used internally to assign a unique id to objects
        // this counter should never be decremented to ensure the id unicity
        this._idCounter = -1;
	    // arrays of float data - Pd's tables
	    // keys are table names
        this._tables = {};
	    // arrays of callbacks which are scheduled to run at some point in time
	    // keys are frames
	    this._scheduled = {};

	    // create the audio output driver
	    this.audio = new Pd.AudioDriver(this.sampleRate, this.blockSize);
	    // output buffer (stereo)
	    this.output = Pd.newBuffer(2);
	    // Next frame
	    this.frame = 0;
	    // keys are receiver names
	    this.listeners = {};
    };

    Pd.extend(Pd.Patch.prototype, Pd.EventsBase, {

	    // regular expression for finding dollarargs
	    dollarMatch: /(?:\\{0,1}\$)(\d+)/g, //TODO: probably shouldn't be here
	
	    // send a message from outside the graph to a named receiver inside the graph
	    send: function(name, val) {
		    Pd.debug('graph received: ' + name + ' ' + val);
		    var listeners = this.listeners[name];
		    if (listeners) {
			    for (var l=0; l<listeners.length; l++) {
				    if (listeners[l].message) {
					    // inletnum of -1 signifies it came from somewhere other than an inlet
					    listeners[l].message(-1, val);
				    }
			    }
		    } else {
			    Pd.log('error: ' + name + ': no such object');
		    }
	    },
	
	    // send a message from inside the graph to a named receiver outside the graph
	    receive: function(name,callback){
		    pd.addlistener(name,{'message':function(d,val){callback(val);}});	
	    },
	
	    // send a bang to all receive objects named 'test'
	    testBang: function(){
		    this.send('test', 'bang');
	    },
	
	    // adds a new named listener to our graph
	    addListener: function(name, who) {
		    if (!this.listeners[name])
			    this.listeners[name] = [];
		    this.listeners[name][this.listeners[name].length] = who;
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
        clear: function(id) {
            this._genericOff(this._scheduled, id);
        },

        // Helper for scheduling a callback at an absolute time.
        _genericSchedule: function(cbObj, repeated) {
            if (!cbObj.callback || !cbObj.absTime) return;
            var frame = Math.ceil(this.timeToFrame(cbObj.absTime));
                cbs = this._scheduled[frame] = this._scheduled[frame] || [];
            cbs.push(cbObj);
            if (repeated !== true) return cbObj.id = this._generateBindId();
	    },

    /******************** DSP stuff ************************/

	    // Get a single frame of audio data from Pd.
	    generateFrame: function() {
            var patch = this, output = this.output,
                cbs = this._scheduled[this.frame] || [], i, cbObj;
            delete this._scheduled[this.frame];

		    // reset our output buffer (gets written to by dac~ objects)
            Pd.fillWithZeros(output);

		    // run the dsp function on all endpoints to pull data
		    this.mapEndPoints(function(obj) { patch.tick(obj); });
		    this.frame++;

            // Runs all the callbacks scheduled at the current frame
            // !!! We have to execute this after the frame has been incremented, 
            // otherwise rescheduling an interval will take wrong frame as reference.
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
        // TODO: infinite loop for DSP objects ? Circular reference ?
        // TODO: maybe objects shouldn't know about the frame count, it should
        // be passed to the dspTick function --- yes, but the frame count allows the graph to know
        // that dspTick has already been called for a given frame (see osc~)
	    tick: function(obj) {
            if (obj.frame < this.frame) {
                var inlets = obj.inlets, sources, i, j, len1, len2;

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
		        obj.frame = this.frame;
            }
	    },
	
	    // Starts this graph running
	    play: function() {
		    var patch = this;

		    if (!this.isPlaying()) {
			    Pd.debug('Starting audio.');
            	// fetch the actual samplerate from the audio driver
	            this.sampleRate = this.audio.getSampleRate();
                // TODO: should load called with post-order traversal,
                //        to ensure all children gets loaded before their parents ? 
                this.mapObjects(function(obj) { obj.load(); });
			    this.audio.play(function() { return patch.generateFrame(); });
                // reset frame counts
			    this.frame = 0;
			    this.mapObjects(function(obj) { obj.frame = 0; });
		    } else {
			    Pd.debug('Already started.');
		    }
	    },
	
	    // Stops this graph from running
	    stop: function() {
		    if (this.isPlaying()) {
			    Pd.debug('Stopping audio.');
			    this.audio.stop();
      		} else {
			    Pd.debug('Already stopped.');
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
            if (this._graph.objects.indexOf(obj) == -1) {
                var id = this._generateId();
                obj.id = id;
                obj.patch = this;
                this._graph.objects[id] = obj;
		        if (obj.endPoint) this._graph.endPoints.push(obj);
                if (this.isPlaying()) obj.load();
		        Pd.debug('Added ' + obj.type + ' to the graph at position ' + id);
            }
        },

        // Remove the object from the patch.
        // If the object is not in the patch, nothing happens.
        removeObject: function(obj) {
            var conns = this.getAllConnections(obj);
            for (var i=0; i<conns.length; i++) {
                this.disconnect(conns[i][0], conns[i][1]);
            }
            delete this._graph.objects[obj.id];
            var ind = this._graph.endPoints.indexOf(obj);
            if (ind != -1) this._graph.endPoints.splice(ind, 1);
        },

        // Returns an object given its id in the patch, or `null` if an object
        // with such an id doesn't exist.
        getObject: function(id) {
            return (this._graph.objects[id] || null);
        },

        // Adds a table to the patch. See `addObject`
        addTable: function(table) {
            this._tables[table.name] = table;
            this.addObject(table);
            Pd.debug("Added " + table.type + " to the graph at position " + table.id);
        },

        // Returns a table given its name, or `null` if such a table doesn't exist.
        getTableByName: function(name) {
            return (this._tables[name] || null);
        },

        // Calls the function `iterator(obj)` on all the patch's objects. 
        mapObjects: function(iterator) {
            this._map(this.getAllObjects(), iterator);
        },

        // Calls the function `iterator(obj)` on all the patch's end points. 
        mapEndPoints: function(iterator) {
            this._map(this._graph.endPoints, iterator);
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
            var objects = this._graph.objects;
            var filtered = [];
            var obj;
            for (var i=0; i<objects.length; i++) {
                if (objects[i]) filtered.push(objects[i]);
            }
            return filtered;
        },

        // Returns all connections in the graph as an array
        // of pairs `(outlet, inlet)`. If `obj` is provided, 
        // this returns only the connections from/to `obj`.
        getAllConnections: function(obj) {
            var connections = [];
            if (obj == undefined) {
                var allObjs = this.getAllObjects();
                for (var i=0; i<allObjs.length; i++) {
                    var obj = allObjs[i];
                    for (var j=0; j<obj.outlets.length; j++) {
                        var source = obj.o(j);
                        for (var k=0; k<source.sinks.length; k++) {
                            connections.push([source, source.sinks[k]]);
                        }
                    }
                }
            } else {
                for (var j=0; j<obj.outlets.length; j++) {
                    var source = obj.o(j);
                    for (var k=0; k<source.sinks.length; k++) {
                        connections.push([source, source.sinks[k]]);
                    }
                }
                for (var j=0; j<obj.inlets.length; j++) {
                    var sink = obj.i(j);
                    for (var k=0; k<sink.sources.length; k++) {
                        connections.push([sink.sources[k], sink]);
                    }
                }
            }
            return connections;
        },

        // Throws an error if `obj` is not in the patch.
        _checkContainsObj: function(obj) {
            if (this._graph.objects.indexOf(obj) == -1) {
                throw (new Error('this object is not in the patch'));
            }
        },

        // this method calls the function `iterator` on every element of `array`
        _map: function(array, iterator) {
            for (var i=0; i<array.length; i++) iterator(array[i]);
        },

        // every time it is called, this method returns a new unique id
        // for a graph object.
        _generateId: function() {
            this._idCounter++;
		    return this._idCounter;
        }
    });

})(this.Pd);
