(function(Pd){

    Pd.Patch = function () {
        Pd.register(this);
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

	    // create the audio output driver
	    this.audio = new Pd.AudioDriver(this.sampleRate, this.blockSize);
	    // output buffer (stereo)
	    this.output = Pd.newBuffer(2);
	    // how many frames have we run
	    this.frame = 0;
	    // keys are receiver names
	    this.listeners = {};
    };

    Pd.extend(Pd.Patch.prototype, {

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
	

    /******************** Internal methods ************************/

	    // adds a new named listener to our graph
	    addListener: function(name, who) {
		    if (!this.listeners[name])
			    this.listeners[name] = [];
		    this.listeners[name][this.listeners[name].length] = who;
	    },
	
	    // gets the absolute current logical elapsed time in milliseconds
	    getAbsTime: function() {
		    return this.frame * Pd.blockSize / (Pd.sampleRate / 1000);
	    },

    /******************** DSP stuff ************************/

	    // Get a single frame of audio data from Pd
	    generateFrame: function() {
            var me = this;
            var output = this.output;
		    // reset our output buffer (gets written to by dac~ objects)
            Pd.fillWithZeros(output);
		    // run the dsp function on all endpoints to get data
		    this.mapEndPoints(function(obj) { me.tick(obj); });
		    this.frame++;
		    return output;
	    },
	
	    // Dsp tick function. Pulls dsp data from `obj` and all its parents.
        // TODO: maybe objects shouldn't know about the frame count, it should
        // be passed to the dspTick function --- yes, but the frame count allows the graph to know
        // that dspTick has already been called for a given frame (see osc~)
	    tick: function(obj) {
            if (obj.frame < this.frame) {
                var inlets = obj.inlets;
                var sources;
		        // recursively triggers tick on all parent objects
		        for (var i=0; i<inlets.length; i++) {
			        sources = inlets[i].sources;
                    for (var j=0; j<sources.length; j++) this.tick(sources[j].obj);
		        }
		        // once all parents have run their dsp process,
                // we can proceed with the current object.
		        if (obj.dspTick) obj.dspTick();
		        obj.frame = this.frame;
            }
	    },
	
	    // Starts this graph running
	    play: function() {
		    var me = this;

		    if (!this.audio.isPlaying()) {
			    Pd.debug('Starting audio.');
            	// fetch the actual samplerate from the audio driver
	            this.sampleRate = this.audio.getSampleRate();
                // TODO: should load called with post-order traversal,
                //        to ensure all children gets loaded before their parents ? 
                this.mapObjects(function(obj) { obj.load(); });
			    this.audio.play(function() { return me.generateFrame(); });
                // reset frame counts
			    this.frame = 0;
			    this.mapObjects(function(obj) { obj.frame = 0; });
		    } else {
			    Pd.debug('Already started.');
		    }
	    },
	
	    // Stops this graph from running
	    stop: function() {
		    if (this.audio.isPlaying()) {
			    Pd.debug('Stopping audio.');
			    this.audio.stop();
      		} else {
			    Pd.debug('Already stopped.');
		    }
	    },

    /******************** Graph methods ************************/

        // Adds an object to the patch.
        // This also causes the patch to automatically assign an id to that object.
        // This id can be used to uniquely identify the object in the patch.
        addObject: function(obj) {
            var id = this._generateId();
            obj.id = id;
            obj.patch = this;
            this._graph.objects[id] = obj;
		    if (obj.endPoint) this._graph.endPoints.push(obj);
		    Pd.debug('Added ' + obj.type + ' to the graph at position ' + id);
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
            this._map(this._graph.objects, iterator);
        },

        // Calls the function `iterator(obj)` on all the patch's end points. 
        mapEndPoints: function(iterator) {
            this._map(this._graph.endPoints, iterator);
        },

        // Connects two objects. `source` and `sink` can be either the object instances,
        // or their id in the graph. 
        connect: function(source, outletId, sink, inletId) {
	        var source = this._toObject(source);
	        var sink = this._toObject(sink);
            source.outlets[outletId].connect(sink.inlets[inletId]);
        },

        // Disconnects two objects. See `connect`.
        disconnect: function(source, outletId, sink, inletId) {
	        var source = this._toObject(source);
	        var sink = this._toObject(sink);
            source.outlets[outletId].disconnect(sink.inlets[inletId]);
        },

        // takes an object or an object id, and returns an object.
        _toObject: function(objectOrId) {
            if (!(objectOrId instanceof Pd.Object)) {
		        var objectOrId = this.getObject(objectOrId);
            }
            if (objectOrId === null) throw (new Error('Unknown object ' + objectOrId));
            return objectOrId;
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
