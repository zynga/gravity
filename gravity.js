/*global __dirname, Buffer, console, process, require*/
var
	VERSION = '0.2.6',

	// Parse command line args
	args = (function (argv) {
		var
			len = argv.length,
			arg2 = len > 2 && argv[2],
			arg3 = len > 3 && argv[3],
			arg4 = len > 4 && argv[4],
			slash = arg3 && (arg3.length - 1),
			args = {},
			hostPort
		;

		if (arg2 === 'version' || arg2 === 'serve' || arg2 === 'build') {
			console.log('gravity version ' + VERSION);
			if (arg2 === 'version') {
				process.exit(0);
			}
		}
			
		if (len < 4 ||
			(arg2 !== 'serve' && arg2 !== 'get' && arg2 !== 'build') ||
			(arg2 === 'get' && len < 5) ||
			(arg2 === 'build' && len < 5))
		{
			console.log('Usage:');
			console.log('  gravity serve <dir> [[<host>]:[<port>]]');
			console.log('    or');
			console.log('  gravity get <dir> <path>');
			console.log('    or');
			console.log('  gravity build <dir> <outdir>');
			process.exit(1);
		}

		args.serve = arg2 === 'serve';
		args.get = arg2 === 'get';
		args.build = arg2 === 'build';
		args.dir = arg3.charAt(slash) === '/' ? arg3.substr(0, slash) : arg3;

		if (args.serve) {
			hostPort = (arg4 || ':').split(':');
			args.host = hostPort[0];
			args.port = hostPort[1];
		}

		if (args.get) {
			args.path = arg4;
		}

		if (args.build) {
			args.outDir = arg4;
		}

		return args;
	}(process.argv)),

	baseDir = args.dir,

	atom = require('./atom/atom'),
	http = require('http'),
	url = require('url'),
	fs = require('fs'),
	exec = require('child_process').exec,

	// Gravity Map
	gravMapFileName = 'gravity.map',
	gravMapFilePath = baseDir + '/' + gravMapFileName,
	gravMapText,
	map,

	// Style
	cssConverter = require('./style/cssConverter'),
	styleJSFilePath = __dirname + '/style/style.js',

	// Server args
	defaultHost = '127.0.0.1',
	defaultPort = 1337,
	serverHost = args.host || defaultHost,
	serverPort = args.port || defaultPort,

	// Build args
	outDir = args.outDir,

	// Functions
	isArray = Array.isArray || function (obj) {
		return Object.prototype.toString.call(obj) === '[object Array]';
	},
	packResources
;


function readGravMap() {
	gravMapText = fs.readFileSync(gravMapFilePath) + '';
	map = JSON.parse(gravMapText);
}


try {
	readGravMap();
} catch (ex) {
	console.log('Gravity: no map found at ' + gravMapFilePath);
	process.exit(1);
}


function hasExtension(path, ext) {
	return path.substr(path.length - ext.length) === ext;
}


