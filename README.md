# WebPd

*[🤑 A crowdfunding campaign to help reaching the next milestone (WebPd 1.0) is in progress !!! 🤑](https://opencollective.com/webpd#category-CONTRIBUTE)*

**WebPd** is a highly modular web audio programming toolkit inspired by **Pure Data**.

→ **it allows artists to take their Pure Data patches and run these in web pages**, therefore enabling non-programmers (sound designers, musicians, etc ... ) to design live and interactive audio for the web.

→ **it provides experienced web programmers with a complete audio toolkit** that is production-ready, and enables efficient audio synthesis and processing in the browser.

## Toolkit structure

- [@webpd/compiler-js](https://github.com/sebpiq/WebPd_compiler-js) : Compiler for compiling a DSP graph into a single JavaScript function
- [@webpd/dsp-graph](https://github.com/sebpiq/WebPd_dsp-graph) : Utilities for handling DSP graphs
- [@webpd/audioworklets](https://github.com/sebpiq/WebPd_audioworklets) : AudioWorklets for running DSP engines compiled from @webpd/compiler-js.
- [@webpd/shared](https://github.com/sebpiq/WebPd_shared) : Shared tools and types for the other packages
- [@webpd/pd-parser](https://github.com/sebpiq/WebPd_pd-parser) : Parser for pd files
- [@webpd/pd-renderer](https://github.com/sebpiq/WebPd_pd-renderer) : Renderer for pd files
- [@webpd/pd-to-dsp-graph](https://github.com/sebpiq/WebPd_pd-to-dsp-graph) : Compiler for transforming pd patches into DSP graphs

## Demos

→ A rudimentary graphical interface for writing patches in the browser, [here](https://sebpiq.github.io/WebPd_demos/the-graph/www/)


## Roadmap

### WebPd 1.0

- Porting all objects from the current version of WebPd (https://raw.githubusercontent.com/sebpiq/WebPd/master/OBJECTLIST.md)
- Implementation of the WebPd toolkit consisting in several independant packages which developers can re-use :
    - Full documentation for all the packages of the WebPd toolkit
    - Compilation of Pure Data patches to WebAssembly and/or JavaScript (https://github.com/sebpiq/WebPd_engine-live-eval)
    - AudioWorklets to run WebAssembly and/or compiled JavaScript code (https://github.com/sebpiq/WebPd_compiler-js)
    - Pd files parsing and rendering (https://github.com/sebpiq/WebPd_pd-parser, https://github.com/sebpiq/WebPd_pd-renderer)
- WebPd library as a front door packaging the whole toolkit  :
    - Full documentation available (https://github.com/sebpiq/WebPd)
    - Demos (https://github.com/sebpiq/WebPd_demos)
    - Guides and starter templates for beginners
- Building the community :
    - Finding where's the best way for asking questions, sharing demos, etc ...
    - Write a contribution guide, setup CI auto-formatting, etc ..., get the first contributors started
