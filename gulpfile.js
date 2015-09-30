var path = require('path')
  , gulp = require('gulp')
  , rename = require('gulp-rename')
  , gutil = require('gulp-util')
  , file = require('gulp-file')
  , browserify = require('browserify')
  , uglify = require('gulp-uglify')
  , mustache = require('mustache')
  , concat = require('gulp-concat')
  , contribs = require('gulp-contribs')
  , runSequence = require('run-sequence')
  , source = require('vinyl-source-stream')

var libWatcher, browserTestWatcher

gulp.task('lib.browserify', function() {
  return browserify({ entries: './index.js' })
    .bundle()
    .on('error', gutil.log)
    .pipe(source('webpd-latest.js'))
    .pipe(gulp.dest('./build'))
})

gulp.task('lib.concat', function() {
  return gulp.src(['./deps/AudioContextMonkeyPatch.js', './build/webpd-latest.js'])
    .pipe(concat('webpd-latest.js'))
    .pipe(gulp.dest('./dist'))
})

gulp.task('lib.build', function() {
  return runSequence('lib.browserify', 'lib.concat')
})

gulp.task('lib.uglify', function() {
  return gulp.src('./dist/webpd-latest.js')
    .pipe(uglify())
    .on('error', gutil.log)
    .pipe(rename('webpd-latest.min.js'))
    .pipe(gulp.dest('./dist'))
})

gulp.task('lib.objectList', function() {
  var library = {}
    , rendered
  require('./lib/index').declareObjects(library)
  rendered = mustache.render(
    '{{#objects}}- {{{.}}}\n{{/objects}}', 
    { objects: Object.keys(library).sort() }
  )

  return file('OBJECTLIST.md', rendered, { src: true })
    .pipe(gulp.dest('.'))
})

gulp.task('authors', function () {
  return gulp.src('AUTHORS.md')
    .pipe(contribs('Authors\n----------', '   '))
    .on('error', gutil.log)
    .pipe(gulp.dest('.'))
})

gulp.task('test.browser.copy', function(){
  return gulp.src('./dist/webpd-latest.js')
    .pipe(rename('lib-build.js'))
    .pipe(gulp.dest('./waatest'))
})

gulp.task('test.browser.browserify', function() {
  return browserify({ entries: './test/browser/index.js', debug: true })
    .bundle()
    .on('error', gutil.log)
    .pipe(source('test-build.js'))
    .pipe(gulp.dest('./waatest'))
})

gulp.task('test.browser.build', function(done) {
  libWatcher = gulp.watch(['*.js', './lib/**/*.js'], ['lib.build'])
  libWatcher.on('change', function(event) {
    console.log('File '+event.path+' was '+event.type+', running tasks...')
  })

  browserTestWatcher = gulp.watch(['./test/**/*.js', 'waatest/lib-build.js'], ['test.browser.browserify'])
  browserTestWatcher.on('change', function(event) {
    console.log('File '+event.path+' was '+event.type+', running tasks...')
  })

  return runSequence('lib.build', 'test.browser.browserify', done)
})