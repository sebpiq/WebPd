/*
 * WebPd - v0.2.3
 * Copyright (c) 2013 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd for documentation
 *
 */


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

var Sink = this.Sink = function (global) {

/**
 * Creates a Sink according to specified parameters, if possible.
 *
 * @class
 *
 * @arg =!readFn
 * @arg =!channelCount
 * @arg =!bufferSize
 * @arg =!sampleRate
 *
 * @param {Function} readFn A callback to handle the buffer fills.
 * @param {Number} channelCount Channel count.
 * @param {Number} bufferSize (Optional) Specifies a pre-buffer size to control the amount of latency.
 * @param {Number} sampleRate Sample rate (ms).
 * @param {Number} default=0 writePosition Write position of the sink, as in how many samples have been written per channel.
 * @param {String} default=async writeMode The default mode of writing to the sink.
 * @param {String} default=interleaved channelMode The mode in which the sink asks the sample buffers to be channeled in.
 * @param {Number} default=0 previousHit The previous time of a callback.
 * @param {Buffer} default=null ringBuffer The ring buffer array of the sink. If null, ring buffering will not be applied.
 * @param {Number} default=0 ringOffset The current position of the ring buffer.
*/
function Sink (readFn, channelCount, bufferSize, sampleRate) {
	var	sinks	= Sink.sinks.list,
		i;
	for (i=0; i<sinks.length; i++) {
		if (sinks[i].enabled) {
			try {
				return new sinks[i](readFn, channelCount, bufferSize, sampleRate);
			} catch(e1){}
		}
	}

	throw Sink.Error(0x02);
}

function SinkClass () {
}

Sink.SinkClass = SinkClass;

SinkClass.prototype = Sink.prototype = {
	sampleRate: 44100,
	channelCount: 2,
	bufferSize: 4096,

	writePosition: 0,
	previousHit: 0,
	ringOffset: 0,

	channelMode: 'interleaved',
	isReady: false,

/**
 * Does the initialization of the sink.
 * @method Sink
*/
	start: function (readFn, channelCount, bufferSize, sampleRate) {
		this.channelCount	= isNaN(channelCount) || channelCount === null ? this.channelCount: channelCount;
		this.bufferSize		= isNaN(bufferSize) || bufferSize === null ? this.bufferSize : bufferSize;
		this.sampleRate		= isNaN(sampleRate) || sampleRate === null ? this.sampleRate : sampleRate;
		this.readFn		= readFn;
		this.activeRecordings	= [];
		this.previousHit	= +new Date();
		Sink.EventEmitter.call(this);
		Sink.emit('init', [this].concat([].slice.call(arguments)));
	},
/**
 * The method which will handle all the different types of processing applied on a callback.
 * @method Sink
*/
	process: function (soundData, channelCount) {
		this.emit('preprocess', arguments);

		if (this.ringBuffer) {
			(this.channelMode === 'interleaved' ? this.ringSpin : this.ringSpinInterleaved).apply(this, arguments);
		}

		if (this.channelMode === 'interleaved') {
			this.emit('audioprocess', arguments);

			if (this.readFn) {
				this.readFn.apply(this, arguments);
			}
		} else {
			var	soundDataSplit	= Sink.deinterleave(soundData, this.channelCount),
				args		= [soundDataSplit].concat([].slice.call(arguments, 1));
			this.emit('audioprocess', args);

			if (this.readFn) {
				this.readFn.apply(this, args);
			}

			Sink.interleave(soundDataSplit, this.channelCount, soundData);
		}
		this.emit('postprocess', arguments);
		this.previousHit = +new Date();
		this.writePosition += soundData.length / channelCount;
	},
/**
 * Get the current output position, defaults to writePosition - bufferSize.
 *
 * @method Sink
 *
 * @return {Number} The position of the write head, in samples, per channel.
*/
	getPlaybackTime: function () {
		return this.writePosition - this.bufferSize;
	},
/**
 * Internal method to send the ready signal if not ready yet.
 * @method Sink
*/
	ready: function () {
		if (this.isReady) return;

		this.isReady = true;
		this.emit('ready', []);
	}
};

/**
 * The container for all the available sinks. Also a decorator function for creating a new Sink class and binding it.
 *
 * @method Sink
 * @static
 *
 * @arg {String} type The name / type of the Sink.
 * @arg {Function} constructor The constructor function for the Sink.
 * @arg {Object} prototype The prototype of the Sink. (optional)
 * @arg {Boolean} disabled Whether the Sink should be disabled at first.
*/

function sinks (type, constructor, prototype, disabled, priority) {
	prototype = prototype || constructor.prototype;
	constructor.prototype = new Sink.SinkClass();
	constructor.prototype.type = type;
	constructor.enabled = !disabled;

	var k;
	for (k in prototype) {
		if (prototype.hasOwnProperty(k)) {
			constructor.prototype[k] = prototype[k];
		}
	}

	sinks[type] = constructor;
	sinks.list[priority ? 'unshift' : 'push'](constructor);
}

Sink.sinks = Sink.devices = sinks;
Sink.sinks.list = [];

Sink.singleton = function () {
	var sink = Sink.apply(null, arguments);

	Sink.singleton = function () {
		return sink;
	};

	return sink;
};

global.Sink = Sink;

return Sink;

}(function (){ return this; }());
void function (Sink) {

/**
 * A light event emitter.
 *
 * @class
 * @static Sink
*/
function EventEmitter () {
	var k;
	for (k in EventEmitter.prototype) {
		if (EventEmitter.prototype.hasOwnProperty(k)) {
			this[k] = EventEmitter.prototype[k];
		}
	}
	this._listeners = {};
}

EventEmitter.prototype = {
	_listeners: null,
/**
 * Emits an event.
 *
 * @method EventEmitter
 *
 * @arg {String} name The name of the event to emit.
 * @arg {Array} args The arguments to pass to the event handlers.
*/
	emit: function (name, args) {
		if (this._listeners[name]) {
			for (var i=0; i<this._listeners[name].length; i++) {
				this._listeners[name][i].apply(this, args);
			}
		}
		return this;
	},
/**
 * Adds an event listener to an event.
 *
 * @method EventEmitter
 *
 * @arg {String} name The name of the event.
 * @arg {Function} listener The event listener to attach to the event.
*/
	on: function (name, listener) {
		this._listeners[name] = this._listeners[name] || [];
		this._listeners[name].push(listener);
		return this;
	},
/**
 * Adds an event listener to an event.
 *
 * @method EventEmitter
 *
 * @arg {String} name The name of the event.
 * @arg {Function} !listener The event listener to remove from the event. If not specified, will delete all.
*/
	off: function (name, listener) {
		if (this._listeners[name]) {
			if (!listener) {
				delete this._listeners[name];
				return this;
			}

			for (var i=0; i<this._listeners[name].length; i++) {
				if (this._listeners[name][i] === listener) {
					this._listeners[name].splice(i--, 1);
				}
			}

			if (!this._listeners[name].length) {
				delete this._listeners[name];
			}
		}
		return this;
	}
};

Sink.EventEmitter = EventEmitter;

EventEmitter.call(Sink);

}(this.Sink);
void function (Sink) {

/**
 * Creates a timer with consistent (ie. not clamped) intervals even in background tabs.
 * Uses inline workers to achieve this. If not available, will revert to regular timers.
 *
 * @static Sink
 * @name doInterval
 *
 * @arg {Function} callback The callback to trigger on timer hit.
 * @arg {Number} timeout The interval between timer hits.
 *
 * @return {Function} A function to cancel the timer.
*/

Sink.doInterval = function (callback, timeout) {
	var timer, kill;

	function create (noWorker) {
		if (Sink.inlineWorker.working && !noWorker) {
			timer = Sink.inlineWorker('setInterval(function (){ postMessage("tic"); }, ' + timeout + ');');
			timer.onmessage = function (){
				callback();
			};
			kill = function () {
				timer.terminate();
			};
		} else {
			timer = setInterval(callback, timeout);
			kill = function (){
				clearInterval(timer);
			};
		}
	}

	if (Sink.inlineWorker.ready) {
		create();
	} else {
		Sink.inlineWorker.on('ready', function () {
			create();
		});
	}

	return function () {
		if (!kill) {
			if (!Sink.inlineWorker.ready) {
				Sink.inlineWorker.on('ready', function () {
					if (kill) kill();
				});
			}
		} else {
			kill();
		}
	};
};

}(this.Sink);
void function (Sink) {

var _Blob, _BlobBuilder, _URL, _btoa;

void function (prefixes, urlPrefixes) {
	function find (name, prefixes) {
		var b, a = prefixes.slice();

		for (b=a.shift(); typeof b !== 'undefined'; b=a.shift()) {
			b = Function('return typeof ' + b + name + 
				'=== "undefined" ? undefined : ' +
				b + name)();

			if (b) return b;
		}
	}

	_Blob = find('Blob', prefixes);
	_BlobBuilder = find('BlobBuilder', prefixes);
	_URL = find('URL', urlPrefixes);
	_btoa = find('btoa', ['']);
}([
	'',
	'Moz',
	'WebKit',
	'MS'
], [
	'',
	'webkit'
]);

var createBlob = _Blob && _URL && function (content, type) {
	return _URL.createObjectURL(new _Blob([content], { type: type }));
};

var createBlobBuilder = _BlobBuilder && _URL && function (content, type) {
	var bb = new _BlobBuilder();
	bb.append(content);

	return _URL.createObjectURL(bb.getBlob(type));
};

var createData = _btoa && function (content, type) {
	return 'data:' + type + ';base64,' + _btoa(content);
};

var createDynURL =
	createBlob ||
	createBlobBuilder ||
	createData;

if (!createDynURL) return;

if (createBlob) createDynURL.createBlob = createBlob;
if (createBlobBuilder) createDynURL.createBlobBuilder = createBlobBuilder;
if (createData) createDynURL.createData = createData;

if (_Blob) createDynURL.Blob = _Blob;
if (_BlobBuilder) createDynURL.BlobBuilder = _BlobBuilder;
if (_URL) createDynURL.URL = _URL;

Sink.createDynURL = createDynURL;

Sink.revokeDynURL = function (url) {
	if (typeof url === 'string' && url.indexOf('data:') === 0) {
		return false;
	} else {
		return _URL.revokeObjectURL(url);
	}
};

}(this.Sink);
void function (Sink) {

/*
 * A Sink-specific error class.
 *
 * @class
 * @static Sink
 * @name Error
 *
 * @arg =code
 *
 * @param {Number} code The error code.
 * @param {String} message A brief description of the error.
 * @param {String} explanation A more verbose explanation of why the error occured and how to fix.
*/

function SinkError(code) {
	if (!SinkError.hasOwnProperty(code)) throw SinkError(1);
	if (!(this instanceof SinkError)) return new SinkError(code);

	var k;
	for (k in SinkError[code]) {
		if (SinkError[code].hasOwnProperty(k)) {
			this[k] = SinkError[code][k];
		}
	}

	this.code = code;
}

SinkError.prototype = new Error();

SinkError.prototype.toString = function () {
	return 'SinkError 0x' + this.code.toString(16) + ': ' + this.message;
};

SinkError[0x01] = {
	message: 'No such error code.',
	explanation: 'The error code does not exist.'
};
SinkError[0x02] = {
	message: 'No audio sink available.',
	explanation: 'The audio device may be busy, or no supported output API is available for this browser.'
};

SinkError[0x10] = {
	message: 'Buffer underflow.',
	explanation: 'Trying to recover...'
};
SinkError[0x11] = {
	message: 'Critical recovery fail.',
	explanation: 'The buffer underflow has reached a critical point, trying to recover, but will probably fail anyway.'
};
SinkError[0x12] = {
	message: 'Buffer size too large.',
	explanation: 'Unable to allocate the buffer due to excessive length, please try a smaller buffer. Buffer size should probably be smaller than the sample rate.'
};

Sink.Error = SinkError;

}(this.Sink);
void function (Sink) {

/**
 * Creates an inline worker using a data/blob URL, if possible.
 *
 * @static Sink
 *
 * @arg {String} script
 *
 * @return {Worker} A web worker, or null if impossible to create.
*/

var define = Object.defineProperty ? function (obj, name, value) {
	Object.defineProperty(obj, name, {
		value: value,
		configurable: true,
		writable: true
	});
} : function (obj, name, value) {
	obj[name] = value;
};

function terminate () {
	define(this, 'terminate', this._terminate);

	Sink.revokeDynURL(this._url);

	delete this._url;
	delete this._terminate;
	return this.terminate();
}

function inlineWorker (script) {
	function wrap (type, content, typeName) {
		try {
			var url = type(content, 'text/javascript');
			var worker = new Worker(url);

			define(worker, '_url', url);
			define(worker, '_terminate', worker.terminate);
			define(worker, 'terminate', terminate);

			if (inlineWorker.type) return worker;

			inlineWorker.type = typeName;
			inlineWorker.createURL = type;

			return worker;
		} catch (e) {
			return null;
		}
	}

	var createDynURL = Sink.createDynURL;
	var worker;

	if (inlineWorker.createURL) {
		return wrap(inlineWorker.createURL, script, inlineWorker.type);
	}

	worker = wrap(createDynURL.createBlob, script, 'blob');
	if (worker) return worker;

	worker = wrap(createDynURL.createBlobBuilder, script, 'blobbuilder');
	if (worker) return worker;

	worker = wrap(createDynURL.createData, script, 'data');

	return worker;
}

Sink.EventEmitter.call(inlineWorker);

inlineWorker.test = function () {
	inlineWorker.ready = inlineWorker.working = false;
	inlineWorker.type = '';
	inlineWorker.createURL = null;

	var worker = inlineWorker('this.onmessage=function(e){postMessage(e.data)}');
	var data = 'inlineWorker';

	function ready (success) {
		if (inlineWorker.ready) return;

		inlineWorker.ready = true;
		inlineWorker.working = success;
		inlineWorker.emit('ready', [success]);
		inlineWorker.off('ready');

		if (success && worker) {
			worker.terminate();
		}

		worker = null;
	}

	if (!worker) {
		setTimeout(function () {
			ready(false);
		}, 0);
	} else {
		worker.onmessage = function (e) {
			ready(e.data === data);
		};

		worker.postMessage(data);

		setTimeout(function () {
			ready(false);
		}, 1000);
	}
};

Sink.inlineWorker = inlineWorker;

inlineWorker.test();

}(this.Sink);
void function (Sink) {

/**
 * A Sink class for the Mozilla Audio Data API.
*/

Sink.sinks('audiodata', function () {
	var	self			= this,
		currentWritePosition	= 0,
		tail			= null,
		audioDevice		= new Audio(),
		written, currentPosition, available, soundData, prevPos,
		timer; // Fix for https://bugzilla.mozilla.org/show_bug.cgi?id=630117
	self.start.apply(self, arguments);
	self.preBufferSize = isNaN(arguments[4]) || arguments[4] === null ? this.preBufferSize : arguments[4];

	function bufferFill() {
		if (tail) {
			written = audioDevice.mozWriteAudio(tail);
			currentWritePosition += written;
			if (written < tail.length){
				tail = tail.subarray(written);
				return tail;
			}
			tail = null;
		}

		currentPosition = audioDevice.mozCurrentSampleOffset();
		available = Number(currentPosition + (prevPos !== currentPosition ? self.bufferSize : self.preBufferSize) * self.channelCount - currentWritePosition);

		if (currentPosition === prevPos) {
			self.emit('error', [Sink.Error(0x10)]);
		}

		if (available > 0 || prevPos === currentPosition){
			self.ready();

			try {
				soundData = new Float32Array(prevPos === currentPosition ? self.preBufferSize * self.channelCount :
					self.forceBufferSize ? available < self.bufferSize * 2 ? self.bufferSize * 2 : available : available);
			} catch(e) {
				self.emit('error', [Sink.Error(0x12)]);
				self.kill();
				return;
			}
			self.process(soundData, self.channelCount);
			written = self._audio.mozWriteAudio(soundData);
			if (written < soundData.length){
				tail = soundData.subarray(written);
			}
			currentWritePosition += written;
		}
		prevPos = currentPosition;
	}

	audioDevice.mozSetup(self.channelCount, self.sampleRate);

	this._timers = [];

	this._timers.push(Sink.doInterval(function () {
		// Check for complete death of the output
		if (+new Date() - self.previousHit > 2000) {
			self._audio = audioDevice = new Audio();
			audioDevice.mozSetup(self.channelCount, self.sampleRate);
			currentWritePosition = 0;
			self.emit('error', [Sink.Error(0x11)]);
		}
	}, 1000));

	this._timers.push(Sink.doInterval(bufferFill, self.interval));

	self._bufferFill	= bufferFill;
	self._audio		= audioDevice;
}, {
	// These are somewhat safe values...
	bufferSize: 24576,
	preBufferSize: 24576,
	forceBufferSize: false,
	interval: 100,

	kill: function () {
		while (this._timers.length) {
			this._timers.shift()();
		}

		this.emit('kill');
	},

	getPlaybackTime: function () {
		return this._audio.mozCurrentSampleOffset() / this.channelCount;
	}
}, false, true);

Sink.sinks.moz = Sink.sinks.audiodata;

}(this.Sink);
void function (Sink) {

/**
 * A dummy Sink. (No output)
*/

Sink.sinks('dummy', function () {
	var	self = this;
	self.start.apply(self, arguments);
	
	function bufferFill () {
		var	soundData = new Float32Array(self.bufferSize * self.channelCount);
		self.process(soundData, self.channelCount);
	}

	self._kill = Sink.doInterval(bufferFill, self.bufferSize / self.sampleRate * 1000);

	self._callback		= bufferFill;
}, {
	kill: function () {
		this._kill();
		this.emit('kill');
	}
}, true);

}(this.Sink);
(function (Sink, sinks) {

sinks = Sink.sinks;

function newAudio (src) {
	var audio = document.createElement('audio');
	if (src) {
		audio.src = src;
	}
	return audio;
}

/* TODO: Implement a <BGSOUND> hack for IE8. */

/**
 * A sink class for WAV data URLs
 * Relies on pcmdata.js and utils to be present.
 * Thanks to grantgalitz and others for the idea.
*/
sinks('wav', function () {
	var	self			= this,
		audio			= new sinks.wav.wavAudio(),
		PCMData			= typeof PCMData === 'undefined' ? audioLib.PCMData : PCMData;
	self.start.apply(self, arguments);
	var	soundData		= new Float32Array(self.bufferSize * self.channelCount),
		zeroData		= new Float32Array(self.bufferSize * self.channelCount);

	if (!newAudio().canPlayType('audio/wav; codecs=1') || !btoa) throw 0;
	
	function bufferFill () {
		if (self._audio.hasNextFrame) return;

		self.ready();

		Sink.memcpy(zeroData, 0, soundData, 0);
		self.process(soundData, self.channelCount);

		self._audio.setSource('data:audio/wav;base64,' + btoa(
			audioLib.PCMData.encode({
				data:		soundData,
				sampleRate:	self.sampleRate,
				channelCount:	self.channelCount,
				bytesPerSample:	self.quality
			})
		));

		if (!self._audio.currentFrame.src) self._audio.nextClip();
	}
	
	self.kill		= Sink.doInterval(bufferFill, 40);
	self._bufferFill	= bufferFill;
	self._audio		= audio;
}, {
	quality: 1,
	bufferSize: 22050,

	getPlaybackTime: function () {
		var audio = this._audio;
		return (audio.currentFrame ? audio.currentFrame.currentTime * this.sampleRate : 0) + audio.samples;
	}
});

function wavAudio () {
	var self = this;

	self.currentFrame	= newAudio();
	self.nextFrame		= newAudio();

	self._onended		= function () {
		self.samples += self.bufferSize;
		self.nextClip();
	};
}

wavAudio.prototype = {
	samples:	0,
	nextFrame:	null,
	currentFrame:	null,
	_onended:	null,
	hasNextFrame:	false,

	nextClip: function () {
		var	curFrame	= this.currentFrame;
		this.currentFrame	= this.nextFrame;
		this.nextFrame		= curFrame;
		this.hasNextFrame	= false;
		this.currentFrame.play();
	},

	setSource: function (src) {
		this.nextFrame.src = src;
		this.nextFrame.addEventListener('ended', this._onended, true);

		this.hasNextFrame = true;
	}
};

sinks.wav.wavAudio = wavAudio;

}(this.Sink));
 (function (sinks, fixChrome82795) {

var AudioContext = typeof window === 'undefined' ? null : window.webkitAudioContext || window.AudioContext;

/**
 * A sink class for the Web Audio API
*/

sinks('webaudio', function (readFn, channelCount, bufferSize, sampleRate) {
	var	self		= this,
		context		= sinks.webaudio.getContext(),
		node		= null,
		soundData	= null,
		zeroBuffer	= null;
	self.start.apply(self, arguments);
	node = context.createJavaScriptNode(self.bufferSize, self.channelCount, self.channelCount);

	function bufferFill(e) {
		var	outputBuffer	= e.outputBuffer,
			channelCount	= outputBuffer.numberOfChannels,
			i, n, l		= outputBuffer.length,
			size		= outputBuffer.size,
			channels	= new Array(channelCount),
			tail;

		self.ready();
		
		soundData	= soundData && soundData.length === l * channelCount ? soundData : new Float32Array(l * channelCount);
		zeroBuffer	= zeroBuffer && zeroBuffer.length === soundData.length ? zeroBuffer : new Float32Array(l * channelCount);
		soundData.set(zeroBuffer);

		for (i=0; i<channelCount; i++) {
			channels[i] = outputBuffer.getChannelData(i);
		}

		self.process(soundData, self.channelCount);

		for (i=0; i<l; i++) {
			for (n=0; n < channelCount; n++) {
				channels[n][i] = soundData[i * self.channelCount + n];
			}
		}
	}

	self.sampleRate = context.sampleRate;

	node.onaudioprocess = bufferFill;
	node.connect(context.destination);

	self._context		= context;
	self._node		= node;
	self._callback		= bufferFill;
	/* Keep references in order to avoid garbage collection removing the listeners, working around http://code.google.com/p/chromium/issues/detail?id=82795 */
	// Thanks to @baffo32
	fixChrome82795.push(node);
}, {
	kill: function () {
		this._node.disconnect(0);

		for (var i=0; i<fixChrome82795.length; i++) {
			if (fixChrome82795[i] === this._node) {
				fixChrome82795.splice(i--, 1);
			}
		}

		this._node = this._context = null;
		this.emit('kill');
	},

	getPlaybackTime: function () {
		return this._context.currentTime * this.sampleRate;
	}
}, false, true);

sinks.webkit = sinks.webaudio;

sinks.webaudio.fix82795 = fixChrome82795;

sinks.webaudio.getContext = function () {
	// For now, we have to accept that the AudioContext is at 48000Hz, or whatever it decides.
	var context = new AudioContext(/*sampleRate*/);

	sinks.webaudio.getContext = function () {
		return context;
	};

	return context;
};

}(this.Sink.sinks, []));
(function (Sink) {

/**
 * A Sink class for the Media Streams Processing API and/or Web Audio API in a Web Worker.
*/

Sink.sinks('worker', function () {
	var	self		= this,
		global		= (function(){ return this; }()),
		soundData	= null,
		outBuffer	= null,
		zeroBuffer	= null;
	self.start.apply(self, arguments);

	// Let's see if we're in a worker.

	importScripts();

	function mspBufferFill (e) {
		if (!self.isReady) {
			self.initMSP(e);
		}

		self.ready();

		var	channelCount	= self.channelCount,
			l		= e.audioLength,
			n, i;

		soundData	= soundData && soundData.length === l * channelCount ? soundData : new Float32Array(l * channelCount);
		outBuffer	= outBuffer && outBuffer.length === soundData.length ? outBuffer : new Float32Array(l * channelCount);
		zeroBuffer	= zeroBuffer && zeroBuffer.length === soundData.length ? zeroBuffer : new Float32Array(l * channelCount);

		soundData.set(zeroBuffer);
		outBuffer.set(zeroBuffer);

		self.process(soundData, self.channelCount);

		for (n=0; n<channelCount; n++) {
			for (i=0; i<l; i++) {
				outBuffer[n * e.audioLength + i] = soundData[n + i * channelCount];
			}
		}

		e.writeAudio(outBuffer);
	}

	function waBufferFill(e) {
		if (!self.isReady) {
			self.initWA(e);
		}

		self.ready();

		var	outputBuffer	= e.outputBuffer,
			channelCount	= outputBuffer.numberOfChannels,
			i, n, l		= outputBuffer.length,
			size		= outputBuffer.size,
			channels	= new Array(channelCount),
			tail;
		
		soundData	= soundData && soundData.length === l * channelCount ? soundData : new Float32Array(l * channelCount);
		zeroBuffer	= zeroBuffer && zeroBuffer.length === soundData.length ? zeroBuffer : new Float32Array(l * channelCount);
		soundData.set(zeroBuffer);

		for (i=0; i<channelCount; i++) {
			channels[i] = outputBuffer.getChannelData(i);
		}

		self.process(soundData, self.channelCount);

		for (i=0; i<l; i++) {
			for (n=0; n < channelCount; n++) {
				channels[n][i] = soundData[i * self.channelCount + n];
			}
		}
	}

	global.onprocessmedia	= mspBufferFill;
	global.onaudioprocess	= waBufferFill;

	self._mspBufferFill	= mspBufferFill;
	self._waBufferFill	= waBufferFill;

}, {
	ready: false,

	initMSP: function (e) {
		this.channelCount	= e.audioChannels;
		this.sampleRate		= e.audioSampleRate;
		this.bufferSize		= e.audioLength * this.channelCount;
		this.ready		= true;
		this.emit('ready', []);
	},

	initWA: function (e) {
		var b = e.outputBuffer;
		this.channelCount	= b.numberOfChannels;
		this.sampleRate		= b.sampleRate;
		this.bufferSize		= b.length * this.channelCount;
		this.ready		= true;
		this.emit('ready', []);
	}
});

}(this.Sink));
(function (Sink) {

/**
 * Splits a sample buffer into those of different channels.
 *
 * @static Sink
 * @name deinterleave
 *
 * @arg {Buffer} buffer The sample buffer to split.
 * @arg {Number} channelCount The number of channels to split to.
 *
 * @return {Array} An array containing the resulting sample buffers.
*/

Sink.deinterleave = function (buffer, channelCount) {
	var	l	= buffer.length,
		size	= l / channelCount,
		ret	= [],
		i, n;
	for (i=0; i<channelCount; i++){
		ret[i] = new Float32Array(size);
		for (n=0; n<size; n++){
			ret[i][n] = buffer[n * channelCount + i];
		}
	}
	return ret;
};

/**
 * Joins an array of sample buffers into a single buffer.
 *
 * @static Sink
 * @name resample
 *
 * @arg {Array} buffers The buffers to join.
 * @arg {Number} !channelCount The number of channels. Defaults to buffers.length
 * @arg {Buffer} !buffer The output buffer.
 *
 * @return {Buffer} The interleaved buffer created.
*/

Sink.interleave = function (buffers, channelCount, buffer) {
	channelCount		= channelCount || buffers.length;
	var	l		= buffers[0].length,
		bufferCount	= buffers.length,
		i, n;
	buffer			= buffer || new Float32Array(l * channelCount);
	for (i=0; i<bufferCount; i++) {
		for (n=0; n<l; n++) {
			buffer[i + n * channelCount] = buffers[i][n];
		}
	}
	return buffer;
};

/**
 * Mixes two or more buffers down to one.
 *
 * @static Sink
 * @name mix
 *
 * @arg {Buffer} buffer The buffer to append the others to.
 * @arg {Buffer} bufferX The buffers to append from.
 *
 * @return {Buffer} The mixed buffer.
*/

Sink.mix = function (buffer) {
	var	buffers	= [].slice.call(arguments, 1),
		l, i, c;
	for (c=0; c<buffers.length; c++){
		l = Math.max(buffer.length, buffers[c].length);
		for (i=0; i<l; i++){
			buffer[i] += buffers[c][i];
		}
	}
	return buffer;
};

/**
 * Resets a buffer to all zeroes.
 *
 * @static Sink
 * @name resetBuffer
 *
 * @arg {Buffer} buffer The buffer to reset.
 *
 * @return {Buffer} The 0-reset buffer.
*/

Sink.resetBuffer = function (buffer) {
	var	l	= buffer.length,
		i;
	for (i=0; i<l; i++){
		buffer[i] = 0;
	}
	return buffer;
};

/**
 * Copies the content of a buffer to another buffer.
 *
 * @static Sink
 * @name clone
 *
 * @arg {Buffer} buffer The buffer to copy from.
 * @arg {Buffer} !result The buffer to copy to.
 *
 * @return {Buffer} A clone of the buffer.
*/

Sink.clone = function (buffer, result) {
	var	l	= buffer.length,
		i;
	result = result || new Float32Array(l);
	for (i=0; i<l; i++){
		result[i] = buffer[i];
	}
	return result;
};

/**
 * Creates an array of buffers of the specified length and the specified count.
 *
 * @static Sink
 * @name createDeinterleaved
 *
 * @arg {Number} length The length of a single channel.
 * @arg {Number} channelCount The number of channels.
 * @return {Array} The array of buffers.
*/

Sink.createDeinterleaved = function (length, channelCount) {
	var	result	= new Array(channelCount),
		i;
	for (i=0; i<channelCount; i++){
		result[i] = new Float32Array(length);
	}
	return result;
};

Sink.memcpy = function (src, srcOffset, dst, dstOffset, length) {
	src	= src.subarray || src.slice ? src : src.buffer;
	dst	= dst.subarray || dst.slice ? dst : dst.buffer;

	src	= srcOffset ? src.subarray ?
		src.subarray(srcOffset, length && srcOffset + length) :
		src.slice(srcOffset, length && srcOffset + length) : src;

	if (dst.set) {
		dst.set(src, dstOffset);
	} else {
		for (var i=0; i<src.length; i++) {
			dst[i + dstOffset] = src[i];
		}
	}

	return dst;
};

Sink.memslice = function (buffer, offset, length) {
	return buffer.subarray ? buffer.subarray(offset, length) : buffer.slice(offset, length);
};

Sink.mempad = function (buffer, out, offset) {
	out = out.length ? out : new (buffer.constructor)(out);
	Sink.memcpy(buffer, 0, out, offset);
	return out;
};

Sink.linspace = function (start, end, out) {
	var l, i, n, step;
	out	= out.length ? (l=out.length) && out : Array(l=out);
	step	= (end - start) / --l;
	for (n=start+step, i=1; i<l; i++, n+=step) {
		out[i] = n;
	}
	out[0]	= start;
	out[l]	= end;
	return out;
};

Sink.ftoi = function (input, bitCount, output) {
	var i, mask = Math.pow(2, bitCount - 1);

	output = output || new (input.constructor)(input.length);

	for (i=0; i<input.length; i++) {
		output[i] = ~~(mask * input[i]);
	}

	return output;
};

}(this.Sink));
(function (Sink) {

function Proxy (bufferSize, channelCount) {
	Sink.EventEmitter.call(this);

	this.bufferSize		= isNaN(bufferSize) || bufferSize === null ? this.bufferSize : bufferSize;
	this.channelCount	= isNaN(channelCount) || channelCount === null ? this.channelCount : channelCount;

	var self = this;
	this.callback = function () {
		return self.process.apply(self, arguments);
	};

	this.resetBuffer();
}

Proxy.prototype = {
	buffer: null,
	zeroBuffer: null,
	parentSink: null,
	bufferSize: 4096,
	channelCount: 2,
	offset: null,

	resetBuffer: function () {
		this.buffer	= new Float32Array(this.bufferSize);
		this.zeroBuffer	= new Float32Array(this.bufferSize);
	},

	process: function (buffer, channelCount) {
		if (this.offset === null) {
			this.loadBuffer();
		}

		for (var i=0; i<buffer.length; i++) {
			if (this.offset >= this.buffer.length) {
				this.loadBuffer();
			}

			buffer[i] = this.buffer[this.offset++];
		}
	},

	loadBuffer: function () {
		this.offset = 0;
		Sink.memcpy(this.zeroBuffer, 0, this.buffer, 0);
		this.emit('audioprocess', [this.buffer, this.channelCount]);
	}
};

Sink.Proxy = Proxy;

/**
 * Creates a proxy callback system for the sink instance.
 * Requires Sink utils.
 *
 * @method Sink
 * @method createProxy
 *
 * @arg {Number} !bufferSize The buffer size for the proxy.
*/
Sink.prototype.createProxy = function (bufferSize) {
	var	proxy		= new Sink.Proxy(bufferSize, this.channelCount);
	proxy.parentSink	= this;

	this.on('audioprocess', proxy.callback);

	return proxy;
};

}(this.Sink));
(function (Sink) {

(function(){

/**
 * If method is supplied, adds a new interpolation method to Sink.interpolation, otherwise sets the default interpolation method (Sink.interpolate) to the specified property of Sink.interpolate.
 *
 * @arg {String} name The name of the interpolation method to get / set.
 * @arg {Function} !method The interpolation method.
*/

function interpolation(name, method) {
	if (name && method) {
		interpolation[name] = method;
	} else if (name && interpolation[name] instanceof Function) {
		Sink.interpolate = interpolation[name];
	}
	return interpolation[name];
}

Sink.interpolation = interpolation;


/**
 * Interpolates a fractal part position in an array to a sample. (Linear interpolation)
 *
 * @param {Array} arr The sample buffer.
 * @param {number} pos The position to interpolate from.
 * @return {Float32} The interpolated sample.
*/
interpolation('linear', function (arr, pos) {
	var	first	= Math.floor(pos),
		second	= first + 1,
		frac	= pos - first;
	second		= second < arr.length ? second : 0;
	return arr[first] * (1 - frac) + arr[second] * frac;
});

/**
 * Interpolates a fractal part position in an array to a sample. (Nearest neighbour interpolation)
 *
 * @param {Array} arr The sample buffer.
 * @param {number} pos The position to interpolate from.
 * @return {Float32} The interpolated sample.
*/
interpolation('nearest', function (arr, pos) {
	return pos >= arr.length - 0.5 ? arr[0] : arr[Math.round(pos)];
});

interpolation('linear');

}());


/**
 * Resamples a sample buffer from a frequency to a frequency and / or from a sample rate to a sample rate.
 *
 * @static Sink
 * @name resample
 *
 * @arg {Buffer} buffer The sample buffer to resample.
 * @arg {Number} fromRate The original sample rate of the buffer, or if the last argument, the speed ratio to convert with.
 * @arg {Number} fromFrequency The original frequency of the buffer, or if the last argument, used as toRate and the secondary comparison will not be made.
 * @arg {Number} toRate The sample rate of the created buffer.
 * @arg {Number} toFrequency The frequency of the created buffer.
 *
 * @return The new resampled buffer.
*/
Sink.resample	= function (buffer, fromRate /* or speed */, fromFrequency /* or toRate */, toRate, toFrequency) {
	var
		argc		= arguments.length,
		speed		= argc === 2 ? fromRate : argc === 3 ? fromRate / fromFrequency : toRate / fromRate * toFrequency / fromFrequency,
		l		= buffer.length,
		length		= Math.ceil(l / speed),
		newBuffer	= new Float32Array(length),
		i, n;
	for (i=0, n=0; i<l; i += speed) {
		newBuffer[n++] = Sink.interpolate(buffer, i);
	}
	return newBuffer;
};

}(this.Sink));
void function (Sink) {

Sink.on('init', function (sink) {
	sink.activeRecordings = [];
	sink.on('postprocess', sink.recordData);
});

Sink.prototype.activeRecordings = null;

/**
 * Starts recording the sink output.
 *
 * @method Sink
 * @name record
 *
 * @return {Recording} The recording object for the recording started.
*/
Sink.prototype.record = function () {
	var recording = new Sink.Recording(this);
	this.emit('record', [recording]);
	return recording;
};
/**
 * Private method that handles the adding the buffers to all the current recordings.
 *
 * @method Sink
 * @method recordData
 *
 * @arg {Array} buffer The buffer to record.
*/
Sink.prototype.recordData = function (buffer) {
	var	activeRecs	= this.activeRecordings,
		i, l		= activeRecs.length;
	for (i=0; i<l; i++) {
		activeRecs[i].add(buffer);
	}
};

/**
 * A Recording class for recording sink output.
 *
 * @class
 * @static Sink
 * @arg {Object} bindTo The sink to bind the recording to.
*/

function Recording (bindTo) {
	this.boundTo = bindTo;
	this.buffers = [];
	bindTo.activeRecordings.push(this);
}

Recording.prototype = {
/**
 * Adds a new buffer to the recording.
 *
 * @arg {Array} buffer The buffer to add.
 *
 * @method Recording
*/
	add: function (buffer) {
		this.buffers.push(buffer);
	},
/**
 * Empties the recording.
 *
 * @method Recording
*/
	clear: function () {
		this.buffers = [];
	},
/**
 * Stops the recording and unbinds it from it's host sink.
 *
 * @method Recording
*/
	stop: function () {
		var	recordings = this.boundTo.activeRecordings,
			i;
		for (i=0; i<recordings.length; i++) {
			if (recordings[i] === this) {
				recordings.splice(i--, 1);
			}
		}
	},
/**
 * Joins the recorded buffers into a single buffer.
 *
 * @method Recording
*/
	join: function () {
		var	bufferLength	= 0,
			bufPos		= 0,
			buffers		= this.buffers,
			newArray,
			n, i, l		= buffers.length;

		for (i=0; i<l; i++) {
			bufferLength += buffers[i].length;
		}
		newArray = new Float32Array(bufferLength);
		for (i=0; i<l; i++) {
			for (n=0; n<buffers[i].length; n++) {
				newArray[bufPos + n] = buffers[i][n];
			}
			bufPos += buffers[i].length;
		}
		return newArray;
	}
};

Sink.Recording = Recording;

}(this.Sink);
void function (Sink) {

function processRingBuffer () {
	if (this.ringBuffer) {
		(this.channelMode === 'interleaved' ? this.ringSpin : this.ringSpinInterleaved).apply(this, arguments);
	}
}

Sink.on('init', function (sink) {
	sink.on('preprocess', processRingBuffer);
});

Sink.prototype.ringBuffer = null;

/**
 * A private method that applies the ring buffer contents to the specified buffer, while in interleaved mode.
 *
 * @method Sink
 * @name ringSpin
 *
 * @arg {Array} buffer The buffer to write to.
*/
Sink.prototype.ringSpin = function (buffer) {
	var	ring	= this.ringBuffer,
		l	= buffer.length,
		m	= ring.length,
		off	= this.ringOffset,
		i;
	for (i=0; i<l; i++){
		buffer[i] += ring[off];
		off = (off + 1) % m;
	}
	this.ringOffset = off;
};

/**
 * A private method that applies the ring buffer contents to the specified buffer, while in deinterleaved mode.
 *
 * @method Sink
 * @name ringSpinDeinterleaved
 *
 * @param {Array} buffer The buffers to write to.
*/
Sink.prototype.ringSpinDeinterleaved = function (buffer) {
	var	ring	= this.ringBuffer,
		l	= buffer.length,
		ch	= ring.length,
		m	= ring[0].length,
		len	= ch * m,
		off	= this.ringOffset,
		i, n;
	for (i=0; i<l; i+=ch){
		for (n=0; n<ch; n++){
			buffer[i + n] += ring[n][off];
		}
		off = (off + 1) % m;
	}
	this.ringOffset = n;
};

}(this.Sink);
void function (Sink, proto) {

proto = Sink.prototype;

Sink.on('init', function (sink) {
	sink.asyncBuffers	= [];
	sink.syncBuffers	= [];
	sink.on('preprocess', sink.writeBuffersSync);
	sink.on('postprocess', sink.writeBuffersAsync);
});

proto.writeMode		= 'async';
proto.asyncBuffers	= proto.syncBuffers = null;

/**
 * Private method that handles the mixing of asynchronously written buffers.
 *
 * @method Sink
 * @name writeBuffersAsync
 *
 * @arg {Array} buffer The buffer to write to.
*/
proto.writeBuffersAsync = function (buffer) {
	var	buffers		= this.asyncBuffers,
		l		= buffer.length,
		buf,
		bufLength,
		i, n, offset;
	if (buffers) {
		for (i=0; i<buffers.length; i++) {
			buf		= buffers[i];
			bufLength	= buf.b.length;
			offset		= buf.d;
			buf.d		-= Math.min(offset, l);
			
			for (n=0; n + offset < l && n < bufLength; n++) {
				buffer[n + offset] += buf.b[n];
			}
			buf.b = buf.b.subarray(n + offset);
			if (i >= bufLength) {
				buffers.splice(i--, 1);
			}
		}
	}
};

/**
 * A private method that handles mixing synchronously written buffers.
 *
 * @method Sink
 * @name writeBuffersSync
 *
 * @arg {Array} buffer The buffer to write to.
*/
proto.writeBuffersSync = function (buffer) {
	var	buffers		= this.syncBuffers,
		l		= buffer.length,
		i		= 0,
		soff		= 0;
	for (;i<l && buffers.length; i++) {
		buffer[i] += buffers[0][soff];
		if (buffers[0].length <= soff){
			buffers.splice(0, 1);
			soff = 0;
			continue;
		}
		soff++;
	}
	if (buffers.length) {
		buffers[0] = buffers[0].subarray(soff);
	}
};

/**
 * Writes a buffer asynchronously on top of the existing signal, after a specified delay.
 *
 * @method Sink
 * @name writeBufferAsync
 *
 * @arg {Array} buffer The buffer to write.
 * @arg {Number} delay The delay to write after. If not specified, the Sink will calculate a delay to compensate the latency.
 * @return {Number} The number of currently stored asynchronous buffers.
*/
proto.writeBufferAsync = function (buffer, delay) {
	buffer			= this.mode === 'deinterleaved' ? Sink.interleave(buffer, this.channelCount) : buffer;
	var	buffers		= this.asyncBuffers;
	buffers.push({
		b: buffer,
		d: isNaN(delay) ? ~~((+new Date() - this.previousHit) / 1000 * this.sampleRate) : delay
	});
	return buffers.length;
};

/**
 * Writes a buffer synchronously to the output.
 *
 * @method Sink
 * @name writeBufferSync
 *
 * @param {Array} buffer The buffer to write.
 * @return {Number} The number of currently stored synchronous buffers.
*/
proto.writeBufferSync = function (buffer) {
	buffer			= this.mode === 'deinterleaved' ? Sink.interleave(buffer, this.channelCount) : buffer;
	var	buffers		= this.syncBuffers;
	buffers.push(buffer);
	return buffers.length;
};

/**
 * Writes a buffer, according to the write mode specified.
 *
 * @method Sink
 * @name writeBuffer
 *
 * @arg {Array} buffer The buffer to write.
 * @arg {Number} delay The delay to write after. If not specified, the Sink will calculate a delay to compensate the latency. (only applicable in asynchronous write mode)
 * @return {Number} The number of currently stored (a)synchronous buffers.
*/
proto.writeBuffer = function () {
	return this[this.writeMode === 'async' ? 'writeBufferAsync' : 'writeBufferSync'].apply(this, arguments);
};

/**
 * Gets the total amount of yet unwritten samples in the synchronous buffers.
 *
 * @method Sink
 * @name getSyncWriteOffset
 *
 * @return {Number} The total amount of yet unwritten samples in the synchronous buffers.
*/
proto.getSyncWriteOffset = function () {
	var	buffers		= this.syncBuffers,
		offset		= 0,
		i;
	for (i=0; i<buffers.length; i++) {
		offset += buffers[i].length;
	}
	return offset;
};

} (this.Sink);

