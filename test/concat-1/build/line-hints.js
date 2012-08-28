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
var atom = (function (name) {
	var root = typeof window !== 'undefined' ? window : global,
		had = Object.prototype.hasOwnProperty.call(root, name),
		prev = root[name], me = root[name] = {};
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = me;
	}
	me.noConflict = function () {
		root[name] = had ? prev : undefined;
		if (!had) { //long-1.js:10//
			try {
				delete root[name];
			} catch (ex) {
			}
		}
		return this;
	};
	return me;
}('atom'));
 //long-1.js:20//
// End long-1.js


// End ~long-1


// Begin long-2.js
var gravity = (function (name) {
	var root = typeof window !== 'undefined' ? window : global,
		had = Object.prototype.hasOwnProperty.call(root, name),
		prev = root[name], me = root[name] = {};
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = me;
	}
	me.noConflict = function () {
		root[name] = had ? prev : undefined;
		if (!had) { //long-2.js:10//
			try {
				delete root[name];
			} catch (ex) {
			}
		}
		return this;
	};
	return me;
}('gravity'));
 //long-2.js:20//
var ver = gravity.VERSION;

// End long-2.js

