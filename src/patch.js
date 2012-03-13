(function(Pd){

    Pd.Patch = function (graph) {
        var me = this;
	    // internal representation of the DSP graph.
	    this._graph = graph || (new _Graph());
        // TODO: remove this, better API for dynamic patches
        this._graph.mapObjects(function(obj) { 
            obj.pd = me;
            obj.setupdsp();
		    if (obj.init) obj.init();
        });

        this.sampleRate = Pd.sampleRate;
        this.blockSize = Pd.blockSize;
	    // create the audio output driver
	    this.audio = new Pd.AudioDriver(this.sampleRate, this.blockSize);
	    // output buffer (stereo)
	    this.output = new this.audio.arrayType(this.blockSize * 2);
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
		    //Pd.log('schedule()');
		    //Pd.log('\tcurrent time: ' + this.getabstime());
		    //Pd.log('\tall items scheduled: ');
		    //Pd.log_allscheduled();
	    },
	
	    log_allscheduled: function() {
		    for (var s in this.scheduled) {
			    Pd.log('\t\t' + s + ': ' + this.scheduled[s].length);
			    /*for (var i=0; i<this.scheduled[s].length; i++) {
				    Pd.log(this.scheduled[s][i]);
			    }*/
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
		    //Pd.log('getscheduled()');
		    //Pd.log('\tcurrent time: ' + this.getabstime());
		    //Pd.log('\ttimes scheduled: ' + scheduled);
		    //Pd.log('\tall items scheduled: ' + this.allscheduled());
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
		    this._graph.mapEndpoints(function(obj) { me.tick(obj); });
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
		    var context = this;
		    // check we're not already running
		    if (!this.audio.is_playing()) {
			    Pd.debug('Starting audio.');
			    this.audio.play(function() { return context.generateFrame(); });
            	// fetch the actual samplerate from the audio driver
	            Pd.sampleRate = this.audio.getSampleRate(); // TODO : shouldn't be here
			    // reset the frame count
			    this.frame = 0;
			    // reset the frame count on all objects
			    this._graph.mapObjects(function(obj) { obj.frame = 0; });
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
	    }
    });


    var _Graph = function() {

	    this._graph = {
		    // an array of every object we know about
		    objects: [],
		    // an array of all of the end-points of the dsp graph
		    // (like dac~ or print~ or send~ or outlet~)
		    endpoints: []
	    };

	    // arrays of float data - Pd's tables
	    // keys are table names
        this._tables = {};

    };

    Pd.extend(_Graph.prototype, {

        addObject: function(obj) {
            var ind = this._getIndex();
            obj.graphindex = ind;
            this._graph.objects[ind] = obj;
		    // if it's an endpoint, add it to the graph's list of known endpoints
		    if (obj.endpoint) this._graph.endpoints.push(obj);
		    Pd.debug('Added ' + obj.type + ' to the graph at position ' + ind);
            return ind;
        },

        getObject: function(ind) {
            return (this._graph.objects[ind] || null);
        },

        addTable: function(table) {
            this._tables[table.name] = table;
            var ind = this.addObject(table);
            Pd.debug("Added " + table.type + " to the graph at position " + ind);
            return ind;
        },

        mapObjects: function(iterator) {
            var objects = this._graph.objects;
            for (var i=0; i<objects.length; i++) iterator(objects[i]);
        },

        mapEndpoints: function(iterator) {
            var objects = this._graph.endpoints;
            for (var i=0; i<objects.length; i++) iterator(objects[i]);
        },

        connect: function(sourceInd, sourceOutlet, sinkInd, sinkInlet) {
		    var source = this.getObject(sourceInd);
		    var sink = this.getObject(sinkInd);

		    if (source.outletTypes) {
                var outletType = source.outletTypes[sourceOutlet];
			    if (outletType == 'dsp') {
				    sink.inlets[sinkInlet] = [source, sourceOutlet];
			    } else if (outletType == 'message') {
				    source.outlets[sourceOutlet] = [sink, sinkInlet];
			    }
			    Pd.debug(outletType + ' connection ' + source.type +
                    ' [' + sourceOutlet + '] to ' + sink.type +
                    ' [' + sinkInlet + ']');
		    }
        },

        _getIndex: function() {
		    return this._graph.objects.length;
        }

    });

    // regular expression for finding valid lines of Pd in a file
    var linesRe = new RegExp('(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}\n', 'gi');

    /** Parses a Pd file and creates a new DSP graph from it
    ref : http://puredata.info/docs/developer/PdFileFormat 
    **/
    // TODO: Graph object with methods for easier graph manipulation
    Pd.parse = function(txt) {
	    // last table name to add samples to
	    var lastTable = null;

        // parsed graph
        var graph = new _Graph();

	    // use our regular expression to match instances of valid Pd lines
	    while (pdline = linesRe.exec(txt)) {
		    // split this found line into tokens (on space and line break)
		    var tokens = pdline[1].split(/ |\r\n?|\n/);
            var chunkType = tokens[0];
		    Pd.debug(tokens.toString());

		    // if we've found a create token
		    if (chunkType == '#X') {
                var elementType = tokens[1];

			    // is this an obj instantiation
			    if (elementType == 'obj' || elementType == 'msg' || elementType == 'text') {

                    // we get the object's prototype name
				    var proto;
				    if (elementType == 'msg') proto = 'msg';
				    else if (elementType == 'text') proto = 'text';
				    else {
					    // see if we know about this type of object yet
					    proto = tokens[4];
					    if (!PdObjects.hasOwnProperty(proto)) {
						    // TODO: see if we can load this from a url and queue it to be loaded up after parsing
						    Pd.log(' ' + proto + '\n... couldn\'t create');
						    proto = 'null';
					    }
				    }

				    // instantiate this dsp object
				    var obj = new Pd.Object(PdObjects[proto], this, proto, tokens);
				    // put it in our graph of known objects
				    graph.addObject(obj);
				    // run the pre-init function which runs on an object before graph setup
				    if (obj.preinit) obj.preinit();

			    } else if (elementType == 'connect') {

                    graph.connect(parseInt(tokens[2]), parseInt(tokens[3]), 
                                    parseInt(tokens[4]), parseInt(tokens[5]));

			    } else if (elementType == 'array') {

                    var arrayName = tokens[2];
				    // instantiate this dsp object
				    var obj = new Pd.Object(PdObjects['table'], this, 'table', tokens);
				    // this table needs a set of data
				    obj.data = new Pd.AudioDriver.prototype.arrayType(parseInt(tokens[3]));
                    lastTable = obj;
                    lastTable.name = arrayName; // TODO: arrayName as argument
                    graph.addTable(obj);

			    } else if (elementType == 'restore') {
				    // end the current table
				    lastTable = null;
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
	    Pd.debug(graph);
        return graph;
    };

})(this.Pd);
