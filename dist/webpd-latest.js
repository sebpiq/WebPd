/* Copyright 2013 Chris Wilson

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/* 

This monkeypatch library is intended to be included in projects that are
written to the proper AudioContext spec (instead of webkitAudioContext), 
and that use the new naming and proper bits of the Web Audio API (e.g. 
using BufferSourceNode.start() instead of BufferSourceNode.noteOn()), but may
have to run on systems that only support the deprecated bits.

This library should be harmless to include if the browser supports 
unprefixed "AudioContext", and/or if it supports the new names.  

The patches this library handles:
if window.AudioContext is unsupported, it will be aliased to webkitAudioContext().
if AudioBufferSourceNode.start() is unimplemented, it will be routed to noteOn() or
noteGrainOn(), depending on parameters.

The following aliases only take effect if the new names are not already in place:

AudioBufferSourceNode.stop() is aliased to noteOff()
AudioContext.createGain() is aliased to createGainNode()
AudioContext.createDelay() is aliased to createDelayNode()
AudioContext.createScriptProcessor() is aliased to createJavaScriptNode()
AudioContext.createPeriodicWave() is aliased to createWaveTable()
OscillatorNode.start() is aliased to noteOn()
OscillatorNode.stop() is aliased to noteOff()
OscillatorNode.setPeriodicWave() is aliased to setWaveTable()
AudioParam.setTargetAtTime() is aliased to setTargetValueAtTime()

This library does NOT patch the enumerated type changes, as it is 
recommended in the specification that implementations support both integer
and string types for AudioPannerNode.panningModel, AudioPannerNode.distanceModel 
BiquadFilterNode.type and OscillatorNode.type.

*/
(function (global, exports, perf) {
  'use strict';

  function fixSetTarget(param) {
    if (!param)	// if NYI, just return
      return;
    if (!param.setTargetAtTime)
      param.setTargetAtTime = param.setTargetValueAtTime; 
  }

  if (window.hasOwnProperty('webkitAudioContext') && 
      !window.hasOwnProperty('AudioContext')) {
    window.AudioContext = webkitAudioContext;

    if (!AudioContext.prototype.hasOwnProperty('createGain'))
      AudioContext.prototype.createGain = AudioContext.prototype.createGainNode;
    if (!AudioContext.prototype.hasOwnProperty('createDelay'))
      AudioContext.prototype.createDelay = AudioContext.prototype.createDelayNode;
    if (!AudioContext.prototype.hasOwnProperty('createScriptProcessor'))
      AudioContext.prototype.createScriptProcessor = AudioContext.prototype.createJavaScriptNode;
    if (!AudioContext.prototype.hasOwnProperty('createPeriodicWave'))
      AudioContext.prototype.createPeriodicWave = AudioContext.prototype.createWaveTable;


    AudioContext.prototype.internal_createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function() { 
      var node = this.internal_createGain();
      fixSetTarget(node.gain);
      return node;
    };

    AudioContext.prototype.internal_createDelay = AudioContext.prototype.createDelay;
    AudioContext.prototype.createDelay = function(maxDelayTime) { 
      var node = maxDelayTime ? this.internal_createDelay(maxDelayTime) : this.internal_createDelay();
      fixSetTarget(node.delayTime);
      return node;
    };

    AudioContext.prototype.internal_createBufferSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function() { 
      var node = this.internal_createBufferSource();
      if (!node.start) {
        node.start = function ( when, offset, duration ) {
          if ( offset || duration )
            this.noteGrainOn( when, offset, duration );
          else
            this.noteOn( when );
        }
      }
      if (!node.stop)
        node.stop = node.noteOff;
      fixSetTarget(node.playbackRate);
      return node;
    };

    AudioContext.prototype.internal_createDynamicsCompressor = AudioContext.prototype.createDynamicsCompressor;
    AudioContext.prototype.createDynamicsCompressor = function() { 
      var node = this.internal_createDynamicsCompressor();
      fixSetTarget(node.threshold);
      fixSetTarget(node.knee);
      fixSetTarget(node.ratio);
      fixSetTarget(node.reduction);
      fixSetTarget(node.attack);
      fixSetTarget(node.release);
      return node;
    };

    AudioContext.prototype.internal_createBiquadFilter = AudioContext.prototype.createBiquadFilter;
    AudioContext.prototype.createBiquadFilter = function() { 
      var node = this.internal_createBiquadFilter();
      fixSetTarget(node.frequency);
      fixSetTarget(node.detune);
      fixSetTarget(node.Q);
      fixSetTarget(node.gain);
      return node;
    };

    if (AudioContext.prototype.hasOwnProperty( 'createOscillator' )) {
      AudioContext.prototype.internal_createOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function() { 
        var node = this.internal_createOscillator();
        if (!node.start)
          node.start = node.noteOn; 
        if (!node.stop)
          node.stop = node.noteOff;
        if (!node.setPeriodicWave)
          node.setPeriodicWave = node.setWaveTable;
        fixSetTarget(node.frequency);
        fixSetTarget(node.detune);
        return node;
      };
    }
  }
}(window));


