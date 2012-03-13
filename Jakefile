var fs = require('fs');
var path = require('path');
var sys = require('sys');
var jsp = require("uglify-js").parser;
var pro = require("uglify-js").uglify;

task('default', [], function () {
    jake.Task['minify'].invoke();
});

task('concat', [], function () {
    var files = [
            'dependencies/sink.js',
            'src/main.js',
            'src/audiodriver.js',
            'src/objectbase.js',
            'src/patch.js',
            'src/objects.js'],
        filesLeft = files.length,
        pathName = '.',
        outFile = fs.openSync('pd.js', 'w+');

    files.forEach(function(fileName) {
        var fileName = path.join(pathName, fileName),
            contents = fs.readFileSync(fileName);
        fs.writeSync(outFile, contents.toString());
    });
    fs.closeSync(outFile);
    sys.puts('Written > pd.js');
});

task('minify', ['concat'], function() {
    var pathName = '.',
        outFile = fs.openSync('pd-min.js', 'w+');

    var fileName = path.join(pathName, 'pd.js'),
        contents = fs.readFileSync(fileName);
    var ast = jsp.parse(contents.toString());
    ast = pro.ast_mangle(ast);
    ast = pro.ast_squeeze(ast);
    fs.writeSync(outFile, pro.gen_code(ast));
    fs.closeSync(outFile);
    sys.puts('Written > pd-min.js');
});
