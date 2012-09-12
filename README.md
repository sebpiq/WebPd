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

- [Download pd.js](http://beraebeo.futupeeps.com/webpd/pd.js), and include it in your webpage.

- Load a patch and start it :

```javascript
    var patch = Pd.compat.parse(patchFile);
    patch.play();
```

- That's it ? Wooow !

There is a complete (but simple) example in `demos/sound-check`. Also online [here](http://beraebeo.futupeeps.com/webpd/demos/sound-check/sound-check.html).

Instructions for building pd.js
--------------------------------

To build `pd.js` and `pd-min.js` you will need *node.js*, [Jake](https://github.com/mde/jake), and [UglifyJS](https://github.com/mishoo/UglifyJS/).
Follow the instructions to install those, then in WebPd's root folder run :

    jake

Contributing
------------

Any kind of contribution would be very very welcome. Right now the roadmap is a bit blurry, but I am working on it, and there'll soon be many issues open in the tracker. If you want to help anyways, don't hesitate to contact me directly, and we'll figure out something.
