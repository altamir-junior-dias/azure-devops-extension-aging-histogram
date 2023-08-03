const del = require('del');
const exec = require('child_process').exec;
const eventStream = require('event-stream');
const gulp = require('gulp');

let changeFileName = (eventStream) => {
    return eventStream.map((file, callback) => {
        let filePath = file.path.substring(0, file.path.indexOf('src'));
        let fileName = file.path.substring(file.path.indexOf('src') + 4).split('\\').join('-');
        file.path = filePath + 'dist\\' + fileName;

        return callback(null, file)
    });
};

gulp.task('clean-dist', () => {
    return del('dist/**', { force: true });
});

gulp.task('clean-publish', () => {
    return del('publish/**', { force: true });
});

gulp.task('copy-html', () => {
    return gulp.src('src/**/*.html')
        .pipe(changeFileName(eventStream))
        .pipe(gulp.dest('dist'));
});

gulp.task('copy-js', () => {
    return gulp.src('src/**/*.js')
        .pipe(changeFileName(eventStream))
        .pipe(gulp.dest('dist'));
});

gulp.task('copy-libs', () => {
    return gulp.src('node_modules/chart.js/dist/**/*.js')
        .pipe(gulp.dest('dist/lib'));
});

gulp.task('create-extension-rev', (done) => {
    exec('tfx extension create --rev-version --manifests vss-extension.json --output-path ./publish', (err, stdOut, stdErr) => {
        console.log(stdOut);

        if (err){
            done(err);
        } else {
            done();
        }
    });
});

gulp.task('create-extension', (done) => {
    exec('tfx extension create --manifests vss-extension.json --output-path ./publish', (err, stdOut, stdErr) => {
        console.log(stdOut);

        if (err){
            done(err);
        } else {
            done();
        }
    });
});

gulp.task('default', gulp.series('clean-dist', 'copy-libs', 'copy-js', 'copy-html', 'clean-publish', 'create-extension-rev'));

gulp.task('pack', gulp.series('clean-dist', 'copy-libs', 'copy-js', 'copy-html', 'clean-publish', 'create-extension'));