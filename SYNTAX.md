Syntax of gravity.map files
===========================

A `gravity.map` file must be valid JSON, with the exception that
JavaScript-style line comments are allowed, as long as the first non-whitespace
characters on the line are "//".

```javascript
	{
		// Example
	}
```


Temporary Build Products (~)
----------------------------

Temporary build products are indicated with a tilde (~) at the beginning of the
build target name.  They are not part of the final output, but they can be used
as inputs to final build products.

For example, use gravity to create localized components.  Assuming you've got
localized strings in individual files under a `strings` dir, you can define
locale-specific build targets that make use of an intermediary build target
containing all of the business logic / UI code, etc.

```json
	{
		"~engine.js": [
			"src/utils.js",
			"src/controller.js",
			"src/ui.js",
			"src/api.js",
			"src/glue.js",
			...
		],

		"engine-en_US.js": [
			"strings/en_US.js",
			"~engine.js"
		],

		"engine-es_ES.js": [
			"strings/es_ES.js",
			"~engine.js"
		],

		...
	}
```

In the above example, `~engine.js` is a temporary build product, meaning it will
not be placed into `<outdir>` or served up at a URL.  However, it defines a
common constituent to the final build products (`engine-<locale>.js`).

Now, with a minimum of fuss, you have nice tight bundles of localized JS
goodness.


Literals (=)
------------

Literals are strings that get put into the build product verbatim, rather than
referring to a source file or url.  Literals always begin with an equals sign
(which is omitted from the result).

They are useful for inserting one-liner comments or scoping functions, etc.

```json
	{
		"encapsulated.js": [
			"=// Encapsulate some assorted modules",
			"=(function () {",
			"src/1.js",
			"src/2.js",
			...
			"=}());"
		]
	}
```


Directories (/)
---------------

Build products can be organized into subdirectories using two different
techniques.  To simply include a source directory in the build output, do this:

```json
	{
		"images/": "src/images"
	}
```

(The trailing slash in the property name is necessary.)

The above method will include ALL contents of the src/images directory in the
build output "images/" directory.

Another option is to create a target directory with only explicit contents.

```json
	{
		"images/": {
			"background.png": "src/assets/bg.png",
			"logo.png": "branding/logo-50x50px.png"
		}
	}
```
