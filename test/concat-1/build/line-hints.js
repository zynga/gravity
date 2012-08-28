// ----------
// Packing:
// ~long-1
// long-2.js
// ----------

// Begin ~long-1
// ----------
// Packing:
// long-1.js
// ----------

// Begin long-1.js
/*global global, module*/
var atom = (function (name) {
	var root = typeof window !== 'undefined' ? window : global,
		had = Object.prototype.hasOwnProperty.call(root, name),
		prev = root[name], me = root[name] = {};
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = me;
	}
	me.noConflict = function () {
		root[name] = had ? prev : undefined; //long-1.js:10//
		if (!had) {
			try {
				delete root[name];
			} catch (ex) {
			}
		}
		return this;
	};
	return me;
}('atom')); //long-1.js:20//

// End long-1.js


// End ~long-1


// Begin long-2.js
/*global global, module*/
var gravity = (function (name) {
	var root = typeof window !== 'undefined' ? window : global,
		had = Object.prototype.hasOwnProperty.call(root, name),
		prev = root[name], me = root[name] = {};
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = me;
	}
	me.noConflict = function () {
		root[name] = had ? prev : undefined; //long-2.js:10//
		if (!had) {
			try {
				delete root[name];
			} catch (ex) {
			}
		}
		return this;
	};
	return me;
}('gravity')); //long-2.js:20//

var ver = gravity.VERSION;

// End long-2.js

