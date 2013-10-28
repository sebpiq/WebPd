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
  , objects = require('./lib/objects')
  , Patch = require('./lib/Patch')
  , utils = require('./lib/utils')
  , EventEmitter = require('events').EventEmitter
  , pdfu = require('pd-fileutils')


var Pd = module.exports = {

  lib: objects,

  Patch: Patch,

  start: function() {
    if (!this.isStarted()) {
      this.patches.forEach(function(patch) { patch.start() })
      this._isStarted = true
    }
  },

  stop: function() {
    if (this.isStarted()) {
      this.patches.forEach(function(patch) { patch.stop() })
      this._isStarted = false
    }
  },

  // Send a message to a named receiver inside the graph
  send: function(name) {
    this.emit.apply(this, ['msg:' + name].concat(_.toArray(arguments).slice(1)))
  },

  // Receive a message from a named sender inside the graph
  receive: function(name, callback) {
    this.on('msg:' + name, callback)
  },

  isStarted: function() {
    return this._isStarted
  },
  _isStarted: false,

  getDefaultPatch: function() {
    this._defaultPatch = new Patch()
    this.getDefaultPatch = function() { return Pd._defaultPatch }
    return this._defaultPatch
  },

  register: function(patch) {
    if (this.patches.indexOf(patch) === -1) {
      this.patches.push(patch)
      patch.patchId = this._generateId()
    }
  },
  patches: [],

  // Loads a patch from a string (Pd file), or from an object (pd.json) 
  loadPatch: function(patchData) {
    var patch = utils.apply(Patch, patchData.args || [])
    if (_.isString(patchData)) patchData = pdfu.parse(patchData)
    this._preparePatch(patch, patchData)
    return patch
  },

  // Registers the abstraction defined in `patchData` as `name`.
  // `patchData` can be a string (Pd file), or an object (pd.json)
  registerAbstraction: function(name, patchData) {
    var CustomObject = function() {
      var patch = utils.apply(Patch, arguments)
      Pd._preparePatch(patch, patchData)
      return patch
    }
    CustomObject.prototype = Patch.prototype
    Pd.lib[name] = CustomObject
  },
  _abstractions: [],

  _preparePatch: function(patch, patchData) {
    var createdObjs = {}

    // Creating nodes
    patchData.nodes.forEach(function(nodeData) {
      var proto = nodeData.proto
        , obj
      // subpatch
      if (proto === 'pd') {
        obj = utils.apply(Patch, (nodeData.args || []).concat(patch))
        Pd._preparePatch(obj, nodeData.subpatch)
      // or normal object
      } else {
        if (!Pd.lib.hasOwnProperty(proto))
          throw new Error('unknown proto ' + proto)
        obj = utils.apply(Pd.lib[proto], (nodeData.args || []).concat(patch))
      }
      createdObjs[nodeData.id] = obj
    })

    // Creating connections
    patchData.connections.forEach(function(conn) {
      var sourceObj = createdObjs[conn.source.id]
        , sinkObj = createdObjs[conn.sink.id]
      if (!sourceObj || !sinkObj) throw new Error('invalid connection')
      sourceObj.o(conn.source.port).connect(sinkObj.i(conn.sink.port))
    })
  },

  registerNamedObject: function(obj) {
    var storeNamedObject = function(oldName, newName) {
      var objType = obj.type
        , nameMap, objList
      Pd._namedObjects[objType] = nameMap = Pd._namedObjects[objType] || {}
      nameMap[newName] = objList = nameMap[newName] || []

      // Adding new mapping
      if (objList.indexOf(obj) === -1) {
        if (obj.nameIsUnique && objList.length > 0)
          throw new Error('there is already a ' + objType + ' with name "' + newName + '"')
        objList.push(obj)
      }

      // Removing old mapping
      if (oldName) {
        objList = nameMap[oldName]
        objList.splice(objList.indexOf(obj), 1)
      }
    }
    obj.on('change:name', storeNamedObject)
    if (obj.name) storeNamedObject(null, obj.name)
  },
  _namedObjects: {},

  // Returns an object list given the object `type` and `name`.
  getNamedObjects: function(type, name) {
    return ((this._namedObjects[type] || {})[name] || [])
  }

}

_.extend(Pd, new EventEmitter())
_.extend(Pd, utils.UniqueIdsMixin)
if (typeof window !== 'undefined') window.Pd = Pd
