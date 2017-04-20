/**
 * Test spec for the module-link module
 *
 * TODO: Use mocks and proxies to unit test this module instead of fixtures and targets on the filesystem
 */
var fs      = require( 'fs' );
var path    = require( 'path' );
var _       = require( 'lodash' );
var should  = require( 'should' );
var mkdirp  = require( 'mkdirp' );
var rimraf  = require( 'rimraf' );
var ln      = require( '../lib/link-module' );

var FIXTURE_ROOT = path.join( __dirname, 'fixtures' );
var TARGET_ROOT  = path.join( __dirname, 'target' );

var TEST_FILE               = path.join( FIXTURE_ROOT, 'blank-file' );
var FAKE_FILE               = path.join( FIXTURE_ROOT, 'foo-bar-harp-derp' );
var TEST_MODULE_NO_PACKAGE  = path.join( FIXTURE_ROOT, 'test-module-no-package' );
var TEST_MODULE_BAD_PACKAGE = path.join( FIXTURE_ROOT, 'test-module-bad-package' );
var TEST_MODULE_NO_NAME     = path.join( FIXTURE_ROOT, 'test-module-no-name' );

var TEST_MODULES = [];
for ( var i = 0; i < 3; ++i ) {
    TEST_MODULES.push( {
        dir: path.join( FIXTURE_ROOT, 'test-module-' + i ),
        name: 'my-module-' + i
    } )
}

var resetTargetDir = function () {
    rimraf.sync( TARGET_ROOT );
    mkdirp.sync( TARGET_ROOT );
};

describe( 'link-module', function () {

    describe( 'parameter validation', function () {

        it( 'requires two arguments', function () {
            var PARAM_ERR = 'Two parameters required: The source module directory path to link, and the destination directory.';
            ln.bind( null ).should.throw( PARAM_ERR );                 // No params
            ln.bind( null, 'foo' ).should.throw( PARAM_ERR );          // Just src
            ln.bind( null, null, 'foo' ).should.throw( PARAM_ERR );    // Just dest
        } );

        it( 'requires `src` to be a string or an array, and `dest` to be a string', function () {
            var PARAM_TYPE_ERR = 'Parameter type mismatch: `src` must be a path (string) or an array of paths, and `dest` must be a path.';
            ln.bind( null, {}, TARGET_ROOT ).should.throw( PARAM_TYPE_ERR );
            ln.bind( null, new Boolean(), TARGET_ROOT ).should.throw( PARAM_TYPE_ERR );
            ln.bind( null, new Number(), TARGET_ROOT ).should.throw( PARAM_TYPE_ERR );
            ln.bind( null, new Function(), TARGET_ROOT ).should.throw( PARAM_TYPE_ERR );

            ln.bind( null, TARGET_ROOT, {}, true ).should.throw( PARAM_TYPE_ERR );
            ln.bind( null, TARGET_ROOT, [], true ).should.throw( PARAM_TYPE_ERR );
            ln.bind( null, TARGET_ROOT, new Boolean(), true ).should.throw( PARAM_TYPE_ERR );
            ln.bind( null, TARGET_ROOT, new Number(), true ).should.throw( PARAM_TYPE_ERR );
            ln.bind( null, TARGET_ROOT, new Function(), true ).should.throw( PARAM_TYPE_ERR );
        } );

        it( 'requires that the source directory exists', function () {
            ln.bind( null, FAKE_FILE, TARGET_ROOT )
                .should
                .throw( 'Source directory "' + path.resolve( FAKE_FILE ) + '" does not exist.' );
        } );

        it( 'requires that the source file is a directory', function () {
            ln.bind( null, TEST_FILE, TARGET_ROOT )
                .should.throw( 'The source path must be a directory.' );
        } );

        it( 'requires that the destination directory exists', function () {
            ln.bind( null, TEST_MODULES[ 0 ].dir, FAKE_FILE )
                .should
                .throw( 'Destination directory "' + path.resolve( FAKE_FILE ) + '" does not exist.' );
        } );

        it( 'requires that the destination path is a directory', function () {
            ln.bind( null, TEST_MODULES[ 0 ].dir, TEST_FILE )
                .should
                .throw( 'The destination path must be a directory.' );
        } );
    } );

    describe( 'module validation', function () {

        it( 'requires there be a valid package.json file in the module directory', function () {
            ln.bind( null, TEST_MODULE_NO_PACKAGE, TARGET_ROOT )
                .should
                .throw( 'Error parsing package.json of ' + path.resolve( TEST_MODULE_NO_PACKAGE ) );
            ln.bind( null, TEST_MODULE_BAD_PACKAGE, TARGET_ROOT )
                .should
                .throw( 'Error parsing package.json of ' + path.resolve( TEST_MODULE_BAD_PACKAGE ) );
        });

        it( 'requires the package have a name', function () {
            ln.bind( null, TEST_MODULE_NO_NAME, TARGET_ROOT )
                .should
                .throw( 'Missing module name in package.json of ' + path.resolve( TEST_MODULE_NO_NAME ) );
        } );
    } );

    describe( 'single-module linking', function () {

        it( 'will create a source directory symlink in the destination directory', function () {
            resetTargetDir();
            ln( TEST_MODULES[ 0 ].dir, TARGET_ROOT );

            var symlinkPath = path.join( TARGET_ROOT, TEST_MODULES[ 0 ].name );
            fs.existsSync( symlinkPath ).should.be.true;
            fs.lstatSync( symlinkPath ).isSymbolicLink().should.be.true;
        } );

        it( '...but will complain if the file already exists', function () {
            var TARGET_PATH = path.join( TARGET_ROOT, TEST_MODULES[ 0 ].name );
            resetTargetDir();
            ln( TEST_MODULES[ 0 ].dir, TARGET_ROOT );
            ln.bind( null, TEST_MODULES[ 0 ].dir, TARGET_ROOT )
                .should
                .throw( 'Target file "' + TARGET_PATH + '" exists. Set the `force` flag to overwrite.' );
        } );

        it( '...unless the `force` flag is set', function () {
            resetTargetDir();
            ln( TEST_MODULES[ 0 ].dir, TARGET_ROOT );
            ln.bind( null, TEST_MODULES[ 0 ].dir, TARGET_ROOT, true ).should.not.throw();

            var symlinkPath = path.join( TARGET_ROOT, TEST_MODULES[ 0 ].name );
            fs.existsSync( symlinkPath ).should.be.true;
            fs.lstatSync( symlinkPath ).isSymbolicLink().should.be.true;
        } );
    } );

    describe( 'multi-module linking', function () {

        it( 'will also create module symlinks given an array of source directory paths', function () {
            var testModuleDirs = _.map( TEST_MODULES, function ( testMod ) {
                return testMod.dir
            } );

            resetTargetDir();
            ln( testModuleDirs, TARGET_ROOT );

            _.forEach( TEST_MODULES, function( module ) {
                var symlinkPath = path.join( TARGET_ROOT, module.name );
                fs.existsSync( symlinkPath ).should.be.true;
                fs.lstatSync( symlinkPath ).isSymbolicLink().should.be.true;
            } );
        } );

        it( '...but will complain if a source directory element is not a string', function () {
            ln.bind( null, [ {} ], TARGET_ROOT )
                .should
                .throw('Invalid source path encountered. All paths in the `src` array must be paths (strings).');
        } );
    } );
} );
