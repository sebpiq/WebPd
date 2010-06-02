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
	var lines_re = new RegExp('(#((.|\n)*?));\n',"gi");
	
	/********************* "Public" methods ************************/
	
	/** Initiate a load of a Pd file **/
	this.load = function (url, callback) {
		this.loadcallback = callback;
		MakeRequest(url, this);
		return this;
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
		}
	}
	
	/********************* Dealing with patches ************************/
	
	/** Parses a Pd file and creates a new DSP graph from it **/
	this.parse = function(txt) {
		// use our regular expression to match instances of valid Pd lines
		var matches = txt.match(lines_re);
		// last table name to add samples to
		var lastTable = null;
		for (var l in matches) {
			// chop off the semicolon and carriage return
			matches[l] = matches[l].substr(0, matches[l].length - 2)
			// split this found line into tokens (on space and carriage return)
			var tokens = matches[l].split(/ |\n/);
			this.debug("" + tokens);
			// if we've found a create token
			if (tokens[0] == "#X") {
				// is this an obj instantiation
				if (tokens[1] == "obj" || tokens[1] == "msg") {
					var proto = "";
					// if this is a message object
					if (tokens[1] == "msg") {
						proto = "msg";
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
	
	/** Schedule a callback at a particular time - milliseconds **/
	this.schedule = function(time, callback) {
		if (!this.scheduled[time])
			this.scheduled[time] = [];
		this.scheduled[time].push(callback);
	}
	
	/**
		Tokenizes a complex message with atoms, commas, and semicolons.
		Returns an array of arrays of strings. (array of lists of comma separated messages).
	 **/
	var messages_re = /\\{0,1};/
	var parts_re = /\\{0,1},/
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
				//console.log("resultatoms:");
				//console.log(resultatoms);
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
				// increase the frame count
				this.frame += 1;
				// do we have any scheduled callbacks for this frame?
				var abstime = this.frame * this.bufferSize / this.sampleRate;
				var removescheduled = [];
				for (var s in this.scheduled) {
					if (s <= abstime) {
						// for every callback in the list to be run at this time
						for (var c=0; c<this.scheduled[s].length; c++) {
							// run it
							this.scheduled[s][c]();
						}
						// add it to our list of times to remove callbacks for
						removescheduled.push(s);
					}
				}
				// remove any scheduled callbacks we've already run
				for (var r=0; r<removescheduled.length; r++) {
					delete this.scheduled[removescheduled[r]];
				}
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
			this.log("Starting audio.");
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
			this.log("Already started.");
		}
	}
	
	/** Stops this graph from running **/
	this.stop = function() {
		// if we're already running
		if (this.interval != -1) {
			this.log("Stopping audio.");
			// clear the interval
			clearInterval(this.interval);
			// destroy the audio element
			this.el = null;
			this.interval = -1;
			// reset our counter
			this.lastWritePosition = 0;
  		} else {
			this.log("Already stopped.");
		}
	}
	
	/******************** console/logging stuff ************************/
	
	/** log a message to console **/
	this.log = function(msg) {
		if (window.console) {
			console.log(msg);
		} else {
			// log manually in HTML
			if (!this.console) this.console = document.getElementById('console');
			if (this.console) this.console.innerHTML += msg + "\n";
		}
	}

	/** logs only when debugMode is set. **/
	this.debug = function(msg) {
		if (this.debugMode) {
			if (typeof(msg) == "string")
				this.log("debug: " + msg);
			else
				this.log(msg);
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
	
	/** Sends a message to a particular outlet **/
	this.sendmessage = function(outletnum, msg) {
		// propagate this message to my outlet
		this.outlets[outletnum][0].message(this.outlets[outletnum][1], msg);
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
				var atoms = message.split(" ");
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
				// TODO: inlet two sets the value
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
			// TODO: here be dragons. this needs a lot of work
			// TODO: e.g. what happens if there is a message which ends in a semicolon?
			var messages = this.value.split('\\;');
			// TODO: replace $N with item N-1 from the incoming message
			var submessages = messages[0].split('\\,');
			for (var o=0; o<submessages.length; o++) {
				this.sendmessage(0, submessages[o]);
			}
			// TODO: inject other messages back into the graph based on first atom name
			for (var m=0; m<messages.length-1; m++) {
				
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
				this.outletbuffer[0][i] = this.table.data[Math.min(length - 1, Math.max(0, Math.round(i1[i % i1.length])))];
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
				if (this.triggers[triggerindex] == "f")
					out = this.tofloat(message);
				else if (this.triggers[triggerindex] == "s")
					out = this.tosymbol(message);
				else if (this.triggers[triggerindex] == "b")
					out = this.tobang(message);
				if (out != "")
					this.sendmessage(triggerindex, out);
			}
		}
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

};

// object name aliases
PdObjects.r = PdObjects.receive;
PdObjects.t = PdObjects.trigger;
PdObjects.f = PdObjects.float;

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

