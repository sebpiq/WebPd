$(document).ready(function() {

    module('Pd.objects');

    // TODO: find a way of testing those ...

    test('osc~', function() {
        expect(0);
        var osc = new Pd.objects['osc~'](null);
        var osc440 = new Pd.objects['osc~'](null, [440]);
    });

    test('loadbang', function() {
        expect(0);
        var loadbang = new Pd.objects['loadbang'](null);
    });

    test('print', function() {
        expect(0);
        var print = new Pd.objects['print'](null);
        var printBla = new Pd.objects['print'](null, ['bla']);
    });

});
