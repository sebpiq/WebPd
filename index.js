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
  , objects = require('./lib/objects')
  , Patch = require('./lib/Patch')
  , utils = require('./lib/utils')
  , pdfu = require('pd-fileutils')
  , pdGlob = require('./lib/global')
  , audio
pdGlob.defaultPatch = new Patch()
pdGlob.clock = new utils.Clock()
audio = require('./lib/audio-driver')


var Pd = module.exports = {

  lib: objects,

  Patch: Patch,

  // Start dsp
  start: function() {
    if (!pdGlob.isStarted) {
      pdGlob.patches.forEach(function(patch) { patch.start() })
      audio.start()
      pdGlob.isStarted = true
    }
  },

  // Stop dsp
  stop: function() {
    if (pdGlob.isStarted) {
      pdGlob.patches.forEach(function(patch) { patch.stop() })
      audio.stop()
      pdGlob.isStarted = false
    }
  },

  // Returns true if the dsp is started, false otherwise
  isStarted: function() { return pdGlob.isStarted },

  // Send a message to a named receiver inside the graph
  send: function(name) {
    pdGlob.emitter.emit.apply(pdGlob.emitter, ['msg:' + name].concat(_.toArray(arguments).slice(1)))
  },

  // Receive a message from a named sender inside the graph
  receive: function(name, callback) {
    pdGlob.emitter.on('msg:' + name, callback)
  },

  // Returns the default patch
  getDefaultPatch: function() { return pdGlob.defaultPatch },

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
  }

}

if (typeof window !== 'undefined') window.Pd = Pd
