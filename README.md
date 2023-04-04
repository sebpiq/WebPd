<p align="center">
  <img src="webpd.png" />
</p>

**WebPd** is a compiler for the [Pure Data](https://puredata.info/) audio programming language allowing to run **.pd** patches in web pages.

**WebPd is highly modular and takes a white-box approach to audio programming**. It converts the audio graph and processing objects from a patch into plain human-readable JavaScript or [AssemblyScript](https://www.assemblyscript.org/) (*). The pure audio generated code can be then integrated directly in any web application without using WebPd or Pure Data ever again 🌈.


[![](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23ed00d9)](https://github.com/sponsors/sebpiq)

*(\*) AssemblyScript is a TypeScript-style language which compiles to WebAssembly.*

## Usecase examples

- Publish generative musical works on the web
- Execute, tweak and share patches collectively on any machine
- Filter and playback sound and music data in realtime from web based applications and games

## Integration and scope

There are plenty of good JavaScript libraries to build interactive visual interfaces such as [Three.js](https://threejs.org/), [p5.js](https://p5js.org/), good old JavaScript / HTML / CSS, etc. Integrating them with a WebPd patch should be fairly easy. An example of such integration is the *patch player* demo, available through [the web compiler](#using-the-web-compiler).

WebPd is **not**, in itself, a complete editor and a live performance platform like Pure Data. The Pure Data graphical interface, as well as GEM, are out of the scope of WebPd. WebPd isn't either a simple executor like libpd. It is rather a lean audio compiler, which generates high-performance, human-readable and easily integrable audio code with no bloat.

## Usage

<span id="using-the-web-compiler"><span>

### Web compiler and player

**The web compiler and a patch player are live at the following address: https://sebpiq.github.io/WebPd_website**

Just upload or give a URL(*) of a patch, compile it just in time and generate an interface allowing to play that patch in realtime in your browser. Once the compilation succeeds, you can copy and share with others the resulting URL from the player(**). This URL contains all the modified parameters of the patch you have played with, so that it is shared completely in its *current* state.

*(\*)You can use any public URL of a patch found in the wild (on github, Pure Data forums, etc.).*

*(\*\*)Sharing a compiled patch doesn't work if you used local files for compilation.*

<span id="using-the-cli"><span>

### Command line interface

The command-line interface (CLI) offers more customization options, including the ability to generate a fully-functional (but bare bones) web page embedding your patch.

Open a terminal and install the CLI with [node / npm](https://nodejs.org/) by running the following command:

```
npm install -g webpd
```

Verify that installation worked by running:

```
webpd --help
```

This should output help for the CLI and will hopefully get you started.


### Getting help

If you feel stuck, there's [plenty of places](https://puredata.info/community) where you can ask for help. I recommend in particular [the discord server](https://discord.gg/AZ43djV) where you can get help quickly and find support from the community.

If you feel you might have stumbled upon a bug, please report it following [these simple guidelines](#reporting-a-bug).

### You are using WebPd?

Great 🌱 ! It helps a lot with motivation to hear that people are using it. Don't hesitate to let me know by pinging me on twitter [@sebpiq](https://twitter.com/sebpiq), or [writing me directly by email](https://second-hander.com/).


If you can afford it, you can also [donate](https://opencollective.com/webpd) to help move development forward.


## Development

### Status & roadmap

WebPd is currently under heavy development, but it is still a work in progress. A list of implemented objects, features and the roadmap are [here](https://github.com/sebpiq/WebPd/blob/main/ROADMAP.md).

The project is currently in *alpha release state* which means that many of your patches will *not* work out of the box. Many objects and features are indeed still missing. If you feel there is a bug, thanks for reporting it following [these simple guidelines](#reporting-a-bug). If you feel you could develop an object that is missing in WebPd to play a specific patch, see [contributing](#contributing).

<span id="reporting-a-bug"><span>

### Reporting a bug

If you wish to report a bug:

- First narrow it down. Remove all objects in your patch that are not related with the bug. Try to find the simplest patch with which this bug can be reproduced.
- Then submit a bug report [in github](https://github.com/sebpiq/WebPd/issues) with the following template :

```
Patch and description -> Upload your minimal patch

Current behavior -> Describe shortly how it is working at the moment

Expected behavior -> Describe shortly how it should work instead
```

<span id="contributing"><span>

### Contributing


One-time contributions or regular work on the library are more than welcome! Contribution guidelines are coming, meanwhile if you have time and would really like to get involved please get in touch on the issue tracker on GitHub. I would be pleased to help you getting started for contributing.

In case you would like to try developping a new object, here are some good examples to start with:

- [clip.ts](https://github.com/sebpiq/WebPd/blob/develop/src/nodes/nodes/clip.ts)
- [clip~.ts](https://github.com/sebpiq/WebPd/blob/develop/src/nodes/nodes/clip~.ts)

If you want to dig deeper into the code, WebPd is built in several sub-packages in addition to this one which combines them all : 

- Pd file parser : https://github.com/sebpiq/WebPd_pd-parser
- WebPd compiler : https://github.com/sebpiq/WebPd_compiler
- WebPd runtime : https://github.com/sebpiq/WebPd_runtime


## License

WebPd is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License version 3 as published by the Free Software Foundation.

WebPd is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Lesser General Public License or read the [COPYING.LESSER](https://github.com/sebpiq/WebPd/blob/main/COPYING.LESSER) file for more details.


## Authors

- Sébastien Piquemal <sebpiq@protonmail.com>
- Chris McCormick
- Brandon James
- mgsx-dev
- Atul Varma
- Ulric Wilfred
- Paul Money


## Acknowledgment and sponsors

This project has been sponsored by the [DAFNE+](https://dafneplus.eu/) european research project funded by the European Union within the "Horizon Europe" program (Grant Agreement 101061548) and [IRCAM](https://www.ircam.fr) within the WAM team from december 2022 to march 2023.