module.exports = function ( a, b ) {
    return Object.keys( a ).reduce( function( result, key ) {
        if ( b && b[key] ) {
            result[key] = b[key];
        } else {
            result[key] = a[key];
        }
        return result;
    }, {} );
};
