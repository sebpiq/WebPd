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

var _ = require('underscore')
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , portlets = require('./portlets')
  , utils = require('./utils')


var BaseNode = module.exports = function() {
  var self = this
    , args = _.toArray(arguments)
    , patch = args[args.length - 1]
  if (patch instanceof require('./Patch')) args = args.slice(0, -1)
  else patch = null
  this.id = null                  // A patch-wide unique id for the object
  this.patch = null              // The patch containing that node

  // create inlets and outlets specified in the object's proto
  this.inlets = this.inletDefs.map(function(inletType, i) {
    return new inletType(self, i)
  })
  this.outlets = this.outletDefs.map(function(outletType, i) {
    return new outletType(self, i)
  })

  // initializes the object, handling the creation arguments
  this.init.apply(this, args)
  if (patch) patch.register(this)
}
inherits(BaseNode, EventEmitter)


_.extend(BaseNode.prototype, {

  // Lists of the class of portlets.
  outletDefs: [], 
  inletDefs: [],

  // Returns inlet `id` if it exists.
  i: function(id) {
    if (id < this.inlets.length) return this.inlets[id]
    else throw (new Error('invalid inlet ' + id))
  },

  // Returns outlet `id` if it exists.
  o: function(id) {
    if (id < this.outlets.length) return this.outlets[id]
    else throw (new Error('invalid outlet ' + id))
  },

/******************** Methods to implement *****************/

  // This method is called when the object is created.
  // At this stage, `patch` can still be null
  init: function() {},

  start: function() {},

  stop: function() {}

})

