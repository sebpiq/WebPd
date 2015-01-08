var assert = require('assert')
  , _ = require('underscore')
  , Pd = require('../../../index')
  , Patch = require('../../../lib/core/Patch')
  , portlets = require('../../../lib/objects/portlets')
  , pdGlob = require('../../../lib/global')
  , helpers = require('../../helpers')
  , TestingMailBox = require('./utils').TestingMailBox


describe('objects.glue', function() {  

  var patch

  beforeEach(function() {
    patch = Pd.createPatch()
    pdGlob.library['testingmailbox'] = TestingMailBox
    Pd.start()
  })

  afterEach(function() { helpers.afterEach() })

  describe('[send] / [receive]', function() {
    var send1, send2
      , receive1, receive1bis, receive2
      , mailbox1, mailbox1bis, mailbox2

    beforeEach(function() {
      send1 = patch.createObject('send', ['no1'])
      send2 = patch.createObject('send', ['no2'])

      receive1 = patch.createObject('receive', ['no1'])
      receive1bis = patch.createObject('receive', ['no1'])
      receive2 = patch.createObject('receive', ['no2'])

      mailbox1 = patch.createObject('testingmailbox')
      mailbox1bis = patch.createObject('testingmailbox')
      mailbox2 = patch.createObject('testingmailbox')

      receive1.o(0).connect(mailbox1.i(0))
      receive1bis.o(0).connect(mailbox1bis.i(0))
      receive2.o(0).connect(mailbox2.i(0))
    })

    it('should send messages through inlet to all receivers', function() {
      send1.i(0).message(['bla', 'bli', 'blu'])
      assert.deepEqual(mailbox1.received, [['bla', 'bli', 'blu']])
      assert.deepEqual(mailbox1bis.received, [['bla', 'bli', 'blu']])
      assert.deepEqual(mailbox2.received, [])
    })

    it('should send messages to Pd.receive as well', function() {
      var received = []
      Pd.receive('no2', function(args) { received.push(args) })
      Pd.send('no2', ['bla', 888])
      assert.deepEqual(mailbox1.received, [])
      assert.deepEqual(mailbox1bis.received, [])
      assert.deepEqual(mailbox2.received, [['bla', 888]])
      assert.deepEqual(received, [['bla', 888]])
    })

    it('should send messages to Pd.receive as well', function() {
      // First change only receiver name
      receive1.setName('num1')
      send1.i(0).message(['blop', 'blep', 'blup'])
      assert.deepEqual(mailbox1.received, [])

      // Then change also sender name
      send1.setName('num1')
      send1.i(0).message([1, 11, 111])
      assert.deepEqual(mailbox1.received, [[1, 11, 111]])
    })
  })

  describe('[msg]', function() {

    it('should transmits always the same message if no $-args', function() {
      var msg = patch.createObject('msg', [11, '22'])
        , mailbox = patch.createObject('testingmailbox')
      msg.o(0).connect(mailbox.i(0))

      msg.i(0).message([22])
      assert.deepEqual(mailbox.received, [[11, '22']])

      msg.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[11, '22'], [11, '22']])

      msg.i(0).message(['bla', 123])
      assert.deepEqual(mailbox.received, [[11, '22'], [11, '22'], [11, '22']])
    })

    it('should resolve $-args', function() {
      var msg = patch.createObject('msg', ['$1', 33, '$0', '$3-HA'])
        , mailbox = patch.createObject('testingmailbox')
      msg.o(0).connect(mailbox.i(0))

      msg.i(0).message([22, 'bloblo', 44, 'blibli', 66])
      assert.deepEqual(mailbox.received, [[22, 33, 0, '44-HA']])

      msg.i(0).message(['bloblo', 'bleble', 'blybly'])
      assert.deepEqual(mailbox.received, [[22, 33, 0, '44-HA'], ['bloblo', 33, 0, 'blybly-HA']])
    })

    it('should raise an error if $-arg out of range', function() {
      var msg = patch.createObject('msg', ['$1', 33, '$0', '$3-HA'])
      assert.throws(function() { msg.i(0).message(['ouch', 'ich']) })
      assert.throws(function() { msg.i(0).message([11]) })
      assert.throws(function() { msg.i(0).message(['bang']) })
    })

  })

  describe('[text]', function() {

    it('should create rightly', function() {
      var text = patch.createObject('text')
        , textBla = patch.createObject('text', ['Je suis un texte'])
      assert.equal(textBla.text, 'Je suis un texte')
    })

  })

  describe('[loadbang]', function() {

    it('should send bang on load', function() {
      var loadbang = patch.createObject('loadbang')
        , mailbox = patch.createObject('testingmailbox')
      loadbang.o(0).connect(mailbox.i(0))
      loadbang.load()
      assert.deepEqual(mailbox.received, [['bang']])
    })

  })

  describe('[+]', function() {

    it('should have 0 as a default value', function() {
      var add = patch.createObject('+')
        , mailbox = patch.createObject('testingmailbox')
      add.o(0).connect(mailbox.i(0))
      
      add.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[0]])
      
      add.i(0).message([12])
      assert.deepEqual(mailbox.received, [[0], [12]])
    })

    it('should take an initial value as argument', function() {
      var add = patch.createObject('+', [9])
        , mailbox = patch.createObject('testingmailbox')
      add.o(0).connect(mailbox.i(0))

      add.i(0).message([11.5])
      assert.deepEqual(mailbox.received, [[20.5]])
      
      add.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[20.5], [20.5]])
    })

    it('should change the value if message on inlet 1', function() {
      var add = patch.createObject('+', [9])
        , mailbox = patch.createObject('testingmailbox')
      add.o(0).connect(mailbox.i(0))

      add.i(1).message([118.78])
      add.i(0).message([23.5])

      assert.deepEqual(mailbox.received, [[142.28]])
    })

  })

  describe('[-]', function() {
    // This uses the same code as [+] so no need for full tests

    it('should just work', function() {
      var sub = patch.createObject('-', [10])
        , mailbox = patch.createObject('testingmailbox')
      sub.o(0).connect(mailbox.i(0))
      
      sub.i(0).message([12])
      assert.deepEqual(mailbox.received, [[2]])
    })

  })

  describe('[*]', function() {
    // This uses the same code as [+] so no need for full tests

    it('should just work', function() {
      var mult = patch.createObject('*', [11])
        , mailbox = patch.createObject('testingmailbox')
      mult.o(0).connect(mailbox.i(0))
      
      mult.i(0).message([3])
      assert.deepEqual(mailbox.received, [[33]])
    })

  })

  describe('[/]', function() {
    // This uses the same code as [+] so no need for full tests

    it('should just work', function() {
      var div = patch.createObject('/', [4])
        , mailbox = patch.createObject('testingmailbox')
      div.o(0).connect(mailbox.i(0))
      
      div.i(0).message([44])
      assert.deepEqual(mailbox.received, [[11]])
    })

  })

  describe('[mod]', function() {
    // This uses the same code as [+] so no need for full tests

    it('should just work', function() {
      var mod = patch.createObject('%', [11])
        , mailbox = patch.createObject('testingmailbox')
      mod.o(0).connect(mailbox.i(0))
      
      mod.i(0).message([46])
      assert.deepEqual(mailbox.received, [[2]])
    })

  })

  describe('[float]', function() {

    it('should have 0 as default value', function() {
      var float = patch.createObject('float')
        , mailbox = patch.createObject('testingmailbox')
      float.o(0).connect(mailbox.i(0))

      float.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[0]])
    })

    it('should output values previously received', function() {
      var float = patch.createObject('float')
        , mailbox = patch.createObject('testingmailbox')
      float.o(0).connect(mailbox.i(0))

      float.i(0).message([2])
      assert.deepEqual(mailbox.received, [[2]])
      
      float.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[2], [2]])
    })

    it('should set the creation argument as initial value', function() {
      var float = patch.createObject('float', [6])
        , mailbox = patch.createObject('testingmailbox')
      float.o(0).connect(mailbox.i(0))

      float.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[6]])
    })

    it('should change the value when sending to inlet 1', function() {
      var float = patch.createObject('float')
        , mailbox = patch.createObject('testingmailbox')
      float.o(0).connect(mailbox.i(0))

      float.i(1).message([3])
      float.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[3]])

      float.i(1).message([4])
      float.i(0).message([5])
      assert.deepEqual(mailbox.received, [[3], [5]])
    })

  })

  describe('[spigot]', function() {

    it('should block or let through messages from inlet 0', function() {
      var spigot = patch.createObject('spigot')
        , mailbox = patch.createObject('testingmailbox')
      spigot.o(0).connect(mailbox.i(0))

      spigot.i(0).message([1, 23, 'bla'])
      assert.deepEqual(mailbox.received, [])

      spigot.i(1).message([1])
      spigot.i(0).message([1, 23, 'bla'])
      assert.deepEqual(mailbox.received, [[1, 23, 'bla']])

      spigot.i(1).message([0])
      spigot.i(0).message([2266])
      assert.deepEqual(mailbox.received, [[1, 23, 'bla']])
    })

    it('should accept argument as initial value', function() {
      var spigot = patch.createObject('spigot', [8])
        , mailbox = patch.createObject('testingmailbox')
      spigot.o(0).connect(mailbox.i(0))

      spigot.i(0).message(['2266'])
      assert.deepEqual(mailbox.received, [['2266']])
    })

  })

  describe('[trigger]', function() {

    it('should be [trigger bang bang] by default', function() {
      var trigger = patch.createObject('trigger')
        , mailbox = patch.createObject('testingmailbox')

      assert.equal(trigger.outlets.length, 2)
      trigger.o(0).connect(mailbox.i(0))
      trigger.o(1).connect(mailbox.i(0))

      trigger.i(0).message([1, 2, 3])
      assert.deepEqual(mailbox.received, [['bang'], ['bang']])
    })

    it('should output the right type', function() {
      var trigger = patch.createObject('trigger', ['float', 'bang', 'symbol', 'list', 'anything'])
        , mailbox = patch.createObject('testingmailbox')

      assert.deepEqual(trigger.outlets.length, 5)
      trigger.o(0).connect(mailbox.i(0))
      trigger.o(1).connect(mailbox.i(0))
      trigger.o(2).connect(mailbox.i(0))
      trigger.o(3).connect(mailbox.i(0))
      trigger.o(4).connect(mailbox.i(0))

      trigger.i(0).message([1])
      assert.deepEqual(mailbox.received, [[1], [1], ['float'], ['bang'], [1]])
      mailbox.received = []

      trigger.i(0).message([1, 'pol', 3])
      assert.deepEqual(mailbox.received, [[1, 'pol', 3], [1, 'pol', 3], ['float'], ['bang'], [1]])
      mailbox.received = []

      trigger.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [['bang'], ['bang'], ['symbol'], ['bang'], [0]])
    })

  })

  describe('[pack]', function() {

    it('should by default be [pack f f]', function() {
      var pack = patch.createObject('pack')
        , mailbox = patch.createObject('testingmailbox')
      assert.equal(pack.inlets.length, 2)
      pack.o(0).connect(mailbox.i(0))

      pack.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[0, 0]])
      
      pack.i(1).message([1])
      assert.deepEqual(mailbox.received, [[0, 0]])

      pack.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[0, 0], [0, 1]])

      pack.i(0).message([2])
      assert.deepEqual(mailbox.received, [[0, 0], [0, 1], [2, 1]])
    })

    it('should pack with the right type', function() {
      var pack = patch.createObject('pack', ['symbol', 's', 'f', 'float', 100, 'bla'])
        , mailbox = patch.createObject('testingmailbox')
      assert.equal(pack.inlets.length, 6)
      pack.o(0).connect(mailbox.i(0))

      pack.i(0).message(['prout'])
      assert.deepEqual(mailbox.received, [['prout', 'symbol', 0, 0, 100, 'bla']])
      mailbox.received = []

      pack.i(1).message(['blo'])
      pack.i(2).message([999])
      pack.i(3).message([3])
      pack.i(4).message([101])
      pack.i(5).message(['blu'])
      assert.deepEqual(mailbox.received, [])

      pack.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [['prout', 'blo', 999, 3, 101, 'blu']])
    })

  })

})
