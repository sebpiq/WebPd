$(document).ready(function() {

/******************** some test utilities ************************/

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

/******************** tests ************************/

    module('Pd.objects', {
        setup: function() {
            Pd.blockSize = 4;
            this.sampleRate = Pd.sampleRate;
        },
        teardown: function() {
            Pd.sampleRate = this.sampleRate;
        }
    });

    test('osc~', function() {
        var cos = Math.cos;
        var dummyPatch = {
            getSampleRate: function() {return Pd.sampleRate;}
        };
        // no frequency (=0)
        var osc = new Pd.objects['osc~'](null);
        osc._setPatch(dummyPatch);
        var outBuff = osc.outlets[0].getBuffer();

        deepEqual(toArray(outBuff), [0, 0, 0, 0]);
        osc.dspTick();
        deepEqual(toArray(outBuff), [1, 1, 1, 1]);        

        // frequency argument 
        var osc = new Pd.objects['osc~'](null, [440]);
        osc._setPatch(dummyPatch);
        var k = 2*Math.PI*440/Pd.sampleRate
        var outBuff = osc.outlets[0].getBuffer();

        deepEqual(toArray(outBuff), [0, 0, 0, 0]);
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray([cos(k*0), cos(k*1), cos(k*2), cos(k*3)], 4));
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray([cos(k*4), cos(k*5), cos(k*6), cos(k*7)], 4));

        // receive frequency message
        var k2 = 2*Math.PI*660/Pd.sampleRate;

        osc.inlets[0].message('660');
        deepEqual(roundArray(outBuff, 4), roundArray([cos(k*4), cos(k*5), cos(k*6), cos(k*7)], 4));
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray([cos(k2*8), cos(k2*9), cos(k2*10), cos(k2*11)], 4));

        // receive frequency signal
        var m = 2*Math.PI/Pd.sampleRate;
        var inlet0 = osc.inlets[0];

        inlet0.testBuffer = [770, 550, 330, 110];
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray([cos(m*770*12), cos(m*550*13), cos(m*330*14), cos(m*110*15)], 4));
        inlet0.testBuffer = [880, 440, 880, 440];
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray([cos(m*880*16), cos(m*440*17), cos(m*880*18), cos(m*440*19)], 4));

        // reset phase
        var k2 = 2*Math.PI*440/Pd.sampleRate;
        inlet0.testBuffer = null;

        osc.inlets[0].message('440');
        osc.inlets[1].message('bang');
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray([cos(k*0), cos(k*1), cos(k*2), cos(k*3)], 4));
    });

    test('tabread~', function() {
        var patch = new Pd.Patch();
        var tabread = new Pd.objects['tabread~'](patch, ['table1']);
        var table1 = new Pd.objects['table'](patch, ['table1', 10]);
        var table2 = new Pd.objects['table'](patch, ['table2', 10]);
        tabread.load();
        
        // setting tabread's table
        equal(tabread.table, table1);
        tabread.setTableName('table2');
        equal(tabread.table, table2);
        raises(function() { tabread.setTableName('unknown table'); });
        equal(tabread.table, table2);
        tabread.message(0, 'set table1');
        equal(tabread.table, table1);

        table1.data = [11, 22, 33, 44, 55, 66, 77, 88, 99, 100];
        var inlet0 = tabread.inlets[0];
        var outBuff = tabread.outlets[0].getBuffer();
        // normal read
        inlet0.testBuffer = [0, 1, 2, 3];
        tabread.dspTick()
        deepEqual(toArray(outBuff), [11, 22, 33, 44]);
        // read above and below table bounds
        inlet0.testBuffer = [-10, 9, 10, 1];
        tabread.dspTick()
        deepEqual(toArray(outBuff), [11, 100, 100, 22]);
    });

    test('line~', function() {
        var dummyPatch = {
            getSampleRate: function() {return 10;}
        };
        var line = new Pd.objects['line~']();
        line._setPatch(dummyPatch);
        
        var outBuff = line.outlets[0].getBuffer();
        deepEqual(toArray(outBuff), [0, 0, 0, 0]);
        line.dspTick();
        deepEqual(toArray(outBuff), [0, 0, 0, 0]);

        // jump to value
        line.message(0, '1345.99');
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [1345.99, 1345.99, 1345.99, 1345.99]);
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [1345.99, 1345.99, 1345.99, 1345.99]);

        // jump to value
        line.message(0, '1');
        line.message(0, '2 1000'); // line to 2 in 1 millisecond
        console.log(line);
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [1, 1.1, 1.2, 1.3]);
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [1.4, 1.5, 1.6, 1.7]);
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [1.8, 1.9, 2, 2]);
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [2, 2, 2, 2]);
        line.message(0, '1 200');
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [2, 1.5, 1, 1]);
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
