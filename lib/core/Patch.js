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
  , EventEmitter = require('events').EventEmitter
  , mixins = require('./mixins')
  , utils = require('./utils')
  , BaseNode = require('./BaseNode')
  , errors = require('./errors')
  , pdGlob = require('../global')


var Patch = module.exports = function() {
  BaseNode.apply(this, arguments)
  this.objects = []
  this.endPoints = []
  // A globally unique id for the patch.
  // Should stay null if the patch is a subpatch.
  // Instance of an abstraction on the other hand should have a `patchId`.
  this.patchId = null
  // The patch data in simple pd-json format
  // see : https://github.com/sebpiq/pd-fileutils#specification
  this.patchData = null
  this.blockSize = pdGlob.settings.blockSize
}

_.extend(Patch.prototype, BaseNode.prototype, mixins.UniqueIdsMixin, EventEmitter.prototype, {

  type: 'patch',

  init: function(args) {
    this.args = args
  },

  // When starting a patch, we need to take into account its nested structure,
  // making sure that all objects even in subpatches are started first, and only then we start
  // portlets.
  start: function() {
    this.startObjects()
    this.startPortlets()
  },

  stop: function() {
    this.stopObjects()
    this.stopPortlets()
  },

  destroy: function() {
    this.objects.forEach(function(obj) { obj.destroy() })
  },

  startObjects: function() {
    this.objects.forEach(function(obj) { 
      if (obj.startObjects) obj.startObjects()
      else obj.start() 
    })
  },

  stopObjects: function() {
    this.objects.forEach(function(obj) { 
      if (obj.stopObjects) obj.stopObjects()
      else obj.stop()
    })
  },

  startPortlets: function() {
    this.objects.forEach(function(obj) { obj.startPortlets() })
    this.emit('started')
  },

  stopPortlets: function() {
    this.objects.forEach(function(obj) { obj.stopPortlets() })
    this.emit('stopped')
  },

  // Adds an object to the patch.
  // Also causes the patch to automatically assign an id to that object.
  // This id can be used to uniquely identify the object in the patch.
  // Also, if the patch is playing, the `start` method of the object will be called.
  createObject: function(type, objArgs) {
    var obj = this._createObject(type, objArgs)
    if (pdGlob.isStarted) {
      obj.start()
      obj.startPortlets()
    }
    return obj
  },

  _createObject: function(type, objArgs) {
    var obj
    objArgs = objArgs || []

    // Check that `type` is valid and create the object  
    if (pdGlob.library.hasOwnProperty(type)) {
      var constructor = pdGlob.library[type]
      if (constructor.prototype.doResolveArgs)
        objArgs = this.resolveArgs(objArgs)
      obj = new constructor(this, this._generateId(), objArgs)
    } else throw new errors.UnknownObjectError(type)

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
      , dollar0 = this.getPatchRoot().patchId
      , patchArgs, matched

    patchArgs = [dollar0].concat(this.args)

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
  },

  // Return the root patch. Only different from `this` if the calling patch
  // is a subpatch. If it is an abstraction, the situation is different.
  getPatchRoot: function() {
    if (this.patch) return this.patch.getPatchRoot()
    else return this
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
