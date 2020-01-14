**NOTE** : Big changes coming !!! Check [HERE](https://github.com/sebpiq/WebPd/issues/113) for more info about the status of the project!

[![Build Status](https://travis-ci.org/sebpiq/WebPd.png)](https://travis-ci.org/sebpiq/WebPd)
[![Dependency status](https://david-dm.org/sebpiq/WebPd.svg)](https://david-dm.org/sebpiq/WebPd)

WebPd
=====

**WebPd** is a **100% JavaScript Pure Data runtime** using **Web Audio API** to play audio in the browser. It aims at allowing a subset of [Pure Data](http://crca.ucsd.edu/~msp/software.html) programming language to run in the browser without plugins and with best possible performance.

**WebPd** should be supported by all [browsers supporting Web Audio API](http://caniuse.com/#search=web%20audio%20api).

The following documentation is only about **WebPd**. To learn more about Pure Data, and start creating Pd patches which you can later use with **WebPd**, please refer to the official [Pure Data documentation](http://puredata.info/).


Quick start
--------------

The following instructions provide a quick start for people with JavaScript knowledge. If you have no experience with JS, you might want to read the [step-by-step](#step-by-step-guide) guide instead.

1. Grab the latest version of WebPd from [here](https://raw.githubusercontent.com/sebpiq/WebPd/master/dist/webpd-latest.min.js).

2. Add WebPd to your Web page, and load a patch by calling [Pd.loadPatch](#pdloadpatchpatchstr).

```html
<!doctype HTML>
<html>
  <head>
    <script src="js/jquery.js"></script>
    <script src="js/webpd-latest.js"></script>
    <script>
        var patch
        $.get('patches/myPatch.pd', function(patchStr) {
          patch = Pd.loadPatch(patchStr)
          Pd.start()
        })
    </script>
  </head>

  <body></body>
</html>
```

If you are testing locally, the ajax request might be blocked by your browser because of [same-origin policy](https://en.wikipedia.org/wiki/Same-origin_policy). For a workaround, see the [troubleshooting section](#i-cant-run-any-webpd-demo-on-my-computer).


Step-by-step guide
-------------------

The following instructions provide a detailed guide to start working with WebPd. If you have experience with web development, you might want to read the [quick start](#quick-start) instead.

1. First create a folder `myProject` in which you will create your first WebPd project. In this folder, create the following structure :

  ```
  myProject/
      patches/
      js/
  ```

2. Download the [latest version of WebPd](https://raw.githubusercontent.com/sebpiq/WebPd/master/dist/webpd-latest.min.js), save it as `webpd-latest.js` onto your computer, in the folder `myProject/js`.

3. Download the [latest version of jquery](http://jquery.com/download/), save it as `jquery.js` onto your computer, in the folder `myProject/js`.

4. In the folder `myProject`, create a file called `index.html` and copy/paste the following code in it

  ```html
  <!doctype HTML>
  <html>
    <head>
      <script src="js/jquery.js"></script>
      <script src="js/webpd-latest.js"></script>
      <script>
          var patch
          $.get('patches/myPatch.pd', function(patchStr) {
            patch = Pd.loadPatch(patchStr)
            Pd.start()
          })
      </script>
    </head>

    <body></body>
  </html>
  ```

  Save that file. Be sure to use a text editor that is programmer-friendly. Microsoft Word and other text processors will add a lot of extra informations, making your code impossible to understand by a web browser. I recommend using something like *atom*, *notepad*, *gedit*, ...

5. Create a patch using Pure Data. Make sure that you use only [features and objects supported by WebPd](#list-of-implemented-objects-and-other-limitations). Save that patch as `myPatch.pd` in the folder `myProject/patches`.

6. Because we are working locally on our computer, we now need to run a web server to be able to open the web page `index.html` properly. For this, we will use the web server that comes with [Python](https://www.python.org/).

  Chances are, you already have Python installed on your computer. To check this, open a terminal (or command prompt), and run `python --version`, this should print the version of Python installed. If instead you get something like `command not found`, then you need to install Python.

  In the terminal use the command `cd` to navigate to the folder `myProject`. When you've arrived there, run the command `python -m SimpleHTTPServer` if you have **Python 2** or `python -m http.server` if you have **Python 3**.

7. You can finally open your web page and listen to your patch, by opening a web browser and navigating to [http://localhost:8000/index.html](http://localhost:8000/index.html).

8. Next :
  - Check-out the [list of available objects](https://github.com/sebpiq/WebPd/tree/master/OBJECTLIST.md), be sure to use only these in your patch.
  - Make your patch run on all browsers (including mobile), replace `Pd.start` with the [Pd.startOnClick](#pdstartonclickhtmlelement-callback) function.
  - if your patch doesn't work, check-out the [troubleshooting](#troubleshooting) section.

Examples
----------

There are a few examples in the [examples/](https://github.com/sebpiq/WebPd/tree/master/examples) folder. You can also open them online :

- [abstractions](http://sebpiq.github.io/WebPd/examples/abstractions/)
- [delays](http://sebpiq.github.io/WebPd/examples/delays/)
- [gui-controls](http://sebpiq.github.io/WebPd/examples/gui-controls/)
- [phasor](http://sebpiq.github.io/WebPd/examples/phasor/)
- [subpatches](http://sebpiq.github.io/WebPd/examples/subpatches/)
- [tabread-line](http://sebpiq.github.io/WebPd/examples/tabread-line/)
- [tabread-phasor](http://sebpiq.github.io/WebPd/examples/tabread-phasor/)


Troubleshooting
------------------

### I can't run any WebPd demo on my computer

For security reasons, browsers control access to your file system from web pages. Because of this, getting Pd files with Ajax might fail on your local machine. A workaround is to start a local server and access all the example web pages through it.

Python comes bundled with such a web server. Open a terminal, navigate to the folder containing the web page you want to open, then run `python -m SimpleHTTPServer` if you are using **Python 2** or `python -m http.server` if you are using **Python 3**. Then open your web browser to [http://localhost:8000](http://localhost:8000) and things should start working.

Alternatively, if you prefer node, you may want to install the handy [`http-server`](https://github.com/indexzero/http-server#readme) command-line utility.

### One of my patches doesn't work in WebPd

WebPd has a few [limitations](#list-of-implemented-objects-and-other-limitations). For example, some of the Pd objects are not available. Open your browser's developer console (`ctrl+shift+i` on firefox and chrome for linux or windows), and you should get a clear error message telling you what is wrong. If the error is unclear, or if there is no error, it might be a bug with WebPd. In that case, it would be great if you could [submit a bug report](#submitting-a-bug-report).

Here is a non-exhaustive list of other limitations and inconsistencies with Pure Data :

- Pd system messages, such as the widely used `[;pd dsp 1(` , are not implemented
- `[phasor~]` is not a real, perfect, phasor. You shouldn't use it to read from an array for example.
- `[phasor~]` inlet 2 (used to set the phase) is not implemented


### A patch that works fine on the desktop doesn't seem to work on mobile

WebPd uses Web Audio API, and as it happens, running Web Audio API on mobile is not always easy. First, make sure that you use a browser **that does support Web Audio API**. For example the default Android browser does not, and so on Android you have to use Chrome or Firefox.

On iPhone and iPad, you need to use the `Pd.startOnClick` helper, otherwise the sound will not work.

Also some objects such as `[adc~]` depend on features which are not available in all browsers and on all platforms. For example `[adc~]` won't work on iOS.  


List of implemented objects and other limitations
---------------------------------------------------

Not all of Pure Data's objects are available in WebPd. Please check-out the [list of available objects](https://github.com/sebpiq/WebPd/tree/master/OBJECTLIST.md).

Abstractions are implemented, but at the moment they require a bit of extra JavaScript in order to work. You can check-out the [abstractions example](https://github.com/sebpiq/WebPd/tree/master/examples/abstractions), to see how this works.

While WebPd uses only Web Audio API and should therefore be quite efficient, you might find that some patches perform poorly on mobile devices, or if there are too many objects running at the same time. This is because Web Audio API is not optimized to work in the same way as Pure Data. For example, modulating parameters with an audio signal (frequencies, delay times, ...), though it is very frequent in Pd, can cause audio glitches in the browser if you use it too much or in a big patch.


Submitting a bug report
------------------------

If you find a bug, you can submit a bug report on the project's [issue tracker](https://github.com/sebpiq/WebPd/issues).

Please try to include as much information as possible. Also try to include code, and **the patch** that you cannot get to work.


API
-----

You can use WebPd API to create patches, add objects, connect them, disconnect them, etc ... with JavaScript. Something called "dynamic patching" in Pure Data. Here is a quick example :

```javascript
Pd.start()
var patch = Pd.createPatch()                  // Create an empty patch
  , osc = patch.createObject('osc~', [440])   // Create an [osc~ 440]
  , dac = patch.createObject('dac~')          // Create a [dac~]
osc.o(0).connect(dac.i(0))                    // Connect outlet of [osc~] to left inlet of [dac~]
osc.o(0).connect(dac.i(1))                    // Connect outlet of [osc~] to right inlet of [dac~]
osc.i(0).message([330])                       // Send frequency of [osc~] to 330Hz
```

You can also use the API to integrate WebPd with pure Web Audio code. For example :

```javascript
var patch = Pd.loadPatch(patchStr)            // We assume this patch has an [outlet~] object
  , gain = Pd.getAudio().context.createGain() // We create a web audio API GainNode
patch.o(0).getOutNode().connect(gain)         // Connect the output 0 of the patch to our audio node
```

Below you can find a (mostly) complete documentation of the WebPd API. Please note that dynamic patching with WebPd is still experimental, so you might encounter some bugs. If you do, please report them to in the [issue tracker](https://github.com/sebpiq/WebPd/issues).


### Pd

#### Pd.start()

Starts WebPd DSP.

#### Pd.isStarted()

Returns `true` is WebPd DSP is started, `false` otherwise.

#### Pd.stop()

Stops WebPd DSP.

#### Pd.loadPatch(patchStr)

Loads a Pd patch, and returns a `Patch` object. `patchStr` is the whole contents of a Pd file (and not only a file name).

#### Pd.createPatch()

Creates and returns an empty `Patch` object.

#### Pd.destroyPatch(patch)

Stops and destroys `patch`.

#### Pd.receive(name, callback)

Receives messages from named senders within a patch (e.g. `[send someName]`). Example :

```javascript
Pd.receive('someName', function(args) {
  console.log('received a message from "someName" : ', args)
})
```

#### Pd.send(name, args)

Sends messages from JavaScript to a named receiver within a patch (e.g. `[receive someName]`). Example :

```javascript
Pd.send('someName', ['hello!'])
```

#### Pd.getAudio()

Returns the audio driver used by WebPd on the current page. the returned object has an attribute `context` which is an instance of Web Audio API `AudioContext` used by WebPd in the current page to instantiate low-level audio nodes. This can be useful to integrate WebPd with pure Web Audio code.

#### Pd.registerAbstraction(name, patchStr)

Registers an abstraction to WebPd. See full example [there](https://github.com/sebpiq/WebPd/tree/master/examples/abstractions).

#### Pd.registerExternal(name, customWebPdObject)

Registers a custom object to WebPd. See full example [there](https://github.com/sebpiq/WebPd/tree/master/examples/external).

#### Pd.getSupportedFormats(callback)

Get a list of audio formats supported by the current browser. For more info see [web-audio-boilerplate](https://github.com/sebpiq/web-audio-boilerplate).
Example usage :

```javascript
Pd.getSupportedFormats(function(supported) {

  // If ogg is supported, send a message to [receive MY-SAMPLE] with url to ogg file
  if (supported.indexOf('ogg') !== -1) {
    Pd.send('MY-SAMPLE', '/path/to/sample.ogg')

  // Otherwise if ogg not supported but mp3 is ...
  } else if (supported.indexOf('mp3') !== -1) {
    Pd.send('MY-SAMPLE', '/path/to/sample.mp3')

  } else {
    alert('this web browser is not supported, sorry!')
  }
})
```

#### Pd.startOnClick(htmlElement, callback)

This is a helper to maximize browser support, especially useful for iOS. For more info see [web-audio-boilerplate](https://github.com/sebpiq/web-audio-boilerplate).
Example usage :

```html
<button id="startButton">Start patch</button>
<script>
  // Now, when user clicks on button, Pd will start and sound should work even on iOS.
  var button = document.getElementById('startButton')
  Pd.startOnClick(button, function() {
    console.log('clicked!')
  })
</script>
```


### BaseNode

This is the base class for all WebPd nodes, patches, dsp or glue objects.

#### BaseNode.o(ind)

Returns the outlet `ind` of the node. If `ind` is out of range, an error will be thrown.

#### BaseNode.i(ind)

Returns the inlet `ind` of the node. If `ind` is out of range, an error will be thrown.


### Patch

#### Patch.createObject(name, args)

Creates a new object of type `name` with arguments `args`. Example :

```
var triggerObject = patch.createObject('trigger', ['bang', 'float', 'float'])
```


### Portlet

Base class for `Inlet` and `Outlet` objects.

#### Portlet.connect(otherPortlet)

Connects an inlet with and outlet. If they are already connected, nothing will happen.

#### Portlet.disconnect(otherPortlet)

Disconnects an inlet and an outlet. If they are not connected, nothing will happen.


### Inlet

#### Inlet.message(args)

Sends a message to the inlet. `args` is a list of arguments. Example :

```
print.i(0).message(['hello'])
```



Instructions for building webpd.js
------------------------------------

To build WebPd yourself, you will need [node.js](http://nodejs.org/) and [gulp.js](http://gulpjs.com/).

When these are installed, run `npm install` in WebPd root folder.

Finally, run `npm run build` to build a new version of WebPd in `dist/webpd-latest.js`.


Instructions for running the tests
------------------------------------

WebPd comes with two test suites.

### Automated tests

The tests in `test/lib` run on **node.js** using [mocha](http://mochajs.org/). To run them, simply execute the command `npm test`.


### Browser tests

The tests in `test/browser` run in a web browser.

To build them, first scaffold by running `node node_modules/waatest/bin/scaffold.js ./waatest`. This will create a folder `waatest` containing a test web page.

Build the tests by running `npm run test.browser.build`.

Then start a local web server (see [troubleshooting](#i-cant-run-any-webpd-demo-on-my-computer)), and open `waatest/index.html` in your web browser.


Contributing
------------

Any kind of contribution would be very welcome. Check out the issue tracker or contact me directly.
