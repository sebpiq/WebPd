$(document).ready(function() {

    module('Pd.compat');

    test('parseArg', function() {
        equal(Pd.compat.parseArg('bla'), 'bla');
        equal(Pd.compat.parseArg('\\$15'), '$15');
        equal(Pd.compat.parseArg(1), 1);
        equal(Pd.compat.parseArg(0.7e-2), 0.007);
        equal(Pd.compat.parseArg('1'), 1);
        equal(Pd.compat.parseArg('0.7e-2'), 0.007);
        raises(function() {
            Pd.compat.parseArg([1, 2]);
        });
        raises(function() {
            Pd.compat.parseArg(null);
        });
    });

    test('parseArgs', function() {
        var parts;
        parts = Pd.compat.parseArgs('bla -1    2 3e-1');
        deepEqual(parts, ['bla', -1, 2, 0.3]);

        parts = Pd.compat.parseArgs('bla');
        deepEqual(parts, ['bla']);

        parts = Pd.compat.parseArgs('1.8e2');
        deepEqual(parts, [180]);

        parts = Pd.compat.parseArgs(1);
        deepEqual(parts, [1]);

        parts = Pd.compat.parseArgs([1, '2', 3, 'quatre']);
        deepEqual(parts, [1, 2, 3, 'quatre']);

        raises(function() {
            Pd.compat.parseArgs([1, 2, [], 'quatre']);
        });

        raises(function() {
            Pd.compat.parseArgs(null);
        });
    });

    test('parseFloat', function() {
        strictEqual(Pd.compat.parseFloat('789.9'), 789.9);
        strictEqual(Pd.compat.parseFloat('0'), 0);
        strictEqual(Pd.compat.parseFloat('0.'), 0);
        strictEqual(Pd.compat.parseFloat('-0.9'), -0.9);
        strictEqual(Pd.compat.parseFloat('-4e-2'), -0.04);
        strictEqual(Pd.compat.parseFloat('0.558e2'), 55.8);
        ok(isNaN(Pd.compat.parseFloat('bla')));
        ok(isNaN(Pd.compat.parseFloat([1])));
    });

    test('parse : objects + connections', function() {
        var patchStr = '#N canvas 778 17 450 300 10;\n' +
            '#X obj 14 13 loadbang;\n' +
            '#X obj 14 34 print bla;\n' +
            '#X connect 0 0 1 0;';
        var patch = Pd.compat.parse(patchStr);
        var loadbang = patch.getObject(0);
        var print = patch.getObject(1);

        ok(loadbang instanceof Pd.objects['loadbang']);
        ok(print instanceof Pd.objects['print']);
        equal(print.printName, 'bla');

        equal(loadbang.o(0).sinks.length, 1);
        equal(print.i(0).sources.length, 1);

        var inlet1 = loadbang.o(0).sinks[0],
            inlet2 = print.i(0);
        deepEqual([inlet1.id, inlet1.obj.id], [inlet2.id, inlet2.obj.id]);

        var outlet1 = print.i(0).sources[0],
            outlet2 = loadbang.o(0);
        deepEqual([outlet1.id, outlet1.obj.id], [outlet2.id, outlet2.obj.id]);
    });

    test('parse : table', function() {
        var patchStr = '#N canvas 667 72 551 408 10;\n' +
            '#N canvas 0 0 450 300 (subpatch) 0;\n' +
            '#X array myTable 35 float 3;\n' +
            '#A 0 0.1 0.2 0.3 0.4 0.5\n' +
            '0.6 0.7 0.8 0.9 1\n' +
            ';\n' +
            '#A 10 1.1 1.2 1.3 1.4 1.5\n' +
            '1.6 1.7\n' +
            '1.8 1.9 2.0;\n' +
            '#A 20 2.1 2.2 2.3 2.4 2.5\n' +
            '2.6 2.7;\n' +
            '#A 27 2.8 2.9 3.0;\n' +
            '#X coords 0 1 14818 -1 200 140 1;\n' +
            '#X restore 157 26 graph;\n' +
            '#X obj 19 370 osc~ 440;';
        var patch = Pd.compat.parse(patchStr);
        var table = patch.getObject(0);
        var sameTable = patch.getTableByName('myTable');
        var osc = patch.getObject(1);

        ok(table instanceof Pd.objects['table']);
        ok(sameTable === table);
        equal(table.name, 'myTable');
        equal(table.size, 35);
        deepEqual(roundArray(table.data, 1), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
            1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.2, 2.3, 2.4,
            2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 0, 0, 0, 0, 0]);
        ok(osc instanceof Pd.objects['osc~']);
        equal(osc.freq, 440);
    });

});
