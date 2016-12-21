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
 
var EventEmitter = require('events').EventEmitter
  , _ = require('underscore')
  , pdGlob = require('../global')


// Simple mixin for named objects, such as [send] or [table]
// This also requires the object to be an EventEmitter.
exports.NamedMixin = {

  nameIsUnique: false,

  setName: function(name) {
    if (!_.isString(name))
      return console.error('expected [' + this.type + '] name to be a string, got ' + name)
    var oldName = this.name
    this.emit('changing:name', oldName, name)
    this.name = name
    pdGlob.namedObjects.register(this, this.type, name, this.nameIsUnique, oldName)
    this.emit('changed:name', oldName, name)
  },

  destroy: function() {
    pdGlob.namedObjects.unregister(this, this.type, this.name)
  }

}


// Simple EventEmitter mixin, with a destroy method
var EventEmitterMixin = exports.EventEmitterMixin = _.extend({}, EventEmitter.prototype, {

  destroy: function() {
    this.removeAllListeners()
  }

})


// Helper to reference a named object (which uses the `NamedMixin`)
// Every time for any reason the `resolved` of the reference changes, "changed" is emitted,
// with arguments (newResolved, oldResolved)
var Reference = exports.Reference = function(referencedType) {
  this.referencedType = referencedType
  this._onNewObject = null
  this._onChangedName = null
  this.resolved = null
  this._eventName = 'namedObjects:registered:' + this.referencedType
  this._eventReceiver = new EventReceiver()
}

_.extend(Reference.prototype, EventEmitterMixin, {

  set: function(name) {
    // Try to fetch the referenced object from `namedObjects`
    var self = this
      , resolved = pdGlob.namedObjects.get(this.referencedType, name)[0]

    this.name = name
    this._stopListening()
    if (resolved) 
      this._setResolved(resolved)
    
    // If the object was not found, we listen to subsequent new objects of `referencedType`
    // being registered in case the object we're waiting for comes up.
    else {
      this._setResolved(null)
      this._onNewObject = function(obj) {
        if (obj.name === name) {
          self._stopListening()
          self._setResolved(obj)
        }
      }
      this._eventReceiver.on(pdGlob.emitter, this._eventName, this._onNewObject)
    }
  },

  destroy: function() {
    this._eventReceiver.destroy()
    EventEmitterMixin.destroy.apply(this)
  },

  _setResolved: function(newObj) {
    var self = this
      , oldObj = this.resolved
    this.resolved = newObj

    if (oldObj) oldObj.removeListener('changing:name', self._onChangedName)

    if (newObj) {
      this._onChangedName = function() { self._setResolved(null) }
      this._eventReceiver.on(newObj, 'changing:name', this._onChangedName)
    }
    this.emit('changed', newObj, oldObj)
  },

  _stopListening: function() {
    if (this._onNewObject) {
      this._eventReceiver.removeListener(pdGlob.emitter, this._eventName, this._onNewObject)
      this._onNewObject = null
    }
  }

})


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


// This is a object to help managing event handlers, and especially clean
// properly on destruction of the parent object.
var EventReceiver = exports.EventReceiver = function() {
  this._handlers = []
}

_.extend(EventReceiver.prototype, {

  addListener: function(emitter, eventName, handler) {
    this._handlers.push([emitter, eventName, handler])
    emitter.addListener(eventName, handler)
  },

  once: function(emitter, eventName, handler) {
    var self = this
      , handlerData = [emitter, eventName, handler]
    this._handlers.push(handlerData)
    emitter.once(eventName, handler)
  },

  removeListener: function(emitter, eventName, handler) {
    this._handlers = _.reject(this._handlers, function(handlerData) {
      var rejected = (handlerData[0] === emitter
            && handlerData[1] === eventName 
            && handlerData[2] === handler)
      if (rejected) emitter.removeListener(eventName, handler)
      return rejected
    })
  },

  destroy: function() {
    this._handlers.forEach(function(handlerData) {
      handlerData[0].removeListener(handlerData[1], handlerData[2])
    })
    this._handlers = []
  }

})

EventReceiver.prototype.on = EventReceiver.prototype.addListener