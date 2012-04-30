$(document).ready(function() {

    module('Pd.compat');

    test('parse : simple loadbang into print', function() {
        var patchStr = '#N canvas 778 17 450 300 10;\n'
            + '#X obj 14 13 loadbang;\n'
            + '#X obj 14 34 print;\n'
            + '#X connect 0 0 1 0;\n';
        var patch = Pd.compat.parse(patchStr);

        var loadbang = patch.getObject(0);
        var print = patch.getObject(1);
        ok(loadbang instanceof Pd.objects['loadbang']);
        ok(print instanceof Pd.objects['print']);
        equal(loadbang.o(0).sinks.length, 1);
        equal(print.i(0).sources.length, 1);
        equal(loadbang.o(0).sinks[0], print.i(0));
        equal(print.i(0).sources[0], loadbang.o(0));
    });

    test('toArray', function() {
        var parts;
        parts = Pd.compat.toArray('bla 1 2 3');
        deepEqual(parts, ['bla', '1', '2', '3']);

        parts = Pd.compat.toArray('bla');
        deepEqual(parts, ['bla']);

        parts = Pd.compat.toArray(1);
        deepEqual(parts, [1]);

        parts = Pd.compat.toArray([1, 2, 3, 'quatre']);
        deepEqual(parts, [1, 2, 3, 'quatre']);
    });

    test('toFloat', function() {
        var f;
        f = Pd.compat.toFloat('789.9');
        strictEqual(f, 789.9);

        f = Pd.compat.toFloat('0');
        strictEqual(f, 0);

        f = Pd.compat.toFloat('0.');
        strictEqual(f, 0);
    });

});
