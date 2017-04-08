var gulp = require('gulp');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var plumber = require('gulp-plumber');
var sass = require('gulp-sass');
var csso = require('gulp-csso');

/*
* Compile and minify sass
*/
gulp.task('sass', function () {
  gulp.src('src/styles/style.scss')
    .pipe(plumber())
    .pipe(sass())
    .pipe(csso())
    .pipe(gulp.dest('public/css'));

  gulp.src('src/styles/admin.scss')
    .pipe(plumber())
    .pipe(sass())
    .pipe(csso())
    .pipe(gulp.dest('public/css'));
});

/**
 * Compile and minify js
 */
gulp.task('js', function () {
  gulp.src('src/js/app.js')
    .pipe(plumber())
    .pipe(concat('app.js'))
    .pipe(uglify())
    .pipe(gulp.dest('public/js/'));

  gulp.src('src/js/mod_tools.js')
    .pipe(plumber())
    .pipe(concat('mod_tools.js'))
    .pipe(uglify())
    .pipe(gulp.dest('public/js/'));

  gulp.src('src/js/admin.js')
    .pipe(plumber())
    .pipe(concat('admin.js'))
    .pipe(uglify())
    .pipe(gulp.dest('public/js/'));
});

gulp.task('watch', function () {
  gulp.watch('src/js/*.js', function (event) {
    gulp.run('js');
  });

  gulp.watch('src/styles/*.scss', function (event) {
    gulp.run('sass');
  });
});


gulp.task('default', ['js', 'sass', 'watch']);
