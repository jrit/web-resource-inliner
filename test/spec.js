/*eslint-env mocha */
/*eslint no-unused-vars: [2, { "args": "none" }]*/
var assert = require( "assert" );
var fs = require( "fs" );
var path = require( "path" );
var inline = require( "../src/inline.js" );
var util = require( "../src/util.js" );
const fetchMock = require('fetch-mock');
var mime = require( "mime-types" );

fetchMock.config.overwriteRoutes = true;

function normalize( contents )
{
    return process.platform === "win32" ? contents.replace( /\r\n/g, "\n" ) : contents;
}

function readFile( file )
{
    return normalize( fs.readFileSync( file, "utf8" ) );
}

function diff( actual, expected )
{
    if( actual === expected )
    {
        return;
    }

    actual = actual.split( "\n" );
    expected = expected.split( "\n" );

    expected.forEach( function( line, i )
    {
        if( !line.length && i === expected.length - 1 )
        {
            return;
        }
        var other = actual[ i ];
        if( line === other )
        {
            console.error( "%d| %j", i + 1, line );
        }
        else
        {
            console.error( "\033[31m%d| %j%s | %j\033[0m", i + 1, line, "", other );
        }
    } );
}

function testEquality( err, result, expected, done )
{
    result = normalize( result );
    diff( result, expected );
    assert( !err );
    assert.equal( result, expected );
    done();
}

