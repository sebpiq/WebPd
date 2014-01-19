var assert = require('assert')
  , _ = require('underscore')
  , portlets = require('../../lib/objects/portlets')
  , Patch = require('../../lib/core/Patch')
  , Pd = require('../../index')
  , TestingMailBox = require('./utils').TestingMailBox

describe('objects.portlets', function() {

  describe('.Inlet', function() {

    var dummyObj = {
      message: function() {
        this.received.push(_.toArray(arguments))
      },
      received: []
    }

    describe('.message', function() {

      it('should transmit messages to the object', function() {
        var inlet0 = new portlets.Inlet(dummyObj, 0)
          , inlet1 = new portlets.Inlet(dummyObj, 1)
          , inlet2 = new portlets.Inlet(dummyObj, 2)

        inlet0.message('a', 'b')
        assert.deepEqual(dummyObj.received, [[0, 'a', 'b']])
        inlet2.message('c')
        assert.deepEqual(dummyObj.received, [[0, 'a', 'b'], [2, 'c']])
      })
    })

  })

  describe('#[outlet], [inlet], [outlet~], [inlet~]', function() {

    it('should update the patch\'s portlets', function() {
      var patch = new Patch
      assert.deepEqual(patch.inlets, [])

      var outletObj = new Pd.lib['outlet'](patch)
        , inletDspObj = new Pd.lib['inlet~'](patch)
      assert.deepEqual(patch.inlets, [inletDspObj.inlets[0]])
      assert.deepEqual(patch.outlets, [outletObj.outlets[0]])
    })

    it('should transmit messages from outside / inside of the patch', function() {
      var patch = new Patch
        , subpatch = new Patch(patch)
        , mailbox1 = new TestingMailBox(patch)
        , mailbox2 = new TestingMailBox(subpatch)
        , mailbox3 = new TestingMailBox(patch)
        , inlet = new Pd.lib['inlet'](subpatch)
        , outlet = new Pd.lib['outlet'](subpatch)

      mailbox1.o(0).connect(subpatch.i(0))
      mailbox2.i(0).connect(inlet.o(0))
      mailbox2.o(0).connect(outlet.i(0))
      mailbox3.i(0).connect(subpatch.o(0))
      
      mailbox1.i(0).message('bla', 111)
      assert.deepEqual(mailbox1.received, [['bla', 111]])
      assert.deepEqual(mailbox2.received, [['bla', 111]])
      assert.deepEqual(mailbox3.received, [['bla', 111]])

      mailbox2.i(0).message('blo', 222)
      assert.deepEqual(mailbox2.received, [['bla', 111], ['blo', 222]])
      assert.deepEqual(mailbox3.received, [['bla', 111], ['blo', 222]])
    }) 

  })


})
