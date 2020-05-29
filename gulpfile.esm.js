const gulp = require('gulp');
const less = require('gulp-less');
const cleanCss = require('gulp-clean-css');
const uglify = require('gulp-uglify-es').default;
const ejs = require('gulp-ejs');
const htmlmin = require("gulp-htmlmin");
const concat = require('gulp-concat');
const sourcemaps = require('gulp-sourcemaps');
const del = require('del');
const browserSync = require('browser-sync').create();

export function css() {
	return gulp.src("src/*.less")
		.pipe(sourcemaps.init())
		.pipe(less())
		.pipe(concat("all.css"))
		.pipe(sourcemaps.write())
		.pipe(cleanCss())
		.pipe(gulp.dest("dist"));
}

export function js() {
	return gulp.src("src/*.js")
		.pipe(sourcemaps.init())
		.pipe(concat("all.js"))
		.pipe(uglify())
		.pipe(sourcemaps.write())
		.pipe(gulp.dest("dist"));
}

export function html() {
	return gulp.src("src/*.html")
		.pipe(ejs({
			js: [
				"all.js",
			],
			css: [
				"all.css",
				"https://fonts.googleapis.com/css?family=Lato&display=swap",
			],
		}))
		.pipe(htmlmin({
			collapseWhitespace: true,
		}))
		.pipe(gulp.dest("dist"));
}

export function assets() {
	return gulp.src("src/*.txt")
		.pipe(gulp.dest("dist"));
}

export function clean() {
	return del(["dist"]);
}

export function watch() {
	gulp.watch("src/*.less", css);
	gulp.watch("src/*.js", js);
	gulp.watch("src/*.html", html);
	gulp.watch("src/*.txt", assets);
}

export function serve() {
	watch();

	gulp.watch(["dist/**"]).on("change", browserSync.reload);

	browserSync.init({
		server: "dist",
		open: false,
	});
}

export const build = gulp.series(clean, gulp.parallel(css, js, html, assets));

export const start = gulp.series(build, gulp.parallel(watch, serve));

export default serve;
