"use strict";

var path = require( "path" );
var url = require( "url" );
var fs = require( "fs" );
var colors = require( "ansi-colors" );
var mime = require( 'mime' );
var validDataUrl = require( "valid-data-url" );

var util = {};

module.exports = util;

util.defaults = {
    images: 8,
    svgs: 8,
    scripts: true,
    links: true,
    imports: false,
    strict: false,
    relativeTo: "",
    rebaseRelativeTo: "",
    inlineAttribute: "data-inline",
    fileContent: "",
    requestResource: undefined,
    scriptTransform: undefined,
    linkTransform: undefined
};

util.attrValueExpression = "(=[\"']([^\"']+?)[\"'])?";
util.CSSImportRegex = new RegExp(
    '@import\\s+(?<urlExpr>(["\'])(?<url>.+?)(?<!\\\\)\\2|(?:src|url)\\(\\s*(["\'])(?<url2>.+?)(?<!\\\\)\\4\\s*\\))(?<rest>[^;]*);.*$',
    "im"
);

/**
 * Escape special regex characters of a particular string
 *
 * @example
 * "http://www.test.com" --> "http:\/\/www\.test\.com"
 *
 * @param  {String} str - string to escape
 * @return {String} string with special characters escaped
 */
util.escapeSpecialChars = function( str )
{
    return str.replace( /(\/|\.|\$|\^|\{|\[|\(|\||\)|\*|\+|\?|\\)/gm, "\\$1" );
};

util.isRemotePath = function( url )
{
    return /^'?https?:\/\/|^\/\//.test( url );
};

util.isBase64Path = function( url )
{
    return /^'?data.*base64/.test( url );
};

util.getAttrs = function( tagMarkup, settings )
{
    var tag = tagMarkup.match( /^<[^\W>]*/ );
    if( tag )
    {
        tag = tag[ 0 ];
        var attrs = tagMarkup
            .replace( /(<[\s\S]*?(?=\>))([\s\S]*?(?=\<\/))(<\/[\w\W]>)?/gm, "$1>$3" )
            .replace( /^<[^\s>]*/, "" )
            .replace( /\/?>/, "" )
            .replace( />?\s?<\/[^>]*>$/, "" )
            .replace( new RegExp( settings.inlineAttribute + "-ignore" + util.attrValueExpression, "gi" ), "" )
            .replace( new RegExp( settings.inlineAttribute + util.attrValueExpression, "gi" ), "" );

        if( tag === "<script" || tag === "<img" )
        {
            return attrs.replace( /(src|language|type)=["'][^"']*["']/gi, "" ).trim();
        }
        else if( tag === "<link" )
        {
            return attrs.replace( /(href|rel)=["'][^"']*["']/g, "" ).trim();
        }
        else if( tag === "<style" )
        {
            return attrs.trim();
        }
    }
};

function defaultRequestResource( requestOptions, callback )
{
    var fetchOptions = {
        method: 'GET',
        compress: requestOptions.gzip
    }
    fetch( requestOptions.uri, fetchOptions )
        .then( function( response ) {
            if( response.status !== 200 )
            {
                throw new Error( requestOptions.uri + " returned http " + response.status );
            }
            if( requestOptions.encoding === 'binary' )
            {
                return response.arrayBuffer()
                    .then( function( arrayBuffer ) {
                        return Buffer.from(arrayBuffer);
                    } )
                    .then( function( body ) {
                        var b64 = body.toString( "base64" );
                        var datauriContent = "data:" + response.headers.get( "content-type" ) + ";base64," + b64;
                        return datauriContent;
                    } );
            }
            else
            {
                return response.text();
            }
        } )
        .then( function( body ) {
            callback( null, body );
        }, function( err ) {
            callback( err );
        } )
}

function getRemote( uri, settings, callback, toDataUri )
{
    if( /^\/\//.test( uri ) )
    {
        uri = "https:" + uri;
    }

    var requestOptions = {
        uri: uri,
        encoding: toDataUri && "binary",
        gzip: true
    };

    var requestResource = defaultRequestResource;
    if( typeof settings.requestResource === "function" )
    {
        requestResource = settings.requestResource;
    }

    requestResource( requestOptions, callback );
}

util.getInlineFilePath = function( src, relativeTo )
{
    src = src.replace( /^\//, "" );
    return path.resolve( relativeTo, src ).replace( /[\?#].*$/, "" );
};

util.getInlineFileContents = function( src, relativeTo )
{
    return fs.readFileSync( util.getInlineFilePath( src, relativeTo ) );
};

util.getTextReplacement = function( src, settings, callback )
{
    if( util.isRemotePath( settings.relativeTo ) || util.isRemotePath( src ) )
    {
        getRemote( url.resolve( settings.relativeTo, src ), settings, callback );
    }
    else if( util.isRemotePath( src ) )
    {
        getRemote( src, settings, callback );
    }
    else
    {
        try
        {
            var replacement = util.getInlineFileContents( src, settings.relativeTo );
        }
        catch( err )
        {
            return callback( err );
        }
        return callback( null, replacement );
    }
};

util.getFileReplacement = function( src, settings, callback )
{
    if( !src || util.srcIsCid( src ) )
    {
        callback( null );
    }
    else if( util.isRemotePath( settings.relativeTo ) )
    {
        getRemote( url.resolve( settings.relativeTo, src ), settings, callback, true );
    }
    else if( util.isRemotePath( src ) )
    {
        getRemote( src, settings, callback, true );
    }
    else if( validDataUrl( src ) )
    {
        callback( null, src );
    }
    else
    {
        var fileName = util.getInlineFilePath( src, settings.relativeTo );
        var mimetype = mime.getType( fileName );
        fs.readFile( fileName, 'base64', function( err, base64 ) {
            var datauri = `data:${mimetype};base64,${base64}`;
            callback( err, datauri );
        } );
    }
};

util.srcIsCid = function( src )
{
    return src.match( /^cid:/ );
};

util.handleReplaceErr = function( err, src, strict, callback )
{
    if( strict )
    {
        return callback( err );
    }
    else
    {
        console.warn( colors.yellow( "Not found, skipping: " + src ) );
        return callback( null );
    }
};

function substrInsideBalancedParentheses( str )
{
    var stack = [];
    var result = "";
    for( var i = 0; i < str.length; i++ )
    {
        switch( str[ i ] )
        {
        case "(":
            stack.push( "(" );
            if( stack.length > 1 )
            {
                result += str[ i ];
            }
            break;
        case ")":
            if( stack[ stack.length - 1 ] === "(" )
            {
                stack.pop();
                if( !stack.length )
                {
                    return result;
                }
                result += str[ i ];
            }
            else
            {
                //not balanced!
                return false;
            }
            break;
        default:
            if( stack.length )
            {
                result += str[ i ];
            }
        }
    }
    return result;
}

util.parseCSSImportRule = function( rule )
{
    var matches = util.CSSImportRegex.exec( rule );

    if( !matches || ( !matches.groups.url && !matches.groups.url2 ) )
    {
        return null;
    }

    var rest = ( matches.groups.rest || "" ).trim();
    var layer = "";
    var found = /^(?<layerExpr>layer(?:\s*\((?<layerName>[^)]*)\))?)/ims.exec( rest );
    if( found )
    {
        layer = ( found.groups.layerName || "" ).trim() || true;
        rest = rest.substring( found.index + found[ 0 ].length ).trim();
    }

    var supports = "";
    if( /^supports\(/i.test( rest ) )
    {
        // supports(...) can't be extracted using RegEx due to nested parentheses
        var expr = substrInsideBalancedParentheses( rest );
        if( expr === false )
        {
            rest = ""; // ignore rest of the malformed rule
        }
        else
        {
            supports = expr.trim();
            rest = rest.replace( expr, "" ).replace( /supports\([^)]*\)/i, "" );
        }
    }
    var media = rest.replace( /\s*;.*$/m, "" ).trim();

    return {
        url: matches.groups.url || matches.groups.url2,
        layer: layer || null,
        supports: supports || null,
        media: media || null
    };
};