;!function(exports, undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = new Object;
  }

  function configure(conf) {
    if (conf) {
      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      if (this.wildcard) {
        this.listenerTree = new Object;
      }
    }
  }

  function EventEmitter(conf) {
    this._events = new Object;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }
    
    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }
        
        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
    
    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = new Object;
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;
            
            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  };

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    };

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {
    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener') {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {
      
      if (!this._all && 
        !this._events.error && 
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || this._all;
    }
    else {
      return this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {
    
    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;
        
        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if(!this._all) {
      this._all = [];
    }

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          return this;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1)
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  exports.EventEmitter2 = EventEmitter; 

}(window);

/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

(function(){

    // EventEmitter2 offers the same API as node's EventEmitter
    this.EventEmitter = EventEmitter2;

    var Pd = this.Pd = {

        // Default sample rate to use for the patches. Beware, if the browser doesn't
        // support this sample rate, the actual sample rate of a patch might be different. 
        sampleRate: 44100,

        // Default block size to use for patches.
        blockSize: 1024,

        // The number of audio channels on the output
        channelCount: 2,

        debugMode: false,

        // Array type to use. If the browser support Float arrays, this will be Float array type.
        arrayType: Array,

        // Array slice function, to unify slicing float arrays and normal arrays.
        arraySlice: function (array, start, end) { return array.slice(start, end); }
    };

    // use a Float32Array if we have it
    if (typeof Float32Array !== "undefined") {
        Pd.arrayType = Float32Array;
        Pd.arraySlice = function (array, start, end) { return array.subarray(start, end); };
    }

    // Returns true if the current browser supports WebPd, false otherwise.
    Pd.isSupported = function() {
        // Web audio API - Chrome, Safari
        var test = typeof window === 'undefined' ? null : window.webkitAudioContext || window.AudioContext;
        if (test) return true;

        // All the rest
        return false;
    };

    // Every new patch and object registers itself using this function.
    // Named objects are stored, so that they can be found with 
    // `Pd.getNamedObject` and `Pd.getUniquelyNamedObject`.
    // TODO: destroy object or patch, clean references
    Pd.register = function(obj) {
        if (obj.type === 'abstract') return;

        if (obj instanceof Pd.Patch) {
            if (this._patches.indexOf(obj) === -1) {
                this._patches.push(obj);
                obj.id = this._generateId();
            }

        // For normal named objects, we just find the right entry in the map,
        // and add the object to an array of objects with the same name.
        } else if (obj instanceof Pd.NamedObject) {
            var storeNamedObject = function(oldName, newName) {
                var objType = obj.type, nameMap = Pd._namedObjects[obj.type],
                    objList;
                if (!nameMap) nameMap = Pd._namedObjects[objType] = {};

                objList = nameMap[newName];
                if (!objList) objList = nameMap[newName] = [];
                if (objList.indexOf(obj) === -1) objList.push(obj);
                // Removing old mapping
                if (oldName) {
                    objList = nameMap[oldName];
                    objList.splice(objList.indexOf(obj), 1);
                }
            };
            obj.on('change:name', storeNamedObject);
            storeNamedObject(null, obj.name);

        // For uniquely named objects, we add directly the object to the corresponding
        // entry in the map (no arrays there).
        } else if (obj instanceof Pd.UniquelyNamedObject) {
            var storeNamedObject = function(oldName, newName) {
                var objType = obj.type, nameMap = Pd._uniquelyNamedObjects[obj.type],
                    objList;
                if (!nameMap) nameMap = Pd._uniquelyNamedObjects[objType] = {};

                if (nameMap.hasOwnProperty(newName) && nameMap[newName] !== obj)
                    throw new Error('there is already an object with name "' + newName + '"');
                nameMap[newName] = obj;
                // Removing old mapping
                if (oldName) nameMap[oldName] = undefined;
            };
            obj.on('change:name', storeNamedObject);
            storeNamedObject(null, obj.name);
        }
    };
    Pd._patches = [];
    Pd._namedObjects = {};
    Pd._uniquelyNamedObjects = {};

    // Returns an object list given the object `type` and `name`.
    Pd.getNamedObject = function(type, name) {
        return ((this._namedObjects[type] || {})[name] || []);
    };

    // Returns an object given the object `type` and `name`, or `null` if this object doesn't exist.
    Pd.getUniquelyNamedObject = function(type, name) {
        return ((this._uniquelyNamedObjects[type] || {})[name] || null);
    };

    // Returns true if an object is an array, false otherwise.
    Pd.isArray = Array.isArray || function(obj) {
        return toString.call(obj) === '[object Array]';
    };

    // Returns true if an object is a number, false otherwise.
    // If `val` is NaN, the function returns false.
    Pd.isNumber = function(val) {
        return typeof val === 'number' && !isNaN(val);
    };

    // Returns true if an object is a string, false otherwise.
    Pd.isString = function(val) {
        return typeof val === 'string';
    };

    // Returns true if an object is a function, false otherwise.
    // TODO: function vs [object Function] ?
    Pd.isFunction = function(obj) {
        return typeof obj === 'function';
    };

    // Simple prototype inheritance. Used like so :
    //    
    //    var ChildObject = function() {};
    //
    //    Pd.extend(ChildObject.prototype, ParentObject.prototype, {
    //
    //        anOverridenMethod: function() {
    //            ParentObject.prototype.anOverridenMethod.apply(this, arguments);
    //            // do more stuff ...
    //        },
    //
    //        aNewMethod: function() {
    //            // do stuff ...
    //        }
    //
    //    });
    Pd.extend = function(obj) {
        var sources = Array.prototype.slice.call(arguments, 1),
            i, length, source, prop;

        for (i = 0, length = sources.length; i < length; i++) {
            source = sources[i];
            for (prop in source) {
                obj[prop] = source[prop];
            }
        }
        return obj;
    };

    Pd.chainExtend = function() {
        var sources = Array.prototype.slice.call(arguments, 0),
            parent = this,
            child = function() { parent.apply(this, arguments); };

        // Fix instanceof
        child.prototype = new parent();

        // extend with new properties
        Pd.extend.apply(this, [child.prototype, parent.prototype].concat(sources));
        child.extend = this.extend;
        return child;
    };


    // Simple mixin to add functionalities for generating unique ids.
    // Each prototype inheriting from this mixin has a separate id counter.
    // Therefore ids are not unique globally but unique for each prototype.
    Pd.UniqueIdsBase = {

        // Every time it is called, this method returns a new unique id.
        _generateId: function() {
            this._idCounter++;
            return this._idCounter;
        },

        // Counter used internally to assign a unique id to objects
        // this counter should never be decremented to ensure the id unicity
        _idCounter: -1
    };
    Pd.extend(Pd, Pd.UniqueIdsBase);


    // Returns a function `transfer(msg)`, that takes a message array as input, and constructs 
    // the output message. For example :
    //
    //     transfer = Pd.makeMsgTransfer([56, '$1', 'bla', '$2-$1']);
    //     transfer([89, 'bli']); // [56, 89, 'bla', 'bli-89']
    //
    Pd.makeMsgTransfer = function(rawOutArray) {
        var transfer = [], i, length, rawOutVal, matchDollar, func;
        rawOutArray = rawOutArray.slice(0);

        // Creates an array of transfer functions `inVal -> outVal`.
        for (i = 0, length = rawOutArray.length;  i < length; i++) {
            rawOutVal = rawOutArray[i];
            matchDollar = dollarVarRe.exec(rawOutVal);

            // If the transfer is a dollar var :
            //      ['bla', 789] - ['$1'] -> ['bla']
            //      ['bla', 789] - ['$2'] -> [789]
            if (matchDollar && matchDollar[0] === rawOutVal) {
                transfer.push(
                    (function(rawOutVal) {
                        var inInd = parseInt(matchDollar[1], 10) - 1; // -1, because $1 corresponds to value 0.
                        return function(inArray) {
                            if (inInd >= inArray.length || inInd < 0 ) 
                                throw new Error('$' + (inInd + 1) + ': argument number out of range');
                            return inArray[inInd];
                        };
                    })(rawOutVal)
                );

            // If the transfer is a string containing dollar var :
            //      ['bla', 789] - ['bla$2'] -> ['bla789']
            } else if (matchDollar) {
                transfer.push(
                    (function(rawOutVal) {
                        var j, matched, dollarVars = [], inInd;
                        while (matched = dollarVarReGlob.exec(rawOutVal)) {
                            dollarVars.push([matched[0], parseInt(matched[1], 10) - 1]); // -1, because $1 corresponds to value 0.
                        }
                        return function(inArray) {
                            var outVal = rawOutVal.substr(0);
                            for (j = 0; matched = dollarVars[j]; j++) {
                                inInd = matched[1];
                                if (inInd >= inArray.length || inInd < 0 ) 
                                    throw new Error('$' + (inInd + 1) + ': argument number out of range');
                                outVal = outVal.replace(matched[0], inArray[inInd]);
                            }
                            return outVal;
                        };
                    })(rawOutVal)
                );

            // Else the input doesn't matter
            } else {
                transfer.push(
                    (function(outVal) {
                        return function() { return outVal; };
                    })(rawOutVal)
                );
            }
        }

        return function(inArray) {
            var outArray = [];
            for (i = 0; func = transfer[i]; i++) outArray[i] = func(inArray);
            return outArray;
        }; 
    };

    // Takes a list of object arguments which might contain abbreviations, and returns
    // a copy of that list, abbreviations replaced by the corresponding full word.
    // TODO: patch, $1, $2, ...
    // TODO: doesn't this belong to compat instead ?
    Pd.resolveArgs = function(args, patch) {
        var i, length, arg, matchDollar, cleaned = args.slice(0),
            patchInd, patchArgs = (patch) ? [patch.id] : [];

        for (i = 0, length = args.length; i < length; i++) {
            arg = args[i];
            if (arg === 'b') cleaned[i] = 'bang';
            else if (arg === 'f') cleaned[i] = 'float';
            else if (arg === 's') cleaned[i] = 'symbol';
            else if (arg === 'a') cleaned[i] = 'anything';
            else if (arg === 'l') cleaned[i] = 'list';
            else if (matchDollar = dollarVarRe.exec(arg)) {
                // If the transfer is a dollar var :
                //      ['bla', 789] - ['$1'] -> ['bla']
                //      ['bla', 789] - ['$2'] -> [789]
                if (matchDollar[0] === arg) {
                    patchInd = parseInt(matchDollar[1], 10);
                    if (patchInd >= patchArgs.length || patchInd < 0 ) 
                        throw new Error('$' + patchInd + ': argument number out of range');
                    cleaned[i] = patchArgs[patchInd];

                // If the transfer is a string containing dollar var :
                //      ['bla', 789] - ['bla$2'] -> ['bla789']
                } else {
                    while (matchDollar = dollarVarReGlob.exec(arg)) {
                        patchInd = parseInt(matchDollar[1], 10);
                        if (patchInd >= patchArgs.length || patchInd < 0 ) 
                            throw new Error('$' + patchInd + ': argument number out of range');
                        arg = arg.replace(matchDollar[0], patchArgs[patchInd]);
                    }
                    cleaned[i] = arg;
                }
            }
        }
        return cleaned;
    };

    // Regular expressions to deal with dollar-args
    var dollarVarRe = /\$(\d+)/,
        dollarVarReGlob = /\$(\d+)/g;

    // Fills array with zeros
    Pd.fillWithZeros = function(array, start) {
        var i, length, start = start !== undefined ? start : 0;
        for (i = start, length = array.length; i < length; i++) {
            array[i] = 0;
        }
        return array;
    };

    // Returns a brand, new, clean, buffer
    Pd.newBuffer = function(channels) {
        if (channels === undefined) channels = 1;
        return new Pd.arrayType(Pd.blockSize * channels);
    };

    Pd.notImplemented = function() { throw new Error('Not implemented !'); };

}).call(this);

/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

(function(Pd){

    var AudioDriverInterface = function(desiredSampleRate, blockSize) {
        // what sample rate we will operate at (might change depending on driver so use getSampleRate()
        this._sampleRate = desiredSampleRate;
        this._blockSize = blockSize;
        this._channelCount = 2;
    };

    Pd.extend(AudioDriverInterface.prototype, {

        // fetch the current sample rate we are operating at
        getSampleRate: function() { Pd.notImplemented(); },

        // Stop the audio from playing
        stop: function() { Pd.notImplemented(); },

        // Start the audio playing with the supplied function as the audio-block generator
        play: function(generator) { Pd.notImplemented(); },

        // test whether this driver is currently playing audio
        isPlaying: function() { Pd.notImplemented(); }

    });

    var WAAAdapter = function(desiredSampleRate, blockSize) {
        AudioDriverInterface.prototype.constructor.apply(this, arguments);
        if (_audioContext === null) _audioContext = new AudioContext;
        this._blockSize = blockSize;
    };
    var _audioContext = null;

    Pd.extend(WAAAdapter.prototype, AudioDriverInterface.prototype, {

        // fetch the current sample rate we are operating at
        getSampleRate: function() { 
            return _audioContext.sampleRate;
        },

        // Stop the audio from playing
        stop: function() {
            this._playing = false;
            this._scriptNode.disconnect();
            this._scriptNode = null;
        },

        // Start the audio playing with the supplied function as the audio-block generator
        play: function(generator) {
            var self = this
            this._scriptNode = _audioContext.createScriptProcessor(this._blockSize, 1, this._channelCount);
            this._playing = true;
            this._scriptNode.onaudioprocess = function(event) {
                var outputBuffer = event.outputBuffer
                    , ch, block = generator();
                for (ch = 0; ch < self._channelCount; ch++)
                    outputBuffer.getChannelData(ch).set(block[ch]);
            }
            this._scriptNode.connect(_audioContext.destination);
        },

        // test whether this driver is currently playing audio
        isPlaying: function() {
            return this._playing;
        }

    });

    Pd.AudioDriver = WAAAdapter;

})(this.Pd);


/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

(function(Pd){

    var BasePortlet = function(obj, id) {
        this.obj = obj;
        this.id = id;
        this.init();
    };
    Pd.extend(BasePortlet.prototype, {

        init: function() {},

        connect: function(other) { Pd.notImplemented(); },

        disconnect: function(other) { Pd.notImplemented(); },

        // Generic function for connecting the calling portlet 
        // with `otherPortlet`.
        _genericConnect: function(allConn, otherPortlet) {
            if (allConn.indexOf(otherPortlet) !== -1) return;
            allConn.push(otherPortlet);
            otherPortlet.connect(this);
        },

        // Generic function for disconnecting the calling portlet 
        // from  `otherPortlet`.
        _genericDisconnect: function(allConn, otherPortlet) {
            var connInd = allConn.indexOf(otherPortlet);
            if (connInd === -1) return;
            allConn.splice(connInd, 1);
            otherPortlet.disconnect(this);
        }

    });
    BasePortlet.extend = Pd.chainExtend;

    var BaseInlet = BasePortlet.extend({

        init: function() {
            this.sources = [];
        },

        // Connects the inlet to the outlet `source`. 
        // If the connection already exists, nothing happens.
        connect: function(source) {
            this._genericConnect(this.sources, source);
            this.obj.emit('inletConnect');
        },

        // Disconnects the inlet from the outlet `source`.
        // If the connection didn't exist, nothing happens.
        disconnect: function(source) {
            this._genericDisconnect(this.sources, source);
            this.obj.emit('inletDisconnect');
        },

        // message received callback
        message: function() {
          this.obj.message.apply(this.obj, [this.id].concat(Array.prototype.slice.call(arguments)));
        },

        // Returns a buffer to read dsp data from.
        getBuffer: function() { Pd.notImplemented(); },

        // Returns true if the inlet has dsp sources, false otherwise
        hasDspSources: function() { Pd.notImplemented(); }

    });

    var BaseOutlet = BasePortlet.extend({

        init: function() {
            this.sinks = [];
        },

        // Connects the outlet to the inlet `sink`. 
        // If the connection already exists, nothing happens.
        connect: function(sink) {
            this._genericConnect(this.sinks, sink);
        },

        // Disconnects the outlet from the inlet `sink`.
        // If the connection didn't exist, nothing happens.
        disconnect: function(sink) {
            this._genericDisconnect(this.sinks, sink);
        },

        // Returns a buffer to write dsp data to.
        getBuffer: function() { Pd.notImplemented(); },

        // Sends a message to all sinks
        message: function() { Pd.notImplemented(); }

    });


    // message inlet. Simply receives messages and dispatches them to
    // the inlet's object.
    Pd['inlet'] = BaseInlet.extend({

        getBuffer: function() {
            throw (new Error ('No dsp buffer on a message inlet'));
        },

        hasDspSources: function() {
            throw (new Error ('A message inlet cannot have dsp sources'));
        }

    });

    // dsp inlet. Pulls dsp data from all sources. Also accepts messages.
    Pd['inlet~'] = BaseInlet.extend({

        init: function() {
            BaseInlet.prototype.init.apply(this, arguments);
            this.dspSources = [];
            this._buffer = Pd.newBuffer();
            this._zerosBuffer = Pd.newBuffer();
            Pd.fillWithZeros(this._zerosBuffer);
        },

        getBuffer: function() {
            var dspSources = this.dspSources;

            // if more than one dsp source, we have to sum the signals.
            if (dspSources.length > 1) {
                var buffer = this._buffer, sourceBuff, i, j, len1, len2;
                Pd.fillWithZeros(buffer);

                for (i = 0, len1 = dspSources.length; i < len1; i++) {
                    sourceBuff = dspSources[i].getBuffer();
                    for (j = 0, len2 = buffer.length; j < len2; j++) {
                        buffer[j] += sourceBuff[j];
                    }
                }
                return buffer;

            // if only one dsp source, we can pass the signal as is.
            } else if (dspSources.length === 1) {
                return dspSources[0].getBuffer();

            // if no dsp source, just pass some zeros
            } else {
                return this._zerosBuffer;
            }
        },

        connect: function(source) {
            if (source instanceof Pd['outlet~']) this.dspSources.push(source);
            BaseInlet.prototype.connect.apply(this, arguments);
        },

        disconnect: function(source) {
            var ind = this.dspSources.indexOf(source);
            if (ind !== -1) this.dspSources.splice(ind, 1);
            BaseInlet.prototype.disconnect.apply(this, arguments);
        },

        hasDspSources: function() {
            return this.dspSources.length > 0;
        }

    });

    // message outlet. Dispatches messages to all the sinks
    Pd['outlet'] = BaseOutlet.extend({

        getBuffer: function() {
            throw (new Error ('No dsp buffer on a message outlet'));
        },

        message: function() {
            var sinks = this.sinks,
                sink, i, length;

            for (i = 0, length = sinks.length; i < length; i++) {
                sink = sinks[i];
                sink.message.apply(sink, arguments);
            }
        }

    });

    // dsp outlet. Only contains a buffer, written to by the outlet's object.
    Pd['outlet~'] = BaseOutlet.extend({

        init: function() {
            BaseOutlet.prototype.init.apply(this, arguments);
            this._buffer = Pd.newBuffer();
        },

        getBuffer: function() {
            return this._buffer;
        },

        message: function() {
            throw (new Error ('message received on dsp outlet, pas bon'));
        }

    });

})(this.Pd);

/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

(function(Pd){

    /******************** Base Object *****************/

    Pd.Object = function (patch, args) {
        // Base attributes.
        // `frame` corresponds to the last frame that was run. 
        this.patch = (patch || null);
        this.id = null;
        this.frame = -1;

        // Attributes mostly used for compatibility and GUIs.
        this._args = args = args || [];
        this._guiData = {};
  
        // create inlets and outlets specified in the object's proto
        this.inlets = [];
        this.outlets = [];
        var outletTypes = this.outletTypes,
            inletTypes = this.inletTypes,
            i, length;

        for (i = 0, length = outletTypes.length; i < length; i++) {
            this.outlets[i] = new Pd[outletTypes[i]](this, i);
        }
        for (i = 0, length = inletTypes.length; i < length; i++) {
            this.inlets[i] = new Pd[inletTypes[i]](this, i);
        }

        // initializes the object, handling the creation arguments
        if (this.resolveArgs) args = Pd.resolveArgs(args, patch);
        this.init.apply(this, args);
        if (this.type !== 'abstract') {
            Pd.register(this);
            if (patch) patch.addObject(this);
        }
    };
  
    Pd.extend(Pd.Object.prototype, EventEmitter.prototype, Pd.UniqueIdsBase, {

        // This is used to choose in which order objects must be loaded, when the patch
        // is started. For example [loadbang] must go last. Higher priorities go first.
        loadPriority: 0,

        // set to true if this object is a dsp sink (e.g. [dac~], [outlet~], [print~]
        endPoint: false,

        // if the object is an endpoint, this is used to choose in which order endpoints
        // dsp is run. Higher priorities go first.
        endPointPriority: 0,

        // 'outlet' / 'outlet~'
        outletTypes: [],

        // 'inlet' / 'inlet~'  
        inletTypes: [],

        // Type of the object. If type is 'abstract' `Pd.register` ignores the object.
        type: 'abstract',

        // List of available abbreviations for that object.
        abbreviations: undefined,

        // If this is true, `Pd.resolveArgs` is applied to the object's arguments.
        resolveArgs: true,

        // Returns inlet `id` if it exists.
        i: function(id) {
            if (id < this.inlets.length) return this.inlets[id];
            else throw (new Error('invalid inlet ' + id));
        },

        // Returns outlet `id` if it exists.
        o: function(id) {
            if (id < this.outlets.length) return this.outlets[id];
            else throw (new Error('invalid outlet ' + id));
        },

    /******************** Methods to implement *****************/

        // This method is called when the object is created.
        // At this stage, the object can belong to a patch or not.
        init: function() {},

        // This method is called by the patch when it starts playing.
        load: function() {},

        // method run every frame for this object
        dspTick: function() {},

        // method run when this object receives a message at any inlet
        message: function(inletnumber, message) {},

    /********************** Helper methods *********************/

        assertIsNumber: function(val, errorMsg) {
            if (!Pd.isNumber(val)) throw (new Error(errorMsg));
        },

        assertIsArray: function(val, errorMsg) {
            if (!Pd.isArray(val)) throw (new Error(errorMsg));
        },

        assertIsString: function(val, errorMsg) {
            if (!Pd.isString(val)) throw (new Error(errorMsg));
        },

        assertIsBang: function(val, errorMsg) {
            if (val !== 'bang') throw (new Error(errorMsg));
        },

    /******************** Basic dspTicks ************************/
        dspTickNoOp: function() {},
        toDspTickNoOp: function() { this.dspTick = this.dspTickNoOp; },
        
        dspTickZeros: function() { Pd.fillWithZeros(this.outlets[0].getBuffer()); },
        toDspTickZeros: function() { this.dspTick = this.dspTickZeros; },

        dspTickId: function() {
            var outBuff = this.outlets[0].getBuffer(),
                inBuff = this.inlets[0].getBuffer(),
                i, length;
            for (i = 0, length = outBuff.length; i < length; i++) outBuff[i] = inBuff[i];
        },
        toDspTickId: function() { this.dspTick = this.dspTickId; }
    });

    Pd.Object.extend = Pd.chainExtend;


    /******************** Named Objects *****************/
    var NamedObjectMixin = {
        setName: function(name) {
            var errorMsg = 'unvalid name ' + name, oldName = this.name;
            this.assertIsString(name, errorMsg);
            if (!name) throw new Error(errorMsg);
            this.name = name;
            this.emit('change:name', oldName, name);
        }
    };

    // Base for named objects, Those are handled a bit differently by patches.
    Pd.NamedObject = Pd.Object.extend(NamedObjectMixin);

    // Base for named objects, Those are handled a bit differently by patches.
    Pd.UniquelyNamedObject = Pd.Object.extend(NamedObjectMixin);

})(this.Pd);

/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

(function(Pd) {

    // !!! What we call "frame" here is a block of audio frames 
    // (i.e. : 1 frame = <channelsCount * blockSize> samples).
    Pd.Patch = function () {
        Pd.register(this);
        this.sampleRate = Pd.sampleRate;
        this.blockSize = Pd.blockSize;
        this.channelCount = Pd.channelCount;

        // setting up the graph
        this._graph = {
            // an array of every object we know about
            objects: [],
            // an array of all of the end-points of the dsp graph
            // (like dac~ or print~ or send~ or outlet~)
            endPoints: []
        };

        // arrays of callbacks which are scheduled to run at some point in time
        // keys are frames
        this._scheduled = {};

        // create the audio output driver
        this.audio = new Pd.AudioDriver(this.sampleRate, this.blockSize);
        // output. One array for each channel
        this.output = [];
        // Next frame
        this.frame = 0;
    };

    Pd.extend(Pd.Patch.prototype, EventEmitter.prototype, Pd.UniqueIdsBase, {
  
    /************************* Send/receive ******************************/

        // Send a message to a named receiver inside the graph
        send: function(name) {
            this.emit.apply(this, ['msg:' + name]
                .concat(Array.prototype.slice.call(arguments, 1)));
        },

        // Receive a message from a named sender inside the graph
        receive: function(name, callback) {
            this.on('msg:' + name, callback);
        },

    /******************** Time/scheduling methods ************************/
  
        // gets the absolute current logical elapsed time in milliseconds
        getAbsTime: function() {
            return this.frameToTime(this.frame);
        },

        // Returns the time corresponding with `frame` in milliseconds.
        frameToTime: function(frame) {
            return frame * this.blockSize / (this.sampleRate / 1000);
        },

        // Returns the frame corresponding with `time` (given in milliseconds).
        timeToFrame: function(time) {
            return time / (this.blockSize / (this.sampleRate / 1000));
        },

        // Takes a time in milliseconds, returns the equivalent number of samples.
        millisToSamp: function(millis) {
            return this.sampleRate * millis / 1000;
        },

        // Takes a time in milliseconds, returns the equivalent number of samples.
        sampToMillis: function(samp) {
            return samp * 1000 / this.sampleRate;
        },

        // Schedules `callback` in `time` milliseconds.
        // Returns the timeout handle which can be used to unschedule it.
        timeout: function(time, callback, context) {
            return this._genericSchedule({
                callback: callback, context: context,   
                absTime: this.getAbsTime() + time, repeat: false
            });
        },

        // Schedules `callback` to be run every `time` milliseconds.
        // Returns the interval handle which can be used to stop it.
        // TODO: possible optimization : scheduling several cbs at once.  
        interval: function(time, callback, context) {
            return this._genericSchedule({
                callback: callback, context: context,
                absTime: this.getAbsTime() + time, repeat: true, time: time
            });
        },

        // Clears the timeout or interval whose handle is `id`.
        // TODO: not very efficient
        clear: function(id) {
            var frame, frameCbs, cbObj, i;

            for (frame in this._scheduled) {
                frameCbs = this._scheduled[frame];
                i = 0;
                while (cbObj = frameCbs[i]) {
                    if (cbObj.id === id) {
                        frameCbs.splice(i, 1);
                        return;
                    }
                    i++;
                }
            }
        },

        // Helper for scheduling a callback at an absolute time.
        _genericSchedule: function(cbObj, repeated) {
            if (!cbObj.callback || !cbObj.absTime) return;
            var frame = Math.ceil(this.timeToFrame(cbObj.absTime));
                cbs = this._scheduled[frame] = this._scheduled[frame] || [];

            cbs.push(cbObj);
            if (repeated !== true) return cbObj.id = this._generateId();
        },

    /******************** DSP stuff ************************/

        // Get a single frame of audio data from Pd.
        generateFrame: function() {
            var patch = this,
                i, obj, endPoints = this.getEndPoints(),
                cbs = this._scheduled[this.frame] || [], cbObj;
            delete this._scheduled[this.frame];

            // run the dsp function on all endpoints to pull data
            for (i = 0; obj = endPoints[i]; i++) {
                patch.tick(obj);
            }
            this.frame++;

            // Runs all the callbacks scheduled at the current frame
            // !!! We have to execute this after the frame has been incremented, 
            // otherwise rescheduling will take wrong frame as reference.
            // TODO: respect absTime order
            for (i = 0; cbObj = cbs[i]; i++) {
                if (cbObj.repeat) {
                    cbObj.absTime += cbObj.time;
                    this._genericSchedule(cbObj, true);
                }
                cbObj.callback.call(cbObj.context);
            }

            return this.output;
        },
  
        // Dsp tick function. Pulls dsp data from `obj` and all its parents.
        tick: function(obj) {
            if (obj.frame < this.frame) {
                var inlets = obj.inlets, sources, i, j, len1, len2;
                
                // Update the frame here to avoid infinite recursion
                obj.frame = this.frame;

                // Recursively triggers tick on all DSP objects.
                for (i = 0, len1 = inlets.length; i < len1; i++) {
                    if (inlets[i] instanceof Pd['inlet~']) {
                        sources = inlets[i].sources;
                        for (j = 0, len2 = sources.length; j < len2; j++) this.tick(sources[j].obj);
                    }
                }

                // once all parents have run their dsp process,
                // we can proceed with the current object.
                if (obj.dspTick) obj.dspTick();
            }
        },
  
        // Starts this graph running
        play: function() {
            var patch = this;

            if (!this.isPlaying()) {
                console.debug('Starting audio.');
                // fetch the actual samplerate from the audio driver
                this.sampleRate = this.audio.getSampleRate();
                // TODO: should load called with post-order traversal,
                //        to ensure all children gets loaded before their parents ?
                this.getAllObjects()
                    .sort(function(obj1, obj2) { return obj2.loadPriority - obj1.loadPriority; })
                    .map(function(obj) { obj.load(); }, this);
                this.audio.play(function() { return patch.generateFrame(); });
                // reset frame counts
                this.frame = 0;
                this.getAllObjects().map(function(obj) { obj.frame = -1; });
            } else {
                console.debug('Already started.');
            }
        },
  
        // Stops this graph from running
        stop: function() {
            if (this.isPlaying()) {
                console.debug('Stopping audio.');
                this.audio.stop();
            } else {
                console.debug('Already stopped.');
            }
        },

        // Returns true if the patch is playing, false otherwise.
        isPlaying: function() {
            return this.audio.isPlaying();
        },

    /******************** Graph methods ************************/

        // Adds an object to the patch.
        // Also causes the patch to automatically assign an id to that object.
        // This id can be used to uniquely identify the object in the patch.
        // Also, if the patch is playing, the `load` method of the object will be called.
        addObject: function(obj) {
            if (this._graph.objects.indexOf(obj) === -1) {
                var id = this._generateId();
                obj.id = id;
                obj.patch = this;
                this._graph.objects[id] = obj;
                if (obj.endPoint) this._graph.endPoints.push(obj);
                if (this.isPlaying()) obj.load();
                console.debug('Added ' + obj.type + ' to the graph at position ' + id);
            }
        },

        // Remove the object from the patch.
        // If the object is not in the patch, nothing happens.
        removeObject: function(obj) {
            var conns = this.getAllConnections(obj),
                ind = this._graph.endPoints.indexOf(obj), 
                i, length;

            for (i = 0, length = conns.length; i < length; i++) {
                this.disconnect(conns[i][0], conns[i][1]);
            }
            delete this._graph.objects[obj.id];
            if (ind !== -1) this._graph.endPoints.splice(ind, 1);
        },

        // Returns an object given its id in the patch, or `null` if an object
        // with such an id doesn't exist.
        getObject: function(id) {
            return (this._graph.objects[id] || null);
        },

        // Returns an array of all end points of the patch
        getEndPoints: function() {
            return this._graph.endPoints.sort(function(obj1, obj2) {
                return obj2.endPointPriority - obj1.endPointPriority;
            });
        },

        // Connects an outlet to an inlet. If those are already connected, nothing happens
        connect: function(outlet, inlet) {
            this._checkContainsObj(outlet.obj);
            this._checkContainsObj(inlet.obj);
            outlet.connect(inlet);
        },

        // Disconnects two portlets. See `connect`.
        disconnect: function(outlet, inlet) {
            this._checkContainsObj(outlet.obj);
            this._checkContainsObj(inlet.obj);
            outlet.disconnect(inlet);
        },

        // Returns an array of all objects in the patch
        getAllObjects: function() {
            var objects = this._graph.objects,
                filtered = [], obj, i, length;

            for (i = 0, length = objects.length; i < length; i++) {
                if (objects[i]) filtered.push(objects[i]);
            }
            return filtered;
        },

        // Returns all connections in the graph as an array
        // of pairs `(outlet, inlet)`. If `obj` is provided, 
        // this returns only the connections from/to `obj`.
        getAllConnections: function(obj) {
            var connections = [], source, i, j, k;

            if (obj === undefined) {
                var allObjs = this.getAllObjects();
                for (i = 0; i < allObjs.length; i++) {
                    obj = allObjs[i];
                    for (j = 0; j < obj.outlets.length; j++) {
                        source = obj.o(j);
                        for (k = 0; k < source.sinks.length; k++) {
                            connections.push([source, source.sinks[k]]);
                        }
                    }
                }
            } else {
                var sink;
                for (j = 0; j < obj.outlets.length; j++) {
                    source = obj.o(j);
                    for (k = 0; k < source.sinks.length; k++) {
                        connections.push([source, source.sinks[k]]);
                    }
                }
                for (j = 0; j < obj.inlets.length; j++) {
                    sink = obj.i(j);
                    for (k = 0; k < sink.sources.length; k++) {
                        connections.push([sink.sources[k], sink]);
                    }
                }
            }
            return connections;
        },

        // Throws an error if `obj` is not in the patch.
        _checkContainsObj: function(obj) {
            if (this._graph.objects.indexOf(obj) === -1) {
                throw (new Error('this object is not in the patch'));
            }
        }

    });

})(this.Pd);

/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

(function(Pd){
// TODO: before audio has been started we're not sure about sample rate, so we need reset some stuff in `load` (which is not great). See : osc~, lop~, ...

/************************** Basic objects ******************************/

    Pd.objects = {
    // null placeholder object for objects which don't exist
        'null': {},
        'cnv': {}
    };

    Pd.objects['text'] = Pd.Object.extend({

        load: function(text) {
            this.text = text;
        }

    });

    Pd.objects['loadbang'] = Pd.Object.extend({

        outletTypes: ['outlet'],

        loadPriority: -10,

        load: function() {
            this.outlets[0].message('bang');
        }

    });

    Pd.objects['print'] = Pd.Object.extend({

        inletTypes: ['inlet'],

        init: function(printName) {
            this.printName = (printName || 'print');
        },

        message: function(inletId) {
            var msg = Array.prototype.slice.call(arguments, 1);
            console.log(this.printName + ': ' + msg.join(' '));
        }

    });

    Pd.objects['table'] = Pd.UniquelyNamedObject.extend({

        init: function(name, size) {
            this.setName(name);
            this.size = size;
            this.data = new Pd.arrayType(size);
        }

    });

    // A simple delay line. This is used internally by [delwrite~] and [delread~].
    // `size` is delay line length in samples.
    // TODO: internal object, shouldn't appear along with other objects.
    Pd.objects['delline'] = Pd.UniquelyNamedObject.extend({

        init: function(name, size) {
            this.setName(name);
            this.size = size;
            this.data = new Pd.arrayType(size);
            this.pos = 0;
        },

        // Pushes the samples in `array` to the delay line.
        write: function(array) {
            var i, length, dellineSize = this.size, pos = this.pos;
            
            for (i = 0, length = array.length; i < length; i++, pos++) {
                this.data[pos % dellineSize] = array[i];
            }
            this.pos = pos;
            this.emit('written');
        },

        // Reads the line data at current position minus `offset` (in samples),
        // and write it to `array`.
        read: function(array, pos) {
            pos = Math.round(pos);
            // Trying to read to a position older than the line length fails,
            // cause this data has already been overwritten.
            // Trying to read a position ahead of current line position
            // cause the reading to be postponed.
            if (pos < this.pos - this.size)
                throw new Error('cannot read position ' + pos + ', delay line too short');
            if (pos + array.length > this.pos)
                throw new Error('cannot read ahead of current position');

            var i = 0, length, dellineSize = this.size;

            // While `pos` if less than 0, we fill in with zeros.
            if (pos < 0) {
                for (length = array.length; i < length && pos < 0; i++, pos++) {
                    array[i] = 0;
                }
                if (i >= length) return;
            }
            pos = pos % dellineSize;
            for (length = array.length; i < length; i++, pos++) {
                array[i] = this.data[pos % dellineSize];
            }
        }
    });

    Pd.objects['message'] = Pd.Object.extend({

        inletTypes: ['inlet'],
        outletTypes: ['outlet'],
        resolveArgs: false,

        init: function() {
            this.setTransfer(Array.prototype.slice.call(arguments, 0));
        },

        setTransfer: function(transfer) {
            this.transfer = transfer;
            this.transferFunc = Pd.makeMsgTransfer(this.transfer);
        },

        message: function(inletId) {
            if (inletId === 0) {
                var msg = Array.prototype.slice.call(arguments, 1),
                    outArray, outlet;
                outlet = this.outlets[0]; 
                outlet.message.apply(outlet, this.transferFunc(msg));
            }
        }

    });

/**************************** Glue *********************************/

    var ArithmBase = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function(val) {
            this.setVal(val || 0);
            this.lastResult = 0;
        },

        setVal: function(val) {
            this.assertIsNumber(val, 'invalid constant value ' + val);
            this.val = val;
        },

        message: function(inletId, val) {
            if (inletId === 0) {
                if (val !== 'bang') { 
                    this.assertIsNumber(val, 'value must be a number');
                    this.lastResult = this.compute(val);
                }
                this.outlets[0].message(this.lastResult);
            } else if (inletId === 1) this.setVal(val);
        },

        // Must be overriden
        compute: function(val) {
            return;
        }
    });

    Pd.objects['+'] = ArithmBase.extend({

        compute: function(val) {
            return val + this.val;
        }

    });

    Pd.objects['-'] = ArithmBase.extend({

        compute: function(val) {
            return val - this.val;
        }

    });

    Pd.objects['*'] = ArithmBase.extend({

        compute: function(val) {
            return val * this.val;
        }

    });

    Pd.objects['/'] = ArithmBase.extend({

        compute: function(val) {
            return val / this.val;
        }

    });

    Pd.objects['mod'] = ArithmBase.extend({

        abbreviations: ['%'],

        compute: function(val) {
            return val % this.val;
        }

    });

    // Stores a float
    Pd.objects['float'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],
        abbreviations: ['f'],

        init: function(val) {
            this.setVal(val || 0);
        },

        setVal: function(val) {
            this.assertIsNumber(val, 'value must be a number');
            this.val = val;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                if (msg !== 'bang') this.setVal(msg);
                this.outlets[0].message(this.val);
            } else if (inletId === 1) this.setVal(msg);
        }
    });

    // Blocks messages or let them through depending on value on right inlet.
    Pd.objects['spigot'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function(val) {
            this.setPassing(val || 0);
        },

        setPassing: function(val) {
            this.assertIsNumber(val, 'value must be a number');
            this.passing = Boolean(val);
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                if (this.passing) {
                    var outlet = this.outlets[0],
                        args = Array.prototype.slice.call(arguments, 1);
                    outlet.message.apply(outlet, args);
                }
            } else if (inletId === 1) this.setPassing(msg);
        }
    });

    // Blocks messages or let them through depending on value on right inlet.
    // TODO: validate filters
    Pd.objects['trigger'] = Pd.Object.extend({

        inletTypes: ['inlet'],
        outletTypes: [],
        abbreviations: ['t'],

        init: function() {
            var array = Array.prototype.slice.call(arguments, 0), 
                i, length;
            if (array.length === 0) array = ['bang', 'bang'];
            for (i = 0, length = array.length; i < length; i++) {
                this.outlets[i] = new Pd['outlet'](this, i);
            }
            this.filters = array;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                var list = Array.prototype.slice.call(arguments, 1), 
                    i, length, filter, outlet;

                for (i = this.filters.length - 1; i >= 0; i--) {
                    filter = this.filters[i];
                    outlet = this.outlets[i];
                    if (filter === 'bang') outlet.message('bang');
                    else if (filter === 'list' || filter === 'anything')
                        outlet.message.apply(outlet, list);
                    else if (filter === 'float') {
                        msg = list[0];
                        if (Pd.isNumber(msg)) outlet.message(msg);
                        else outlet.message(0);
                    } else if (filter === 'symbol') {
                        msg = list[0];
                        if (msg === 'bang') outlet.message('symbol');
                        else if (Pd.isNumber(msg)) outlet.message('float');
                        else if (Pd.isString(msg)) outlet.message(msg);
                        else throw new Error('Got unexpected input ' + msg);
                    }
                }
            }
        }

    });

    // Blocks messages or let them through depending on value on right inlet.
    // TODO: validate inputs received in inlets according to filters
    Pd.objects['pack'] = Pd.Object.extend({

        inletTypes: ['inlet'],
        outletTypes: ['outlet'],

        init: function() {
            var initial = Array.prototype.slice.call(arguments, 0), 
                i, length = initial.length;
            if (length === 0) {
                initial = ['float', 'float'];
                length = initial.length;
            }
            this.filters = initial;
            this.memory = new Array(length);

            for (i = 0; i < length; i++) {
                this.inlets[i] = new Pd['inlet'](this, i);
                if (initial[i] === 'float') this.memory[i] = 0;
                else if (initial[i] === 'symbol') this.memory[i] = 'symbol';
                else this.memory[i] = initial[i];
            }
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                if (msg !== 'bang') this.memory[inletId] = msg;
                var outlet = this.outlets[0];
                outlet.message.apply(outlet, this.memory);
            } else {
                this.memory[inletId] = msg;
            }
        }

    });

    // Checks the input message and routes it to the right inlet if it doesn't
    // correspond to any of the filters.
    // TODO: validate filters (float, symbol, ... all types don't work)
    Pd.objects['select'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: [],
        abbreviations: ['sel'],

        init: function() {
            var filters = Array.prototype.slice.call(arguments, 0), 
                i, length;
            if (filters.length === 0) filters = [0];

            for (i = 0, length = filters.length; i < length; i++) {
                this.outlets[i] = new Pd['outlet'](this, i);
            }
            this.outlets[i] = new Pd['outlet'](this, i);
            this.filters = filters;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                var ind;
                if ((ind = this.filters.indexOf(msg)) !== -1) {
                    this.outlets[ind].message('bang');
                    return;
                }
                this.outlets.slice(-1)[0].message(msg);
            } else if (inletId === 1) {
                if (this.filters.length <= 1) this.filters = [msg];
            }
        }

    });

    // Parts a stream of numbers
    Pd.objects['moses'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet', 'outlet'],

        init: function(val) {
            this.setVal(val || 0);
            this.lastResult = 0;
        },

        setVal: function(val) {
            this.assertIsNumber(val, 'invalid constant value ' + val);
            this.val = val;
        },

        message: function(inletId, val) {
            if (inletId === 0) {
                this.assertIsNumber(val, 'value must be a number');
                if (val < this.val) this.outlets[0].message(val);
                else this.outlets[1].message(val);
            } else if (inletId === 1) this.setVal(val);
        }

    });

    // Convert midi notes to frequency
    Pd.objects['mtof'] = Pd.Object.extend({

        inletTypes: ['inlet'],
        outletTypes: ['outlet'],
        maxMidiNote: 8.17579891564 * Math.exp((0.0577622650 * 1499)),

        // TODO: round output ?
        message: function(inletId, note) {
            if (inletId === 0) {
                this.assertIsNumber(note, 'invalid midi note ' + note);
                var out = 0;
                if (note <= -1500) out = 0;
                else if (note > 1499) out = this.maxMidiNote;
                else out = 8.17579891564 * Math.exp((0.0577622650 * note));
                this.outlets[0].message(out);
            }
        }
    });

    // Random number generator
    Pd.objects['random'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function(maxInt) {
            this.setMax(maxInt || 1);
        },

        setMax: function(maxInt) {
            this.assertIsNumber(maxInt, 'invalid maximum ' + maxInt);
            this.max = maxInt;
        },

        message: function(inletId, arg1, arg2) {
            if (inletId === 0) {
                if (arg1 === 'bang') this.outputRandomInt();
                else if (arg1 === 'seed'); // TODO: seeding, not available with `Math.rand`
            } else if (inletId === 1) this.setMax(arg1);
        },

        outputRandomInt: function() {
            this.outlets[0].message(Math.floor(Math.random() * this.max));
        }

    });

    // Metronome, outputs 'bang' every `rate` milliseconds.
    // TODO: sample-exactitude ? How does it work in pd ?
    Pd.objects['metro'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function(rate) {
            this.setRate(rate || 0);
            this.toDspTickNoOp();
            this._intervalId = null;
            this._metroTick = this._metroTickNormal;
        },

        // Metronome rate, in ms per tick
        setRate: function(rate) {
            this.assertIsNumber(rate, 'invalid rate ' + rate);
            this.rate = rate;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                if (msg === 'bang') this._restartMetroTick();
                else if (msg === 'stop') this._stopMetroTick(); 
                else {
                    this.assertIsNumber(msg, 'invalid msg ' + msg);
                    if (msg === 0) this._stopMetroTick();
                    else this._restartMetroTick();
                }
            } else if (inletId === 1) {
                this.setRate(msg);
                this._metroTick = this._metroTickRateChange;
            }
        },

        _startMetroTick: function() {
            this._metroTick();
            if (this._intervalId === null) {
                this._intervalId = this.patch.interval(this.rate, function() { this._metroTick(); }, this);
            }
        },

        _stopMetroTick: function() {
            if (this._intervalId !== null) {
                this.patch.clear(this._intervalId);
                this._intervalId = null;
            }
        },

        _restartMetroTick: function() {
            this._stopMetroTick();
            this._startMetroTick();
        },

        _metroTickNormal: function() { this.outlets[0].message('bang'); },

        // Ticks, restarts the interval and switches to normal ticking.
        // This is useful when the rate was changed.
        _metroTickRateChange: function() {
            this._metroTick = this._metroTickNormal;
            this._restartMetroTick();
        }
    });

    // Delay, outputs 'bang' after a given time in milliseconds.
    // TODO: sample-exactitude ? How does it work in pd ?
    Pd.objects['delay'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],
        abbreviations: ['del'],

        init: function(delay) {
            this.setDelay(delay || 0);
            this.toDspTickNoOp();
            this._timeoutId = null;
        },

        // Delay time, in ms
        setDelay: function(delay) {
            this.assertIsNumber(delay, 'invalid delay ' + delay);
            this.delay = delay;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                if (msg === 'bang') {
                    this._stopDelay();
                    this._startDelay();
                } else if (msg === 'stop') this._stopDelay(); 
                else {
                    this.setDelay(msg);
                    this._stopDelay();
                    this._startDelay();
                }
            } else if (inletId === 1) this.setDelay(msg);
        },

        _startDelay: function() {
            if (this._timeoutId === null) {
                this._timeoutId = this.patch.timeout(this.delay, this._delayReached, this);
            }
        },

        _stopDelay: function() {
            if (this._timeoutId !== null) {
                this.patch.clear(this._timeoutId);
                this._timeoutId = null;
            }
        }, 

        _delayReached: function() { this.outlets[0].message('bang'); }
    });

    // TODO: How does it work in pd ?
    // TODO: frameRate change ?
    Pd.objects['timer'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet'],

        init: function() {
            // Reference frame, the timer count starts from this  
            this.refFrame = 0;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                this.assertIsBang(msg, 'unvalid message : ' + msg);
                this.refFrame = this.patch.frame;
            } else if (inletId === 1) {
                var patch = this.patch;
                this.assertIsBang(msg, 'unvalid message : ' + msg);
                this.outlets[0].message((patch.frame - this.refFrame) *  
                    patch.blockSize * 1000 / patch.sampleRate);
            }
        }

    });

    Pd.objects['receive'] = Pd.NamedObject.extend({

        inletTypes: [],
        outletTypes: ['outlet'],
        abbreviations: ['r'],

        init: function(name) {
            var onMsgReceived = this._messageHandler();
            this.on('change:name', function(oldName, newName) {
                var patch = this.patch;
                if (patch) {
                    if (oldName) patch.removeListener('msg:' + oldName, onMsgReceived);
                    patch.on('msg:' + newName, onMsgReceived);
                }
            });
            this.setName(name);
        },

        _messageHandler: function() {
            var self = this;
            return function() {
                var outlet = self.outlets[0];
                outlet.message.apply(outlet, arguments);
            };
        }

    });

    Pd.objects['send'] = Pd.NamedObject.extend({

        inletTypes: ['inlet'],
        outletTypes: [],
        abbreviations: ['s'],

        init: function(name) {
            this.setName(name);
        },

        message: function(inletId) {
            if (inletId === 0) {
                var patch = this.patch,
                    args = Array.prototype.slice.call(arguments, 1);

                patch.send.apply(patch, [this.name].concat(args));
            }
        }

    });

