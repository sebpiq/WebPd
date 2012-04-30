(function(Pd){

    Pd.compat = {};


    // Converts a Pd message to a float
    // TODO: scientific notation, e.g. 2.999e-5
    Pd.compat.toFloat = function(data) {
	    // first check if we just got an actual float, return it if so
	    if (!isNaN(data)) return parseFloat(data);
	    // otherwise parse this thing
	    var element = data.split(' ')[0];
	    var foundfloat = parseFloat(element);
	    if (!isNaN(foundfloat)) {
		    element = foundfloat;
	    } else if (element != 'symbol') {
		    Pd.log("error: trigger: can only convert 's' to 'b' or 'a'")
		    element = '';
	    } else {
		    element = 0;
	    }
	    return element;
    };

    // Converts a Pd message to a symbol
    Pd.compat.toSymbol = function(data) {
	    var element = data.split(' ')[0];
	    if (!isNaN(parseFloat(element))) {
		    element = 'symbol float';
	    } else if (element != 'symbol') {
		    Pd.log("error: trigger: can only convert 's' to 'b' or 'a'")
		    element = '';
	    } else {
		    element = 'symbol ' + data.split(' ')[1];
	    }
	    return element;
    };

    // Convert a Pd message to a bang
    Pd.compat.toBang = function(data) {
	    return 'bang';
    };

    // Convert a Pd message to a javascript array
    Pd.compat.toArray = function(msg) {
	    // if it's a string, split the atom
	    if (typeof msg == 'string') {
		    var parts = msg.split(' ');
		    if (parts[0] == 'list') parts.shift();
		    return parts;
	    // if it's an int, make a single valued array
	    } else if (typeof msg == 'number') {
		    return [msg];
	    // otherwise it's proably an object/array and should stay that way
	    } else {
		    return msg;
	    }
    };

    
    /******************** Patch parsing ************************/

    // regular expression for finding valid lines of Pd in a file
    var linesRe = new RegExp('(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}\n', 'gi');
    var tokensRe = new RegExp(' |\r\n?|\n');

    // Parses a Pd file, creates and returns a new `Pd.Patch` object from it
    // ref : http://puredata.info/docs/developer/PdFileFormat 
    Pd.compat.parse = function(txt) {
	    // last table name to add samples to
	    var lastTable = null;
        var counter = 0;
        var line;
        var pd = new Pd.Patch();

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
                    var obj1 = pd.getObject(parseInt(tokens[2]));
                    var obj2 = pd.getObject(parseInt(tokens[4]));
                    pd.connect(obj1.o(parseInt(tokens[3])), obj2.i(parseInt(tokens[5])));
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

        return pd;
    };


})(this.Pd);
