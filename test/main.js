$(document).ready(function() {

    module('Pd\'s global functionalities');

    test('makeMsgFilter', function() {
        var filter = Pd.makeMsgFilter([1]);
        deepEqual(filter([2, 'bla', 4]), [1]);
        var filter = Pd.makeMsgFilter([1, '$1', 'bla', '$3']);
        deepEqual(filter(['bli', 'bla', 4, 5]), [1, 'bli', 'bla', 4]);
    });

    test('fillWithZeros', function() {
        var array = [];

        Pd.fillWithZeros(array);
        deepEqual(array, []);
        
        array = [1, 2, 3, 4];
        Pd.fillWithZeros(array);
        deepEqual(array, [0, 0, 0, 0]);

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
        A.prototype.func = function() {return 'blabla'};

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

    test('EventsBase', function() {
        var TestEvent = function() {
            this.initEvents();
        };
        Pd.extend(TestEvent.prototype, Pd.EventsBase);
        var testObject = new TestEvent();
        var context = {};        

        var counter = 1;
        var blaCallback = function(arg1, arg2) {
            this.args = [arg1, arg2];
            this.bla = counter;
            counter ++;
        };

        // Test .on
        testObject.on('bla', blaCallback, context);
        testObject.trigger('bla', 12, 34);
        equal(context.bla, 1);
        deepEqual(context.args, [12, 34]);
        testObject.trigger('bla');
        equal(context.bla, 2);

        // Test .off
        testObject.off('bla', blaCallback);
        testObject.trigger('bla');
        equal(context.bla, 2);

        // Test .one
        testObject.one('bla', blaCallback, context);
        equal(context.bla, 2);
        testObject.trigger('bla');
        equal(context.bla, 3);
        testObject.trigger('bla');
        equal(context.bla, 3);

        // Test removing .one with .off, passing (event, callback)
        testObject.one('bla', blaCallback, context);
        testObject.off('bla', blaCallback);
        equal(context.bla, 3);
        testObject.trigger('bla');
        equal(context.bla, 3);

        // Test removing .one with .off, passing id
        var id = testObject.one('bla', blaCallback, context);
        testObject.off(id);
        equal(context.bla, 3);
        testObject.trigger('bla');
        equal(context.bla, 3);
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
