$(document).ready(function() {

// some test utilities

    // turns an array or Float32 into an array
    var toArray = function(arrayish) {
        var array = [];
        for (var i=0; i<arrayish.length; i++) array[i] = arrayish[i];
        return array;
    };

    // round a number to a given number of decimal places
    var round = function(num, dec) {
        dec = dec || 4;
        var f = Math.pow(10, dec);
        return Math.round(num * f) / f;
    }

    // apply round to all elements of an array
    var roundArray = function(array, dec) {
        var roundedArray = [];
        for (var i=0; i<array.length; i++) roundedArray[i] = round(array[i], dec);
        return roundedArray;
    };

    // declaring special inlets and outlets for testing
    Pd['testinlet~'] = Pd['inlet~'].extend({
        getBuffer: function() {
            return this.testBuffer;
        },
        hasDspSources: function() {
            return this.testBuffer != undefined;
        }
    });
    Pd['testinlet'] = Pd['inlet'];
    Pd['testoutlet~'] = Pd['outlet~'];
    Pd['testoutlet'] = Pd['outlet'];

    // replacing in all object prototypes, with our test inlets/outlets
    for (type in Pd.objects) {
        if ('prototype' in Pd.objects[type]) {
            var proto = Pd.objects[type].prototype;
            var outletTypes = proto.outletTypes;
            var inletTypes = proto.inletTypes;
            for (var i=0; i<outletTypes.length; i++) {
                outletTypes[i] = 'test' + outletTypes[i];
            }
            for (var i=0; i<inletTypes.length; i++) {
                inletTypes[i] = 'test' + inletTypes[i];
            }
        }
    }

    module('Pd.objects', {
        setup: function() {
            Pd.blockSize = 4;
        }
    });

    test('osc~', function() {
        var cos = Math.cos;
        // no frequency (=0)
        var osc = new Pd.objects['osc~'](null);
        var buffer = osc.outlets[0].buffer;

        deepEqual(toArray(buffer), [0, 0, 0, 0]);
        osc.dsptick();
        deepEqual(toArray(buffer), [1, 1, 1, 1]);        

        // frequency argument 
        var osc = new Pd.objects['osc~'](null, [440]);
        var k = 2*Math.PI*440/Pd.sampleRate
        var buffer = osc.outlets[0].buffer;

        deepEqual(toArray(buffer), [0, 0, 0, 0]);
        osc.dsptick();
        deepEqual(roundArray(buffer, 4), roundArray([cos(k*0), cos(k*1), cos(k*2), cos(k*3)], 4));
        osc.dsptick();
        deepEqual(roundArray(buffer, 4), roundArray([cos(k*4), cos(k*5), cos(k*6), cos(k*7)], 4));

        // receive frequency message
        var k2 = 2*Math.PI*660/Pd.sampleRate;

        osc.inlets[0].message('660');
        deepEqual(roundArray(buffer, 4), roundArray([cos(k*4), cos(k*5), cos(k*6), cos(k*7)], 4));
        osc.dsptick();
        deepEqual(roundArray(buffer, 4), roundArray([cos(k2*8), cos(k2*9), cos(k2*10), cos(k2*11)], 4));

        // receive frequency signal
        var m = 2*Math.PI/Pd.sampleRate;
        var inBuff = [];
        osc.inlets[0].testBuffer = inBuff;

        inBuff[0] = 770; inBuff[1] = 550; inBuff[2] = 330; inBuff[3] = 110;
        osc.dsptick();
        deepEqual(roundArray(buffer, 4), roundArray([cos(m*770*12), cos(m*550*13), cos(m*330*14), cos(m*110*15)], 4));
        inBuff[0] = 880; inBuff[1] = 440; inBuff.pop(); inBuff.pop();
        osc.dsptick();
        deepEqual(roundArray(buffer, 4), roundArray([cos(m*880*16), cos(m*440*17), cos(m*880*18), cos(m*440*19)], 4));
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
