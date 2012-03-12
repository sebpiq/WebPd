var fs = require('fs');
var path = require('path');
var sys = require('sys');

task('default', [], function () {
    jake.Task['concat'].invoke();
});

task('concat', [], function () {
    var files = ['dependencies/sink.js', 'src/audiodriver.js', 'src/objects.js'],
        filesLeft = files.length,
        pathName = '.',
        outFile = fs.openSync('pd.js', 'w+');

    files.forEach(function(fileName) {
        var fileName = path.join(pathName, fileName),
            contents = fs.readFileSync(fileName);
        sys.puts('Read: ' + contents.length + ', written: ' + fs.writeSync(outFile, contents.toString()));
    });
    fs.closeSync(outFile);    
});
