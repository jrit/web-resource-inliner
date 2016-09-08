"use strict";

var xtend = require( "xtend" );
var parallel = require( "async" ).parallel;
var path = require( "path" );
var constant = require( "lodash.constant" );
var inline = require( "./util" );

module.exports = function( options, callback )
{
    var settings = xtend( {}, inline.defaults, options );

    var replaceUrl = function( callback )
    {
        var args = this;

        if( inline.isBase64Path( args.src ) )
        {
            return callback( null ); // Skip
        }

        inline.getFileReplacement( args.src, settings, function( err, datauriContent )
        {
            if( err )
            {
                return inline.handleReplaceErr( err, args.src, settings.strict, callback );
            }
            if( typeof( args.limit ) === "number" && datauriContent.length > args.limit * 1000 )
            {
                return callback( null ); // Skip
            }

            var css = "url(\"" + datauriContent + "\");";
            var re = new RegExp( "url\\(\\s?[\"']?(" + inline.escapeSpecialChars( args.src ) + ")[\"']?\\s?\\);", "g" );
            result = result.replace( re, constant( css ) );

            return callback( null );
        } );
    };

    var rebase = function( src )
    {
        var css = "url(\"" + path.join( settings.rebaseRelativeTo, src ).replace( /\\/g, "/" ) + "\");";
        var re = new RegExp( "url\\(\\s?[\"']?(" + inline.escapeSpecialChars( src ) + ")[\"']?\\s?\\);", "g" );
        result = result.replace( re, constant( css ) );
    };

    var result = settings.fileContent;
    var tasks = [];
    var found = null;

    var urlRegex = /url\(\s?["']?([^)'"]+)["']?\s?\);.*/gi;

    if( settings.rebaseRelativeTo )
    {
        var matches = {};
        while( ( found = urlRegex.exec( result ) ) !== null )
        {
            var src = found[ 1 ];
            matches[ src ] = true;
        }

        for( var src in matches )
        {
            if( !inline.isRemotePath( src ) && !inline.isBase64Path( src ) )
            {
                rebase( src );
            }
        }
    }

    var inlineAttributeCommentRegex = new RegExp( "\\/\\*\\s?" + settings.inlineAttribute + "\\s?\\*\\/", "i" );
    var inlineAttributeIgnoreCommentRegex = new RegExp( "\\/\\*\\s?" + settings.inlineAttribute + "-ignore\\s?\\*\\/", "i" );

    while( ( found = urlRegex.exec( result ) ) !== null )
    {
        if( !inlineAttributeIgnoreCommentRegex.test( found[ 0 ] ) &&
            ( settings.images || inlineAttributeCommentRegex.test( found[ 0 ] ) ) )
        {
            tasks.push( replaceUrl.bind(
            {
                src: found[ 1 ],
                limit: settings.images
            } ) );
        }
    }

    parallel( tasks, function( err )
    {
        callback( err, result );
    } );
};
