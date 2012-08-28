/*global global, module*/
var atom = (function (name) {
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
}('atom'));