/**************************** Lists *********************************/

    Pd.objects['list split'] = Pd.Object.extend({

        inletTypes: ['inlet', 'inlet'],
        outletTypes: ['outlet', 'outlet', 'outlet'],

        init: function(splitInd) {
            this.setSplitInd(splitInd || 0);
        },

        setSplitInd: function(ind) {
            this.assertIsNumber(ind, 'split point must be a number');
            this.splitInd = ind;
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                var list = Array.prototype.slice.call(arguments, 1);
                if (this.splitInd > list.length) this.outlets[2].message('bang');
                else {
                    var outlet;
                    if (this.splitInd === list.length) this.outlets[1].message('bang');
                    else {
                        outlet = this.outlets[1];
                        outlet.message.apply(outlet, list.slice(this.splitInd, list.length));
                    }
                    if (this.splitInd === 0) this.outlets[0].message('bang');
                    else {
                        outlet = this.outlets[0];
                        outlet.message.apply(outlet, list.slice(0, this.splitInd));
                    }
                }
            } else if (inletId === 1) this.setSplitInd(msg);
        }

    });


/************************** DSP objects ******************************/
  
    // Basic oscillator
    Pd.objects['osc~'] = Pd.Object.extend({
        // TODO : reset phase takes float and no bang
        // TODO : recalculate stuff on sample rate change. (Useless ?)

        inletTypes: ['inlet~', 'inlet'],
        outletTypes: ['outlet~'],

        init: function(freq) {
            this.setFreq(freq || 0);
            this.phase = 0;
            this.dspTick = this.dspTickConstFreq;
            this.on('inletConnect', this._onInletConnect);
            this.on('inletDisconnect', this._onInletDisconnect);
        },

        load: function() {
            this.setFreq(this.freq);
            // TODO: this needs to be recalculated on sampleRate change
            this.J = 2 * Math.PI / this.patch.sampleRate;
        },

        // Sets the frequency for the constant frequency dspTick method.
        setFreq: function(freq) {
            this.assertIsNumber(freq, 'frequency must be a number');
            this.freq = freq;
            // TODO: this needs to be recalculated on sampleRate change
            if (this.patch) this.K = 2 * Math.PI * this.freq / this.patch.sampleRate;
        },

        // Calculates the cos taking the frequency from dsp inlet
        dspTickVariableFreq: function() {
            var inBuff = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                J = this.J, phase = this.phase, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                phase += J * inBuff[i];
                outBuff[i] = Math.cos(phase);
            }
            this.phase = phase;
        },

        // Calculates the cos with a constant frequency from first inlet
        dspTickConstFreq: function() {
            var outBuff = this.outlets[0].getBuffer(),
                K = this.K, phase = this.phase, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                phase += K;
                outBuff[i] = Math.cos(phase);
            }
            this.phase = phase;
        },

        message: function(inletId, msg) {
            if (inletId === 0) this.setFreq(msg);
            else if (inletId === 1 && msg === 'bang') this.phase = 0;
        },

        // On inlet connection, we change dspTick method if appropriate
        _onInletConnect: function() {
            if (this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickVariableFreq;
            }
        },

        // On inlet disconnection, we change dspTick method if appropriate
        _onInletDisconnect: function() {
            if (!this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickConstFreq;
            }
        }

    });

    // Sawtooth generator
    Pd.objects['phasor~'] = Pd.Object.extend({
        // TODO : reset phase
        // TODO : recalculate stuff on sample rate change. (Useless ?)
        // TODO : lots of common code between osc~ and phasor~ 

        inletTypes: ['inlet~', 'inlet'],
        outletTypes: ['outlet~'],

        init: function(freq) {
            this.setFreq(freq || 0);
            this.dspTick = this.dspTickConstFreq;
            this.phase = 0;
            this.on('inletConnect', this._onInletConnect);
            this.on('inletDisconnect', this._onInletDisconnect);
        },

        load: function() {
            this.setFreq(this.freq);
            // TODO: this needs to be recalculated on sampleRate change
            this.J = 1 / this.patch.sampleRate;
        },

        // Sets the frequency for the constant frequency dspTick method.
        setFreq: function(freq) {
            this.assertIsNumber(freq, 'frequency must be a number');
            this.freq = freq;
            // TODO: this needs to be recalculated on sampleRate change
            if (this.patch) this.K = this.freq / this.patch.sampleRate;
        },

        // Calculates the sawtooth taking the frequency from dsp inlet
        dspTickVariableFreq: function() {
            var inBuff = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                J = this.J, phase = this.phase, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                phase = (phase + J * inBuff[i]) % 1;
                outBuff[i] = phase;
            }
            this.phase = phase;
        },

        // Calculates the sawtooth with a constant frequency from first inlet
        dspTickConstFreq: function() {
            var outBuff = this.outlets[0].getBuffer(),
                K = this.K, phase = this.phase, i, length;

            for (i = 0, length = outBuff.length; i < length; i++, phase++) {
                phase = (phase + K) % 1;
                outBuff[i] = phase;
            }
            this.phase = phase;
        },

        message: function(inletId, msg) {
            if (inletId === 0) this.setFreq(msg);
            else if (inletId === 1 && msg === 'bang') this.phase = 0;
        },

        // On inlet connection, we change dspTick method if appropriate
        _onInletConnect: function() {
            if (this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickVariableFreq;
            }
        },

        // On inlet disconnection, we change dspTick method if appropriate
        _onInletDisconnect: function() {
            if (!this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickConstFreq;
            }
        }

    });

    // White noise generator 
    Pd.objects['noise~'] = Pd.Object.extend({

        outletTypes: ['outlet~'],

        dspTick: function() {
            var outBuff = this.outlets[0].getBuffer(),
                J = this.J, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = 2 * Math.random() - 1;
            }
        }
    });

    // digital to analogue converter (sound output)
    Pd.objects['dac~'] = Pd.Object.extend({

        endPoint: true,
        inletTypes: ['inlet~', 'inlet~'],

        dspTick: function() {
            this.patch.output = [
                this.inlets[0].getBuffer(),
                this.inlets[1].getBuffer()
            ];
        }
    });

    // creates simple dsp lines
    Pd.objects['line~'] = Pd.Object.extend({

        inletTypes: ['inlet'],
        outletTypes: ['outlet~'],

        init: function() {
            // what the value was at the start of the line
            this.y0 = 0;
            // the destination value we are aiming for
            this.y1 = 0;
                  // this stores the current index 
                  this.n = 0;
            // this stores the index max the line must reach
            this.nMax = 0;
            // we want to use the dsptick method that returns a constant value for now
            this.toDspConst(this.y0);
        },

        // write a constant value to our output buffer for every sample
        dspTickConst: function() {
            var outBuff = this.outlets[0].getBuffer(),
                i, length, y0 = this.y0;

            for (i = 0, length = outBuff.length; i < length; i++) outBuff[i] = y0;
        },

        // write this correct value of the line at each sample
        dspTickLine: function() {
            var outBuff = this.outlets[0].getBuffer(),
                outBuffLength = outBuff.length,
                slope = this.slope,
                i, j;

            for (i = 0; i < outBuffLength; i++, this.n++) {
                // if we've reached the end of our line, we fill-in the rest of the buffer,
                // break, and switch back to the constant method.
                if (this.n >= this.nMax) {
                    for (j = i; j < outBuffLength; j++) outBuff[j] = this.y1;
                    this.toDspConst(this.y1);
                    this.emit('end');
                    break;
                } else {
                    outBuff[i] = this.n * slope + this.y0;
                }
            }
        },

        message: function(inletId, y1, duration) {
            if (inletId === 0) {
                // if this is a single valued message we want line~ to output a constant value,
                // otherwise the message is taken as [targetY duration(
                this.assertIsNumber(y1, 'invalid value ' + y1);
                if (duration !== undefined) {
                    this.assertIsNumber(duration, 'invalid duration ' + duration);
                    this.toDspLine(y1, duration);
                } else {
                    this.toDspConst(y1);
                }
            }
        },

        toDspConst: function(val) {
            this.y0 = val;
            this.dspTick = this.dspTickConst;
        },

        toDspLine: function(val, duration) {
            this.y1 = val;
            this.n = 0;
            this.nMax = duration * this.patch.sampleRate / 1000;
            this.slope = (this.y1 - this.y0) / this.nMax;
            this.dspTick = this.dspTickLine;
        }
    });  

    // Low-pass filter
    // TODO : same algo as in Pd
    Pd.objects['lop~'] = Pd.Object.extend({

        inletTypes: ['inlet~', 'inlet'],
        outletTypes: ['outlet~'],

        init: function(freq) {
            this.ym1 = 0;
            this.setCutOffFreq(freq || 0);
            // Only zeros when no dsp connected 
            this.dspTick = this.dspTickZeros;
            this.on('inletConnect', this._onInletConnect);
            this.on('inletDisconnect', this._onInletDisconnect);
        },

        load: function() {
            this.setCutOffFreq(this.cutOffFreq);
        },

        // TODO: recalculate when sample rate changes.
        setCutOffFreq: function(freq) {
            this.assertIsNumber(freq, 'invalid cut-off frequency ' + freq);
            this.cutOffFreq = freq;
            freq = Math.max(0, freq);
            this.coef = freq * 2 * Math.PI / this.patch.sampleRate;
            this.coef = Math.max(0, this.coef);
            this.coef = Math.min(1, this.coef);
        },

        dspTickFiltering: function() {
            var inBuff = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                coef = this.coef, i, length;

            // y[i] := y[i-1] + α * (x[i] - y[i-1]) | source : wikipedia
            outBuff[0] = this.ym1 + coef * (inBuff[0] - this.ym1);
            for (i = 1, length = outBuff.length; i < length; i++) {
                outBuff[i] = outBuff[i-1] + coef * (inBuff[i] - outBuff[i-1]);
            }
            this.ym1 = outBuff[length-1];
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                if (msg === 'clear') this.ym1 = 0;
            } else if (inletId === 1) {
                this.setCutOffFreq(msg);
            }
        },

        // On inlet connection, we change dspTick method if appropriate
        _onInletConnect: function() {
            if (this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickFiltering;
            }
        },

        // On inlet disconnection, we change dspTick method if appropriate
        _onInletDisconnect: function() {
            if (!this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickZeros;
            }
        }
    });

    // High-pass filter
    // TODO : same algo as in Pd
    Pd.objects['hip~'] = Pd.Object.extend({

        inletTypes: ['inlet~', 'inlet'],
        outletTypes: ['outlet~'],

        init: function(freq) {
            this.xm1 = 0;
            this.ym1 = 0;
            this.setCutOffFreq(freq || 0);
            // Only zeros when no dsp connected 
            this.dspTick = this.dspTickZeros;
            this.on('inletConnect', this._onInletConnect);
            this.on('inletDisconnect', this._onInletDisconnect);
        },

        load: function() {
            this.setCutOffFreq(this.cutOffFreq);
        },

        // TODO: recalculate when sample rate changes.
        setCutOffFreq: function(freq) {
            this.assertIsNumber(freq, 'invalid cut-off frequency ' + freq);
            this.cutOffFreq = freq;
            freq = Math.max(0, freq);
			this.coef = 1 - freq * 2 * Math.PI / this.patch.sampleRate;
            this.coef = Math.max(0, this.coef);
            this.coef = Math.min(1, this.coef);
        },

        dspTickFiltering: function() {
            var inBuff = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                coef = this.coef, i, next, length;

            // y[i] := α * (y[i-1] + x[i] - x[i-1]) | source : wikipedia
            outBuff[0] = coef * (this.ym1 + inBuff[0] - this.xm1);
			for (i = 1, length = outBuff.length; i < length; i++) {
                outBuff[i] = coef * (outBuff[i-1] + inBuff[i] - inBuff[i-1]);
			}
            this.ym1 = outBuff[length-1];
            this.xm1 = inBuff[length-1];
        },

        message: function(inletId, msg) {
            if (inletId === 0) {
                if (msg === 'clear') {
                    this.ym1 = 0;
                    this.xm1 = 0;
                }
            } else if (inletId === 1) {
                this.setCutOffFreq(msg);
            }
        },

        // On inlet connection, we change dspTick method if appropriate
        _onInletConnect: function() {
            if (this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickFiltering;
            }
        },

        // On inlet disconnection, we change dspTick method if appropriate
        _onInletDisconnect: function() {
            if (!this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickZeros;
            }
        }
    });

    // Base for [delread~] and [delwrite~]
    var DSPDelBase = Pd.Object.extend({

        setDellineName: function(name) {
            var oldName = this.dellineName;
            this.dellineName = name;
            if (this.patch) {
                var delline = Pd.getUniquelyNamedObject('delline', name);
                if (!delline) throw (new Error('delay line ' + name + ' doesn\'t exist'));
                this.delline = delline;
            }
            this.emit('change:dellineName', oldName, name);
        },

        load: function() {
            this.setDellineName(this.dellineName);
        }
    });

    // Write to a delay line. We need to make sure that all dsp for all [delwrite~] 
    // occurs before dsp for [delread~].
    Pd.objects['delwrite~'] = DSPDelBase.extend({

        inletTypes: ['inlet~'],
        endPoint: true,
        endPointPriority: 10,

        init: function(dellineName, dellineSize) {
            this.dellineName = dellineName;
            this.dellineSize = dellineSize;
            this.delline = null;
            this.dspTick = this.dspTickZeros;
            // Create the delline if it doesn't exist yet
            if (!Pd.getUniquelyNamedObject('delline', dellineName)) {
                new Pd.objects['delline'](null, [dellineName, this.patch.millisToSamp(dellineSize)]);
            } else console.warning('delay line ' + dellineName + ' already exists.');
            this.on('inletConnect', this._onInletConnect);
            this.on('inletDisconnect', this._onInletDisconnect);
        },

        dspTickWriting: function() {
            this.delline.write(this.inlets[0].getBuffer());
        },

        dspTickZeros: function() {
            this.delline.write(Pd.fillWithZeros(Pd.newBuffer()));
        },

        // On inlet connection, we change dspTick method if appropriate
        _onInletConnect: function() {
            if (this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickWriting;
            }
        },

        // On inlet disconnection, we change dspTick method if appropriate
        _onInletDisconnect: function() {
            if (!this.inlets[0].hasDspSources()) {
                this.dspTick = this.dspTickZeros;
            }
        }
    });

    // creates simple dsp lines
    Pd.objects['delread~'] = DSPDelBase.extend({

        inletTypes: ['inlet'],
        outletTypes: ['outlet~'],

        init: function(dellineName, delay) {
            this.dellineName = dellineName;
            this.delline = null;
            this.setDelay(delay || 0);
            this.on('change:dellineName', function() {
                this.setDelay(this.delay);
            });
        },

        dspTick: function() {
            var outBuff = this.outlets[0].getBuffer();
            this.delline.read(outBuff, this.delline.pos - this.delaySamp - outBuff.length);
        },

        setDelay: function(delay) {
            this.assertIsNumber(delay, 'invalid delay value ' + delay);
            this.delay = delay;
            if (this.delline) {
                this.delay = Math.min(this.patch.sampToMillis(this.delline.size), this.delay);
                this.delay = Math.max(0, this.delay);
            }
            this.delaySamp = this.patch.millisToSamp(this.delay);
        },

        message: function(inletId, delay) {
            if (inletId === 0) this.setDelay(delay);
        }
    });

    // clips an audio signal
    Pd.objects['clip~'] = Pd.Object.extend({

        inletTypes: ['inlet~', 'inlet', 'inlet'],
        outletTypes: ['outlet~'],

        init: function(lowVal, highVal) {
            lowVal = lowVal || 0;
            highVal = highVal || 0;
            this.setLowVal(lowVal);
            this.setHighVal(highVal);
        },

        dspTick: function() {
            var outBuff = this.outlets[0].getBuffer(),
                inBuff = this.inlets[0].getBuffer(),
                i, length;
            
            for (i = 0, length = inBuff.length; i < length; i++) {
                outBuff[i] = Math.max(Math.min(inBuff[i], this.highVal), this.lowVal);
            }
        },

        setLowVal: function(val) {
            this.assertIsNumber(val, 'invalid low value ' + val);
            this.lowVal = val;
        },

        setHighVal: function(val) {
            this.assertIsNumber(val, 'invalid high value ' + val);
            if (val < this.lowVal) throw new Error('high value cannot be less than low value');
            this.highVal = val;
        },

        message: function(inletId, val) {
            if (inletId === 1) this.setLowVal(val);
            else if (inletId === 2) this.setHighVal(val);
        }
    });


    // White noise generator 
    Pd.objects['sig~'] = Pd.Object.extend({

        outletTypes: ['outlet~'],
        inletTypes: ['inlet'],

        init: function(val) {
            this.setVal(val || 0);
        },

        setVal: function(val) {
            this.assertIsNumber(val, 'invalid value ' + val);
            this.val = val;
        }, 

        message: function(inletId, val) {
            if (inletId === 0) this.setVal(val);
        },

        dspTick: function() {
            var outBuff = this.outlets[0].getBuffer(),
                i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = this.val;
            }
        }
    });

