OVERVIEW
========

Often when deploying JS components, you want to compile a multitude of source
files down to a single build result.  The benefits of doing this include faster
performance from the client perspective (due to fewer http hits to load
scripts), and potentially simpler integration by the developer integrating your
component. Gravity was specifically designed to ease this process.

`gravity` is a command-line tool that reads `gravity.map` files.

A `gravity.map` is a JSON file that can be thought of as a project manifest.  In
it, you can specify build targets, and the source files that are used to create
each target.

	{
		"final.js": [
			"src/1.js",
			"src/2.js",
			...
		]
	}

This tells gravity that you want a build product called `final.js`, and that it
should be the result of compiling various source files (or even other build
products) together.


BASIC COMMANDS
==============

gravity serve
-------------

During development, you can run gravity as a local server that will perform
on-the-fly concatenation of your source.  In your project dir, run:

	gravity serve .

The server should find an available local port to attach to, and will announce
itself:

	Gravity server running on http://127.0.0.1:1337/

Now you can visit http://127.0.0.1:1337/final.js to see the results.  Edit a
source file, then refresh the page to see the change instantly!

If you want your gravity server to bind to a specific host or port, you can
specify those:

	gravity serve . <host>:<port>


gravity build
-------------

Come build time, run a command like this:

	gravity build . <outdir>

Gravity will take only your build targets and put them into `<outdir>`.

If you want to apply code minification, use the `--minify` argument:

	gravity build --minify . <outdir>


gravity get
-----------

If you just want to see a specific build target, you can do this:

	gravity get . final.js

Or, with minification:

	gravity get --minify . final.js


GRAVITY MAP SYNTAX / FEATURES
=============================

Temporary Build Products (~)
----------------------------

Temporary build products are indicated with a tilde (~) at the beginning of the
build target name.  They are not part of the final output, but they can be used
as inputs to final build products.

For example, use gravity to create localized components.  Assuming you've got
localized strings in individual files under a `strings` dir, you can define
locale-specific build targets that make use of an intermediary build target
containing all of the business logic / UI code, etc.

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


The @license Directive
----------------------

You can tell gravity to load a text license file and put the contents into a
block comment like this:

	{
		"myProduct.js": [
			"@license=LICENSE",
			"src/1.js",
			...
		]
	}

If the LICENSE file looks like this:

	My Product
	Copyright © 2012 Zynga Inc.
	Author: me

Then the output will contain this:

	/*!
	 * @license
	 * My Product
	 * Copyright © 2012 Zynga Inc.
	 * Author: me
	 */


Converting CSS To JS
--------------------

You can include a CSS file in your composition of a JS file.  If you do, the CSS
will be converted to JavaScript using the style.add() notation:
https://github-ca.corp.zynga.com/ccampbell/style

	{
		"ui.js": {
			"widgets.css",
			"widgets.js"
		}
	}

* Note that this does NOT yet handle CSS containing @import or relative image
URLs.
