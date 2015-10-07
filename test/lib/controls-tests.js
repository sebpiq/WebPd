var assert = require('assert')
  , path = require('path')
  , fs = require('fs')
  , _ = require('underscore')
  , waatest = require('waatest')
  , Pd = require('../../index')
  , PdObject = require('../../lib/core/PdObject')
  , Patch = require('../../lib/core/Patch')
  , portlets = require('../../lib/waa/portlets')
  , pdGlob = require('../../lib/global')
  , helpers = require('../helpers')


describe('controls', function() {  

  var patch

  beforeEach(function() {
    patch = Pd.createPatch()
    helpers.beforeEach()
  })

  afterEach(function() { helpers.afterEach() })

  describe('BaseControl', function() {

    it('should receive and send to the given destinations', function() {
      var bng = patch.createObject('bng', [0, 'rrr', 'sss'])
        , receive = patch.createObject('receive', ['sss'])
        , send = patch.createObject('send', ['rrr'])
        , mailbox = patch.createObject('testingmailbox')
      receive.o(0).connect(mailbox.i(0))
      send.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [['bang']])
    })

    it('should clean the event handler on destroying', function() {
      var bng = patch.createObject('bng', [0, 'rrr'])
        , send = patch.createObject('send', ['rrr'])
        , mailbox = patch.createObject('testingmailbox')
      bng.o(0).connect(mailbox.i(0))
      
      send.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [['bang']])

      bng.destroy()
      send.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [['bang']])
    })

    it('should send and receive properly - test with a parsed patch', function() {
      var patchStr = fs.readFileSync(path.resolve(
        __dirname, 'patches', 'send-rcv-controls.pd')).toString()

      var patch = Pd.loadPatch(patchStr)
        , send = patch.objects[0]
        , receive = patch.objects[1]
        , rcvNb = patch.objects[2]
        , sendNb = patch.objects[3]
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')

      rcvNb.o(0).connect(mailbox1.i(0))
      receive.o(0).connect(mailbox2.i(0))

      send.i(0).message([123])
      assert.deepEqual(mailbox1.received, [[123]])
      assert.deepEqual(mailbox2.received, [])
      
      sendNb.i(0).message([456])
      assert.deepEqual(mailbox1.received, [[123]])
      assert.deepEqual(mailbox2.received, [[456]])
    })

    it('should set default value if init is false, even if init value is set', function() {
      var tgl = patch.createObject('tgl', [0, '-', '-', 21, 21])
      assert.equal(tgl.value, 0)
    })

    it('should set initial value if init is true', function() {
      var tgl = patch.createObject('tgl', [1, '-', '-', 21, 21])
      assert.equal(tgl.value, 21)
    })

  })

  describe('[symbolatom]', function() {

    it('should output "symbol" by default', function() {
      var symbolatom = patch.createObject('symbolatom')
        , mailbox = patch.createObject('testingmailbox')
      symbolatom.o(0).connect(mailbox.i(0))

      symbolatom.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [['symbol', 'symbol']])
    })

    it('should output "float" if number', function() {
      var symbolatom = patch.createObject('symbolatom', [1])
        , mailbox = patch.createObject('testingmailbox')
      symbolatom.o(0).connect(mailbox.i(0))

      symbolatom.i(0).message([12])      
      assert.deepEqual(mailbox.received, [['symbol', 'float']])
    })

    it('should output the string if symbol', function() {
      var symbolatom = patch.createObject('symbolatom', [1])
        , mailbox = patch.createObject('testingmailbox')
      symbolatom.o(0).connect(mailbox.i(0))

      symbolatom.i(0).message(['symbol', 'bla'])
      assert.deepEqual(mailbox.received, [['symbol', 'bla']])
    })

    it('should output the latest message if receiving bang', function() {
      var symbolatom = patch.createObject('symbolatom', [1])
        , mailbox = patch.createObject('testingmailbox')
      symbolatom.o(0).connect(mailbox.i(0))

      symbolatom.i(0).message([12])
      symbolatom.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [['symbol', 'float'], ['symbol', 'float']])
    })

    it('should cancel started handler when calling destroy', function() {
      var bng0 = patch.createObject('symbolatom', [0])
        , bng1 = patch.createObject('symbolatom', [1])
        , mailbox = patch.createObject('testingmailbox')
      bng1.o(0).connect(mailbox.i(0))
      bng1.destroy()
      bng0.destroy()
      patch.start()
      assert.deepEqual(mailbox.received, [])
    })

    it('should preserve message time tag', function() {
      helpers.assertPreservesTimeTag(patch.createObject('symbolatom'), ['symbol', 'bla'])
    })

  })

  describe('[floatatom]/[nbx]/[hsl]/[vsl]', function() {

    it('should have 0 as default value', function() {
      var floatatom = patch.createObject('floatatom')
        , mailbox = patch.createObject('testingmailbox')
      
      floatatom.o(0).connect(mailbox.i(0))
      floatatom.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[0]])
    })

    it('should output and save the value received if number', function() {
      var floatatom = patch.createObject('floatatom', [0, 0, '-', '-'])
        , mailbox = patch.createObject('testingmailbox')
      floatatom.o(0).connect(mailbox.i(0))

      floatatom.i(0).message([23])
      assert.deepEqual(mailbox.received, [[23]])

      floatatom.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[23], [23]])
    })

    it('should be limited between min and max', function() {
      var floatatom = patch.createObject('floatatom', [-6, 7])
        , mailbox = patch.createObject('testingmailbox')
      floatatom.o(0).connect(mailbox.i(0))

      floatatom.i(0).message([-8])
      assert.deepEqual(mailbox.received, [[-6]])
      
      floatatom.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[-6], [-6]])

      floatatom.i(0).message([10])
      assert.deepEqual(mailbox.received, [[-6], [-6], [7]])
    })

    it('should set the initial value properly', function() {
      var nbx = patch.createObject('nbx', [undefined, undefined, 1, '-', '-', 778877])
        , mailbox = patch.createObject('testingmailbox')
      nbx.o(0).connect(mailbox.i(0))

      nbx.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[778877]])
    })

    describe('[hsl]/[vsl]', function() {
      
      it('should work properly', function() {
        var hsl = patch.createObject('hsl', [undefined, undefined, 1, '-', '-', 5])
          , mailbox = patch.createObject('testingmailbox')
        hsl.o(0).connect(mailbox.i(0))

        hsl.i(0).message(['bang'])
        assert.deepEqual(mailbox.received, [[5]])

        hsl.i(0).message([-1])
        assert.deepEqual(mailbox.received, [[5], [0]])

        hsl.i(0).message([200])
        assert.deepEqual(mailbox.received, [[5], [0], [127]])
      })
    
    })

    it('should preserve message time tag', function() {
      helpers.assertPreservesTimeTag(patch.createObject('nbx'), [9])
    })

  })

  describe('[bng]', function() {

    it('should output bang', function() {
      var bng = patch.createObject('bng')
        , mailbox = patch.createObject('testingmailbox')
      bng.o(0).connect(mailbox.i(0))

      bng.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [['bang']])
    })

    it('should send bang on start if init is true', function() {
      var bng = patch.createObject('bng', [1])
        , mailbox = patch.createObject('testingmailbox')
      bng.o(0).connect(mailbox.i(0))
      patch.start()
      assert.deepEqual(mailbox.received, [['bang']])
    })

    it('should cancel started handler when calling destroy', function() {
      var bng0 = patch.createObject('bng', [0])
        , bng1 = patch.createObject('bng', [1])
        , mailbox = patch.createObject('testingmailbox')
      bng1.o(0).connect(mailbox.i(0))
      bng1.destroy()
      bng0.destroy()
      patch.start()
      assert.deepEqual(mailbox.received, [])
    })

    it('should preserve message time tag', function() {
      helpers.assertPreservesTimeTag(patch.createObject('bng'), ['bang'])
    })

  })

  describe('[tgl]', function() {

    it('should toggle between 0 and non-zero value when receiving bang', function() {
      var tgl = patch.createObject('tgl')
        , mailbox = patch.createObject('testingmailbox')
      tgl.o(0).connect(mailbox.i(0))

      tgl.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[1]])

      tgl.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[1], [0]])
    })

    it('should pass non-zero floats directly to output', function() {
      var tgl = patch.createObject('tgl')
        , mailbox = patch.createObject('testingmailbox')
      tgl.o(0).connect(mailbox.i(0))

      tgl.i(0).message([23])
      assert.deepEqual(mailbox.received, [[23]])

      tgl.i(0).message([66])
      assert.deepEqual(mailbox.received, [[23], [66]])
    })

    it('should send initial value on start if init is true', function() {
      var tgl = patch.createObject('tgl', [1, 'empty', 'empty', 12])
        , mailbox = patch.createObject('testingmailbox')
      tgl.o(0).connect(mailbox.i(0))
      patch.start()
      assert.deepEqual(mailbox.received, [[12]])
    })

    it('should send non-zero value when toggle active', function() {
      var tgl = patch.createObject('tgl', [1, 'empty', 'empty', 0, 123])
        , mailbox = patch.createObject('testingmailbox')
      tgl.o(0).connect(mailbox.i(0))

      tgl.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[123]])

      tgl.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[123], [0]])
    })

    it('should cancel started handler when calling destroy', function() {
      var tgl0 = patch.createObject('tgl', [0])
        , tgl1 = patch.createObject('tgl', [1])
        , mailbox = patch.createObject('testingmailbox')
      tgl1.o(0).connect(mailbox.i(0))
      tgl1.destroy()
      tgl0.destroy()
      patch.start()
      assert.deepEqual(mailbox.received, [])
    })

    it('should preserve message time tag', function() {
      helpers.assertPreservesTimeTag(patch.createObject('tgl'), ['bang'])
    })

  })

  describe('[hradio]/[vradio]', function() {

    it('should set the radio and output the value', function() {
      var hradio = patch.createObject('hradio', [0, 0, 7])
        , mailbox = patch.createObject('testingmailbox')
      hradio.o(0).connect(mailbox.i(0))

      hradio.i(0).message([3])
      assert.deepEqual(mailbox.received, [[3]])

      hradio.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[3], [3]])
    })

    it('should round and limit the number to within the radio range', function() {
      var hradio = patch.createObject('hradio', [0, 0, 5])
        , mailbox = patch.createObject('testingmailbox')
      hradio.o(0).connect(mailbox.i(0))

      hradio.i(0).message([67])
      assert.deepEqual(mailbox.received, [[4]])
      hradio.i(0).message([-56])
      assert.deepEqual(mailbox.received, [[4], [0]])
      hradio.i(0).message([3.6])
      assert.deepEqual(mailbox.received, [[4], [0], [3]])
    })

    it('should preserve message time tag', function() {
      helpers.assertPreservesTimeTag(patch.createObject('hradio'), [2])
    })

  })

  describe('[vu]', function() {

    it('should output what it receives', function() {
      var vu = patch.createObject('vu')
        , mailbox = patch.createObject('testingmailbox')
      vu.o(0).connect(mailbox.i(0))

      vu.i(0).message([5])
      assert.deepEqual(mailbox.received, [[5]])

      vu.i(0).message([5656])
      assert.deepEqual(mailbox.received, [[5], [5656]])
    })

    it('should preserve message time tag', function() {
      helpers.assertPreservesTimeTag(patch.createObject('vu'), [789])
    })

  })
})