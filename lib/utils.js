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


module.exports.NamedMixin = {

  nameIsUnique: false,

  setName: function(name) {
    // This method is a simple hack to register the object
    // first time the name is set.
    this._setName(name)
    require('../index').registerNamedObject(this)
    this.setName = this._setName
  },

  _setName: function(name) {
    var oldName = this.name
    expect(name).to.be.a('string', 'name')
    this.name = name
    this.emit('change:name', oldName, name)
  }

}
