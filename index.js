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
  , pdfu = require('pd-fileutils.parser')
  , webaudioBoilerplate = require('web-audio-boilerplate')
  , Patch = require('./lib/core/Patch')
  , Abstraction = require('./lib/core/Abstraction')
  , PdObject = require('./lib/core/PdObject')
  , mixins = require('./lib/core/mixins')
  , errors = require('./lib/core/errors')
  , portlets = require('./lib/waa/portlets')
  , waa = require('./lib/waa/interfaces')
  , pdGlob = require('./lib/global')
  , interfaces = require('./lib/core/interfaces')
  , patchIds = _.extend({}, mixins.UniqueIdsMixin)

// Various initializations
require('./lib/index').declareObjects(pdGlob.library)


var Pd = module.exports = {

  // Start dsp
  start: function(opts) {
    opts = opts || {}
    if (!pdGlob.isStarted) {

      if (typeof AudioContext !== 'undefined') {
        pdGlob.audio = opts.audio || new waa.Audio({
          channelCount : pdGlob.settings.channelCount,
          audioContext: opts.audioContext
        })
        pdGlob.clock = opts.clock || new waa.Clock({
          audioContext: pdGlob.audio.context,
          waaClock: opts.waaClock
        })
        pdGlob.midi = opts.midi || new waa.Midi()

      // TODO : handle other environments better than like this
      } else {
        pdGlob.audio = opts.audio || interfaces.Audio
        pdGlob.clock = opts.clock || interfaces.Clock
        pdGlob.midi = opts.midi || interfaces.Midi
      }

      if (opts.storage) pdGlob.storage = opts.storage
      else if (typeof window !== 'undefined')
        pdGlob.storage = new waa.Storage()
      else pdGlob.storage = interfaces.Storage

      pdGlob.midi.onMessage(function(midiMessage) {
        pdGlob.emitter.emit('midiMessage', midiMessage)
      })
      pdGlob.audio.start()
      _.values(pdGlob.patches).forEach(function(patch) { patch.start() })
      pdGlob.isStarted = true
    }
  },

  // Stop dsp
  stop: function() {
    if (pdGlob.isStarted) {
      pdGlob.isStarted = false
      _.values(pdGlob.patches).forEach(function(patch) { patch.stop() })
      pdGlob.audio.stop()
    }
  },

  // Returns true if the dsp is started, false otherwise
  isStarted: function() { return pdGlob.isStarted },

  // Returns the audio engine
  getAudio: function() { return pdGlob.audio },

  // Returns the midi engine
  getMidi: function() { return pdGlob.midi },

  // Send a message to a named receiver inside the graph
  send: function(name, args) {
    pdGlob.emitter.emit('msg:' + name, args)
  },

  // Receive a message from a named sender inside the graph
  receive: function(name, callback) {
    pdGlob.emitter.on('msg:' + name, callback)
  },

  // Registers the abstraction defined in `patchData` as `name`.
  // `patchData` can be a string (Pd file), or an object (pd.json)
  registerAbstraction: function(name, patchData) {
    if (_.isString(patchData)) patchData = pdfu.parse(patchData)
    var CustomObject = function(patch, id, args) {
      var patch = new Abstraction(patch, id, args)
      patch.patchId = patchIds._generateId()
      Pd._preparePatch(patch, patchData)
      return patch
    }
    CustomObject.prototype = Abstraction.prototype
    this.registerExternal(name, CustomObject)
  },

  // Register a custom object as `name`. `CustomObject` is a subclass of `core.PdObject`.
  registerExternal: function(name, CustomObject) {
    pdGlob.library[name] = CustomObject
  },

  // Create a new patch
  createPatch: function() {
    var patch = this._createPatch()
    if (pdGlob.isStarted) patch.start()
    return patch
  },

  // Stops and forgets a patch
  destroyPatch: function(patch) {
    patch.stop()
    patch.destroy()
    delete pdGlob.patches[patch.patchId]
  },

  // Loads a patch from a string (Pd file), or from an object (pd.json)
  loadPatch: function(patchData) {
    var patch = this._createPatch()
    if (_.isString(patchData)) patchData = this.parsePatch(patchData)
    this._preparePatch(patch, patchData)
    if (pdGlob.isStarted) patch.start()
    return patch
  },

  parsePatch: function(patchData) {
    if (_.isString(patchData)) patchData = pdfu.parse(patchData)
    return patchData
  },

  // Helpers imported from web-audio-boilerplate
  getSupportedFormats: function(done) {
    var audioContext = new AudioContext
    webaudioBoilerplate.getSupportedFormats(audioContext, done)
  },

  startOnClick: function(elem, callback, opts) {
    webaudioBoilerplate.getAudioContextOnClick(elem, function(err, audioContext) {
      if (err)
        return console.error(err)
      opts = opts || {}
      opts.audioContext = audioContext
      Pd.start(opts)
      if (callback)
        callback()
    })
  },

  _createPatch: function() {
    var patch = new Patch()
    patch.patchId = patchIds._generateId()
    pdGlob.patches[patch.patchId] = patch
    return patch
  },

  // TODO: handling graph better? But ... what is graph :?
  _preparePatch: function(patch, patchData) {
    var createdObjs = {}
      , errorList = []

    // Creating nodes
    patchData.nodes.forEach(function(nodeData) {
      var proto = nodeData.proto
        , obj

      try {
        obj = patch._createObject(proto, nodeData.args || [])
      } catch (err) {
        if (err instanceof errors.UnknownObjectError)
          return errorList.push([ err.message, err ])
        else throw err
      }

      if (obj.type == 'array' && nodeData.data)
        obj.setData(new Float32Array(nodeData.data), true)

      if (proto === 'pd' || proto === 'graph')
        Pd._preparePatch(obj, nodeData.subpatch)
      createdObjs[nodeData.id] = obj
    })

    // Creating connections
    patchData.connections.forEach(function(conn) {
      var sourceObj = createdObjs[conn.source.id]
        , sinkObj = createdObjs[conn.sink.id]
      if (!sourceObj || !sinkObj) {
        var errMsg = 'invalid connection ' + conn.source.id
          + '.* -> ' + conn.sink.id + '.*'
        return errorList.push([ errMsg, new Error('unknown portlet') ])
      }
      try {
        sourceObj.o(conn.source.port).connect(sinkObj.i(conn.sink.port))
      } catch (err) {
        if (err instanceof errors.InvalidPortletError) {
          var errMsg = 'invalid connection ' + conn.source.id + '.' + conn.source.port
            + ' -> ' + conn.sink.id + '.' + conn.sink.port
          return errorList.push([ errMsg, err ])
        }
      }
    })

    // Binding patch data to the prepared patch
    patch.patchData = patchData

    // Handling errors
    if (errorList.length) throw new errors.PatchLoadError(errorList)
  },

  core: {
    PdObject: PdObject,
    portlets: portlets,
    errors: errors
  },

  // Exposing this mostly for testing
  _glob: pdGlob

}

if (typeof window !== 'undefined') window.Pd = Pd
