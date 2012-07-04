(function(Pd){

    // Regular expression to split tokens in a message.
    var tokensRe = new RegExp(' |\r\n?|\n');

    Pd.compat = {};

    // Parses argument to a string or a number.
    Pd.compat.parseArg = function(arg) {
        var parsed = Pd.compat.parseFloat(arg);
        if (Pd.isNumber(parsed)) return parsed;
        else if (Pd.isString(arg)) return arg;
        else throw new Error('couldn\'t parse arg ' + arg);
    };

    // Parses a float from a .pd file. Returns the parsed float or NaN.
    Pd.compat.parseFloat = function(data) {
        if (Pd.isNumber(data)) return data;
	    else if (Pd.isString(data)) return parseFloat(data);
        else return NaN;
    };

    // Convert a Pd message to a javascript array
    Pd.compat.parseArgs = function(args) {
	    // if it's an int, make a single valued array
	    if (Pd.isNumber(args)) return [args];
	    // if it's a string, split the atom
	    else {
	        var parts = Pd.isString(args) ? args.split(tokensRe) : args,
                parsed = [], i, length;
		    if (parts[0] == 'list') parts.shift();
            for (i = 0, length = parts.length; i < length; i++) {
                if ((arg = parts[i]) === '') continue;
                else parsed.push(Pd.compat.parseArg(arg));
            }
            return parsed;
        }
    };

    
    /******************** Patch parsing ************************/

    // regular expression for finding valid lines of Pd in a file
    var linesRe = new RegExp('(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}(\n|$)', 'gi');

    // Parses a Pd file, creates and returns a new `Pd.Patch` object from it
    // ref : http://puredata.info/docs/developer/PdFileFormat 
    Pd.compat.parse = function(txt) {
	    var lastTable = null,       // last table name to add samples to
            counter = 0,
            pd = new Pd.Patch(),
            line;

	    // use our regular expression to match instances of valid Pd lines
	    while (line = linesRe.exec(txt)) {
		    var tokens = line[1].split(tokensRe),
                chunkType = tokens[0];
		    Pd.debug(tokens.toString());

		    // if we've found a create token
		    if (chunkType == '#X') {
                var elementType = tokens[1];

			    // is this an obj instantiation
			    if (elementType == 'obj' || elementType == 'msg' || elementType == 'text') {
				    var proto,  // the lookup to use in the `Pd.objects` hash
                        args,   // the construction args for the object
                        obj;

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
                    obj = new Pd.objects[proto](pd, Pd.compat.parseArgs(args));

			    } else if (elementType == 'array') {
                    var arrayName = tokens[2],
                        arraySize = parseInt(tokens[3]),
				        obj = new Pd.objects['table'](pd, [arrayName, arraySize]);

                    // remind the last table for handling correctly 
                    // the table related instructions which might follow.
                    lastTable = obj;

			    } else if (elementType == 'restore') {
				    // end the current table
				    lastTable = null;

			    } else if (elementType == 'connect') {
                    var obj1 = pd.getObject(parseInt(tokens[2])),
                        obj2 = pd.getObject(parseInt(tokens[4]));
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
