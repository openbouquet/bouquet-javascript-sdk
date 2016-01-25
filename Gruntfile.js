module.exports = function(grunt) {
    grunt.initConfig({
        clean : {
            all : "dist/"
        },
        jshint : {
            all : [ 'src/*.js' ]
        },
        concat : {
            options : {
                stripBanners : true,
            },
            all : {
                src : [ 'src/squid_api_core.js',
                        'src/squid_api_models.js',
                        'src/squid_api_utils.js',
                        'src/squid_api_analysisjob_controller.js',
                        'src/squid_api_facetjob_controller.js' ],
                dest : 'dist/squid_api.js',
            }
        },
        watch : {
            js : {
                files : [ 'src/**/*.*' ],
                tasks : [ 'default' ]
            }
        }
    });
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-bower-concat');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask('dev', [ 'jshint' ]);
    grunt.registerTask('default', [ 'jshint', 'clean', 'concat' ]);
};