function isURL(str) {
	return !!str.match(/^https?:\/\//);
}


// Add JavaScript line-hint comments to every 10th line of a file.
function addLineHints(name, content) {
	var
		i = -1,
		lines = content.split('\n'),
		len = lines.length,
		out = []
	;
	while (++i < len) {
		out.push(lines[i] +
			((i % 10 === 9) ? ' //' + name + ':' + (i + 1) + '//' : ''));
	}
	return out.join('\n');
}


// Concatentate an array of Buffers into a single one.
function joinBuffers(buffers) {
	var
		i = -1, j = -1,
		num = buffers.length,
		totalBytes = 0,
		bytesWritten = 0,
		buff,
		superBuff
	;
	while (++i < num) {
		totalBytes += buffers[i].length;
	}
	superBuff = new Buffer(totalBytes);
	while (++j < num) {
		buff = buffers[j];
		buff.copy(superBuff, bytesWritten, 0);
		bytesWritten += buff.length;
	}
	return superBuff;
}


// Given a web URL, fetch the file contents.
function wget(fileURL, callback) {
	var chunks = [], parsed = url.parse(fileURL);
	http.get(
		{
			host: parsed.host,
			port: parsed.port || 80,
			path: parsed.pathname
		},
		function (res) {
			res.on('data', function (chunk) {
				chunks.push(chunk);
			}).on('end', function () {
				callback(null, joinBuffers(chunks));
			});
		}
	);
}


// Given a resource path, return an enumeration of the possible ways to split
// the path at '/' boundaries, in order of specificity. For instance, the path
// 'assets/images/foo.png' would be broken down like so:
//
//  [ [ 'assets/images/foo.png', '' ],
//    [ 'assets/images', 'foo.png' ],
//    [ 'assets', 'images/foo.png' ],
//    [ '', 'assets/images/foo.png' ] ]
//
function getResourcePathSplits(path) {
	var
		parts = path.split('/'),
		i = parts.length,
		splits = [[path, '']]
	;
	while (--i >= 0) {
		splits.push([
			parts.slice(0, i).join('/'),
			parts.slice(i).join('/')
		]);
	}
	return splits;
}


// Given a map and a resource path, drill down in the map to find the most
// specific map node that matches the path.  Return the map node, the matched
// path prefix, and the unmatched path suffix.
function reduce(map, path) {
	var mapNode, prefix, split, splits = getResourcePathSplits(path),
		subValue, suffix;
	while (splits.length) {
		split = splits.shift();
		prefix = split[0];
		suffix = split[1];
		mapNode = map[prefix];
		if (mapNode) {
			if (!suffix) {
				return { map: mapNode, prefix: prefix, suffix: suffix };
			}
			if (typeof mapNode === 'object') {
				subValue = reduce(mapNode, suffix);
				if (subValue) {
					subValue.prefix = prefix + '/' + subValue.prefix;
					return subValue;
				}
			}
		}
	}
	return { map: map, prefix: '', suffix: path };
}


// Given a local file path (relative to baseDir), fetch the file contents.
function getFile(path, callback, addLineHints) {
	var filePath = baseDir + '/' + path;
	//console.log('getFile(' + filePath + ')');
	fs.stat(filePath, function (err, stat) {
		if (err || stat.isDirectory()) {
			callback({ code: 404, message: 'Not Found' });
		} else {
			fs.readFile(filePath, function (err, content) {
				callback(
					err ? { code: 500, message: 'Internal error' } : null,
					(addLineHints && hasExtension(filePath, '.js')) ?
						new Buffer(addLineHints(path, content + '')) : content
				);
			});
		}
	});
}


function handleDirective(directive, callback) {
	var licenseText, lines, content;
	if (directive.indexOf('license=') === 0) {
		licenseText = fs.readFileSync(directive.substr(8)) + '';
		lines = licenseText.split('\n');
		if (lines.length && lines[lines.length - 1] === '') {
			lines.pop();
		}
		content = '/**\n * @license\n * ' + lines.join('\n * ') + '\n */\n';
		callback(null, new Buffer(content));
	}
}


// Given a resource path, retrieve the associated content.  Internal requests
// are always allowed, whereas external requests will only have access to
// resources explicitly exposed by the gravity map.
function getResource(internal, path, callback, addLineHints) {
	var
		reduced = reduce(map, path),
		reducedMap = reduced.map,
		reducedMapType = isArray(reducedMap) ? 'array' : typeof reducedMap,
		reducedPrefix = reduced.prefix,
		reducedSuffix = reduced.suffix,
		firstChar = path.charAt(0),
		temporary = firstChar === '~',
		literal = firstChar === '=',
		directive = firstChar === '@'
	;
	//console.log('getResource(' + internal + ', ' + path + ', ...)');

	if (directive) {
		handleDirective(path.substr(1), callback);

	} else if (literal) {
		callback(null, new Buffer(path.substr(1) + '\n'));

	} else if (temporary && !internal) {
		// External request for a temporary resource.
		callback({ code: 403, message: 'Forbidden' });

	} else if (reducedSuffix) {
		// We did NOT find an exact match in the map.

		if (!reducedPrefix && internal) {
			getFile(path, callback, addLineHints);
		} else if (reducedMap === true) {
			getFile(reducedPrefix + '/' + reducedSuffix, callback, addLineHints);
		} else if (reducedMapType === 'string') {
			getFile(reducedMap + '/' + reducedSuffix, callback, addLineHints);
		} else {
			callback({ code: 404, message: 'Not Found' });
		}

	} else {
		// We found an exact match in the map.

		if (reducedMap === true || reducedMap === reducedPrefix) {
			// A true value means this is just a local file/dir to expose.
			getFile(reducedPrefix, callback, addLineHints);

		} else if (reducedMapType === 'string') {
			// A string value may be a web URL.
			if (isURL(reducedMap)) {
				wget(reducedMap, callback);
			} else {
				// Otherwise, it's another resource path.
				getResource(true, reducedMap, callback, addLineHints);
			}

		} else if (reducedMapType === 'array') {
			// An array is a list of resources to get packed together.
			packResources(reducedMap, callback);

		//} else if (reducedMapType === 'object') {
			// An object is a directory. We could return a listing...
			// TODO: Do we really want to support listings?

		} else {
			// WTF?
			callback({ code: 500, message: 'gravity.map is whack.' });
		}
	}
}


// Given a list of resource paths, fetch the contents and concatenate them
// together into a single blob.
packResources = function (resources, callback) {
	var
		packer = atom.create(),
		i = -1,
		len = resources.length
	;

	function fetchFile(resource) {
		getResource(
			true,
			resource,
			function (err, content) {
				if (err) {
					callback(err);
				} else {
					packer.set(resource, content);
				}
			},
			addLineHints
		);
	}

	while (++i < len) {
		fetchFile(resources[i]);
	}

	packer.once(resources, function () {
		var j = -1, out = [], resource, style, content;
		out.push(new Buffer('// ----------\n// Packing:\n// ' +
			resources.join('\n// ') + '\n// ----------\n'));
		while (++j < len) {
			resource = resources[j];
			content = arguments[j];
			if (hasExtension(resource, '.css')) {
				if (!style) {
					out.push(new Buffer(fs.readFileSync(styleJSFilePath) + ''));
					style = true;
				}
				content = new Buffer(cssConverter.convert(content + ''));
			}
			out.push(new Buffer('\n// Begin ' + resource + '\n'));
			out.push(content);
			out.push(new Buffer('\n// End ' + resource + '\n\n'));
		}
		if (style) {
			out.push(new Buffer('\nstyle.noConflict();\n'));
		}
		callback(null, joinBuffers(out));
	});
};


function runServer() {
	var
		mimeTypes = {
			css: 'text/css',
			html: 'text/html',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			js: 'text/javascript',
			json: 'application/json',
			png: 'image/png',
			txt: 'text/plain',
			xml: 'text/xml'
		},
		serverTries = 0
	;

	function log(msg) {
		console.log(new Date() + ' ' + msg);
	}

	function httpError(res, code, msg, fileName, suppressLog) {
		res.writeHead(code);
		msg = code + ' ' + msg + ': ' + fileName;
		res.end(msg);
		if (!suppressLog) {
			log(msg);
		}
	}

	function requestHandler(req, res) {
		var
			parsedURL = url.parse(req.url),
			slashpath = parsedURL.pathname,
			query = url.parse(req.url, true).query,
			querystring = parsedURL.query,
			path = slashpath.substr(1),
			dotparts = path.split('.'),
			ext = dotparts.pop(),
			reqAtom = atom.create(),
			logURL = slashpath
		;
		if (querystring) {
			logURL += '?' + querystring;
		}

		if (path === 'favicon.ico') {
			return httpError(res, 404, 'Not Found', path, true);
		}

		if (path === '' && !querystring) {
			res.writeHead(302, { 'Location': '/gravity.map' });
			res.end();
			return;
		}

		if (query.hasOwnProperty('src')) {

			// Fetch content for source file
			reqAtom.provide('content', function (done) {
				var sourcePath = query.src;
				getResource(true, sourcePath, function (err, content) {
					if (err) {
						return httpError(res, err.code, err.message, path);
					}
					done(content);
				});
			});

		} else {

			readGravMap();

			if (path === gravMapFileName) {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(gravMapText);
				log('200 ' + logURL);
				return;
			}

			// Fetch content for target file
			reqAtom.provide('content', function (done) {
				getResource(false, path, function (err, content) {
					if (err) {
						return httpError(res, err.code, err.message, path);
					}
					done(content);
				});
			});
		}

		reqAtom.need('content', function (content) {
			// Return the file contents.
			var
				parts = path.split('.'),
				ext = parts[parts.length - 1],
				mimeType = mimeTypes[ext] || 'text/plain'
			;
			res.writeHead(200, { 'Content-Type': mimeType });
			res.end(content, 'binary');
			log('200 ' + logURL);
		});
	}

	while (++serverTries < 20) {
		try {
			http.createServer(requestHandler).listen(serverPort, serverHost);
			console.log('Gravity server running on http://' + serverHost + ':' +
				serverPort + '/');
			break;
		} catch (ex) {
			if (serverPort === args.port) {
				console.log('Port ' + args.port + ' not available.');
			}
			serverPort++;
		}
	}
}


if (args.serve) {
	runServer();
}


if (args.get) {
	getResource(false, args.path, function (err, content) {
		if (content) {
			console.log(content + '');
		}
	});
}


function runBuild() {
	var dryrun = false;

	function log(msg) {
		console.log((dryrun ? '[dry-run] ' : '') + msg);
	}

	function buildError(msg) {
		log('ERROR: ' + msg);
		process.exit(1);
	}

	var actions = {

		buildDir: function (path, outDir, callback) {
			var
				a = atom.create(),
				key,
				reduced = reduce(map, path),
				reducedMap = reduced.map
			;
			outDir += outDir.charAt(outDir.length - 1) !== '/' ? '/' : '';
			log('buildDir(' + path + ', ' + outDir + ', ...)');

			// Make sure the output dir exists.
			try {
				if (!fs.statSync(outDir).isDirectory()) {
					buildError('Can\'t put build results in ' + outDir +
						' because it is not a directory!');
				}
			} catch (ex) {
				if (dryrun) {
					log('mkdir ' + outDir);
				} else {
					fs.mkdirSync(outDir, '0755');
				}
			}

			function queueNode(key, node) {
				// Determine which action to use for this node.
				var
					isString = typeof node === 'string',
					isDir = isString && !isURL(node) &&
						fs.statSync(baseDir + '/' + node).isDirectory(),
					action = isString ?
						(isDir ? 'copyDir' : 'fetchContent') :
						node.length ? 'fetchContent' : 'buildDir'
				;

				// Add this build action to the queue.
				a.chain(function (nextNode) {
					actions[action](
						(path ? (path + '/') : '') + key,
						outDir + key,
						nextNode
					);
				});
			}

			for (key in reducedMap) {
				if (reducedMap.hasOwnProperty(key) && key.charAt(0) !== '~') {
					queueNode(key, reducedMap[key]);
				}
			}

			a.chain(callback);
		},

		copyDir: function (path, dstDir, callback) {
			var
				reduced = reduce(map, path),
				reducedMap = reduced.map,
				reducedMapType = typeof reducedMap,
				srcDir = reducedMapType === 'string' ? reducedMap : reduced.prefix,
				command = 'cp -r ' + baseDir + '/' + srcDir + ' ' + dstDir,
				msg = 'A ' + dstDir + '/[*]'
			;
			log('copyDir(' + path + ', ' + dstDir + ', ...)');
			if (dryrun) {
				log(command);
				log(msg);
				callback();
			} else {
				exec(
					command,
					function (err, stdout, sterr) {
						if (err) {
							buildError('Could not copy directory: ' + srcDir);
						}
						log(msg);
						callback();
					}
				);
			}
		},

		fetchContent: function (path, dstPath, done) {
			//log('fetchContent(' + mapPath + ', ' + dstPath + ', ...)');
			var msg = 'A ' + dstPath, ext = dstPath.split('.').pop();
			getResource(false, path, function (err, content) {
				if (err) {
					buildError('Could not retrieve content for ' + dstPath);
				}
				if (dryrun) {
					log(msg);
					done();
				} else {
					fs.open(dstPath, 'w', function (err, fd) {
						if (err) {
							buildError('Could not open file for writing: ' + dstPath);
						}
						try {
							fs.write(fd, content, 0, content.length, 0,
								function (err, written) {
									if (err) {
										buildError('Could not write to file (2): ' +
											dstPath);
									}
									log(msg);
									done();
								}
							);
						} catch (ex) {
							console.error(ex.message);
							buildError('Could not write to file (1): ' + dstPath);
						}
					});
				}
			});
		}
	};

	actions.buildDir('', outDir, function () {
		log('Gravity build complete: ' + outDir);
	});
}


if (args.build) {
	runBuild();
}
