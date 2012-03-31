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

});
