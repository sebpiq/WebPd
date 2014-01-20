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


module.exports.chainExtend = function() {
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


// Hack to be able to instantiate a new object "apply-style"
module.exports.apply = function(constr, args) {
  var F = function() { return constr.apply(this, args) }
  F.prototype = constr.prototype
  return new F()
}


// Simple mixin to add functionalities for generating unique ids.
// Each object extended with this mixin has a separate id counter.
// Therefore ids are not unique globally but unique for object.
module.exports.UniqueIdsMixin = {

  // Every time it is called, this method returns a new unique id.
  _generateId: function() {
    this._idCounter++
    return this._idCounter
  },

  // Counter used internally to assign a unique id to objects
  // this counter should never be decremented to ensure the id unicity
  _idCounter: -1
}


// Scheduler to handle timing
var Clock = module.exports.Clock = function(lookAheadTime) {
  this.time = 0
  this.lookAheadTime = lookAheadTime || 0
  this._events = []
}

_.extend(Clock.prototype, {

  schedule: function(func, relTime, isRepeated) {
    var event = {
      func: func,
      time: this.time + relTime,
      isRepeated: isRepeated || false,
      repeatTime: relTime
    }
    this._insertEvent(event)
    return event
  },

  unschedule: function(event) {
    this._removeEvent(event)
  },

  _tick: function() {
    var event = this._events.shift()

    while(event && event.time <= this.time + this.lookAheadTime) {
      event.func()
      if (event.isRepeated) {
        event.time = event.time + event.repeatTime
        this._insertEvent(event)
      }
      event = this._events.shift()
    }

    // Put back the last event
    if(event) this._events.unshift(event)
  },

  // Inserts an event to the list
  _insertEvent: function(event) {
    this._events.splice(this._indexByTime(event.time), 0, event)
  },

  // Removes an event from the list
  _removeEvent: function(event) {
    var ind = this._events.indexOf(event)
    if (ind !== -1) this._events.splice(ind, 1)
  },

  // Returns the index of the first event whose time is >= to `time`
  _indexByTime: function(time) {
    return _.sortedIndex(this._events, {time: time}, function(e) { return e.time })
  }

})


// Simple mixin for named objects, such as [send] or [table] 
module.exports.NamedMixin = {

  nameIsUnique: false,

  setName: function(name) {
    // This method is a simple hack to register the object
    // first time the name is set.
    this._setName(name)
    require('../global').namedObjects.register(this)
    this.setName = this._setName
  },

  _setName: function(name) {
    var oldName = this.name
    expect(name).to.be.a('string', 'name')
    this.name = name
    this.emit('change:name', oldName, name)
  }

}

// Store for named objects. Objects are stored by pair (<obj.type>, <obj.name>)
var NamedObjectStore = module.exports.NamedObjectStore = function() {
  this._store = {}
}

_.extend(NamedObjectStore.prototype, {

  // Registers a named object in the store.
  register: function(obj) {
    var self = this
    var storeNamedObject = function(oldName, newName) {
      var objType = obj.type
        , nameMap
        , objList
      self._store[objType] = nameMap = self._store[objType] || {}
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

  // Returns an object list given the object `type` and `name`.
  get: function(type, name) {
    return ((this._store[type] || {})[name] || [])
  }

})
