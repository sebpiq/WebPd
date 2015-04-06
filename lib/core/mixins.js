var EventEmitter = require('events').EventEmitter
  , _ = require('underscore')
  , expect = require('chai').expect
  , pdGlob = require('../global')


// Simple mixin for named objects, such as [send] or [table]
// This also requires the object to be an EventEmitter.
exports.NamedMixin = {

  nameIsUnique: false,

  setName: function(name) {
    expect(name).to.be.a('string', 'name')
    var oldName = this.name
    this.emit('changing:name', oldName, name)
    this.name = name
    pdGlob.namedObjects.register(this, this.type, name, this.nameIsUnique, oldName)
    this.emit('changed:name', oldName, name)
  },

  clean: function() {
    pdGlob.namedObjects.unregister(this, this.type, this.name)
  }

}


// A mixin for objects that reference another named object, such as [tabread~] or [delread~]
// Everytime for any reason the `resolved` of the reference changes, "changed" is emitted,
// with arguments (newResolved, oldResolved)
var Reference = exports.Reference = function(referencedType) {
  this.referencedType = referencedType
  this._onNewObject = null
  this._onChangedName = null
  this.resolved = null
  this._eventName = 'namedObjects:registered:' + this.referencedType
}

_.extend(Reference.prototype, EventEmitter.prototype, {

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
      pdGlob.emitter.on(this._eventName, this._onNewObject)
    }
  },

  _setResolved: function(newObj) {
    var self = this
      , oldObj = this.resolved
    this.resolved = newObj

    if (oldObj) oldObj.removeListener('changing:name', self._onChangedName)

    if (newObj) {
      this._onChangedName = function() { self._setResolved(null) }
      newObj.on('changing:name', this._onChangedName)
    }
    this.emit('changed', newObj, oldObj)
  },

  _stopListening: function() {
    if (this._onNewObject) {
      pdGlob.emitter.removeListener(this._eventName, this._onNewObject)
      this._onNewObject = null
    }
  }

})