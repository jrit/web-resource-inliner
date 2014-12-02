/*
 * html-resource-inline
 * https://github.com/jrit/html-resource-inline
 *
 * Copyright (c) 2014 Jarrett Widman
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
    images: false,
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
                throw err; //kill it
            }

            if ( toDataUri )
            {
                var b64 = new Buffer( body.toString(), "binary" ).toString( "base64" );
                var datauriContent = "data:" + response.headers[ "content-type" ] + ";base64," + b64;
                callback( null, datauriContent );
            }
            else
            {

                callback( null, body );
            }
        } );
};


inline.html = function( options )
{
    var settings = xtend({}, defaults, options );

    var getInlineFilePath = function( src )
    {
        src = src.replace( /^\//, '' );
        return ( path.resolve( settings.relativeTo, src ).replace( /\?.*$/, '' ) );
    };

    var getInlineFileContents = function( src )
    {
        return ( fs.readFileSync( getInlineFilePath( src ) ) );
    };

    var getTextReplacement = function( src, callback )
    {
        if ( isRemotePath( src ) )
        {
            getRemote( src, callback );
        }
        else
        {
            callback( null, getInlineFileContents( src ) );
        }
    };

    var getFileReplacement = function( src, callback )
    {
        if ( isRemotePath( src ) )
        {
            getRemote( src, callback, true );
        }
        else
        {
            callback( null, ( new datauri( getInlineFilePath( src ) ) ).content );
        }
    };

    var replaceScript = function( callback )
    {
        var args = this;

        getTextReplacement( args.src, function( err, content )
        {
            var js = options.uglify ? UglifyJS.minify( content ).code : content;
            var html = '<script' + ( args.attrs ? ' ' + args.attrs : '' ) + '>\n' + js + '\n</script>';
            result = result.replace( new RegExp( "<script.+?src=[\"'](" + args.src + ")[\"'].*?>\s*<\/script>", "g" ), html );
            callback( null );
        } );
    };

    var replaceLink = function( callback )
    {
        var args = this;

        getTextReplacement( args.src, function( err, content )
        {
            var html = '<style' + ( args.attrs ? ' ' + args.attrs : '' ) + '>\n' + content + '\n</style>';
            result = result.replace( new RegExp( "<link.+?href=[\"'](" + args.src + ")[\"'].*?\/?>", "g" ), html );
            callback( null );
        } );
    };

    var replaceImg = function( callback )
    {
        var args = this;

        getFileReplacement( args.src, function( err, datauriContent )
        {
            var html = '<img' + ( args.attrs ? ' ' + args.attrs : '' ) + ' src="' + datauriContent + '" />';
            result = result.replace( new RegExp( "<img.+?src=[\"'](" + args.src + ")[\"'].*?\/?\s*?>", "g" ), html );
            callback( null );
        } );
    };

    var result = settings.fileContent;
    var tasks = [];
    var found;

    var scriptRegex = /<script.+?src=["']([^"']+?)["'].*?>\s*<\/script>/g;
    while ( ( found = scriptRegex.exec( result ) ) !== null )
    {
        if ( settings.scripts || found[ 0 ].match( new RegExp( settings.inlineAttribute, "gi" ) ) )
        {
            tasks.push( replaceScript.bind(
            {
                src: found[ 1 ],
                attrs: getAttrs( found[ 0 ], settings ),
            } ) );
        }
    }

    var linkRegex = /<link.+?href=["']([^"']+?)["'].*?\/?>/g;
    while ( ( found = linkRegex.exec( result ) ) !== null )
    {
        if ( settings.links || found[ 0 ].match( new RegExp( settings.inlineAttribute, "gi" ) ) )
        {
            tasks.push( replaceLink.bind(
            {
                src: found[ 1 ],
                attrs: getAttrs( found[ 0 ], settings )
            } ) );
        }
    }

    var imgRegex = /<img.+?src=["']([^"']+?)["'].*?\/?\s*?>/g;
    while ( ( found = imgRegex.exec( result ) ) !== null )
    {
        if ( settings.images || found[ 0 ].match( new RegExp( settings.inlineAttribute, "gi" ) ) )
        {
            tasks.push( replaceImg.bind(
            {
                src: found[ 1 ],
                attrs: getAttrs( found[ 0 ], settings )
            } ) );
        }
    }


    async.parallel( tasks, function()
    {
        settings.callback( null, result );
    } );
}

//TODO: neglected, need to rewrite
inline.css = function( options )
{
    var settings = xtend(
    {}, defaults, options );

    if ( relativeTo )
    {
        settings.filepath = settings.filepath.replace( /[^\/]+\//g, relativeTo );
    }

    fileContent = fileContent.replace( /url\(["']*([^)'"]+)["']*\)/g, function( matchedWord, imgUrl )
    {
        var newUrl = imgUrl;
        var flag = imgUrl.indexOf( options.tag ) != -1; // urls like "img/bg.png?__inline" will be transformed to base64
        if ( isBase64Path( imgUrl ) || isRemotePath( imgUrl ) )
        {
            return matchedWord;
        }
        var absoluteImgurl = path.resolve( path.dirname( filepath ), imgUrl );
        newUrl = path.relative( path.dirname( filepath ), absoluteImgurl );

        absoluteImgurl = absoluteImgurl.replace( /\?.*$/, '' );
        if ( flag && grunt.file.exists( absoluteImgurl ) )
        {
            newUrl = datauri( absoluteImgurl );
        }
        else
        {
            newUrl = newUrl.replace( /\\/g, '/' );
        }

        return matchedWord.replace( imgUrl, newUrl );
    } );
    fileContent = options.cssmin ? CleanCSS.process( fileContent ) : fileContent;

    return fileContent;
}
