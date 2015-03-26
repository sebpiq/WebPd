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
  , expect = require('chai').expect

// Regular expressions to deal with dollar-args
var dollarVarRe = /\$(\d+)/,
    dollarVarReGlob = /\$(\d+)/g


// Returns a function `resolver(inArray)`. For example :
//
//     resolver = obj.getDollarResolver([56, '$1', 'bla', '$2-$1'])
//     resolver([89, 'bli']) // [56, 89, 'bla', 'bli-89']
//
exports.getDollarResolver = function(rawOutArray) {
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
}


exports.chainExtend = function() {
  var sources = Array.prototype.slice.call(arguments, 0)
    , parent = this
    , child = function() { parent.apply(this, arguments) }

  // Fix instanceof
  child.prototype = new parent()

  // extend with new properties
  _.extend.apply(this, [child.prototype, parent.prototype].concat(sources))

  child.extend = this.extend
  return child
}


// Simple mixin to add functionalities for generating unique ids.
// Each object extended with this mixin has a separate id counter.
// Therefore ids are not unique globally but unique for object.
exports.UniqueIdsMixin = {

  // Every time it is called, this method returns a new unique id.
  _generateId: function() {
    this._idCounter++
    return this._idCounter
  },

  // Counter used internally to assign a unique id to objects
  // this counter should never be decremented to ensure the id unicity
  _idCounter: -1
}