/***
	A very basic implementation of Pd's dsp engine for the web.
	
	Copyright Chris McCormick, 2010.
	Licensed under the terms of the LGPLv3.
***/

var Pd = function Pd(sampleRate, bufferSize) {
	// set my own sample rate
	this.sampleRate = sampleRate;
	// output buffer (stereo)
	this.output = Array(bufferSize * 2);
	// the audio element we'll use to make sound
	this.el = null;
	// how many frames have we run
	this.frame = 0;
	// the size of our buffers
	this.bufferSize = bufferSize;
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
	var lines_re = new RegExp('(#(.*?)[^\]);\n',"gm");
	
	/** Initiate a load of a Pd file **/
	this.load = function (url, callback) {
		this.loadcallback = callback;
		MakeRequest(url, this);
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
	
	/** Parses a Pd file and creates a new DSP graph from it **/
	this.parse = function(txt) {
		// use our regular expression to match instances of valid Pd lines
		var matches = txt.match(lines_re);
		for (var l in matches) {
			// chop off the semicolon and carriage return
			matches[l] = matches[l].substr(0, matches[l].length - 2)
			// split this found line into tokens
			var tokens = matches[l].split(" ");
			this.log(tokens);
			// if we've found a create token
			if (tokens[0] == "#X") {
				// is this an obj instantiation
				if (tokens[1] == "obj") {
					// see if we know about this type of object yet
					if (PdObjects[tokens[4]]) {
						// instantiate this dsp object
						var obj = new PdObject(PdObjects[tokens[4]], this, tokens[4], tokens);
						// put it in our graph of known objects
						obj.graphindex = this._graph.objects.length;
						this._graph.objects[obj.graphindex] = obj;
						// if it's an endpoint, add it to the graph's list of known endpoints
						if (obj.endpoint) {
							this._graph.endpoints.push(obj);
						}
					} else {
						// TODO: see if we can load this from a url and queue it to be loaded up after parsing
						this.log(" " + tokens[4]);
						this.log("... couldn't create");
					}
				} else if (tokens[1] == "connect") {
					// connect objects together
					this._graph.objects[parseInt(tokens[4])].inlets[parseInt(tokens[5])] =
						[this._graph.objects[parseInt(tokens[2])], parseInt(tokens[3])];
				}
			}
		}
		// run the loadcallback to notify the user that the patch is loaded
		this.loadcallback(this);
		return this;
	}
	
	/** Periodically check and fill up the buffer, as needed **/
	this.write = function() {
		// because this is an interval callback, we use 'me' instead of 'this'
		var buffered = 0;
		var count = 0;
		me.output.length = 0;
		
		while(!buffered && count < 3000) {
			// increase the frame count
			me.frame += 1;
			// run the dsp function on all endpoints to get data
			for (var e in me._graph.endpoints) {
				// dac~ objects will copy their output to this.output
				me.tick(me._graph.endpoints[e]);
			}
			// copy the data from all endpoints into the audio output
			if (me.el.mozWriteAudio) {
				buffered = me.el.mozWriteAudio(me.output.length, me.output);
			} else {
				buffered = 1;
				me.log(me.output);
			}
			// check we haven't run a ridiculous number of times
			count++;
  		}
		
		// things are not going well. stop the audio.
		if (count >= 3000) {
			this.stop();
		}
	}
	
	/** Dsp tick function which makes sure a node's parents all get run before running it. **/
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
		obj.dsptick();
		// update this objects' frame count
		obj.frame = this.frame;
	}
	
	/** Starts this graph running **/
	this.play = function() {
		this.log("Graph:");
		this.log(this._graph);
		// check we're not already running
		if (this.interval != -1) {
			// set up our audio element
			this.el = new Audio();
			if (this.el.mozSetup) {
				// initialise our audio output element
				this.el.mozSetup(2, this.sampleRate, 1);
				// start a regular buffer fill
				this.interval = setInterval(this.write, 50);
			} else {
				// just a few test frames
				this.interval = setTimeout(this.write, 50);
				this.interval = setTimeout(this.write, 100);
				this.interval = setTimeout(this.write, 150);
			}
			// reset the frame count
			this.frame = 0;
			// reset the frame count on all objects
			for (var o in this._graph.objects) {
				this._graph.objects[0].frame = 0;
			}
		}
	}
	
	/** Stops this graph from running **/
	this.stop = function() {
		// if we're already running
		if (this.interval != -1) {
			// clear the interval
			clearInterval(this.interval);
			this.interval = -1;
			// destroy the audio element
			this.el = null;
  		}
	}
	
	/** log an error **/
	this.log = function(msg) {
		if (window.console) {
			console.log(msg);
		} else {
			// log manually in HTML
			if (!this.console) {
				this.console = document.getElementById('console');
			}
			this.console.innerHTML += msg + "\n";
		}
	}
};
window.Pd = Pd;

