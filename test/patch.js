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

        patch.addObject(obj1);
        var ind1 = obj1.id;
        ok(ind1 != undefined);
        deepEqual(patch.getObject(ind1), obj1);

        patch.addObject(obj2);
        var ind2 = obj2.id;
        ok(ind2 != undefined);
        ok(ind2 != ind1);
        equal(patch.getObject(ind1), obj1);
        equal(patch.getObject(ind2), obj2);

        equal(patch.getObject(8888009098080879), null);
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

    test('graphiness : connect/disconnect', function() {
        var SomeSource = MyObject.extend({outletTypes: ['outlet~', 'outlet']});
        var SomeSink = MyObject.extend({inletTypes: ['inlet~', 'inlet']});
        var obj1 = new SomeSource(patch, ['obj1']);
        var obj2 = new SomeSink(patch, ['obj2']);
        var obj3 = new SomeSink(patch, ['obj3']);
        var ind1 = obj1.id;
        var ind2 = obj2.id;
        var unknownInd = 781863726392839;

        // dsp connection
        patch.connect(ind1, 0, ind2, 0);
        equal(obj1.outlets[0].sinks.length, 1);
        equal(obj2.inlets[0].sources.length, 1);
        equal(obj1.outlets[0].sinks[0], obj2.inlets[0]);
        equal(obj2.inlets[0].sources[0], obj1.outlets[0]);

        // connection exists, nothing happens
        patch.connect(ind1, 0, ind2, 0);
        equal(obj1.outlets[0].sinks.length, 1);
        equal(obj2.inlets[0].sources.length, 1);

        // message connection
        patch.connect(ind1, 1, ind2, 1);
        equal(obj1.outlets[1].sinks.length, 1);
        equal(obj2.inlets[1].sources.length, 1);
        equal(obj1.outlets[1].sinks[0], obj2.inlets[1]);
        equal(obj2.inlets[1].sources[0], obj1.outlets[1]);

        // works also by passing object instances
        patch.connect(obj1, 1, obj3, 1);
        equal(obj1.outlets[1].sinks.length, 2);
        equal(obj3.inlets[1].sources.length, 1);
        equal(obj1.outlets[1].sinks[1], obj3.inlets[1]);
        equal(obj3.inlets[1].sources[0], obj1.outlets[1]);

        // unknown object
        raises(function() { patch.connect(unknownInd, 0, ind2, 0); });
        equal(obj2.inlets[0].sources.length, 1);
        equal(obj2.inlets[0].sources[0], obj1.outlets[0]);

        // disconnections
        patch.disconnect(ind1, 0, ind2, 0);
        equal(obj1.outlets[0].sinks.length, 0); 
        equal(obj2.inlets[0].sources.length, 0);

        // connection doesn't exists, nothing happens
        patch.disconnect(ind1, 0, ind2, 0);
        equal(obj1.outlets[0].sinks.length, 0); 
        equal(obj2.inlets[0].sources.length, 0);

        // more disconnections
        patch.disconnect(ind1, 1, ind2, 1);
        equal(obj1.outlets[1].sinks.length, 1);
        equal(obj2.inlets[1].sources.length, 0);
        patch.disconnect(obj1, 1, obj3, 1);
        equal(obj1.outlets[1].sinks.length, 0);
        equal(obj3.inlets[1].sources.length, 0);
    });

});
