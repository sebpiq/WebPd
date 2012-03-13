(function(Pd){

    Pd.Patch = function (desiredSampleRate, blockSize, debug) {
	    // the size of our blocks
	    this.blockSize = blockSize || BLOCKSIZE;
	    // create the audio output driver
	    this.audio = new Pd.AudioDriver(desiredSampleRate, blockSize);
	    // the actual samplerate needs to be fetched from the audio driver
	    this.sampleRate;
	    // output buffer (stereo)
	    this.output = new this.audio.arrayType(blockSize * 2);
	    // whether we are in debug mode (more verbose output
	    this.debugMode = debug;
	    // how many frames have we run
	    this.frame = 0;
	    // keys are receiver names
	    this.listeners = {};
	    // arrays of callbacks which are scheduled to run at some point in time
	    // keys are times
	    this.scheduled = {};
	    // arrays of float data - Pd's tables
	    // keys are table names
	    this.tables = {};
	
	    // internal representation of the DSP graph.
	    this._graph = {
		    // an array of every object we know about
		    "objects": [],
		    // an array of all of the end-points of the dsp graph
		    // (like dac~ or print~ or send~ or outlet~)
		    "endpoints": []
	    };
	
	    // callback which should fire once the entire patch is loaded
	    this.loadcallback = null;
    };


    Pd.extend(Pd.Patch.prototype, {

	    // regular expression for finding valid lines of Pd in a file
	    lines_re: new RegExp("(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}\n", "gi"),
	    // regular expression for finding dollarargs
	    dollarmatch: /(?:\\{0,1}\$)(\d+)/g,
	    // regular expression for delimiting messages
	    messages_re: /\\{0,1};/,
	    // regular expression for delimiting comma separated messages
	    parts_re: /\\{0,1},/,

	    /** Initiate a load of a Pd file **/
	    load: function (url, callback) {
		    this.loadcallback = callback;
		    MakeRequest(url, this);
		    return this;
	    },
	
	    /** Initiate a load of a Pd source string **/
	    loadfromstring: function (string, callback) {
		    this.loadcallback = callback;
		    this.loadcomplete(string, {"status": 200});
		    return this;
	    },
	
	    /** send a message from outside the graph to a named receiver inside the graph **/
	    send: function(name, val) {
		    this.debug("graph received: " + name + " " + val);
		    var listeners = this.listeners[name];
		    if (listeners) {
			    for (var l=0; l<listeners.length; l++) {
				    if (listeners[l].message) {
					    // inletnum of -1 signifies it came from somewhere other than an inlet
					    listeners[l].message(-1, val);
				    }
			    }
		    } else {
			    this.log("error: " + name + ": no such object");
		    }
	    },
	
	    /** send a message from inside the graph to a named receiver outside the graph **/
	    receive: function(name,callback){
		    pd.addlistener(name,{"message":function(d,val){callback(val);}});	
	    },
	
	    /** send a bang to all receive objects named "test" **/
	    testbang: function(){
		    this.send("test", "bang");
	    },
	
	    /********************* Dealing with patches ************************/
	
	    /** Parses a Pd file and creates a new DSP graph from it **/
	    parse: function(txt) {
		    // last table name to add samples to
		    var lastTable = null;
		    // use our regular expression to match instances of valid Pd lines
		    while (pdline = this.lines_re.exec(txt)) {
			    // split this found line into tokens (on space and line break)
			    var tokens = pdline[1].split(/ |\r\n?|\n/);
			    this.debug("" + tokens);
			    // if we've found a create token
			    if (tokens[0] == "#X") {
				    // is this an obj instantiation
				    if (tokens[1] == "obj" || tokens[1] == "msg" || tokens[1] == "text") {
					    var proto = "";
					    // if this is a message object
					    if (tokens[1] == "msg") {
						    proto = "msg";
					    } else if (tokens[1] == "text") {
						    proto = "text";
					    } else {
						    // see if we know about this type of object yet
						    proto = tokens[4];
						    if (!PdObjects[proto]) {
							    proto = "null";
							    // TODO: see if we can load this from a url and queue it to be loaded up after parsing
							    this.log(" " + tokens[4]);
							    this.log("... couldn't create");
						    }
					    }
					    // instantiate this dsp object
					    var obj = new Pd.Object(PdObjects[proto], this, proto, tokens);
					    // put it in our graph of known objects
					    obj.graphindex = this._graph.objects.length;
					    this._graph.objects[obj.graphindex] = obj;
					    this.debug("Added " + obj.type + " to the graph at position " + obj.graphindex);
					    // if it's an endpoint, add it to the graph's list of known endpoints
					    if (obj.endpoint) {
						    this._graph.endpoints.push(obj);
					    }
					    // run the pre-init function which runs on an object before graph setup
					    if (obj.preinit)
						    obj.preinit();
				    } else if (tokens[1] == "connect") {
					    // connect objects together
					    var destination = this._graph.objects[parseInt(tokens[4])];
					    var destination_inlet = parseInt(tokens[5]);
					    var source = this._graph.objects[parseInt(tokens[2])];
					    var source_outlet = parseInt(tokens[3]);
					    if (source.outletTypes) {
						    if (source.outletTypes[source_outlet] == "dsp") {
							    destination.inlets[destination_inlet] = [source, source_outlet];
							    this.debug("dsp connection " + source.type + " [" + source_outlet + "] to " + destination.type + " [" + destination_inlet + "]");
						    } else if (source.outletTypes[source_outlet] == "message") {
							    source.outlets[source_outlet] = [destination, destination_inlet];
							    this.debug("msg connection " + source.type + " [" + source_outlet + "] to " + destination.type + " [" + destination_inlet + "]");
						    }
					    }
				    } else if (tokens[1] == "array") {
					    // instantiate this dsp object
					    var obj = new Pd.Object(PdObjects["table"], this, "table", tokens);
					    // put it in our graph of known objects
					    obj.graphindex = this._graph.objects.length;
					    this._graph.objects[obj.graphindex] = obj;
					    this.debug("Added " + obj.type + " to the graph at position " + obj.graphindex);
					    // this table needs a set of data
					    obj.data = new this.audio.arrayType(parseInt(tokens[3]));
					    // add this to our global list of tables
					    this.tables[tokens[2]] = obj;
					    lastTable = tokens[2];
				    } else if (tokens[1] == "restore") {
					    // end the current table
					    lastTable = null;
				    }
			    } else if (tokens[0] == "#A") {
				    // reads in part of an array/table of data, starting at the index specified in this line
				    // name of the array/table comes from the the "#X array" and "#X restore" matches above
				    var idx = parseInt(tokens[1]);
				    if (lastTable) {
					    for (var t=2; t<tokens.length; t++) {
						    this.tables[lastTable].data[idx] = parseFloat(tokens[t]);
						    idx += 1;
					    }
					    this.debug("read " + (tokens.length - 1) + " floats into table '" + lastTable + "'");
				    } else {
					    this.log("Error: got table data outside of a table.");
				    }
			    }
		    }
		
		    // After we have established our graph additionally set up the correct dsp eating inlet functions
		    for (var o in this._graph.objects) {
			    this._graph.objects[o].setupdsp();
			    if (this._graph.objects[o].init)
				    this._graph.objects[o].init();
		    }
		
		    // output a message with our graph
		    this.debug("Graph:");
		    this.debug(this._graph);
		    // run the loadcallback to notify the user that the patch is loaded
		    this.loadcallback(this);
		    return this;
	    },
	
	    /** Called when we receive the new patch from the network **/
	    loadcomplete: function(result, request) {
		    if (request.status == 404) {
			    // TODO: file not found, tell the user
			    this.log("No such file:", request.url);
		    } else {
			    this.parse(result);
		    }
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
		    return this.frame * this.blockSize / (this.sampleRate / 1000);
	    },
	
	    /** Schedule a callback at a particular time - milliseconds **/
	    schedule: function(time, callback) {
		    //var time = relativetime + this.getabstime();
		    if (this.scheduled[time] == null)
			    this.scheduled[time] = [];
		    this.scheduled[time].push(callback);
		    //this.log("schedule()");
		    //this.log("\tcurrent time: " + this.getabstime());
		    //this.log("\tall items scheduled: ");
		    //this.log_allscheduled();
	    },
	
	    log_allscheduled: function() {
		    for (var s in this.scheduled) {
			    this.log("\t\t" + s + ": " + this.scheduled[s].length);
			    /*for (var i=0; i<this.scheduled[s].length; i++) {
				    this.log(this.scheduled[s][i]);
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
		    //this.log("getscheduled()");
		    //this.log("\tcurrent time: " + this.getabstime());
		    //this.log("\ttimes scheduled: " + scheduled);
		    //this.log("\tall items scheduled: " + this.allscheduled());
		    return scheduled;
	    },
	
	    /**
		    Tokenizes a complex message with atoms, commas, and semicolons.
		    Returns an array of arrays of strings. (array of lists of comma separated messages).
	     **/
	    messagetokenizer: function(message) {
		    var result = [];
		    var messages = message.split(this.messages_re);
		    for (var m=0; m<messages.length; m++) {
			    var submessagelist = [];
			    // TODO: replace $N with item N-1 from the incoming message
			    var submessages = messages[m].split(this.parts_re);
			    for (var s=0; s<submessages.length; s++) {
				    var atoms = submessages[s].split(" ");
				    var resultatoms = [];
				    for (var a=0; a<atoms.length; a++) {
					    if (atoms[a] != "") {
						    resultatoms.push(atoms[a]);
					    }
				    }
				    if (resultatoms.length)
					    submessagelist.push(resultatoms.join(" "));
			    }
			    if (submessagelist.length)
				    result.push(submessagelist);
		    }
		    return result;
	    },
	
	    /******************** DSP stuff ************************/
	
	    /** Get a single frame of audio data from Pd **/
	    generateFrame: function() {
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
		    for (var e in this._graph.endpoints) {
			    // dac~ objects will add their output to this.output
			    this.tick(this._graph.endpoints[e]);
		    }
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
			    this.debug("Starting audio.");
			    this.audio.play(function() { return context.generateFrame(); });
            	// fetch the actual samplerate from the audio driver
	            this.sampleRate = this.audio.getSampleRate();
			    // reset the frame count
			    this.frame = 0;
			    // reset the frame count on all objects
			    for (var o in this._graph.objects) {
				    this._graph.objects[0].frame = 0;
			    }
		    } else {
			    this.debug("Already started.");
		    }
	    },
	
	    /** Stops this graph from running **/
	    stop: function() {
		    // if we're already running
		    if (this.audio.is_playing()) {
			    this.debug("Stopping audio.");
			    // destroy the audio element
			    this.audio.stop();
      		} else {
			    this.debug("Already stopped.");
		    }
	    },
	
	    /******************** console/logging stuff ************************/
	
	    /** log a message to console **/
	    log: function(msg, debugconsole) {
		    if (typeof window.console != "undefined" && typeof console.log != "undefined") {
			    console.log(msg);
		    } else {
			    // log manually in HTML
			    var fakeconsole = document.getElementById(arguments.length == 2 ? "debug" : "console");
			    if (fakeconsole) fakeconsole.innerHTML += msg + "<br/>\n";
		    }
	    },

	    /** logs only when debugMode is set. **/
	    debug: function(msg) {
		    if (this.debugMode) {
			    if (typeof(msg) == "string")
				    this.log("debug: " + msg, 'debug');
			    else
				    this.log(msg, 'debug');
		    }
	    }
    });


    /*******************************************************
	    Object prototype, common to all Pd objects 
     *******************************************************/
    Pd.Object = function (proto, pd, type, args) {
	    // let this object know about it's container graph
	    this.pd = pd;
	    // let this object know what type of thing it is
	    this.type = type;
	    // frame counter - how many frames have we run for
	    this.frame = 0;
	    // initialisation arguments
	    this.args = args;
	
	    // create the inlets and outlets array for this object
	    // array holds 2-tuple entries of [src-object, src-outlet-number]
	    this.inlets = [];
	    // array holds 2-tuple entries of [dest-object, dest-inlet-number]
	    this.outlets = [];
	    // holds a pointer to an existing outlet buffer, or a small buffer with a constant value
	    // (array of buffers)
	    this.inletbuffer = [];
	    // holds actual output buffers
	    // (array of two buffers)
	    this.outletbuffer = [];
	
	    // copy properties from the right type of thing
	    for (var m in proto) {
		    this[m] = proto[m];
	    }
	
	    if (this.outletTypes) {
		    // create the outlet buffers for this object
		    for (var o=0; o<this.outletTypes.length; o++) {
			    if (this.outletTypes[o] == "dsp") {
				    this.outletbuffer[o] = new this.pd.audio.arrayType(this.pd.blockSize);
			    }
		    }
	    }
    };
	
    Pd.extend(Pd.Object.prototype, {

	    /** Converts a Pd message to a float **/
	    tofloat: function(data) {
		    // first check if we just got an actual float, return it if so
		    if (!isNaN(data)) {
			    return data;
		    }
		    // otherwise parse this thing
		    var element = data.split(" ")[0];
		    var foundfloat = parseFloat(element);
		    if (!isNaN(foundfloat)) {
			    element = foundfloat;
		    } else if (element != "symbol") {
			    this.pd.log("error: trigger: can only convert 's' to 'b' or 'a'")
			    element = "";
		    } else {
			    element = 0;
		    }
		    return element;
	    },
	
	    /** Converts a Pd message to a symbol **/
	    tosymbol: function(data) {
		    var element = data.split(" ")[0];
		    if (!isNaN(parseFloat(element))) {
			    element = "symbol float";
		    } else if (element != "symbol") {
			    this.pd.log("error: trigger: can only convert 's' to 'b' or 'a'")
			    element = "";
		    } else {
			    element = "symbol " + data.split(" ")[1];
		    }
		    return element;
	    },
	
	    /** Convert a Pd message to a bang **/
	    tobang: function(data) {
		    return "bang";
	    },
	
	    /** Convert a Pd message to a javascript array **/
	    toarray: function(msg) {
		    var type = typeof(msg);
		    // if it's a string, split the atom
		    if (type == "string") {
			    var parts = msg.split(" ");
			    if (parts[0] == "list")
				    parts.shift();
			    return parts;
		    // if it's an int, make a single valued array
		    } else if (type == "number") {
			    return [msg];
		    // otherwise it's proably an object/array and should stay that way
		    } else {
			    return msg;
		    }
	    },
	
	    /** Sends a message to a particular outlet **/
	    sendmessage: function(outletnum, msg) {
		    if (this.outlets[outletnum]) {
			    // propagate this message to my outlet
			    this.outlets[outletnum][0].message(this.outlets[outletnum][1], msg);
		    } else {
			    // pd silently drops these messages into the ether
			    this.pd.debug(this.type + ": No outlet #" + outletnum);
		    }
	    },
	
	    /** Run after the graph is created to set up DSP inlets specially (accept floats if not dsp) **/
	    setupdsp: function() {
		    if (this.dspinlets) {
			    for (var i=0; i<this.dspinlets.length; i++) {
				    // which inlet is supposed to be dsp friendly?
				    var idx = this.dspinlets[i];
				    //console.log(this.type + " " + idx);
				    // TODO: check for multiple incoming dsp data buffers and sum them
				    // see if the outlet that is connected to our inlet is of type 'dsp'
				    if (this.inlets[idx] && this.inlets[idx][0].outletTypes[this.inlets[idx][1]] == "dsp") {
					    // use that outlet's buffer as our inlet buffer
					    this.inletbuffer[idx] = this.inlets[idx][0].outletbuffer[this.inlets[idx][1]];
					    this.pd.debug(this.graphindex + " (" + this.type + ") at inlet " + idx + " dsp inlet real buffer");
				    } else {
					    // otherwise it's a message inlet and if we get a float we want to use that instead
					    // create a new single-valued buffer, initialised to 0
					    this.inletbuffer[idx] = [0];
					
					    // override the existing message input to check for incoming floats
					    // and use them to set the buffer value
					    // (remember the old message func so we can stack it on the end of the new one
					    // this is slightly complicated but oh well)
					    if (this.message) {
						    this["message_" + idx] = this.message;
					    }
					
					    // returns a new message function to replace the old one
					    function makeMessageFunc(myidx) {
						    return function (inletnum, msg) {
							    if (inletnum == myidx && !isNaN(parseFloat(msg))) {
								    // set our constant-buffer value to the incoming float value
								    this.inletbuffer[myidx][0] = parseFloat(msg);
							    }
							    // chain our old message function onto the end of this new one
							    if (this["message_" + myidx])
								    this["message_" + myidx](inletnum, msg);
						    }
					    }
					
					    // replace our message function 
					    this.message = makeMessageFunc(idx);
					    this.pd.debug(this.graphindex + " (" + this.type + ") dsp inlet " + idx + " single val buffer");
				    }
			    }
		    }
	    }
    });

})(this.Pd);
