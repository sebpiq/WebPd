WebPd
=====

- **WebPd** is a **100% JavaScript Pure Data runtime**. It aims at allowing a subset of [Pure Data](http://crca.ucsd.edu/~msp/software.html) audio patches to run in the browser without plugins.

- **WebPd** is also a **standalone DSP library**. Every object as you know it in Pure Data provides a complete API, allowing developers to control **everything** with JavaScript.


Browser support
---------------

**Firefox 4.0+** | **Chrome 10.0+** | **Safari 6.0+**


Documentation
-------------

Here is the official [Pure Data documentation](http://crca.ucsd.edu/~msp/Pd_documentation/index.htm) by Miller Puckette, the creator of Pure Data. Note that very little of the full Pure Data functionality has been implemented yet. Most things probably won't work.

To check-out which objects are implemented, you can use the [webpd gui](http://beraebeo.futupeeps.com/webpd/demos/simple-gui/simple-gui.html).


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

- [sound-check](http://beraebeo.futupeeps.com/webpd/demos/sound-check/sound-check.html) : a complete example to help you getting started
- [processing-storm](http://beraebeo.futupeeps.com/webpd/demos/processing-storm/processing-storm.html) : a example of using WebPd with processing
- [simple-gui](http://beraebeo.futupeeps.com/webpd/demos/simple-gui/simple-gui.html) : a very simple GUI for WebPd. Also documents the dynamic patching API


Instructions for building webpd.js
------------------------------------

To build `webpd.js` and `webpd-min.js` yourself, you will need [node.js](http://nodejs.org/) and [Grunt](https://github.com/gruntjs/grunt).
Follow the instructions to install those, then in WebPd's root folder run :

    grunt build

**note**: _the build with grunt is not fully working yet, so you'll have to run grunt with the `--force` option_


Instructions for running the tests
------------------------------------

You can run the tests either with grunt, by running the command :

    grunt test

Or by opening `test/index.html` in your browser.


Contributing
------------

Any kind of contribution would be very very welcome. Check out the issue tracker or contact me directly.
