/***
	A very basic implementation of Pd's dsp engine for the web.
	
	Copyright Chris McCormick, 2010.
	Licensed under the terms of the AGPLv3, or a later version of that license.
	See the file COPYING for details.
	(Basically if you provide this software via the network you need to make the source code available, but read the license for details).
***/

var Pd = function Pd(sampleRate, bufferSize, debug, arrayType) {
	// what type of javascript array do we want to use?
	this.arrayType = arrayType || Array; // Float32Array
	// whether we are in debug mode (more verbose output
	this.debugMode = debug;
	// set my own sample rate
	this.sampleRate = sampleRate;
	// output buffer (stereo)
	this.output = new this.arrayType(bufferSize * 2);
	// the audio element we'll use to make sound
	this.el = null;
	// how many frames have we run
	this.frame = 0;
	// the size of our buffers
	this.bufferSize = bufferSize;
	// the last position written to the audiobuffer
	this.lastWritePosition = 0;
	// the audio-filling interval id
	this.interval = -1;
	// if there is any overflow writing to the hardware buffer we store it here
	this.overflow = new this.arrayType(0);
	// arrays of receivers which are listening for messages
	// keys are receiver names
	this.listeners = {};
	// arrays of callbacks which are scheduled to run at some point in time
	// keys are times
	this.scheduled = {};
	// arrays of float data - Pd's tables
	// keys are table names
	this.tables = {};
	// closure reference to this object
	var me = this;
	
	// internal representation of the DSP graph.
	this._graph = {
		// an array of every object we know about
		"objects": [],
		// an array of all of the end-points of the dsp graph
		// (like dac~ or print~ or send~ or outlet~)
		"endpoints": [],
	};
	
	// callback which should fire once the entire patch is loaded
	this.loadcallback = null;
	
	// regular expression for finding valid lines of Pd in a file
	var lines_re = new RegExp("(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}\n", "gi");
	// regular expression for finding dollarargs
	this.dollarmatch = /(?:\\{0,1}\$)(\d+)/g;
	// regular expression for delimiting messages
	var messages_re = /\\{0,1};/
	// regular expression for delimiting comma separated messages
	var parts_re = /\\{0,1},/
	
	/********************* "Public" methods ************************/
	
	/** Initiate a load of a Pd file **/
	this.load = function (url, callback) {
		this.loadcallback = callback;
		MakeRequest(url, this);
		return this;
	}
		
	/** Initiate a load of a Pd source string **/
	this.loadfromstring = function (string, callback) {
		this.loadcallback = callback;
		this.loadcomplete(string,{"status":200});
		return string;
	}
	
	/** send a message from outside the graph to a named receiver inside the graph **/
	this.send = function(name, val) {
		this.debug("graph received: " + name + " " + val);
		if (this.listeners[name]) {
			for (var l=0; l<this.listeners[name].length; l++) {
				if (this.listeners[name][l].message) {
					// inletnum of -1 signifies it came from somewhere other than an inlet
					this.listeners[name][l].message(-1, val);
				}
			}
		} else {
			this.log("error: " + name + ": no such object");
		}
	}
	
	this.testbang = function(){
		this.send("test", "bang");
	}	
	/********************* Dealing with patches ************************/
	
	/** Parses a Pd file and creates a new DSP graph from it **/
	this.parse = function(txt) {
		// last table name to add samples to
		var lastTable = null;
		// use our regular expression to match instances of valid Pd lines
		while (pdline = lines_re.exec(txt)) {
			// split this found line into tokens (on space and line break)
			var tokens = pdline[1].split(/ |\r\n?|\n/);
			this.debug("" + tokens);
			// if we've found a create token
			if (tokens[0] == "#X") {
				// is this an obj instantiation
				if (tokens[1] == "obj" || tokens[1] == "msg") {
					var proto = "";
					// if this is a message object
					if (tokens[1] == "msg") {
						proto = "msg";
					}else if (tokens[1] == "text") {
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
					var obj = new PdObject(PdObjects[proto], this, proto, tokens);
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
					var obj = new PdObject(PdObjects["table"], this, "table", tokens);
					// put it in our graph of known objects
					obj.graphindex = this._graph.objects.length;
					this._graph.objects[obj.graphindex] = obj;
					this.debug("Added " + obj.type + " to the graph at position " + obj.graphindex);
					// this table needs a set of data
					obj.data = new this.arrayType(parseInt(tokens[3]));
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
	}
	
	/** Called when we receive the new patch from the network **/
	this.loadcomplete = function(result, request) {
		if (request.status == 404) {
			// TODO: file not found, tell the user
			this.log("No such file:", request.url);
		} else {
			this.parse(result);
		}
	}
	
	/******************** Internal methods ************************/
	
	/** adds a new named listener to our graph **/
	this.addlistener = function(name, who) {
		if (!this.listeners[name])
			this.listeners[name] = [];
		this.listeners[name][this.listeners[name].length] = who;
	}
	
	/** gets the absolute current logical elapsed time in milliseconds **/
	this.getabstime = function() {
		return this.frame * this.bufferSize / (this.sampleRate / 1000);
	}
	
	/** Schedule a callback at a particular time - milliseconds **/
	this.schedule = function(time, callback) {
		//var time = relativetime + this.getabstime();
		if (this.scheduled[time] == null)
			this.scheduled[time] = [];
		this.scheduled[time].push(callback);
		//this.log("schedule()");
		//this.log("\tcurrent time: " + this.getabstime());
		//this.log("\tall items scheduled: ");
		//this.log_allscheduled();
	}
	
	this.log_allscheduled = function() {
		for (var s in this.scheduled) {
			this.log("\t\t" + s + ": " + this.scheduled[s].length);
			/*for (var i=0; i<this.scheduled[s].length; i++) {
				this.log(this.scheduled[s][i]);
			}*/
		}
	}
	
	/** Gets a list of all currently scheduled callbacks **/
	this.getscheduled = function() {
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
	}
	
	/**
		Tokenizes a complex message with atoms, commas, and semicolons.
		Returns an array of arrays of strings. (array of lists of comma separated messages).
	 **/
	this.messagetokenizer = function(message) {
		var result = [];
		var messages = message.split(messages_re);
		for (var m=0; m<messages.length; m++) {
			var submessagelist = [];
			// TODO: replace $N with item N-1 from the incoming message
			var submessages = messages[m].split(parts_re);
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
	}
	
	/******************** DSP stuff ************************/
	
	// do we actually have audio access?
	var audioTest = new Audio();
	if (audioTest.mozSetup) {
		/** Checks if the hardware buffer is hungry for more **/
		this.hungry = function() {
			// are we a few buffers ahead?
			return this.lastWritePosition < this.el.mozCurrentSampleOffset() + this.sampleRate / 2;
		}
		
		/** Fills up the hardware buffer with the data from this.output **/
		this.fillbuffer = function(buffer) {
			// actually write the audio to the buffer
			var written = this.el.mozWriteAudio(buffer);
			if (written < buffer.length) {
				// copy the data from all endpoints into the audio output
				this.overflow = buffer.slice(written);
			} else {
				this.overflow.length = 0;
			}
			// update our last write position so we know where we're up to
			this.lastWritePosition += written;
			return this.overflow.length;
		}
	// if not just write the output frames to the console
	} else {
		var runs = 0;
		this.hungry = function() {
			this.debug("Frame: " + runs++);
			return runs < 5;
		}
		
		this.fillbuffer = function(buffer) {
			// non-audio version, output the frame as text
			this.log(buffer);
		}
	}
	delete audioTest;
	
	/** Run each frame - check and fill up the buffer, as needed **/
	this.write = function() {
		var count = 0;
		
		// while we still need to add more to the buffer, do it - should usually do about two loops
		while(this.hungry() && count < 100) {
			if (this.overflow.length) {
				this.fillbuffer(this.overflow);
			} else {
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
				for (var i=0; i<this.output.length; i++)
					this.output[i] = 0;
				// run the dsp function on all endpoints to get data
				for (var e in this._graph.endpoints) {
					// dac~ objects will add their output to this.output
					this.tick(this._graph.endpoints[e]);
				}
				// if we have some overflow, write that first
				this.fillbuffer(this.output);
				// check we haven't run a ridiculous number of times
				count++;
				// increase the frame count
				this.frame += 1;
			}
		}
		
		// things are not going well. stop the audio.
		if (count >= 100) {
			this.log("Overflowed 100 write() calls - your patch is probably too heavy.");
			this.stop();
		}
	}
	
	/** Dsp tick function run on an object which makes sure the object's parents all get run before running it. **/
	this.tick = function(obj) {
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
	}
	
	/** Starts this graph running **/
	this.play = function() {
		// check we're not already running
		if (this.interval == -1) {
			this.debug("Starting audio.");
			// set up our audio element
			this.el = new Audio();
			if (this.el.mozSetup) {
				// initialise our audio output element
				this.el.mozSetup(2, this.sampleRate, 1);
				// initial buffer fill
				this.write();
				// start a regular buffer fill
				this.interval = setInterval(function() { me.write(); }, Math.floor(this.bufferSize / this.sampleRate));
			} else {
				// generate a few test frames
				this.debug("Generating a few test frames of data:")
				this.write();
			}
			// reset the frame count
			this.frame = 0;
			// reset the frame count on all objects
			for (var o in this._graph.objects) {
				this._graph.objects[0].frame = 0;
			}
		} else {
			this.debug("Already started.");
		}
	}
	
	/** Stops this graph from running **/
	this.stop = function() {
		// if we're already running
		if (this.interval != -1) {
			this.debug("Stopping audio.");
			// clear the interval
			clearInterval(this.interval);
			// destroy the audio element
			this.el = null;
			this.interval = -1;
			// reset our counter
			this.lastWritePosition = 0;
  		} else {
			this.debug("Already stopped.");
		}
	}
	
	/******************** console/logging stuff ************************/
	
	/** log a message to console **/
	this.log = function(msg, debugconsole) {
		if (window.console) {
			console.log(msg);
		} else {
			// log manually in HTML
			var fakeconsole = document.getElementById(arguments.length == 2 ? "debug" : "console");
			if (fakeconsole) fakeconsole.innerHTML += msg + "\n";
		}
	}

	/** logs only when debugMode is set. **/
	this.debug = function(msg) {
		if (this.debugMode) {
			if (typeof(msg) == "string")
				this.log("debug: " + msg, 'debug');
			else
				this.log(msg, 'debug');
		}
	}
};
window.Pd = Pd;

/*******************************************************
	PdObject prototype, common to all Pd objects 
 *******************************************************/
var PdObject = function (proto, pd, type, args) {
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
				this.outletbuffer[o] = new this.pd.arrayType(this.pd.bufferSize);
			}
		}
	}
	
	/** Converts a Pd message to a float **/
	this.tofloat = function(data) {
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
	}
	
	/** Converts a Pd message to a symbol **/
	this.tosymbol = function(data) {
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
	}
	
	/** Convert a Pd message to a bang **/
	this.tobang = function(data) {
		return "bang";
	}
	
	/** Convert a Pd message to a javascript array **/
	this.toarray = function(msg) {
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
	}
	
	/** Sends a message to a particular outlet **/
	this.sendmessage = function(outletnum, msg) {
		if (this.outlets[outletnum]) {
			// propagate this message to my outlet
			this.outlets[outletnum][0].message(this.outlets[outletnum][1], msg);
		} else {
			// pd silently drops these messages into the ether
			this.pd.debug(this.type + ": No outlet #" + outletnum);
		}
	}
	
	/** Run after the graph is created to set up DSP inlets specially (accept floats if not dsp) **/
	this.setupdsp = function() {
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
}

/**********************************************************************************************
	This object contains a prototype for every type of Pd object implemented so far.
	
	properties:
		endpoint = set to true if this object is a dsp sink (e.g. [dac~], [outlet~], [print~]
		outletTypes = dsp/message
		dspinlets = which inlet numbers can do dsp
	
	methods:
		preinit = method which runs after object creation, but before the graph has been instantiated
		init = method which runs after the graph has been instantiated
		dsptick = method which runs every frame for this object
		message(inletnumber, message) = method which runs when this object receives a message at any inlet
 **********************************************************************************************/
var PdObjects = {
	// null placeholder object for PdObjects which don't exist
	"null": {
	},
	"cnv": {
	},
	
	/************************** Basic types objects ******************************/
	
	"table": {
		"init": function() {
			if (this.args.length >= 4) {
				this.name = this.args[2];
			}
			this.pd.debug(this.data);
		},
	},
	
	"float": {
		"outletTypes": ["message"],
		"init": function() {
			this.value = parseFloat(this.args[5]);
			if (isNaN(this.value))
				this.value = 0;
		},
		"message": function(inletnum, message) {
			if (inletnum == 0) {
				var atoms = this.toarray(message);
				var firstfloat = parseFloat(atoms[0]);
				// the float object outputs it's value if it gets a bang
				if (atoms[0] == "bang") {
					this.sendmessage(0, this.value);
				// if it gets some other symbol, throws an error
				} else if (isNaN(firstfloat)) {
					this.pd.log("error: float: no method for '" + atoms[0] + "'");
				// if it gets a new value then it sets and outputs that value
				} else {
					this.value = firstfloat;
					this.sendmessage(0, this.value);
				}
			} else {
				//inlet two sets the value
				var atoms = this.toarray(message);
				var firstfloat = parseFloat(atoms[0]);
				if(isNaN(firstfloat)){
					this.pd.log("error: float: right inlet no method for'" + atoms[0] + "'"); 
				} else{
					this.value = firstfloat;
				}	
			}
		}
	},
	
	// message objects like [hello $1(
	"msg": {
		"outletTypes": ["message"],
		"init": function() {
			// arguments set my value
			this.value = this.args.slice(4).join(" ");
		},
		"message": function(inletnum, message) {
			if (inletnum == 0) {
				// get our atoms
				var incoming = this.toarray(message);
				// turn our value into it's constituent messages and sub-messages
				var messages = this.pd.messagetokenizer(this.value);
				for (var m=0; m<messages.length; m++) {
					// comma separated submessages
					var submessages = messages[m];
					for (var o=0; o<submessages.length; o++) {
						// find all the dollarargs in this submessage
						var dollarargs = submessages[o].match(this.pd.dollarmatch);
						// this is the variable in which we'll replace all dollar args
						var sendme = submessages[o];
						// replace $N with item N-1 from the incoming message
						if (dollarargs) {
							for (var v=0; v<dollarargs.length; v++) {
								// which argument number are we looking for?
								var argnum = parseInt(dollarargs[v].replace(/\\{0,1}\$/, "")) - 1;
								if (incoming[argnum]) {
									// replace that argument with the same argument from the incoming message
									sendme = sendme.replace(dollarargs[v], incoming[argnum]);
								} else {
									// throws an error and replaces arg with zero
									this.pd.log("error: $" + (argnum + 1) + ": argument number out of range");
									sendme = sendme.replace(dollarargs[v], "0");
								}
							}
						}
						// if this is the first real message which comes in
						if (m == 0)
							this.sendmessage(0, sendme);
						// TODO: else inject other messages back into the graph based on first atom name
						// note: what happens to the second submessage -> [; this is a test, blah blah blah( ?
					}
				}
			}
		}
	},
	
	/************************** DSP objects ******************************/
	
	// basic oscillator
	"osc~": {
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"init": function() {
			if (this.args.length >= 6) {
				this.inletbuffer[0][0] = parseFloat(this.args[5]);
			}
			this.sampCount = 0;
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i<this.outletbuffer[0].length; i++) {
				this.outletbuffer[0][i] = Math.cos(2 * Math.PI * (this.sampCount));
				this.sampCount += i1[i % i1.length] / this.pd.sampleRate;
			}
		},
		"message": function(inlet, message) {
			if (inlet == 1) {
				// TODO: 2nd inlet receives phase message
			}
		}
	},
	
	// digital to analogue converter (sound output)
	"dac~": {
		"endpoint": true,
		"outletTypes": [],
		"dspinlets": [0, 1],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			var i2 = this.inletbuffer[1];
			// copy interleaved data from inlets to the graph's output buffer
			for (var i=0; i < this.pd.bufferSize; i++) {
				this.pd.output[i * 2] += i1[i % i1.length];
				this.pd.output[i * 2 + 1] += i2[i % i2.length];
			}
		},
	},
	
	// dsp multiply object
	"*~": {
		"outletTypes": ["dsp"],
		"dspinlets": [0, 1],
		"init": function() {
			// argument sets right inlet constant value
			if (this.args.length >= 6) {
				this.inletbuffer[1][0] = parseFloat(this.args[5]);
			}
		},
		"dsptick": function() {
			// mutiply our two buffers together
			var i1 = this.inletbuffer[0];
			var i2 = this.inletbuffer[1];
			for (var i=0; i < this.pd.bufferSize; i++) {
				this.outletbuffer[0][i] = i1[i % i1.length] * i2[i % i2.length];
			}
		},
	},
	
	// dsp divide object (d_arithmetic.c line 454 - over_perform() )
	"/~": {
		"outletTypes": ["dsp"],
		"dspinlets": [0, 1],
		"init": function() {
			// argument sets right inlet constant value
			if (this.args.length >= 6) {
				this.inletbuffer[1][0] = parseFloat(this.args[5]);
			}
		},
		"dsptick": function() {
			// mutiply our two buffers together
			var i1 = this.inletbuffer[0];
			var i2 = this.inletbuffer[1];
			var val2 = 0;
			for (var i=0; i < this.pd.bufferSize; i++) {
				// return zero if denominator is zero
				val2 = i2[i % i2.length];
				this.outletbuffer[0][i] = (val2 ? i1[i % i1.length] / val2 : 0);
			}
		},
	},
	
	// dsp addition object
	"+~": {
		"outletTypes": ["dsp"],
		"dspinlets": [0, 1],
		"init": function() {
			// argument sets right inlet constant value
			if (this.args.length >= 6) {
				this.inletbuffer[1][0] = parseFloat(this.args[5]);
			}
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			var i2 = this.inletbuffer[1];
			for (var i=0; i < this.pd.bufferSize; i++) {
				this.outletbuffer[0][i] = i1[i % i1.length] + i2[i % i2.length];
			}
		},
	},
	
	// dsp subtraction object
	"-~": {
		"outletTypes": ["dsp"],
		"dspinlets": [0, 1],
		"init": function() {
			// argument sets right inlet constant value
			if (this.args.length >= 6) {
				this.inletbuffer[1][0] = parseFloat(this.args[5]);
			}
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			var i2 = this.inletbuffer[1];
			for (var i=0; i < this.pd.bufferSize; i++) {
				this.outletbuffer[0][i] = i1[i % i1.length] - i2[i % i2.length];
			}
		},
	},
	
	// basic phasor (0 to 1)
	"phasor~": {
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"init": function() {
			// argument sets left inlet constant value
			if (this.args.length >= 6) {
				this.inletbuffer[0][0] = parseFloat(this.args[5]);
			}
			this.sampCount = 0;
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			// TODO: look this up in the Pd source and see if it behaves the same way on freq change
			for (var i=0; i<this.pd.bufferSize; i++) {
				this.outletbuffer[0][i] = this.sampCount;
				this.sampCount = (this.sampCount + (i1[i % i1.length] / this.pd.sampleRate)) % 1;
			}
		},
	},
	
	// midi to frequency in the dsp domain
	"mtof~": {
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i < this.pd.bufferSize; i++) {
				var f = i1[i % i1.length];
				if (f <= -1500) {
					this.outletbuffer[0][i] = 0;
				} else {
					if (f > 1499) {
						f = 1499;
					}
					this.outletbuffer[0][i] = 8.17579891564 * Math.exp(.0577622650 * f);
				}
			}
		}
	},
	
	//frequency to midi in the dsp domain
	"ftom~": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"Converts frequency to midi pitch values.",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i < this.pd.bufferSize; i++) {
				var f = i1[i % i1.length];
					this.outletbuffer[0][i] = (f > 0 ? (17.3123405046 * Math.log(.12231220585 * f)) : -1500);
			}
		},
	},
	
	// read data from a table with no interpolation
	"tabread~": {
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"init": function() {
			// argument sets the name of the table to read from
			if (this.args.length >= 6) {
				this.table = this.pd.tables[this.args[5]];
			}
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			var length = this.table.data.length;
			for (var i=0; i<this.pd.bufferSize; i++) {
				//this.outletbuffer[0][i] = this.table.data[Math.min(length - 1, Math.max(0, Math.round(i1[i % i1.length])))];
				//Not sure if this is faster -bj
				var s = Math.floor(i1[i % i1.length])
				this.outletbuffer[0][i] = this.table.data[(s >= 0 ? (s > (length - 1) ? (length -1) : s) : 0)];
			}
		},
	},
	
	// creates simple dsp lines
	"line~": {
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"init": function() {
			// what the value was at the start of the line
			this.startval = 0;
			// sample index where the line started
			this.start = 0;
			// the destination value we are aiming for
			this.destination = 0;
			// this stores the length of this line in samples
			this.length = 0;
			// this stores our constant current value
			this.line = 0;
			// we want to use the dsptick method that returns a constant value for now
			this.dsptick = this.dsptick_const;
		},
		"dsptick_const": function() {
			// write a constant value to our output buffer for every sample
			for (var i=0; i<this.pd.bufferSize; i++) {
				this.outletbuffer[0][i] = this.line;
			}
		},
		"dsptick_line": function() {
			// write this correct value of the line at each sample
			for (var i=0; i<this.pd.bufferSize; i++) {
				// how far along the line we are
				var sample = (this.pd.frame * this.pd.bufferSize + i) - this.start;
				// if we've reached the end of our line, switch back to the constant method
				if (sample >= this.length) {
					// bash our value to the desired destination value
					this.line = this.destination;
					// switch back to the constant output method
					this.dsptick = this.dsptick_const;
				// otherwise calculate the new line value
				} else {
					// how far down the line are we
					var timefraction = sample / this.length;
					// use that fraction to calculate the height
					this.line = (sample / this.length) * (this.destination - this.startval) + this.startval;
				}
				this.outletbuffer[0][i] = this.line;
			}
		},
		"message": function(inletnum, message) {
			if (inletnum == 0) {
				// get the individual pieces of the passed-in message
				var parts = this.toarray(message);
				// if this is a single valued message we want line~ to output a constant value
				if (parts.length == 1) {
					// get the value out of the message
					var newconst = parseFloat(parts[0]);
					// make sure the value is not bogus (do nothing if it is)
					if (!isNaN(newconst)) {
						// bash our value to the value passed in
						this.line = newconst;
						// set our dsptick function to be the one which sends a constant
						this.dsptick = this.dsptick_const;
					}
				} else {
					// get the destination value out of the first part of the message
					var destination = parseFloat(parts[0]);
					// get the length of this line in milliseconds
					var time = parseFloat(parts[1]);
					// make sure these values are not bogus
					if (!isNaN(destination) && !isNaN(time)) {
						// what sample do we start at - current frame
						this.start = this.pd.frame * this.pd.bufferSize;
						// the value at the starting sample of the line
						this.startval = this.line;
						// remember our destination
						this.destination = destination;
						// remember our length in samples
						this.length = time * this.pd.sampleRate / 1000;
						// switch over to the line dsp method
						this.dsptick = this.dsptick_line;
					}
				}
			}
		},
	},
	
	// dsp cosine
	"cos~": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"Returns the cosine of the input.",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i<this.outletbuffer[0].length; i++) {
				this.outletbuffer[0][i] = Math.cos(2 * Math.PI * (i1[i % i1.length]));
			}
		},
	},
	
	//dsp absolute value
	"abs~": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"Returns the absolute value of the input.",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i < this.pd.bufferSize; i++) {
				var f = i1[i % i1.length];
				this.outletbuffer[0][i] = (f >= 0 ? f : -f);
			}
		},
	},
	
	// dsp wrap
	"wrap~": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"Wraps a signal value between 0 and 1.",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i<this.outletbuffer[0].length; i++) {
				f = i1[i % i1.length];
				k = Math.floor(f);
				this.outletbuffer[0][i] = f - k;
			}
		},
	},
	
	// convert float to signal
	"sig~": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"Convert a float to a signal.",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"init": function() {
			// argument sets constant value
			if (this.args.length >= 6) {
				this.sig = parseFloat(this.args[5]);
			}
		},
		"dsptick": function() {
			// write a constant value to our output buffer for every sample
			for (var i=0; i<this.pd.bufferSize; i++) {
				this.outletbuffer[0][i] = this.sig;
			}
		},
		
		"message": function(inletnum, message) {
			// get the individual pieces of the passed-in message
			var parts = this.toarray(message);
			// get the value out of the message
			var newconst = parseFloat(parts[0]);
			// make sure the value is not bogus 
			if (!isNaN(newconst)) {
				this.sig = newconst;
			} else {
				this.pd.log("error: sig~: no method for '" + atoms[0] + "'");
			}	
		},
	},
	
	// dsp maximum object
	"max~": {
		"defaultinlets":2,
		"defaultoutlets":1,
		"description":"Outputs the greater of two signals.",
		"outletTypes": ["dsp"],
		"dspinlets": [0, 1],
		"init": function() {
			// argument sets right inlet constant value
			if (this.args.length >= 6) {
				this.inletbuffer[1][0] = parseFloat(this.args[5]);
			}
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			var i2 = this.inletbuffer[1];
			for (var i=0; i < this.pd.bufferSize; i++) {
				this.outletbuffer[0][i] = (i1[i % i1.length] > i2[i % i2.length] ? i1[i % i1.length] : i2[i % i2.length]);
			}
		},
	},
	
	// dsp minimum object
	"min~": {
		"defaultinlets":2,
		"defaultoutlets":1,
		"description":"Outputs the lesser of two signals.",
		"outletTypes": ["dsp"],
		"dspinlets": [0, 1],
		"init": function() {
			// argument sets right inlet constant value
			if (this.args.length >= 6) {
				this.inletbuffer[1][0] = parseFloat(this.args[5]);
			}
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			var i2 = this.inletbuffer[1];
			for (var i=0; i < this.pd.bufferSize; i++) {
				this.outletbuffer[0][i] = (i1[i % i1.length] < i2[i % i2.length] ? i1[i % i1.length] : i2[i % i2.length]);
			}
		},
	},
	
	// dsp clip object
	"clip~": {
		"defaultinlets":3,
		"defaultoutlets":1,
		"description":"Clips a signal to a range.",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"init": function() {
			// argument sets constant value
			if (this.args.length >= 7) {
				this.low = parseFloat(this.args[5]);
				this.hi = parseFloat(this.args[6]);
			}
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i < this.pd.bufferSize; i++) {
				var f = i1[i % i1.length];
				//var low = this.low;
				//var hi = this.hi;
				var out = f;
				if (f<this.low){
					out = this.low;
				} else if (f>this.hi){
					  out = this.hi;
				} else {
					  out = f;
				}	
				this.outletbuffer[0][i] = out;
			}
		},
		
		"message": function(inletnum, message) {
			if (inletnum == 1) {
				// get the individual pieces of the passed-in message
				var partslow = this.toarray(message);
				// if this is a single valued message we want to output a constant value
				if (partslow.length >= 1) {
					// get the value out of the message
					var newlow = parseFloat(partslow[0]);
					var newhi = parseFloat(partslow[1]);
					// make sure the value is not bogus
					if (!isNaN(newlow)) {
						this.low = newlow;
					} else {
						this.pd.log("error: clip~: no method for '" + partslow[0] + "'");
					}	
					if(!inNaN(newhi)){
						this.hi = newhi;
					} else {
 						this.pd.log("error: sig~: no method for '" + partslow[1] + "'");
					}	
				} else if (inletnum == 2) {
					// get the individual pieces of the passed-in message
					var partshi = this.toarray(message);
					// get the value out of the message
					var newhi = parseFloat(partshi[0]);
					// make sure the value is not bogus
					if (!isNaN(newhi)) {
		  				// bash our value to the value passed in
						this.hi = newhi;
					} else {
 						this.pd.log("error: sig~: no method for '" + partshi[0] + "'");
					}	
				}
			}
		},
	},
	 
	 //  dsp exp object -- e to the power of input
	"exp~": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"Returns e to the power of input.",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i < this.pd.bufferSize; i++) {
				this.outletbuffer[0][i] = Math.exp(i1[i % i1.length]);
			}
		},
	},

	// dsp power object
	"pow~": {
		"outletTypes": ["dsp"],
		"dspinlets": [0, 1],
		"init": function() {
			// argument sets right inlet constant value
			// PD does not actually support an argument for [pow~]
			// but it's helpfile says it does, so I left it in. --bj
			if (this.args.length >= 6) {
				this.inletbuffer[1][0] = parseFloat(this.args[5]);
			}
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			var i2 = this.inletbuffer[1];
			for (var i=0; i < this.pd.bufferSize; i++) {
				var f = i1[i % i1.length];
				var g = i2[i % i2.length];
				if (f > 0) {
					this.outletbuffer[0][i] = Math.pow(f, g);
					} else {
					this.outletbuffer[0][i] = 0;
					}
			}
		},
	},
	
	// dsp log e
	"log~": {
		"defaultinlets":2,
		"defaultoutlets":1,
		"description":"computes the logarithm of the left inlet, to the base 'e' (about 2.718), or to another base specified by the inlet or a cration argument.",
		"outletTypes": ["dsp"],
		"dspinlets": [0, 1],
		"init": function() {
			// argument sets right inlet constant value
			// PD does not actually support an argument for [log~]
			// but it's helpfile says it does, so I left it in. --bj
			if (this.args.length >= 6) {
				this.inletbuffer[1][0] = parseFloat(this.args[5]);
			}
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			var i2 = this.inletbuffer[1];
			for (var i=0; i < this.pd.bufferSize; i++) {
				var f = i1[i % i1.length];
				var g = i2[i % i2.length];
				if (f <= 0) {
					//rather than blow up, output a number
					this.outletbuffer[0][i] = -1000;
					} else if (g <= 0) {
						this.outletbuffer[0][i] = Math.log(f);
					} else {
						this.outletbuffer[0][i] = (Math.log(f) / Math.log(g));
					}	
			}
		},
	},
	
	// dsp convert db to pow
	"dbtopow~": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"Convert db to power. 100db = 1 Power",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i < this.pd.bufferSize; i++) {
				var f = i1[i % i1.length];
				if (f <= 0) {
					this.outletbuffer[0][i] = 0;
				} else {
					if (f > 870) {
						f = 870;
					}
					this.outletbuffer[0][i] = Math.exp(0.2302585092994 * (f-100));
				}
			}
		},
	},
	
	// dsp convert pow to db
	"powtodb~": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"Convert power to db. 100db = 1 Power",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i < this.pd.bufferSize; i++) {
				var f = i1[i % i1.length];
				if (f <= 0) {
					this.outletbuffer[0][i] = 0;
				} else {
					var g = 100 + (4.3429448190326 * Math.log(f));
					this.outletbuffer[0][i] = (g < 0 ? 0 : g);
				}
			}
		},
	},
	
	// dsp convert db to rms
	"dbtorms~": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"Convert db to rms.",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i < this.pd.bufferSize; i++) {
				var f = i1[i % i1.length];
				if (f <= 0) {
					this.outletbuffer[0][i] = 0;
				} else {
					if (f > 485) {
						f = 485;
					}
					this.outletbuffer[0][i] = Math.exp(0.1151292546497 * (f - 100));
				}
			}
		},
	},
	
	// dsp convert rms to db
	"rmstodb~": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"Convert rms to db.",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i < this.pd.bufferSize; i++) {
				var f = i1[i % i1.length];
				if (f <= 0) {
					this.outletbuffer[0][i] = 0;
				} else {
					g = 100 + (8.6858896380652 * Math.log(f));
					this.outletbuffer[0][i] = (g < 0 ? 0 : g);
				}
			}
		},
	},
	
	// generate noise from -1 to 1
	"noise~":{
		//TODO: convert to actual algorithm that Pure Data uses	
		"defaultinlets":0,
		"defaultoutlets":1,
		"description":"White noise.",
		"outletTypes": ["dsp"],
		"dspinlets": [],
		"dsptick": function() {
			for (var i=0; i<this.outletbuffer[0].length; i++) {
				this.outletbuffer[0][i] = ((2 * Math.random()) - 1);
			}
		},
	},
	
	
	//  dsp sample and hold (triggered by a decrease in value)
	"samphold~": {
		"defaultinlets":2,
		"defaultoutlets":1,
		"description":"Sample left inlet when right inlet decreases in value.",
		"init": function() {
			this.lastin = 0;
			this.lastout = 0;
		},	
		"outletTypes": ["dsp"],
		"dspinlets": [0, 1],
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			var i2 = this.inletbuffer[1];
			for (var i=0; i < this.pd.bufferSize; i++) {
			   var f = i1[i % i1.length];
			   var g = i2[i % i2.length];
			   if (g < this.lastin) {
				   var out = f;
				   this.lastout = out;
				} else {
				   var out = this.lastout;
				}   
			   this.outletbuffer[0][i] = out;
			   this.lastin = g;
			}
		},
	},
	

	// 1-pole 1-zero hipass filter
	"hip~": {
		"defaultinlets":2,
		"defaultoutlets":1,
		"description":"1-pole 1-zero hipass filter",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"init": function() {
			// argument sets right inlet constant value
			this.last = 0;
			if (this.args.length >= 6) {
				this.hz = parseFloat(this.args[5]);
				var f = this.hz
				f = (f > 0 ? f : 0);
				this.coef = (1 - (f * ((2 * Math.PI) / this.pd.sampleRate)));
				if (this.coef < 0) {
					this.coef = 0;
				} else if (this.coef > 1) {
					this.coef = 1;
				}					
			}
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i < this.pd.bufferSize; i++) {
				if (this.coef < 1) {
						var next = (i1[i % i1.length]) + ((this.coef) * (this.last));
						this.outletbuffer[0][i] = (next - this.last);
						this.last = next;
			 		if (this.last < .00000000001) {
						this.last = 0;
					}
				} else {
					this.outletbuffer[0][i] = i1[i % i1.length];
					this.last = 0;
					}
			}
		},	
		"message": function(inletnum, message) {
			if (inletnum == 0) {
				var parts1 = this.toarray(message);
				if (parts1[0] == "clear"){
				 this.last = 0;   
				}
			}	
				
			if (inletnum == 1) {
				// get the individual pieces of the passed-in message
				var parts = this.toarray(message);
				// check for single value
				if (parts.length == 1) {
					// get the value out of the message
					var newconst = parseFloat(parts[0]);
					// make sure the value is not bogus (do nothing if it is)
					if (!isNaN(newconst)) {
						// bash our value to the value passed in
						var f = newconst;
						f = (f > 0 ? f : 0);
						this.coef = (1 - (f * ((2 * 3.14159) / this.pd.sampleRate)));
						if (this.coef < 0) {
							this.coef = 0;
						} else if (this.coef > 1) {
							this.coef = 1;
						}	
					}
				}
			}	
		},
	},	
				
	// 1-pole 1-zero lopass filter
	"lop~": {
		"defaultinlets":2,
		"defaultoutlets":1,
		"description":"1-pole 1-zero lopass filter",
		"outletTypes": ["dsp"],
		"dspinlets": [0],
		"init": function() {
			// argument sets right inlet constant value
			this.last = 0;
			if (this.args.length >= 6) {
				this.hz = parseFloat(this.args[5]);
				var f = this.hz
				f = (f > 0 ? f : 0);
				this.coef = (f * (2 * Math.PI) / this.pd.sampleRate);
				if (this.coef < 0) {
					this.coef = 0;
				} else if (this.coef > 1) {
					this.coef = 1;
				}					
			}
		},
		"dsptick": function() {
			var i1 = this.inletbuffer[0];
			for (var i=0; i < this.pd.bufferSize; i++) {
				var output = ((this.coef * i1[i % i1.length]) + ((1-this.coef) * this.last));
				this.outletbuffer[0][i] = output;
				this.last = output;
				if (this.last < .00000000001) {
					this.last = 0;
				}
			}
		},	
		"message": function(inletnum, message) {
			if (inletnum == 0) {
				var parts1 = this.toarray(message);
				if (parts1[0] == "clear"){
				 this.last = 0;   
				}
			}	
				
			if (inletnum == 1) {
				// get the individual pieces of the passed-in message
				var parts = this.toarray(message);
				// check for single value
				if (parts.length == 1) {
					// get the value out of the message
					var newconst = parseFloat(parts[0]);
					// make sure the value is not bogus (do nothing if it is)
					if (!isNaN(newconst)) {
						// bash our value to the value passed in
						var f = newconst;
						f = (f > 0 ? f : 0);
						this.coef = (f * ((2 * 3.14159) / this.pd.sampleRate));
						if (this.coef < 0) {
							this.coef = 0;
						} else if (this.coef > 1) {
							this.coef = 1;
						}	
					}
				}
			}	
		},
	},	
	
		
	/************************** Non-DSP objects ******************************/
	
	// ordinary message receiver
	"receive": {
		"outletTypes": ["message"],
		"init": function() {
			// listen out for messages from the either with the name of our argument
			if (this.args.length >= 6) {
				this.pd.addlistener(this.args[5], this);
			}
		},
		"message": function(inletnum, val) {
			// if we have received a message from the ether, send it to the listeners at our outlet
			if (inletnum == -1)
				this.sendmessage(0, val);
		},
	},
	
	// pd trigger type - right to left
	"trigger": {
		"outletTypes": [],
		"preinit": function() {
			this.triggers = this.args.slice(5);
			for (var t=0; t<this.triggers.length; t++)
				this.outletTypes.push("message");
		},
		"message": function(inletnum, message) {
			for (var t=0; t<this.triggers.length; t++) {
				var triggerindex = this.triggers.length - t - 1
				var out = message;
				// convert our message to it's correct type
				if (this.triggers[triggerindex] == "f")
					out = this.tofloat(message);
				else if (this.triggers[triggerindex] == "s")
					out = this.tosymbol(message);
				else if (this.triggers[triggerindex] == "b")
					out = this.tobang(message);
				// if we didn't get an empty string back
				if (out !== "") {
					this.sendmessage(triggerindex, out);
				}
			}
		}
	},
	
	// packs various incoming things into a list
	"pack": {
		"outletTypes": ["message"],
		"init": function() {
			this.slots = this.args.slice(5);
			this.slottypes = [];
			this.vals = [];
			for (var t=0; t<this.slots.length; t++) {
				// check if it's s or f
				var num = parseFloat(this.slots[t]);
				if (this.slots[t] == "f" || !isNaN(num)) {
					this.slottypes.push("f");
					this.vals.push(isNaN(num) ? 0 : num);
				} else if (this.slots[t] == "s") {
					this.slottypes.push("s");
					this.vals.push("symbol");
				// if it's neither
				} else {
					// throw an error
					this.pd.log("error: pack: " + this.slots[t] + ": bad type");
					// make it a float
					this.slottypes.push("f");
					this.vals.push(isNaN(num) ? 0 : num);
				}
			}
		},
		"message": function(inletnum, message) {
			// break up the incoming message into atoms
			var parts = this.toarray(message);
			// grab a float version of the current inlet item
			var newnum = parseFloat(parts[0]);
			// has an error been thrown on this recursion
			var errorthrow = false;
			// this is just a normal single message
			if (parts.length == 1) {
				// if we're looking for a float
				if (this.slottypes[inletnum] == "f") {
					// if it's not a float but we're looking for one, throw an error
					if (isNaN(newnum)) {
						// inlet zero error is handled differently in Pd because of accepting type of any
						if (inletnum)
							this.pd.log("error: inlet: expected 'float' but got 'symbol'");	
						else
							this.pd.log("error: pack_symbol: wrong type");
						errorthrow = true;
					} else {
						// we found a float, set our output vals to that
						this.vals[inletnum] = newnum;
					}
				// if we're looking for a symbol
				} else {
					// we didn't find a symbol
					if (!isNaN(newnum)) {
						// inlet zero error is handled differently in Pd because of accepting type of any
						if (inletnum)
							this.pd.log("error: inlet: expected 'symbol' but got 'float'");
						else
							this.pd.log("error: pack_float: wrong type");
						errorthrow = true;
					} else {
						// we found a symbol, set our output vals to that
						this.vals[inletnum] = parts[0];
					}
				}
				// if it's our leftmost outlet, send the output
				if (inletnum == 0 && !errorthrow) {
					// finally send our value to the output
					this.sendmessage(0, "list " + this.vals.join(" "));
				}
			} else {
				// if we've been passed a list, split it up and send it through each inlet
				for (var i=0; i<parts.length; i++) {
					this.message(parts.length - i - 1, parts[parts.length - i - 1]);
				}
			}
		},
	},
	
	// unpacks a list of atoms to their correct types
	"unpack": {
		"outletTypes": [],
		"preinit": function() {
			this.slots = this.args.slice(5);
			this.slottypes = [];
			for (var t=0; t<this.slots.length; t++) {
				// check if it's s or f
				if (this.slots[t] == "f" || !isNaN(parseFloat(this.slots[t]))) {
					this.outletTypes.push("message");
					this.slottypes.push("f");
				} else if (this.slots[t] == "s") {
					this.outletTypes.push("message");
					this.slottypes.push("s");
				// if it's neither
				} else {
					// throw an error
					this.pd.log("error: unpack: " + this.slots[t] + ": bad type");
					// make it a float
					this.outletTypes.push("message");
					this.slottypes.push("f");
				}
			}
		},
		"message": function(inletnum, message) {
			// break up our message into atoms
			var parts = this.toarray(message);
			for (var t=0; t<parts.length; t++) {
				// loop through all slots for which we know the type
				var slotindex = parts.length - t - 1
				// what kind of slot is this?
				if (this.slottypes[slotindex] == "f") {
					// this is a float emitting slot
					var out = parseFloat(parts[slotindex]);
					if (isNaN(out)) {
						this.pd.log("error: unpack: type mismatch");
						out = "";
					}
				} else {
					// if it's a number throw an error
					if (!isNaN(parseFloat(parts[slotindex]))) {
						this.pd.log("error: unpack: type mismatch");
						out = "";
					} else {
						// this is a symbol emitting slot
						out = "symbol " + parts[slotindex];
					}
				}
				// if we have something valid, send it
				if (out !== "") {
					this.sendmessage(slotindex, out);
				}
			}
		}
	},
	
	
	
	// multiply two numbers together
	"*": {
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.multiplier = parseFloat(this.args[5]);
			} else {
				this.multiplier = 0;
			}
		},
		"message": function(inletnum, val) {
			// right inlet changes value
			if (inletnum == 1) {
				var multiplier = parseFloat(val);
				// if this is a valid number, set our multiplier
				if (isNaN(multiplier)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					this.multiplier = multiplier;
				}
			// left inlet outputs the multiplication
			} else if (inletnum == 0) {
				var parts = this.toarray(val);
				var mul = parseFloat(parts[0]);
				// use the second number to set the multiplier
				if (parts.length > 1 && !isNaN(mul)) {
					// if it's a valid number send to the second outlet
					this.message(1, parts[1]);
				}
				// if it's a valid float, use it to output a multiplication
				if (isNaN(mul)) {
					this.pd.log("error: *: no method for '" + parts[0] + "'");
				} else {
					this.sendmessage(0, mul * this.multiplier);
				}
			}
		},
	},
	
	// divide two numbers 
	"/": {
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.divisor = parseFloat(this.args[5]);
			} else {
				this.divisor = 0;
			}
		},
		"message": function(inletnum, val) {
			// right inlet changes value
			if (inletnum == 1) {
				var divisor = parseFloat(val);
				// if this is a valid number, set our divisor
				if (isNaN(divisor)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					this.divisor = divisor;
				}
			// left inlet outputs the division
			} else if (inletnum == 0) {
				var parts = this.toarray(val);
				var div = parseFloat(parts[0]);
				// use the second number to set the divisor
				if (parts.length > 1 && !isNaN(div)) {
					// if it's a valid number send to the second outlet
					this.message(1, parts[1]);
				}
				// if it's a valid float, use it to output a division
				if (isNaN(div)) {
					this.pd.log("error: /: no method for '" + parts[0] + "'");
				} else {
					var result = (this.divisor ? (div/this.divisor) : 0);
					this.sendmessage(0, result);
				}
			}
		},
	},
	
	//integer divide two numbers 
	"div": {
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.n2 = parseFloat(this.args[5]);
			} else {
				this.n2 = 1;
			}
		},
		"message": function(inletnum, val) {
			// right inlet changes value
			if (inletnum == 1) {
				var n2 = parseFloat(val);
				if (isNaN(n2)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					n2 = (n2 ? n2 : 1);
					n2 = (n2<0 ? -n2 : n2);//abs value
					this.n2 = n2;
				}
			} else if (inletnum == 0) {
				var parts = this.toarray(val);
				// use the second number to set the n2
				if (parts.length > 1 && !isNaN(n1)) {
					var n2 = parseFloat(parts[1]);
					n2 = (n2 ? n2 : 1);
					n2 = (n2<0 ? -n2 : n2);
					this.n2 = n2;
				}
				var n1 = parseFloat(parts[0]);
				if (isNaN(n1)) {
					this.pd.log("error: div: no method for '" + parts[0] + "'");
				} 
				else {
					if(n1<0){
						n1 -= (this.n2-1);
					}
					var result = n1/this.n2;
					if(result<0){
						result=Math.ceil(result);
					}
					else{
						result=Math.floor(result);
					}
					this.sendmessage(0, result);
				}
			}
		},
	},
	
	//integer modulo
	"mod": {
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.divisor = parseFloat(this.args[5]);
			} else {
				this.divisor = 0;
			}
		},
		"message": function(inletnum, val) {
			// right inlet changes value
			if (inletnum == 1) {
				var divisor = parseFloat(val);
				// if this is a valid number, set our divisor
				if (isNaN(divisor)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					divisor = (divisor ? divisor : 1);//avoid div by 0
					divisor = (divisor<0 ? -divisor : divisor);//abs value
					this.divisor = divisor;
				}
			// left inlet outputs the division
			} else if (inletnum == 0) {
				var parts = this.toarray(val);
				// use the second number to set the divisor
				if (parts.length > 1 && !isNaN(div)) {
					var divisor = parseFloat(parts[1]);
					divisor = (divisor ? divisor : 1);
					divisor = (divisor<0 ? -divisor : divisor);
					this.divisor = divisor;
				}
				var div = parseFloat(parts[0]);
				// if it's a valid float, use it to output a division
				if (isNaN(div)) {
					this.pd.log("error: mod: no method for '" + parts[0] + "'");
				} else {
					var result = div % this.divisor;
					if(result<0){
						result=Math.ceil(result);
					}
					else{
						result=Math.floor(result);
					}
					if(result<0){
						result += this.divisor;
					}
					this.sendmessage(0, result);
				}
			}
		},
	},
	
	//raise left to right power
	"pow": {
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.addition = parseFloat(this.args[5]);
			} else {
				this.addition = 0;
			}
		},
		"message": function(inletnum, val) {
			// right inlet changes value
			if (inletnum == 1) {
				var addto = parseFloat(val);
				// if this is a valid number, set our addto
				if (isNaN(addto)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					this.addition = addto;
				}
			// left inlet outputs the multiplication
			} else if (inletnum == 0) {
				// we may have more than one number coming in
				var parts = this.toarray(val);
				// extract the first number
				var add = parseFloat(parts[0]);
				// use the second number to set the multiplier
				if (parts.length > 1 && !isNaN(add)) {
					// if it's a valid number send to the second outlet
					this.message(1, parts[1]);
				}
				// if it's a valid float, use it to output a multiplication
				if (isNaN(add)) {
					this.pd.log("error: +: no method for '" + parts[0] + "'");
				} else {
					if(add<0){
						var out = 0;
					}
					else{
						var out = Math.pow(add,this.addition);
					}
					out = out<0 ? 0 : out;
					this.sendmessage(0, out);
				}
			}
		},
	},
	
	// add two numbers together
	"+": {
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.addition = parseFloat(this.args[5]);
			} else {
				this.addition = 0;
			}
		},
		"message": function(inletnum, val) {
			// right inlet changes value
			if (inletnum == 1) {
				var addto = parseFloat(val);
				// if this is a valid number, set our addto
				if (isNaN(addto)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					this.addition = addto;
				}
			// left inlet outputs the multiplication
			} else if (inletnum == 0) {
				// we may have more than one number coming in
				var parts = this.toarray(val);
				// extract the first number
				var add = parseFloat(parts[0]);
				// use the second number to set the multiplier
				if (parts.length > 1 && !isNaN(add)) {
					// if it's a valid number send to the second outlet
					this.message(1, parts[1]);
				}
				// if it's a valid float, use it to output a multiplication
				if (isNaN(add)) {
					this.pd.log("error: +: no method for '" + parts[0] + "'");
				} else {
					this.sendmessage(0, add + this.addition);
				}
			}
		},
	},
	
	// subtract two numbers 
	"-": {
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.subtraction = parseFloat(this.args[5]);
			} else {
				this.subtraction = 0;
			}
		},
		"message": function(inletnum, val) {
			// right inlet changes value
			if (inletnum == 1) {
				var subtract = parseFloat(val);
				// if this is a valid number, set our subtract
				if (isNaN(subtract)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					this.subtraction = subtract;
				}
			// left inlet outputs the subtraction
			} else if (inletnum == 0) {
				// we may have more than one number coming in
				var parts = this.toarray(val);
				// extract the first number
				var subt = parseFloat(parts[0]);
				// use the second number to set the subtractor
				if (parts.length > 1 && !isNaN(subt)) {
					// if it's a valid number send to the second outlet
					this.message(1, parts[1]);
				}
				// if it's a valid float, use it to output a subtraction
				if (isNaN(subt)) {
					this.pd.log("error: -: no method for '" + parts[0] + "'");
				} else {
					this.sendmessage(0, subt - this.subtraction);
				}
			}
		},
	},
	
	// loadbang (on launch it sends a bang)
	"loadbang": {
		"outletTypes": ["message"],
		"init": function() {
			var me = this;
			this.pd.schedule(0, function() {
				me.sendmessage(0, "bang");
			});
		},
	},
	
	// print objects
	"print": {
		"init": function() {
			// listen out for messages from the either with the name of our argument
			if (this.args.length >= 6) {
				this.printname = this.args[5];
			} else {
				this.printname = "print"
			}
		},
		"message": function(inletnum, message) {
			this.pd.log(this.printname + ": " + message);
		},
	},

	//bang on a conditional match
	"select":{
		"outletTypes": [],
		"preinit": function() {
			this.matches = this.args.slice(5);
			for (var m=0; m<=this.matches.length; m++){
				this.outletTypes.push("message");
			}	
		},
		"message": function(inletnum, message) {
			// right inlet changes match values
			if (inletnum == 1) {
				this.matches=message.split(' ');
			}
			if(inletnum == 0){
				var hits=0;
				for (var m=0; m<this.matches.length; m++) {
					var matchesindex = (this.matches.length - m - 1);
					if (this.matches[matchesindex] == message){
						hits++;
						this.sendmessage(matchesindex, "bang");
					}	
				} 
				if(hits==0){
					this.sendmessage((this.matches.length), message);
				}	
			}
		},
	},
	
	//route on a conditional match
	"route":{
		"outletTypes": [],
		"preinit": function() {
			this.matches = this.args.slice(5);
			for (var m=0; m<=this.matches.length; m++){
				this.outletTypes.push("message");
			}	
		},
		"message": function(inletnum, message) {
			// right inlet changes match values
			if (inletnum == 1) {
				this.matches=message.split(' ');
			}
			if(inletnum == 0){				
				var hits=0;
				// break up our message into atoms
				var parts = this.toarray(message);
				for (var m=0; m<this.matches.length; m++) {
					var matchesindex = (this.matches.length - m - 1);
					if (this.matches[matchesindex] == message){
						if(parts.length>1){
							var out=this.parts.slice(1);
						}
						else{
							var out="bang";
						}	
						hits++;
						this.sendmessage(matchesindex, out);
					}	
				} 
				if(hits==0){
					this.sendmessage((this.matches.length), message);
				}	
			}
		},
	},
	
	//switch object
	"spigot": {
		"defaultinlets":2,
			"defaultoutlets":1,
			"description":"open and close a switch",
		"outletTypes": ["message"],
		"init": function() {
		
		// do i have a numeric argument
			if (this.args.length >= 6) {
					var tmp= parseInt(this.args[5]);
					if(parseInt(this.args[5]) && this.args[5]!=0){this.state = 1;			
			} else {
				this.state=0;
			}
			}
		},
		"message": function(inletnum, message) {
		
		if (inletnum == 0 && this.state!=0) {	//if its open, just send the message	
			this.sendmessage(0, message);
			}
		
		if (inletnum == 1) {//set states
		var state=parseFloat(message);
		 if(!isNaN(state)){ //is a valid float			
			if(state==0){
				this.state=0;
			}else{ //non-zero
				this.state=1;
			 }
			}			
			else{//it doesn't like bangs, etc
			this.pd.log("error: inlet: expected float but got '" + message + "'");
			}
			 
			   }
		}	
			
		},
		
	//generate a random number
	"random": {
		"defaultinlets":2,
		"defaultoutlets":1,
		"description":"generate a random number",
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.max = parseFloat(this.args[5]);
			} else {
				this.max = 1;
			}
		},
		"message": function(inletnum, val) {
			// right inlet changes value
			if (inletnum == 1) {
				var max = parseFloat(val);
				// if this is a valid number, set our max
				if (isNaN(max)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					this.max = max;
				}
			// left inlet outputs the random number
			} 
			else if (inletnum == 0) {
				var randomnum=Math.floor(Math.random()*this.max)
				this.sendmessage(0, randomnum);
			}
		},
	},
	
	"metro": {
		"defaultinlet": 2,
		"defaultoutlets": 1,
		"description": "bangs with regularity",
		"outletTypes": ["message"],
		"init": function() {
			// initialise the default delay time of this metro to one millisecond
			this.deltime = parseFloat(this.args[5]);
			if (isNaN(this.deltime))
				this.deltime = 1;
			// metro defaults to off
			this.state = 0;
			// closure to allow the anonymous function access to this
			var me = this;
			// the callback which will fire each tick
			this.metrotick = function(triggertime) {
				if (me.state) {
					// send a bang now that we've been called
					me.sendmessage(0, "bang");
					// delay time is only actually updated at each metro tick
					me.pd.schedule(triggertime + me.deltime, me.metrotick);
				}
			}
		},
		"message": function(inletnum, message) {
			var atoms = this.toarray(message);
			var firstint = parseInt(atoms[0]);
			// if we get an on/off message from the left inlet
			if (inletnum == 0) {
				if (atoms[0] == "bang" || firstint == 1) {
					// turn on this metro
					this.state = 1;
					// every time the metro is started it sends an initial bang
					this.pd.schedule(this.pd.getabstime(), this.metrotick);
				} else if (atoms[0] == "stop" || firstint == 0) {
					// stop the metro from sending anything next tick around
					this.state = 0;
				}
			} else if (inletnum == 1) {
				// inlet two sets the delay time
				if (!isNaN(firstint)) { this.deltime = firstint; }
				// make sure the delay time doesn't go lower than 1 millisecond
				if (this.deltime < 1) { this.deltime = 1; }
			}
		},
	},
		
	//stores and outputs an integer
	"int": {
		"defaultinlets":2,
		"defaultoutlets":1,
		"description":"store and output an integer",
		"outletTypes": ["message"],
		"init": function() {
			this.value = parseInt(this.args[5]);
			if (isNaN(this.value))
				this.value = 0;
		},
		"message": function(inletnum, message) {
			if (inletnum == 0) {
				var atoms = this.toarray(message);
				var firstint = parseInt(atoms[0]);
				// the int object outputs it's value if it gets a bang
				if (atoms[0] == "bang") {
					this.sendmessage(0, this.value);
				// if it gets some other symbol, throws an error
				} else if (isNaN(firstint)) {
					this.pd.log("error: int: no method for '" + atoms[0] + "'");
				// if it gets a new value then it sets and outputs that value
				} else {
					this.value = firstint;
					this.sendmessage(0, this.value);
				}
			} else {
				// inlet two sets the value
				var atoms = this.toarray(message);
				var firstint = parseInt(atoms[0]);
				if (!isNaN(firstint)) { this.value = firstint;}
			}
		}
	},
	
	//bang button object
	"bang": {
		"defaultinlets":1,
			"defaultoutlets":1,
			"description":"send a bang for any input",
		"outletTypes": ["message"],
		"init": function() {
		},
		"message": function(inletnum, message) {
			this.sendmessage(0, "bang");
			}
		},
	
	
	//output 1 if inputs are equivalent
	"==": {
		"defaultinlets":2,
			"defaultoutlets":1,
			"description":"output 1 if inputs are equivalent, and 0 if not",
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.right = parseFloat(this.args[5]);
			} else {
				this.right = 0;//defaults to 0 
			}
		},
		"message": function(inletnum, val) {
			//right inlet sets new value
				if (inletnum == 1) {	
					var newnum=parseFloat(val);
					if (isNaN(newnum)) {
						this.pd.log("error: ==: no method for '" + val + "'");
					}	
					else {
					this.right=newnum;
					}
				}
			//left inlet tests match
			if (inletnum == 0) {	
				 var newnum=parseFloat(val);
				if (isNaN(newnum)) {
					this.pd.log("error: ==: no method for '" + val + "'");
				}	
				else if(newnum==this.right){//if it's equal, send 1 
					 this.sendmessage(0, "1");
				}
				else{
					this.sendmessage(0, "0");//if not, send 0
				}
			}
		}
	},
	
	//output 1 if inputs are not equivalent
	"!=": {
		"defaultinlets":2,
			"defaultoutlets":1,
			"description":"output 1 if inputs are not equivalent, and 0 if they are",
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.right = parseFloat(this.args[5]);
			} else {
				this.right = 0;//defaults to 0 
			}
		},
		"message": function(inletnum, val) {
			//right inlet sets new value
				if (inletnum == 1) {	
					var newnum=parseFloat(val);
					if (isNaN(newnum)) {
						this.pd.log("error: !=: no method for '" + val + "'");
					}	
					else {
					this.right=newnum;
					}
				}
			//left inlet tests match
			if (inletnum == 0) {	
				 var newnum=parseFloat(val);
				if (isNaN(newnum)) {
					this.pd.log("error: !=: no method for '" + val + "'");
				}	
				else if(newnum!=this.right){//if it's not equal, send 1 
					 this.sendmessage(0, "1");
				}
				else{
					this.sendmessage(0, "0");//if it is, send 0
				}
			}
		}
	},
	
	//output 1 if left is greater than or equal to right
	">=": {
		"defaultinlets":2,
			"defaultoutlets":1,
			"description":"left is greater than or equal to right",
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.right = parseFloat(this.args[5]);
			} else {
				this.right = 0;//defaults to 0 
			}
		},
		"message": function(inletnum, val) {
			//right inlet sets new value
				if (inletnum == 1) {	
					var newnum=parseFloat(val);
					if (isNaN(newnum)) {
						this.pd.log("error: >=: no method for '" + val + "'");
					}	
					else {
					this.right=newnum;
					}
				}
			//left inlet tests match
			if (inletnum == 0) {	
				 var newnum=parseFloat(val);
				if (isNaN(newnum)) {
					this.pd.log("error: !=: no method for '" + val + "'");
				}	
				else if(newnum>=this.right){
					 this.sendmessage(0, "1");
				}
				else{
					this.sendmessage(0, "0");
				}
			}
		}
	},
	
	//output 1 if left is less than or equal to right
	"<=": {
		"defaultinlets":2,
			"defaultoutlets":1,
			"description":"left is less than or equal to right",
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.right = parseFloat(this.args[5]);
			} else {
				this.right = 0;//defaults to 0 
			}
		},
		"message": function(inletnum, val) {
			//right inlet sets new value
				if (inletnum == 1) {	
					var newnum=parseFloat(val);
					if (isNaN(newnum)) {
						this.pd.log("error: <=: no method for '" + val + "'");
					}	
					else {
					this.right=newnum;
					}
				}
			//left inlet tests match
			if (inletnum == 0) {	
				 var newnum=parseFloat(val);
				if (isNaN(newnum)) {
					this.pd.log("error: <=: no method for '" + val + "'");
				}	
				else if(newnum<=this.right){
					 this.sendmessage(0, "1");
				}
				else{
					this.sendmessage(0, "0");
				}
			}
		}
	},
	
	//output 1 if left is greater than right
	">": {
		"defaultinlets":2,
			"defaultoutlets":1,
			"description":"output 1 if left is greater than right",
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.right = parseFloat(this.args[5]);
			} else {
				this.right = 0;//defaults to 0 
			}
		},
		"message": function(inletnum, val) {
			//right inlet sets new value
				if (inletnum == 1) {	
					var newnum=parseFloat(val);
					if (isNaN(newnum)) {
						this.pd.log("error: >: no method for '" + val + "'");
					}	
					else {
					this.right=newnum;
					}
				}
			//left inlet tests match
			if (inletnum == 0) {	
				 var newnum=parseFloat(val);
				if (isNaN(newnum)) {
					this.pd.log("error: >: no method for '" + val + "'");
				}	
				else if(newnum>this.right){
					 this.sendmessage(0, "1");
				}
				else{
					this.sendmessage(0, "0");
				}
			}
		}
	},
	
	//output 1 if left is less than right
	"<": {
		"defaultinlets":2,
			"defaultoutlets":1,
			"description":"output 1 if left is less than right",
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.right = parseFloat(this.args[5]);
			} else {
				this.right = 0;//defaults to 0 
			}
		},
		"message": function(inletnum, val) {
			//right inlet sets new value
				if (inletnum == 1) {	
					var newnum=parseFloat(val);
					if (isNaN(newnum)) {
						this.pd.log("error: <: no method for '" + val + "'");
					}	
					else {
					this.right=newnum;
					}
				}
			//left inlet tests match
			if (inletnum == 0) {	
				 var newnum=parseFloat(val);
				if (isNaN(newnum)) {
					this.pd.log("error: <: no method for '" + val + "'");
				}	
				else if(newnum<this.right){//if it's not equal, send 1 
					 this.sendmessage(0, "1");
				}
				else{
					this.sendmessage(0, "0");//if it is, send 0
				}
			}
		}
	},
	
	"tgl":{
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"toggle between 1 and 0",
		"outletTypes": ["message"],
		"init": function() {
			this.state=0;
		},
		"message": function(inletnum, message) {
			var newnum=parseFloat(message);
			if(message=="bang"){
				this.state = (this.state==0 ? 1:0); 
				this.sendmessage(0, this.state);
			}
			else if (isNaN(newnum)) {
					this.pd.log("error: toggle: no method for '" + message + "'");
			}
			else if(newnum==0){
				this.state=0;
				this.sendmessage(0, "0");
			}
			else{
				this.state=1;
				this.sendmessage(0, "1");
			}
			
		}
			
	},	
	
	//only outputs on a different value 
	"change": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"only outputs on a different value",
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.last = parseFloat(this.args[5]);
			} else {
				this.last = null;
			}
		},
		"message": function(inletnum, val) {
			var parts = this.toarray(val);
			if(parts[0]=="set"){
				var setLast = parseFloat(parts[1]);
				if (isNaN(setLast)) {
					this.pd.log("error: change: must set to a float");
				}
				else{
					this.last=setLast;
				}
			}
			else{
				var newnum=parseFloat(parts[0]);
				if (isNaN(newnum)) {
					this.pd.log("error: change: no method for '" + val + "'");
				}	
				else if(newnum!=this.last){//it's new. send it 
					 this.sendmessage(0, newnum);
					 this.last=newnum;
				}
			}
		}
	},
	
	//convert midi notes to frequency
	"mtof": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"convert midi notes to frequency",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			var out = 0;
			if(isNaN(input)){
				this.pd.log("error: mtof: no method for '" + message + "'");
			}
			else{
				if(input<=-1500){
					out=0;
				}
				else if(input>1499){
					out=1499;
				}
				else{
					out = 8.17579891564 * Math.exp(.0577622650 * input);
					this.sendmessage(0, out);
				}
			}
		},
	},
	
	//convert frequency to midi notes
	"ftom": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"convert frequency to midi notes",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			var out = 0;
			if(isNaN(input)){
				this.pd.log("error: ftom: no method for '" + message + "'");
			}
			else{
				out = (input > 0 ? (17.3123405046 * Math.log(.12231220585 * input)) : -1500);
				this.sendmessage(0, out);
			}
		},
	},
	
	//wrap bet 0 and 1
	"wrap": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"wrap bet 0 and 1",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			var out = 0;
			if(isNaN(input)){
				this.pd.log("error: wrap: no method for '" + message + "'");
			}
			else{
			out = input - Math.floor(input);
			this.sendmessage(0, out);
			}
		},
	},
	
	//sine
	"sin": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"returns the sine of an angle in radians",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			if(isNaN(input)){
				this.pd.log("error: sin: no method for '" + message + "'");
			}
			else{
				var out = Math.sin(input);
				this.sendmessage(0, out);
			}
		},
	},
	
	//cosine
	"cos": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"returns the cosine of an angle in radians",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			if(isNaN(input)){
				this.pd.log("error: cosine: no method for '" + message + "'");
			}
			else{
				var out = Math.cos(input);
				this.sendmessage(0, out);
			}
		},
	},
		
	//tangent
	"tan": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"returns the tangent of an angle in radians",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			if(isNaN(input)){
				this.pd.log("error: tan: no method for '" + message + "'");
			}
			else{
				var out = Math.tan(input);
				this.sendmessage(0, out);
			}
		},
	},
		
	//absolute value
	"abs": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"returns the absolut value of a number",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			if(isNaN(input)){
				this.pd.log("error: abs: no method for '" + message + "'");
			}
			else{
				var out = Math.abs(input);
				this.sendmessage(0, out);
			}
		},
	},
		
	//square root
	"sqrt": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"returns the square root of a number",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			var out=0;
			if(isNaN(input)){
				this.pd.log("error: sqrt: no method for '" + message + "'");
			}
			else{
				if(input<=0){
					out=0;
				}
				else{
					out = Math.sqrt(input);
				}
				this.sendmessage(0, out);
			}
		},
	},
		
	//arc tangent
	"atan": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"returns the arc tangent of an angle in radians",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			if(isNaN(input)){
				this.pd.log("error: atan: no method for '" + message + "'");
			}
			else{
				var out = Math.atan(input);
				this.sendmessage(0, out);
			}
		},
	},
	
	//arc tangent 2
	"atan2": {
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.multiplier = parseFloat(this.args[5]);
			} else {
				this.multiplier = 0;
			}
		},
		"message": function(inletnum, val) {
			// right inlet changes value
			if (inletnum == 1) {
				var multiplier = parseFloat(val);
				// if this is a valid number, set our multiplier
				if (isNaN(multiplier)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					this.multiplier = multiplier;
				}
			// left inlet outputs the multiplication
			} else if (inletnum == 0) {
				var parts = this.toarray(val);
				var mul = parseFloat(parts[0]);
				// use the second number to set the multiplier
				if (parts.length > 1 && !isNaN(mul)) {
					// if it's a valid number send to the second outlet
					this.message(1, parts[1]);
				}
				// if it's a valid float, use it to output a multiplication
				if (isNaN(mul)) {
					this.pd.log("error: *: no method for '" + parts[0] + "'");
				} else {
					if(mul==0 && this.multiplier==0){
						var out = 0;
					}
					else{
						var out = Math.atan2(mul,this.multiplier);
					}
					this.sendmessage(0, out);
				}
			}
		},
	},
	
	//power to decible conversion
	"powtodb": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"power to decible conversion",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			if(isNaN(input)){
				this.pd.log("error: powtodb: no method for '" + message + "'");
			}
			else{
				if(input<0){
					input=0;
				}
				var out = 100 + (4.3429448190326 * Math.log(input));
				if(out<0){
					out=0;
				}
				this.sendmessage(0, out);
			}
		},
	},
		
	//decible to power conversion
	"dbtopow": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"decible to power conversion",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			if(isNaN(input)){
				this.pd.log("error: powtodb: no method for '" + message + "'");
			}
			else{
				if(input<0){
					input=0;
				}
				else if(input>870){
					input=870;
				}
				var out = Math.exp(0.2302585092994 * (input-100));
				this.sendmessage(0, out);
			}
		},
	},
		
	//root mean square to decible conversion
	"rmstodb": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"root mean square to decible conversion",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			var out = 0;
			if(isNaN(input)){
				this.pd.log("error: rmstodb: no method for '" + message + "'");
			}
			else{
				if(input<=0){
					out=0;
				}
				else{
					out = 100 + (8.6858896380652 * Math.log(input));
				}
				this.sendmessage(0, out);
			}
		},
	},
		
	//decible to root mean square conversion
	"dbtorms": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"decible to root mean square conversion",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			var out = 0;
			if(isNaN(input)){
				this.pd.log("error: dbtorms: no method for '" + message + "'");
			}
			else{
				if(input<0){
					out=0;
				}
				else if(input>485){
					out = Math.exp(44.3247630401345); //44.3247630401345=(0.1151292546497 * (485 - 100))
				}
				else{
					out = Math.exp(0.1151292546497 * (input - 100));
				}
				this.sendmessage(0, out);
			}
		},
	},
		
	//log
	"log": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"it's big, it's heavy, it's wood",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			var out = 0;
			if(isNaN(input)){
				this.pd.log("error: log: no method for '" + message + "'");
			}
			else{
				out = (input > 0 ? Math.log(input) : -1000);
				this.sendmessage(0, out);
			}
		},
	},
		
	//exp
	"exp": {
		"defaultinlets":1,
		"defaultoutlets":1,
		"description":"exp",
		"outletTypes": ["message"],
		"message": function(inletnum, message) {
			var input = parseFloat(message);
			var out = 0;
			if(isNaN(input)){
				this.pd.log("error: exp: no method for '" + message + "'");
			}
			else{
				input = (input>87.3365 ? 87.3365 : input);
				out = Math.exp(input);
				this.sendmessage(0, out);
			}
		},
	},
		
	//maximum of 2 numbers
	"max": {
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.addition = parseFloat(this.args[5]);
			} else {
				this.addition = 0;
			}
		},
		"message": function(inletnum, val) {
			// right inlet changes value
			if (inletnum == 1) {
				var addto = parseFloat(val);
				// if this is a valid number, set our addto
				if (isNaN(addto)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					this.addition = addto;
				}
			// left inlet outputs the multiplication
			} else if (inletnum == 0) {
				// we may have more than one number coming in
				var parts = this.toarray(val);
				// extract the first number
				var add = parseFloat(parts[0]);
				// use the second number to set the multiplier
				if (parts.length > 1 && !isNaN(add)) {
					// if it's a valid number send to the second outlet
					this.message(1, parts[1]);
				}
				// if it's a valid float, use it to output a multiplication
				if (isNaN(add)) {
					this.pd.log("error: +: no method for '" + parts[0] + "'");
				} else {
					var out = (add>this.addition ? add : this.addition)
					this.sendmessage(0, out);
				}
			}
		},
	},
	
	//minimum of 2 numbers
	"min": {
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.addition = parseFloat(this.args[5]);
			} else {
				this.addition = 0;
			}
		},
		"message": function(inletnum, val) {
			// right inlet changes value
			if (inletnum == 1) {
				var addto = parseFloat(val);
				// if this is a valid number, set our addto
				if (isNaN(addto)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					this.addition = addto;
				}
			// left inlet outputs the multiplication
			} else if (inletnum == 0) {
				// we may have more than one number coming in
				var parts = this.toarray(val);
				// extract the first number
				var add = parseFloat(parts[0]);
				// use the second number to set the multiplier
				if (parts.length > 1 && !isNaN(add)) {
					// if it's a valid number send to the second outlet
					this.message(1, parts[1]);
				}
				// if it's a valid float, use it to output a multiplication
				if (isNaN(add)) {
					this.pd.log("error: +: no method for '" + parts[0] + "'");
				} else {
					var out = (add<this.addition ? add : this.addition)
					this.sendmessage(0, out);
				}
			}
		},
	},
	
	//part a stream of numbers
	"moses": {
		"outletTypes": ["message","message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.splitter = parseFloat(this.args[5]);
			} else {
				this.splitter = 0;
			}
		},
		"message": function(inletnum, val) {
			if (inletnum == 1) {
				var split = parseFloat(val);
				if (isNaN(split)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					this.splitter = split;
				}
			} else if (inletnum == 0) {
				// we may have more than one number coming in
				var parts = this.toarray(val);
				// extract the first number
				var n1 = parseFloat(parts[0]);
				if (parts.length > 1 && !isNaN(n1)) {
					this.splitter = parts[1];
				}
				if (isNaN(n1)) {
					this.pd.log("error: moses: no method for '" + parts[0] + "'");
				} 
				else {
					if(n1<this.splitter){
						this.sendmessage(0, n1);
					}
					else{
						this.sendmessage(1, n1);
					}
				}
			}
		},
	},
	
	// reverse the order of two numbers
	"swap": {
		"outletTypes": ["message","message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.rIn = parseFloat(this.args[5]);
			} else {
				this.rIn = 0;
			}
		},
		"message": function(inletnum, val) {
			if (inletnum == 1) {
				var r = parseFloat(val);
				if (isNaN(split)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} else {
					this.rIn = r;
				}
			} else if (inletnum == 0) {
				// we may have more than one number coming in
				var parts = this.toarray(val);
				// extract the first number
				var l = parseFloat(parts[0]);
				if (parts.length > 1 && !isNaN(l)) {
					this.rIn = parts[1];
				}
				if (isNaN(l)) {
					this.pd.log("error: swap: no method for '" + parts[0] + "'");
				} 
				else {
					this.sendmessage(1, l);
					this.sendmessage(0, this.rIn);
				}
			}
		},
	},
	
	//logical OR - outputs 1 if either inputs are non-zero
	"||": {
		"defaultinlets":2,
		"defaultoutlets":1,
		"description":"logical OR - outputs 1 if either inputs are non-zero",
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.right = parseFloat(this.args[5]);
			} else {
				this.right = null;
			}
		},
		"message": function(inletnum, val) {
			//right inlet sets new value
			if (inletnum == 1) {	
				var newnum=parseFloat(val);
				if (isNaN(newnum)) {
					this.pd.log("error: ||: no method for '" + val + "'");
				}	
				else {
					this.right=newnum;
				}
			}
			//left inlet tests match
			if (inletnum == 0) {	
				var newnum=parseFloat(val);
				if (isNaN(newnum)) {
					this.pd.log("error: ||: no method for '" + val + "'");
				}	
				else if((newnum!=0) || (this.right!=0)){
					this.sendmessage(0, "1");//if it's true, send 1 
				}
				else{
					this.sendmessage(0, "0");//if not, send 0
				}
			}
		}
	}, 
	
	
	//logical AND - outputs 1 if either inputs are non-zero
	"&&": {
		"defaultinlets":2,
		"defaultoutlets":1,
		"description":"logical OR - outputs 1 if either inputs are non-zero",
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length >= 6) {
				this.right = parseFloat(this.args[5]);
			} else {
				this.right = null;
			}
		},
		"message": function(inletnum, val) {
			//right inlet sets new value
			if (inletnum == 1) {	
				var newnum=parseFloat(val);
				if (isNaN(newnum)) {
					this.pd.log("error: &&: no method for '" + val + "'");
				}	
				else {
					this.right=newnum;
				}
			}
			//left inlet tests match
			if (inletnum == 0) {	
				var newnum=parseFloat(val);
				if (isNaN(newnum)) {
					this.pd.log("error: ||: no method for '" + val + "'");
				}	
				else if((newnum!=0) && (this.right!=0)){
					this.sendmessage(0, "1");//if it's true, send 1 
				}
				else{
					this.sendmessage(0, "0");//if not, send 0
				}
			}
		}
	}, 
	
	//force a number into a range
	"clip":{
		"outletTypes": ["message"],
		"init": function() {
			// do i have a numeric argument
			if (this.args.length == 6) {
				this.lo = parseFloat(this.args[5]);
				this.hi = 0;
			} 
			else if (this.args.length == 7) {
				this.lo = parseFloat(this.args[5]);
				this.hi = parseFloat(this.args[6]);
			}
			else{
				this.lo=0;
				this.hi=0;
			}
		},
		"message": function(inletnum, val) {
			if (inletnum == 2) {
				var hi = parseFloat(val);
				if (isNaN(hi)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} 
				else {
					this.hi = hi;
				}
			} 
			else if (inletnum == 1) {
			//TODO: check for a list and use 2nd val for hi
				var lo = parseFloat(val);
				if (isNaN(lo)) {
					this.pd.log("error: inlet: expected 'float' but got '" + val + "'");
				} 
				else {
					this.lo = lo;
				}
			} 
			else if (inletnum == 0) {
				// we may have more than one number coming in
				var parts = this.toarray(val);
				// extract the first number
				var input = parseFloat(parts[0]);
				if (parts.length == 2 && !isNaN(input)) {
					//set the low value
					var loIn = parts[1];
					if (isNaN(loIn)) {
						this.pd.log("error: clip: no method for '" + parts[1] + "'");
					}
					else{
						this.lo=loIn;
					}
				}
				if (parts.length == 3 && !isNaN(input)) {
					//set the low and hi values
					var loIn = parts[1];
					var hiIn = parts[2];
					if (isNaN(loIn)) {
						this.pd.log("error: clip: no method for '" + parts[1] + "'");
					}
					if (isNaN(hiIn)) {
						this.pd.log("error: clip: no method for '" + parts[2] + "'");
					}
					else{
						this.lo=loIn;
						this.hi=hiIn;
					}
				}
				var out = (input<this.lo ? this.lo : (input>this.hi ? this.hi : input));
				this.sendmessage(0, out);
			}
		},
	},
	
	//text comments
		"text": {
		"defaultinlets":0,
	        "defaultoutlets":0,
	        "description":"passive comments or instructions",
		"outletTypes": ["message"],
		"init": function() {
		},
		"message": function(inletnum, message) {
			}
		}
	
		
};

// object name aliases
PdObjects.r = PdObjects.receive;
PdObjects.t = PdObjects.trigger;
PdObjects.f = PdObjects.float;
PdObjects.i = PdObjects.int;
PdObjects.sel = PdObjects.select;
PdObjects.bng = PdObjects.bang;


/********************************
	Helper functions
 ********************************/

function MakeRequest(url, caller)
{
	var http_request = false;
	var requestComplete = false;
	
	// Create the XML RPC object
	if (window.XMLHttpRequest) // Free browsers
	{
		http_request = new XMLHttpRequest();
	}
	else if (window.ActiveXObject) // Internet explorer
	{
		http_request = new ActiveXObject("Microsoft.XMLHTTP");
	}
	
	// When we receive a message back from an XML RPC request
	http_request.onreadystatechange = function()
	{
		if (typeof http_request != "undefined")
		{
			// reponse 4 = 'request complete'
			if (http_request.readyState == 4)
			{
				response = http_request.responseText
				if (response != "")
				{
					caller.loadcomplete(response, http_request);
				}
				requestComplete = true;
			}
		}
		else
		{
			http_request = false;
			requestComplete = true;
		}
	};
	
	// asynchronous request
	http_request.open("GET", url, true);
	http_request.send(null);
};

