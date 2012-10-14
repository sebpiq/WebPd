$(document).ready(function() {

    var MyNamedObject = Pd.NamedObject.extend({
        init: function(name) { this.setName(name); },
        type: 'namedObj'
    });

    var MyUNamedObject = Pd.UniquelyNamedObject.extend({
        init: function(name) { this.setName(name); },
        type: 'uniqNamedObj'
    });


    module('Pd.NamedObject', {
        teardown: function() {
            Pd._namedObjects = {};
        }
    });

    test('Pd.getNamedObject', function() {
        var obj1A = new MyNamedObject(null, ['obj1']),
            obj1B = new MyNamedObject(null, ['obj1'])
            obj2 = new MyNamedObject(null, ['obj2']),
            query1 = Pd.getNamedObject('namedObj', 'obj1'),
            query2 = Pd.getNamedObject('namedObj', 'obj2'),
            query3 = Pd.getNamedObject('namedObj', 'obj3');
        Pd.register(obj2); // this shouldn't change anything.

        equal(query1.length, 2);
        equal(query1[0], obj1A);
        equal(query1[1], obj1B);
        equal(query2.length, 1);
        equal(query2[0], obj2);
        equal(query3.length, 0);
    });

    test('change name', function() {
        var obj = new MyNamedObject(null, ['obj1']),
            query = Pd.getNamedObject('namedObj', 'obj1');

        equal(query.length, 1);
        equal(query[0], obj);

        obj.setName('objONE');
        query = Pd.getNamedObject('namedObj', 'obj1');
        equal(query.length, 0);
        query = Pd.getNamedObject('namedObj', 'objONE');
        equal(query.length, 1);
        equal(query[0], obj);
    });
    

    module('Pd.UniquelyNamedObject', {
        teardown: function() {
            Pd._namedObjects = {};
        }
    });

    test('Pd.getUniquelyNamedObject', function() {
        var obj1 = new MyUNamedObject(null, ['obj1']),
            obj2 = new MyUNamedObject(null, ['obj2']),
            query1 = Pd.getUniquelyNamedObject('uniqNamedObj', 'obj1'),
            query2 = Pd.getUniquelyNamedObject('uniqNamedObj', 'obj2'),
            query3 = Pd.getUniquelyNamedObject('uniqNamedObj', 'obj3');
        Pd.register(obj1); // this shouldn't change anything.

        equal(query1, obj1);
        equal(query2, obj2);
        equal(query3, null);
        raises(function() {
            new MyUNamedObject(null, ['obj1']);
        });
    });

    test('change name', function() {
        var obj = new MyNamedObject(null, ['obj1']),
            query = Pd.getNamedObject('namedObj', 'obj1');

        equal(query.length, 1);
        equal(query[0], obj);

        obj.setName('objONE');
        query = Pd.getNamedObject('namedObj', 'obj1');
        equal(query.length, 0);
        query = Pd.getNamedObject('namedObj', 'objONE');
        equal(query.length, 1);
        equal(query[0], obj);
    });

});
