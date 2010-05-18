/***
	A very basic implementation of Pd-dsp for the web.
	
	Copyright Chris McCormick, 2010.
	Licensed under the terms of the LGPLv3.
***/

var Pd = function Pd() {
	// internal representation of the DSP graph.
	this._graph = {
		"objects": [],
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
			console.log(tokens);
			// if we've found a create token
			if (tokens[0] == "#X") {
				// is this an obj instantiation
				if (tokens[1] == "obj") {
					// see if we know about this type of object yet
					if (PdObjects[tokens[4]]) {
						// instantiate this dsp object
						var obj = new Object(PdObjects[tokens[4]]);
						// let this object know what type of thing it is
						obj.type = tokens[4];
						// initialise this object with the arguments
						if (obj.init) {
							obj.init(tokens);
						}
						// create the inlets array for this object
						// array holds 2-tuple entries of [src-object, src-outlet-number]
						obj.inlets = [];
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
	
	/** Starts this graph running **/
	this.play = function() {
		console.log(this._graph);
	}
	
	/** log an error **/
	this.log = function(msg) {
		if (console) {
			console.log(msg);
		}
	}
};
window.Pd = Pd;

var PdObjects = {
	// basic oscillator
	"osc~": {
		"endpoint": false,
		"init": function(args) {
			if (args.length >= 6) {
				this.freq = args[5];
			} else {
				this.freq = 0;
			}
		},
		"dspfunc": function() {
			
		},
	},
	
	// digital to analogue converter (sound output)
	"dac~": {
		"endpoint": true,
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

