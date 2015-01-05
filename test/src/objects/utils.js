var assert = require('assert')
  , _ = require('underscore')
  , portlets = require('../../../lib/objects/portlets')
  , PdObject = require('../../../lib/core/PdObject')


exports.TestingMailBox = PdObject.extend({
  type: 'TestingMailBox',
  init: function() { this.received = [] },
  inletDefs: [
    portlets.Inlet.extend({
      message: function(args) {
        this.obj.outlets[0].message(args)
        this.obj.received.push(args)
      }
    })
  ],
  outletDefs: [ portlets.Outlet ]
})
