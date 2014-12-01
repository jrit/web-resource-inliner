/*
 * grunt-inline
 * https://github.com/chyingp/grunt-inline
 *
 * Copyright (c) 2014 Auguest G. casper & IMWEB TEAM
 */

'use strict';


var path = require('path');
var datauri = require('datauri');
var UglifyJS = require('uglify-js');
var CleanCSS = require('clean-css');
var xtend = require('xtend');
var fs = require('fs');
var request = require('request');
var async = require('async');

var defaults = {
    images: false,
    scripts: true,
    links: true,
    uglify: false,
    cssmin: false,
    relativeTo: '',
    inlineAttribute: '', //TODO: implement
    fileContent: ''
};

var inline = {};

module.exports = inline;


var isRemotePath = function(url) {
    return url.match(/^'?https?:\/\//) || url.match(/^\/\//);
};

var isBase64Path = function(url) {
    return url.match(/^'?data.*base64/);
};

var getDataAttribs = function(attrs) {
    var reg = /(data-[\a-z-]+="[\w-]+")/gm;
    return attrs.match(reg) || [];
};

var getRemote = function(uri, callback, toDataUri) {
    request({
            uri: uri,
            encoding: toDataUri ? "binary" : ""
        },
        function(err, response, body) {
            if (err) {
                throw err; //kill it
            }

            if (toDataUri) {
                var b64 = new Buffer(body.toString(), "binary").toString("base64");
                var datauriContent = "data:" + response.headers["content-type"] + ";base64," + b64;
                callback(null, datauriContent);
            } else {

                callback(null, body);
            }
        });
};


inline.html = function(options) {
    var settings = xtend({}, defaults, options);

    var getInlineFilePath = function(src) {
        src = src.replace(/^\//, '');
        return (path.resolve(settings.relativeTo, src).replace(/\?.*$/, ''));
    };

    var getInlineFileContents = function(src) {
        return (fs.readFileSync(getInlineFilePath(src)));
    };

    var getTextReplacement = function(src, callback) {
        if (isRemotePath(src)) {
            getRemote(src, callback);
        } else {
            callback(null, getInlineFileContents(src));
        }
    };

    var getFileReplacement = function(src, callback) {
        if (isRemotePath(src)) {
            getRemote(src, callback, true);
        } else {
            callback(null, (new datauri(getInlineFilePath(src))).content);
        }
    };

    var replaceScript = function(callback) {
        var args = this;
        //var dataAttribs = getDataAttribs(attrs); //TODO: restore

        if (settings.scripts) {
            getTextReplacement(args.src, function(err, content) {
                var js = options.uglify ? UglifyJS.minify(content).code : content;
                var html = '<script>\n' + js + '\n</script>';
                result = result.replace(new RegExp("<script.+?src=[\"'](" + args.src + ")[\"'].*?>\s*<\/script>", "g"), html);
                callback(null);
            });
        }
    };

    var replaceLink = function(callback) {
        var args = this;

        if (settings.links) {
            getTextReplacement(args.src, function(err, content) {
                var html = '<style>\n' + content + '\n</style>';
                result = result.replace(new RegExp("<link.+?href=[\"'](" + args.src + ")[\"'].*?\/?>", "g"), html);
                callback(null);
            });
        }
    };

    var replaceImg = function(callback) {
        var args = this;

        if (settings.images) {
            getFileReplacement(args.src, function(err, datauriContent) {
                var html = '<img src="' + datauriContent + '" />';
                result = result.replace(new RegExp("<img.+?src=[\"'](" + args.src + ")[\"'].*?\/?\s*?>", "g"), html);
                callback(null);
            });
        }
    };

    var result = settings.fileContent;
    var tasks = [];
    var found;

    var scriptRegex = /<script.+?src=["'](\/?[^"']+?)["'].*?>\s*<\/script>/g;
    while ((found = scriptRegex.exec(result)) !== null) {
        tasks.push(replaceScript.bind({
            src: found[1]
        }));
    }

    var linkRegex = /<link.+?href=["'](\/?[^"']+?)["'].*?\/?>/g;
    while ((found = linkRegex.exec(result)) !== null) {
        tasks.push(replaceLink.bind({
            src: found[1]
        }));
    }

    var imgRegex = /<img.+?src=["'](\/?[^"']+?)["'].*?\/?\s*?>/g;
    while ((found = imgRegex.exec(result)) !== null) {
        tasks.push(replaceImg.bind({
            src: found[1]
        }));
    }


    async.parallel(tasks, function() {
        settings.callback(null, result);
    });
}

//TODO: neglected, need to rewrite
inline.css = function(options) {
    var settings = xtend({}, defaults, options);

    if (relativeTo) {
        settings.filepath = settings.filepath.replace(/[^\/]+\//g, relativeTo);
    }

    fileContent = fileContent.replace(/url\(["']*([^)'"]+)["']*\)/g, function(matchedWord, imgUrl) {
        var newUrl = imgUrl;
        var flag = imgUrl.indexOf(options.tag) != -1; // urls like "img/bg.png?__inline" will be transformed to base64
        if (isBase64Path(imgUrl) || isRemotePath(imgUrl)) {
            return matchedWord;
        }
        var absoluteImgurl = path.resolve(path.dirname(filepath), imgUrl);
        newUrl = path.relative(path.dirname(filepath), absoluteImgurl);

        absoluteImgurl = absoluteImgurl.replace(/\?.*$/, '');
        if (flag && grunt.file.exists(absoluteImgurl)) {
            newUrl = datauri(absoluteImgurl);
        } else {
            newUrl = newUrl.replace(/\\/g, '/');
        }

        return matchedWord.replace(imgUrl, newUrl);
    });
    fileContent = options.cssmin ? CleanCSS.process(fileContent) : fileContent;

    return fileContent;
}
