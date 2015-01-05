"use strict";


var path = require( "path" );
var datauri = require( "datauri" );
var UglifyJS = require( "uglify-js" );
var xtend = require( "xtend" );
var async = require( "async" );
var inline = require( "./util" );
var css = require( "./css" );

module.exports = function( options, callback )
{
    var settings = xtend({}, inline.defaults, options );

    var replaceScript = function( callback )
    {
        var args = this;

        inline.getTextReplacement( args.src, settings.relativeTo, function( err, content )
        {
            if( err )
            {
                return( callback( err ) );
            }
            var js = options.uglify ? UglifyJS.minify( content ).code : content;
            if( typeof( args.limit ) === "number" && js.length > args.limit * 1000 )
            {
                return( callback( null ) );
            }
            var html = '<script' + ( args.attrs ? ' ' + args.attrs : '' ) + '>\n' + js + '\n</script>';
            result = result.replace( new RegExp( "<script.+?src=[\"'](" + args.src + ")[\"'].*?>\s*<\/script>", "g" ), html );
            return( callback( null ) );
        } );
    };

    var replaceLink = function( callback )
    {
        var args = this;

        inline.getTextReplacement( args.src, settings.relativeTo, function( err, content )
        {
            if( err )
            {
                return( callback( err ) );
            }
            if( typeof( args.limit ) === "number" && content.length > args.limit * 1000 )
            {
                return( callback( null ) );
            }

            var cssOptions = xtend( {}, settings, {
                fileContent: content.toString(),
                rebaseRelativeTo: path.relative( settings.relativeTo, path.join( settings.relativeTo, args.src, ".." + path.sep ) )
            } );

            css( cssOptions, function ( err, content )
            {
                if( err )
                {
                    return( callback( err ) );
                }
                var html = '<style' + ( args.attrs ? ' ' + args.attrs : '' ) + '>\n' + content + '\n</style>';
                result = result.replace( new RegExp( "<link.+?href=[\"'](" + args.src + ")[\"'].*?\/?>", "g" ), html );
                return( callback( null ) );
            } );
        } );
    };

    var replaceImg = function( callback )
    {
        var args = this;

        inline.getFileReplacement( args.src, settings.relativeTo, function( err, datauriContent )
        {
            if( err )
            {
                return ( callback( err ) );
            }
            if( typeof( args.limit ) === "number" && datauriContent.length > args.limit * 1000 )
            {
                return ( callback( null ) );
            }
            var html = '<img' + ( args.attrs ? ' ' + args.attrs : '' ) + ' src="' + datauriContent + '" />';
            result = result.replace( new RegExp( "<img.+?src=[\"'](" + args.src + ")[\"'].*?\/?\s*?>", "g" ), html );
            return( callback( null ) );
        } );
    };

    var result = settings.fileContent;
    var tasks = [];
    var found;

    var scriptRegex = /<script.+?src=["']([^"']+?)["'].*?>\s*<\/script>/g;
    while( ( found = scriptRegex.exec( result ) ) !== null )
    {
        if( !found[ 0 ].match( new RegExp( settings.inlineAttribute + "-ignore", "gi" ) )
            && ( settings.scripts || found[ 0 ].match( new RegExp( settings.inlineAttribute, "gi" ) ) ) )
        {
            tasks.push( replaceScript.bind(
            {
                src: found[ 1 ],
                attrs: inline.getAttrs( found[ 0 ], settings ),
                limit: settings.scripts
            } ) );
        }
    }

    var linkRegex = /<link.+?href=["']([^"']+?)["'].*?\/?>/g;
    while( ( found = linkRegex.exec( result ) ) !== null )
    {
        if( !found[ 0 ].match( new RegExp( settings.inlineAttribute + "-ignore", "gi" ) )
            && ( settings.links || found[ 0 ].match( new RegExp( settings.inlineAttribute, "gi" ) ) ) )
        {
            tasks.push( replaceLink.bind(
            {
                src: found[ 1 ],
                attrs: inline.getAttrs( found[ 0 ], settings ),
                limit: settings.links
            } ) );
        }
    }

    var imgRegex = /<img.+?src=["']([^"']+?)["'].*?\/?\s*?>/g;
    while( ( found = imgRegex.exec( result ) ) !== null )
    {
        if( !found[ 0 ].match( new RegExp( settings.inlineAttribute + "-ignore", "gi" ) )
            && ( settings.images || found[ 0 ].match( new RegExp( settings.inlineAttribute, "gi" ) ) ) )
        {
            tasks.push( replaceImg.bind(
            {
                src: found[ 1 ],
                attrs: inline.getAttrs( found[ 0 ], settings ),
                limit: settings.images
            } ) );
        }
    }

    result = result
                .replace( new RegExp( " " + settings.inlineAttribute + "-ignore", "gi" ), "" )
                .replace( new RegExp( " " + settings.inlineAttribute, "gi" ), "" );


    async.parallel( tasks, function( err )
    {
        callback( err, result );
    } );
};