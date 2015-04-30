/*
 * Copyright (c) 2011-2015 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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
  , EventEmitter = require('events').EventEmitter
  , utils = require('./utils')
  , BaseNode = require('./BaseNode')
  , pdGlob = require('../global')


var Patch = module.exports = function() {
  BaseNode.apply(this, arguments)
  this.objects = []
  this.endPoints = []
  this.patchId = null         // A globally unique id for the patch
  this.sampleRate = pdGlob.settings.sampleRate
  this.blockSize = pdGlob.settings.blockSize
}

_.extend(Patch.prototype, BaseNode.prototype, utils.UniqueIdsMixin, EventEmitter.prototype, {

  type: 'patch',

  init: function(args) {
    this.args = args
  },

  start: function() {
    this._startStopGeneric('start', 'startPortlets')
    this.emit('started')
  },

  stop: function() {
    this._startStopGeneric('stop', 'stopPortlets')
    this.emit('stopped')
  },

  destroy: function() {
    this.objects.forEach(function(obj) { obj.destroy() })
  },

  _startStopGeneric: function(methObj, methPortlets) {
    // When starting a patch, we need to take into account its nested structure,
    // making sure that all objects even in subpatches are started first.
    var _recursiveStartObjects = function(obj) {
      if (obj instanceof Patch) {
        patches.push(obj)
        obj.objects.forEach(_recursiveStartObjects)
      } else obj[methObj]()
    }, patches = [this]
    this.objects.forEach(_recursiveStartObjects)

    // Only when all objects are started, we start all portlets including in subpatches.
    patches.forEach(function(patch) {
      patch.objects.forEach(function(obj) {
        if (!(obj instanceof Patch)) obj[methPortlets]()
      })
    })
  },

  // Adds an object to the patch.
  // Also causes the patch to automatically assign an id to that object.
  // This id can be used to uniquely identify the object in the patch.
  // Also, if the patch is playing, the `start` method of the object will be called.
  createObject: function(type, objArgs, layout) {
    var obj = this._createObject(type, objArgs, layout)
    if (pdGlob.isStarted) {
      obj.start()
      obj.startPortlets()
    }
    return obj
  },

  _createObject: function(type, objArgs, layout) {
    var obj
    objArgs = objArgs || []

    // Check that `type` is valid and create the object  
    if (pdGlob.library.hasOwnProperty(type)) {
      var constructor = pdGlob.library[type]
      if (constructor.prototype.doResolveArgs)
        objArgs = this.resolveArgs(objArgs)
      obj = new constructor(this, this._generateId(), objArgs)
      obj["type"] = type;
      obj["layout"] = layout
    } else throw new Error('unknown object ' + type)

    // Assign object unique id and add it to the patch
    this.objects[obj.id] = obj
    if (obj.endPoint) this.endPoints.push(obj)

    // When [inlet], [outlet~], ... is added to a patch, we add their portlets
    // to the patch's portlets
    if (isInletObject(obj)) this.inlets.push(obj.inlets[0])
    if (isOutletObject(obj)) this.outlets.push(obj.outlets[0])

    return obj
  },

  // Takes a list of object arguments which might contain abbreviations
  // and dollar arguments, and returns a copy of that list, abbreviations
  // replaced by the corresponding full word.
  resolveArgs: function(args) {
    var cleaned = args.slice(0)
      , patchArgs = [this.patchId].concat(this.args)
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
    return utils.getDollarResolver(cleaned)(patchArgs)
  }

})

var isInletObject = function(obj) {
  return [pdGlob.library['inlet'], pdGlob.library['inlet~']].some(function(type) {
    return obj instanceof type
  })
}

var isOutletObject = function(obj) {
  return [pdGlob.library['outlet'], pdGlob.library['outlet~']].some(function(type) {
    return obj instanceof type
  })
}
