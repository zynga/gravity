/*global Buffer, console, process, require*/
var
	atom = require('./atom/atom'),
	http = require('http'),
	url = require('url'),
	fs = require('fs'),
	spawn = require('child_process').spawn,

	// Parse command line args
	argv = process.argv,
	numArgs = argv.length,
	enoughArgs = numArgs == 4 || numArgs == 5,
	arg2 = enoughArgs ? argv[2] : undefined,
	arg3 = enoughArgs ? argv[3] : undefined,
	arg4 = enoughArgs ? argv[4] : undefined,
	arg3last = arg3.length - 1,
	baseDir = arg3.charAt(arg3last) == '/' ? arg3.substr(0, arg3last) : arg3,

	// Gravity Map
	gravMapFileName = 'gravity.map',
	gravMapFilePath = baseDir + '/' + gravMapFileName,
	gravMapText,
	map,

	// Server args
	commandServe = arg2 == 'serve',
	defaultHost = '127.0.0.1',
	defaultPort = 1337,
	hostPort = commandServe && (arg4 || ':').split(':'),
	serverHost = commandServe && (hostPort[0] || defaultHost),
	serverPort = commandServe && (hostPort[1] || defaultPort),

	// Build args
	commandBuild = arg2 == 'build',
	outDir = commandBuild && arg4,

	// Forward declare functions
	getTargetContent
;

if (!commandServe && (!commandBuild || !outDir)) {
	console.log('Usage:');
	console.log('  node gravity.js build <dir> <outDir>');
	console.log('    ...or...');
	console.log('  node gravity.js serve <dir> [<host>:<port>]');
	process.exit(1);
}

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

function resolvePath(obj, path) {
	var parts = path.split('/'), firstPart = parts.shift();
	return path === '' ? obj :
		parts.length == 1 ? obj[path] :
		obj ? resolvePath(obj[firstPart], parts.join('/')) : undefined;
}

function addLineHints(name, content) {
	var
		i = -1,
		lines = content.split('\n'),
		len = lines.length,
		out = []
	;
	while (++i < len) {
		out.push(lines[i] +
			((i % 10 == 9) ? ' //' + name + ':' + (i + 1) + '//' : ''));
	}
	return out.join('\n');
}

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

function packFile(constituents, finished) {
	var
		pack = atom.create(),
		i = -1,
		len = constituents.length
	;

	function fetchFile(path) {
		if (path.charAt(0) == '~' || resolvePath(map, path)) {
			getTargetContent(map, path, function (err, content) {
				if (err) {
					finished(err);
				} else {
					pack.set(path, content);
				}
			});
		} else {
			fs.readFile(baseDir + '/' + path, function (err, content) {
				if (err) {
					finished({ code: 502, message: 'Bad Gateway' });
				} else {
					pack.set(path, new Buffer(addLineHints(path, content + '')));
				}
			});
		}
	}

	while (++i < len) {
		fetchFile(constituents[i]);
	}

	pack.once(constituents, function () {
		var j = -1, out = [];
		out.push(new Buffer('/*\n * ' + constituents.join('\n * ') + '\n */\n'));
		while (++j < len) {
			out.push(new Buffer('\n/* ' + constituents[j] + ' */\n'));
			out.push(arguments[j]);
		}
		finished(null, joinBuffers(out));
	});
}

function getListing(map, callback) {
	var keys = [];
	for (var key in map) {
		if (map.hasOwnProperty(key) && key.charAt(0) != '~') {
			keys.push(key);
		}
	}
	callback(null, keys.join('\n'), 'listing');
}

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

