/**
 * Escape special regex characters of a particular string
 *
 * @example
 * "http://www.test.com" --> "http:\/\/www\.test\.com"
 *
 * @param  {String} str - string to escape
 * @return {String} string with special characters escaped
 */
module.exports = function( str ) {
    return str.replace( /(\/|\.|\$|\^|\{|\[|\(|\||\)|\*|\+|\?|\\)/g, "\\$1" );
};
