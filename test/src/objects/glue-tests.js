var assert = require('assert')
  , _ = require('underscore')
  , waatest = require('waatest')
  , Pd = require('../../../index')
  , Patch = require('../../../lib/core/Patch')
  , portlets = require('../../../lib/objects/portlets')
  , pdGlob = require('../../../lib/global')
  , helpers = require('../../helpers')


describe('objects.glue', function() {  

  var patch

  var dummyAudio = {
    start: function() {},
    stop: function() {},
    decode: function(audioData, done) { done(null, audioData) }
  }

  var dummyStorage = {
    get: function(uri, done) {
      if (this.data !== null) done(null, this.data)
      else done(new Error('bla'), null)
    },
    data: [new Float32Array([1, 2, 3, 4])]
  }

  beforeEach(function() {
    patch = Pd.createPatch()
    Pd.start({ audio: dummyAudio, storage: dummyStorage })
    helpers.beforeEach()
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

  describe('[select]', function() {

    it('should create by default [sel 0]', function() {
      var select = patch.createObject('select')
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
      
      assert.equal(select.inlets.length, 2)
      assert.equal(select.outlets.length, 2)
      select.o(0).connect(mailbox1.i(0))
      select.o(1).connect(mailbox2.i(0))

      select.i(0).message([33])
      assert.deepEqual(mailbox1.received, [])
      assert.deepEqual(mailbox2.received, [[33]])

      select.i(0).message([0])
      assert.deepEqual(mailbox1.received, [['bang']])
      assert.deepEqual(mailbox2.received, [[33]])
    })

    it('should change the filter if only one arg and sending a message to inlet 1', function() {
      var select = patch.createObject('select', ['bla'])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')

      assert.equal(select.inlets.length, 2)
      assert.equal(select.outlets.length, 2)
      select.o(0).connect(mailbox1.i(0))
      select.o(1).connect(mailbox2.i(0))

      select.i(0).message([33])
      assert.deepEqual(mailbox1.received, [])
      assert.deepEqual(mailbox2.received, [[33]])

      select.i(0).message(['bla'])
      assert.deepEqual(mailbox1.received, [['bang']])
      assert.deepEqual(mailbox2.received, [[33]])
      mailbox1.received = []
      mailbox2.received = []

      select.i(1).message([1234])
      select.i(0).message(['bla'])
      assert.deepEqual(mailbox1.received, [])
      assert.deepEqual(mailbox2.received, [['bla']])

      select.i(0).message([1234])
      assert.deepEqual(mailbox1.received, [['bang']])
      assert.deepEqual(mailbox2.received, [['bla']])
    })

    it('should accept more than 1 argument', function() {
      var select = patch.createObject('select', [1, 2, 'bla'])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
        , mailbox4 = patch.createObject('testingmailbox')
      
      assert.equal(select.inlets.length, 1)
      assert.equal(select.outlets.length, 4)
      select.o(0).connect(mailbox1.i(0))
      select.o(1).connect(mailbox2.i(0))
      select.o(2).connect(mailbox3.i(0))
      select.o(3).connect(mailbox4.i(0))

      select.i(0).message([1])
      assert.deepEqual(mailbox1.received, [['bang']])
      assert.deepEqual(mailbox2.received, [])
      assert.deepEqual(mailbox3.received, [])
      assert.deepEqual(mailbox4.received, [])

      select.i(0).message(['bla'])
      assert.deepEqual(mailbox1.received, [['bang']])
      assert.deepEqual(mailbox2.received, [])
      assert.deepEqual(mailbox3.received, [['bang']])
      assert.deepEqual(mailbox4.received, [])

      select.i(0).message(['blablabla'])
      assert.deepEqual(mailbox1.received, [['bang']])
      assert.deepEqual(mailbox2.received, [])
      assert.deepEqual(mailbox3.received, [['bang']])
      assert.deepEqual(mailbox4.received, [['blablabla']])
    })

  })

  describe('[moses]', function() {

    it('should split messages coming-in in 2 flows', function() {
      var moses = patch.createObject('moses', [3.55])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
      moses.o(0).connect(mailbox1.i(0))
      moses.o(1).connect(mailbox2.i(0))

      moses.i(0).message([1])
      assert.deepEqual(mailbox1.received, [[1]])
      assert.deepEqual(mailbox2.received, [])

      moses.i(0).message([3.55])
      assert.deepEqual(mailbox1.received, [[1]])
      assert.deepEqual(mailbox2.received, [[3.55]])

      moses.i(0).message([90])
      assert.deepEqual(mailbox1.received, [[1]])
      assert.deepEqual(mailbox2.received, [[3.55], [90]])
    })

    it('should change the split when sending to inlet 1', function() {
      var moses = patch.createObject('moses', [3.55])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
      moses.o(0).connect(mailbox1.i(0))
      moses.o(1).connect(mailbox2.i(0))

      moses.i(0).message([9])
      assert.deepEqual(mailbox1.received, [])
      assert.deepEqual(mailbox2.received, [[9]])

      moses.i(1).message([9.65])
      moses.i(0).message([9])
      assert.deepEqual(mailbox1.received, [[9]])
      assert.deepEqual(mailbox2.received, [[9]])

      moses.i(0).message([9.7])
      assert.deepEqual(mailbox1.received, [[9]])
      assert.deepEqual(mailbox2.received, [[9], [9.7]])
    })

  })

  describe('[mtof]', function() {

    it('should translate midi to frequency', function() {
      var round = Math.round
        , mtof = patch.createObject('mtof')
        , mailbox = patch.createObject('testingmailbox')
      mtof.o(0).connect(mailbox.i(0))

      // < -1500
      mtof.i(0).message([-1790])
      assert.deepEqual(mailbox.received, [[0]])

      // >= 1500
      mtof.i(0).message([1500])
      assert.equal(round(mailbox.received[1][0]), round(8.17579891564 * Math.exp(0.0577622650 * 1499)))
      mtof.i(0).message([2000])
      assert.equal(round(mailbox.received[2][0]), round(8.17579891564 * Math.exp(0.0577622650 * 1499)))

      // -1500 < val < 1500
      mtof.i(0).message([69])
      assert.equal(round(round(mailbox.received[3][0])), 440)
    })

  })

  describe('[random]', function() {

    it('should output random integer below the max', function() {
      var randObj = patch.createObject('random', [3])
        , mailbox = patch.createObject('testingmailbox')
        , numbers = [0, 0, 0]
        , i
      randObj.o(0).connect(mailbox.i(0))

      for (i = 0; i < 20; i++) {
        randObj.i(0).message(['bang'])
        numbers[mailbox.received.slice(-1)[0][0]]++
      }
      assert.equal(numbers.length, 3)
      assert.notEqual(numbers[0], 0)
      assert.notEqual(numbers[1], 0)
      assert.notEqual(numbers[2], 0)

      randObj.i(1).message([4])
      numbers = [0, 0, 0, 0]
      for (i = 0; i < 20; i++) {
        randObj.i(0).message(['bang'])
        numbers[mailbox.received.slice(-1)[0][0]]++
      }
      assert.equal(numbers.length, 4)
      assert.notEqual(numbers[0], 0)
      assert.notEqual(numbers[1], 0)
      assert.notEqual(numbers[2], 0)
      assert.notEqual(numbers[3], 0)
    })

  })

  describe('[metro]', function() {

    var clock
    beforeEach(function() { clock = new helpers.TestClock() })

    it('shouĺd start/stop the metro when sending to first inlet', function() {
      Pd.stop()
      Pd.start({clock: clock})
      var metro = patch.createObject('metro', [1000])
        , mailbox = patch.createObject('testingmailbox')
      metro.o(0).connect(mailbox.i(0))
      
      clock.tick()
      assert.deepEqual(mailbox.received, [])

      clock.time = 10000
      metro.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [['bang']])

      clock.time = 10900
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang']])

      clock.time = 11000
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang'], ['bang']])

      clock.time = 12000
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang'], ['bang'], ['bang']])

      // stopping metro
      mailbox.received = []
      metro.i(0).message([0])
      clock.time = 13000
      clock.tick()
      assert.deepEqual(mailbox.received, [])

      // metro started again
      metro.i(0).message([123])
      assert.deepEqual(mailbox.received, [['bang']])

      clock.time = 14000
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang'], ['bang']])
    })

    it('should change the rate when sending to the second inlet', function() {
      Pd.stop()
      Pd.start({clock: clock})
      var metro = patch.createObject('metro', [1000])
        , mailbox = patch.createObject('testingmailbox')
      metro.o(0).connect(mailbox.i(0))

      clock.time = 10000
      metro.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [['bang']])

      metro.i(1).message([1200])
      clock.time = 11000
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang'], ['bang']])

      clock.time = 12000
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang'], ['bang']])
      clock.time = 12200
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang'], ['bang'], ['bang']])
    })

  })

  describe('[delay]', function() {

    var clock
    beforeEach(function() { clock = new helpers.TestClock() })

    it('should send a bang after the delay time', function() {
      Pd.stop()
      Pd.start({clock: clock})
      var delay = patch.createObject('delay', [1100])
        , mailbox = patch.createObject('testingmailbox')
      delay.o(0).connect(mailbox.i(0))

      delay.i(0).message(['bang'])
      clock.tick()
      assert.deepEqual(mailbox.received, [])
      clock.time = 1000
      clock.tick()
      assert.deepEqual(mailbox.received, [])
      clock.time = 1100
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang']])
    })

    it('should have 0 as a default value', function() {
      Pd.stop()
      Pd.start({clock: clock})
      var delay = patch.createObject('delay')
        , mailbox = patch.createObject('testingmailbox')
      delay.o(0).connect(mailbox.i(0))

      delay.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [['bang']])
    })

    it('should start a delay when sending a number on first inlet', function() {
      Pd.stop()
      Pd.start({clock: clock})
      var delay = patch.createObject('delay', [3000])
        , mailbox = patch.createObject('testingmailbox')
      delay.o(0).connect(mailbox.i(0))

      delay.i(0).message([1111])
      clock.tick()
      assert.deepEqual(mailbox.received, [])
      clock.time = 1110
      clock.tick()
      assert.deepEqual(mailbox.received, [])
      clock.time = 1111
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang']])
    })

    it('should start change delay time when sending number on inlet 1', function() {
      Pd.stop()
      Pd.start({clock: clock})
      var delay = patch.createObject('delay', [3000])
        , mailbox = patch.createObject('testingmailbox')
      delay.o(0).connect(mailbox.i(0))

      delay.i(1).message([201])
      clock.tick()
      assert.deepEqual(mailbox.received, [])
      clock.time = 201
      clock.tick()
      assert.deepEqual(mailbox.received, [])

      delay.i(0).message(['bang'])
      clock.time = 401
      clock.tick()
      assert.deepEqual(mailbox.received, [])
      clock.time = 402
      delay.i(1).message([1000]) // shouldnt make a difference
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang']])

      delay.i(0).message(['bang'])
      clock.time = 1401
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang']])
      clock.time = 1402
      clock.tick()
      assert.deepEqual(mailbox.received, [['bang'], ['bang']])
    })

  })

  describe('[timer]', function() {

    var clock
    beforeEach(function() { clock = new helpers.TestClock() })

    it('should be started on creation', function() {
      Pd.stop()
      Pd.start({clock: clock})
      var timer = patch.createObject('timer')
        , mailbox = patch.createObject('testingmailbox')
      timer.o(0).connect(mailbox.i(0))

      clock.time = 1222
      timer.i(1).message(['bang'])
      assert.deepEqual(mailbox.received, [[1222]])
    })

    it('should be reset when sending a message on the first inlet', function() {
      Pd.stop()
      Pd.start({clock: clock})
      var timer = patch.createObject('timer')
        , mailbox = patch.createObject('testingmailbox')
      timer.o(0).connect(mailbox.i(0))

      clock.time = 3010
      timer.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [])

      clock.time = 4000
      timer.i(1).message(['bang'])
      assert.deepEqual(mailbox.received, [[990]])
    })

  })

  describe('[change]', function() {

    it('should output number only if it changed', function() {
      var change = patch.createObject('change')
        , mailbox = patch.createObject('testingmailbox')
      change.o(0).connect(mailbox.i(0))

      change.i(0).message([123, 'qq'])
      assert.deepEqual(mailbox.received, [[123]])

      change.i(0).message([123, 444])
      assert.deepEqual(mailbox.received, [[123]])

      change.i(0).message([567])
      assert.deepEqual(mailbox.received, [[123], [567]])
    })

  })

  describe('[array]', function() {

    it('should create a array with the given name and length', function() {
      var array = patch.createObject('array', ['$0-array', 44100])
      assert.equal(array.data.length, 44100)
      assert.deepEqual(pdGlob.namedObjects.get('array', patch.patchId + '-array'), [array])
    })

    it('should create a array with default values', function() {
      var array = patch.createObject('array', [])
      assert.equal(array.data.length, 100)
      assert.equal(array.name, null)
    })

    it('should set the data without resizing when using setData', function() {
      var array = patch.createObject('array', ['SAMPLE', 5])
      assert.equal(array.data.length, 5)
      array.setData(new Float32Array([1, 2, 3, 4, 5, 6, 7]))
      assert.deepEqual(_.toArray(array.data), [1, 2, 3, 4, 5])
      array.setData(new Float32Array([8, 9, 10]))
      assert.deepEqual(_.toArray(array.data), [8, 9, 10, 4, 5])
    })

    it('should resize the array when using setData with resize = true', function() {
      var array = patch.createObject('array', ['SAMPLE', 5])
      assert.equal(array.data.length, 5)
      assert.equal(array.size, 5)
      array.setData(new Float32Array([1, 2, 3, 4, 5, 6, 7]), true)
      assert.deepEqual(_.toArray(array.data), [1, 2, 3, 4, 5, 6, 7])
      assert.equal(array.size, 7)
    })

  })

  describe('[soundfiler]', function() {

    it('should read mono data and write to the given array', function() {
      var array1 = patch.createObject('array', ['ARR1', 5])
        , array2 = patch.createObject('array', ['ARR2', 5])
        , mailbox = patch.createObject('testingmailbox')
        , soundfiler = patch.createObject('soundfiler')
      
      soundfiler.o(0).connect(mailbox.i(0))
      dummyStorage.data = [ new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]) ]
      soundfiler.i(0).message(['read', '/bla', 'ARR1', 'ARR2'])
      waatest.utils.assertBlocksEqual([array1.data], [[0.1, 0.2, 0.3, 0.4, 0.5]])
      waatest.utils.assertBlocksEqual([array2.data], [[0, 0, 0, 0, 0]])
      assert.deepEqual(mailbox.received, [[5]])

      dummyStorage.data = [ new Float32Array([1.1, 1.2, 1.3]) ]
      soundfiler.i(0).message(['read', '/bla', 'ARR2'])
      waatest.utils.assertBlocksEqual([array1.data], [[0.1, 0.2, 0.3, 0.4, 0.5]])
      waatest.utils.assertBlocksEqual([array2.data], [[1.1, 1.2, 1.3, 0, 0]])
      assert.deepEqual(mailbox.received, [[5], [3]])
    })

    it('should read stereo data and write the channels to given arrays', function() {
      var array1 = patch.createObject('array', ['ARR1', 5])
        , array2 = patch.createObject('array', ['ARR2', 5])
        , mailbox = patch.createObject('testingmailbox')
        , soundfiler = patch.createObject('soundfiler')
      
      soundfiler.o(0).connect(mailbox.i(0))
      dummyStorage.data = [
        new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]),
        new Float32Array([0.01, 0.02, 0.03, 0.04, 0.05, 0.06])
      ]
      soundfiler.i(0).message(['read', '/bla', 'ARR1', 'ARR2'])
      waatest.utils.assertBlocksEqual([array1.data], [[0.1, 0.2, 0.3, 0.4, 0.5]])
      waatest.utils.assertBlocksEqual([array2.data], [[0.01, 0.02, 0.03, 0.04, 0.05, 0.06]])
      assert.deepEqual(mailbox.received, [[5]])

      dummyStorage.data = [
        new Float32Array([1.1, 1.2, 1.3]),
        new Float32Array([1.01, 1.02, 1.03])
      ]
      soundfiler.i(0).message(['read', '/bla', 'ARR2'])
      waatest.utils.assertBlocksEqual([array1.data], [[0.1, 0.2, 0.3, 0.4, 0.5]])
      waatest.utils.assertBlocksEqual([array2.data], [[1.1, 1.2, 1.3, 0.04, 0.05]])
      assert.deepEqual(mailbox.received, [[5], [3]])
    })

    it('should resize arrays to data length if arrays are of different sizes', function() {
      var array1 = patch.createObject('array', ['ARR1', 2])
        , array2 = patch.createObject('array', ['ARR2', 10])
        , mailbox = patch.createObject('testingmailbox')
        , soundfiler = patch.createObject('soundfiler')
      
      soundfiler.o(0).connect(mailbox.i(0))
      dummyStorage.data = [
        new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]),
        new Float32Array([0.01, 0.02, 0.03, 0.04, 0.05, 0.06])
      ]
      soundfiler.i(0).message(['read', '/bla', 'ARR1', 'ARR2'])
      waatest.utils.assertBlocksEqual([array1.data], [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6]])
      waatest.utils.assertBlocksEqual([array2.data], [[0.01, 0.02, 0.03, 0.04, 0.05, 0.06]])
      assert.deepEqual(mailbox.received, [[6]])
    })

    it('should resize arrays when reading if -resize', function() {
      var array = patch.createObject('array', ['ARR', 10])
        , soundfiler = patch.createObject('soundfiler')
      
      dummyStorage.data = [new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])]
      soundfiler.i(0).message(['read', '-resize', '/bla', 'ARR'])
      waatest.utils.assertBlocksEqual([array.data], [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6]])
    })

    it('should do nothing if unsupported option', function() {
      var array = patch.createObject('array', ['ARR', 2])
        , soundfiler = patch.createObject('soundfiler')
      
      dummyStorage.data = [new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])]
      soundfiler.i(0).message(['read', '-aiff', '/bla', 'ARR'])
      waatest.utils.assertBlocksEqual([array.data], [[0, 0]])
    })

    it('should do nothing if unknown array', function() {
      var array2 = patch.createObject('array', ['ARR2', 3])
        , mailbox = patch.createObject('testingmailbox')
        , soundfiler = patch.createObject('soundfiler')
      
      soundfiler.o(0).connect(mailbox.i(0))
      dummyStorage.data = data = [
        new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]),
        new Float32Array([0.01, 0.02, 0.03, 0.04, 0.05, 0.06])
      ]
      soundfiler.i(0).message(['read', '/bla', 'ARR3', 'ARR2'])
      waatest.utils.assertBlocksEqual([array2.data], [[0, 0, 0]])
      assert.deepEqual(mailbox.received, [])
    })

    it('should do nothing if file cant be read', function() {
      var array = patch.createObject('array', ['ARR', 2])
        , mailbox = patch.createObject('testingmailbox')
        , soundfiler = patch.createObject('soundfiler')
      
      soundfiler.o(0).connect(mailbox.i(0))
      dummyStorage.data = null
      soundfiler.i(0).message(['read', '/bla', 'ARR'])
      waatest.utils.assertBlocksEqual([array.data], [[0, 0]])
      assert.deepEqual(mailbox.received, [])
    })

  })

})
