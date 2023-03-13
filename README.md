<p align="center">
  <img src="webpd.png" />
</p>


<!-- intro start -->

**WebPd** is a compiler for audio programming language [Pure Data](puredata.info/) allowing to run **.pd** patches on web pages. 

<!-- Patches can be compiled directly [online](https://sebpiq.github.io/WebPd_website/) or [with the command line tool](#using-the-cli). -->

**WebPd is highly modular and takes a white-box approach to audio programming**. It aims to enable people with different levels of expertise to use the environment they feel most confortable with. The output of the compiler is plain human-readable JavaScript or [AssemblyScript](https://www.assemblyscript.org/) (*). This means that you're free to take the generated code and work directly with it in your own web application without using WebPd or Pure Data ever again 🌈.

**WebPd is not** an application with a graphical interface for performing audio like Pure Data is. It simply generates audio code for you. You choose *if* and *how* you want to add visuals and interactivity  [Three.js](https://threejs.org/), [p5.js](https://p5js.org/), good old JavaScript / HTML, etc, etc ... there are plenty of good options 😉.

*(\*) AssemblyScript is a TypeScript-style language which compiles to WebAssembly.*

[![](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23ed00d9)](https://github.com/sponsors/sebpiq)

<!-- intro end -->

## Using WebPd

### Through the online compiler

**The online compiler is live at the following address: https://sebpiq.github.io/WebPd_website**

With it you can compile a patch and generate an interface allowing to play that patch online. Once the compilation succeeds, you can copy and share the url with others (*). You can also try it with any patch that you found in the wild (on github, or on any of the Pure Data forums).

*(\*) Sharing a compiled patch doesn't work if you used local files for compilation.*


### Through the command line
<span id="using-the-cli"><span>

Once you're ready to go further, you can install the WebPd command-line interface (CLI). It offers more customization options, including the ability to generate a fully-functional (but bare bones) web page embedding your patch.

Open a terminal, and install the CLI with [node / npm](https://nodejs.org/) by running the following command : 

```
npm install -g webpd
```

You can then verify that installation worked by running :

```
webpd --help
```

This should output help for the CLI and will hopefully get you started.


### Getting help

If you feel stuck, there's [plenty of places](https://puredata.info/community) where you can ask for help. I recommend in particular [the discord server](https://discord.gg/AZ43djV) where you can get help quickly and find support and community for your work.

If you feel you might have stumbled upon a bug, thank you for reporting it followning [these simple guidelines](reporting-a-bug).

### You are using WebPd ?

Great 🌱 ! It helps a lot with motivation to hear that people are using it. Don't hesitate to let me know by pinging me on twitter [@sebpiq](https://twitter.com/sebpiq), or [writing me directly by email](https://second-hander.com/).


If you can afford it, you can also [donate](https://opencollective.com/webpd) to help move development forward.


## Development

### Status & roadmap

WebPd is currently under heavy development, but it is still a work in progress. You can find a list of implemented objects and features [here](https://github.com/sebpiq/WebPd/blob/main/ROADMAP.md), along with a roadmap of what's left to implement.

It is currently in alpha release which means that many of your patches will not work out of the box, because many objects and features are still missing. If you feel there is a bug, thanks for reporting it following [these simple guidelines](#reporting-a-bug) !


### Reporting a bug
<span id="reporting-a-bug"><span>

If you wish to report a bug, here is how you can do to make fixing it easier :

- First narrow it down. Remove all objects in your patch that are not related with the bug. Try to find the simplest patch with which this bug can be reproduced.
- Then submit a bug report [in github](https://github.com/sebpiq/WebPd/issues) with the following template :

```
Patch and description -> Upload your minimal patch

Current behavior -> Describe shortly how it is working at the moment

Expected behavior -> Describe shortly how it should work instead
```

### Contributing

One-time contributions or regular work on the library are more than welcome ! Contribution guidelines are coming, meanwhile if you have time and would really like to get involved you can get in touch on the issue tracker on github and I can help you getting started.

WebPd is built in several sub-packages in addition to this one which rules them all : 
- Pd file parser : https://github.com/sebpiq/WebPd_pd-parser
- WebPd compiler : https://github.com/sebpiq/WebPd_compiler
- WebPd runtime : https://github.com/sebpiq/WebPd_runtime