var url = require( "url" );

var getRemote = require( "./getRemote" );
var isRemotePath = require( "./isRemotePath" );
var getInlineFileContents = require( "./getInlineFileContents" );

module.exports = function( src, settings, callback )
{
    if( isRemotePath( settings.relativeTo ) || isRemotePath( src ) )
    {
        getRemote( url.resolve( settings.relativeTo, src ), settings, callback );
    }
    else if( isRemotePath( src ) )
    {
        getRemote( src, settings, callback );
    }
    else
    {
        try
        {
            var replacement = getInlineFileContents( src, settings.relativeTo );
        }
        catch( err )
        {
            return callback( err );
        }
        return callback( null, replacement );
    }
};
