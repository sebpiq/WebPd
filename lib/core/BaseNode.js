/*
 * Copyright (c) 2011-2014 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

// Base class for objects and patches. Example :
//
//     var node1 = new MyNode(arg1, arg2, arg3, parentPatch)
//     var node2 = new MyNode(arg1, arg2, arg3)
//
// The parent patch of the node - if the node has one - must be passed as last argument.
// The other arguments are handled by subclasses.
var BaseNode = module.exports = function() {
  var self = this
    , args = _.toArray(arguments)
    , patch = args[args.length - 1]
  if (patch && patch instanceof require('./Patch')) args = args.slice(0, -1)
  else patch = null
  this.id = null                  // A patch-wide unique id for the object
  this.patch = null               // The patch containing that node

  // create inlets and outlets specified in the object's proto
  this.inlets = this.inletDefs.map(function(inletType, i) {
    return new inletType(self, i)
  })
  this.outlets = this.outletDefs.map(function(outletType, i) {
    return new outletType(self, i)
  })

  if (patch) patch.register(this)
  if (this.doResolveArgs) args = this.resolveArgs(args)

  // initializes the object, handling the creation arguments
  this.init.apply(this, args)
}
inherits(BaseNode, EventEmitter)


_.extend(BaseNode.prototype, {

  // True if the node is an endpoint of the graph (e.g. [dac~])
  endPoint: false,

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

    // Resolve abbreviations
    args.forEach(function(arg, i) {
      if (arg === 'b') cleaned[i] = 'bang'
      else if (arg === 'f') cleaned[i] = 'float'
      else if (arg === 's') cleaned[i] = 'symbol'
      else if (arg === 'a') cleaned[i] = 'anything'
      else if (arg === 'l') cleaned[i] = 'list'
    })

    // Resolve dollar-args
    return this.getDollarResolver(cleaned)(patchArgs)
  },


  // Returns a function `resolver(inArray)`. For example :
  //
  //     resolver = obj.getDollarResolver([56, '$1', 'bla', '$2-$1'])
  //     resolver([89, 'bli']) // [56, 89, 'bla', 'bli-89']
  //
  getDollarResolver: function(rawOutArray) {
    rawOutArray = rawOutArray.slice(0)

    // Simple helper to throw en error if the index is out of range
    var getElem = function(array, ind) {
      if (ind >= array.length || ind < 0) 
        throw new Error('$' + (ind + 1) + ': argument number out of range')
      return array[ind]
    }

    // Creates an array of transfer functions `inVal -> outVal`.
    var transfer = rawOutArray.map(function(rawOutVal) {
      var matchOnce = dollarVarRe.exec(rawOutVal)

      // If the transfer is a dollar var :
      //      ['bla', 789] - ['$1'] -> ['bla']
      if (matchOnce && matchOnce[0] === rawOutVal) {
        return (function(rawOutVal) {
          var inInd = parseInt(matchOnce[1], 10)
          return function(inArray) { return getElem(inArray, inInd) }
        })(rawOutVal)

      // If the transfer is a string containing dollar var :
      //      ['bla', 789] - ['bla$2'] -> ['bla789']
      } else if (matchOnce) {
        return (function(rawOutVal) {
          var allMatches = []
            , matched
          while (matched = dollarVarReGlob.exec(rawOutVal)) {
            allMatches.push([matched[0], parseInt(matched[1], 10)])
          }
          return function(inArray) {
            var outVal = rawOutVal.substr(0)
            allMatches.forEach(function(matched) {
              outVal = outVal.replace(matched[0], getElem(inArray, matched[1]))
            })
            return outVal
          }
        })(rawOutVal)

      // Else the input doesn't matter
      } else {
        return (function(outVal) {
          return function() { return outVal }
        })(rawOutVal)
      }
    })

    return function(inArray) {
      return transfer.map(function(func, i) { return func(inArray) })
    } 
  },

/******************** Methods to implement *****************/

  // This method is called when the object is created.
  // At this stage, `patch` can still be null
  init: function() {},

  // This method is called when dsp is started
  start: function() {},

  // This method is called when dsp is stopped
  stop: function() {}

})