/************************** DSP arithmetics ******************************/

    var DSPArithmBase = Pd.Object.extend({

        inletTypes: ['inlet~', 'inlet~'],
        outletTypes: ['outlet~'],

        init: function(val) {
            this.setVal(val || 0);
            this.dspTick = this.dspTickConstant;
            this.on('inletConnect', this._onInletConnect);
            this.on('inletDisconnect', this._onInletDisconnect);
        },

        setVal: function(val) {
            this.assertIsNumber(val, 'invalid constant value ' + val);
            this.val = val;
        }, 

        message: function(inletId, val) {
            if (inletId === 1) this.setVal(val);
        },

        // This is the dspTick method used when there is a dsp connection in inlet 1
        dspTickVariable: Pd.notImplemented,

        // This is the dspTick method used when there is NO dsp connection in inlet 1
        dspTickConstant: Pd.notImplemented,

        // On inlet connection, we change dspTick method if appropriate
        _onInletConnect: function() {
            if (this.inlets[1].hasDspSources()) {
                this.dspTick = this.dspTickVariable;
            }
        },

        // On inlet disconnection, we change dspTick method if appropriate
        _onInletDisconnect: function() {
            if (!this.inlets[1].hasDspSources()) {
                this.dspTick = this.dspTickConstant;
            }
        }
    });

    // dsp multiply object
    Pd.objects['*~'] = DSPArithmBase.extend({

        dspTickVariable: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                inBuff2 = this.inlets[1].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] * inBuff2[i];
            }
        },

        dspTickConstant: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                val = this.val, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] * val;
            }
        }

    });

    // dsp divide object (d_arithmetic.c line 454 - over_perform() )
    Pd.objects['/~'] = DSPArithmBase.extend({

        dspTickVariable: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                inBuff2 = this.inlets[1].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                val2, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                val2 = inBuff2[i];
                outBuff[i] = (val2 ? inBuff1[i] / val2 : 0);
            }
        },

        dspTickConstant: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                val = this.val, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = (val ? inBuff1[i] / val : 0);
            }
        }

    });

    // dsp addition object
    Pd.objects['+~'] = DSPArithmBase.extend({

        dspTickVariable: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                inBuff2 = this.inlets[1].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] + inBuff2[i];
            }
        },

        dspTickConstant: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                val = this.val, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] + val;
            }
        }

    });

    // dsp substraction object
    Pd.objects['-~'] = DSPArithmBase.extend({

        dspTickVariable: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                inBuff2 = this.inlets[1].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] - inBuff2[i];
            }
        },

        dspTickConstant: function() {
            var inBuff1 = this.inlets[0].getBuffer(),
                outBuff = this.outlets[0].getBuffer(),
                val = this.val, i, length;

            for (i = 0, length = outBuff.length; i < length; i++) {
                outBuff[i] = inBuff1[i] - val;
            }
        }

    });

