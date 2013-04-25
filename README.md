[![Build Status](https://travis-ci.org/sebpiq/WebPd.png)](https://travis-ci.org/sebpiq/WebPd)

WebPd
=====

- **WebPd** is a **100% JavaScript Pure Data runtime**. It aims at allowing a subset of [Pure Data](http://crca.ucsd.edu/~msp/software.html) audio patches to run in the browser without plugins.

- **WebPd** is also a **standalone DSP library**. Every object as you know it in Pure Data exposes a complete API, allowing developers to control **everything** with JavaScript.

- checkout the [gallery](https://github.com/sebpiq/WebPd/wiki/Gallery).


Browser support
---------------

**Firefox 4.0+** | **Chrome 10.0+** | **Safari 6.0+**


What doesn't work yet
----------------------

Very little of the full Pure Data functionality has been implemented yet. To check-out which objects are implemented, you can use the [WebPd gui](http://sebpiq.github.com/WebPd/simple-gui/simple-gui.html). 
Internal messages, abstractions, subpatches and externals haven't been implemented yet.

**But everything is not lost !!!** There is way enough objects to have fun. Always test your patches with the [WebPd gui](http://sebpiq.github.com/WebPd/simple-gui/simple-gui.html). Also, the library is currently under (rather) heavy development, so stay tuned, more features will come soon. Also, check-out [the roadmap](https://github.com/sebpiq/WebPd/wiki/Roadmap).


Getting started
----------------

**Note** : _for documentation about Pd objects or tutorials about how to make Pd patches, please refer to the official [Pure Data documentation](http://crca.ucsd.edu/~msp/Pd_documentation/index.htm)._

**Note** : _there is a complete (but simple) example in `demos/sound-check`. Also online [here](http://sebpiq.github.com/WebPd/sound-check/sound-check.html)._

[Go to "dist/"](https://github.com/sebpiq/WebPd/tree/develop/dist), download the last stable version of `webpd-min.js` (click on the file, click on "raw", save the file) and include it in your webpage.

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

**Note** : _when developing on your computer Ajax requests might fail. See [troubleshooting section](#troubleshooting)._


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

Sending / receiving messages
------------------------------

To receive messages from named senders within the patch (aka. send boxes : `[send someName]`), call the `receive` method of the patch object :

```javascript
patch.receive('someName', function(msg) {
    console.log('received a message from "someName" : ', msg);
    // your code ...
});
```

In return, you can send messages from JavaScript to a named sender within the patch (aka. receive boxes : `[receive someName]`) by calling the `send` method of the patch object :

```javascript
patch.send('someName', 'hello!');
```

**Note** : _there is a an example of this in `demos/send-and-receive`. Also online [here](http://sebpiq.github.com/WebPd/send-and-receive/send-and-receive.html)._

Demos
----------

There's a bunch of demos in `demos` (surprisingly :) :

- [sound-check](http://sebpiq.github.com/WebPd/sound-check/sound-check.html) _a complete example to help you getting started._
- [send-and-receive](http://sebpiq.github.com/WebPd/send-and-receive/send-and-receive.html) _a complete example for sending/receiving messages._
- [processing-storm](http://sebpiq.github.com/WebPd/processing-storm/processing-storm.html) _an example of using WebPd with processing._
- [random-drones](http://sebpiq.github.io/pd-fileutils/randomDrone.html) _a simple experiment, generating very simple random drone patches._
- [simple-gui](http://sebpiq.github.com/WebPd/simple-gui/simple-gui.html) _a very simple GUI for WebPd. Also documents the dynamic patching API._

**Note** : _To run those demos on your own computer, you will need to build `webpd-latest.js` first. For this, follow the build instructions bellow, or simply copy the latest stable build to `dist/webpd-latest.js`. For example, if latest build is `webpd-0.2.0.js`_ :

    cp dist/webpd-0.2.0.js dist/webpd-latest.js


Troubleshooting
------------------

_> I can't run the demos on my computer / PD files won't load_

For security reasons, browsers control access to your file system from web pages. Because of this, getting Pd files with Ajax might fail on your local machine.

A workaround for Chrome is to launch it from a terminal with the option `--allow-file-access-from-files`.

For any browser, you can also start a local HTTP server. For example, if you have [Python](http://www.python.org/) installed, go to the root directory of your project, run : 

    python -m SimpleHTTPServer

then point your browser to [localhost:8000/my_page.html](localhost:8000/your_page.html).

For example, to run the `processing-storm.html` demo, open a terminal, go to `WebPd/`, start the python server, 
and point your browser to [localhost:8000/demos/processing-storm/processing-storm.html](http://localhost:8000/demos/processing-storm/processing-storm.html).


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
