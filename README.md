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


INSTALLATION
============

Prerequisites:

 - node
 - git 1.7 or greater

To install to ~/git/gravity

	mkdir ~/git
	cd ~/git
	git clone git@github-ca.corp.zynga.com:ccampbell/gravity.git
	cd gravity
	git submodule update --init

Of course you can check it out wherever you like.  Just make sure you add the
gravity dir (in this example ~/git/gravity) to your path.


BASIC COMMANDS
==============

gravity serve
-------------

During development, you can run gravity as a local server that will perform
on-the-fly concatenation of your source.  In your project's directory (ie.,
wherever the gravity.map file is), run:

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


gravity get
-----------

If you just want to see a specific build target, you can do this:

	gravity get . final.js


MORE DOCUMENTATION
==================

See `FEATURES.md`
