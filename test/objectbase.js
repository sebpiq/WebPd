$(document).ready(function() {

    var obj;

    module('Pd.Object', {
        setup: function() {
            obj = new Pd.Object();
        }
    });

    test('toArray', function() {
        var parts;
        parts = obj.toArray('bla 1 2 3');
        deepEqual(parts, ['bla', '1', '2', '3']);

        parts = obj.toArray('bla');
        deepEqual(parts, ['bla']);

        parts = obj.toArray(1);
        deepEqual(parts, [1]);

        parts = obj.toArray([1, 2, 3, 'quatre']);
        deepEqual(parts, [1, 2, 3, 'quatre']);
    });

    test('toFloat', function() {
        var f;
        f = obj.toFloat('789.9');
        strictEqual(f, 789.9);

        f = obj.toFloat('0');
        strictEqual(f, 0);

        f = obj.toFloat('0.');
        strictEqual(f, 0);
    });

});
