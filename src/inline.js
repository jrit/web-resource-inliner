/*
 * html-resource-inline
 * https://github.com/jrit/html-resource-inline
 *
 * Copyright (c) 2015 Jarrett Widman
 * Based on https://github.com/chyingp/grunt-inline
 */

'use strict';


var path = require( 'path' );
var datauri = require( 'datauri' );
var UglifyJS = require( 'uglify-js' );
var CleanCSS = require( 'clean-css' );
var xtend = require( 'xtend' );
var fs = require( 'fs' );
var request = require( 'request' );
var async = require( 'async' );

var defaults = {
    images: 8,
    scripts: true,
    links: true,
    uglify: false,
    cssmin: false,
    relativeTo: '',
    inlineAttribute: 'data-inline',
    fileContent: ''
};

var inline = {};

module.exports = inline;


var isRemotePath = function( url )
{
    return url.match( /^'?https?:\/\// ) || url.match( /^\/\// );
};

var isBase64Path = function( url )
{
    return url.match( /^'?data.*base64/ );
};

var getAttrs = function( tagMarkup, settings )
{
    var tag = tagMarkup.match( /^<[^\W>]*/ );
    if ( tag )
    {
        tag = tag[ 0 ];
        var attrs = tagMarkup
            .replace( /^<[^\s>]*/, "" )
            .replace( /\/?>/, "" )
            .replace( />?\s?<\/[^>]*>$/, "" )
            .replace( new RegExp( settings.inlineAttribute + "-ignore", "gi" ), "" )
            .replace( new RegExp( settings.inlineAttribute, "gi" ), "" );

        if ( tag === "<script" || tag === "<img" )
        {
            return ( attrs.replace( /(src|language|type)=["'][^"']*["']/gi, "" ).trim() );
        }
        else if ( tag === "<link" )
        {
            return ( attrs.replace( /(href|rel)=["'][^"']*["']/g, "" ).trim() );
        }
    }
};

var getRemote = function( uri, callback, toDataUri )
{
    request(
        {
            uri: uri,
            encoding: toDataUri ? "binary" : ""
        },
        function( err, response, body )
        {
            if ( err )
            {
                return( callback( err ) );
            }
            else if ( response.statusCode !== 200 )
            {
                return( callback( new Error( uri + " returned http " + response.code ) ) );
            }

            if ( toDataUri )
            {
                var b64 = new Buffer( body.toString(), "binary" ).toString( "base64" );
                var datauriContent = "data:" + response.headers[ "content-type" ] + ";base64," + b64;
                return( callback( null, datauriContent ) );
            }
            else
            {
                return( callback( null, body ) );
            }
        } );
};

var getInlineFilePath = function( src, relativeTo )
{
    src = src.replace( /^\//, '' );
    return ( path.resolve( relativeTo, src ).replace( /\?.*$/, '' ) );
};

var getInlineFileContents = function( src, relativeTo )
{
    return ( fs.readFileSync( getInlineFilePath( src, relativeTo ) ) );
};

var getTextReplacement = function( src, relativeTo, callback )
{
    if ( isRemotePath( src ) )
    {
        getRemote( src, callback );
    }
    else
    {
        callback( null, getInlineFileContents( src, relativeTo ) );
    }
};

var getFileReplacement = function( src, relativeTo, callback )
{
    if( isRemotePath( src ) )
    {
        getRemote( src, callback, true );
    }
    else
    {
        var result = ( new datauri( getInlineFilePath( src, relativeTo ) ) ).content;
        callback( result === undefined ? new Error( "Local file not found" ) : null, result );
    }
};


inline.html = function( options, callback )
{
    var settings = xtend({}, defaults, options );

    var replaceScript = function( callback )
    {
        var args = this;

        getTextReplacement( args.src, settings.relativeTo, function( err, content )
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

        getTextReplacement( args.src, settings.relativeTo, function( err, content )
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
                relativeTo: path.resolve( getInlineFilePath( args.src, settings.relativeTo ), ".." + path.sep )
            } );

            inline.css( cssOptions, function ( err, content )
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

        getFileReplacement( args.src, settings.relativeTo, function( err, datauriContent )
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
                attrs: getAttrs( found[ 0 ], settings ),
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
                attrs: getAttrs( found[ 0 ], settings ),
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
                attrs: getAttrs( found[ 0 ], settings ),
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
}


inline.css = function( options, callback )
{
    var settings = xtend( {}, defaults, options );

    var replaceUrl = function( callback )
    {
        var args = this;

        if( isBase64Path( args.src ) )
        {
            return callback( null ); // skip
        }

        getFileReplacement( args.src, settings.relativeTo, function( err, datauriContent )
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
                attrs: getAttrs( found[ 0 ], settings ),
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
}