/************************** DSP tables ******************************/

    // Baseclass for tabwrite~, tabread~ and others ...
    var DSPTabBase = Pd.Object.extend({

        init: function(tableName) {
            this.tableName = tableName;
            this.table = null;
        },

        load: function() {
            this.setTableName(this.tableName);
        },

        setTableName: function(name) {
            var oldName = this.tableName;
            this.tableName = name;
            if (this.patch) {
                var table = Pd.getUniquelyNamedObject('table', name);
                if (!table) throw (new Error('table with name ' + name + ' doesn\'t exist'));
                this.table = table;
            }
            this.emit('change:tableName', oldName, name);
        }
    });

    // read data from a table with no interpolation
    Pd.objects['tabread~'] = DSPTabBase.extend({

        inletTypes: ['inlet~'],
        outletTypes: ['outlet~'],

        init: function(tableName) {
            DSPTabBase.prototype.init.call(this, tableName);
            this.toDspTickZeros();
            this.on('change:tableName', function() {
                this.dspTick = this.dspTickReading;
            });
        },

        dspTickReading: function() {
            var outBuff = this.outlets[0].getBuffer(),
                inBuff = this.inlets[0].getBuffer(),
                tableMax = this.table.size - 1,
                tableData = this.table.data,
                s, i, length;

            // cf. pd : Incoming values are truncated to the next lower integer,
            // and values out of bounds get the nearest (first or last) point.
            for (i = 0, length = outBuff.length; i < length; i++) {
                s = Math.floor(inBuff[i]);
                outBuff[i] = tableData[(s >= 0 ? (s > tableMax ? tableMax : s) : 0)];
            }
        },

        message: function(inletId, method, arg) {
            if (inletId === 0) {
                if (method === 'set') this.setTableName(arg);
            }
        }
    });

    // read data from a table with interpolation
    // TODO: onset (inlet 1)
    // TODO: use the real Pd algo (right now this is a simple linear interpolation, no 4-points)
    Pd.objects['tabread4~'] = DSPTabBase.extend({

        inletTypes: ['inlet~'],
        outletTypes: ['outlet~'],

        init: function(tableName) {
            DSPTabBase.prototype.init.call(this, tableName);
            this.toDspTickZeros();
            this.on('change:tableName', function() {
                this.dspTick = this.dspTickReading;
            });
        },

        dspTickReading: function() {
            var outBuff = this.outlets[0].getBuffer(),
                inBuff = this.inlets[0].getBuffer(),
                tableMax = this.table.size - 1,
                tableData = this.table.data,
                x, x1, x2, y1, y2, i, length;

            // cf. pd : Incoming values are truncated to the next lower integer,
            // and values out of bounds get the nearest (first or last) point.
            for (i = 0, length = outBuff.length; i < length; i++) {
                x = inBuff[i];
                x1 = Math.floor(x);
                x2 = Math.ceil(x);
                x1 = (x1 >= 0 ? (x1 > tableMax ? tableMax : x1) : 0);
                x2 = (x2 >= 0 ? (x2 > tableMax ? tableMax : x2) : 0);
                if (x1 === x2) outBuff[i] = tableData[x1];
                else {
                    y1 = tableData[x1];
                    y2 = tableData[x2];
                    outBuff[i] = y1 + (x - x1) * (y2 - y1);
                }
            }
        },

        message: function(inletId, method, arg) {
            if (inletId === 0) {
                if (method === 'set') this.setTableName(arg);
            }
        }
    });

    // play data from a table with no interpolation
    Pd.objects['tabplay~'] = DSPTabBase.extend({

        inletTypes: ['inlet'],
        outletTypes: ['outlet~'],

        init: function(tableName) {
            DSPTabBase.prototype.init.call(this, tableName);
            this.pos = 0;
            this.posMax = 0;        // the position after the last position to be read
            this.toDspTickZeros();
        },

        dspTickReading: function() {
            var outBuff = this.outlets[0].getBuffer(),
                iMax = Math.min(outBuff.length, this.posMax - this.pos),
                i, j, length;

            for (i = 0; i < iMax; i++, this.pos++) {
                outBuff[i] = this.table.data[this.pos];
            }
            // If we've reached the last position, that's it
            if (this.pos === this.posMax) {
                Pd.fillWithZeros(outBuff, i);
                this.toDspTickZeros();
                this.emit('end');
            }
        },

        message: function(inletId, arg1, arg2) {
            if (inletId === 0) {
                if (arg1 === 'set') {
                    this.setTableName(arg2);
                    this.toDspTickZeros();
                } else if (arg1 === 'bang') {
                    this.toDspTickReading(0);
                } else if (arg1 !== undefined) {
                    this.assertIsNumber(arg1, 'not a valid start position ' + arg1);
                    if (arg2 !== undefined) {
                        this.assertIsNumber(arg2, 'not a valid sample number ' + arg2);
                        this.toDspTickReading(arg1, arg2);
                    } else {
                        this.toDspTickReading(arg1);
                    }
                }
            }
        },

        toDspTickReading: function(startPos, sampleNum) {
            if (startPos >= this.table.size - 1) return;
            sampleNum = sampleNum || (this.table.size - startPos);
            this.pos = startPos;
            this.posMax = Math.min(startPos + sampleNum, this.table.size);
            this.dspTick = this.dspTickReading;
        }

    });

    // read data from a table with no interpolation
    Pd.objects['tabwrite~'] = DSPTabBase.extend({

        inletTypes: ['inlet~'],
        endPoint: true,

        init: function(tableName) {
            DSPTabBase.prototype.init.call(this, tableName);
            this.pos = 0;
            this.toDspTickNoOp();
        },

        dspTickWriting: function() {
            var inBuff = this.inlets[0].getBuffer(),
                iMax = Math.min(inBuff.length, this.table.size - this.pos),
                i;
            
            for (i = 0; i < iMax; i++, this.pos++) {
                this.table.data[this.pos] = inBuff[i];
            }
            // If we reached table size, that's it
            if (this.pos === this.table.size) {
                this.toDspTickNoOp();
                this.emit('end');
            }
        },

        message: function(inletId, command, arg) {
            if (inletId === 0) {
                if (command === 'bang') {
                    this.toDspTickWriting(0);
                } else if (command === 'stop') {
                    this.toDspTickNoOp();
                } else if (command === 'set') {
                    this.setTableName(arg);
                    this.toDspTickNoOp();
                } else if (command === 'start') {
                    var pos = 0;
                    if (arg !== undefined) {
                        this.assertIsNumber(arg, 'invalid start position ' + arg);
                        pos = Math.floor(arg);
                    }
                    this.toDspTickWriting(pos);
                }
            }
        },

        toDspTickWriting: function(start) { 
            this.dspTick = this.dspTickWriting;
            this.pos = start;
        }
    });

    // Let each object know of what type it is
    // TODO: all object types should register with Pd.register 
    var proto, constructor, type, abbr, i;
    for (type in Pd.objects) {
        constructor = Pd.objects[type];
        if (proto = constructor.prototype) {
            proto.type = type;
            if (abbr = proto.abbreviations) {
                for (i = 0; i < abbr.length; i++) {
                    Pd.objects[abbr[i]] = constructor;
                }
            }
        }
    }

})(this.Pd);

