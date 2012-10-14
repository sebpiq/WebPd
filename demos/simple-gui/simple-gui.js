(function() {

    var objType, portletType, proto;


    // Extend all the objects prototypes with gui methods
    for (objType in Pd.objects) {
        if (proto = Pd.objects[objType].prototype) {
            Pd.extend(proto, {

                // Method to call after object creation to initialize gui data
                initGui: function() {
                    this._guiData.text = this.type + ' ' + this._args.join(' ');
                    this._guiData.x = this._guiData.x * 2 || 5;
                    this._guiData.y = this._guiData.y * 2 || 5;
                },

                // Returns object's X in the canvas
                getX: function() { return this._guiData.x; },

                // Returns object's Y in the canvas
                getY: function() { return this._guiData.y; },

                // Sets object's position in the canvas
                setPos: function(pos) {
                    // Update the saved position
                    var x = this._guiData.x = (pos.x || this._guiData.x);
                    var y = this._guiData.y = (pos.y || this._guiData.y);
                    // Update the display of the object and all its connections
                    this.d3().attr('transform', gui.translation(x, y));
                    gui.canvas.selectAll('line.connection')
                        .data(gui.patch.getAllConnections(this), gui.connectionKey)
                        .call(gui.setConnectionXY);
                },

                // Returns text to display on the object 
                getText: function() { return this._guiData.text; },

                // Returns Y of the text in the object's root element 
                getTextY: function() { return this.getH()/2 + gui.portletHeight/2; },

                // Returns object's height
                getH: function() { return 40; },

                // Returns object's width
                getW: function() {
                    var maxPortlet = Math.max(this.inlets.length, this.outlets.length);
                    var textLength = this.getText().length * 10;
                    return Math.max((maxPortlet-1) * 75, 75, textLength);
                },

                // Returns object's unique key for helping d3 doing its data mapping
                getKey: function() {
                    return this.id;
                },

                // Returns object's root svg element
                d3: function() {
                    return d3.selectAll('g.objectGroup').data([this], gui.f('getKey'));
                }

            });
        }
    }


    // Expand all the objects prototypes with gui methods
    var portletCommon = {

        // Returns portlet's X in the canvas
        getX: function() {
            return this.getRelX() + this.obj.getX();
        },

        // Returns portlet's Y in the canvas
        getY: function() {
            return this.getRelY() + this.obj.getY();
        },

        // Returns portlet's unique key for helping d3 doing its data mapping
        getKey: function() {
            return this.obj.getKey() + '-' + this.id;
        },

        _getPortletX: function(inOrOutlets) {
            var obj = this.obj;
            var L = obj.getW();
            var n = obj[inOrOutlets].length;
            if (this.id == 0) return 0;
            else if (this.id == n-1) return L - gui.portletWidth;
            else {
                // Space between portlets
                var a = (L-n*gui.portletWidth) / (n-1);
                return this.id * (gui.portletWidth + a);
            }
        }

    };

    for (portletType in {'outlet': 1, 'outlet~': 1}) {

        Pd.extend(Pd[portletType].prototype, portletCommon, {

            // Returns outlet's X in the object's root element
            getRelX: function() { 
                return this._getPortletX('outlets');
            },

            // Returns outlet's X in the object's root element
            getRelY: function() {
                return this.obj.getH() - gui.portletHeight;
            }

        });
    }

    for (portletType in {'inlet': 1, 'inlet~': 1}) {

        Pd.extend(Pd[portletType].prototype, portletCommon, {

            // Returns inlet's X in the object's root element
            getRelX: function() {
                return this._getPortletX('inlets');
            },

            // Returns inlet's Y in the object's root element
            getRelY: function() {
                return 0;
            }

        });
    }


    this.gui = {

        // The WebPd patch
        patch: null,

        // The d3 canvas
        canvas: null,

        // The console to which API calls will be logged
        commandLog: console,

        // Width and height - in pixels - of a portlet
        portletWidth: 15,
        portletHeight: 10,

        // Makes a new connection between outlet and inlet. Adds the connection
        // to the patch as well as to the svg canvas, and set-up user events. 
        newConnection: function(outlet, inlet) { 
            gui.eval('patch.connect(outletObj.o(outletId), inletObj.i(inletId));', {
                outletObj: outlet.obj,
                outletId: outlet.id,
                inletObj: inlet.obj,
                inletId: inlet.id,
            });
            this.refreshConnections();
        },

        // Removes a connection between outlet and inlet from the patch and the canvas
        removeConnection: function(outlet, inlet) {
            gui.eval('patch.disconnect(outletObj.o(outletId), inletObj.i(inletId));', {
                inletObj: inlet.obj,
                outletObj: outlet.obj,
                inletId: inlet.id,
                outletId: outlet.id
            });
            this.refreshConnections();
        },

        // Creates a new object of type `objType` and with `args`.
        newObject: function(objType, args) {
            // Creating object and adding it to the graph
            var obj = gui.eval('var ', 'obj = new Pd.objects[objType](patch, args);', {
                args: args,
                objType: objType,
                obj: undefined
            });
            gui.refreshObjects();
        },

        // Removes object from the patch and from the canvas.
        removeObject: function(obj) {
            gui.eval('patch.removeObject(obj);', {obj: obj});
            gui.refresh();
        },

        // Refresh the whole canvas
        refresh: function() {
            gui.refreshObjects();
            gui.refreshConnections();
        },

        // Create new connections, setting-up user events on them,
        // remove those that don't exist anymore.
        refreshConnections: function() {
            var connections = gui.canvas.selectAll('line.connection')
                .data(gui.patch.getAllConnections(), gui.connectionKey)
            
            connections.enter()
                .append('line')
                .attr('class', 'connection')
                .each(function(conn) {
                    gui.setConnectionXY(d3.select(this));
                })
                .on('click', function(conn) {
                    gui.setSelection(this);
                    // Stop event propagation so that the canvas
                    // doesn't receive the click.
                    d3.event.stopPropagation();
                });

            connections.exit().remove();
        },

        // Refresh objects display. 
        // New objects are added to the svg canvas and user events are set-up : 
        // e.g. selecting the object, moving it, creating a new connection 
        // from an outlet, and so on ...
        // Objects that don't exist anymore are removed from the canvas.
        refreshObjects: function() {
            var objects = gui.canvas.selectAll('g.objectGroup')
                .data(gui.patch.getAllObjects(), gui.f('getKey'));

            // New objects
            var gsEnter = objects.enter()
                .append('g')
                .each(function(obj) {
                    // Initialize the GUI infos for the new object. 
                    obj.initGui();

                    // Add control for sending message if object is message
                    if (obj.type == 'message') {
                        d3.select(this).append('circle')
                            .attr('class', 'sendMessage')
                            .attr('cx', function(obj) { return obj.getW() + 20; })
                            .attr('cy', function(obj) { return obj.getH()/2; })
                            .attr('r', 20)
                            .on('click', function(obj) {
                                gui.eval("obj.i(0).message('bang');", {obj: obj});
                                d3.event.stopPropagation();
                            });
                    }
                })
                .attr('class', 'objectGroup')
                // Selecting object
                .on('click', function(obj) {
                    gui.setSelection(this);
                    // Stop event propagation so that the canvas
                    // doesn't receive the click.
                    d3.event.stopPropagation();
                })
                // Moving object
                .call(d3.behavior.drag()
                    .on('dragstart', function(obj) {})
                    .on('drag', function(obj) {
                        obj.setPos({
                            x: obj.getX() + d3.event.dx,
                            y: obj.getY() + d3.event.dy
                        });
                    })
                    .on('dragend', function(obj) {})
                );

            // Object box
            gsEnter.append('rect')
                .attr('class', 'object')
                .attr('width', gui.f('getW'))
                .attr('height', gui.f('getH'));

            // Object text
            gsEnter.append('text')
                .attr('class', 'objectType')
                .text(gui.f('getText'))
                .attr('dy', gui.f('getTextY'))
                .attr('dx', gui.portletWidth);

            // Overlay, blocking text selection
            gsEnter.append('rect')
                .attr('class', 'overlay')
                .attr('width', gui.f('getW'))
                .attr('height', gui.f('getH'));

            // Inlets
            gsEnter
                .selectAll('rect.inlet')
                .data(function(obj) {return obj.inlets}, gui.f('getKey'))
                .enter()
                .append('rect')
                .classed('inlet', true)
                .classed('portlet', true)
                .attr('width', gui.portletWidth)
                .attr('height', gui.portletHeight)
                .attr('x', gui.f('getRelX'))
                .attr('y', gui.f('getRelY'));

            // Outlets
            gsEnter
                .selectAll('rect.outlet')
                .data(function(obj) {return obj.outlets}, gui.f('getKey'))
                .enter()
                .append('rect')
                .classed('outlet', true)
                .classed('portlet', true)
                .attr('width', gui.portletWidth)
                .attr('height', gui.portletHeight)
                .attr('x', gui.f('getRelX'))
                .attr('y', gui.f('getRelY'))
                .on('mousedown', function(outlet) {
                    d3.select(this).classed('connectPortlet', true);

                    // Set the handlers for the connecting phase
                    gui.canvas.selectAll('rect.inlet')
                        .on('mousemove', function(inlet) {
                            d3.select(this).classed('connectPortlet', true);
                            d3.event.stopPropagation();
                        });

                    gui.canvas
                        .on('mousemove', function() {
                            // update new connection
                            var conn = gui.canvas.select('line.newConnection'),
                                pos = d3.mouse(gui.canvas[0][0]);
                            conn.attr('x2', pos[0]);
                            conn.attr('y2', pos[1]);
                            gui.canvas.selectAll('rect.inlet').classed('connectPortlet', false);
                        })
                        .on('mouseup', function() {
                            // Clean-up stuff set-up for the connecting phase
                            gui.canvas.selectAll('rect.inlet')
                                .on('mousemove', function() {});
                            gui.canvas
                                .on('mousemove', function() {})
                                .on('mouseup', function() {});
                            gui.canvas.select('line.newConnection').remove();
                            document.onselectstart = function(){}

                            // Actually create the new connection
                            gui.canvas.selectAll('rect.inlet.connectPortlet')
                                .each(function(inlet) { gui.newConnection(outlet, inlet); });
                            gui.canvas.selectAll('rect.portlet').classed('connectPortlet', false);
                        });

                    // Draw the line used for connecting
                    var x = outlet.getX(), y = outlet.getY();
                    gui.canvas.append('line')
                        .classed('connection', true)
                        .classed('newConnection', true)
                        .attr('x1', x + gui.portletWidth/2)
                        .attr('y1', y + gui.portletHeight)
                        .attr('x2', x + gui.portletWidth/2)
                        .attr('y2', y);

                    // This turns off text selection
                    document.onselectstart = function(){ return false; };

                    // Prevent bubbling so that drag and drop
                    // of whole object doesn't occur when creating
                    // a connection
                    d3.event.stopPropagation();
                });

            // Refresh the new object's position.
            gsEnter.each(function(obj) { obj.setPos({}); });

            // Remove old objects from the canvas
            objects.exit().remove();
        },

        // Object count, used only to give the objects a unique name
        // for logging
        objCount: 0,

        // This function is used to execute and log a WebPd API call.
        eval: function(arg1, arg2, arg3) {

            // Handling the arguments
            var toEval, toLog, context = {}, name, val;
            if (typeof arg2 == 'string') {
                toEval = arg2;
                toLog = arg1 + arg2;
                if (arg3 != undefined) context = arg3;
            } else {
                toEval = toLog = arg1;
                context = arg2 || context;
            }
            context.patch = gui.patch;

            // Execute the command
            with (context) var result = eval(toEval);

            // Log the command in a clever way:
            // objects are replaced by a unique name, 
            // strings, arrays and numbers by their literal value
            for (name in context) {
                val = context[name];
                if (val == undefined) val = result;
                if (val instanceof Pd.Object) {
                    if (val.logName == undefined) {
                        val.logName = 'obj' + gui.objCount;
                        gui.objCount++;
                    }
                    toLog = toLog.replace(name, val.logName);
                } else if (typeof val == 'string' || typeof val == 'number'
                    || Object.prototype.toString.call(val) == '[object Array]') {
                    toLog = toLog.replace(name, JSON.stringify(val));
                }
            }
            gui.commandLog.log(toLog);
            return result;
        },

        // Helper to build a translation transform for a svg object 
        translation: function(x, y) {
            return 'translate(' + x + ',' + y + ')';
        },

        // Helper to build a key for a connection for d3
        connectionKey: function(conn) {
            return ''+conn[0].obj.id+':'+conn[0].id+'-'
                    +conn[1].obj.id+':'+conn[1].id;
        },

        // Helper to update XY of a connection
        setConnectionXY: function(line) {
            line.attr('x1', function(conn) {
                    return conn[0].getX() + gui.portletWidth/2;
                })
                .attr('y1', function(conn) {
                    return conn[0].getY() + gui.portletHeight;
                })
                .attr('x2', function(conn) {
                    return conn[1].getX() + gui.portletWidth/2;
                })
                .attr('y2', function(conn) {
                    return conn[1].getY();
                });
        },

        // Helper for d3, makes a function that takes an object and calls `methName` on it.
        f: function(methName) {
            return function(o) { return o[methName](); };
        },

        // Sets the current selection to `elem`
        setSelection: function(elem) {
            d3.selectAll('line.connection').classed('selected', false);
            d3.selectAll('g.objectGroup').classed('selected', false);
            if (elem != undefined) d3.select(elem).classed('selected', true);
        },

        // Deletes the current selection
        deleteSelection: function() {
            gui.canvas.selectAll('.selected').each(function(thing) {
                if (thing instanceof Pd.Object) {
                    gui.removeObject(thing);
                } else {
                    gui.removeConnection(thing[0], thing[1]);
                }
            });
        }
    };

}).call(this);
