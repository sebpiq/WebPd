/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 *  This file is part of WebPd. See https://github.com/sebpiq/WebPd for documentation
 *
 *  WebPd is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  WebPd is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with WebPd.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

(function(Pd){

    // Regular expression to split tokens in a message.
    var tokensRe = / |\r\n?|\n/;

    // Regular expression to detect escaped dollar vars.
    var escapedDollarVarReGlob = /\\(\$\d+)/g;

    Pd.compat = {};

    // Parses argument to a string or a number.
    Pd.compat.parseArg = function(arg) {
        var parsed = Pd.compat.parseFloat(arg);
        if (Pd.isNumber(parsed)) return parsed;
        else if (Pd.isString(arg)) {
            var matched, arg = arg.substr(0);
            while (matched = escapedDollarVarReGlob.exec(arg)) {
                arg = arg.replace(matched[0], matched[1]);
            }
            return arg;
        } else throw new Error('couldn\'t parse arg ' + arg);
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

            for (i = 0, length = parts.length; i < length; i++) {
                if ((arg = parts[i]) === '') continue;
                else parsed.push(Pd.compat.parseArg(arg));
            }
            return parsed;
        }
    };

    
    /******************** Patch parsing ************************/

    // regular expression for finding valid lines of Pd in a file
    var linesRe = /(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}(\n|$)/gi;

    // Parses a Pd file, creates and returns a new `Pd.Patch` object from it
    // ref : http://puredata.info/docs/developer/PdFileFormat 
    Pd.compat.parse = function(txt) {
        var lastTable = null,       // last table name to add samples to
            counter = 0,
            pd = new Pd.Patch(),
            line;

        // use our regular expression to match instances of valid Pd lines
        linesRe.lastIndex = 0; // reset lastIndex, in case the previous call threw an error
        while (line = linesRe.exec(txt)) {
            var tokens = line[1].split(tokensRe),
                chunkType = tokens[0];

            // if we've found a create token
            if (chunkType === '#X') {
                var elementType = tokens[1];

                // is this an obj instantiation
                if (elementType === 'obj' || elementType === 'msg' || elementType === 'text') {
                    var proto,  // the lookup to use in the `Pd.objects` hash
                        args,   // the construction args for the object
                        obj,
                        guiX = parseInt(tokens[2], 10), guiY = parseInt(tokens[3], 10);

                    if (elementType === 'msg') {
                        proto = 'message';
                        args = tokens.slice(4);
                    } else if (elementType === 'text') {
                        proto = 'text';
                        args = [tokens.slice(4).join(' ')];
                    } else {
                        // TODO: quick fix for list split
                        if (tokens[4] === 'list') {
                            proto = tokens[4] + ' ' + tokens[5];
                            args = tokens.slice(6);
                        } else {
                            proto = tokens[4];
                            args = tokens.slice(5);
                        }
                    }

                    if (Pd.objects.hasOwnProperty(proto)) {
                        obj = new Pd.objects[proto](pd, Pd.compat.parseArgs(args));
                        obj._guiData.x = guiX;
                        obj._guiData.y = guiY;
                    } else {
                        throw new Error('unknown object "' + proto + '"');
                    }

                } else if (elementType === 'array') {
                    var arrayName = tokens[2],
                        arraySize = parseFloat(tokens[3]),
                        obj = new Pd.objects['table'](pd, [arrayName, arraySize]);

                    // remind the last table for handling correctly 
                    // the table related instructions which might follow.
                    lastTable = obj;

                } else if (elementType === 'restore') {
                  // end the current table
                  lastTable = null;

                } else if (elementType === 'connect') {
                    var obj1 = pd.getObject(parseInt(tokens[2], 10)),
                        obj2 = pd.getObject(parseInt(tokens[4], 10));
                    pd.connect(obj1.o(parseInt(tokens[3], 10)), obj2.i(parseInt(tokens[5], 10)));
                } else if (elementType === 'coords') {
                } else {
                    throw new Error('unknown element "' + elementType + '"');
                }

            } else if (chunkType === '#A') {
                // reads in part of an array/table of data, starting at the index specified in this line
                // name of the array/table comes from the the '#X array' and '#X restore' matches above
                var idx = parseFloat(tokens[1]), t, length, val;
                if (lastTable) {
                    for (t = 2, length = tokens.length; t < length; t++, idx++) {
                        val = parseFloat(tokens[t]);
                        if (Pd.isNumber(val)) lastTable.data[idx] = val;
                    }
                } else {
                    console.error('got table data outside of a table.');
                }
            } else if (chunkType === '#N') {
            } else {
                throw new Error('unknown chunk "' + chunkType + '"');
            }
        }

        // output a message with our graph
        console.debug('Graph:');
        console.debug(pd);
        
        return pd;
    };


})(this.Pd);
