Overview
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

```json
	{
		"final.js": [
			"src/1.js",
			"src/2.js",
			...
		]
	}
```

This tells gravity that you want a build product called `final.js`, and that it
should be the result of compiling various source files (or even other build
products) together.

Full documentation of gravity.map syntax can be found in [SYNTAX.md](SYNTAX.md).


Installation
============

Prerequisites:

 - node 0.8 or greater
 - git 1.7 or greater

It is recommended to install for all users:

	sudo npm install -g gravity-js

However, if you prefer it can also be installed in your home dir:

	npm install gravity-js


Commands
========

Mac/unix/cygwin users will be able to invoke "gravity" directly.  To run the
commands in Windows cmd.exe, just prepend "node " to the commands below.

All of the folling commands have `<dir>` as an optional parameter.  If it is not
specified, then it is assumed to be the current directory.

### gravity list

To see a list of all the build products, where `<dir>` is the location of your
project's directory (ie., wherever the gravity.map file is):

	gravity list [<dir>]

### gravity serve

During development, you can run gravity as a local server that will perform
on-the-fly concatenation of your source.

	gravity serve [<dir>] localhost:1337

The server should find an available local port to attach to, and will announce
itself:

	Gravity server running on http://localhost:1337/

Now you can visit http://localhost:1337/final.js to see the results.  Edit a
source file, then refresh the page to see the change instantly!

Can also be run as a background process.

	gravity serve [<dir>] <host>:<port> &


### gravity build

Come build time, run a command like this:

	gravity build [<dir>] <outdir>

Gravity will take only your build targets and put them into `<outdir>`.


### gravity pull (a.k.a get)

If you just want to see a specific build target produced and dumped to stdout,
you can do this:

	gravity pull [<dir>] final.js


Unit Tests
==========

	node test.js // Run unit tests silently
	node test.js -v // Run unit tests verbosely