/** PdObject prototype, common to all Pd objects **/
var PdObject = function (proto, pd, type, args) {
	// let this object know about it's container graph
	this.pd = pd;
	// let this object know what type of thing it is
	this.type = type;
	// frame counter - how many frames have we run for
	this.frame = 0;
	
	// create the inlets array for this object
	// array holds 2-tuple entries of [src-object, src-outlet-number]
	this.inlets = [];
	// copy properties from the right type of thing
	for (var m in proto) {
		this[m] = proto[m];
	}

	// create the outlet buffers for this object
	this.outlets = [];
	for (var o=0; o < this.buffers; o++) {
		this.outlets[o] = Array(this.pd.bufferSize);
	}
	
	// initialise this object with the arguments from the patch
	if (this.init) {
		this.init(args);
	}
	
	/** Gets the output buffer of the object's outlet connected to inlet number idx **/
	this.inletBuffer = function(idx) {
		return this.inlets[idx][0].outlets[this.inlets[idx][1]];
	}
}

var PdObjects = {
	// Every PdObject also gets the following variables set on creation:
	// graph = the parent graph
	// type = inititalisation string name (e.g. "osc~")
	// inlets = array, where the index is the inlet number, of two-tuples
	//	the first being the previous object in the chain
	//	the second being that object's connected outlet
	// dsp = a function which makes sure the previous objects have been calculated
	//	then runs dspfunc on this object - see the dsp function above
	
	// basic oscillator
	"osc~": {
		"endpoint": false,
		"buffers": 1,
		"init": function(args) {
			if (args.length >= 6) {
				this.freq = parseFloat(args[5]);
			} else {
				this.freq = 0;
			}
			this.sampCount = 0;
			this.samplesize = this.pd.sampleRate / this.freq;
		},
		"dsptick": function() {
			for (var i=0; i<this.outlets[0].length; i++) {
				this.outlets[0][i] = Math.sin(2 * Math.PI * (this.sampCount / this.samplesize));
				this.sampCount += 1;
			}
		},
	},
	
	// digital to analogue converter (sound output)
	"dac~": {
		"endpoint": true,
		"buffers": 0,
		"init": function(args) {
		},
		"dsptick": function() {
			var i1 = this.inletBuffer(0);
			var i2 = this.inletBuffer(1);
			// copy interleaved data from inlets to the graph's output buffer
			for (var i=0; i < i1.length; i++) {
				this.pd.output[i * 2] = i1[i];
				this.pd.output[i * 2 + 1] = i2[i];
			}
		},
	},
	
	// multiply object
	"*~": {
		"endpoint": false,
		"buffers": 1,
		"init": function(args) {
			if (args.length >= 6) {
				this.val = parseFloat(args[5]);
			}
			this.pd.log(this.inlets);
		},
		"dsptick": function() {
			// if we have a set integer value, use that
			if (this.val) {
				var i1 = this.inletBuffer(0);
				for (var i=0; i < i1.length; i++) {
					this.outlets[0][i] = i1[i] * this.val;
				}
			// otherwise, mutiply two buffers together
			} else {
				var i1 = this.inletBuffer(0);
				var i2 = this.inletBuffer(1);
				for (var i=0; i < i1.length; i++) {
					this.outlets[0][i] = i1[i] * i2[i];
				}
			}
		},
	},

	// addition object
	"+~": {
		"endpoint": false,
		"buffers": 1,
		"init": function(args) {
			if (args.length >= 6) {
				this.val = parseFloat(args[5]);
			}
			this.pd.log(this.inlets);
		},
		"dsptick": function() {
			// if we have a set integer value, use that
			if (this.val) {
				var i1 = this.inletBuffer(0);
				for (var i=0; i < i1.length; i++) {
					this.outlets[0][i] = i1[i] + this.val;
				}
			// otherwise, mutiply two buffers together
			} else {
				var i1 = this.inletBuffer(0);
				var i2 = this.inletBuffer(1);
				for (var i=0; i < i1.length; i++) {
					this.outlets[0][i] = i1[i] + i2[i];
				}
			}
		},
	},
};

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

