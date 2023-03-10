<p align="center">
  <img src="webpd.png" />
</p>


<!-- intro start -->

**WebPd** is a compiler for audio programming language [Pure Data](puredata.info/) allowing to run **.pd** patches on web pages. 

<!-- Patches can be compiled directly [online](https://sebpiq.github.io/WebPd_website/) or [with the command line tool](#using-the-cli). -->

**WebPd is highly modular and takes a white-box approach to audio programming**. It aims to enable people with different levels of expertise to use the environment they feel most confortable with to play music and sounds. The output of the compiler is plain human-readable JavaScript or [AssemblyScript](https://www.assemblyscript.org/) (*). This means that you're free to take the generated code and work directly with it in your own web application without using WebPd or Pure Data ever again 🌈.

WebPd simply generates audio code so you can choose *if* and *how* you want to add visuals and interactivity. There are plenty of good options to interact with the objects like  [Three.js](https://threejs.org/), [p5.js](https://p5js.org/), good old JavaScript / HTML, etc. An example of a patch player has recently been [published](#using-the-web-compiler). As a result, WebPd is **not** a new web editor for building patch as Pure Data does natively or a simple executor like libpd but a cutting edge engine to provide interactions with you patch through the web.

*(\*) AssemblyScript is a TypeScript-style language which compiles to WebAssembly.*

[![](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23ed00d9)](https://github.com/sponsors/sebpiq)

<!-- intro end -->

## Usage

### Web compiler and player
<span id="using-the-web-compiler"><span>

**The web compiler and a patch player are live at the following address: https://sebpiq.github.io/WebPd_website**

Just upload or give a URL(*) of a patch, compile it just in time and generate an interface allowing to play that patch in realtime instantly in your browser. Once the compilation succeeds, you can copy and share the resulting URL from the player with others(**). This URL contains all the modified parameters of the patch you have played with so that it is shared completely in its *current* state.

*(\*)You can use any public URL of a patch found in the wild (on github, Pure Data forums, etc.).*

*(\*\*)Sharing a compiled patch doesn't work if you used local files for compilation.*

### Command line interface
<span id="using-the-cli"><span>

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

If you feel you might have stumbled upon a bug, please report it following [these simple guidelines](reporting-a-bug).

### You are using WebPd?

Great 🌱 ! It helps a lot with motivation to hear that people are using it. Don't hesitate to let me know by pinging me on twitter [@sebpiq](https://twitter.com/sebpiq), or [writing me directly by email](https://second-hander.com/).


If you can afford it, you can also [donate](https://opencollective.com/webpd) to help move development forward.


## Development

### Status & roadmap

WebPd is currently under heavy development, but it is still a work in progress. A list of implemented objects, features and the roadmap are [here](https://github.com/sebpiq/WebPd/blob/main/ROADMAP.md).

The project is currently in *alpha release state* which means that many of your patches will *not* work out of the box. Many objects and features are indeed still missing. If you feel there is a bug, thanks for reporting it following [these simple guidelines](#reporting-a-bug). If you feel you could develop an object that is missing in WebPd to play a specific patch, see [contributing](#contributing).


### Reporting a bug
<span id="reporting-a-bug"><span>

If you wish to report a bug:

- First narrow it down. Remove all objects in your patch that are not related with the bug. Try to find the simplest patch with which this bug can be reproduced.
- Then submit a bug report [in github](https://github.com/sebpiq/WebPd/issues) with the following template :

```
Patch and description -> Upload your minimal patch

Current behavior -> Describe shortly how it is working at the moment

Expected behavior -> Describe shortly how it should work instead
```

### Contributing
<span id="contributing"><span>

One-time contributions or regular work on the library are more than welcome! Contribution guidelines are coming, meanwhile if you have time and would really like to get involved please get in touch on the issue tracker on GitHub. I would be pleased to help you getting started for contributing.

In case you would start to develop a new object, here are some good examples to start with:

- [clip.ts](https://github.com/sebpiq/WebPd/blob/develop/src/nodes/nodes/clip.ts)
- [clip~.ts](https://github.com/sebpiq/WebPd/blob/develop/src/nodes/nodes/clip~.ts)


## License

WebPd is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License version 3 as published by the Free Software Foundation.

WebPd is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Lesser General Public License or read the [COPYING.LESSER](https://github.com/Ircam-WAM/WebPd/blob/main/COPYING.LESSER) file for more details.


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
