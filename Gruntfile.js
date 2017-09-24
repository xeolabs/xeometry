module.exports = function (grunt) {

    "use strict";

    var devScripts = [
        "libs/xeogl/xeogl.js",
        "libs/xeogl/geometry/vectorTextGeometry.js",
        "libs/xeogl/helpers/clipHelper.js",
        "libs/xeogl/annotations/pin.js",
        "libs/xeogl/annotations/annotation.js",
        "libs/xeogl/annotations/annotation-style.js",
        "libs/xeogl/models/glTFModel.js",
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

        documentation: {
            default: {
                files: [{
                    "expand": true,
                    "cwd": "js",
                    "src": ["**/*.js"]
                }],
                options: {
                    destination: "docs"
                }
            }
        },

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
    grunt.loadNpmTasks('grunt-documentation');

    // Builds snapshot libs within build/latest
    // Run this when testing examples locally against your changes before committing them
    grunt.registerTask("snapshot", ["concat",  "uglify"]);

    // Build a package within ./build
    // Assigns the package the current version number that's defined in package.json
    grunt.registerTask("build", ["snapshot", "yuidoc", "copy"]);

    grunt.registerTask("default", "snapshot");
};
