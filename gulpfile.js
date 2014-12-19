var path = require('path')
  , gulp = require('gulp')
  , gutil = require('gulp-util')
  , browserify = require('browserify')
  , runSequence = require('run-sequence')
  , source = require('vinyl-source-stream')

var libWatcher = gulp.watch(['*.js', './lib/**/*.js'], ['lib:browserify'])
libWatcher.on('change', function(event) {
  console.log('File '+event.path+' was '+event.type+', running tasks...')
})

var browserTestWatcher = gulp.watch(['./test/**/*.js'], ['test.browser:browserify'])
browserTestWatcher.on('change', function(event) {
  console.log('File '+event.path+' was '+event.type+', running tasks...')
})

gulp.task('test.browser:browserify', function() {
  return browserify({ entries: './test/browser/index.js' })
    .bundle()
    .on('error', gutil.log)
    .pipe(source('all-tests.js'))
    .pipe(gulp.dest('./test/browser'))
})

gulp.task('lib:browserify', function() {
  return browserify({ entries: './index.js' })
    .bundle()
    .on('error', gutil.log)
    .pipe(source('webpd-latest.js'))
    .pipe(gulp.dest('./dist'))
    .pipe(gulp.dest('./test/browser'))
})

gulp.task('test.browser:build', function(done) {
  runSequence('lib:browserify', 'test.browser:browserify', done)
})