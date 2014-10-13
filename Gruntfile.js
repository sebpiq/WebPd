var fs = require('fs');

module.exports = function(grunt) {


    grunt.initConfig({
        pkg: '<json:package.json>',
        meta: {
            banner: '/*\n' +
                    ' * <%= pkg.name %> - v<%= pkg.version %>\n' +
                    ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
                    ' *\n' +
                    ' * BSD Simplified License.\n' +
                    ' * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n' +
                    ' * WARRANTIES, see the file, "LICENSE.txt," in this distribution.\n' +
                    ' *\n' +
                    ' * See <%= pkg.repository.url %> for documentation\n' +
                    ' *\n' +
                    ' */\n'
        },
        concat: {
            dist: {
                src: ['<banner>',
                    'lib/AudioContextMonkeyPatch.js',
                    'lib/eventemitter2/eventemitter2.js',
                    'lib/WebPd/main.js',
                    'lib/WebPd/audiodriver.js',
                    'lib/WebPd/portlets.js',
                    'lib/WebPd/objectbase.js',
                    'lib/WebPd/patch.js',
                    'lib/WebPd/objects.js',
                    'lib/WebPd/compat.js'],
                dest: 'dist/webpd-latest.js'
            }
        },
        uglify: {
            dist: {
                src: ['dist/webpd-latest.js'],
                dest: 'dist/webpd-latest.min.js'
            }
        },
        qunit: {
            all: ['test/*.html']
        }
    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-qunit');

    grunt.registerTask('default', ['test', 'concat', 'uglify']);

    grunt.registerTask('build', ['concat', 'uglify']);

    grunt.registerTask('test', 'qunit');

    // Task the CI server will execute
    grunt.registerTask('travis', 'build qunit');

    grunt.registerTask('release', ['concat', 'uglify', 'release-task']);
    grunt.registerTask('release-task', 'Make a new release, creates a git tag and a release file in "dist/"', function() {
        grunt.task.requires('concat');
        grunt.task.requires('uglify');

        var sys = require('sys'),
            exec = require('child_process').exec,
            done = this.async(),
            version = grunt.config('pkg.version'),
            fileMap = {
                'dist/webpd-latest.js': 'dist/webpd-' + version + '.js',
                'dist/webpd-latest.min.js': 'dist/webpd-' + version + '.min.js'
            },
            filename, data;

        // Copy files in dist
        for (filename in fileMap) {
            try {
                data = fs.readFileSync(filename);
            } catch (err) {
                grunt.fatal(err);
            }
            fs.writeFileSync(fileMap[filename], data);
            grunt.log.writeln('"' + fileMap[filename] + '" written');
        }

        // Make git tag
        exec('git tag -a v' + version + ' -m "' + version + ' release"', function (error, stdout, stderr) {
            if (error !== null) grunt.fatal(error);
            grunt.log.writeln('Git tag release version ' + version);
            grunt.log.writeln('Don\'t forget incrementing version number in "package.json"');
            done();
        });
    });

};
