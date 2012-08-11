/*global global, module, require*/
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

	gravity.VERSION = '0.6.0';

	var
		atom = require('./atom/atom'),
		http = require('http'),
		url = require('url'),
		fs = require('fs')
	;

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

	gravity.list = function (map, base, callback) {
	};

	gravity.map = function (uri, callback) {
		var gravMapJSON = stripComments(fs.readFileSync(uri) + '');
		callback(JSON.parse(gravMapJSON));
	};

	gravity.pull = function (map, base, path, callback) {
	};

	gravity.serve = function (map, base, host, port) {
	};

}());
