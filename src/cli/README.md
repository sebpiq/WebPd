<!--
Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.

This file is part of WebPd
(see https://github.com/sebpiq/WebPd).

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
-->
To regenerate assets : 

```
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.pd.json
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.dsp-graph.json
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.js
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.as
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.wasm
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.wav
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc-app -f app
node bin/cli.mjs -i src/cli/test-assets/io.pd -o src/cli/test-assets/io/ -f app 
node bin/cli.mjs -i src/cli/test-assets/comments.pd -o src/cli/test-assets/comments.js
node bin/cli.mjs -i src/cli/test-assets/comments.pd -o src/cli/test-assets/comments.as
```