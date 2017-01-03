/*
 * Copyright (c) 2011-2017 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

var _ = require('underscore')
  , inherits = require('util').inherits
  , errors = require('./errors')
  , portlets = require('./portlets')
  , utils = require('./utils')
  

// Base class for objects and patches. Example :
//
//     var node = new MyNode([arg1, arg2, arg3])
//
var BaseNode = module.exports = function(patch, id, args) {
  args = args || []
  var self = this
  this.id = id                      // A patch-wide unique id for the object
  this.patch = patch                // The patch containing that node

  // create inlets and outlets specified in the object's proto
  this.inlets = this.inletDefs.map(function(inletType, i) {
    return new inletType(self, i)
  })
  this.outlets = this.outletDefs.map(function(outletType, i) {
    return new outletType(self, i)
  })

  // initializes the object, handling the creation arguments
  this.init(args)
}


_.extend(BaseNode.prototype, {

/******************** Methods to implement *****************/

  // True if the node is an endpoint of the graph (e.g. [dac~])
  endPoint: false,

  // The node will process its arguments by automatically replacing
  // abbreviations such as 'f' or 'b', and replacing dollar-args
  doResolveArgs: false,

  // Lists of the class of portlets.
  outletDefs: [], 
  inletDefs: [],

  // This method is called when the object is created.
  init: function() {},

  // This method is called when dsp is started,
  // or when the object is added to a patch that is already started.
  start: function() {},

  // This method is called when dsp is stopped
  stop: function() {},

  // This method is called to clean the object, remove event handlers, etc ...
  // For example this is called when a patch is destroyed.
  destroy: function() {},

/************************* Public API **********************/

  // Returns inlet `id` if it exists.
  i: function(id) {
    if (id < this.inlets.length) return this.inlets[id]
    else throw (new errors.InvalidPortletError('inlet ' + id + ' doesn\'t exist'))
  },

  // Returns outlet `id` if it exists.
  o: function(id) {
    if (id < this.outlets.length) return this.outlets[id]
    else throw (new errors.InvalidPortletError('outlet ' + id + ' doesn\'t exist'))
  },


/********************** More Private API *********************/

  // Calls `start` on object's portlets
  startPortlets: function() {
    this.outlets.forEach(function(outlet) { outlet.start() })
    this.inlets.forEach(function(inlet) { inlet.start() })
  },

  // Call `stop` on object's portlets
  stopPortlets: function() {
    this.outlets.forEach(function(outlet) { outlet.stop() })
    this.inlets.forEach(function(inlet) { inlet.stop() })
  }

})

