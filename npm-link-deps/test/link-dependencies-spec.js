var should      = require( 'should' );
var sinon       = require( 'sinon' );
var _           = require( 'lodash' );
var uuid        = require( 'node-uuid' );
var proxyquire  = require( 'proxyquire' ).noCallThru();

// Configure proxyquire stubs
var LN_DEPS_MOD_PATH = '../lib/link-dependencies';

// Proxyquire stub for happy-path through the module
var defaultStub = {
    path: {
        resolve: function ( path ) { return path }
    },
    fs: {
        existsSync: function () { return true }
    },
    mkdirp: {
        sync: _.noop
    },

    // Parsing package paths should resolve to an array
    'fake-pkg-path':    {  linkDependencies: [] },
    'package.json':     {  linkDependencies: [] }
};

// Return the stub, but allow for overrides
var getProxyStub = function ( overrides ) {
    return _.assign( {}, defaultStub, overrides );
};

// Spec
describe( 'link-dependencies', function () {

    describe( 'package file validation', function () {

        // Bad package path
        it( 'errors if the package path is invalid', function () {
            var stub = getProxyStub( { fs: { existsSync: function () { return false } } } );
            var lnDeps = proxyquire( LN_DEPS_MOD_PATH, stub );
            lnDeps.bind( null, 'fake-pkg-path' ).should.throw( 'Invalid package path: fake-pkg-path' );
        } );

        // Malformed package JSON
        it( 'errors if it has trouble parsing the package file', function () {
            var UNLIKELY_FILENAME = uuid.v4();
            var ERR_MSG_PATTERN = new RegExp( 'Error parsing package file "' + UNLIKELY_FILENAME + '": .*' );

            var stub = getProxyStub( { path: { resolve: function () { return UNLIKELY_FILENAME } } } );
            var lnDeps = proxyquire( LN_DEPS_MOD_PATH, stub );

            lnDeps.bind().should.throw( ERR_MSG_PATTERN );
        } );
    } );

    describe( 'link dependencies validation', function () {

        // Missing dependency list
        it( 'warns if `linkDependencies` is not found in the package.json file', function () {
            var WARN_MSG = '`linkDependencies` not found in fake-pkg-path. No dependencies will be linked.';

            var stub = getProxyStub( { 'fake-pkg-path': { linkDependencies: null } } );
            var lnDeps = proxyquire( LN_DEPS_MOD_PATH, stub );

            var consoleWarnStub = sinon.stub( global.console, 'warn' );

            lnDeps( 'fake-pkg-path' );

            consoleWarnStub.calledWith( WARN_MSG ).should.be.true;
            consoleWarnStub.calledOnce.should.be.true;
            consoleWarnStub.reset();
        } );

        // Mis-typed dependency list
        it( 'errors if `linkDependencies` is not an array', function () {
            var ERR_MSG = '`linkDependencies` needs to be an array of module paths in fake-pkg-path';
            var stub = getProxyStub( {
                'fake-pkg-path': { linkDependencies: true },
                _: { isArray: function () { return false } }
            } );
            var lnDeps = proxyquire( LN_DEPS_MOD_PATH, stub );
            lnDeps.bind( null, 'fake-pkg-path' ).should.throw( ERR_MSG );
        } );
    } );

    describe( 'output directory handling', function () {

        // node_modules destination directory
        it( 'resolves and creates a node_module directory', function () {
            var pathResolveSpy = sinon.spy( getProxyStub().path.resolve );
            var mkdirpSpy = sinon.spy( getProxyStub().mkdirp.sync );

            var stub = getProxyStub( {
                path: { resolve: pathResolveSpy },
                mkdirp: { sync: mkdirpSpy }
            } );

            var lnDeps = proxyquire( LN_DEPS_MOD_PATH, stub );
            lnDeps();

            pathResolveSpy.calledWith( 'node_modules' ).should.be.true;
            mkdirpSpy.calledAfter( pathResolveSpy );
            mkdirpSpy.calledWith( 'node_modules' ).should.be.true;
            mkdirpSpy.calledOnce.should.be.true;
        } );
    } );

    describe( 'link and unlink', function () {

        // Link deps
        it( 'links the specified dependencies', function () {
            var lnModSpy = sinon.spy();
            var stub = getProxyStub( {
                './link-module': lnModSpy
            } );
            var lnDeps = proxyquire( LN_DEPS_MOD_PATH, stub );
            lnDeps();
            lnModSpy.calledWith( [], 'node_modules', false ).should.be.true;
            lnModSpy.calledOnce.should.be.true;
        } );

        // Unlink deps
        it( 'unlinks the specified dependencies', function () {
            var pathJoinSpy = sinon.spy( function () { return 'path-join-return' } );
            var pathResolveSpy  = sinon.spy( function ( path ) {
                if ( path === 'fake-pkg-path' || path === 'node_modules' ) return path;
                return 'fake-mod-path/package.json'
            } );
            var rmSpy = sinon.spy();

            var stub = getProxyStub( {
                path: {
                    join: pathJoinSpy,
                    resolve: pathResolveSpy
                },
                rimraf: {
                    sync: rmSpy
                },
                'fake-pkg-path': {
                    linkDependencies: [ 'fake-mod-path' ]
                },
                'fake-mod-path/package.json': {
                    name: 'fake-mod-name'
                }
            } );
            var lnDeps = proxyquire( LN_DEPS_MOD_PATH, stub );
            lnDeps( 'fake-pkg-path', true );

            pathJoinSpy.calledWith( 'fake-mod-path', 'package.json' ).should.be.true;
            pathJoinSpy.calledWith( 'node_modules', 'fake-mod-name' ).should.be.true;
            pathJoinSpy.calledTwice.should.be.true;

            pathResolveSpy.calledWith( 'node_modules' ).should.be.true;
            pathResolveSpy.calledWith( 'path-join-return' ).should.be.true;
            pathResolveSpy.calledThrice.should.be.true;

            rmSpy.calledWith( 'path-join-return' ).should.be.true;
            rmSpy.calledOnce.should.be.true;
        } );

        // Unlink deps bad package
        it( '...unless there is an error parsing a dependencie\'s package.json', function () {
            var UNLIKELY_FILENAME = uuid.v4();
            var ERR_MSG_PATTERN = new RegExp( 'Error parsing name from package file ' + UNLIKELY_FILENAME + ': .*' );

            var pathJoinSpy = sinon.spy( function () { return 'path-join-return' } );
            var pathResolveSpy  = sinon.spy( function ( path ) {
                if ( path === 'fake-pkg-path' || path === 'node_modules' ) return path;
                return UNLIKELY_FILENAME;
            } );

            var stub = getProxyStub( {
                path: {
                    join: pathJoinSpy,
                    resolve: pathResolveSpy
                },
                'fake-pkg-path': {
                    linkDependencies: [ 'fake-mod-path' ]
                }
            } );

            var lnDeps = proxyquire( LN_DEPS_MOD_PATH, stub );
            lnDeps.bind( null, 'fake-pkg-path', true ).should.throw();

            pathJoinSpy.calledWith( 'fake-mod-path', 'package.json' ).should.be.true;
            pathJoinSpy.calledOnce.should.be.true;
        } );
    } );
} );
