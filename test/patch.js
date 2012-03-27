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

    test('graphiness : connect/getConnections', function() {
        var MyOtherObject = MyObject.extend({outletTypes: ['dsp', 'message']});
        var obj1 = new MyOtherObject(null, ['obj1']);
        var obj2 = new MyObject(null, ['obj2']);
        patch.addObject(obj1);
        patch.addObject(obj2);
        var ind1 = obj1.getId();
        var ind2 = obj2.getId();
        var unknownInd = 781863726392839;

        patch.connect(ind1, 0, ind2, 0);
        deepEqual(obj2.inlets, [[obj1, 0]]);
        deepEqual(patch.getConnections({sourceId: ind1, sinkId: ind2}), [[ind1, 0, ind2, 0]]);
        deepEqual(patch.getConnections({sinkId: ind2}), [[ind1, 0, ind2, 0]]);
        deepEqual(patch.getConnections({sourceId: ind1}), [[ind1, 0, ind2, 0]]);
        deepEqual(patch.getConnections({sourceId: ind2, sinkId: ind1}), []);

        patch.connect(ind1, 1, ind2, 1);
        deepEqual(obj1.outlets, [undefined, [obj2, 1]]);
        deepEqual(patch.getConnections({sourceId: ind1, sinkId: ind2}), [[ind1, 0, ind2, 0], [ind1, 1, ind2, 1]]);

        patch.connect(unknownInd, 0, ind2, 0);
        deepEqual(obj2.inlets, [[obj1, 0]]);
        deepEqual(obj1.outlets, [undefined, [obj2, 1]]);
        deepEqual(patch.getConnections({sourceId: ind1, sinkId: ind2}), [[ind1, 0, ind2, 0], [ind1, 1, ind2, 1]]);
    });

    test('parse : simple loadbang into print', function() {
        var patchStr = '#N canvas 778 17 450 300 10;\n'
            + '#X obj 14 13 loadbang;\n'
            + '#X obj 14 34 print;\n'
            + '#X connect 0 0 1 0;\n';
        Pd.parse(patchStr, patch);

        deepEqual(patch.getConnections(), [[0, 0, 1, 0]])
        equal(patch.getObject(0).type, 'loadbang');
        equal(patch.getObject(1).type, 'print');
    });

});
