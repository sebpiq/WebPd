$(document).ready(function() {

    var MyObject = Pd.Object.extend({
        init: function(objName) {
            this.objName = objName;
        },
        type: 'myobject'
    });
    var MyEndPointObject = MyObject.extend({
        endPoint: true
    });
    var DspObject = Pd.Object.extend({
        inletTypes: ['inlet~'],
        outletTypes: ['outlet~'],
        dspTick: Pd.Object.prototype.dspTickId,
        type: 'myObject2'
    });
    var DspEndPointObject = Pd.Object.extend({
        inletTypes: ['inlet~'],
        outletTypes: ['outlet~'],
        endPoint: true,
        dspTick: Pd.Object.prototype.dspTickId,
        type: 'myObject3'
    });

    var patch;
    var obj1;
    var obj2;
    var obj3;
    var table1;
    var table2;
    var ep1;
    var ep2;

    module('Pd.Patch', {
        setup: function() {
            patch = new Pd.Patch();
            obj1 = new MyObject(null, ['obj1']);
            obj2 = new MyObject(null, ['obj2']);
            obj3 = new MyObject(null, ['obj3']);
            table1 = new Pd.objects['table'](null, ['table1', 100]);
            table2 = new Pd.objects['table'](null, ['table2', 100]);
            ep1 = new MyEndPointObject(null, ['ep1']);
            ep2 = new MyEndPointObject(null, ['ep2']);
        },
        teardown: function() {
            Pd._uniquelyNamedObjects = {};
        }
    });

    test('generateFrame, circular ref', function() {
        var patch = new Pd.Patch(),
            obj1 = new DspObject(patch, []),
            obj2 = new DspEndPointObject(patch, []);

        equal(obj1.frame, -1);
        equal(obj2.frame, -1);
        patch.connect(obj1.o(0), obj2.i(0));
        patch.generateFrame();
        equal(obj1.frame, 0);
        equal(obj2.frame, 0);
        patch.connect(obj2.o(0), obj1.i(0));
        patch.generateFrame();
        equal(obj1.frame, 1);
        equal(obj2.frame, 1);
    });

    test('graphiness : addObject / getObject', function() {

        // Add an object
        patch.addObject(obj1);
        var ind1 = obj1.id;
        ok(ind1 !== undefined);
        deepEqual(patch.getObject(ind1), obj1);

        // Add same object
        patch.addObject(obj1);
        equal(ind1, obj1.id);

        // Add second object
        patch.addObject(obj2);
        var ind2 = obj2.id;
        ok(ind2 !== undefined);
        ok(ind2 !== ind1);
        equal(patch.getObject(ind1), obj1);
        equal(patch.getObject(ind2), obj2);

        // Get unknown object
        equal(patch.getObject(8888009098080879), null);
    });

    test('graphiness : removeObject', function() {
        var SomeSource = MyObject.extend({outletTypes: ['outlet~']});
        var SomeSink = MyObject.extend({inletTypes: ['inlet~'], outletTypes: ['outlet~'], endPoint: true});
        var SomeEndPoint = MyObject.extend({inletTypes: ['inlet~']});
        var obj1 = new SomeSource(patch, ['obj1']);
        var obj2 = new SomeSink(patch, ['obj2']);
        var obj3 = new SomeEndPoint(patch, ['obj3']);
        patch.addObject(obj1);
        patch.addObject(obj2);
        patch.addObject(obj3);
        patch.connect(obj1.o(0), obj2.i(0));
        patch.connect(obj2.o(0), obj3.i(0));

        deepEqual(patch._graph.objects, [obj1, obj2, obj3]);
        deepEqual(patch._graph.endPoints, [obj2]);
        deepEqual(patch.getAllConnections(), [
            [obj1.o(0), obj2.i(0)],
            [obj2.o(0), obj3.i(0)]
        ]);

        patch.removeObject(obj3);
        deepEqual(patch._graph.objects, [obj1, obj2, undefined]);
        deepEqual(patch._graph.endPoints, [obj2]);
        deepEqual(patch.getAllConnections(), [[obj1.o(0), obj2.i(0)]]);

        patch.removeObject(obj1);
        deepEqual(patch._graph.objects, [undefined, obj2, undefined]);
        deepEqual(patch._graph.endPoints, [obj2]);
        deepEqual(patch.getAllConnections(), []);
    });

    test('graphiness : getEndPoints', function() {
        patch.addObject(obj1);
        patch.addObject(ep1);
        patch.addObject(ep2);

        ep1.endPointPriority = 10;
        deepEqual(patch.getEndPoints(), [ep1, ep2]);

        ep2.endPointPriority = 100;
        deepEqual(patch.getEndPoints(), [ep2, ep1]);
    });

    test('graphiness : getAllObjects', function() {
        patch.addObject(obj1);
        patch.addObject(obj2);
        deepEqual(patch.getAllObjects(), [obj1, obj2]);
        patch.addObject(table1);
        deepEqual(patch.getAllObjects(), [obj1, obj2, table1]);
    });

    test('graphiness : connect', function() {
        var SomeSource = MyObject.extend({outletTypes: ['outlet~', 'outlet']});
        var SomeSink = MyObject.extend({inletTypes: ['inlet~', 'inlet']});
        var obj1 = new SomeSource(patch, ['obj1']);
        var obj2 = new SomeSink(patch, ['obj2']);
        var obj3 = new SomeSink(patch, ['obj3']);
        var obj4 = new SomeSink(null, ['obj3']);

        // dsp connection
        patch.connect(obj1.o(0), obj2.i(0));
        equal(obj1.o(0).sinks.length, 1);
        equal(obj2.i(0).sources.length, 1);
        equal(obj1.o(0).sinks[0], obj2.i(0));
        equal(obj2.i(0).sources[0], obj1.o(0));

        // connection exists, nothing happens
        patch.connect(obj1.o(0), obj2.i(0));
        equal(obj1.o(0).sinks.length, 1);
        equal(obj2.i(0).sources.length, 1);

        // message connection
        patch.connect(obj1.o(1), obj2.i(1));
        equal(obj1.o(1).sinks.length, 1);
        equal(obj2.i(1).sources.length, 1);
        equal(obj1.o(1).sinks[0], obj2.i(1));
        equal(obj2.i(1).sources[0], obj1.o(1));

        // works also by passing object instances
        patch.connect(obj1.o(1), obj3.i(1));
        equal(obj1.o(1).sinks.length, 2);
        equal(obj3.i(1).sources.length, 1);
        equal(obj1.o(1).sinks[1], obj3.i(1));
        equal(obj3.i(1).sources[0], obj1.o(1));

        // unknown object
        raises(function() { patch.connect(obj4.o(0), obj2.i(0)); });
        equal(obj2.i(0).sources.length, 1);
        equal(obj2.i(0).sources[0], obj1.o(0));

        // disconnections
        patch.disconnect(obj1.o(0), obj2.i(0));
        equal(obj1.o(0).sinks.length, 0); 
        equal(obj2.i(0).sources.length, 0);

        // connection doesn't exists, nothing happens
        patch.disconnect(obj1.o(0), obj2.i(0));
        equal(obj1.o(0).sinks.length, 0); 
        equal(obj2.i(0).sources.length, 0);

        // more disconnections
        patch.disconnect(obj1.o(1), obj2.i(1));
        equal(obj1.o(1).sinks.length, 1);
        equal(obj2.i(1).sources.length, 0);
        patch.disconnect(obj1.o(1), obj3.i(1));
        equal(obj1.o(1).sinks.length, 0);
        equal(obj3.i(1).sources.length, 0);
    });

    test('graphiness : disconnect', function() {
        var SomeSource = MyObject.extend({outletTypes: ['outlet~', 'outlet']});
        var SomeSink = MyObject.extend({inletTypes: ['inlet~', 'inlet']});
        var obj1 = new SomeSource(patch, ['obj1']);
        var obj2 = new SomeSink(patch, ['obj2']);
        var obj3 = new SomeSink(patch, ['obj3']);
        var obj4 = new SomeSink(null, ['obj3']);

        patch.connect(obj1.o(0), obj2.i(0));
        patch.connect(obj1.o(1), obj2.i(1));
        patch.connect(obj1.o(1), obj3.i(1));

        // disconnections
        patch.disconnect(obj1.o(0), obj2.i(0));
        equal(obj1.o(0).sinks.length, 0); 
        equal(obj2.i(0).sources.length, 0);

        // connection doesn't exists, nothing happens
        patch.disconnect(obj1.o(0), obj2.i(0));
        equal(obj1.o(0).sinks.length, 0); 
        equal(obj2.i(0).sources.length, 0);

        // more disconnections
        patch.disconnect(obj1.o(1), obj2.i(1));
        equal(obj1.o(1).sinks.length, 1);
        equal(obj2.i(1).sources.length, 0);
        patch.disconnect(obj1.o(1), obj3.i(1));
        equal(obj1.o(1).sinks.length, 0);
        equal(obj3.i(1).sources.length, 0);
    });

    test('graphiness : getAllConnections', function() {
        var SomeSource = MyObject.extend({outletTypes: ['outlet~', 'outlet']});
        var SomeSink = MyObject.extend({inletTypes: ['inlet~', 'inlet']});
        var obj1 = new SomeSource(patch, ['obj1']);
        var obj2 = new SomeSink(patch, ['obj2']);
        var obj3 = new SomeSink(patch, ['obj3']);
        var obj4 = new SomeSource(patch, ['obj4']);

        patch.connect(obj1.o(0), obj2.i(0));
        deepEqual(patch.getAllConnections(), [[obj1.o(0), obj2.i(0)]]);
        deepEqual(patch.getAllConnections(obj1), [[obj1.o(0), obj2.i(0)]]);

        patch.connect(obj1.o(1), obj2.i(1));
        deepEqual(patch.getAllConnections(), [
            [obj1.o(0), obj2.i(0)],
            [obj1.o(1), obj2.i(1)]
        ]);

        patch.connect(obj1.o(1), obj3.i(1));
        deepEqual(patch.getAllConnections(), [
            [obj1.o(0), obj2.i(0)],
            [obj1.o(1), obj2.i(1)],
            [obj1.o(1), obj3.i(1)]
        ]);

        patch.disconnect(obj1.o(0), obj2.i(0));
        deepEqual(patch.getAllConnections(), [
            [obj1.o(1), obj2.i(1)],
            [obj1.o(1), obj3.i(1)]
        ]);

        patch.connect(obj4.o(0), obj2.i(0));
        deepEqual(patch.getAllConnections(), [
            [obj1.o(1), obj2.i(1)],
            [obj1.o(1), obj3.i(1)],
            [obj4.o(0), obj2.i(0)]
        ]);
        deepEqual(patch.getAllConnections(obj1), [
            [obj1.o(1), obj2.i(1)],
            [obj1.o(1), obj3.i(1)]
        ]);
    });

    test('scheduling : timeout', function() {
        patch.sampleRate = 10;
        patch.blockSize = 4;
        var i;

        // simple timeout
        patch.received = [];
        patch.timeout(1000, function() { this.received.push('bang'); }, patch);
        // timeout started (1000 ms => 10 samples => >= 3 frames (cause blockSize = 4) )
        for (i = 0; i < 3; i++) patch.generateFrame();
        deepEqual(patch.received, []);
        patch.generateFrame();
        deepEqual(patch.received, ['bang']);
        for (i = 0; i < 13; i++) patch.generateFrame();
        deepEqual(patch.received, ['bang']);

        // timeout cleared
        patch.received = [];
        var dummy = patch.timeout(500, function() { }, patch); // Just to test with several timeouts scheduled
        var id = patch.timeout(1000, function() { this.received.push('bang'); }, patch);
        for (1; patch.frame < 2; 1) patch.generateFrame();
        patch.clear(id);
        for (1; patch.frame < 10; 1) patch.generateFrame();
        deepEqual(patch.received, []);
    });

    test('scheduling : interval', function() {
        patch.sampleRate = 10;
        patch.blockSize = 4;

        // simple interval
        patch.received = [];
        var id = patch.interval(1000, function() { this.received.push('bang'); }, patch);
        // interval started (1000 ms => 10 samples => >= 3 frames (cause blockSize = 4) )
        for (1; patch.frame < 3; 1) patch.generateFrame();
        deepEqual(patch.received, []);
        patch.generateFrame();
        deepEqual(patch.received, ['bang']);
        for (1; patch.frame < 5; 1) patch.generateFrame();
        deepEqual(patch.received, ['bang']);
        patch.generateFrame();
        deepEqual(patch.received, ['bang', 'bang']);
        for (1; patch.frame <= 8; 1) patch.generateFrame();
        deepEqual(patch.received, ['bang', 'bang', 'bang']);

        // simple interval
        patch.received = [];
        patch.clear(id);
        for (1; patch.frame < 31; 1) patch.generateFrame();
        deepEqual(patch.received, []);
    });

    test('millisToSamp / sampToMillis', function() {
        patch.sampleRate = 44100;
        equal(patch.millisToSamp(1000), 44100);
        equal(patch.millisToSamp(1500), 66150);
        equal(patch.sampToMillis(66150), 1500);
        equal(patch.sampToMillis(22050), 500);
    });

});