/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

(function(Pd){

    // Regular expression to split tokens in a message.
    var tokensRe = / |\r\n?|\n/;

    // Regular expression to detect escaped dollar vars.
    var escapedDollarVarReGlob = /\\(\$\d+)/g;

    Pd.compat = {};

    // Parses argument to a string or a number.
    Pd.compat.parseArg = function(arg) {
        var parsed = Pd.compat.parseFloat(arg);
        if (Pd.isNumber(parsed)) return parsed;
        else if (Pd.isString(arg)) {
            var matched, arg = arg.substr(0);
            while (matched = escapedDollarVarReGlob.exec(arg)) {
                arg = arg.replace(matched[0], matched[1]);
            }
            return arg;
        } else throw new Error('couldn\'t parse arg ' + arg);
    };

    // Parses a float from a .pd file. Returns the parsed float or NaN.
    Pd.compat.parseFloat = function(data) {
        if (Pd.isNumber(data)) return data;
        else if (Pd.isString(data)) return parseFloat(data);
        else return NaN;
    };

    // Convert a Pd message to a javascript array
    Pd.compat.parseArgs = function(args) {
        // if it's an int, make a single valued array
        if (Pd.isNumber(args)) return [args];
        // if it's a string, split the atom
        else {
            var parts = Pd.isString(args) ? args.split(tokensRe) : args,
                parsed = [], i, length;

            for (i = 0, length = parts.length; i < length; i++) {
                if ((arg = parts[i]) === '') continue;
                else parsed.push(Pd.compat.parseArg(arg));
            }
            return parsed;
        }
    };

    
    /******************** Patch parsing ************************/

    // regular expression for finding valid lines of Pd in a file
    var linesRe = /(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}(\n|$)/gi;

    // Parses a Pd file, creates and returns a new `Pd.Patch` object from it
    // ref : http://puredata.info/docs/developer/PdFileFormat 
    Pd.compat.parse = function(txt) {
        var lastTable = null,       // last table name to add samples to
            counter = 0,
            pd = new Pd.Patch(),
            line;

        // use our regular expression to match instances of valid Pd lines
        linesRe.lastIndex = 0; // reset lastIndex, in case the previous call threw an error
        while (line = linesRe.exec(txt)) {
            var tokens = line[1].split(tokensRe),
                chunkType = tokens[0];

            // if we've found a create token
            if (chunkType === '#X') {
                var elementType = tokens[1];

                // is this an obj instantiation
                if (elementType === 'obj' || elementType === 'msg' || elementType === 'text') {
                    var proto,  // the lookup to use in the `Pd.objects` hash
                        args,   // the construction args for the object
                        obj,
                        guiX = parseInt(tokens[2], 10), guiY = parseInt(tokens[3], 10);

                    if (elementType === 'msg') {
                        proto = 'message';
                        args = tokens.slice(4);
                    } else if (elementType === 'text') {
                        proto = 'text';
                        args = [tokens.slice(4).join(' ')];
                    } else {
                        // TODO: quick fix for list split
                        if (tokens[4] === 'list') {
                            proto = tokens[4] + ' ' + tokens[5];
                            args = tokens.slice(6);
                        } else {
                            proto = tokens[4];
                            args = tokens.slice(5);
                        }
                    }

                    if (Pd.objects.hasOwnProperty(proto)) {
                        obj = new Pd.objects[proto](pd, Pd.compat.parseArgs(args));
                        obj._guiData.x = guiX;
                        obj._guiData.y = guiY;
                    } else {
                        throw new Error('unknown object "' + proto + '"');
                    }

                } else if (elementType === 'array') {
                    var arrayName = tokens[2],
                        arraySize = parseFloat(tokens[3]),
                        obj = new Pd.objects['table'](pd, [arrayName, arraySize]);

                    // remind the last table for handling correctly 
                    // the table related instructions which might follow.
                    lastTable = obj;

                } else if (elementType === 'restore') {
                  // end the current table
                  lastTable = null;

                } else if (elementType === 'connect') {
                    var obj1 = pd.getObject(parseInt(tokens[2], 10)),
                        obj2 = pd.getObject(parseInt(tokens[4], 10));
                    pd.connect(obj1.o(parseInt(tokens[3], 10)), obj2.i(parseInt(tokens[5], 10)));
                } else if (elementType === 'coords') {
                } else {
                    throw new Error('unknown element "' + elementType + '"');
                }

            } else if (chunkType === '#A') {
                // reads in part of an array/table of data, starting at the index specified in this line
                // name of the array/table comes from the the '#X array' and '#X restore' matches above
                var idx = parseFloat(tokens[1]), t, length, val;
                if (lastTable) {
                    for (t = 2, length = tokens.length; t < length; t++, idx++) {
                        val = parseFloat(tokens[t]);
                        if (Pd.isNumber(val)) lastTable.data[idx] = val;
                    }
                } else {
                    console.error('got table data outside of a table.');
                }
            } else if (chunkType === '#N') {
            } else {
                throw new Error('unknown chunk "' + chunkType + '"');
            }
        }

        // output a message with our graph
        console.debug('Graph:');
        console.debug(pd);
        
        return pd;
    };


})(this.Pd);
