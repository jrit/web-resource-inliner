var extend = require( "./util/extend" );

module.exports = function ( options ) {
    return extend( {
        images: 8,
        svgs: 8,
        scripts: true,
        links: true,
        cssmin: false,
        strict: false,
        relativeTo: "",
        rebaseRelativeTo: "",
        inlineAttribute: "data-inline",
        fileContent: "",
        requestTransform: undefined,
        scriptTransform: undefined,
        linkTransform: undefined
    }, options );
};
