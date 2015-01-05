"use strict";


var path = require( "path" );
var datauri = require( "datauri" );
var fs = require( "fs" );
var request = require( "request" );

var util = {};

module.exports = util;

util.defaults = {
    images: 8,
    scripts: true,
    links: true,
    uglify: false,
    cssmin: false,
    relativeTo: '',
    rebaseRelativeTo: '',
    inlineAttribute: 'data-inline',
    fileContent: ''
};

util.isRemotePath = function( url )
{
    return url.match( /^'?https?:\/\// ) || url.match( /^\/\// );
};

util.isBase64Path = function( url )
{
    return url.match( /^'?data.*base64/ );
};

util.getAttrs = function( tagMarkup, settings )
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

util.getRemote = function( uri, callback, toDataUri )
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

util.getInlineFilePath = function( src, relativeTo )
{
    src = src.replace( /^\//, '' );
    return ( path.resolve( relativeTo, src ).replace( /\?.*$/, '' ) );
};

util.getInlineFileContents = function( src, relativeTo )
{
    return ( fs.readFileSync( util.getInlineFilePath( src, relativeTo ) ) );
};

util.getTextReplacement = function( src, relativeTo, callback )
{
    if ( util.isRemotePath( src ) )
    {
        util.getRemote( src, callback );
    }
    else
    {
        callback( null, util.getInlineFileContents( src, relativeTo ) );
    }
};

util.getFileReplacement = function( src, relativeTo, callback )
{
    if( util.isRemotePath( src ) )
    {
        util.getRemote( src, callback, true );
    }
    else
    {
        var result = ( new datauri( util.getInlineFilePath( src, relativeTo ) ) ).content;
        callback( result === undefined ? new Error( "Local file not found" ) : null, result );
    }
};
