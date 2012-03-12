WebPd
=====

WebPd aims to allow a subset of [Pure Data](http://crca.ucsd.edu/~msp/software.html) audio patches to run in the browser without plugins. Right now the focus is on DSP objects, to enable you to mock up audio engines in Pd, put them on the web, and control them with Javascript.

Here are the [test pages](tests) (i.e. examples of Pd patches which run in a webpage on Firefox). To run these, you will need Firefox version 4. You can search for Firefox 4 and download it from the [Mozilla homepage](http://www.mozilla.org/). More information about the Firefox [Audio Data API](https://wiki.mozilla.org/Audio_Data_API) is available.

If you want to keep abreast of the latest changes, here is the [WebPd Google Code page](http://code.google.com/p/web-pure-data). You might also like to check [my blog](http://mccormick.cx/news).

Copyright [Chris McCormick](http://mccormick.cx/), 2010. [Licensed under the terms of the AGPLv3 or a later version of that license](COPYING).

Documentation
-------------

Here is the official [Pure Data documentation](http://crca.ucsd.edu/~msp/Pd_documentation/index.htm) by Miller Puckette, the creator of Pure Data. Note: very little of the full Pure Data functionality has been implemented yet. Most things probably won't work.

Instructions for building pd.js
--------------------------------

`pd.js` can be built with [Jake](https://github.com/mde/jake). Follow the instructions to install *Jake*, then in WebPd's root folder run :

    jake

Contributing
------------

Right now I'm really looking for people to contribute DSP/audio objects (or 'tilde' objects with names ending with '~'). The messaging side of Pd is only partially implemented. Here's how you can contribute code:

 * Get the source code (see below).
 * Browse to 'tests.html' in the webpd directory and have a look at the existing tests.
 * Find a PdObject which is not yet implemented.
 * Add your own test by modifying the 'tests' array in tests.html and creating these files in the unitests/ sub-directory:
	* A PNG render of your patch - e.g. use `scrot -s my-test-patch.png` under linux and select the portion of your patch to use as a thumbnail.
	* The patch itself created in Pd - e.g. my-test-patch.pd
 * Modify pd.js until your patch works
   * You will most likely want to add missing objects to the PdObjects array. See below for the anatomy of a PdObject.
 * Use `bzr add` and `bzr commit` to commit your changes (or `git commit`, `svn commit`, whatever).
 * Send me your changes so that I can merge them. The easiest way to do that is for you to push your code somewhere I can access it with `bzr push`. Often the best way is to push it over sftp or ftp to a web-accessible directory, and then send me the URL. e.g. `bzr push sftp://myserver.com/my/web/directory/`. If you are using git you can also push your changes into a github repository and I will merge them from there with git-svn.

Source code
-----------

### svn ###

You can use SVN to get a read-only copy of the source code from <http://code.google.com/p/web-pure-data/> with the command `svn checkout http://web-pure-data.googlecode.com/svn/trunk/ webpd-readonly`. Feel free to send me patches using diff, or else I can give you commit access to Google Code repository.

### bzr ###

You can use bzr to get the source code, which is what I use for local development.

 * Get bzr from <http://bazaar-ng.org/> or `apt-get install bzr`.
 * Get your own versioned copy of the source with the command `bzr branch http://mccormick.cx/dev/webpd/`.

The advantage of using bzr is that you can make local commits in your copy of the source, and once you are finished you can push those commits to me in one bunch. With SVN you can't push the changes back into the repository unless I give you commit access on the project.

### git ###

You could also use git-svn to fetch a copy of the source from the google code repository, and I will merge git pushes if you make them available somewhere like github. Use the [git-svn instructions from github](http://github.com/guides/import-from-subversion) if you'd like to do that.

Anatomy of a PdObject
---------------------

Here is the source code of the [+~] object, which adds two audio inlets together, with verbose comments. You can find this code inside pd.js in the PdObjects array. The really important bit is the "dsptick" method which is where the actual audio processing goes on. You can copy and paste this object to implement new Pd objects.

	// Use the object name as it appears in the Pd patch here
	"+~": {
		// Endpoints are special objects where audio finishes up and exits the patch.
		// e.g. [dac~] (audio output), [outlet~] (output to another patch), and [print~] (output to the console)
		// Most objects aren't endpoints.
		"endpoint": false,
		
		// How many audio outlets i have - an audio buffer will be created for each outlet.
		"buffers": 1,
		
		// This method is run when the object is created.
		// You can do stuff in here like read in the arguments and initialise variables.
		"init": function(args) {
			if (args.length >= 6) {
				this.val = parseFloat(args[5]);
			}
			this.pd.log(this.inlets);
		},
		
		// This is the most important method, and gets called each time the dsp graph is computed (every frame).
		// In here you should usually be taking a vector of audio data from your inlets with this.inletBuffer(0)
		// and then applying some function to every piece of audio data, and then placing the resulting output
		// into this object's outlet buffer.
		"dsptick": function() {
			// This part checks whether the object was initialised with a fixed float value. e.g. [+~ 0.5]
			// If it has been initialised with a fixed float, then we want to multiply every piece of data
			// in the audio buffer by that fixed value.
			if (this.val) {
				// Get the incoming data buffer.
				var i1 = this.inletBuffer(0);
				// Loop through the incoming data and multiply each value by our fixed integer.
				// Store the result in our outlet buffer.
				for (var i=0; i < i1.length; i++) {
					this.outlets[0][i] = i1[i] + this.val;
				}
			// If we are instead multiplying two audio streams together we execute this bit.
			} else {
				// Get the incoming data buffers of both audio streams.
				var i1 = this.inletBuffer(0);
				var i2 = this.inletBuffer(1);
				// Loop through the incoming data from both streams, multiplying them together.
				// Store the result in our outlet buffer.
				for (var i=0; i < i1.length; i++) {
					this.outlets[0][i] = i1[i] + i2[i];
				}
			}
		},
	},

Have fun!
