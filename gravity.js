/*global Buffer, global, module, process, require*/
(function () {

	// Make a module
	var gravity = (function (name) {
		var root = typeof window !== 'undefined' ? window : global,
			had = Object.prototype.hasOwnProperty.call(root, name),
			prev = root[name], me = root[name] = {};
		if (typeof module !== 'undefined' && module.exports) {
			module.exports = me;
		}
		me.noConflict = function () {
			root[name] = had ? prev : undefined;
			if (!had) {
				try {
					delete root[name];
				} catch (ex) {
				}
			}
			return this;
		};
		return me;
	}('gravity'));

	gravity.VERSION = '0.6.16';

	var
		atom = require('./atom/atom'),
		http = require('http'),
		url = require('url'),
		fs = require('fs'),
		packResources
	;

	// Private functions

	function endsWith(longStr, shortStr) {
		var longLen = longStr.length, shortLen = shortStr.length;
		return (longLen >= shortLen) &&
			(longStr.substr(longLen - shortLen) === shortStr);
	}
	function inArray(arr, value) {
		for (var i = arr.length; --i >= 0;) {
			if (arr[i] === value) {
				return true;
			}
		}
	}
	var isArray = Array.isArray || function (obj) {
		return Object.prototype.toString.call(obj) === '[object Array]';
	};
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
			suffix = split[1];
			prefix = suffix ? split[0] + '/' : split[0];
			mapNode = map[prefix];
			if (mapNode) {
				if (!suffix || typeof mapNode === 'string') {
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


	// Given a local file path (relative to base), fetch the file contents.
	function getFile(base, path, callback, addLineHints) {
		var filePath = base + '/' + path;
		fs.stat(filePath, function (err, stat) {
			if (err || stat.isDirectory()) {
				callback({ code: 404, message: 'Not Found: ' + path });
			} else {
				fs.readFile(filePath, function (err, content) {
					callback(
						err ? { code: 500, message: 'Internal error' } : null,
						(addLineHints && endsWith(filePath, '.js')) ?
							new Buffer(addLineHints(path, content + '')) : content
					);
				});
			}
		});
	}


	function nodeType(mapNode) {
		return isArray(mapNode) ? 'array' : typeof mapNode;
	}


	// Given a resource path, retrieve the associated content.  Internal requests
	// are always allowed, whereas external requests will only have access to
	// resources explicitly exposed by the gravity map.
	function getResource(map, base, internal, path, callback, addLineHints) {
		var
			reduced = reduce(map, path),
			reducedMap = reduced.map,
			reducedMapType = nodeType(reducedMap),
			reducedPrefix = reduced.prefix,
			reducedSuffix = reduced.suffix,
			firstChar = path.charAt(0),
			temporary = firstChar === '~',
			literal = firstChar === '='
		;

		if (literal) {
			callback(null, new Buffer(path.substr(1) + '\n'));

		} else if (temporary && !internal) {
			// External request for a temporary resource.
			callback({ code: 403, message: 'Forbidden' });

		} else if (reducedSuffix) {
			// We did NOT find an exact match in the map.

			if (!reducedPrefix && internal) {
				getFile(base, path, callback, addLineHints);
			} else if (reducedMapType === 'string') {
				getFile(base, reducedMap + '/' + reducedSuffix, callback, addLineHints);
			} else {
				callback({ code: 404, message: 'Not Found' });
			}

		} else {
			// We found an exact match in the map.

			if (reducedMap === reducedPrefix) {
				// This is just a local file/dir to expose.
				getFile(base, reducedPrefix, callback, addLineHints);

			} else if (reducedMapType === 'string') {
				// A string value may be a web URL.
				if (isURL(reducedMap)) {
					wget(reducedMap, callback);
				} else {
					// Otherwise, it's another resource path.
					getResource(map, base, true, reducedMap, callback, addLineHints);
				}

			} else if (reducedMapType === 'array') {
				// An array is a list of resources to get packed together.
				packResources(map, base, reducedMap, callback);

			//} else if (reducedMapType === 'object') {
				// An object is a directory. We could return a listing...
				// TODO: Do we really want to support listings?

			} else {
				callback({ code: 500, message: 'Unable to read gravity.map.' });
			}
		}
	}


	// Given a list of resource paths, fetch the contents and concatenate them
	// together into a single blob.
	packResources = function (map, base, resources, callback) {
		var
			packer = atom.create(),
			i = -1,
			len = resources.length
		;

		function fetchFile(resource) {
			getResource(
				map,
				base,
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
			var j = -1, out = [], resource;
			out.push(new Buffer('// ----------\n// Packing:\n// ' +
				resources.join('\n// ') + '\n// ----------\n'));
			while (++j < len) {
				resource = resources[j];
				out.push(new Buffer('\n// Begin ' + resource + '\n'));
				out.push(arguments[j]);
				out.push(new Buffer('\n// End ' + resource + '\n\n'));
			}
			callback(null, joinBuffers(out));
		});
	};

	function stripComments(text) {
		var
			line,
			lines = text.split('\n'),
			i = -1,
			len = lines.length,
			out = []
		;
		while (++i < len) {
			line = lines[i];
			if (!line.match(/^\s*\/\//)) {
				out.push(line);
			}
		}
		return out.join('\n');
	}

	function runServer(mapURI, base, host, preferredPort) {
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
			port = preferredPort,
			serverTries = 0,
			utf8Types = ['text/css', 'text/html', 'text/javascript',
				'application/json', 'text/plain', 'text/xml'],
			handlePortBindingError
		;

		function pad2(num) {
			return (num + 101 + '').substr(1);
		}

		function timestamp() {
			var
				d = new Date(),
				day = [d.getFullYear(), pad2(d.getMonth()), d.getDate()].join('-'),
				time = [pad2(d.getHours()), pad2(d.getMinutes()),
					pad2(d.getSeconds())].join(':')
			;
			return day + ' ' + time;
		}

		function log(msg) {
			console.log(timestamp() + ' [:' + port + '] ' + msg);
		}

		function httpError(res, code, msg, fileName, suppressLog) {
			res.writeHead(code);
			msg = code + ' ' + msg + ': ' + fileName;
			res.end(msg);
			if (!suppressLog) {
				log(msg);
			}
		}

		var server = http.createServer(function (req, res) {
			var
				parsedURL = url.parse(req.url),
				slashpath = parsedURL.pathname,
				query = url.parse(req.url, true).query,
				querystring = parsedURL.query,
				path = slashpath.substr(1),
				dotparts = path.split('.'),
				ext = dotparts.pop(),
				request = atom.create(),
				logURL = slashpath
			;
			if (querystring) {
				logURL += '?' + querystring;
			}

			if (path === 'favicon.ico') {
				return httpError(res, 404, 'Not Found', path, true);
			}

			gravity.map(mapURI, function (result) {
				request.set('map', result);
			});

			if (path === '') {
				request.once('map', function (map) {
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify(map));
					log('200 ' + logURL);
				});
				return;
			}

			// Fetch content for target file
			request.once('map', function (map) {
				gravity.pull(map, base, path, function (err, content) {
					if (err) {
						return httpError(res, err.code, err.message, path);
					}
					request.set('content', content);
				});
			});

			request.once('content', function (content) {
				// Return the file contents.
				var
					parts = path.split('.'),
					ext = parts[parts.length - 1],
					mimeType = mimeTypes[ext] || 'text/plain',
					contentType = mimeType
				;
				if (inArray(utf8Types, mimeType)) {
					contentType += '; charset=utf-8';
				}
				res.writeHead(200, { 'Content-Type': contentType });
				res.end(content, 'binary');
				log('200 ' + logURL);
			});
		});

		function tryBindingToPort() {
			try {
				server.listen(port, host);
			} catch (ex) {
				handlePortBindingError();
			}
		}

		handlePortBindingError = function () {
			if (port === preferredPort) {
				console.log('Port ' + preferredPort + ' not available.');
			}
			if (++serverTries < 20) {
				port++;
				tryBindingToPort();
			} else {
				console.log('Unable to find a port to bind to.');
				process.exit(1);
			}
		};

		server.on('listening', function () {
			console.log('Gravity server running on http://' + host + ':' +
				port + '/');
		});
		server.on('error', handlePortBindingError);

		tryBindingToPort();
	}

	function arrayEach(arr, callback) {
		var i = -1, len = arr && arr.length, rtval;
		while (++i < len) {
			rtval = callback(i, arr[i]);
			if (rtval === false) {
				break;
			}
		}
	}

	function eachMapProperty(map, callback) {
		for (var p in map) {
			if (map.hasOwnProperty(p)) {
				var node = map[p];
				callback(p, node, nodeType(node), endsWith(p, '/'));
			}
		}
	}

	function recursiveDirectoryListing(dir, callback) {
		var a = atom.create(), list = [];
		a.chain(function (next) {
			fs.readdir(dir, function (err, files) {
				arrayEach(files, function (i, file) {
					var subPath = dir + '/' + file;
					fs.lstat(subPath, function (err, stats) {
						if (err) {
							throw (err);
						}
						if (stats.isDirectory()) {
							recursiveDirectoryListing(subPath, function (sublist) {
								arrayEach(sublist, function (j, subitem) {
									list.push(file + '/' + subitem);
								});
								a.set(file, true);
							});
						} else {
							list.push(file);
							a.set(file, true);
						}
					});
				});
				a.once(files, next);
			});
		});
		a.chain(function () {
			callback(list);
		});
	}

	function getList(base, path, mapNode, callback) {
		var a = atom.create(), list = [];
		eachMapProperty(mapNode, function (prop, val, type, isDir) {
			if (prop.charAt(0) === '~') {
				return;
			}
			a.chain(function (next) {
				var pathProp = (path ? (path + '/') : '') + prop;

				function handleSublist(sublist) {
					var i = -1, len = sublist.length;
					while (++i < len) {
						list.push(pathProp + sublist[i]);
					}
					next();
				}

				if (type === 'object') {
					getList(base, pathProp, val, handleSublist);
				} else if (isDir) {
					// Use fs to list directory contents
					recursiveDirectoryListing(base + '/' + val, handleSublist);
				} else {
					list.push(pathProp);
					next();
				}
			});
		});
		a.chain(function () {
			callback(list);
		});
	}

	function write(outDir, path, content, callback) {
		var call = atom.create(), outPath = outDir + '/' + path;
		console.log('write ' + outPath);
		fs.open(outPath, 'w', function (err, fd) {
			if (err) {
				call.set('done', err);
			} else {
				fs.write(fd, content, 0, content.length, 0, function (err) {
					call.set('done', err || null);
				});
			}
		});
		call.once('done', callback);
	}

	function createDirectories(out, path, callback) {
		//console.log('createDirectories(' + out + ', ' + path + ')');
		var
			action = atom.create(),
			splits = getResourcePathSplits(path),
			dirs = atom.create(),
			last
		;
		splits.shift(); // Don't create the file itself as a directory
		splits.reverse(); // Create out first, then go deeper
		arrayEach(splits, function (i, split) {
			var
				prefix = split[0],
				dir = prefix ? out + '/' + prefix : out
			;
			function makeDir() {
				fs.mkdir(dir, function (err) {
					if (err) {
						if (err.code === 'EEXIST') {
							// Already exists, that's ok
							dirs.set(dir, true);
						} else {
							action.set('done', err);
						}
					} else {
						console.log('mkdir', dir);
						dirs.set(dir, true);
					}
				});
			}
			if (last) {
				dirs.once(last, makeDir);
			} else {
				makeDir();
			}
			last = dir;
		});
		dirs.once(last, function () {
			action.set('done', null);
		});
		action.once('done', callback);
	}

	gravity.build = function (mapOrURI, base, out, callback) {
		var build = atom.create(), files = atom.create();
		gravity.map(mapOrURI, function (map) {
			build.set('map', map);
			gravity.list(map, base, function (err, list) {
				if (err) {
					build.set('done', err);
				} else {
					build.set('list', list);
				}
			});
		});
		build.once(['map', 'list'], function (map, list) {
			arrayEach(list, function (i, path) {
				var item = atom.create();
				gravity.pull(map, base, path, function (err, content) {
					if (err) {
						build.set('done', err);
					} else {
						item.set('content', content);
					}
				});
				item.once('content', function (content) {
					createDirectories(out, path, function (err) {
						if (err) {
							build.set('done', err);
						} else {
							item.set('dir', true);
						}
					});
				});
				item.once(['content', 'dir'], function (content) {
					write(out, path, content, function (err) {
						if (err) {
							build.set('done', err);
						} else {
							files.set(path, true);
						}
					});
				});
			});
			files.once(list, function () {
				build.set('done', null);
			});
		});
		build.once('done', callback);
	};

	gravity.list = function (mapOrURI, base, callback) {
		gravity.map(mapOrURI, function (map) {
			getList(base, '', map, function (list) {
				//console.log('gravity.list(...)', { mapOrURI: mapOrURI, base: base });
				//console.log(list);
				callback(undefined, list);
			});
		});
	};

	gravity.map = function (mapOrURI, callback) {
		if (typeof mapOrURI === 'string') {
			var gravMapJSON = stripComments(fs.readFileSync(mapOrURI) + '');
			callback(JSON.parse(gravMapJSON));
		} else {
			callback(mapOrURI);
		}
	};

	gravity.pull = function (mapOrURI, base, path, callback) {
		//console.log('gravity.pull(...)', { mapOrURI: mapOrURI, base: base, path: path });
		gravity.map(mapOrURI, function (map) {
			getResource(map, base, false, path, callback);
		});
	};

	gravity.serve = function (mapURI, base, host, port) {
		runServer(mapURI, base, host, port);
	};

}());
