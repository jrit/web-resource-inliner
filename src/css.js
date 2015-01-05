"use strict";


var datauri = require( "datauri" );
var CleanCSS = require( "clean-css" );
var xtend = require( "xtend" );
var async = require( "async" );
var inline = require( "./util" );

module.exports = function( options, callback )
{
    var settings = xtend( {}, inline.defaults, options );

    var replaceUrl = function( callback )
    {
        var args = this;

        if( inline.isBase64Path( args.src ) )
        {
            return callback( null ); // skip
        }

        inline.getFileReplacement( args.src, settings.relativeTo, function( err, datauriContent )
        {
            if( err )
            {
                return( callback( err ) );
            }
            if( typeof( args.limit ) === "number" && datauriContent.length > args.limit * 1000 )
            {
                return( callback( null ) ); // skip
            }

            var css = 'url("' + datauriContent + '");';
            result = result.replace( new RegExp( "url\\(\\s?[\"']?(" + args.src + ")[\"']?\\s?\\);", "g" ), css );
            return( callback( null ) );
        } );
    };

    var result = settings.fileContent;
    var tasks = [];
    var found = null;

    var urlRegex = /url\(\s?["']?([^)'"]+)["']?\s?\);.*/gi;
    while( ( found = urlRegex.exec( result ) ) !== null )
    {
        if( !found[ 0 ].match( new RegExp( "\\/\\*\\s?" + settings.inlineAttribute + "-ignore\\s?\\*\\/", "gi" ) )
            && ( settings.images || found[ 0 ].match( new RegExp( "\\/\\*\\s?" + settings.inlineAttribute + "\\s?\\*\\/", "gi" ) ) ) )
        {
            tasks.push( replaceUrl.bind(
            {
                src: found[ 1 ],
                attrs: inline.getAttrs( found[ 0 ], settings ),
                limit: settings.images
            } ) );
        }
    }

    async.parallel( tasks, function( err )
    {
        if( !err )
        {
            result = settings.cssmin ? CleanCSS.process( result ) : result;
        }
        callback( err, result );
    } );
};
