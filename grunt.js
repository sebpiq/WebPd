var fs = require('fs');

module.exports = function(grunt) {


    grunt.initConfig({
        lint: {
            all: ['grunt.js', 'lib/WebPd/*.js', 'test/*.js']
        },
        jshint: {
            options: {
                eqeqeq: true,
                quotmark: 'single',
                undef: false,       // TODO: This option prohibits the use of explicitly undeclared variables.
                unused: true,
                boss: true,        // This option suppresses warnings about the use of assignments in cases where comparisons are expected.
                sub: true,         // This option suppresses warnings about using [] notation when it can be expressed in dot notation.
                indent: 4
            }
        },
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
                src: ['<banner>', 'lib/sink/sink.js',
                    'lib/WebPd/main.js',
                    'lib/WebPd/audiodriver.js',
                    'lib/WebPd/portlets.js',
                    'lib/WebPd/objectbase.js',
                    'lib/WebPd/patch.js',
                    'lib/WebPd/objects.js',
                    'lib/WebPd/compat.js'],
                dest: 'dist/webpd-<%= pkg.version %>.js'
            }
        },
        min: {
            dist: {
                src: ['dist/webpd-<%= pkg.version %>.js'],
                dest: 'dist/webpd-<%= pkg.version %>.min.js'
            }
        },
        qunit: {
            all: ['test/*.html']
        }
    });

    grunt.registerTask('default', 'lint test concat min copy-latest');

    grunt.registerTask('test', 'qunit');

    grunt.registerTask('copy-latest', 'Copy the latest builds to "webpd-latest.js" and "webpd-latest.min.js".', function() {
        grunt.task.requires('concat');
        grunt.task.requires('min');

        var version = grunt.config('pkg.version'),
            fileMap = {
                'dist/webpd-latest.js': 'dist/webpd-' + version + '.js',
                'dist/webpd-latest.min.js': 'dist/webpd-' + version + '.min.js'
            },
            filename, data;

        for (filename in fileMap) {
            try {
                data = fs.readFileSync(fileMap[filename]);
            } catch (err) {
                grunt.fatal(err);
            }
            fs.writeFileSync(filename, data);
            grunt.log.writeln('"' + filename + '" written');
        }
    });

};
