$(document).ready(function() {

/******************** setting up tests ************************/

    // Override inlets and outlets methods for easier testing
    function portletsTesting() {
        Pd.extend(Pd['inlet~'].prototype, {
            setBuffer: function(buff) { 
                this.testBuffer = buff;
                this.obj.emit('inletConnect');
            },
            delBuffer: function() { 
                this.testBuffer = undefined;
                this.obj.emit('inletDisconnect');
            },
            getBuffer: function() { return this.testBuffer; },
            hasDspSources: function() { return this.testBuffer !== undefined; },
            __testing__getBuffer: Pd['inlet~'].prototype.getBuffer,
            __testing__hasDspSources: Pd['inlet~'].prototype.hasDspSources
        });

        Pd.extend(Pd['outlet'].prototype, {
            message: function() { this.receivedMessage = Array.prototype.slice.call(arguments); },
            __testing__message: Pd['outlet'].prototype.message
        });
    }

    function restorePortlets() {
        Pd.extend(Pd['inlet~'].prototype, {
            getBuffer: Pd['inlet~'].prototype.__testing__getBuffer,
            hasDspSources: Pd['inlet~'].prototype.__testing__hasDspSources
        });

        Pd.extend(Pd['outlet'].prototype, {
            message: Pd['outlet'].prototype.__testing__message
        });
    }

    function average(array) {
        var i, length, avg;

        for (i = 0, length = array.length; i < length; i++) {
            avg += array[i];
        }
        avg /= array.length;
        return avg;
    }

/******************** tests dsp objects ************************/

    module('Pd.objects - dsp', {
        setup: function() {
            Pd.blockSize = 4;
            this.sampleRate = Pd.sampleRate;
            portletsTesting();
        },
        teardown: function() {
            Pd.sampleRate = this.sampleRate;
            Pd._uniquelyNamedObjects = {};
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
        osc = new Pd.objects['osc~'](null, [440]);
        osc.patch = dummyPatch;
        osc.load();
        var k = 2*Math.PI*440/Pd.sampleRate;
        outBuff = osc.o(0).getBuffer();

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

        inlet0.setBuffer([770, 550, 330, 110]);
        osc.emit('inletConnect');

        expected = [cos(osc.phase+m*770), cos(osc.phase+m*770+m*550), cos(osc.phase+m*770+m*550+m*330), cos(osc.phase+m*770+m*550+m*330+m*110)];
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray(expected, 4));
        inlet0.setBuffer([880, 440, 880, 440]);
        expected = [cos(osc.phase+m*880), cos(osc.phase+m*880+m*440), cos(osc.phase+m*880+m*440+m*880), cos(osc.phase+m*880+m*440+m*880+m*440)];
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray(expected, 4));

        /*// reset phase
        k2 = 2*Math.PI*440/Pd.sampleRate;
        inlet0.delBuffer();
        osc.emit('inletDisconnect');

        osc.i(0).message(440);
        osc.i(1).message('bang');
        osc.dspTick();
        deepEqual(roundArray(outBuff, 4), roundArray([cos(k*1), cos(k*2), cos(k*3), cos(k*4)], 4));*/
    });

    test('phasor~', function() {
        // no frequency (=0)
        var patch = new Pd.Patch(),
            phasor = new Pd.objects['phasor~'](patch),
            outBuff = phasor.o(0).getBuffer(),
            expected = [];
        phasor.load();

        deepEqual(toArray(outBuff), [0, 0, 0, 0]);
        phasor.dspTick();
        deepEqual(toArray(outBuff), [0, 0, 0, 0]);        

        // frequency argument 
        phasor = new Pd.objects['phasor~'](patch, [1]);
        patch.sampleRate = 5;
        phasor.load();
        outBuff = phasor.o(0).getBuffer();

        deepEqual(toArray(outBuff), [0, 0, 0, 0]);
        phasor.dspTick();
        deepEqual(roundArray(outBuff, 4), [0.2, 0.4, 0.6, 0.8]);
        phasor.dspTick();
        deepEqual(roundArray(outBuff, 4), [1, 0.2, 0.4, 0.6]);

        // receive frequency message
        phasor.i(0).message(0.5);
        phasor.dspTick();
        deepEqual(roundArray(outBuff, 4), [0.7, 0.8, 0.9, 0]);
        phasor.dspTick();
        deepEqual(roundArray(outBuff, 4), [0.1, 0.2, 0.3, 0.4]);

        // receive frequency signal
        var inlet0 = phasor.i(0);
        inlet0.setBuffer([1, 0.5, 0.2, 0.1]);
        phasor.emit('inletConnect');

        phasor.dspTick();
        deepEqual(roundArray(outBuff, 4), [0.6, 0.7, 0.74, 0.76]);
        phasor.dspTick();
        deepEqual(roundArray(outBuff, 4), [0.96, 0.06, 0.1, 0.12]);
    });

    test('noise~', function() {
        Pd.blockSize = 1024;
        var noise = new Pd.objects['noise~'](),
            outBuff = noise.o(0).getBuffer(),
            avg = 0, dev = 0, i;

        noise.dspTick();
        average(outBuff);
        for (i = 0; i < outBuff.length; i++) {
            dev += Math.pow(outBuff[i] - avg, 2);
        }
        dev /= outBuff.length;
        dev = Math.pow(dev, 0.5);
        // Avg should be around 0
        ok(Math.abs(avg) < 0.1);
        // Values are not concentrated around 0
        ok(dev > 0.5);
    });

    test('*~', function() {
        var mult = new Pd.objects['*~'](null, [2]),
            outBuff = mult.o(0).getBuffer(),
            inlet0 = mult.i(0),
            inlet1 = mult.i(1);

        inlet0.setBuffer([0, 0, 0, 0]);
        mult.dspTick();
        deepEqual(toArray(outBuff), [0, 0, 0, 0]);
        // constant value as creation arg
        inlet0.setBuffer([1, 2, 3, 4]);
        mult.dspTick();
        deepEqual(toArray(outBuff), [2, 4, 6, 8]);
        // dsp right inlet
        inlet1.setBuffer([4, 3, 2, 1]);
        mult.emit('inletConnect');
        mult.dspTick();
        deepEqual(toArray(outBuff), [4, 6, 6, 4]);
        // send message right inlet
        inlet1.delBuffer();
        mult.emit('inletDisconnect');
        inlet1.message(3);
        mult.dspTick();
        deepEqual(toArray(outBuff), [3, 6, 9, 12]);
    });

    test('+~', function() {
        var add = new Pd.objects['+~'](null, [11]),
            outBuff = add.o(0).getBuffer(),
            inlet0 = add.i(0),
            inlet1 = add.i(1);

        inlet0.setBuffer([0, 0, 0, 0]);
        add.dspTick();
        deepEqual(toArray(outBuff), [11, 11, 11, 11]);
        // constant value as creation arg
        inlet0.setBuffer([1, 2, 3, 4]);
        add.dspTick();
        deepEqual(toArray(outBuff), [12, 13, 14, 15]);
        // dsp right inlet
        inlet1.setBuffer([4.5, 3.5, 2.5, 1.5]);
        add.emit('inletConnect');
        add.dspTick();
        deepEqual(toArray(outBuff), [5.5, 5.5, 5.5, 5.5]);
        // send message right inlet
        inlet1.delBuffer();
        add.emit('inletDisconnect');
        inlet1.message(21);
        add.dspTick();
        deepEqual(toArray(outBuff), [22, 23, 24, 25]);
    });

    test('-~', function() {
        var subs = new Pd.objects['-~'](null, [1]),
            outBuff = subs.o(0).getBuffer(),
            inlet0 = subs.i(0),
            inlet1 = subs.i(1);

        inlet0.setBuffer([0, 0, 0, 0]);
        subs.dspTick();
        deepEqual(roundArray(outBuff, 4), [-1, -1, -1, -1]);
        // constant value as creation arg
        inlet0.setBuffer([2.4, 1.4, 0.45, -3]);
        subs.dspTick();
        deepEqual(roundArray(outBuff, 4), [1.4, 0.4, -0.55, -4]);
        // dsp right inlet
        inlet1.setBuffer([2.5, 1, 0.45, -4]);
        subs.emit('inletConnect');
        subs.dspTick();
        deepEqual(roundArray(outBuff, 4), [-0.1, 0.4, 0, 1]);
        // send message right inlet
        inlet1.delBuffer();
        subs.emit('inletDisconnect');
        inlet1.message(-1.5);
        subs.dspTick();
        deepEqual(roundArray(outBuff, 4), [3.9, 2.9, 1.95, -1.5]);
    });

    test('/~', function() {
        var divid = new Pd.objects['/~'](null, [3]),
            outBuff = divid.o(0).getBuffer(),
            inlet0 = divid.i(0),
            inlet1 = divid.i(1);

        inlet0.setBuffer([0, 0, 0, 0]);
        divid.dspTick();
        deepEqual(roundArray(outBuff, 4), [0, 0, 0, 0]);
        // constant value as creation arg
        inlet0.setBuffer([3, 33, -9.9, 12]);
        divid.dspTick();
        deepEqual(roundArray(outBuff, 4), [1, 11, -3.3, 4]);
        // dsp right inlet
        inlet1.setBuffer([1, 33, 0, 10]);
        divid.emit('inletConnect');
        divid.dspTick();
        deepEqual(roundArray(outBuff, 4), [3, 1, 0, 1.2]);
        // send message right inlet
        inlet1.delBuffer();
        divid.emit('inletDisconnect');
        inlet1.message(0.1);
        divid.dspTick();
        deepEqual(roundArray(outBuff, 4), [30, 330, -99, 120]);
    });

    test('lop~', function() {
        Pd.blockSize = 1024;
        var patch = new Pd.Patch(),
            lop = new Pd.objects['lop~'](patch),
            osc = new Pd.objects['osc~'](patch, [440]),
            oscBuff = osc.o(0).getBuffer(),
            outBuff = lop.o(0).getBuffer();
        osc.load();
        lop.load();
        osc.dspTick();
        lop.i(0).setBuffer(oscBuff);

        // cut-off = 0
        lop.dspTick();
        var outMin = Math.min.apply(Math, toArray(outBuff)), outMax = Math.max.apply(Math, toArray(outBuff));
        equal(Math.round(outMin, 4), 0);
        equal(Math.round(outMax, 4), 0);

        // set cut-off
        lop.i(1).message(100);
        lop.dspTick();
        outMin = Math.min.apply(Math, toArray(outBuff));
        outMax = Math.max.apply(Math, toArray(outBuff));
        ok(outMin < 0 && outMin > -0.5);
        ok(outMax > 0 && outMax < 0.5);

        // set cut-off
        lop = new Pd.objects['lop~'](patch, [5000]);
        outBuff = lop.o(0).getBuffer();
        lop.load();
        lop.i(0).setBuffer(oscBuff);

        lop.dspTick();
        outMin = Math.min.apply(Math, toArray(outBuff));
        outMax = Math.max.apply(Math, toArray(outBuff));
        ok(outMin < -0.5);
        ok(outMax > 0.5);
    });

    test('hip~', function() {
        Pd.blockSize = 1024;
        var patch = new Pd.Patch(),
            hip = new Pd.objects['hip~'](patch),
            osc = new Pd.objects['osc~'](patch, [4400]),
            oscBuff = osc.o(0).getBuffer(),
            outBuff = hip.o(0).getBuffer();
        osc.load();
        hip.load();
        osc.dspTick();

        // cut-off = 0
        hip.i(0).setBuffer(oscBuff);
        hip.dspTick();
        var outMin = Math.min.apply(Math, toArray(outBuff)), outMax = Math.max.apply(Math, toArray(outBuff));
        ok(outMin < -0.5);
        ok(outMax > 0.5);

        // set cut-off
        hip.i(1).message(4000);
        hip.dspTick();
        outMin = Math.min.apply(Math, toArray(outBuff));
        outMax = Math.max.apply(Math, toArray(outBuff));
        ok(outMin < 0 && outMin > -0.5);
        ok(outMax > 0 && outMax < 0.5);

        // set cut-off
        hip = new Pd.objects['hip~'](patch, [10000]);
        outBuff = hip.o(0).getBuffer();
        hip.load();
        hip.i(0).setBuffer(oscBuff);

        hip.dspTick();
        outMin = Math.min.apply(Math, toArray(outBuff));
        outMax = Math.max.apply(Math, toArray(outBuff));
        equal(Math.round(outMin, 4), 0);
        equal(Math.round(outMax, 4), 0);
    });

    test('common : tabread~, tabwrite~, tabplay~', function() {
        var patch = new Pd.Patch(),
            tabread = new Pd.objects['tabread~'](patch, ['table1']),
            table1 = new Pd.objects['table'](patch, ['table1', 10]),
            table2 = new Pd.objects['table'](patch, ['table2', 10]);
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
        var patch = new Pd.Patch(),
            tabread = new Pd.objects['tabread~'](patch, ['table1']),
            table = new Pd.objects['table'](patch, ['table1', 10]);
        tabread.load();

        table.data = [11, 22, 33, 44, 55, 66, 77, 88, 99, 100];
        var inlet0 = tabread.i(0);
        var outBuff = tabread.o(0).getBuffer();
        // normal read
        inlet0.setBuffer([0, 1, 2, 3]);
        tabread.dspTick();
        deepEqual(toArray(outBuff), [11, 22, 33, 44]);
        // read above and below table bounds
        inlet0.setBuffer([-10, 9, 10, 1]);
        tabread.dspTick();
        deepEqual(toArray(outBuff), [11, 100, 100, 22]);
    });

    test('tabread4~', function() {
        var patch = new Pd.Patch(),
            tabread = new Pd.objects['tabread4~'](patch, ['table1']),
            table = new Pd.objects['table'](patch, ['table1', 10]);
        tabread.load();

        table.data = [10, 20, 33, 44, 55, 66, 77, 88, 99, 100];
        var inlet0 = tabread.i(0);
        var outBuff = tabread.o(0).getBuffer();
        // normal read
        inlet0.setBuffer([0.5, 1.5, 2.6, 2.8]);
        tabread.dspTick();
        deepEqual(roundArray(outBuff, 4), [15, 26.5, 39.6, 41.8]);
        // read above and below table bounds
        inlet0.setBuffer([-10, 9, 10, 1]);
        tabread.dspTick();
        deepEqual(toArray(outBuff), [10, 100, 100, 20]);
    });

    test('tabplay~', function() {
        var patch = new Pd.Patch(),
            tabplay = new Pd.objects['tabplay~'](patch, ['table1']),
            outBuff = tabplay.o(0).getBuffer(),
            table = new Pd.objects['table'](patch, ['table1', 6]);
        tabplay.load();

        table.data = [11, 22, 33, 44, 55, 66];
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
        var patch = new Pd.Patch(),
            tabwrite = new Pd.objects['tabwrite~'](patch, ['table1']),
            inlet0 = tabwrite.i(0),
            table = new Pd.objects['table'](patch, ['table1', 5]);
        tabwrite.load();

        // idle
        deepEqual(toArray(table.data), [0, 0, 0, 0, 0]);
        inlet0.setBuffer([0, 1, 2, 3]);
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [0, 0, 0, 0, 0]);
        // bang
        tabwrite.i(0).message('bang');
        inlet0.setBuffer([4, 1, 2, 3]);
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [4, 1, 2, 3, 0]);
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [4, 1, 2, 3, 4]);
        // start
        tabwrite.i(0).message('start');
        inlet0.setBuffer([5, 6, 7, 8]);
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [5, 6, 7, 8, 4]);
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [5, 6, 7, 8, 5]);
        // start + pos
        tabwrite.i(0).message('start', 3);
        inlet0.setBuffer([9, 10, 11, 12]);
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [5, 6, 7, 9, 10]);
        tabwrite.dspTick();
        deepEqual(toArray(table.data), [5, 6, 7, 9, 10]);
        // stop
        tabwrite.i(0).message('bang');
        inlet0.setBuffer([1, 2, 3, 4]);
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

    test('delwrite~ / delread~', function() {
        Pd.sampleRate = 10;
        Pd.blockSize = 5;
        var patch = new Pd.Patch(),
            delwrite = new Pd.objects['delwrite~'](patch, ['del1', 1000]),
            delread = new Pd.objects['delread~'](patch, ['del1', 400]),
            outBuff = delread.o(0).getBuffer();
        delwrite.load();
        delread.load();
        equal(delread.delline.size, 10);
        equal(delread.delline.name, 'del1');

        delwrite.dspTick();
        delread.dspTick();
        deepEqual(roundArray(outBuff, 4), [0, 0, 0, 0, 0]);

        delwrite.i(0).setBuffer([0.1, 0.2, 0.3, 0.4, 0.5]);
        delwrite.dspTick();
        delread.dspTick();
        deepEqual(roundArray(outBuff, 4), [0, 0, 0, 0, 0.1]);

        delwrite.i(0).setBuffer([0.6, 0.7, 0.8, 0.9, 1]);
        delwrite.dspTick();
        delread.dspTick();
        deepEqual(roundArray(outBuff, 4), [0.2, 0.3, 0.4, 0.5, 0.6]);

        delread.i(0).message(500);
        delwrite.i(0).setBuffer([1.1, 1.2, 1.3, 1.4, 1.5]);
        delwrite.dspTick();
        delread.dspTick();
        deepEqual(roundArray(outBuff, 4), [0.6, 0.7, 0.8, 0.9, 1]);
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

    test('message', function() {
        var msg = new Pd.objects['message'](null, [11]);
        msg.i(0).message(22);
        deepEqual(msg.o(0).receivedMessage, [11]);
        msg.i(0).message('bang');
        deepEqual(msg.o(0).receivedMessage, [11]);
        msg.i(0).message('bla', 123);
        deepEqual(msg.o(0).receivedMessage, [11]);

        msg.setFilterMsg([11, '22']);
        msg.i(0).message('blibli');
        deepEqual(msg.o(0).receivedMessage, [11, '22']);
        msg.i(0).message('bang');
        deepEqual(msg.o(0).receivedMessage, [11, '22']);
        msg.i(0).message('b', 56, 78);
        deepEqual(msg.o(0).receivedMessage, [11, '22']);

        msg.setFilterMsg(['$1', 33, '$3']);
        msg.i(0).message(22, 'bloblo', 44, 'blibli', 66);
        deepEqual(msg.o(0).receivedMessage, [22, 33, 44]);
        msg.i(0).message('bloblo', 'bleble', 'blybly');
        deepEqual(msg.o(0).receivedMessage, ['bloblo', 33, 'blybly']);
        raises(function() { msg.i(0).message('ouch', 'ich'); });
        raises(function() { msg.i(0).message(11); });
        raises(function() { msg.i(0).message('bang'); });
    });

    test('delline', function() {
        var delline = new Pd.objects['delline'](null, ['del1', 10]);
        delline.write([11, 22, 33, 44, 55]);
        deepEqual(toArray(delline.data), [11, 22, 33, 44, 55, 0, 0, 0, 0, 0]);
        delline.write([11, 22, 33, 44, 55, 66, 77]);
        deepEqual(toArray(delline.data), [66, 77, 33, 44, 55, 11, 22, 33, 44, 55]);

        var array = [0, 0, 0, 0, 0];
        delline.read(array, delline.pos - 5);
        deepEqual(array, [33, 44, 55, 66, 77]);
        // position 0 has been overwritten already : 
        raises(function() { delline.read(array, 0); });

        var delline = new Pd.objects['delline'](null, ['del2', 10]);
        delline.write([11, 22, 33, 44, 55]);
        delline.read(array, -2);
        deepEqual(array, [0, 0, 11, 22, 33]);
    });

    test('mtof', function() {
        var mtof = new Pd.objects['mtof'](null);

        // < -1500
        mtof.i(0).message(-1790);
        equal(mtof.o(0).receivedMessage, 0);

        // >= 1500
        mtof.i(0).message(1500);
        equal(round(mtof.o(0).receivedMessage), round(8.17579891564 * Math.exp(0.0577622650 * 1499)));
        mtof.i(0).message(2000);
        equal(round(mtof.o(0).receivedMessage), round(8.17579891564 * Math.exp(0.0577622650 * 1499)));

        // -1500 < val < 1500
        mtof.i(0).message(69);
        equal(round(mtof.o(0).receivedMessage), 440);
    });

    test('metro', function() {
        Pd.sampleRate = 10;
        var patch = new Pd.Patch(),
            metro = new Pd.objects['metro'](patch, [1000]),
            i;

        // metro stopped
        for (i = 0; i < 13; i++) patch.generateFrame();
        equal(metro.o(0).receivedMessage, undefined);

        // timeout started (1000 ms => 10 samples => 2,5 frames (cause blockSize = 4) )
        metro.i(0).message('bang');
        deepEqual(metro.o(0).receivedMessage, ['bang']);
        metro.o(0).receivedMessage = undefined;
        for (i = 0; i < 3; i++) patch.generateFrame();
        equal(metro.o(0).receivedMessage, undefined);
        patch.generateFrame();
        deepEqual(metro.o(0).receivedMessage, ['bang']);

        // metro stopped again
        metro.o(0).receivedMessage = undefined;
        metro.i(0).message(0);
        for (i = 0; i < 13; i++) patch.generateFrame();
        equal(metro.o(0).receivedMessage, undefined);

        // metro started again
        metro.o(0).receivedMessage = undefined;
        // TICK 1
        metro.i(0).message(123);
        deepEqual(metro.o(0).receivedMessage, ['bang']);
        metro.o(0).receivedMessage = undefined;
        // TICK 2
        // a few frames pass (rate still 1000)
        for (i = 0; i < 3; i++) patch.generateFrame();
        metro.i(1).message(1600);
        equal(metro.o(0).receivedMessage, undefined);
        // Changing the rate works only for next tick
        patch.generateFrame();
        deepEqual(metro.o(0).receivedMessage, ['bang']);
        metro.o(0).receivedMessage = undefined;
        // TICK 3
        // timeout started (1600 ms => 16 samples => 4 frames)
        for (i = 0; i < 4; i++) patch.generateFrame();
        equal(metro.o(0).receivedMessage, undefined);
        patch.generateFrame();
        deepEqual(metro.o(0).receivedMessage, ['bang']);
    });

    test('delay', function() {
        var patch = new Pd.Patch();
        patch.sampleRate = 10;
        var delay = new Pd.objects['delay'](patch, [1100]),
            i;

        // no delay started
        for (i = 0; i < 13; i++) patch.generateFrame();
        equal(delay.o(0).receivedMessage, undefined);

        // delay started (1100 ms => 11 samples => 2,75 frames (cause blockSize = 4) )
        delay.i(0).message('bang');
        for (i = 0; i < 3; i++) patch.generateFrame();
        equal(delay.o(0).receivedMessage, undefined);
        patch.generateFrame();
        deepEqual(delay.o(0).receivedMessage, ['bang']);

        // delay instant bang
        delay.o(0).receivedMessage = undefined;
        delay.i(0).message(0);
        equal(delay.o(0).receivedMessage, undefined);
        patch.generateFrame();
        deepEqual(delay.o(0).receivedMessage, ['bang']);

        // delay started again (1200 ms => 3 frames)
        delay.o(0).receivedMessage = undefined;
        delay.i(0).message(1200);
        // a few ticks pass, changing the delay doesn't affect the delay already started
        for (i = 0; i < 3; i++) patch.generateFrame();
        equal(delay.o(0).receivedMessage, undefined);
        delay.i(1).message(1600);
        patch.generateFrame();
        deepEqual(delay.o(0).receivedMessage, ['bang']);

        // delay should now be (1600 ms => 4 frames)
        delay.o(0).receivedMessage = undefined;
        delay.i(0).message('bang');
        // a few ticks pass, sending a new message on 0 restart the delay
        for (i = 0; i < 4; i++) patch.generateFrame();
        equal(delay.o(0).receivedMessage, undefined);
        delay.i(0).message(800);
        for (i = 0; i < 2; i++) patch.generateFrame();
        equal(delay.o(0).receivedMessage, undefined);
        patch.generateFrame();
        deepEqual(delay.o(0).receivedMessage, ['bang']);
    });

    test('timer', function() {
        var patch = new Pd.Patch();
        patch.sampleRate = 10;
        patch.blockSize = 2;
        var timer = new Pd.objects['timer'](patch),
            i, round = Math.round;

        // timer is started when created
        for (i = 0; i < 5; i++) patch.generateFrame();
        equal(timer.o(0).receivedMessage, undefined);
        timer.i(1).message('bang');
        deepEqual(timer.o(0).receivedMessage, [5 * 2 * 0.1 * 1000]); // 5 frames of 2 blocks have run at sample rate 10.
        timer.o(0).receivedMessage = undefined;

        // timer reset
        timer.i(0).message('bang');
        for (i = 0; i < 3; i++) patch.generateFrame();
        equal(timer.o(0).receivedMessage, undefined);
        timer.i(1).message('bang');
        deepEqual(round(timer.o(0).receivedMessage, 4), round([3 * 2 * 0.1 * 1000], 4));
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

    test('text', function() {
        expect(0);
        var text = new Pd.objects['text'](null);
        var textBla = new Pd.objects['text'](null, ['Je suis un texte']);
    });

    module('Pd.objects - glue', {
        setup: function() {
            Pd.blockSize = 4;
            this.sampleRate = Pd.sampleRate;
            portletsTesting();
        },
        teardown: function() {
            Pd.sampleRate = this.sampleRate;
        }
    });

    test('float', function() {
        // abbreviation
        equal(Pd.objects['float'], Pd.objects['f']);

        var float = new Pd.objects['float']();
        equal(float.o(0).receivedMessage, undefined);

        // Default value 
        float.i(0).message('bang');
        deepEqual(float.o(0).receivedMessage, [0]);

        // Float in input
        float.i(0).message(2);
        deepEqual(float.o(0).receivedMessage, [2]);

        // Test set value
        float.i(1).message(3);
        float.i(0).message('bang');
        deepEqual(float.o(0).receivedMessage, [3]);

        // Test inlet 0 overwrites inlet 1
        float.i(1).message(4);
        float.i(0).message(5);
        deepEqual(float.o(0).receivedMessage, [5]);

        // Test creation argument
        float = new Pd.objects['float'](null, [6]);
        float.i(0).message('bang');
        deepEqual(float.o(0).receivedMessage, [6]);
    });

    test('+, -, *, /, mod', function() {
        var add = new Pd.objects['+']();
        equal(add.o(0).receivedMessage, undefined);

        // Default value 
        add.i(0).message('bang');
        deepEqual(add.o(0).receivedMessage, [0]);
        add.i(0).message(12);
        deepEqual(add.o(0).receivedMessage, [12]);

        // Constructor value 
        add = new Pd.objects['+'](null, [9]);
        add.i(0).message(11.5);
        deepEqual(add.o(0).receivedMessage, [20.5]);
        add.o(0).receivedMessage = undefined;
        add.i(0).message('bang');
        deepEqual(add.o(0).receivedMessage, [20.5]);

        // Change value 
        add.i(1).message(118.78);
        add.i(0).message(23.5);
        deepEqual(add.o(0).receivedMessage, [142.28]);
    });

    test('spigot', function() {
        var spigot = new Pd.objects['spigot']();
        equal(spigot.o(0).receivedMessage, undefined);

        spigot.i(0).message(1, 23, 'bla');
        equal(spigot.o(0).receivedMessage, undefined);

        spigot.i(1).message(1);
        spigot.i(0).message(1, 23, 'bla');
        deepEqual(spigot.o(0).receivedMessage, [1, 23, 'bla']);

        spigot.o(0).receivedMessage = undefined;
        spigot.i(1).message(0);
        spigot.i(0).message(2266);
        equal(spigot.o(0).receivedMessage, undefined);

        spigot = new Pd.objects['spigot'](null, [8]);
        spigot.i(0).message('2266');
        deepEqual(spigot.o(0).receivedMessage, ['2266']);
    });

    test('trigger', function() {
        // abbreviation
        equal(Pd.objects['trigger'], Pd.objects['t']);

        var trigger = new Pd.objects['trigger'](null);
        equal(trigger.o(0).receivedMessage, undefined);
        equal(trigger.o(1).receivedMessage, undefined);
        equal(trigger.outlets.length, 2);
        trigger.i(0).message(1, 2, 3);
        deepEqual(trigger.o(0).receivedMessage, ['bang']);
        deepEqual(trigger.o(1).receivedMessage, ['bang']);

        trigger = new Pd.objects['trigger'](null, ['float', 'bang', 'symbol', 'list', 'anything']);
        equal(trigger.outlets.length, 5);

        trigger.i(0).message(1);
        deepEqual(trigger.o(4).receivedMessage, [1]);
        deepEqual(trigger.o(3).receivedMessage, [1]);
        deepEqual(trigger.o(2).receivedMessage, ['float']);
        deepEqual(trigger.o(1).receivedMessage, ['bang']);
        deepEqual(trigger.o(0).receivedMessage, [1]);

        trigger.i(0).message(1, 'pol', 3);
        deepEqual(trigger.o(4).receivedMessage, [1, 'pol', 3]);
        deepEqual(trigger.o(3).receivedMessage, [1, 'pol', 3]);
        deepEqual(trigger.o(2).receivedMessage, ['float']);
        deepEqual(trigger.o(1).receivedMessage, ['bang']);
        deepEqual(trigger.o(0).receivedMessage, [1]);

        trigger.i(0).message('bang');
        deepEqual(trigger.o(4).receivedMessage, ['bang']);
        deepEqual(trigger.o(3).receivedMessage, ['bang']);
        deepEqual(trigger.o(2).receivedMessage, ['symbol']);
        deepEqual(trigger.o(1).receivedMessage, ['bang']);
        deepEqual(trigger.o(0).receivedMessage, [0]);
    });

    test('select', function() {
        // abbreviation
        equal(Pd.objects['select'], Pd.objects['sel']);

        var select = new Pd.objects['select'](null, [3]);
        equal(select.o(0).receivedMessage, undefined);
        equal(select.o(1).receivedMessage, undefined);
        equal(select.outlets.length, 2);
        select.i(0).message(1);
        equal(select.o(0).receivedMessage, undefined);
        deepEqual(select.o(1).receivedMessage, [1]);

        select = new Pd.objects['select'](null, [1, 2, 'bla']);
        equal(select.outlets.length, 4);
        select.i(0).message(1);
        deepEqual(select.o(0).receivedMessage, ['bang']);
        equal(select.o(1).receivedMessage, undefined);
        equal(select.o(2).receivedMessage, undefined);
        equal(select.o(3).receivedMessage, undefined);
        select.o(0).receivedMessage = undefined;

        select.i(0).message('bla');
        equal(select.o(0).receivedMessage, undefined);
        equal(select.o(1).receivedMessage, undefined);
        deepEqual(select.o(2).receivedMessage, ['bang']);
        equal(select.o(3).receivedMessage, undefined);
        select.o(2).receivedMessage = undefined;

        select.i(0).message('blablabla');
        equal(select.o(0).receivedMessage, undefined);
        equal(select.o(1).receivedMessage, undefined);
        equal(select.o(2).receivedMessage, undefined);
        deepEqual(select.o(3).receivedMessage, ['blablabla']);
        select.o(3).receivedMessage = undefined;

        // Testing inlet 1 
        select = new Pd.objects['select']();
        select.i(0).message(0);
        deepEqual(select.o(0).receivedMessage, ['bang']);
        equal(select.o(1).receivedMessage, undefined);
        select.o(0).receivedMessage = undefined;

        select.i(1).message(2);
        select.i(0).message(0);
        equal(select.o(0).receivedMessage, undefined);
        deepEqual(select.o(1).receivedMessage, [0]);
        select.o(1).receivedMessage = undefined;

        select.i(0).message(2);
        deepEqual(select.o(0).receivedMessage, ['bang']);
        equal(select.o(1).receivedMessage, undefined);
        select.o(0).receivedMessage = undefined;
        
    });

    test('moses', function() {
        var moses = new Pd.objects['moses'](null, [3.55]);

        equal(moses.o(0).receivedMessage, undefined);
        equal(moses.o(1).receivedMessage, undefined);

        moses.i(0).message(1);
        deepEqual(moses.o(0).receivedMessage, [1]);
        equal(moses.o(1).receivedMessage, undefined);
        moses.o(0).receivedMessage = undefined;

        moses.i(0).message(3.55);
        equal(moses.o(0).receivedMessage, undefined);
        deepEqual(moses.o(1).receivedMessage, [3.55]);
        moses.o(1).receivedMessage = undefined;

        moses.i(0).message(90);
        equal(moses.o(0).receivedMessage, undefined);
        deepEqual(moses.o(1).receivedMessage, [90]);
        moses.o(1).receivedMessage = undefined;

        // Change split
        moses.i(1).message(9.65);

        moses.i(0).message(9);
        deepEqual(moses.o(0).receivedMessage, [9]);
        equal(moses.o(1).receivedMessage, undefined);
        moses.o(0).receivedMessage = undefined;

        moses.i(0).message(9.7);
        equal(moses.o(0).receivedMessage, undefined);
        deepEqual(moses.o(1).receivedMessage, [9.7]);
        moses.o(1).receivedMessage = undefined;
        
    });

    test('random', function() {
        var randObj = new Pd.objects['random'](null, [3]),
            numbers = [0, 0, 0],
            i;

        for (i = 0; i < 20; i++) {
            randObj.i(0).message('bang');
            numbers[randObj.o(0).receivedMessage]++;
        }
        equal(numbers.length, 3);
        notEqual(numbers[0], 0);
        notEqual(numbers[1], 0);
        notEqual(numbers[2], 0);

        randObj.i(1).message(4);
        numbers = [0, 0, 0, 0];
        for (i = 0; i < 20; i++) {
            randObj.i(0).message('bang');
            numbers[randObj.o(0).receivedMessage]++;
        }
        equal(numbers.length, 4);
        notEqual(numbers[0], 0);
        notEqual(numbers[1], 0);
        notEqual(numbers[2], 0);
        notEqual(numbers[3], 0);
    });

    test('send/receive', function() {
        var patch = new Pd.Patch(),
            send1 = new Pd.objects['send'](patch, ['no1']),
            receive1 = new Pd.objects['receive'](patch, ['no1']),
            receive1bis = new Pd.objects['receive'](patch, ['no1']),
            send2 = new Pd.objects['send'](patch, ['no2']),
            receive2 = new Pd.objects['receive'](patch, ['no2']);

        equal(receive1.o(0).receivedMessage, undefined);
        equal(receive2.o(0).receivedMessage, undefined);
        send1.i(0).message('bla', 'bli', 'blu');
        deepEqual(receive1.o(0).receivedMessage, ['bla', 'bli', 'blu']);
        deepEqual(receive1bis.o(0).receivedMessage, ['bla', 'bli', 'blu']);
        equal(receive2.o(0).receivedMessage, undefined);

        receive1.o(0).receivedMessage = undefined;
        var receivedOutside = [];
        patch.receive('no2', function() {
            var args = Array.prototype.slice.call(arguments, 0);
            for (var i = 0; i < args.length; i++) {
                receivedOutside.push(args[i]);
            }
        });
        patch.send('no2', 'bla', 888);
        equal(receive1.o(0).receivedMessage, undefined);
        deepEqual(receive2.o(0).receivedMessage, ['bla', 888]);
        deepEqual(receivedOutside, ['bla', 888]);

        // Test changing name
        receive1.o(0).receivedMessage = undefined;
        receive1.setName('num1');
        send1.i(0).message('blop', 'blep', 'blup');
        equal(receive1.o(0).receivedMessage, undefined);
        send1.setName('num1');
        send1.i(0).message(1, 11, 111);
        deepEqual(receive1.o(0).receivedMessage, [1, 11, 111]);
    });

    test('list split', function() {
        var listSplit = new Pd.objects['list split'](null);
        listSplit.i(0).message('lolo', 12, 34);
        deepEqual(listSplit.o(0).receivedMessage, ['bang']);
        deepEqual(listSplit.o(1).receivedMessage, ['lolo', 12, 34]);
        equal(listSplit.o(2).receivedMessage, undefined);

        listSplit.i(1).message(3);
        listSplit.i(0).message(12, 34, 'popo');
        deepEqual(listSplit.o(0).receivedMessage, [12, 34, 'popo']);
        deepEqual(listSplit.o(1).receivedMessage, ['bang']);
        equal(listSplit.o(2).receivedMessage, undefined);

        listSplit.i(1).message(1);
        listSplit.i(0).message(45, 67, 78);
        deepEqual(listSplit.o(0).receivedMessage, [45]);
        deepEqual(listSplit.o(1).receivedMessage, [67, 78]);
        equal(listSplit.o(2).receivedMessage, undefined);

        listSplit.o(0).receivedMessage = undefined;
        listSplit.o(1).receivedMessage = undefined;
        listSplit.i(1).message(8);
        listSplit.i(0).message(45, 67, 78);
        equal(listSplit.o(0).receivedMessage, undefined);
        equal(listSplit.o(1).receivedMessage, undefined);
        deepEqual(listSplit.o(2).receivedMessage, ['bang']);
    });

});
