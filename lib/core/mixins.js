var expect = require('chai').expect
  , pdGlob = require('../global')


// Simple mixin for named objects, such as [send] or [table]
// This also requires the object to be an EventEmitter.
exports.NamedMixin = {

  nameIsUnique: false,

  setName: function(name) {
    expect(name).to.be.a('string', 'name')
    var oldName = this.name
    this.name = name
    pdGlob.namedObjects.register(this, this.type, name, this.nameIsUnique, oldName)
    this.emit('changed:name', oldName, name)
  }

}