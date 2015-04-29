[![Build Status](https://travis-ci.org/sebpiq/WebPd.png)](https://travis-ci.org/sebpiq/WebPd)

WebPd
=====

**WebPd** is a **100% JavaScript Pure Data runtime** using **Web Audio API** to play audio in the browser. It aims at allowing a subset of [Pure Data](http://crca.ucsd.edu/~msp/software.html) patches to run in the browser without plugins and with best possible performance.

Patches still have to be created using Pure Data, but with a few lines of JavaScript you can use **WebPd** to embed a patch into a web page.

**WebPd** should be supported by all [browsers supporting Web Audio API](http://caniuse.com/#search=web%20audio%20api).

**Note** : for documentation about Pd objects or tutorials about how to make Pd patches, please refer to the official [Pure Data documentation](http://crca.ucsd.edu/~msp/Pd_documentation/index.htm).


Quick start
--------------

The following instructions provide a quick start for people with JavaScript knowledge. If you have no experience with JS, you might want to read the [step-by-step](#step-by-step-guide) guide instead.

1. Grab the latest version of **WebPd** [here](https://raw.githubusercontent.com/sebpiq/WebPd/master/dist/webpd-latest.min.js).

2. Build a web page which includes **WebPd**, loads and starts a Pd patch. `Pd.loadPatch` takes a full Pd file as a string and creates a `Patch` object from it.

```javascript
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

If you are tesing locally, be careful with your ajax request, as it might be blocked by your browser because of [same-origin policy](https://en.wikipedia.org/wiki/Same-origin_policy). For a workaround, see the [troubleshooting section](#troubleshooting).


Step-by-step guide
-------------------

The following instructions provide a detailed guide to start working with **WebPd**. If you have experience with web development, you might want to read the [quick start](#quick-start) instead.

1. First create a folder `myProject` in which you will create your first **WebPd** project. In this folder, create the following structure :

```
myProject/
    patches/
    js/
```

2. Download the [latest version of WebPd](https://raw.githubusercontent.com/sebpiq/WebPd/master/dist/webpd-latest.min.js), save it as `webpd-latest.js` onto your computer, in the folder `myProject/js`.

3. Download the [latest version of jquery](http://jquery.com/download/), save it as `jquery.js` onto your computer, in the folder `myProject/js`.

4. In the folder `myProject`, create a file called `index.html` and copy/paste the following code in it

```
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

Save that file. Be careful to use a text editor that is programming-friendly. Microsoft Word and other text processors will add a lot of extra informations, making your code impossible to understand by a web browser. I recommend using something like *notepad*, *gedit*, ...

5. Create a patch using your usual Pure Data. Make sure that you use only [supported objects and features](supported-objects-and-features). Save that patch as `myPatch.pd` in the folder `myProject/patches`.

6. Launch a local web server on your computer. For this I recommend to first [install Python](https://www.python.org/). Then open a terminal (or command prompt on windows), and using the command `cd` navigate to your folder `myProject`. When you've arrived there, run the command `python -m SimpleHTTPServer` if you are using *Python 2* or `python -m http.server` if you have *Python 3*. 

7. You can finally open your web page, and listen to your patch, by opening a web browser and navigating to [http://localhost:8000/index.html](http://localhost:8000/index.html).


Troubleshooting
------------------

[ts-cross-origin] : _> I can't run any WebPd demo on my computer_

For security reasons, browsers control access to your file system from web pages. Because of this, getting Pd files with Ajax might fail on your local machine. A workaround is to start a local server and access all the example web pages through it. 

Python comes bundled with such a web server. Open a terminal, navigate to the folder containing the web page you want to open, then run `python -m SimpleHTTPServer` if you are using *Python 2* or `python -m http.server` if you have *Python 3*. Then open your web browser to [http://localhost:8000](http://localhost:8000) and things should start working.


[ts-no-sound] : _> A patch that used to work fine with WebPd has stopped working_

**WebPd** has a few [limitations](list-of-implemented-objects-and-other-limitations). For example, some of the Pd objects are not available. Open your browser's developer console (`ctrl+shift+i` on firefox and chrome for linux or windows), and you should get a clear error message telling you if that is the case. If the error is unclear, or there is no error, it might be a bug with **WebPd**. In that case, it would be great if you could [submit a bug report](submitting-a-bug-report).


[ts-no-sound-on-mobile] : _> A patch that works fine on the desktop doesn't seem to work on mobile_

There is a tricks to have any Web Audio API web page working on mobile. First, make sure that you use a browser that does support Web Audio API. For example the default Android browser doesn't, so on Android you will have to use Chrome or Firefox. 

On IOS, things are even trickier. For security reasons, you should start WebPd only in direct answer to a user action. For example you can ask the user to click a button, and start WebPd in this button's `onclick` handler `onclick="Pd.start()"`.


List of implemented objects and other limitations
---------------------------------------------------

Not all of Pure Data's objects are available in WebPd. Please check-out the [list of available objects]().

Web Audio API works slightly differently to Pure Data, and translating Pure Data patches to Web Audio API (through WebPd), is not always an easy task indeed. You will find that some patches might perform poorly if there is too much running at the same time, or on mobile phones. For example, modulating some parameters with audio signal (frequencies, delay times, ...), as is very frequent to do in Pd might cause a performance penalty in the browser and even cause audio glitches if there is too much of them, so use with caution...


Submitting a bug report
------------------------

If you find a bug, you can submit a bug report on github's [issue tracker](https://github.com/sebpiq/WebPd/issues).

Please try to include as much information as possible. Also try to include code, and **a patch** that you cannot get to work.


API
-----

### Pd

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


Instructions for building webpd.js
------------------------------------

To build **WebPd** yourself, you will need [node.js](http://nodejs.org/) and [gulp.js](http://gulpjs.com/).

When these are installed, run `npm install` in WebPd root folder.

Finally, run `npm run build` to build a new version of WebPd in `dist/webpd-latest.js`.


Instructions for running the tests
------------------------------------

**WebPd** comes with two test suites. 

### Automated tests

The tests in `test/src` run on **node.js** using [mocha](). To run them, simply execute the command `npm test`.


### Browser tests

The tests in `test/browser` run in a web browser. 

To build them, first, scaffold the tests by running `node node_modules/waatest/bin/scaffold.js ./waatest`. This will create a folder `waatest` containing a test web page.

Build the tests by running `npm run test:browser:build`.

Then start a local web server (see [troubleshooting](#troubleshooting)), and open `waatest/index.html` in your web browser.


Contributing
------------

Any kind of contribution would be very very welcome. Check out the issue tracker or contact me directly.