/*global atom:true, gravity:true, logger:true, process, require*/
atom = typeof atom === 'undefined' ? require('atom-js') : atom;
gravity = typeof gravity === 'undefined' ? require('./gravity.js') : gravity;
logger = (typeof logger !== 'undefined' && logger) || console.log;

var
	inBrowser = typeof document !== 'undefined',
	inNode = !inBrowser,
	argv = inNode && process.argv,
	arg2 = argv && argv.length > 2 && argv[2],
	verbose = inBrowser || arg2 === '-v',
	a = atom(),
	chain = a.chain,
	results = [],
	totals = { success: 0, fail: 0, total: 0 },
	fs = require('fs')
;

logger('Testing: gravity ' + gravity.VERSION);

function assert(msg, success) {
	totals.total++;
	if (success) {
		totals.success++;
		if (verbose) {
			logger(msg + '... success.');
		}
	} else {
		totals.fail++;
		logger(msg + '... FAIL!');
	}
}


assert('gravity.VERSION is a string', typeof gravity.VERSION === 'string');
assert('gravity.build() is a function', typeof gravity.build === 'function');
assert('gravity.list() is a function', typeof gravity.list === 'function');
assert('gravity.map() is a function', typeof gravity.map === 'function');
assert('gravity.pull() is a function', typeof gravity.pull === 'function');
assert('gravity.serve() is a function', typeof gravity.serve === 'function');


chain(function (next) {
	var dir = 'nosuchdir';
	gravity.build(dir + '/gravity.map', dir, 'nosuchOUTdir', function (err) {
		assert(
			'gravity.build() returns an error if passed a non-existent ' +
				'gravity.map file path',
			!!err
		);
		next();
	});
});

chain(function (next) {
	var dir = 'nosuchdir';
	gravity.list(dir + '/gravity.map', dir, function (err) {
		assert(
			'gravity.list() returns an error if passed a non-existent ' +
				'gravity.map file path',
			!!err
		);
		next();
	});
});

chain(function (next) {
	var
		base = 'test/proj-1',
		src = base + '/src',
		map = src + '/gravity.map'
	;
	gravity.list(src + '/gravity.map', src, function (err, list) {
		list.sort();
		assert(
			'gravity.list() correctly includes subdirectory contents, and omits ' +
				'temporary build targets',
			list + '' ===
				'enum/1.js,enum/2.js,out.js,subsubdir/3.js,word.png'
		);
		next();
	});
});


// File concatenation tests
(function () {
	var
		base = 'test/concat-1',
		src = base + '/src',
		map = src + '/gravity.map',
		build = base + '/build'
	;

	chain(function (next) {
		var
			file = 'two-files.js',
			preBuilt = fs.readFileSync(build + '/' + file) + ''
		;
		gravity.pull(map, src, file, function (err, content) {
			assert(
				'gravity.pull() of a 2-file concatenation works',
				content + '' === preBuilt
			);
			next();
		});
	});

	chain(function (next) {
		var
			file = 'two-literals.js',
			preBuilt = fs.readFileSync(build + '/' + file) + ''
		;
		gravity.pull(map, src, file, function (err, content) {
			assert(
				'gravity.pull() of a 2-literal concatenation works',
				content + '' === preBuilt
			);
			next();
		});
	});

	chain(function (next) {
		var
			file = 'file-temp-literal.js',
			preBuilt = fs.readFileSync(build + '/' + file) + ''
		;
		gravity.pull(map, src, file, function (err, content) {
			assert(
				'gravity.pull() works with a target composed of a file, a temporary ' +
					'build product, and a literal',
				content + '' === preBuilt
			);
			next();
		});
	});

	chain(function (next) {
		var
			file = 'line-hints.js',
			preBuilt = fs.readFileSync(build + '/' + file) + ''
		;
		gravity.pull(map, src, file, function (err, content) {
			assert(
				'gravity.pull() correctly adds line number hints to source files ' +
					'longer than 10 lines',
				content + '' === preBuilt
			);
			next();
		});
	});
}());


// URL fetching tests
(function () {
	var
		base = 'test/urls-1',
		src = base + '/src',
		map = src + '/gravity.map',
		build = base + '/build'
	;

	chain(function (next) {
		var
			file = 'direct-http-url.js',
			preBuilt = fs.readFileSync(build + '/' + file) + ''
		;
		gravity.pull(map, src, file, function (err, content) {
			assert(
				'gravity.pull() correctly returns the contents of an http:// ' +
					'URL when specified as a direct value',
				content + '' === preBuilt
			);
			next();
		});
	});

	chain(function (next) {
		var
			file = 'direct-https-url.js',
			preBuilt = fs.readFileSync(build + '/' + file) + ''
		;
		gravity.pull(map, src, file, function (err, content) {
			assert(
				'gravity.pull() correctly returns the contents of an https:// ' +
					'URL when specified as a direct value',
				content + '' === preBuilt
			);
			next();
		});
	});

	chain(function (next) {
		var
			file = 'compound-urls.js',
			preBuilt = fs.readFileSync(build + '/' + file) + ''
		;
		gravity.pull(map, src, file, function (err, content) {
			assert(
				'gravity.pull() correctly handles URLs included in arrays',
				content + '' === preBuilt
			);
			next();
		});
	});
}());


chain(function () {
	logger(totals);

	if (totals.fail && inNode) {
		process.exit(1);
	}
});
