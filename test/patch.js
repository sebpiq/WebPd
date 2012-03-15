$(document).ready(function() {

    var patch;

    module('Pd.Patch', {
        setup: function() {
            patch = new Pd.Patch();
        }
    });

    test('graphiness : addObject / getObject', function() {
        var obj1 = {'obj1': 1};
        var obj2 = {'obj2': 2};

        var ind = patch.addObject(obj1);
        ok(ind != undefined);
        deepEqual(patch.getObject(ind), obj1);

        var ind = patch.addObject(obj2);
        ok(ind != undefined);
        deepEqual(patch.getObject(ind), obj2);
        deepEqual(patch.getObject(ind), obj2);

        equal(patch.getObject(8888009098080879), null);
    });

    test('graphiness : addTable / getObject', function() {
        var table1 = {'name': 'table1'};
        var table2 = {'name': 'table2'};

        var ind = patch.addTable(table1);
        ok(ind != undefined);
        deepEqual(patch.getObject(ind), table1);

        var ind = patch.addTable(table2);
        ok(ind != undefined);
        deepEqual(patch.getObject(ind), table2);
    });

    test('graphiness : addTable / getTableByName', function() {
        var table1 = {'name': 'table1'};

        var ind = patch.addTable(table1);
        ok(ind != undefined);
        deepEqual(patch.getTableByName('table1'), table1);
    });

    test('graphiness : mapObjects', function() {
        var obj1 = {'obj1': 1};
        var obj2 = {'obj2': 2};
        var obj3 = {'obj3': 3};
        patch.addObject(obj1);
        patch.addObject(obj2);

        patch.mapObjects(function(obj) {
            obj.checked = true
        });

        deepEqual([obj1['obj1'], obj1['checked']], [1, true]);
        deepEqual([obj2['obj2'], obj2['checked']], [2, true]);
        deepEqual([obj3['obj3'], obj3['checked']], [3, undefined]);
    });

    test('graphiness : mapEndPoints', function() {
        var obj1 = {'obj1': 1};
        var obj2 = {'obj2': 2, 'endpoint': true};
        var obj3 = {'obj3': 3, 'endpoint': true};
        patch.addObject(obj1);
        patch.addObject(obj2);
        patch.addObject(obj3);

        patch.mapEndPoints(function(obj) {
            obj.checked = true
        });

        deepEqual([obj1['obj1'], obj1['checked']], [1, undefined]);
        deepEqual([obj2['obj2'], obj2['checked']], [2, true]);
        deepEqual([obj3['obj3'], obj2['checked']], [3, true]);
    });

    test('graphiness : connect/getConnections', function() {
        var obj1 = {'obj1': 1, outletTypes: ['dsp', 'message'], inlets: [], outlets: []};
        var obj2 = {'obj2': 2, outletTypes: [], inlets: [], outlets: []};
        var ind1 = patch.addObject(obj1);
        var ind2 = patch.addObject(obj2);
        var unknownInd = 781863726392839;

        patch.connect(ind1, 0, ind2, 0);
        deepEqual(obj2.inlets, [[obj1, 0]]);
        deepEqual(patch.getConnections(ind1, ind2), [[ind1, 0, ind2, 0]]);
        deepEqual(patch.getConnections(undefined, ind2), [[ind1, 0, ind2, 0]]);
        deepEqual(patch.getConnections(ind1), [[ind1, 0, ind2, 0]]);
        deepEqual(patch.getConnections(ind2, ind1), []);

        patch.connect(ind1, 1, ind2, 1);
        deepEqual(obj1.outlets, [undefined, [obj2, 1]]);
        deepEqual(patch.getConnections(ind1, ind2), [[ind1, 0, ind2, 0], [ind1, 1, ind2, 1]]);

        patch.connect(unknownInd, 0, ind2, 0);
        deepEqual(obj2.inlets, [[obj1, 0]]);
        deepEqual(obj1.outlets, [undefined, [obj2, 1]]);
        deepEqual(patch.getConnections(ind1, ind2), [[ind1, 0, ind2, 0], [ind1, 1, ind2, 1]]);
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
