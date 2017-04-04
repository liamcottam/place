var gulp = require('gulp');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var plumber = require('gulp-plumber');
var sass = require('gulp-sass');
var csso = require('gulp-csso');

/*
* Compile and minify sass
*/
gulp.task('sass', function() {
  gulp.src('src/styles/**/*.scss')
    .pipe(plumber())
    .pipe(sass())
    .pipe(csso())
    .pipe(gulp.dest('public/css'));
});

/**
 * Compile and minify js
 */
gulp.task('js', function(){
	return gulp.src('src/js/**/*.js')
		.pipe(plumber())
		.pipe(concat('app.js'))
		.pipe(uglify())
		.pipe(gulp.dest('public/js/'))
});


gulp.task('default', ['js', 'sass']);
