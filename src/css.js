"use strict";

var CleanCSS = require( "clean-css" );
var path = require( "path" );

var search = require( "./util/search" );
var isFunction = require( "./util/isFunction" );
var isBase64Path = require( "./util/isBase64Path" );
var isRemotePath = require( "./util/isRemotePath" );
var escapeSpecialChars = require( "./util/escapeSpecialChars" );
var getFileReplacement = require( "./util/getFileReplacement" );

module.exports = function( options, callback )
{
    options = require( "./options" )( options );

    function replace( search, replace ) {
        var re = new RegExp( "url\\(\\s?[\"']?(" +
            escapeSpecialChars( search ) +
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

    var promise = new Promise( function( resolve, reject ) {
        if ( !options.fileContent ) {
            return reject( new Error( "No file content" ) );
        }

        return resolve( search(
            /url\(\s?["']?([^)'"]+)["']?\s?\);/gi,
            options.fileContent
        ).reduce( function( result, src ) {
            if ( !result[ src[1] ] ) {
                result[ src[1] ] = [ src[0] ];
            } else {
                result[ src[1] ].push( src[0] );
            }
            return result;
        }, {} ) );
    } ).then( function( matches ) {
        return Promise.all( Object.keys( matches ).map( function( src ) {
            if ( isBase64Path( src ) ) {
                return Promise.resolve(); // Skip
            }

            return new Promise( function( resolve, reject ) {
                var origin = src;
                if ( !isRemotePath( src ) && options.rebaseRelativeTo ) {
                    origin = path.join( options.rebaseRelativeTo, src ).replace( /\\/g, "/" );
                }

                // Replace source
                return getFileReplacement( origin, options, function( err, content ) {
                    if ( err ) {
                        if ( options.strict ) {
                            return reject( err );
                        } else {
                            console.warn( "Not found, skipping: " + src  );
                            return resolve(); // Skip
                        }
                    }
                    resolve( content );
                } );
            } ).then( function( content ) {
                if ( !content || typeof( options.images ) === "number" &&
                    content.length > options.images * 1000 ) {
                    return; // Skip
                }
                return replace( src, content );
            } );
        } ) );
    } ).then( function() {
        options.fileContent = options.cssmin ? CleanCSS.process( options.fileContent ) : options.fileContent;
        if ( isFunction( callback ) ) {
            callback( null, options.fileContent );
        }
        return options.fileContent;
    } ).catch( function( err ) {
        console.log( err ); //#Debug
        if ( isFunction( callback ) ) {
            callback( err );
        }
        return Promise.reject( err );
    } );

    if ( !isFunction( callback ) ) {
        return promise;
    }
};
