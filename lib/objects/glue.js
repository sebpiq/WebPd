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

    init: function(args) {
      this.text = args[0]
    }

  })

  library['loadbang'] = PdObject.extend({

    outletDefs: [portlets.Outlet],

    load: function() {
      this.o(0).message(['bang'])
    }

  })

  library['float'] = library['f'] = PdObject.extend({

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
    compute: function(val) { return val + this.val }
  })

  library['-'] = _ArithmBase.extend({
    compute: function(val) { return val - this.val }
  })

  library['*'] = _ArithmBase.extend({
    compute: function(val) { return val * this.val }
  })

  library['/'] = _ArithmBase.extend({
    compute: function(val) { return val / this.val }
  })

  library['mod'] = library['%'] = _ArithmBase.extend({
    compute: function(val) { return val % this.val }
  })

  library['spigot'] = PdObject.extend({

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


  library['pd'] = Patch

}
