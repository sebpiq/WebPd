var assert = require('assert')
  , chai = require('chai')
  , expect = chai.expect
  , chaiStats = require('chai-stats')
  , _ = require('underscore')
  , portlets = require('../../lib/objects/portlets')
  , Patch = require('../../lib/core/Patch')
  , Pd = require('../../index')
  , pdGlob = require('../../lib/global')
  , TestingMailBox = require('./utils').TestingMailBox
chai.use(chaiStats)

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

  describe('.DspInlet', function() {

    var blockSizeMem

    before(function() {
      blockSizeMem = pdGlob.settings.blockSize
      pdGlob.settings.blockSize = 3
    })

    after(function() {
      pdGlob.settings.blockSize = pdGlob.settings.blockSize
    })

    it('should sum values from all inputs', function() {
      var dummySource = {}
        , dummySink = {}
        , MyDspOutlet = portlets.Outlet.extend({
          _tick: function() { return [this.val, this.val, this.val] }
        })
        , dummyOutlet1 = new MyDspOutlet(dummySource, 0)
        , dummyOutlet2 = new MyDspOutlet(dummySource, 0)
        , dummyOutlet3 = new MyDspOutlet(dummySource, 0)
        , inlet = new portlets.DspInlet(dummySink, 0)
        , block
      dummyOutlet1.val = 0.1
      dummyOutlet2.val = 0.05
      dummyOutlet3.val = 0.002
      
      block = inlet._tick()
      expect(_.toArray(block)).to.almost.eql([0, 0, 0], 5)

      dummyOutlet1.connect(inlet)
      block = inlet._tick()
      expect(_.toArray(block)).to.almost.eql([0.1, 0.1, 0.1], 5)

      dummyOutlet2.connect(inlet)
      block = inlet._tick()
      expect(_.toArray(block)).to.almost.eql([0.15, 0.15, 0.15], 5)

      dummyOutlet3.connect(inlet)
      block = inlet._tick()
      expect(_.toArray(block)).to.almost.eql([0.152, 0.152, 0.152], 5)
    })

  })

  describe('.DspOutlet', function() {
    
    it('should pull the audio once and cache it after', function() {
      var dummyObj = {
          _tick: function() {
            pulledCounter++
            return theBlock
          }
        }
        , outlet = new portlets.DspOutlet(dummyObj, 0)
        , pulledCounter = 0
        , theBlock = [1, 2, 3, 4]
        , actualBlock

      pdGlob.clock.time = 12
      assert.deepEqual(outlet._cachedBlock, {time: -1, block: null})

      // First _tick, the block should be cached
      actualBlock = outlet._tick()
      assert.equal(actualBlock, theBlock)
      assert.equal(outlet._cachedBlock.time, 12)
      assert.equal(outlet._cachedBlock.block, theBlock)
      assert.equal(pulledCounter, 1)

      // Second _tick, same time, node._tick shouldn't be called again
      actualBlock = outlet._tick()
      assert.equal(actualBlock, theBlock)
      assert.equal(outlet._cachedBlock.time, 12)
      assert.equal(outlet._cachedBlock.block, theBlock)
      assert.equal(pulledCounter, 1)

      // Time moved, now a new block should be returned
      pdGlob.clock.time = 23
      actualBlock = outlet._tick()
      assert.equal(actualBlock, theBlock)
      assert.equal(outlet._cachedBlock.time, 23)
      assert.equal(outlet._cachedBlock.block, theBlock)
      assert.equal(pulledCounter, 2)

    })

  })

  describe('[outlet] / [inlet] / [outlet~] / [inlet~]', function() {

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