/*
 * Copyright (c) 2012 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd for documentation
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
        blockSize: 128,

        // The number of audio channels on the output
        channelCount: 2,

        debugMode: false,

        // Array type to use. If the browser support Float arrays, this will be Float array type.
        arrayType: Array,

        // Array slice function, to unify slicing float arrays and normal arrays.
        arraySlice: function (array, start) { return array.slice(start); }
    };

    // use a Float32Array if we have it
    if (typeof Float32Array !== "undefined") {
        Pd.arrayType = Float32Array;
        Pd.arraySlice = function (array, start) { return array.subarray(start); };
    }

    // Returns true if the current browser supports WebPd, false otherwise.
    Pd.isSupported = function() {
        // Web audio API - Chrome, Safari
        var test = typeof window === 'undefined' ? null : window.webkitAudioContext || window.AudioContext;
        if (test) return true;

        // Audio data API - Firefox
        var audioDevice = new Audio();
        if (audioDevice.mozSetup) return true;

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
 * Copyright (c) 2012 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd for documentation
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

    var SinkAdapter = function(desiredSampleRate, blockSize) {
        AudioDriverInterface.prototype.constructor.apply(this, arguments);
        this._sink = null;
        this._batchSize = 4;
    };

    Pd.extend(SinkAdapter.prototype, AudioDriverInterface.prototype, {

        // fetch the current sample rate we are operating at
        getSampleRate: function() { 
            if (this._sink) return this._sink.sampleRate;
            else {
                var sink = Sink(null, this._channelCount, null, this._sampleRate);
                return sink.sampleRate;
            } 
        },

        // Stop the audio from playing
        stop: function() {
            this._sink.kill();
            this._sink = null;
        },

        // Start the audio playing with the supplied function as the audio-block generator
        play: function(generator) {
            var me = this,
                // We set the buffer size to an exact number of blocks,
                // that way we don't have to think about overflows
                bufferSize = this._blockSize * this._batchSize * this._channelCount,
                blockBufferSize = this._channelCount * me._blockSize,
                // Sink(callback, channelCount, preBufferSize, sampleRate)
                sink = Sink(null, this._channelCount, null, this._sampleRate),
                proxy = sink.createProxy(bufferSize);
            this._sink = sink;

            // this callback takes generated blocks, and copy them directly
            // to the buffer supplied by sink.js.
            proxy.on('audioprocess', function(buffer){
                var pos = 0, i, length, bPos, block;

                // how many blocks we should generate and add to the buffer
                for (i = 0, length = me._batchSize; i < length; i++) {
                    bPos = 0;
                    block = generator();
                    for (pos, bPos; bPos < blockBufferSize; pos++, bPos++) {
                        buffer[pos] = block[bPos];
                    }
                }
            });

            // activating sink.js debugging 
            sink.on('error', function(e){
                console.error(e);
            });
        },

        // test whether this driver is currently playing audio
        isPlaying: function() {
            return this._sink !== null;
        }

    });

    Pd.AudioDriver = SinkAdapter;

})(this.Pd);


/*
 * Copyright (c) 2012 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd for documentation
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
 * Copyright (c) 2012 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd for documentation
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
 * Copyright (c) 2012 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd for documentation
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
        // output buffer (stereo)
        this.output = Pd.newBuffer(2);
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
            var patch = this, output = this.output,
                i, obj, endPoints = this.getEndPoints(),
                cbs = this._scheduled[this.frame] || [], cbObj;
            delete this._scheduled[this.frame];

            // reset our output buffer (gets written to by dac~ objects)
            Pd.fillWithZeros(output);

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

            return output;
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
 * Copyright (c) 2012 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd for documentation
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
          var inBuff1 = this.inlets[0].getBuffer(),
              inBuff2 = this.inlets[1].getBuffer(),
              output = this.patch.output,
              i, length;

          // copy interleaved data from inlets to the graph's output buffer
          for (i = 0, length = output.length; i < length; i++) {
              output[i * 2] += inBuff1[i];
              output[i * 2 + 1] += inBuff2[i];
          }
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
 * Copyright (c) 2012 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd for documentation
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
