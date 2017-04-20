var fs      = require( 'fs' );
var path    = require( 'path' );

/**
 * Make a link from the `src` module(s) to the `dest` directory, a la
 * `npm link`, but without creating a symlink in global scope.
 *
 * @param {string} src - Path or array of paths to the source module directory
 * @param {string} dest - Path to destination directory
 * @param {boolean} force - Overwrite target file if it exists [ default: false ]
 */
 var make = function ( src, dest, force ) {

    // Check param number
    if ( !src || !dest ) {
        throw new Error( 'Two parameters required: The source module directory path to link, and the destination directory.' );
    }

    // Check param types
    var srcIsString     = typeof src === 'string';
    var srcIsArray      = src instanceof Array;
    var destIsString    = typeof dest === 'string';

    if ( !( srcIsString || srcIsArray ) || !destIsString ){
        throw new Error( 'Parameter type mismatch: `src` must be a path (string) or an array of paths, and `dest` must be a path.' );
    }

    // If source is an array, recursively call `create` for each path, and
    // short-curcuit the rest of the calling function
    if ( srcIsArray ){
        src.forEach( function ( s ) {
            if ( typeof s !== 'string' ) {
                throw new Error( 'Invalid source path encountered. All paths in the `src` array must be paths (strings).' );
            }
            make( s, dest, force );
        } );
        return;
    }

    // Check source path
    var srcPath = path.resolve( src );

    if ( !fs.existsSync( srcPath ) ) {
        throw new Error( 'Source directory "' + srcPath + '" does not exist.' );
    }

    if( !fs.lstatSync( srcPath ).isDirectory() ){
        throw new Error( 'The source path must be a directory.' );
    }

    // Check package.json
    var pkgPath = path.join( srcPath, 'package.json' );

    try {
        var pkg = require( pkgPath );
    } catch ( e ) {
        throw new Error( 'Error parsing package.json of ' + srcPath );
    }

    var name = pkg.name;

    if ( !name ) {
        throw new Error( 'Missing module name in package.json of ' + srcPath  );
    }

    // Check destination path
    var destPath = path.resolve( dest );

    if ( !fs.existsSync( destPath ) ) {
        throw new Error( 'Destination directory "' + destPath + '" does not exist.' );
    }

    if( !fs.lstatSync( destPath ).isDirectory() ){
        throw new Error( 'The destination path must be a directory.' );
    }

    // Generate target path, remove target if it exists and `force` is set
    var targetPath = path.join( destPath, name );

    // Try creating the directory symlink ("junction" in Windows)
    try {
        fs.symlinkSync( srcPath, targetPath, 'junction' );
    } catch ( err ) {

        // If that fails for an existance-type reason and `force` is set, delete and try again
        if ( force && ( err.code === 'ENOTEMPTY' || err.code === 'EEXIST' ) ) {
            fs.unlinkSync( targetPath );
            fs.symlinkSync( srcPath, targetPath, 'junction' );
        } else {
            throw new Error( 'Target file "' + targetPath + '" exists. Set the `force` flag to overwrite.' );
        }
    }
};

// Expose public API
module.exports = make;
