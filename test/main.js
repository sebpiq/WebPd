$(document).ready(function() {

    module('Pd\'s global functionalities');

    test('messageTokenizer', function() {

		deepEqual(Pd.messagetokenizer('234'), [['234']]);
        deepEqual(Pd.messagetokenizer('hello'), [['hello']]);
        deepEqual(Pd.messagetokenizer('234;'), [['234']]);
        deepEqual(Pd.messagetokenizer('hello;'), [['hello']]);
        deepEqual(Pd.messagetokenizer('234; '), [['234']]);
        deepEqual(Pd.messagetokenizer('2432, hello bing bong, 234; pants!'),
            [['2432', 'hello bing bong', '234'], ['pants!']]);
        deepEqual(Pd.messagetokenizer('2432, hello bing bong, 234; ffieo fwemio wmfo, wfmeiomio; fmieowmio'),
            [['2432', 'hello bing bong', '234'], ['ffieo fwemio wmfo', 'wfmeiomio'], ['fmieowmio']]);
        deepEqual(Pd.messagetokenizer('2432\\, hello bing bong\\, 234\\; ffieo fwemio wmfo\\, wfmeiomio\\; fmieowmio'),
            [['2432', 'hello bing bong', '234'], ['ffieo fwemio wmfo', 'wfmeiomio'], ['fmieowmio']]);

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

        var B = A.extend({
            'bla': 113, 'bli': 654,
        });
        var b = new B();

        // instanceof
        ok(b instanceof B);
        ok(b instanceof A);
        // inheritance of props
        equal(b.bla, 113);
        equal(b.bli, 654);
        equal(b.blo, 456);

        var C = B.extend({
            'bla': 112,
        });
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
        var blaCallback = function() {
            this.bla = counter;
            counter ++;
        };

        // Test .on
        testObject.on('bla', blaCallback, context);
        testObject.trigger('bla');
        equal(context.bla, 1);
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

        // Test removing .one with .off
        testObject.one('bla', blaCallback, context);
        testObject.off('bla', blaCallback);
        equal(context.bla, 3);
        testObject.trigger('bla');
        equal(context.bla, 3);
    });

});
