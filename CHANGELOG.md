1.0.0-alpha.7
---------------

- Incremented assemblyscript version from 0.25.x to 0.27.x

1.0.0-alpha.6
---------------

- Minor bug fixes

1.0.0-alpha.5
---------------

- Optimized engine (JS : file size -20% / load time -20% / run time -50% | WASM : file size -7% / load time -60% / run time -7%)
    - inlining loop calculation where possible
    - store node states in objects instead of globs
    - refactored entirely NodeImplementation
- objects `[tabread~]`, `[tabread4~]`, `[symbol]`
- in CLI : renamed `appTemplate` format to `app`, `compiledJs` to `javascript` and `compiledAsc` to `assemblyscript`

1.0.0-alpha.4
---------------

- Published WebPd API for use by third party libraries
- Automatically transform float messages to signal when sent to signal inlets
- Dependency system for smaller code generation

1.0.0-alpha.3 & 1.0.0-alpha.2
-------------------------------

- Minor bug fixes

1.0.0-alpha.1
---------------

Complete refactor of the entire library. Now instead of being a Web Audio overlay which glues 
reluctant AudioNodes together to try to make a something that remotely resembles the original Pd objects, 
it is a standalone compiler that transforms pd patches to JS code or WASM modules, and which can then be 
ran in AudioWorklets.

------------------------------------------

0.4.2
------

- objects `[swap]`, `[min]`, `[max]`, `[atan2]`, `[wrap]`, `[rmstodb]`, `[dbtorms]`, `[powtodb]`, `[dbtopow]`, `[ftom]`, `[clip]`
- fix bug with zeros in `[/]` and `[%]`
- support for comma separated messages


0.4.1
------

- object `[adc~]`


0.4.0
======

- public API to create externals
- bug fixes


0.3.2
-------

- objects `[until]`, `[cos]`, `[sin]`, `[tan]`, `[atan]`, `[log]`, `[exp]`, `[sqrt]`, `[abs]`


0.3.1
-------

- bug fixes
- object `[int]`


0.3.0
======

- Complete refactor to Web Audio API


0.2.3
------

- objects `[pack]`, `[sig~]`


0.2.2
------

- objects `[hip~]`, `[lop~]`, `[delread~]`, `[delwrite~]`, `[clip~]`
- abbreviations for object names and object arguments


0.2.1
------

- added `Pd.isSupported` method to test browser support
- objects `[tabread4~]`, `[phasor~]`, `[timer]`, `[moses]`
- changed build system to [grunt](https://github.com/gruntjs/grunt)
- changed event management to [EventEmitter2](https://github.com/hij1nx/EventEmitter2)

