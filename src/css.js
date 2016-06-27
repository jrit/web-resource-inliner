"use strict";

var CleanCSS = require( "clean-css" );
var path = require( "path" );

var inline = require( "./util" );
var extend = require( "./util/extend" );
var isFunction = require( "./util/isFunction" );

module.exports = function( options, callback )
{
    options = extend( require( "./defaults" )(), options );

    function replace( search, replace ) {
        var re = new RegExp( "url\\(\\s?[\"']?(" +
            inline.escapeSpecialChars( search ) +
            ")[\"']?\\s?\\);([^\{\:]*)", "gi" );

        options.fileContent = options.fileContent.replace( re, function( origin, p1, p2 ) {
            if ( ( !options.images && p2.indexOf( options.inlineAttribute + " " ) !== -1 ) ||
                ( options.images && p2.indexOf( options.inlineAttribute + "-ignore " ) === -1 ) ) {
                return "url(\"" + replace + "\");" + p2;
            }

            return "url(\"" + p1 + "\");" + p2;
        } );

        return replace;
    }

    function search( re ) {
        var result = [],
            matches;

        while( ( matches = re.exec( options.fileContent ) ) !== null ) {
            result.push( matches.map( function( item ) {
                return item;
            } ) );
        }

        return result;
    }

    return new Promise( function( resolve ) {
        var urlRegex = /url\(\s?["']?([^)'"]+)["']?\s?\);/gi;

        resolve( search( urlRegex ).reduce( function( result, src ) {
            result[ src[1] ] = true;
            return result;
        }, {} ) );
    } ).then( function( matches ) {
        return Promise.all( Object.keys( matches ).map( function( src ) {
            return new Promise( function( resolve, reject ) {
                if ( inline.isBase64Path( src ) ) {
                    return resolve( src ); // Skip
                }

                // Rebase source
                if ( !inline.isRemotePath( src ) && options.rebaseRelativeTo ) {
                    src = replace( src, path.join( options.rebaseRelativeTo, src ).replace( /\\/g, "/" ) );
                }

                // Replace source
                return inline.getFileReplacement( src, options, function( err, content ) {
                    if ( err ) {
                        if ( options.strict ) {
                            return reject( err );
                        } else {
                            console.warn( "Not found, skipping: " + src  );
                            return resolve( src ); // Skip
                        }
                    }

                    if ( typeof( options.images ) === "number" &&
                        content.length > options.images * 1000 ) {
                        return resolve( src ); // Skip
                    }

                    src = replace( src, content );

                    return resolve( src );
                } );
            } );
        } ) );
    } ).then( function() {
        options.fileContent = options.cssmin ? CleanCSS.process( options.fileContent ) : options.fileContent;
        if ( isFunction( callback ) ) {
            callback( null, options.fileContent );
        }
        return options.fileContent;
    } ).catch( function( err ) {
        if ( isFunction( callback ) ) {
            callback( err );
        }
        return Promise.reject( err );
    } );
};
