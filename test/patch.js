$(document).ready(function() {

    var MyObject = Pd.Object.extend({
        preinit: function(objName) {
            this.objName = objName;
        }
    });
    var MyEndPointObject = MyObject.extend({
        endpoint: true,
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
        var ind1 = obj1.getId();
        ok(ind1 != undefined);
        deepEqual(patch.getObject(ind1), obj1);

        patch.addObject(obj2);
        var ind2 = obj2.getId();
        ok(ind2 != undefined);
        ok(ind2 != ind1);
        deepEqual(patch.getObject(ind1), obj1);
        deepEqual(patch.getObject(ind2), obj2);

        equal(patch.getObject(8888009098080879), null);
    });

    test('graphiness : addTable / getObject', function() {

        patch.addTable(table1);
        var ind1 = table1.getId();
        ok(ind1 != undefined);
        deepEqual(patch.getObject(ind1), table1);

        patch.addTable(table2);
        var ind2 = table2.getId();
        ok(ind2 != undefined);
        ok(ind2 != ind1);
        deepEqual(patch.getObject(ind1), table1);
        deepEqual(patch.getObject(ind2), table2);
    });

    test('graphiness : addTable / getTableByName', function() {

        patch.addTable(table1);
        var ind = table1.getId();
        ok(ind != undefined);
        deepEqual(patch.getTableByName('table1'), table1);
    });

    test('graphiness : mapObjects', function() {
        patch.addObject(obj1);
        patch.addObject(obj2);

        patch.mapObjects(function(obj) {
            obj.checked = true
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
            obj.checked = true
        });

        deepEqual([obj1.objName, obj1.checked], ['obj1', undefined]);
        deepEqual([ep1.objName, ep1.checked], ['ep1', true]);
        deepEqual([ep2.objName, ep2.checked], ['ep2', true]);
    });

    test('graphiness : connect', function() {
        var SomeSource = MyObject.extend({outletTypes: ['outlet~', 'outlet']});
        var SomeSink = MyObject.extend({inletTypes: ['inlet~', 'inlet']});
        var obj1 = new SomeSource(patch, ['obj1']);
        var obj2 = new SomeSink(patch, ['obj2']);
        var ind1 = obj1.getId();
        var ind2 = obj2.getId();
        var unknownInd = 781863726392839;

        patch.connect(ind1, 0, ind2, 0);
        equal(obj1.outlets[0].sinks.length, 1);
        equal(obj2.inlets[0].sources.length, 1);
        equal(obj1.outlets[0].sinks[0], obj2.inlets[0]);
        equal(obj2.inlets[0].sources[0], obj1.outlets[0]);

        patch.connect(ind1, 1, ind2, 1);
        equal(obj1.outlets[1].sinks.length, 1);
        equal(obj2.inlets[1].sources.length, 1);
        equal(obj1.outlets[1].sinks[0], obj2.inlets[1]);
        equal(obj2.inlets[1].sources[0], obj1.outlets[1]);

        // unknown object, nothing happens
        patch.connect(unknownInd, 0, ind2, 0);
        equal(obj2.inlets[0].sources.length, 1);
        equal(obj2.inlets[0].sources[0], obj1.outlets[0]);
    });

    test('parse : simple loadbang into print', function() {
        var patchStr = '#N canvas 778 17 450 300 10;\n'
            + '#X obj 14 13 loadbang;\n'
            + '#X obj 14 34 print;\n'
            + '#X connect 0 0 1 0;\n';
        Pd.parse(patchStr, patch);

        var loadbang = patch.getObject(0);
        var print = patch.getObject(1);
        ok(loadbang instanceof Pd.objects['loadbang']);
        ok(print instanceof Pd.objects['print']);
        equal(loadbang.outlets[0].sinks.length, 1);
        equal(print.inlets[0].sources.length, 1);
        equal(loadbang.outlets[0].sinks[0], print.inlets[0]);
        equal(print.inlets[0].sources[0], loadbang.outlets[0]);
    });

});