describe( "html", function()
{
    this.timeout( 5000 );

    describe( "links", function()
    {
        it( "should inline local links", function( done )
        {
            var expected = readFile( "test/cases/css_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/css.html" ),
                    relativeTo: "test/cases/"
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should inline remote links", function( done )
        {
            var expected = readFile( "test/cases/css-remote_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/css-remote.html" ),
                    relativeTo: "test/cases/"
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should keep data: uris as-is", function( done )
        {
            var expected = readFile( "test/cases/data-uri.html" );

            inline.html( {
                    fileContent: expected,
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should inline remote links with no protocol", function( done )
        {
            var expected = readFile( "test/cases/css-remote-no-protocol_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/css-remote-no-protocol.html" ),
                    relativeTo: "test/cases/"
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should inline remote links relative to a url", function( done )
        {
            var expected = readFile( "test/cases/css-remote-relative-to-url_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/css-remote-relative-to-url.html" ),
                    relativeTo: "https://raw.githubusercontent.com/jrit/"
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should inline local and remote multiline links", function( done )
        {
            var expected = readFile( "test/cases/css-multiline_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/css-multiline.html" ),
                    relativeTo: "test/cases/"
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should transform links", function( done )
        {
            var expected = readFile( "test/cases/css-transform_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/css-transform.html" ),
                    relativeTo: "test/cases/",
                    linkTransform: function( content, done )
                    {
                        done( null, "/*inserted*/\n" + content );
                    }
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should rebase inline local links relative to", function( done )
        {
            var expected = readFile( "test/cases/css-rebase_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/css-rebase.html" ),
                    relativeTo: "test/cases/",
                    rebaseRelativeTo: "test/cases/assets/fonts"
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

    } );

    describe( "css imports", function()
    {
        it( "should inline @import rules inside stylesheets", function( done )
        {
            var expected = readFile( "test/cases/css-import_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/css-import.html" ),
                    relativeTo: "test/cases/",
                    imports: true
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );
    } );

    describe( "scripts", function()
    {
        it( "should inline scripts", function( done )
        {
            var expected = readFile( "test/cases/script_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/script.html" ),
                    relativeTo: "test/cases/"
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should inline multiline scripts", function( done )
        {
            var expected = readFile( "test/cases/script-multiline_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/script-multiline.html" ),
                    relativeTo: "test/cases/"
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should transform scripts", function( done )
        {
            var expected = readFile( "test/cases/script-transform_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/script-transform.html" ),
                    relativeTo: "test/cases/",
                    scriptTransform: function( content, done )
                    {
                        done( null, content );
                    }
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );
    } );

    describe( "images", function()
    {
        it( "should inline local images", function( done )
        {
            var expected = readFile( "test/cases/img_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/img.html" ),
                    relativeTo: "test/cases/",
                    images: true
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should inline remote images", function( done )
        {
            var expected = readFile( "test/cases/img-remote_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/img-remote.html" ),
                    relativeTo: "test/cases/",
                    images: true
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should inline images in one line", function( done )
        {
            var expected = readFile( "test/cases/img-singleline_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/img-singleline.html" ),
                    relativeTo: "test/cases/",
                    images: true
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should include based on size", function( done )
        {
            var expected = readFile( "test/cases/img-opt-out_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/img-opt-out.html" ),
                    relativeTo: "test/cases/",
                    images: 8
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should exclude based on size", function( done )
        {
            var expected = readFile( "test/cases/img-too-large_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/img-too-large.html" ),
                    relativeTo: "test/cases/",
                    images: 0.1
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );
    } );

    describe( "svgs", function()
    {
        it( "should inline local svgs", function( done )
        {
            var expected = readFile( "test/cases/svg/svg_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/svg/svg.html" ),
                    relativeTo: "test/cases/",
                    svgs: true
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should include based on size", function( done )
        {
            var expected = readFile( "test/cases/svg/svg-opt-out_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/svg/svg-opt-out.html" ),
                    relativeTo: "test/cases/",
                    svgs: 8
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );

        it( "should exclude based on size", function( done )
        {
            var expected = readFile( "test/cases/svg/svg-too-large_out.html" );

            inline.html( {
                    fileContent: readFile( "test/cases/svg/svg-too-large.html" ),
                    relativeTo: "test/cases/",
                    svgs: 0.1
                },
                function( err, result )
                {
                    testEquality( err, result, expected, done );
                }
            );
        } );
    } );

    it( "should inline based on inlineAttribute", function( done )
    {
        var expected = readFile( "test/cases/img-opt-in_out.html" );

        inline.html( {
                fileContent: readFile( "test/cases/img-opt-in.html" ),
                relativeTo: "test/cases/",
                images: false
            },
            function( err, result )
            {
                testEquality( err, result, expected, done );
            }
        );
    } );

    it( "should exclude based on inlineAttribute", function( done )
    {
        var expected = readFile( "test/cases/img-opt-out_out.html" );

        inline.html( {
                fileContent: readFile( "test/cases/img-opt-out.html" ),
                relativeTo: "test/cases/",
                images: true
            },
            function( err, result )
            {
                testEquality( err, result, expected, done );
            }
        );
    } );

    it( "should pass HTTP errors up through callbacks when strict", function( done )
    {
        inline.html( {
                fileContent: readFile( "test/cases/404.html" ),
                relativeTo: "test/cases/",
                strict: true
            },
            function( err, result )
            {
                assert.equal( err.message, "https://raw.githubusercontent.com/not-a-file.css returned http 400" );
                done();
            }
        );
    } );

    it( "should pass missing file errors up through callbacks when strict", function( done )
    {
        var expected = readFile( "test/cases/missing-file.html" );

        inline.html( {
                fileContent: readFile( "test/cases/missing-file.html" ),
                relativeTo: "test/cases/",
                strict: true
            },
            function( err, result )
            {
                assert.equal( result, expected );
                assert.equal( !!err, true );
                done();
            }
        );
    } );

    it( "should console.warn HTTP errors when not strict", function( done )
    {
        var expected = readFile( "test/cases/404.html" );

        inline.html( {
                fileContent: readFile( "test/cases/404.html" ),
                relativeTo: "test/cases/"
            },
            function( err, result )
            {
                assert.equal( result, expected );
                assert.equal( !!err, false );
                done();
            }
        );
    } );

    it( "should console.warn missing file errors when not strict", function( done )
    {
        inline.html( {
                fileContent: readFile( "test/cases/missing-file.html" ),
                relativeTo: "test/cases/"
            },
            function( err, result )
            {
                assert.equal( !!err, false );
                done();
            }
        );
    } );

    it( "should properly escape regex vars before calling replace()", function( done )
    {
        inline.html( {
                fileContent: readFile( "test/cases/script-regex-escape.html" ),
                relativeTo: "test/cases/"
            },
            function( err, result )
            {
                assert.equal( result.indexOf( "$&" ) > -1, true );
                done();
            }
        );
    } );

    describe( "(http mocking)", function()
    {
        var baseUrl = "http://example.com/";

        beforeEach( function()
        {
            fetchMock.mock('*', (url, opts) => {
                assert.equal( url.indexOf( baseUrl ), 0 );

                var relativePath = url.slice(baseUrl.length).replace(/\?.*/, "");
                var headers = {
                    "Content-Type": mime.contentType(path.extname(relativePath)) || "application/octet-stream"
                };

                var content =  fs.readFileSync("test/cases/" + relativePath);

                return {
                    status: 200,
                    headers: headers,
                    body:  content
                };
            }, { sendAsJson: false });
        } );

        afterEach( function()
        {
            fetchMock.restore();
        } );

        it( "should not try to inline empty links", function( done )
        {
            const content = '<link href="" rel="stylesheet" />';

            inline.html( {
                    fileContent: content,
                    strict: false,
                    relativeTo: baseUrl
                },
                function( err, result )
                {
                    testEquality( err, result, content, done );
                }
            );
        } );

        it( "should not try to inline a link that starts with #", function( done )
        {
            const content = '<link href="#" rel="stylesheet" /><link href="#aaa" rel="stylesheet" />'
              + '<img src="#" /><img src="#aaa" />'
              + '<a href="#" /><a href="#aaa" />';

            inline.html( {
                    fileContent: content,
                    strict: true
                },
                function( err, result )
                {
                    testEquality( err, result, content, done );
                }
            );
        } );

        it( "should use the base url (relativeTo) to resolve image URLs", function( done )
        {
            var expected = readFile( "test/cases/img_out.html" );
            inline.html( {
                fileContent: readFile( "test/cases/img.html" ),
                relativeTo: baseUrl,
                images: true
            }, function( err, result )
            {
                testEquality( err, result, expected, done );
            } );
        } );

        it( "should unescape HTML entities when extracting URLs from attributes", function( done )
        {
            fetchMock.mock('*', (url, opts) => {
                assert( !/&\w+;/.test( url ) );

                return new Response(null, {
                    status: 200,
                });
            });

            inline.html( {
                fileContent: "<img src=\"assets/icon.png?a=b&amp;c='d'\" /><img src=\"assets/icon.png?a=b&amp;c='d'&amp;&amp;\">",
                relativeTo: baseUrl,
                images: true
            }, done );
        } );

        it( "should understand the spaces to the sides of = when parsing attributes", function( done )
        {
            var count = 0;

            fetchMock.mock('*', (url, opts) => {
                count++

                return new Response(null, {
                    status: 200,
                });
            });
            inline.html( {
                fileContent: "<img src = \"assets/icon.png\">" +
                    "<script src =\"assets/export.js\"></script>" +
                    "<script src =\n\"assets/export.js?foo=1\"></script>" +
                    "<link href=  \"assets/simple.css\" rel=\"stylesheet\"/>",
                relativeTo: baseUrl,
                scripts: true,
                links: true,
                images: true
            }, function()
            {
                assert.equal( count, 4 );
                done();
            } );
        } );

        it( "should apply the requestResource option", function( done )
        {
            var uris = []
            inline.html( {
                fileContent: "<img src=\"assets/icon.png\"><img src=\"assets/icon.png?a=1\">",
                relativeTo: baseUrl,
                scripts: true,
                links: true,
                images: true,
                requestResource: function( options, callback )
                {
                    uris.push( options.uri )
                    callback( null, "image" )
                }
            }, function()
            {
                assert.equal( uris.length, 2 );
                assert.equal( uris[0], "http://example.com/assets/icon.png" );
                assert.equal( uris[1], "http://example.com/assets/icon.png?a=1" );
                done()
            } );
        } );
    } );
} );

describe( "css", function()
{
    this.timeout( 5000 );

    it( "should inline local urls", function( done )
    {
        var expected = readFile( "test/cases/css_out.css" );

        inline.css( {
                fileContent: readFile( "test/cases/css.css" ),
                relativeTo: "test/cases/",
                images: false
            },
            function( err, result )
            {
                testEquality( err, result, expected, done );
            }
        );
    } );

    it( "should inline remote urls", function( done )
    {
        var expected = readFile( "test/cases/css-remote_out.css" );

        inline.css( {
                fileContent: readFile( "test/cases/css-remote.css" ),
                relativeTo: "test/cases/",
                images: true
            },
            function( err, result )
            {
                testEquality( err, result, expected, done );
            }
        );
    } );

    it( "should inline @import rule (basic)", function( done )
    {
        var expected = readFile( "test/cases/css-import_out.css" );

        inline.css( {
                fileContent: readFile( "test/cases/css-import.css" ),
                relativeTo: "test/cases/",
                imports: true
            },
            function( err, result )
            {
                testEquality( err, result, expected, done );
            }
        );
    } );

    it( "should inline @import rule included via comment", function( done )
    {
        var expected = readFile( "test/cases/css-import_out.css" );

        inline.css( {
                fileContent: readFile( "test/cases/css-import.css" )
                    .replace(/@import.+$/im, '$& /* data-inline */'),
                relativeTo: "test/cases/",
                imports: false
            },
            function( err, result )
            {
                testEquality( err, result, expected, done );
            }
        );
    } );

    it( "should not inline @import rule excluded via comment", function( done )
    {
        var expected = readFile( "test/cases/css-import.css" )
            .replace(/@import.+$/im, '$& /* data-inline-ignore */');

        inline.css( {
                fileContent: expected,
                relativeTo: "test/cases/",
                imports: true
            },
            function( err, result )
            {
                testEquality( err, result, expected, done );
            }
        );
    } );

    it( "should inline @import rule (advanced)", function( done )
    {
        var expected = readFile( "test/cases/css-import-advanced_out.css" );

        inline.css( {
                fileContent: readFile( "test/cases/css-import-advanced.css" ),
                relativeTo: "test/cases/",
                imports: true
            },
            function( err, result )
            {
                testEquality( err, result, expected, done );
            }
        );
    } );

    it( "should rebase local urls", function( done )
    {
        var expected = readFile( "test/cases/css-rebase_out.css" );

        inline.css( {
                fileContent: readFile( "test/cases/css-rebase.css" ),
                rebaseRelativeTo: "assets",
                images: false
            },
            function( err, result )
            {
                testEquality( err, result, expected, done );
            }
        );
    } );
} );

describe( "util", function()
{

    describe( "#escapeSpecialChars", function()
    {
        it( "should escape special regex characters in a string", function()
        {

            var str = "http://fonts.googleapis.com/css?family=Open+Sans";
            var expected = "http:\\/\\/fonts\\.googleapis\\.com\\/css\\?family=Open\\+Sans";

            var result = util.escapeSpecialChars( str );
            var regex = new RegExp( result, "g" );

            assert.equal( result, expected );
            assert.equal( str.match( regex ).length, 1 );

        } );
    } );

    describe( "#parseCSSImportRule", function()
    {
        it( "should parse basic @import rule", function()
        {
            var testCases = [
                [ '@import "styles.css";', "styles.css" ],
                [ '@import "styles\\".css";', 'styles\\".css' ],
                [ "@import 'styles.css';", "styles.css" ],
                [ '@import url( "styles.css?query=param&a=b&foo[]=bar" ) ;', "styles.css?query=param&a=b&foo[]=bar" ],
                [ '\n@import\nurl(\n"styles.css"\n)\n;\n', "styles.css" ]
            ];

            testCases.forEach( function( testCase, idx )
            {
                assert.deepStrictEqual( util.parseCSSImportRule( testCase[ 0 ] ), {
                    url: testCase[ 1 ],
                    layer: null,
                    supports: null,
                    media: null
                }, "Test case #" + idx + " failed." );
            } );
        } );

        it( "should parse @import rule with media queries", function()
        {
            var testCases = [
                '@import "styles.css" screen and (orientation: landscape);',
                '@import url( "styles.css" ) screen and (orientation: landscape);'
            ];

            testCases.forEach( function( testCase, idx )
            {
                assert.deepStrictEqual( util.parseCSSImportRule( testCase ), {
                    url: "styles.css",
                    layer: null,
                    supports: null,
                    media: "screen and (orientation: landscape)"
                }, "Test case #" + idx + " failed." );
            } );
        } );

        it( "should parse @import rule with a cascade layer", function()
        {
            var testCases = [
                [ '@import "styles.css" layer(utilities);', "utilities" ],
                [ '@import url("styles.css") layer;', true ],
                [ '@import url( "styles.css" ) layer();', true ]
            ];

            testCases.forEach( function( testCase, idx )
            {
                assert.deepStrictEqual( util.parseCSSImportRule( testCase[ 0 ] ), {
                    url: "styles.css",
                    layer: testCase[ 1 ],
                    supports: null,
                    media: null
                }, "Test case #" + idx + " failed." );
            } );
        } );

        it( "should parse @import rule with a cascade layer and media queries", function()
        {
            var testCases = [
                [ '@import "styles.css" layer(utilities) screen and (orientation: landscape) ;', "utilities" ],
                [ '@import url("styles.css") layer screen and (orientation: landscape);', true ],
                [ '@import url( "styles.css" ) layer() screen and (orientation: landscape) ;', true ]
            ];

            testCases.forEach( function( testCase, idx )
            {
                assert.deepStrictEqual( util.parseCSSImportRule( testCase[ 0 ] ), {
                    url: "styles.css",
                    layer: testCase[ 1 ],
                    supports: null,
                    media: "screen and (orientation: landscape)"
                }, "Test case #" + idx + " failed." );
            } );
        } );

        it( "should parse @import rule with feature conditional", function()
        {
            var testCases = [
                [ '@import "styles.css" supports(display: grid);', "display: grid" ],
                [ '@import url("styles.css") supports( (not (display: grid))\n and\n (display: flex) ) ;', "(not (display: grid))\n and\n (display: flex)" ],
                [ '@import url( "styles.css" )\nsupports((selector(h2 > p)) and (font-tech(color-COLRv1)));', "(selector(h2 > p)) and (font-tech(color-COLRv1))" ]
            ];

            testCases.forEach( function( testCase, idx )
            {
                assert.deepStrictEqual( util.parseCSSImportRule( testCase[ 0 ] ), {
                    url: "styles.css",
                    layer: null,
                    supports: testCase[ 1 ],
                    media: null
                }, "Test case #" + idx + " failed." );
            } );
        } );

        it( "should parse @import rule with all options used", function()
        {
            var testCases = [
                [ '@import "styles.css" layer supports(display: grid);', true, "display: grid", null ],
                [ '@import url("styles.css") layer(utilities) supports( (not (display: grid))\n and\n (display: flex) ) ;', "utilities", "(not (display: grid))\n and\n (display: flex)", null ],
                [ '@import url( "styles.css" )\nlayer()\nsupports((selector(h2 > p)) and (font-tech(color-COLRv1)))\nscreen, print and (max-width: 800px);', true, "(selector(h2 > p)) and (font-tech(color-COLRv1))", "screen, print and (max-width: 800px)" ]
            ];

            testCases.forEach( function( testCase, idx )
            {
                assert.deepStrictEqual( util.parseCSSImportRule( testCase[ 0 ] ), {
                    url: "styles.css",
                    layer: testCase[ 1 ],
                    supports: testCase[ 2 ],
                    media: testCase[ 3 ]
                }, "Test case #" + idx + " failed." );
            } );
        } );
    } );

} );