function getSourceContent(path, relURL, callback) {
	// Handle proxied web resources.
	if (path.match(/^https?:\/\//)) {
		wget(path, callback);
		return;
	}

	// Load local file.
	var filePath = baseDir + '/' + path;
	fs.stat(filePath, function (err, stat) {
		if (err) {
			callback({ code: 404, message: 'Not Found' });
		} else if (stat.isDirectory()) {
			if (relURL.length) {
				filePath += '/' + relURL;
				fs.stat(filePath, function (err, stat) {
					if (err) {
						callback({ code: 404, message: 'Not Found' });
					} else {
						fs.readFile(filePath, callback);
					}
				});
			} else {
				getListing(path, callback);
			}
		} else {
			if (relURL.length) {
				callback({ code: 404, message: 'Not Found' });
			} else {
				fs.readFile(filePath, function (err, content) {
					callback(
						err ? { code: 500, message: 'Internal error' } : null,
						content
					);
				});
			}
		}
	});
}

getTargetContent = function (map, url, callback) {
	var
		parts = url.split('/'),
		nodeName = parts.shift(),
		node = map[nodeName],
		filePath,
		relURL = parts.join('/')
	;

	if (url === '') {
		getListing(map, callback);
		return;
	}

	switch (typeof node) {

		case 'object':
			if (node.length) {
				// Arrays specify a list of files to concatenate
				packFile(node, callback);
			} else {
				// Objects specify a subdirectory map.
				getTargetContent(node, relURL, callback);
			}
			break;

		// Strings are a relative file path at which to find the resource; or,
		// if they start with http[s]:// then we proxy them from the web.
		case 'string':
			getSourceContent(node, relURL, callback);
			break;

		// Nodes not defined in the gravity map are forbidden.
		case 'undefined':
			callback({ code: 403, message: 'Forbidden' });
	}
};

function runServer() {
	var
		favicon = new Buffer('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAC' +
		'jUlEQVR42o2Ty08TURTGv06HvktLgYKlhbaakpKY0ERrZGGEGDcmxoW6pUQ3rqAbjQtDde' +
		'lCXBhWJsX4B4grXahIjBswBFlICuJUKLY8AmU69jnt9YytDUoUJ/k67Tn3/O53Tu9VMcZw' +
		'2PP0Wl9vcltK33y+EP8zp/oXIOy3nW1qMw5+2iqEbEZdeHxm9eGhAKXIL+WHLXnVJY3ehO' +
		'lmIJAzwelyIa0up5c21yY3c+LdscWd+AHAo6A5eq5PDjXFOIjvsngBHnyLAcFVEXJDA9SO' +
		'dhi7e/CFK6RfCx+HCDJZB9z3NUYGz0uj9hEnmHwDuWdz2Hg1B5cggPEMJRuwkwA+JzlUyE' +
		'3GewTTyVigDnh5VLs7cLVo1Vw3A57HAHcR+DoOPLgN5IpgBSA7BQhrJFrPd3Yi3mGqOlD6' +
		'vlLOTJ08LaPhBGW7LUCHB4itA2+2aWvaZAMozQLJDIVpyRbPI3/cm64DLhcJ0CNDY6eska' +
		'Qn5Ui7ymoSjUxeIY4MLNLPFGndbsAvgPvCXkY45ZBhdJB7A2U5Ei0G7YhvACPrhTSQIDNL' +
		'FNpWIDbdfH0GT9p0whlWcNtbAR11wPEULJKoiG3SV5HMlGksFCIWshwHwWWaqANGvZboQE' +
		'IMteuAZpKOAGpyUMlTMbUiylXbioiFSpcL83qpvw5Q2vCvS4JTKsFC9g0qmjSlKhUgz6qd' +
		'7NXGonY4kHI3x8PvFzy/HaQ77sYxX0Ia0ZYZ+NoYWG0Updqbb22FKhjAzMpsPx2ktweOcs' +
		'RljnYlv4f4cjX+85P65cxmGH0+SHYLllPLQ/c+xCf+epluHbNGrJI83GKwWtVUqLHZkNOq' +
		'IRakyUQqrtyD+f+9jb30sir/xf6i/c8PgHMsthi8/IIAAAAASUVORK5CYII=', 'base64'),
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
		}
	;

	function log(msg) {
		console.log(new Date() + ' ' + msg);
	}

	function httpError(res, code, msg, fileName) {
		res.writeHead(code);
		msg = code + ' ' + msg + ': ' + fileName;
		res.end(msg);
		log(msg);
	}

	function listToHTML(list) {
		var
			lines = list.split('\n'),
			html = '<html><head><title></title><body><ul>',
			i = -1, item,
			len = lines.length
		;
		while (++i < len) {
			item = lines[i];
			html += '<li><a href="' + item + '">' + item + '</a></li>';
		}
		return html + '</ul></body></html>';
	}

	http.createServer(function (req, res) {
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

		if (false && path.charAt(0) == '~') {
			return httpError(res, 403, 'Forbidden', path);
		}

		if (path == 'favicon.ico') {
			res.writeHead(200, {
				'Content-Length': favicon.length,
				'Content-Type': 'image/x-icon'
			});
			res.end(favicon);
			return;
		}

		// Main client UI
		if (path === '' && !querystring) {
			res.writeHead(302, { 'Location': '/gravity.map' });
			res.end();
			return;
		}

		if (query.hasOwnProperty('src')) {

			// Fetch content for source file
			reqAtom.provide('content', function (done) {
				var sourcePath = query.src;
				getSourceContent(sourcePath, '', function (err, content) {
					if (err) {
						return httpError(res, err.code, err.message, path);
					}
					done(content);
				});
			});

		} else {

			readGravMap();

			if (path == gravMapFileName) {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(gravMapText);
				log('200 ' + logURL);
				return;
			}

			// Fetch content for target file
			reqAtom.provide('content', function (done) {
				getTargetContent(map, path, function (err, content, type) {
					if (err) {
						return httpError(res, err.code, err.message, path);
					}

					if (type == 'listing') {
						if (path && path.charAt(path.length - 1) != '/') {
							res.writeHead(303, { Location: path + '/' });
							res.end();
							return;
						}
						content += '';
						if (!path || path == '/') {
							content = gravMapFileName + '\n' + content;
						}
						res.writeHead(200, { 'Content-Type': 'text/html' });
						res.end(listToHTML(content + ''));
						log('200 ' + logURL);
						return;
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

	}).listen(serverPort, serverHost);

	console.log('Gravity server running on http://' + serverHost + ':' +
		serverPort + '/');
}

if (commandServe) {
	runServer();
}

function runBuild() {
	var
		dryrun = false,
		exec = require('child_process').exec
	;

	function log(msg) {
		console.log((dryrun ? '[dry-run] ' : '') + msg);
	}

	function buildError(msg) {
		log('ERROR: ' + msg);
		process.exit(1);
	}

	var actions = {

		buildDir: function (mapPath, outDir, done) {
			outDir += outDir.charAt(outDir.length - 1) != '/' ? '/' : '';
			//log('buildDir(' + mapPath + ', ' + outDir + ', ...)');
			var a = atom.create();

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
					isString = typeof node == 'string',
					isURL = isString && node.match(/^https?:\/\//),
					isDir = isString && !isURL &&
						fs.statSync(baseDir + '/' + node).isDirectory(),
					action = isString ?
						(isDir ? 'copyDir' : 'fetchContent') :
						node.length ? 'fetchContent' : 'buildDir'
				;

				// Add this build action to the queue.
				a.chain(function (nextNode) {
					actions[action](
						(mapPath ? (mapPath + '/') : '') + key,
						outDir + key,
						nextNode
					);
				});
			}

			var dirMap = resolvePath(map, mapPath);
			for (var key in dirMap) {
				if (dirMap.hasOwnProperty(key)) {
					if (key.charAt(0) != '~') {
						queueNode(key, dirMap[key]);
					}
				}
			}

			a.chain(done);
		},

		copyDir: function (mapPath, dstDir, done) {
			//log('copyDir(' + mapPath + ', ' + dstDir + ', ...)');
			var
				srcDir = resolvePath(map, mapPath),
				command = 'cp -r ' + baseDir + '/' + srcDir + ' ' + dstDir,
				msg = 'A ' + dstDir + '/[*]'
			;
			if (dryrun) {
				log(command);
				log(msg);
				done();
			} else {
				exec(
					command,
					function (err, stdout, sterr) {
						if (err) {
							buildError('Could not copy directory: ' + srcDir);
						}
						log(msg);
						done();
					}
				);
			}
		},

		fetchContent: function (mapPath, dstPath, done) {
			//log('fetchContent(' + mapPath + ', ' + dstPath + ', ...)');
			var msg = 'A ' + dstPath, ext = dstPath.split('.').pop();
			getTargetContent(map, mapPath, function (err, content) {
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

if (commandBuild) {
	runBuild();
}
