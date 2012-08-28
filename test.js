/*global atom:true, gravity:true, logger:true, process, require*/
atom = typeof atom === 'undefined' ? require('./atom/atom') : atom;
gravity = typeof gravity === 'undefined' ? require('./gravity.js') : gravity;
logger = (typeof logger !== 'undefined' && logger) || console.log;

var
	inBrowser = typeof document !== 'undefined',
	inNode = !inBrowser,
	argv = inNode && process.argv,
	arg2 = argv && argv.length > 2 && argv[2],
	verbose = inBrowser || arg2 === '-v',
	a = atom.create(),
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

a.chain(function (next) {
	var base = 'test/proj-1/src';
	gravity.list(base + '/gravity.map', base, function (err, list) {
		list.sort();
		assert(
			'gravity.list() returns correct list for test/proj-1/src',
			list + '' ===
				'out.js,subsubdir/3.js,word.png'
		);
		next();
	});
});

a.chain(function (next) {
	var base = 'test/concat-1/src';
	gravity.pull(base + '/gravity.map', base, 'out.js', function (err, content) {
		var
			pulled = content + '',
			preBuilt = fs.readFileSync('test/concat-1/build/out.js') + ''
		;
		assert(
			'gravity.pull() of a 2-file concatenation works',
			pulled === preBuilt
		);
		next();
	});
});

a.chain(function () {
	logger(totals);
});
