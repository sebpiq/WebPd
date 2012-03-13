(function(){

    var Pd = this.Pd = {};

    /*
    Simple prototype inheritance. Used like so ::
        
        var ChildObject = function() {};

        Pd._extend({ChildObject.prototype, ParentObject.prototype,

            anOverridenMethod: function() {
                ParentObject.prototype.anOverridenMethod.apply(this, arguments);
                // do more stuff ...
            },

            aNewMethod: function() {
                // do stuff ...
            }

        });
    */
    Pd.extend = function(obj) {
        var sources = Array.prototype.slice.call(arguments, 1);
        for(var i=0; i<sources.length; i++) {
            var source = sources[i];
            for (var prop in source) {
                obj[prop] = source[prop];
            }
        }
        return obj;
    };

    Pd.notImplemented = function() { throw new Error('Not implemented !'); };

}).call(this);
