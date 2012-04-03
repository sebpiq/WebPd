(function(Pd){

    Pd.Patch = function () {
        var me = this;

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

        // sample rate at which this patch runs
        this.sampleRate = null;
        // block size of this patch
        this.blockSize = Pd.blockSize;
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
	
        // Gets the sample rate the patch is running at
        getSampleRate: function() {
            return (this.sampleRate || Pd.sampleRate);
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
                    for (var j=0; j<sources.length; j++) this.tick(sources[j].getObject());
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

		    if (!this.audio.is_playing()) {
			    Pd.debug('Starting audio.');
                // TODO: should load called with post-order traversal,
                //        to ensure all children gets loaded before their parents ? 
                this.mapObjects(function(obj) { obj.load(); });
			    this.audio.play(function() { return me.generateFrame(); });
            	// fetch the actual samplerate from the audio driver
	            Pd.sampleRate = this.audio.getSampleRate(); // TODO : shouldn't be here
                // reset frame counts
			    this.frame = 0;
			    this.mapObjects(function(obj) { obj.frame = 0; });
		    } else {
			    Pd.debug('Already started.');
		    }
	    },
	
	    // Stops this graph from running
	    stop: function() {
		    if (this.audio.is_playing()) {
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
            obj._setId(id);
            obj._setPatch(this);
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
            Pd.debug("Added " + table.type + " to the graph at position " + table.getId());
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


    /******************** Patch parsing ************************/

    // regular expression for finding valid lines of Pd in a file
    var linesRe = new RegExp('(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}\n', 'gi');
    var tokensRe = new RegExp(' |\r\n?|\n');

    // Parses a Pd file and creates a new DSP graph from it
    // ref : http://puredata.info/docs/developer/PdFileFormat 
    Pd.parse = function(txt, pd) {
	    // last table name to add samples to
	    var lastTable = null;
        var counter = 0;
        var line;

	    // use our regular expression to match instances of valid Pd lines
	    while (line = linesRe.exec(txt)) {
		    var tokens = line[1].split(tokensRe);
            var chunkType = tokens[0];
		    Pd.debug(tokens.toString());

		    // if we've found a create token
		    if (chunkType == '#X') {
                var elementType = tokens[1];

			    // is this an obj instantiation
			    if (elementType == 'obj' || elementType == 'msg' || elementType == 'text') {
				    var proto;  // the lookup to use in the `Pd.objects` hash
                    var args;   // the construction args for the object

				    if (elementType == 'msg') {
                        proto = 'msg';
                        args = tokens.slice(4);
                    } else if (elementType == 'text') {
                        proto = 'text';
                        args = tokens.slice(4);
                    } else {
					    proto = tokens[4];
                        args = tokens.slice(5);
					    if (!Pd.objects.hasOwnProperty(proto)) {
						    Pd.log(' ' + proto + '\n... couldn\'t create');
						    proto = 'null';
					    }
				    }

                    var obj = new Pd.objects[proto](pd, args);

			    } else if (elementType == 'array') {
                    var arrayName = tokens[2];
                    var arraySize = parseInt(tokens[3]);

				    var obj = new Pd.objects['table'](pd, [arrayName, arraySize]);
                    // remind the last table for handling correctly 
                    // the table related instructions which might follow.
                    lastTable = obj;

			    } else if (elementType == 'restore') {
				    // end the current table
				    lastTable = null;

			    } else if (elementType == 'connect') {
                    pd.connect(parseInt(tokens[2]), parseInt(tokens[3]), 
                                    parseInt(tokens[4]), parseInt(tokens[5]));
                }

		    } else if (chunkType == '#A') {
			    // reads in part of an array/table of data, starting at the index specified in this line
			    // name of the array/table comes from the the '#X array' and '#X restore' matches above
			    var idx = parseInt(tokens[1]);
			    if (lastTable) {
				    for (var t=2; t<tokens.length; t++, idx++) {
					    lastTable.data[idx] = parseFloat(tokens[t]);
				    }
				    Pd.debug('read ' + (tokens.length - 1) +
                        ' floats into table "' + lastTable.name + '"');
			    } else {
				    Pd.log('Error: got table data outside of a table.');
			    }
		    }
	    }

	    // output a message with our graph
	    Pd.debug('Graph:');
	    Pd.debug(pd);
    };

})(this.Pd);
