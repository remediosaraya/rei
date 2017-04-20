var fs      = require( 'fs' );
var path    = require( 'path' );
var _       = require( 'lodash' );
var mkdirp  = require( 'mkdirp' );
var rimraf  = require( 'rimraf' );
var ln      = require( './link-module' );

/**
 * Direct link (or unlink) the modules in the `linkDependencies` field of the
 * specified package.json file to the ./node-modules directory.
 *
 * @param {string} pkgPath - Path to the package.json file where the `linkDependencies` are [ default: "./package.json" ]
 * @param {boolean} unlink - Unlink the `linkDependencies` from ./node_modules instead [ default: false]
 * @param {boolean} force - Overwrite existing links and ignore unlink errors [ default: false ]
 */
module.exports = function ( pkgPath, unlink, force ) {

    // Collect and set default params
    unlink  = unlink    || false;
    force   = force     || false;
    pkgPath = path.resolve( pkgPath || 'package.json' );

    // Make sure package file exists
    if( !fs.existsSync( pkgPath ) ) {
        throw new Error( 'Invalid package path: ' + pkgPath );
    }

    // Grab the dependency list from the 'linkDependencies' properties
    try {
        var pkg = require( pkgPath )
    } catch ( e ) {
        throw new Error( 'Error parsing package file "' + pkgPath + '": ' + e );
    }
    var deps = pkg.linkDependencies;

    if( !deps ) {
        console.warn( '`linkDependencies` not found in ' + pkgPath + '. No dependencies will be linked.' );
        return;
    } else if ( !_.isArray( deps ) ) {
        throw new Error( '`linkDependencies` needs to be an array of module paths in ' + pkgPath );
    }

    // Find the sibling 'node_modules' directory, create it if it doesn't exist
    var nodeModulePath = path.resolve( 'node_modules' );
    mkdirp.sync( nodeModulePath );

    // Link (or unlink) each dependency
    if ( unlink ) {
        deps.forEach( function ( dep ) {
            var depPkgPath = path.resolve( path.join( dep, 'package.json' ) );
            try {
                var depName = require( depPkgPath ).name;
            } catch ( e ) {
                if ( !force ) {
                    throw new Error( 'Error parsing name from package file ' + depPkgPath + ': ' + e );
                }
            }
            rimraf.sync( path.join( nodeModulePath, depName ) );
        } );
    } else {
        ln( deps, nodeModulePath, force );
    }
};
