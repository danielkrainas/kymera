var MountDescriptor = function (el, Cls, component, template) {
	this.instance = new Cls();
	this.el = el;
	this.component = component;
	this.template = template;
	
	var shadow = el.createShadowRoot();
	var templateEl = document.createElement('template');
	templateEl.innerHTML = template.body;
	shadow.appendChild(templateEl);

	this.templateEl = templateEl;
	this.shadow = shadow;
	this.render();
};

MountDescriptor.prototype.render = function () {
	while (this.shadow.children.length > 1) {
		this.shadow.removeChild(this.shadow.lastChild);
	}

	var clone = document.importNode(this.templateEl.content, true);
	this.shadow.appendChild(clone);
};

var Component = function (options) {
	this.selector = options.selector;
};

var Template = function (options) {
	this.body = options.body;
};

var ClassBuilder = function () {
	this.annotations = [];
	this.members = {};
};

ClassBuilder.prototype.annotate = function (annotation) {
	this.annotations.push(annotation);
};

ClassBuilder.prototype.define = function (mixin) {
	for (var key in mixin) {
		if (!mixin.hasOwnProperty(key)) {
			continue;
		}

		this.members[key] = mixin[key];
	}
};

ClassBuilder.prototype.build = function () {
	var Cls = this.members.constructor || function () {};
	Cls.prototype = this.members;
	if (this.annotations.length) {
		Cls.annotations = this.annotations.slice(0);
	}

	return Cls;
};

ClassBuilder.prototype.ctor = function (ctor) {
	this.members.constructor = ctor;
};

var Module = function (name) {
	this.name = name;
	this.components = [];
	this.mounts = [];
};

Module.prototype.mountComponents = function (rootSelector) {
	var root = document.querySelector(rootSelector);
	if (!root) {
		return;
	}

	var results = [];
	for (var i = 0; i < this.components.length; i++) {
		var Cls = this.components[i];
		var c = Cls.annotations[0];
		var matches = root.querySelectorAll(c.selector);
		for (var j = 0; j < matches.length; j++) {
			var el = matches[j];
			var m = new MountDescriptor(el, Cls, c, Cls.annotations[1]);
			this.mounts.push(m);
			results.push(m);
		}
	}

	return results;
};

Module.prototype.use = function (Cls) {
	if (!Cls || !Cls.annotations) {
		return false;
	}

	if (Cls.annotations[0] instanceof Component) {
		this.components.push(Cls);
	}
};

var kymera = function (name) {
	return new Module(name);
};

kymera.createClass = function (fn) {
	var builder = new ClassBuilder();
	var proto = fn.call(null, builder);
	builder.define(proto);
	return builder.build();
};

kymera.Component = Component;
kymera.Template = Template;
