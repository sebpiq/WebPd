/*
 * Copyright (c) 2011-2017 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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
  , utils = require('./core/utils')
  , mixins = require('./core/mixins')
  , PdObject = require('./core/PdObject')
  , Patch = require('./core/Patch')
  , pdGlob = require('./global')
  , portlets = require('./waa/portlets')


exports.declareObjects = function(library) {

  library['receive'] = library['r'] = PdObject.extend(mixins.NamedMixin, mixins.EventEmitterMixin, {

    type: 'receive',

    outletDefs: [portlets.Outlet],
    abbreviations: ['r'],

    init: function(args) {
      var name = args[0]
        , self = this
      this._eventReceiver = new mixins.EventReceiver()
      this._onMessageReceived = this._onMessageReceived.bind(this)
      this._eventReceiver.on(this, 'changed:name', function(oldName, newName) {
        if (oldName) 
          self._eventReceiver.removeListener(pdGlob.emitter, 'msg:' + oldName, self._onMessageReceived)
        self._eventReceiver.on(pdGlob.emitter, 'msg:' + newName, self._onMessageReceived)
      })
      this.setName(name)
    },

    destroy: function() {
      mixins.NamedMixin.destroy.apply(this, arguments)
      this._eventReceiver.destroy()
      mixins.EventEmitterMixin.destroy.apply(this, arguments)
    },

    _onMessageReceived: function(args) {
      this.o(0).message(args)
    }

  })

  library['send'] = library['s'] = PdObject.extend(mixins.NamedMixin, mixins.EventEmitterMixin, {

    type: 'send',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          pdGlob.emitter.emit('msg:' + this.obj.name, args)
        }
      })

    ],

    abbreviations: ['s'],

    init: function(args) { this.setName(args[0]) },

    destroy: function() {
      mixins.NamedMixin.destroy.apply(this, arguments)
      mixins.EventEmitterMixin.destroy.apply(this, arguments)
    }

  })

  library['msg'] = PdObject.extend({

    type: 'msg',

    doResolveArgs: false,

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var timeTag = args.timeTag
          // For some reason in Pd $0 in a message is always 0.
          args = args.slice(0)
          args.unshift(0)
          // resolve each message group
          for(var i=0 ; i<this.obj.resolvers.length ; i++)
          {
            var resolver = this.obj.resolvers[i]
            this.obj.outlets[0].message(utils.timeTag(resolver(args), timeTag))
          }
        }
      })

    ],

    outletDefs: [portlets.Outlet],

    init: function(args) {
      this.createResolvers(args)
    },

    createResolvers: function(args) {
      // split comma separated message in groups.
      var argsGroups = [[]]
      for(var i=0 ; i<args.length ; i++)
      {
        var arg = args[i]
        if(arg == ","){
          argsGroups.push([])
        }else{
          argsGroups[argsGroups.length-1].push(arg)
        }
      }
      if(argsGroups[argsGroups.length-1].length == 0){
        argsGroups.pop()
      }
      // then create resolvers for each group.
      this.resolvers = []
      for(var i in argsGroups)
      {
        var argsGroup = argsGroups[i]
        this.resolvers.push(utils.getDollarResolver(argsGroup))
      }      
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

    init: function() {
      var self = this
      this._eventReceiver = new mixins.EventReceiver()
      this._onPatchStarted = function() {
        self.o(0).message(['bang'])
      }
      this._eventReceiver.on(this.patch, 'started', this._onPatchStarted)
    },

    destroy: function() {
      this._eventReceiver.destroy()
    }

  })

  var _NumberBase = PdObject.extend({

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (val !== 'bang') this.obj.setVal(val)
          this.obj.o(0).message(utils.timeTag([this.obj.val], args))
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

    setVal: function(val) { this.val = val }

  })

  library['float'] = library['f'] = _NumberBase.extend({

    type: 'float',

    setVal: function(val) {
      if (!_.isNumber(val))
        return console.error('invalid [float] value ' + val)
      this.val = val
    }

  })

  library['int'] = library['i'] = _NumberBase.extend({

    type: 'int',

    setVal: function(val) {
      if (!_.isNumber(val))
        return console.error('invalid [int] value ' + val)
      this.val = Math.floor(val)
    }

  })

  var _TwoVarFunctionBase = PdObject.extend({

    inletDefs: [
      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (_.isNumber(val))
            this.obj.valLeft = val
          else if (val !== 'bang')
            console.error('invalid message : ' + args)
          this.obj.o(0).message(utils.timeTag([this.obj.compute()], args))
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (!_.isNumber(val))
            return console.error('invalid operand for [' + this.obj.type + '] ' + val)
          this.obj.valRight = val
        }
      })
    ],
    outletDefs: [portlets.Outlet],

    init: function(args) {
      this.valRight = args[0] || 0
      this.valLeft = 0
    },
    
    // Must be overriden
    compute: function() { return }
  })

  library['+'] = _TwoVarFunctionBase.extend({
    type: '+',

    compute: function() { return this.valLeft + this.valRight }
  })

  library['-'] = _TwoVarFunctionBase.extend({
    type: '-',
    compute: function() { return this.valLeft - this.valRight }
  })

  library['*'] = _TwoVarFunctionBase.extend({
    type: '*',
    compute: function() { return this.valLeft * this.valRight }
  })

  library['/'] = _TwoVarFunctionBase.extend({
    type: '/',
    compute: function() { return this.valRight == 0 ? 0 : this.valLeft / this.valRight }
  })

  library['min'] = _TwoVarFunctionBase.extend({
    type: 'min',
    compute: function() { return Math.min(this.valLeft, this.valRight) }
  })

  library['max'] = _TwoVarFunctionBase.extend({
    type: 'max',
    compute: function() { return Math.max(this.valLeft, this.valRight) }
  })

  library['mod'] = library['%'] = _TwoVarFunctionBase.extend({
    type: 'mod',
    compute: function() { 
      if(this.valRight <= 0)
        return 0
      if(this.valLeft < 0)
        return this.valRight + this.valLeft % this.valRight
      return this.valLeft % this.valRight
    }
  })

  library['pow'] = _TwoVarFunctionBase.extend({
    type: 'pow',
    compute: function() { return Math.pow(this.valLeft, this.valRight) }
  })

  var _OneVarFunctionBase = PdObject.extend({

    inletDefs: [
      portlets.Inlet.extend({
        message: function(args) {
          var inVal = args[0]
          this.obj.checkInput(inVal)
          this.obj.o(0).message(utils.timeTag([this.obj.compute(inVal)], args))
        }
      })
    ],
    outletDefs: [portlets.Outlet],

    // Must be overriden    
    checkInput: function(inVal) {},

    // Must be overriden
    compute: function() { return }
  })

  var _OneNumVarFunctionBase = _OneVarFunctionBase.extend({
    checkInput: function(inVal) {
      if (!_.isNumber(inVal))
        return console.error('invalid [' + this.type + '] value ' + inVal)
    }
  })

  library['cos'] = _OneNumVarFunctionBase.extend({
    type: 'cos',
    compute: function(inVal) { return Math.cos(inVal) }
  })

  library['sin'] = _OneNumVarFunctionBase.extend({
    type: 'sin',
    compute: function(inVal) { return Math.sin(inVal) }
  })

  library['tan'] = _OneNumVarFunctionBase.extend({
    type: 'tan',
    compute: function(inVal) { return Math.tan(inVal) }
  })

  library['atan2'] = _TwoVarFunctionBase.extend({
    type: 'atan2',
    compute: function() { return Math.atan2(this.valRight, this.valLeft) }
  })

  library['atan'] = _OneNumVarFunctionBase.extend({
    type: 'atan',
    compute: function(inVal) { return Math.atan(inVal) }
  })

  library['exp'] = _OneNumVarFunctionBase.extend({
    type: 'exp',
    compute: function(inVal) { return Math.exp(inVal) }
  })

  library['log'] = _OneNumVarFunctionBase.extend({
    type: 'log',
    compute: function(inVal) { return Math.log(inVal) }
  })

  library['abs'] = _OneNumVarFunctionBase.extend({
    type: 'abs',
    compute: function(inVal) { return Math.abs(inVal) }
  })

  library['sqrt'] = _OneNumVarFunctionBase.extend({
    type: 'sqrt',
    compute: function(inVal) { return Math.sqrt(inVal) }
  })

  library['wrap'] = _OneNumVarFunctionBase.extend({
    type: 'wrap',
    compute: function(inVal) { return inVal - Math.floor(inVal) }
  })

  library['mtof'] = _OneNumVarFunctionBase.extend({
    type: 'mtof',
    maxMidiNote: 8.17579891564 * Math.exp((0.0577622650 * 1499)),
    // TODO: round output ?
    compute: function(note) { 
      var out = 0
      if (!_.isNumber(note))
        return console.error('invalid [mtof] value ' + note)
      if (note <= -1500) out = 0
      else if (note > 1499) out = this.maxMidiNote
      // optimized version of formula : Math.pow(2, (note - 69) / 12) * 440 
      else out = 8.17579891564 * Math.exp((0.0577622650 * note))
      return out 
    }
  })

  library['ftom'] = _OneNumVarFunctionBase.extend({
    type: 'ftom',
    compute: function(freq) { 
      if (!_.isNumber(freq))
        return console.error('invalid [ftom] value ' + freq)
      if (freq <= 0)
        return -1500
      // optimized version of formula : 12 * Math.log(freq / 440) / Math.LN2 + 69
      // which is the same as : Math.log(freq / mtof(0)) * (12 / Math.LN2) 
      // which is the same as : Math.log(freq / 8.1757989156) * (12 / Math.LN2) 
      return Math.log(freq * 0.122312206) * 17.312340491
    }
  })

  library['rmstodb'] = _OneNumVarFunctionBase.extend({
    type: 'rmstodb',
    compute: function(inVal) { return inVal <= 0 ? 0 : 20 * Math.log(inVal) / Math.LN10 + 100 }
  })

  library['dbtorms'] = _OneNumVarFunctionBase.extend({
    type: 'dbtorms',
    compute: function(inVal) { return inVal <= 0 ? 0 : Math.exp(Math.LN10 * (inVal - 100) / 20)}
  })

  library['powtodb'] = _OneNumVarFunctionBase.extend({
    type: 'powtodb',
    compute: function(inVal) { return inVal <= 0 ? 0 : 10 * Math.log(inVal) / Math.LN10 + 100 }
  })

  library['dbtopow'] = _OneNumVarFunctionBase.extend({
    type: 'dbtopow',
    compute: function(inVal) { return inVal <= 0 ? 0 : Math.exp(Math.LN10 * (inVal - 100) / 10)}
  })

  library['samplerate~'] = _OneVarFunctionBase.extend({
    type: 'samplerate~',
    compute: function () { return pdGlob.audio.sampleRate }
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
      if (!_.isNumber(val))
        return console.error('invalid [spigot] value ' + val)
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
              this.obj.o(i).message(utils.timeTag(['bang'], args))
            else if (filter === 'list' || filter === 'anything')
              this.obj.o(i).message(args)
            else if (filter === 'float' || _.isNumber(filter)) {
              msg = args[0]
              if (_.isNumber(msg)) this.obj.o(i).message(utils.timeTag([msg], args))
              else this.obj.o(i).message(utils.timeTag([0], args))
            } else if (filter === 'symbol') {
              msg = args[0]
              if (msg === 'bang') this.obj.o(i).message(utils.timeTag(['symbol'], args))
              else if (_.isNumber(msg)) this.obj.o(i).message(utils.timeTag(['float'], args))
              else if (_.isString(msg)) this.obj.o(i).message(utils.timeTag([msg], args))
              else throw new Error('Got unexpected input ' + args)
            } else this.obj.o(i).message(utils.timeTag(['bang'], args))
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
      this.obj.o(0).message(utils.timeTag(this.obj.memory.slice(0), args))
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
            this.obj.o(ind).message(utils.timeTag(['bang'], args))
          else this.obj.outlets.slice(-1)[0].message(utils.timeTag([msg], args))
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
          if (!_.isNumber(val))
            return console.error('invalid [moses] value ' + val)
          if (val < this.obj.val) this.obj.o(0).message(utils.timeTag([val], args))
          else this.obj.o(1).message(utils.timeTag([val], args))
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
      if (!_.isNumber(val))
        return console.error('invalid [moses] value ' + val)
      this.val = val
    }

  })

  library['clip'] = PdObject.extend({

    type: 'clip',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (!_.isNumber(val))
            return console.error('invalid [clip] value ' + val)
          if (val < this.obj.min) this.obj.o(0).message(utils.timeTag([this.obj.min], args))
          else if (val > this.obj.max) this.obj.o(0).message(utils.timeTag([this.obj.max], args))
          else this.obj.o(0).message(utils.timeTag([val], args))
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          this.obj.setMin(val)
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          this.obj.setMax(val)
        }
      })

    ],

    outletDefs: [portlets.Outlet],

    init: function(args) {
      this.setMin(args[0] || 0)
      this.setMax(args[1] || 0)
    },

    setMin: function(val) {
      if (!_.isNumber(val))
        return console.error('invalid [clip] min value ' + val)
      this.min = val
    },

    setMax: function(val) {
      if (!_.isNumber(val))
        return console.error('invalid [clip] max value ' + val)
      this.max = val
    }

  })

  library['swap'] = PdObject.extend({

    type: 'swap',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (!_.isNumber(val))
            return console.error('invalid [swap] value ' + val)
          this.obj.o(1).message(utils.timeTag([val], args))
          this.obj.o(0).message(utils.timeTag([this.obj.val], args))
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
      if (!_.isNumber(val))
        return console.error('invalid [swap] value ' + val)
      this.val = val
    }

  })

  library['until'] = PdObject.extend({

    type: 'until',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (val === 'bang') {
            this.obj._startLoop(args.timeTag)
          } else {
            if (!_.isNumber(val))
              return console.error('invalid [until] value ' + val)
            this.obj._startLoop(args.timeTag, val)
          }
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (val !== 'bang')
            return console.error('invalid command for [until] ' + val)
          this.obj._stopLoop()
        }
      })

    ],

    outletDefs: [portlets.Outlet],

    init: function() {
      this._looping = false
    },

    _startLoop: function(timeTag, max) {
      this._looping = true
      var self = this
        , counter = 0
        , sendBang =  function() { self.o(0).message(utils.timeTag(['bang'], timeTag)) }

      if (_.isNumber(max)) {
        while (this._looping && counter < max) {
          sendBang()
          counter++
        }
      } else while (this._looping) sendBang()
        
      this._looping = false
    },

    _stopLoop: function() {
      this._looping = false
    }

  })

  library['random'] = PdObject.extend({

    type: 'random',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var msg = args[0]
          if (msg === 'bang')
            this.obj.o(0).message(utils.timeTag([Math.floor(Math.random() * this.obj.max)], args))
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
      if (!_.isNumber(maxInt))
        return console.error('invalid [random] value ' + maxInt)
      this.max = maxInt
    }

  })


  library['metro'] = PdObject.extend({

    type: 'metro',

    inletDefs: [
    
      portlets.Inlet.extend({
        message: function(args) {
          var msg = args[0]
          if (msg === 'bang') this.obj._restartMetroTick(utils.getTimeTag(args))
          else if (msg === 'stop') this.obj._stopMetroTick() 
          else {
            if (!_.isNumber(msg))
              return console.error('invalid [metro] value ' + msg)
            if (msg === 0) this.obj._stopMetroTick()
            else this.obj._restartMetroTick(utils.getTimeTag(args))
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
      if (!_.isNumber(rate))
        return console.error('invalid [metro] rate ' + rate)
      this.rate = Math.max(rate, 1)
    },

    destroy: function() {
      this._stopMetroTick()
    },

    _startMetroTick: function(timeTag) {
      var self = this
      if (this._metroHandle === null) {
        this._metroHandle = pdGlob.clock.schedule(function(event) {
          self._metroTick(event.timeTag)
        }, timeTag, this.rate)
      }
    },

    _stopMetroTick: function() {
      if (this._metroHandle !== null) {
        pdGlob.clock.unschedule(this._metroHandle)
        this._metroHandle = null
      }
    },

    _restartMetroTick: function(timeTag) {
      // If a rate change was made and `_restartMetroTick` is called before the next tick,
      // we should do this to avoid `_restartMetroTick` to be called twice recursively,
      // which would cause _metroHandle to not be unscheduled properly... 
      if (this._metroTick === this._metroTickRateChange)
        this._metroTick = this._metroTickNormal
      this._stopMetroTick()
      this._startMetroTick(timeTag)
    },

    _metroTickNormal: function(timeTag) { 
      this.outlets[0].message(utils.timeTag(['bang'], timeTag))
    },

    // On next tick, restarts the interval and switches to normal ticking.
    _metroTickRateChange: function(timeTag) {
      this._metroTick = this._metroTickNormal
      this._restartMetroTick(timeTag)
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
            this.obj._startDelay(utils.getTimeTag(args))
          } else if (msg === 'stop') {
            this.obj._stopDelay() 
          } else {
            this.obj.setDelay(msg)
            this.obj._stopDelay()
            this.obj._startDelay(utils.getTimeTag(args))
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
      if (!_.isNumber(delay))
        return console.error('invalid [delay] length ' + delay)
      this.delay = delay
    },

    destroy: function() {
      this._stopDelay()
    },

    _startDelay: function(timeTag) {
      var self = this
      if (this._delayHandle === null) {
        this._delayHandle = pdGlob.clock.schedule(function(event) {
          self.outlets[0].message(utils.timeTag(['bang'], event.timeTag))
        }, timeTag + this.delay)
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
          if (msg !== 'bang')
            return console.error('invalid command for [timer] ' + msg)
          this.obj.refTime = utils.getTimeTag(args)
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var msg = args[0]
          if (msg !== 'bang')
            return console.error('invalid command for [timer] ' + msg)
          this.obj.outlets[0].message(utils.timeTag([utils.getTimeTag(args) - this.obj.refTime], args))
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
            this.obj.o(0).message(utils.timeTag([val], args))
          }
        }
      })
    ],
    
    outletDefs: [portlets.Outlet],

    init: function() {
      this.last = null
    }

  })

  library['array'] = library['table'] = PdObject.extend(mixins.NamedMixin, mixins.EventEmitterMixin, {

    type: 'array',

    nameIsUnique: true,

    init: function(args) {
      var name = args[0]
        , size = args[1] || 100
      if (name) this.setName(name)
      this.size = size
      this.data = new Float32Array(size)
    },

    destroy: function() {
      mixins.NamedMixin.destroy.apply(this, arguments)
      mixins.EventEmitterMixin.destroy.apply(this, arguments)
    },

    setData: function(audioData, resize) {
      if (resize) this.data = new Float32Array(audioData.length)
      this.data.set(audioData.subarray(0, Math.min(this.data.length, audioData.length)))
      this.size = this.data.length
      this.emit('changed:data')
    }

  })

  library['soundfiler'] = PdObject.extend({

    type: 'soundfiler',

    inletDefs: [
      portlets.Inlet.extend({
        message: function(args) {
          var self = this
            , command = args[0]
            , doResize = false
            , arg, url, arrayNames
          args = args.slice(1)
          if (command === 'read') {
            
            // Handle options
            while (args.length && args[0][0] === '-') {
              arg = args.shift()
              if (arg === '-resize') doResize = true
              
              else if (arg === '-wave' && arg === '-aiff'
                    && arg === '-nextstep' && arg === '-raw'
                    && arg === '-bytes' && arg === '-nframes')
                return console.error(arg + ' not supported')
              else return console.error(arg + ' not understood')
            }

            // Handle url to load and arrays to load the sound data to
            url = args.shift()
            arrayNames = args

            // GET the audio resource 
            pdGlob.storage.get(url, function(err, arrayBuffer) {
              if (err) return console.error('could not load file : ' + err)

              // Try to decode it
              pdGlob.audio.decode(arrayBuffer, function(err, audioData) {
                if (err) return console.error('Could not decode file : ' + err)

                var array, arrays, channelData

                arrays = arrayNames.map(function(arrayName) {
                  array = pdGlob.namedObjects.get('array', arrayName)[0]
                  if (!array) {
                    console.error('array "' + arrayName + '" not found')
                    return null
                  } else return array
                })

                if (_.contains(arrays, null)) return
                if (_.uniq(_.pluck(arrays, 'size')).length !== 1)
                  doResize = true


                // For each array, set the data
                arrays.forEach(function(array, i) {
                  channelData = audioData[i]
                  if (!channelData) return
                  array.setData(channelData, doResize)
                })

                // Send the amount of frames read to the outlet 
                self.obj.o(0).message([Math.min(arrays[0].size, audioData[0].length)])
              })
            })

          } else console.error('command "' + command + '" is not supported')
        }
      })
    ],
    
    outletDefs: [ portlets.Outlet ]

  })

  library['pd'] = library['graph'] = Patch

}
