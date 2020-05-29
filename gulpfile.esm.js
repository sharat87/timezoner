const gulp = require("gulp");
const less = require("gulp-less");
const cleanCss = require("gulp-clean-css");
const uglify = require("gulp-uglify-es").default;
const ejs = require("gulp-ejs");
const htmlMin = require("gulp-htmlmin");
const concat = require("gulp-concat");
const del = require("del");
const browserSync = require("browser-sync").create();

let isDev = false;

export function css() {
	return gulp.src("src/*.less", {sourcemaps: isDev})
		.pipe(less())
		.pipe(concat("all.css"))
		.pipe(cleanCss())
		.pipe(gulp.dest("dist", {sourcemaps: isDev}));
}

export function js() {
	return gulp.src("src/*.js", {sourcemaps: isDev})
		.pipe(concat("all.js"))
		.pipe(uglify())
		.pipe(gulp.dest("dist", {sourcemaps: isDev}));
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
		.pipe(htmlMin({
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

// export const start = gulp.series(build, gulp.parallel(watch, serve));
export function start() {
	isDev = true;
	return gulp.series(build, gulp.parallel(watch, serve))();
}

export default start;
