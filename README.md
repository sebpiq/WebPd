WebPd
=====

WebPd aims to allow a subset of [Pure Data](http://crca.ucsd.edu/~msp/software.html) audio patches to run in the browser without plugins. Right now the focus is on DSP objects, to enable you to mock up audio engines in Pd, put them on the web, and control them with Javascript.


Documentation
-------------

Here is the official [Pure Data documentation](http://crca.ucsd.edu/~msp/Pd_documentation/index.htm) by Miller Puckette, the creator of Pure Data. Note: very little of the full Pure Data functionality has been implemented yet. Most things probably won't work.

To check-out which objects are implemented, you can use the [webpd gui](http://beraebeo.futupeeps.com/webpd/demos/simple-gui/simple-gui.html).


Getting started
----------------

- [Download pd.js](http://beraebeo.futupeeps.com/webpd/pd.js), and include it in your webpage.

- Load a patch, `var patch = Pd.compat.parse(patchFile);`. 

- Start you patch, `patch.play();`

- That's it ? Wooow !


Examples
---------

There is a simple example in `demos/sound-check`. More examples will come !


Instructions for building pd.js
--------------------------------

To build `pd.js` and `pd-min.js` you will need *node.js*, [Jake](https://github.com/mde/jake), and [UglifyJS](https://github.com/mishoo/UglifyJS/).
Follow the instructions to install those, then in WebPd's root folder run :

    jake

Contributing
------------

Any kind of contribution would be very very welcome. Right now the roadmap is a bit blurry, but I am working on it, and there'll soon be many issues open in the tracker. If you want to help anyways, don't hesitate to contact me directly, and we'll figure out something.
