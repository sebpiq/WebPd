To regenerate assets : 

```
node bin/cli.mjs -i integration-tests/cli-assets/simple-osc.pd -o integration-tests/cli-assets/simple-osc.pd.json
node bin/cli.mjs -i integration-tests/cli-assets/simple-osc.pd -o integration-tests/cli-assets/simple-osc.dsp-graph.json
node bin/cli.mjs -i integration-tests/cli-assets/simple-osc.pd -o integration-tests/cli-assets/simple-osc.js
node bin/cli.mjs -i integration-tests/cli-assets/simple-osc.pd -o integration-tests/cli-assets/simple-osc.as
node bin/cli.mjs -i integration-tests/cli-assets/simple-osc.pd -o integration-tests/cli-assets/simple-osc.wasm
node bin/cli.mjs -i integration-tests/cli-assets/simple-osc.pd -o integration-tests/cli-assets/simple-osc.wav
node bin/cli.mjs -i integration-tests/cli-assets/simple-osc.pd -o integration-tests/cli-assets/simple-osc-app -f app
```