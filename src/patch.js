(function(Pd){

    Pd.Patch = function () {
        var me = this;

        // setting up the graph
	    this._graph = {
		    // an array of every object we know about
		    objects: [],
		    // an array of all of the end-points of the dsp graph
		    // (like dac~ or print~ or send~ or outlet~)
		    endpoints: [],
            connections: [],
	    };
        // counter used internally to assign a unique id to objects
        // this counter should never be decremented to ensure the id unicity
        this._idCounter = -1;
	    // arrays of float data - Pd's tables
	    // keys are table names
        this._tables = {};

        // sample rate at which this patch runs
        this.sampleRate = Pd.sampleRate;
        // block size of this patch
        this.blockSize = Pd.blockSize;
	    // create the audio output driver
	    this.audio = new Pd.AudioDriver(this.sampleRate, this.blockSize);
	    // output buffer (stereo)
	    this.output = new Pd.arrayType(this.blockSize * 2);
	    // how many frames have we run
	    this.frame = 0;
	    // keys are receiver names
	    this.listeners = {};
	    // arrays of callbacks which are scheduled to run at some point in time
	    // keys are times
	    this.scheduled = {};
    };

    Pd.extend(Pd.Patch.prototype, {

	    // regular expression for finding dollarargs
	    dollarmatch: /(?:\\{0,1}\$)(\d+)/g, //TODO: shouldn't be here
	
	    /** send a message from outside the graph to a named receiver inside the graph **/
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
	
	    /** send a message from inside the graph to a named receiver outside the graph **/
	    receive: function(name,callback){
		    pd.addlistener(name,{'message':function(d,val){callback(val);}});	
	    },
	
	    /** send a bang to all receive objects named 'test' **/
	    testbang: function(){
		    this.send('test', 'bang');
	    },
	
	    /******************** Internal methods ************************/
	
	    /** adds a new named listener to our graph **/
	    addlistener: function(name, who) {
		    if (!this.listeners[name])
			    this.listeners[name] = [];
		    this.listeners[name][this.listeners[name].length] = who;
	    },
	
	    /** gets the absolute current logical elapsed time in milliseconds **/
	    getabstime: function() {
		    return this.frame * Pd.blockSize / (Pd.sampleRate / 1000);
	    },
	
	    /** Schedule a callback at a particular time - milliseconds **/
	    schedule: function(time, callback) {
		    //var time = relativetime + this.getabstime();
		    if (this.scheduled[time] == null)
			    this.scheduled[time] = [];
		    this.scheduled[time].push(callback);
	    },
	
	    log_allscheduled: function() {
		    for (var s in this.scheduled) {
			    Pd.log('\t\t' + s + ': ' + this.scheduled[s].length);
		    }
	    },
	
	    /** Gets a list of all currently scheduled callbacks **/
	    getscheduled: function() {
		    var scheduled = [];
		    for (var s in this.scheduled) {
			    if (s <= this.getabstime()) {
				    scheduled.push(s);
			    }
		    }
		    // make sure the scheduled items get run in time order
		    scheduled.sort();
		    return scheduled;
	    },
	
	    /******************** DSP stuff ************************/
	
	    /** Get a single frame of audio data from Pd **/
	    generateFrame: function() {
            var me = this;
		    // run any pending scheduled callbacks in this frame
		    // keep doing so until there are no scheduled callbacks
		    var scheduled = [];
		    do {
			    // anything we want to remove from the list of scheduled callbacks this round
			    var removescheduled = [];
			    // get a list of all times that have callbacks attached to them that are due
			    scheduled = this.getscheduled();
			    // loop through each time
			    for (var si=0; si<scheduled.length; si++) {
				    var s = scheduled[si];
				    // for every callback to be run at this time
				    for (var c=0; c<this.scheduled[s].length; c++) {
					    // run it
					    this.scheduled[s][c](parseFloat(s));
				    }
				    // add it to our list of times to remove callbacks for
				    removescheduled.push(s);
			    }
			    // remove any scheduled callbacks we've already run
			    for (var r=0; r<removescheduled.length; r++) {
				    delete this.scheduled[removescheduled[r]];
			    }
		    } while (scheduled.length);
		    // reset our output buffer (gets written to by dac~ objects)
		    for (var i=0; i<this.output.length; i++) {
			    this.output[i] = 0;
            }
		    // run the dsp function on all endpoints to get data
		    this.mapEndPoints(function(obj) { me.tick(obj); });
		    // increase the frame count
		    this.frame += 1;
		    // return the contents of the dspbuffer
		    return this.output;
	    },
	
	    /** Dsp tick function run on an object which makes sure the object's parents all get run before running it. **/
	    tick: function(obj) {
		    // look at each inlet, and make sure that the previous objects have all run this frame
		    for (var o in obj.inlets) {
			    var inlet = obj.inlets[o][0];
			    // run this inlet if it hasn't run yet
			    if (inlet.frame < this.frame) {
				    this.tick(inlet);
			    }
		    }
		    // run this object's dsp process
		    if (obj.dsptick)
			    obj.dsptick();
		    // update this objects' frame count
		    obj.frame = this.frame;
	    },
	
	    /** Starts this graph running **/
	    play: function() {
		    var me = this;

		    // check we're not already running
		    if (!this.audio.is_playing()) {
                this.mapObjects(function(obj) { 
                    obj.setupdsp();
		            obj.init();
                });
			    Pd.debug('Starting audio.');
			    this.audio.play(function() { return me.generateFrame(); });
            	// fetch the actual samplerate from the audio driver
	            Pd.sampleRate = this.audio.getSampleRate(); // TODO : shouldn't be here
			    // reset the frame count
			    this.frame = 0;
			    // reset the frame count on all objects
			    this.mapObjects(function(obj) { obj.frame = 0; });
		    } else {
			    Pd.debug('Already started.');
		    }
	    },
	
	    /** Stops this graph from running **/
	    stop: function() {
		    // if we're already running
		    if (this.audio.is_playing()) {
			    Pd.debug('Stopping audio.');
			    // destroy the audio element
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
            obj._id = id;
            obj.pd = this;
            this._graph.objects[id] = obj;
		    if (obj.endpoint) this._graph.endpoints.push(obj);
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
            this._map(this._graph.endpoints, iterator);
        },

        // Connects two objects.
        connect: function(sourceId, sourceOutlet, sinkId, sinkInlet) {
		    var source = this.getObject(sourceId);
		    var sink = this.getObject(sinkId);
            if (sink === null || source === null) return;

		    if (source.outletTypes) {
                var outletType = source.outletTypes[sourceOutlet];
			    if (outletType == 'dsp') {
				    sink.inlets[sinkInlet] = [source, sourceOutlet];
			    } else if (outletType == 'message') {
				    source.outlets[sourceOutlet] = [sink, sinkInlet];
			    }
                this._graph.connections.push([sourceId, sourceOutlet, 
                                                    sinkId, sinkInlet]);
			    Pd.debug(outletType + ' connection ' + source.type +
                    ' [' + sourceOutlet + '] to ' + sink.type +
                    ' [' + sinkInlet + ']');
		    }
        },

        // Query and returns the graph's connections.
        // available filters are :
        //  - `sourceId` : keeps only connections from object with id `sourceId`
        //  - `sinkId` : keeps only connections from object with id `sinkId`
        // TODO: object-oriented connections ?
        getConnections: function(filters) {
            filters = filters || {};
            var sourceId = filters.sourceId;
            var sinkId = filters.sinkId;

            var connections = this._graph.connections;
            var results = [];
            for (var i=0; i<connections.length; i++) {
                var conn = connections[i];
                if ((conn[0] === sourceId || sourceId == undefined)
                    && (conn[2] === sinkId || sinkId == undefined)) {
                    results.push(conn);
                }
            }
            return results;
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
						    // TODO: see if we can load this from a url and queue it to be loaded up after parsing
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
