[![Build Status](https://travis-ci.org/sebpiq/WebPd.png)](https://travis-ci.org/sebpiq/WebPd)

WebPd
=====

- **WebPd** is a **100% JavaScript Pure Data runtime**. It aims at allowing a subset of [Pure Data](http://crca.ucsd.edu/~msp/software.html) audio patches to run in the browser without plugins.

- **WebPd** is also a **standalone DSP library**. Every object as you know it in Pure Data provides a complete API, allowing developers to control **everything** with JavaScript.


Browser support
---------------

**Firefox 4.0+** | **Chrome 10.0+** | **Safari 6.0+**


Documentation
-------------

Here is the official [Pure Data documentation](http://crca.ucsd.edu/~msp/Pd_documentation/index.htm) by Miller Puckette, the creator of Pure Data.


What doesn't work yet
----------------------

Very little of the full Pure Data functionality has been implemented yet. To check-out which objects are implemented, you can use the [WebPd gui](http://beraebeo.futupeeps.com/webpd/demos/simple-gui/simple-gui.html). 
Abbreviations, internal messages, abstractions and subpatches haven't been implemented yet. Forget externals.

**But everything is not lost !!!** There is way enough objects to have fun. Always test your patches with the [WebPd gui](http://beraebeo.futupeeps.com/webpd/demos/simple-gui/simple-gui.html). Also, the library is currently under (rather) heavy development, so stay tuned, more features will come soon. Also, check-out [the roadmap](https://github.com/sebpiq/WebPd/wiki/Roadmap).


Getting started
----------------

**Note** : _there is a complete (but simple) example in `demos/sound-check`. Also online [here](http://beraebeo.futupeeps.com/webpd/demos/sound-check/sound-check.html)._

[Go to "dist/"](https://github.com/sebpiq/WebPd/tree/develop/dist), download the last stable version of `webpd-min.js` and include it in your webpage.

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="webpd-min.js"></script>
    </head>
    <body></body>
</html>
```

Then, get a Pd file, load it to a WebPd patch and start it. The way you get the Pd file in JavaScript is up to you, ... but the prefered way is by using an Ajax request. For this I suggest to use JQuery :

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="webpd-min.js"></script>
        <script src="jquery.js"></script>
    </head>
    <body>
        <script>
            $.get('myPatch.pd', function(patchFile) {       // Getting the Pd patch file
                var patch = Pd.compat.parse(patchFile);     // Loading the WebPd patch
                patch.play();                               // Starting it
            });
        </script>
    </body>
</html>
```

**Note** : _when developing on your computer, web browsers block this kind of requests for security reasons. A workaround for Chrome is to launch it from a terminal with the option `--allow-file-access-from-files`._


If the patch file is not too big, you can also include it directly in your page, and read it with JavaScript :

```html
<html>
    <head>
        <script src="webpd-min.js"></script>
    </head>
    <body>
        <script id="patchFile" type="text/pd">
            #N canvas 199 234 519 300 10;
            #X obj -114 170 osc~ 440;
            #X obj -108 246 dac~;
            #X connect 0 0 1 0;
        </script>
        <script>
            var patchFile = document.getElementById('patchFile').text;      // Getting the Pd patch file
            var patch = Pd.compat.parse(patchFile);                         // Loading the WebPd patch
            patch.play();                                                   // Starting it
        </script>
    </body>
</html>
```

Demos
----------

There's a bunch of demos in `demos` (surprisingly :) :

- [sound-check](http://beraebeo.futupeeps.com/webpd/demos/sound-check/sound-check.html) _a complete example to help you getting started._
- [processing-storm](http://beraebeo.futupeeps.com/webpd/demos/processing-storm/processing-storm.html) _a example of using WebPd with processing._
- [simple-gui](http://beraebeo.futupeeps.com/webpd/demos/simple-gui/simple-gui.html) _a very simple GUI for WebPd. Also documents the dynamic patching API._

**Note** : _To run those demos on your own computer, you will need to build `webpd-latest.js` first. For this, follow the build instructions bellow, or simply copy the latest stable build to `dist/webpd-latest.js`. For example, if latest build is `webpd-0.2.0.js`_ :

    cp dist/webpd-0.2.0.js dist/webpd-latest.js


Instructions for building webpd.js
------------------------------------

To build `webpd.js` and `webpd-min.js` yourself, you will need [node.js](http://nodejs.org/) and [Grunt](https://github.com/gruntjs/grunt).
Follow the instructions to install those, then in WebPd's root folder run :

    grunt build


Instructions for running the tests
------------------------------------

You can run the tests either with grunt, by running the command :

    grunt test

Or by opening `test/index.html` in your browser.


Contributing
------------

Any kind of contribution would be very very welcome. Check out the issue tracker or contact me directly.
