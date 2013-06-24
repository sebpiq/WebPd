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


// Regular expressions to deal with dollar-args
var dollarVarRe = /\$(\d+)/,
    dollarVarReGlob = /\$(\d+)/g


var BaseNode = module.exports = function() {
  var self = this
    , args = _.toArray(arguments)
    , patch = args[args.length - 1]
  if (patch && patch instanceof require('./Patch')) args = args.slice(0, -1)
  else patch = null
  if (this.doResolveArgs) args = this.resolveArgs(args)
  this.id = null                  // A patch-wide unique id for the object
  this.patch = null               // The patch containing that node

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

  // The node will process its arguments by automatically replacing
  // abbreviations such as 'f' or 'b', and replacing dollar-args
  doResolveArgs: false,

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

  // Takes a list of object arguments which might contain abbreviations
  // and dollar arguments, and returns a copy of that list, abbreviations
  // replaced by the corresponding full word.
  resolveArgs: function(args) {
    var cleaned = args.slice(0)
      , patchArgs = this.patch ? [this.patch.patchId].concat(this.patch.args) : []
      , matched
      , replaceDollarArg = function(matched) {
        var dollarInd = parseInt(matched[1], 10)
        if (dollarInd >= patchArgs.length || dollarInd < 0) 
          throw new Error('$' + dollarInd + ': argument number out of range')
        return patchArgs[dollarInd]
      }

    args.forEach(function(arg, i) {
      if (arg === 'b') cleaned[i] = 'bang'
      else if (arg === 'f') cleaned[i] = 'float'
      else if (arg === 's') cleaned[i] = 'symbol'
      else if (arg === 'a') cleaned[i] = 'anything'
      else if (arg === 'l') cleaned[i] = 'list'
      else if (matched = dollarVarRe.exec(arg)) {
        // If the transfer is a dollar var :
        //      ['bla', 789] - ['$1'] -> ['bla']
        if (matched[0] === arg) {
          cleaned[i] = replaceDollarArg(matched)

        // If the transfer is a string containing dollar var :
        //      ['bla', 789] - ['bla$2'] -> ['bla789']
        } else {
          while (matched = dollarVarReGlob.exec(arg))
            arg = arg.replace(matched[0], replaceDollarArg(matched))
          cleaned[i] = arg
        }
      }
    })
    return cleaned
  },

/******************** Methods to implement *****************/

  // This method is called when the object is created.
  // At this stage, `patch` can still be null
  init: function() {},

  start: function() {},

  stop: function() {}

})

