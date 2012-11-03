$(document).ready(function() {

    module('Pd\'s global functionalities');

    test('fillWithZeros', function() {
        var array = [];

        Pd.fillWithZeros(array);
        deepEqual(array, []);
        
        array = [1, 2, 3, 4];
        Pd.fillWithZeros(array);
        deepEqual(array, [0, 0, 0, 0]);

        array = [1, 2, 3, 4];
        Pd.fillWithZeros(array, 2);
        deepEqual(array, [1, 2, 0, 0]);
    });

    test('newBuffer', function() {
        Pd.blockSize = 10;
        var monoBuffer = Pd.newBuffer();
        equal(monoBuffer.length, 10);

        var stereoBuffer = Pd.newBuffer(2);
        equal(stereoBuffer.length, 20);

        var noBuffer = Pd.newBuffer(0);
        equal(noBuffer.length, 0);
    });

    test('chainExtend', function() {
        A = function() {};
        A.extend = Pd.chainExtend;
        A.prototype.blo = 456;
        A.prototype.bli = 987;
        A.prototype.func = function() { return 'blabla'; };

        var B = A.extend({'bla': 113, 'bli': 654});
        var b = new B();

        // instanceof
        ok(b instanceof B);
        ok(b instanceof A);

        // inheritance of props
        equal(b.bla, 113);
        equal(b.bli, 654);
        equal(b.blo, 456);

        var C = B.extend({'bla': 112});
        var c = new C();

        equal(c.bla, 112);
        equal(c.bli, 654);
        equal(c.blo, 456);
    });

    test('UniqueIdsBase', function() {
        var TestUniqueIds1 = function() {};
        Pd.extend(TestUniqueIds1.prototype, EventEmitter.prototype, Pd.UniqueIdsBase);
        var testObject1 = new TestUniqueIds1();

        var TestUniqueIds2 = function() {};
        Pd.extend(TestUniqueIds2.prototype, EventEmitter.prototype, Pd.UniqueIdsBase);
        var testObject2 = new TestUniqueIds2();

        // 2 different prototypes have distinct id spaces.
        var id1 = testObject1._generateId(),
            id2 = testObject2._generateId();
        equal(id1, id2);
    });

    test('makeMsgTransfer', function() {
        var filter = Pd.makeMsgTransfer([1]);
        deepEqual(filter([2, 'bla', 4]), [1]);
        filter = Pd.makeMsgTransfer([1, '$1-bla-$3', 'bla', '$3']);
        deepEqual(filter(['bli', 'bla', 4, 5]), [1, 'bli-bla-4', 'bla', 4]);
        deepEqual(filter([7, 'bloop', 'ploo', 5]), [1, '7-bla-ploo', 'bla', 'ploo']);
    });

    test('resolveArgs', function() {
        var dummyPatch = {id: 9888}, resolved;
        resolved = Pd.resolveArgs(['bla', 'bang', 'b', 'f', 'l', 'a', 's'], null);
        deepEqual(resolved, ['bla', 'bang', 'bang', 'float', 'list', 'anything', 'symbol']);
        resolved = Pd.resolveArgs([123, 'b', '$0-BLA', 'list'], dummyPatch);
        deepEqual(resolved, [123, 'bang', '9888-BLA', 'list']);
        raises(function() {
            Pd.resolveArgs(['$0'], null);
        });
    });

    test('isArray', function() {
        ok(Pd.isArray([]));
        ok(Pd.isArray([1, 'a']));
        ok(Pd.isArray((new Array())));
        ok(!Pd.isArray(1));
        ok(!Pd.isArray('iop'));
        ok(!Pd.isArray({}));
    });

    test('isNumber', function() {
        ok(Pd.isNumber(1));
        ok(Pd.isNumber(1.2));
        ok(!Pd.isNumber([]));
        ok(!Pd.isNumber('iop'));
        ok(!Pd.isNumber(NaN));
    });

    test('isString', function() {
        ok(Pd.isString('rt12'));
        ok(Pd.isString(''));
        ok(!Pd.isString([]));
        ok(!Pd.isString(12));
    });

});
