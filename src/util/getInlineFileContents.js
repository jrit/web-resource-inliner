var fs = require( "fs" );
var getInlineFilePath = require( "./getInlineFilePath" );

module.exports = function( src, relativeTo ) {
    return fs.readFileSync( getInlineFilePath( src, relativeTo ) );
};
