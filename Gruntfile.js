module.exports = function (grunt) {

    "use strict";

    var devScripts = [
        "libs/xeogl/xeogl.js",
        "libs/xeogl/pin.js",
        "libs/xeogl/annotation.js",
        "libs/xeogl/annotation-style.js",
        "js/xeometry.js"
    ];

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),
        PROJECT_NAME: "<%= pkg.name %>",
        ENGINE_VERSION: "<%= pkg.version %>",
        build_dir: "build/<%= ENGINE_VERSION %>",
        license: grunt.file.read("MIT-LICENSE"),

        concat: {
            options: {
                banner: grunt.file.read('BANNER'),
                footer: "xeometry.version=\"<%= ENGINE_VERSION %>\";",
                separator: ';',
                process: true
            },
            engine: {
                src: devScripts,
                dest: 'build/<%= PROJECT_NAME %>.js'
            }
        },

        uglify: {
            options: {
                report: "min",
                banner: grunt.file.read('BANNER')
            },
            engine: {
                files: {
                    "build/<%= PROJECT_NAME %>.min.js": "<%= concat.engine.dest %>"
                }
            }
        },

        clean: {
            tmp: "tmp/*.js",
            docs: ["docs/*"]
        },

        //yuidoc: {
        //    all: {
        //        name: '<%= pkg.name %>',
        //        description: '<%= pkg.description %>',
        //        version: '<%= pkg.version %>',
        //        url: '<%= pkg.homepage %>',
        //        options: {
        //            themedir: "yuiDocThemes/xeometry",
        //
        //            // Add paths here as we include more non-core components in API docs
        //            paths: [
        //                'src',
        //                'examples/js/animation',
        //                'examples/js/annotations',
        //                'examples/js/controls',
        //                'examples/js/effects',
        //                'examples/js/curves',
        //                'examples/js/generation',
        //                'examples/js/skyboxes',
        //                'examples/js/stories',
        //                'examples/js/geometry',
        //                'examples/js/marking',
        //                'examples/js/models',
        //                'examples/js/zspace',
        //                'examples/js/helpers'
        //            ],
        //
        //            outdir: './docs/',
        //            exclude: "renderer, utils, webgl"
        //        },
        //        logo: '../assets/images/logo.png'
        //    }
        //},

        copy: {
            minified: {
                src: 'build/<%= PROJECT_NAME %>.min.js',
                dest: '<%= build_dir %>/<%= PROJECT_NAME %>-<%= ENGINE_VERSION %>.min.js'
            },
            unminified: {
                src: 'build/<%= PROJECT_NAME %>.js',
                dest: '<%= build_dir %>/<%= PROJECT_NAME %>-<%= ENGINE_VERSION %>.js'
            }
        }
    });

    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks('grunt-contrib-copy');
    //grunt.loadNpmTasks("grunt-contrib-yuidoc");

    // Builds snapshot libs within build/latest
    // Run this when testing examples locally against your changes before committing them
    grunt.registerTask("snapshot", ["concat",  "uglify"]);

    // Build a package within ./build
    // Assigns the package the current version number that's defined in package.json
    grunt.registerTask("build", ["snapshot", "yuidoc", "copy"]);

    grunt.registerTask("default", "snapshot");
};
