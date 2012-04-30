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
    Pd['testoutlet'] = Pd['outlet'].extend({
        message: function(msg) {this.receivedMessage = msg;}
    });

    // replacing in all object prototypes, with our test inlets/outlets
    for (type in Pd.objects) {
        if ('prototype' in Pd.objects[type]) {
            var proto = Pd.objects[type].prototype;
            var outletTypes = proto.outletTypes;
            var inletTypes = proto.inletTypes;
            for (var i=0; i<outletTypes.length; i++) {
                if (outletTypes[i].indexOf('test') == -1) {
                    outletTypes[i] = 'test' + outletTypes[i];
                }
            }
            for (var i=0; i<inletTypes.length; i++) {
                if (inletTypes[i].indexOf('test') == -1) {
                    inletTypes[i] = 'test' + inletTypes[i];
                }
            }
        }
    }

/******************** tests dsp objects ************************/

    module('Pd.objects - dsp', {
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
            sampleRate: Pd.sampleRate
        };
        // no frequency (=0)
        var osc = new Pd.objects['osc~'](null);
        osc.patch = dummyPatch;
        osc.load();
        var outBuff = osc.o(0).getBuffer();
        var expected = [];

        deepEqual(toArray(outBuff), [0, 0, 0, 0]);
        osc.dspTick();
        deepEqual(toArray(outBuff), [1, 1, 1, 1]);        

        // frequency argument 
        var osc = new Pd.objects['osc~'](null, [440]);
        osc.patch = dummyPatch;
        osc.load();
        var k = 2*Math.PI*440/Pd.sampleRate
        var outBuff = osc.o(0).getBuffer();

        deepEqual(toArray(outBuff), [0, 0, 0, 0]);
        osc.dspTick();

        deepEqual(roundArray(outBuff, 4), roundArray([cos(k*1), cos(k*2), cos(k*3), cos(k*4)], 4));
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray([cos(k*5), cos(k*6), cos(k*7), cos(k*8)], 4));

        // receive frequency message
        var k2 = 2*Math.PI*660/Pd.sampleRate;

        osc.i(0).message(660);
        expected = roundArray([cos(osc.phase+1*k2), cos(osc.phase+2*k2), cos(osc.phase+3*k2), cos(osc.phase+4*k2)], 4);
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), expected);

        // receive frequency signal
        var m = 2*Math.PI/Pd.sampleRate;
        var inlet0 = osc.i(0);

        inlet0.testBuffer = [770, 550, 330, 110];
        osc.trigger('inletConnect');

        expected = [cos(osc.phase+m*770), cos(osc.phase+m*770+m*550), cos(osc.phase+m*770+m*550+m*330), cos(osc.phase+m*770+m*550+m*330+m*110)]
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray(expected, 4));
        inlet0.testBuffer = [880, 440, 880, 440];
        expected = [cos(osc.phase+m*880), cos(osc.phase+m*880+m*440), cos(osc.phase+m*880+m*440+m*880), cos(osc.phase+m*880+m*440+m*880+m*440)]
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray(expected, 4));

        // reset phase
        var k2 = 2*Math.PI*440/Pd.sampleRate;
        inlet0.testBuffer = null;
        osc.trigger('inletDisconnect');

        osc.i(0).message(440);
        osc.i(1).message('bang');
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray([cos(k*1), cos(k*2), cos(k*3), cos(k*4)], 4));
    });

    test('*~', function() {
        var mult = new Pd.objects['*~'](null, [2]);
        var outBuff = mult.o(0).getBuffer();
        var inlet0 = mult.i(0);
        var inlet1 = mult.i(1);

        inlet0.testBuffer = [0, 0, 0, 0];
        mult.dspTick();
        deepEqual(toArray(outBuff), [0, 0, 0, 0]);
        // constant value as creation arg
        inlet0.testBuffer = [1, 2, 3, 4];
        mult.dspTick();
        deepEqual(toArray(outBuff), [2, 4, 6, 8]);
        // dsp right inlet
        inlet1.testBuffer = [4, 3, 2, 1];
        mult.trigger('inletConnect');
        mult.dspTick();
        deepEqual(toArray(outBuff), [4, 6, 6, 4]);
        // send message right inlet
        inlet1.testBuffer = null;
        mult.trigger('inletDisconnect');
        inlet1.message(3);
        mult.dspTick();
        deepEqual(toArray(outBuff), [3, 6, 9, 12]);
    });

    test('+~', function() {
        var add = new Pd.objects['+~'](null, [11]);
        var outBuff = add.o(0).getBuffer();
        var inlet0 = add.i(0);
        var inlet1 = add.i(1);

        inlet0.testBuffer = [0, 0, 0, 0];
        add.dspTick();
        deepEqual(toArray(outBuff), [11, 11, 11, 11]);
        // constant value as creation arg
        inlet0.testBuffer = [1, 2, 3, 4];
        add.dspTick();
        deepEqual(toArray(outBuff), [12, 13, 14, 15]);
        // dsp right inlet
        inlet1.testBuffer = [4.5, 3.5, 2.5, 1.5];
        add.trigger('inletConnect');
        add.dspTick();
        deepEqual(toArray(outBuff), [5.5, 5.5, 5.5, 5.5]);
        // send message right inlet
        inlet1.testBuffer = null;
        add.trigger('inletDisconnect');
        inlet1.message(21);
        add.dspTick();
        deepEqual(toArray(outBuff), [22, 23, 24, 25]);
    });

    test('-~', function() {
        var subs = new Pd.objects['-~'](null, [1]);
        var outBuff = subs.o(0).getBuffer();
        var inlet0 = subs.i(0);
        var inlet1 = subs.i(1);

        inlet0.testBuffer = [0, 0, 0, 0];
        subs.dspTick();
        deepEqual(roundArray(outBuff, 4), [-1, -1, -1, -1]);
        // constant value as creation arg
        inlet0.testBuffer = [2.4, 1.4, 0.45, -3];
        subs.dspTick();
        deepEqual(roundArray(outBuff, 4), [1.4, 0.4, -0.55, -4]);
        // dsp right inlet
        inlet1.testBuffer = [2.5, 1, 0.45, -4];
        subs.trigger('inletConnect');
        subs.dspTick();
        deepEqual(roundArray(outBuff, 4), [-0.1, 0.4, 0, 1]);
        // send message right inlet
        inlet1.testBuffer = null;
        subs.trigger('inletDisconnect');
        inlet1.message(-1.5);
        subs.dspTick();
        deepEqual(roundArray(outBuff, 4), [3.9, 2.9, 1.95, -1.5]);
    });

    test('/~', function() {
        var divid = new Pd.objects['/~'](null, [3]);
        var outBuff = divid.o(0).getBuffer();
        var inlet0 = divid.i(0);
        var inlet1 = divid.i(1);

        inlet0.testBuffer = [0, 0, 0, 0];
        divid.dspTick();
        deepEqual(roundArray(outBuff, 4), [0, 0, 0, 0]);
        // constant value as creation arg
        inlet0.testBuffer = [3, 33, -9.9, 12];
        divid.dspTick();
        deepEqual(roundArray(outBuff, 4), [1, 11, -3.3, 4]);
        // dsp right inlet
        inlet1.testBuffer = [1, 33, 0, 10];
        divid.trigger('inletConnect');
        divid.dspTick();
        deepEqual(roundArray(outBuff, 4), [3, 1, 0, 1.2]);
        // send message right inlet
        inlet1.testBuffer = null;
        divid.trigger('inletDisconnect');
        inlet1.message(0.1);
        divid.dspTick();
        deepEqual(roundArray(outBuff, 4), [30, 330, -99, 120]);
    });

    test('common : tabread~, tabwrite~, tabplay~', function() {
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
        tabread.i(0).message('set', 'table1');
        equal(tabread.table, table1);
    });

    test('tabread~', function() {
        var patch = new Pd.Patch();
        var tabread = new Pd.objects['tabread~'](patch, ['table1']);
        var table = new Pd.objects['table'](patch, ['table1', 10]);
        tabread.load();

        table.data = [11, 22, 33, 44, 55, 66, 77, 88, 99, 100];
        var inlet0 = tabread.i(0);
        var outBuff = tabread.o(0).getBuffer();
        // normal read
        inlet0.testBuffer = [0, 1, 2, 3];
        tabread.dspTick();
        deepEqual(toArray(outBuff), [11, 22, 33, 44]);
        // read above and below table bounds
        inlet0.testBuffer = [-10, 9, 10, 1];
        tabread.dspTick();
        deepEqual(toArray(outBuff), [11, 100, 100, 22]);
    });

    test('tabplay~', function() {
        var patch = new Pd.Patch();
        var tabplay = new Pd.objects['tabplay~'](patch, ['table1']);
        var table = new Pd.objects['table'](patch, ['table1', 6]);
        tabplay.load();

        table.data = [11, 22, 33, 44, 55, 66];
        var outBuff = tabplay.o(0).getBuffer();
        // play all
        tabplay.i(0).message('bang');
        tabplay.dspTick();
        deepEqual(toArray(outBuff), [11, 22, 33, 44]);
        tabplay.dspTick();
        deepEqual(toArray(outBuff), [55, 66, 0, 0]);
        // play from position
        tabplay.i(0).message(1);
        tabplay.dspTick();
        deepEqual(toArray(outBuff), [22, 33, 44, 55]);
        tabplay.dspTick();
        deepEqual(toArray(outBuff), [66, 0, 0, 0]);
        // play from position n samples [1 2(
        tabplay.i(0).message(2, 2);
        tabplay.dspTick();
        deepEqual(toArray(outBuff), [33, 44, 0, 0]);
        tabplay.dspTick();
        deepEqual(toArray(outBuff), [0, 0, 0, 0]);
    });

    test('tabwrite~', function() {
        var patch = new Pd.Patch();
        var tabwrite = new Pd.objects['tabwrite~'](patch, ['table1']);
        var table = new Pd.objects['table'](patch, ['table1', 5]);
        tabwrite.load();

        var inlet0 = tabwrite.i(0);
        // idle
        deepEqual(toArray(table.data), [0, 0, 0, 0, 0]);
        inlet0.testBuffer = [0, 1, 2, 3];
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [0, 0, 0, 0, 0]);
        // bang
        tabwrite.i(0).message('bang');
        inlet0.testBuffer = [4, 1, 2, 3];
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [4, 1, 2, 3, 0]);
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [4, 1, 2, 3, 4]);
        // start
        tabwrite.i(0).message('start');
        inlet0.testBuffer = [5, 6, 7, 8];
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [5, 6, 7, 8, 4]);
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [5, 6, 7, 8, 5]);
        // start + pos
        tabwrite.i(0).message('start', 3);
        inlet0.testBuffer = [9, 10, 11, 12];
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [5, 6, 7, 9, 10]);
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [5, 6, 7, 9, 10]);
        // stop
        tabwrite.i(0).message('bang');
        inlet0.testBuffer = [1, 2, 3, 4];
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [1, 2, 3, 4, 10]);
        tabwrite.i(0).message('stop');
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [1, 2, 3, 4, 10]);
        // end callback
        var bla = 0;
        tabwrite.i(0).message('bang');
        tabwrite.on('end', function(obj) {bla = tabwrite.tableName;});
        tabwrite.dspTick();
        equal(bla, 0);
        tabwrite.dspTick();
        equal(bla, 'table1');
    });

    test('line~', function() {
        var dummyPatch = {
            sampleRate: 10
        };
        var line = new Pd.objects['line~']();
        line.patch = dummyPatch;
        
        var outBuff = line.o(0).getBuffer();
        deepEqual(toArray(outBuff), [0, 0, 0, 0]);
        line.dspTick();
        deepEqual(toArray(outBuff), [0, 0, 0, 0]);

        // jump to value
        line.i(0).message(1345.99);
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [1345.99, 1345.99, 1345.99, 1345.99]);
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [1345.99, 1345.99, 1345.99, 1345.99]);
        // ramp to value
        line.i(0).message(1);
        line.i(0).message(2, 1000); // line to 2 in 1 millisecond
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [1, 1.1, 1.2, 1.3]);
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [1.4, 1.5, 1.6, 1.7]);
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [1.8, 1.9, 2, 2]);
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [2, 2, 2, 2]);
        line.i(0).message(1, 200);
        line.dspTick();
        deepEqual(roundArray(outBuff, 2), [2, 1.5, 1, 1]);
        // end callback
        var bla = 0;
        line.bla = 999;
        line.i(0).message(0, 700);
        line.on('end', function(obj) {bla = line.bla;});
        line.dspTick();
        equal(bla, 0);
        line.dspTick();
        equal(bla, 999);
    });

/******************** tests dsp objects ************************/

    module('Pd.objects - misc', {
        setup: function() {
            Pd.blockSize = 4;
            this.sampleRate = Pd.sampleRate;
        },
        teardown: function() {
            Pd.sampleRate = this.sampleRate;
        }
    });

    test('mtof', function() {
        var mtof = new Pd.objects['mtof'](null);

        // < -1500
        mtof.i(0).message(-1790);
        equal(mtof.o(0).receivedMessage, 0);

        // >= 1500
        mtof.i(0).message(1500);
        equal(round(mtof.o(0).receivedMessage), round(8.17579891564 * Math.exp(.0577622650 * 1499)));
        mtof.i(0).message(2000);
        equal(round(mtof.o(0).receivedMessage), round(8.17579891564 * Math.exp(.0577622650 * 1499)));

        // -1500 < val < 1500
        mtof.i(0).message(69);
        equal(round(mtof.o(0).receivedMessage), 440);
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
