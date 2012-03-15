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

});
