$(document).ready(function() {

    var DSPObject = Pd.Object.extend({
        inletTypes: ['inlet~'],
        outletTypes: ['outlet~']
    });
    var dspObject;

    module('Pd.inlet~', {
        setup: function() {
            dspObject = new DSPObject();
        },
        teardown: function() {}
    });

    test('connect/disconnect', function() {
        var sink = dspObject.i(0);
        var source = dspObject.o(0);
        sink.connect(source);
        equal(sink.hasDspSources(), true);
        sink.disconnect(source);
        equal(sink.hasDspSources(), false);
    });

    test('connect/disconnect events', function() {
        var sink = dspObject.i(0);
        var source = dspObject.o(0);
        var hasDspSource;
        dspObject.on('inletConnect', function() { equal(this.i(0).hasDspSources(), true) }, dspObject);
        dspObject.on('inletDisconnect', function() { equal(this.i(0).hasDspSources(), false) }, dspObject);
        sink.connect(source);
        sink.disconnect(source);
    });

    test('subclassing', function() {
        var inlet = new Pd['inlet']();
        ok(inlet instanceof Pd['inlet']);
        ok(!(inlet instanceof Pd['inlet~']));
        var inlett = new Pd['inlet~']();
        ok(inlet instanceof Pd['inlet~']);
        ok(!(inlet instanceof Pd['inlet']));
    });

});
