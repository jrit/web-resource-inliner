# web-resource-inliner[![build status](https://secure.travis-ci.org/jrit/web-resource-inliner.png)](http://travis-ci.org/jrit/web-resource-inliner)

Brings externally referenced resources, such as js, css and images, into
a single file.

For example:

````
<link href="css/style.css" rel="stylesheet" data-inline >
````
is replaced with
````
<style>
/* contents of css/style.css */
</style>
```

Javascript references are brought inline, and images in the html
and css blocks are converted to base-64 data: urls.

By default, all links and scripts are inlined, plus any images under 8KB, however this
behavior can be overrided via several options.


## Getting Started
```
npm install https://github.com/jrit/web-resource-inliner.git
```


## Usage Examples

For a number of usage examples, see ./test/spec.js and the associated test.* and test_out.* files in ./test/cases/

## Methods

#### html( options, callback )
Expects options.fileContent to be HTML and creates a new HTML document. `callback` will be called on completion or error with arguments `( error, result )`.

#### css( options, callback )
Expects options.fileContent to be CSS and creates a new CSS document. `callback` will be called on completion or error with arguments `( error, result )`.


## Options

#### `fileContent`, required
This is the HTML or CSS content to be inlined, you should provide HTML to the `html()` method and CSS to the `css()` method or you will get errors or garbage output.

#### `inlineAttribute`, string, default `data-inline`
Sets the attribute that is used to include/exclude specific resources based on the default behavior for the resource type. For example, if `scripts` is set to `false`, an individual script can be inlined by adding the attribute to the `script` tag like `<script src="myscript.js" data-inline ></script>`. On the other hand, if `images` are set to be inlined by default, a specific image can be excluded by adding `-ignore` to the end of the `inlineAttribute` like `<img src="myimg.png" data-inline-ignore >`. In CSS, a comment is required at the end of the line to perform the same thing, such as `/*data-inline*/` or `/*data-inline-ignore*/`.

#### `images`, Boolean or Number, default `8`
When true, inline images unless they have an exclusion attribute (see inlineAttribute option). When false, exclude images unless they have an inclusion attribute (see inlineAttribute option). When a number, inline images only when the base64 content size is less than the number of KBs. For example, the default is to only inline images less than 8KB.

#### `scripts`, Boolean or Number, default `true`
When true, inline scripts unless they have an exclusion attribute (see inlineAttribute option). When false, exclude scripts unless they have an inclusion attribute (see inlineAttribute option). When a number, inline scripts only when the base64 content size is less than the number of KBs.

#### `links`, Boolean or Number, default `true`
When true, inline stylesheet links unless they have an exclusion attribute (see inlineAttribute option). When false, exclude stylesheet links unless they have an inclusion attribute (see inlineAttribute option). When a number, inline stylesheet links only when the base64 content size is less than the number of KBs.

#### `relativeTo`, string, default empty string
Describes the path relationship between where web-resource-inliner is running and what the relative paths in `fileContent` refer to. For example, the tests cases in this package are in `test/cases/` so their relative paths start by referring to that folder, but the root of this project and where `npm test` runs from is 2 folders up, so `relativeTo` is set to `test/cases/` in `test/spec.js`.

#### `rebaseRelativeTo`, string, default empty string
Describes the path relationship between CSS content and the context it will be loaded in. For example, when a CSS file contains `url(some-file.png)` and the file is moved from a location in a folder like `/css` to `/` then the path to the image needs to be changed to `url(css/some-file.png)`. In this case, `rebaseRelativeTo` would be `css`. You probably don't want to set this when you are using `html()`.

#### `cssmin`, Boolean, default `false`
If cssmin is assigned `true`, CSS will be minified before inlined.

#### `uglify`, Boolean, default `false`
If uglify is assigned `true`, JavaScript file will be minified before inlined.


## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Run tests with `npm test`.


## Release History
* 2015-01-01 v1.0.0 initial release: Forked and rewritten from grunt-inline with the goal of providing additional use cases and a new API
