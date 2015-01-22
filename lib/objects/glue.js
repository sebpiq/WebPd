/*
 * Copyright (c) 2011-2014 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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
  , utils = require('../core/utils')
  , PdObject = require('../core/PdObject')
  , Patch = require('../core/Patch')
  , pdGlob = require('../global')
  , portlets = require('./portlets')

exports.declareObjects = function(library) {

  library['receive'] = library['r'] = PdObject.extend(utils.NamedMixin, {

    type: 'receive',

    outletDefs: [portlets.Outlet],
    abbreviations: ['r'],

    init: function(args) {
      var name = args[0]
        , onMsgReceived = this._messageHandler()
      this.on('change:name', function(oldName, newName) {
        if (oldName) pdGlob.emitter.removeListener('msg:' + oldName, onMsgReceived)
        pdGlob.emitter.on('msg:' + newName, onMsgReceived)
      })
      this.setName(name)
    },

    _messageHandler: function(args) {
      var self = this
      return function(args) {
        self.outlets[0].message(args)
      }
    }

  })

  library['send'] = library['s'] = PdObject.extend(utils.NamedMixin, {

    type: 'send',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          pdGlob.emitter.emit('msg:' + this.obj.name, args)
        }
      })

    ],

    abbreviations: ['s'],

    init: function(args) { this.setName(args[0]) }

  })

  library['msg'] = PdObject.extend({

    type: 'msg',

    doResolveArgs: false,

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          // For some reason in Pd $0 in a message is always 0.
          args = args.slice(0)
          args.unshift(0)
          this.obj.outlets[0].message(this.obj.resolver(args))
        }
      })

    ],

    outletDefs: [portlets.Outlet],

    init: function(args) {
      this.resolver = utils.getDollarResolver(args)
    }

  })

  library['print'] = PdObject.extend({

    type: 'print',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          console.log(this.obj.prefix ? [this.obj.prefix].concat(args) : args)
        }
      })

    ],

    init: function(args) {
      this.prefix = (args[0] || 'print');
    }

  })

  library['text'] = PdObject.extend({
    
    type: 'text',

    init: function(args) {
      this.text = args[0]
    }

  })

  library['loadbang'] = PdObject.extend({

    type: 'loadbang',

    outletDefs: [portlets.Outlet],

    load: function() {
      this.o(0).message(['bang'])
    }

  })

  library['float'] = library['f'] = PdObject.extend({

    type: 'float',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (val !== 'bang') this.obj.setVal(val)
          this.obj.o(0).message([this.obj.val])
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          this.obj.setVal(val)
        }
      })

    ],

    outletDefs: [portlets.Outlet],

    init: function(args) {
      var val = args[0]
      this.setVal(val || 0)
    },

    setVal: function(val) {
      expect(val).to.be.a('number', 'float::value')
      this.val = val
    }

  })

  var _ArithmBase = PdObject.extend({

    inletDefs: [
      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (val !== 'bang') { 
            expect(val).to.be.a('number', this.obj.type + '::value')  
            this.obj.lastResult = this.obj.compute(val)
          }
          this.obj.o(0).message([this.obj.lastResult])
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          expect(val).to.be.a('number', this.obj.type + '::value')
          this.obj.val = val
        }
      })
    ],
    outletDefs: [portlets.Outlet],

    init: function(args) {
      var val = args[0]
      this.val = val || 0
      this.lastResult = 0
    },
    
    // Must be overriden
    compute: function(val) { return }
  })

  library['+'] = _ArithmBase.extend({
    type: '+',

    compute: function(val) { return val + this.val }
  })

  library['-'] = _ArithmBase.extend({
    type: '-',
    compute: function(val) { return val - this.val }
  })

  library['*'] = _ArithmBase.extend({
    type: '*',
    compute: function(val) { return val * this.val }
  })

  library['/'] = _ArithmBase.extend({
    type: '/',
    compute: function(val) { return val / this.val }
  })

  library['mod'] = library['%'] = _ArithmBase.extend({
    type: 'mod',
    compute: function(val) { return val % this.val }
  })

  library['spigot'] = PdObject.extend({
    
    type: 'spigot',

    inletDefs: [
      
      portlets.Inlet.extend({
        message: function(args) {
          if (this.obj.passing) this.obj.o(0).message(args)
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          this.obj.setPassing(val)
        }
      })

    ],

    outletDefs: [portlets.Outlet],

    init: function(args) {
      var val = args[0]
      this.setPassing(val || 0)
    },

    setPassing: function(val) {
      expect(val).to.be.a('number', 'spigot::passing')
      this.passing = Boolean(val)
    }

  })

  library['trigger'] = library['t'] = PdObject.extend({

    type: 'trigger',

    inletDefs: [
      portlets.Inlet.extend({

        message: function(args) {
          var i, length, filter, msg

          for (i = this.obj.filters.length - 1; i >= 0; i--) {
            filter = this.obj.filters[i]
            if (filter === 'bang')
              this.obj.o(i).message(['bang'])
            else if (filter === 'list' || filter === 'anything')
              this.obj.o(i).message(args)
            else if (filter === 'float') {
              msg = args[0]
              if (_.isNumber(msg)) this.obj.o(i).message([msg])
              else this.obj.o(i).message([0])
            } else if (filter === 'symbol') {
              msg = args[0]
              if (msg === 'bang') this.obj.o(i).message(['symbol'])
              else if (_.isNumber(msg)) this.obj.o(i).message(['float'])
              else if (_.isString(msg)) this.obj.o(i).message([msg])
              else throw new Error('Got unexpected input ' + args)
            }
          }
        }

      })
    ],

    init: function(args) {
      var i, length
      if (args.length === 0)
        args = ['bang', 'bang']
      for (i = 0, length = args.length; i < length; i++)
        this.outlets.push(new portlets.Outlet(this, i))
      this.filters = args
    }

  })

  var _PackInlet0 = portlets.Inlet.extend({
    message: function(args) {
      var msg = args[0]
      if (msg !== 'bang') this.obj.memory[0] = msg
      this.obj.o(0).message(this.obj.memory.slice(0))
    }
  })

  var _PackInletN = portlets.Inlet.extend({
    message: function(args) {
      var msg = args[0]
      this.obj.memory[this.id] = msg
    }
  })

  library['pack'] = PdObject.extend({
    
    type: 'pack',

    outletDefs: [portlets.Outlet],

    init: function(args) {
      var i, length = args.length

      if (length === 0) args = ['float', 'float']
      length = args.length
      this.filters = args
      this.memory = new Array(length)

      for (i = 0; i < length; i++) {
        if (i === 0)
          this.inlets[i] = new _PackInlet0(this, i)
        else 
          this.inlets[i] = new _PackInletN(this, i)
        if (args[i] === 'float') this.memory[i] = 0
        else if (args[i] === 'symbol') this.memory[i] = 'symbol'
        else this.memory[i] = args[i]
      }
    }

  })

  library['select'] = library['sel'] = PdObject.extend({

    type: 'select',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var ind, msg = args[0]
          if ((ind = this.obj.filters.indexOf(msg)) !== -1)
            this.obj.o(ind).message(['bang'])
          else this.obj.outlets.slice(-1)[0].message([msg])
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          if (this.obj.filters.length <= 1) this.obj.filters = args
        }
      })

    ],

    init: function(args) {
      var i, length
      if (args.length === 0) args = [0]
      if (args.length > 1) this.inlets.pop() 

      for (i = 0, length = args.length; i < length; i++)
        this.outlets[i] = new portlets.Outlet(this, i)
      this.outlets[i] = new portlets.Outlet(this, i)
      this.filters = args
    }

  })

  library['moses'] = PdObject.extend({

    type: 'moses',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          expect(val).to.be.a('number', 'moses::value')
          if (val < this.obj.val) this.obj.o(0).message([val])
          else this.obj.o(1).message([val])
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          this.obj.setVal(val)
        }
      })

    ],

    outletDefs: [portlets.Outlet, portlets.Outlet],

    init: function(args) {
      var val = args[0]
      this.setVal(val || 0)
    },

    setVal: function(val) {
      expect(val).to.be.a('number', 'moses::value')
      this.val = val
    }

  })

  library['mtof'] = PdObject.extend({

    type: 'mtof',

    inletDefs: [
      portlets.Inlet.extend({
        // TODO: round output ?
        message: function(args) {
          var out = 0
            , note = args[0]
          expect(note).to.be.a('number', 'mtof::value')
          if (note <= -1500) out = 0
          else if (note > 1499) out = this.obj.maxMidiNote
          else out = 8.17579891564 * Math.exp((0.0577622650 * note))
          this.obj.o(0).message([out])
        }
      })
    ],

    outletDefs: [portlets.Outlet],
    maxMidiNote: 8.17579891564 * Math.exp((0.0577622650 * 1499))
  })

  library['random'] = PdObject.extend({

    type: 'random',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var msg = args[0]
          if (msg === 'bang')
            this.obj.o(0).message([Math.floor(Math.random() * this.obj.max)])
          else if (msg === 'seed') 1 // TODO: seeding, not available with `Math.rand`
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var msg = args[0]
          this.obj.setMax(msg)
        }
      })
    ],

    outletDefs: [portlets.Outlet],

    init: function(args) {
      var maxInt = args[0]
      this.setMax(maxInt || 1)
    },

    setMax: function(maxInt) {
      expect(maxInt).to.be.a('number', 'random::max')
      this.max = maxInt
    }

  })

  library['metro'] = PdObject.extend({

    type: 'metro',

    inletDefs: [
    
      portlets.Inlet.extend({
        message: function(args) {
          var msg = args[0]
          if (msg === 'bang') this.obj._restartMetroTick()
          else if (msg === 'stop') this.obj._stopMetroTick() 
          else {
            expect(msg).to.be.a('number', 'metro::command')
            if (msg === 0) this.obj._stopMetroTick()
            else this.obj._restartMetroTick()
          }
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var rate = args[0]
          this.obj.setRate(rate)
          this.obj._metroTick = this.obj._metroTickRateChange
        }
      })

    ],

    outletDefs: [portlets.Outlet],

    init: function(args) {
      var rate = args[0]
      this.setRate(rate || 0)
      this._metroHandle = null
      this._metroTick = this._metroTickNormal
    },

    // Metronome rate, in ms per tick
    setRate: function(rate) {
      expect(rate).to.be.a('number', 'metro::rate')
      this.rate = rate
    },

    _startMetroTick: function() {
      var self = this
      if (this._metroHandle === null) {
        this._metroHandle = pdGlob.clock.schedule(function() {
          self._metroTick()
        }, pdGlob.futureTime || pdGlob.clock.time, this.rate)
      }
    },

    _stopMetroTick: function() {
      if (this._metroHandle !== null) {
        pdGlob.clock.unschedule(this._metroHandle)
        this._metroHandle = null
      }
    },

    _restartMetroTick: function() {
      this._stopMetroTick()
      this._startMetroTick()
    },

    _metroTickNormal: function() { this.outlets[0].message(['bang']) },

    // On next tick, restarts the interval and switches to normal ticking.
    _metroTickRateChange: function() {
      this._metroTick = this._metroTickNormal
      this._restartMetroTick()
    }
  })

  library['delay'] = library['del'] = PdObject.extend({

    type: 'delay',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var msg = args[0]
          if (msg === 'bang') {
            this.obj._stopDelay()
            this.obj._startDelay()
          } else if (msg === 'stop') {
            this.obj._stopDelay() 
          } else {
            this.obj.setDelay(msg)
            this.obj._stopDelay()
            this.obj._startDelay()
          }
        }
      }),
      
      portlets.Inlet.extend({
        message: function(args) {
          var delay = args[0]
          this.obj.setDelay(delay)
        }
      })

    ],

    outletDefs: [portlets.Outlet],

    init: function(args) {
      var delay = args[0]
      this.setDelay(delay || 0)
      this._delayHandle = null
    },

    // Delay time, in ms
    setDelay: function(delay) {
      expect(delay).to.be.a('number', 'delay::time')
      this.delay = delay
    },

    _startDelay: function() {
      var self = this
      if (this._delayHandle === null) {
        this._delayHandle = pdGlob.clock.schedule(function() {
          self.outlets[0].message(['bang'])
        }, (pdGlob.futureTime || pdGlob.clock.time) + this.delay)
      }
    },

    _stopDelay: function() {
      if (this._delayHandle !== null) {
        pdGlob.clock.unschedule(this._delayHandle)
        this._delayHandle = null
      }
    }
  })

  // TODO: How does it work in pd ?
  library['timer'] = PdObject.extend({

    type: 'timer',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var msg = args[0]
          expect(msg).to.be.equal('bang', 'timer::startStop')
          this.obj.refTime = (pdGlob.futureTime || pdGlob.clock.time)
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var msg = args[0]
          expect(msg).to.be.equal('bang', 'timer::measure')
          this.obj.outlets[0].message([(pdGlob.futureTime || pdGlob.clock.time) - this.obj.refTime])
        }
      })

    ],
    
    outletDefs: [portlets.Outlet],

    init: function() {
      // Reference time, the timer count starts from this  
      this.refTime = 0
    }

  })

  library['change'] = PdObject.extend({

    type: 'change',

    inletDefs: [
      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (val !== this.obj.last) {
            this.obj.last = val
            this.obj.o(0).message([val])
          }
        }
      })
    ],
    
    outletDefs: [portlets.Outlet],

    init: function() {
      this.last = null
    }

  })

  library['pd'] = Patch

}
