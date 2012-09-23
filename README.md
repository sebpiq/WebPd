WebPd
=====

- **WebPd** is a **100% JavaScript Pure Data runtime**. It aims at allowing a subset of [Pure Data](http://crca.ucsd.edu/~msp/software.html) audio patches to run in the browser without plugins.

- **WebPd** is also a **standalone DSP library**. Every object as you know it in Pure Data provides a complete API, allowing developers to control **everything** with JavaScript.


Documentation
-------------

Here is the official [Pure Data documentation](http://crca.ucsd.edu/~msp/Pd_documentation/index.htm) by Miller Puckette, the creator of Pure Data. Note that very little of the full Pure Data functionality has been implemented yet. Most things probably won't work.

To check-out which objects are implemented, you can use the [webpd gui](http://beraebeo.futupeeps.com/webpd/demos/simple-gui/simple-gui.html).


Getting started
----------------

**Note** : _there is a complete (but simple) example in `demos/sound-check`. Also online [here](http://beraebeo.futupeeps.com/webpd/demos/sound-check/sound-check.html)._

[Download pd.js](http://beraebeo.futupeeps.com/webpd/pd.js), and include it in your webpage.

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="pd.js"></script>
    </head>
    <body></body>
</html>
```

Then, get a PD patch file, load it to a WebPd patch and start it. The way you get the PD patch file in JavaScript is up to you, ... but the prefered way is by using an Ajax request. For this I suggest to use JQuery :

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="pd.js"></script>
        <script src="jquery.js"></script>
    </head>
    <body>
        <script>
            $.get('myPatch.pd', function(patchFile) {       // Getting the PD patch file
                var patch = Pd.compat.parse(patchFile);     // Loading the WebPd patch
                patch.play();                               // Starting it
            });
        </script>
    </body>
</html>
```

**Note** : _sometimes chrome forbids JavaScript to access your file system, so getting the patch file might fail. In this case you can start chrome with the `--allow-file-access-from-files` option._


If the patch file is not too big, you can also include it directly in your page, and read it with JavaScript :

```html
<html>
    <head>
        <script src="pd.js"></script>
    </head>
    <body>
        <script id="patchFile" type="text/pd">
            #N canvas 199 234 519 300 10;
            #X obj -114 170 osc~ 440;
            #X obj -108 246 dac~;
            #X connect 0 0 1 0;
        </script>
        <script>
            var patchFile = document.getElementById('patchFile').text;      // Getting the PD patch file
            var patch = Pd.compat.parse(patchFile);                         // Loading the WebPd patch
            patch.play();                                                   // Starting it
        </script>
    </body>
</html>
```


Instructions for building pd.js
--------------------------------

To build `pd.js` and `pd-min.js` you will need *node.js*, [Jake](https://github.com/mde/jake), and [UglifyJS](https://github.com/mishoo/UglifyJS/).
Follow the instructions to install those, then in WebPd's root folder run :

    jake


Contributing
------------

Any kind of contribution would be very very welcome. Right now the roadmap is a bit blurry, but I am working on it, and there'll soon be many issues open in the tracker. If you want to help anyways, don't hesitate to contact me directly, and we'll figure out something.
