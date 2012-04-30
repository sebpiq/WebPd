$(document).ready(function() {

    var MyObject = Pd.Object.extend({
        init: function(objName) {
            this.objName = objName;
        }
    });
    var MyEndPointObject = MyObject.extend({
        endPoint: true
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
        }
    });

    test('graphiness : addObject / getObject', function() {

        // Add an object
        patch.addObject(obj1);
        var ind1 = obj1.id;
        ok(ind1 != undefined);
        deepEqual(patch.getObject(ind1), obj1);

        // Add same object
        patch.addObject(obj1);
        equal(ind1, obj1.id);

        // Add second object
        patch.addObject(obj2);
        var ind2 = obj2.id;
        ok(ind2 != undefined);
        ok(ind2 != ind1);
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

    test('graphiness : addTable / getObject', function() {

        patch.addTable(table1);
        var ind1 = table1.id;
        ok(ind1 != undefined);
        deepEqual(patch.getObject(ind1), table1);

        patch.addTable(table2);
        var ind2 = table2.id;
        ok(ind2 != undefined);
        ok(ind2 != ind1);
        equal(patch.getObject(ind1), table1);
        equal(patch.getObject(ind2), table2);
    });

    test('graphiness : addTable / getTableByName', function() {

        patch.addTable(table1);
        var ind = table1.id;
        ok(ind != undefined);
        equal(patch.getTableByName('table1'), table1);
        equal(patch.getTableByName('unknown name'), null);
    });

    test('graphiness : mapObjects', function() {
        patch.addObject(obj1);
        patch.addObject(obj2);

        patch.mapObjects(function(obj) {
            obj.checked = true;
        });

        deepEqual([obj1.objName, obj1.checked], ['obj1', true]);
        deepEqual([obj2.objName, obj2.checked], ['obj2', true]);
        deepEqual([obj3.objName, obj3.checked], ['obj3', undefined]);
    });

    test('graphiness : mapEndPoints', function() {
        patch.addObject(obj1);
        patch.addObject(ep1);
        patch.addObject(ep2);

        patch.mapEndPoints(function(obj) {
            obj.checked = true;
        });

        deepEqual([obj1.objName, obj1.checked], ['obj1', undefined]);
        deepEqual([ep1.objName, ep1.checked], ['ep1', true]);
        deepEqual([ep2.objName, ep2.checked], ['ep2', true]);
    });

    test('graphiness : getAllObjects', function() {
        patch.addObject(obj1);
        patch.addObject(obj2);
        deepEqual(patch.getAllObjects(), [obj1, obj2]);
        patch.addTable(table1);
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

});
