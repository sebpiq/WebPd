var path = require('path')
  , gulp = require('gulp')
  , rename = require('gulp-rename')
  , gutil = require('gulp-util')
  , browserify = require('browserify')
  , uglify = require('gulp-uglify')
  , runSequence = require('run-sequence')
  , source = require('vinyl-source-stream')

var libWatcher, browserTestWatcher

gulp.task('lib.browserify', function() {
  return browserify({ entries: './index.js' })
    .bundle()
    .on('error', gutil.log)
    .pipe(source('webpd-latest.js'))
    .pipe(gulp.dest('./dist'))
    .pipe(rename('lib-build.js'))
    .pipe(gulp.dest('./waatest'))
})

gulp.task('lib.uglify', function() {
  return gulp.src('./dist/webpd-latest.js')
    .pipe(uglify())
    .on('error', gutil.log)
    .pipe(rename('webpd-latest.min.js'))
    .pipe(gulp.dest('./dist'))
})

gulp.task('test.browser.browserify', function() {
  return browserify({ entries: './test/browser/index.js', debug: true })
    .bundle()
    .on('error', gutil.log)
    .pipe(source('test-build.js'))
    .pipe(gulp.dest('./waatest'))
})

gulp.task('test.browser.build', function(done) {
  libWatcher = gulp.watch(['*.js', './lib/**/*.js'], ['lib.browserify'])
  libWatcher.on('change', function(event) {
    console.log('File '+event.path+' was '+event.type+', running tasks...')
  })

  browserTestWatcher = gulp.watch(['./test/**/*.js', 'waatest/lib-build.js'], ['test.browser.browserify'])
  browserTestWatcher.on('change', function(event) {
    console.log('File '+event.path+' was '+event.type+', running tasks...')
  })

  runSequence('lib.browserify', 'test.browser.browserify', done)
})