To regenerate assets : 

```
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.pd.json
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.dsp-graph.json
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.js
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.as
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.wasm
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc.wav
node bin/cli.mjs -i src/cli/test-assets/simple-osc.pd -o src/cli/test-assets/simple-osc-app -f app
```