var assert = require('assert')
  , _ = require('underscore')
  , portlets = require('../../../lib/objects/portlets')
  , PdObject = require('../../../lib/core/PdObject')

exports.TestingMailBox = PdObject.extend({
  type: 'TestingMailBox',
  init: function() { this.received = [] },
  inletDefs: [
    portlets.Inlet.extend({
      message: function() {
        var outlet = this.obj.outlets[0]
        this.obj.received.push(_.toArray(arguments))
        outlet.message.apply(outlet, arguments)
      }
    })
  ],
  outletDefs: [ portlets.Outlet ]
})
