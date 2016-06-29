"use strict";

var path = require( "path" );
var htmlparser = require( "htmlparser2" );

var css = require( "./css" );
var svg = require( "./svg" );
var extend = require( "./util/extend" );
var isBase64Path = require( "./util/isBase64Path" );

var getTextReplacement = require( "./util/getTextReplacement" );
var getFileReplacement = require( "./util/getFileReplacement" );
var isFunction = require( "./util/isFunction" );

module.exports = function( options, callback )
{
    options = require( "./options" )( options );

    function replaceContent( elem ) {
        var replacer = ( function() {
            if ( [ "script", "link", "use" ].indexOf( elem.name ) !== -1 ) {
                return getTextReplacement;
            } else {
                return getFileReplacement;
            }
        } )();

        var limit = ( function(){
            switch ( elem.name ) {
                case "img":
                    return options.images;
                case "use":
                    return options.svgs;
                case "link":
                    return options.links;
                case "script":
                    return options.scripts;
            }
        } )();

        function inlineAttributeCheck() {
            function isset( obj ) { return obj !== undefined; }

            return ( !isset( elem.attribs[options.inlineAttribute + "-ignore"] ) &&
                limit || isset( elem.attribs[options.inlineAttribute] ) );
        }

        function createTextChild( content ) {
            return [ {
                data: "\n",
                type: "text"
            }, {
                data: content,
                type: "text"
            }, {
                data: "\n",
                type: "text"
            } ];
        }

        return Promise.all( [ "src", "href", "srcset", "xlink:href" ].map( function( src ) {
            if ( !elem.attribs[src] ||
                !inlineAttributeCheck() ||
                isBase64Path( elem.attribs[src] ) ) {
                return Promise.resolve(); // Skip
            }

            return new Promise( function( resolve, reject ) {
                // Retrive source content
                return replacer( elem.attribs[ src ].split( "#" )[0], options, function( err, content ) {
                    if ( err ) {
                        if ( options.strict ) {
                            return reject( err );
                        } else {
                            console.warn( "Not found, skipping: " + elem.attribs[ src ]  );
                            return resolve(); // Skip
                        }
                    }
                    return resolve( content );
                } );
            } ).then( function( content ) {
                if ( !content ) {
                    return;  // Skip
                }

                // Handle transformations
                if ( !options[elem.name+"Transform"] ) {
                    return Promise.resolve( content ); // Skip
                }

                return new Promise( function( resolve, reject ) {
                    options[elem.name+"Transform"]( content, function( err, content ) {
                        if ( err ) {
                            return reject( err );
                        }
                        return resolve( content );
                    } );
                } );
            } ).then( function( content ) {
                if ( !content || typeof( limit ) === "number" &&
                    content.length > limit * 1000 ) {
                    return; // Skip
                }

                // Replace content and/or element
                if ( elem.name === "img" ) {
                    return elem.attribs[ src ] = content;
                }

                if ( elem.name === "link" ) {
                    // Inline images for each source in the CSS
                    return css( extend( options, {
                        fileContent: content,
                        rebaseRelativeTo: path.relative( options.relativeTo,
                            path.join( options.relativeTo, elem.attribs[ src ], ".." + path.sep ) )
                    } ) ).then( function( content ) {
                        // Convert to style element
                        elem.type = "style";
                        elem.name = "style";
                        elem.attribs = { type: "text/css" };
                        return elem.children = createTextChild( content );
                    } );
                }

                if ( elem.name === "script" ) {
                    elem.type = "script";
                    elem.attribs = { type: "text/javascript" };
                    return elem.children = createTextChild( content );
                }

                if ( elem.name === "use" &&
                    elem.attribs[ src ].split( "#" ).length === 2 ) {
                    return svg(
                        content,
                        elem.attribs[ src ].split( "#" )[1]
                    ).then( function( svgElement ) {
                        elem.attribs = {};
                        for ( var prop in svgElement ) {
                            if ( {}.hasOwnProperty.call( svgElement, prop ) ) {
                                elem[prop] = svgElement[prop];
                            }
                        }
                    } );
                }
            } );
        } ) );
    }

    var promise = new Promise( function( resolve, reject ) {

        var handler = new htmlparser.DomHandler( function ( err, dom ) {
            if ( err ) {
                return reject( err );
            } else {
                return resolve( dom );
            }
        } );

        var parser = new htmlparser.Parser( handler );
        parser.write( options.fileContent );
        parser.end();

    } ).then( function( dom ) {
        return Promise.all( [
            "script",
            "link",
            "img",
            "use"
        ].reduce( function( result, type ) {
            return result.concat(
                htmlparser.DomUtils.getElementsByTagName( type, dom )
            );
        }, [] ).map( replaceContent ) ).then( function() {
            // Re-construct HTML
            return htmlparser.DomUtils.getOuterHTML( dom );
        } );
    } ).then( function( result ) {
        if ( isFunction( callback ) ) {
            callback( null, result );
        }
        return result;
    } ).catch( function( err ) {
        if ( isFunction( callback ) ) {
            callback( err, options.fileContent );
        }
        return Promise.reject( err );
    } );

    if ( !isFunction( callback ) ) {
        return promise;
    }
};
