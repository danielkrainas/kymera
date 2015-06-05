var NAME_REGEX = /[a-zA-Z_][\w:\-\.]*/;

var DOMParseContext = function (html) {
    this.index = 0;
    this.html = html;
    this.text = '';
    this.elements = [];
    this.processing = [];

    Object.defineProperties(this, {
        eof: {
            get: function () {
                return this.index >= this.length;
            }
        },

        current: {
            get: function () {
                return this.eof ? '' : this.html.charAt(this.index);
            }
        },

        length: {
            get: function () {
                return html.length;
            }
        },

        substring: {
            get: function () {
                return this.html.substring(this.index);
            }
        }
    });
};

DOMParseContext.prototype.popElement = function () {
    var el = this.processing.pop();
    if (el) {
        if (this.processing.length) {
            this.pushElementChild(el);
        } else {
            this.elements.push(el);
        }
    }
};

DOMParseContext.prototype.pushElement = function (name) {
    if (this.text) {
        this.pushElementText(this.text);
        this.text = '';
    }

    this.processing.push([name]);
};

DOMParseContext.prototype.pushElementAttrs = function (attrs) {
    var el = this.processing[this.processing.length - 1];
    if (el) {
        if (el.length > 1 && typeof el[1] === 'object') {
            el[1] = attrs;
        } else if (el.length > 1) {
            el.splice(1, 0, attrs);
        } else {
            el.push(attrs);
        }
    }
};

DOMParseContext.prototype.pushElementText = function (text) {
    var el = this.processing[this.processing.length - 1];
    if (el) {
        el.push(text);
    }
};

DOMParseContext.prototype.pushElementChild = function (child) {
    var el = this.processing[this.processing.length - 1];
    if (el) {
        el.push(child);
    }
};

DOMParseContext.prototype.append = function (text) {
    this.text += text;
};

DOMParseContext.prototype.peek = function (count) {
    return this.html.substr(this.index + 1, count || 1);
};

DOMParseContext.prototype.read = function (count) {
    count = count || 1;
    if (count === 0) {
        return '';
    }

    var next = this.peek(count);
    this.index += count;
    if (this.index > this.length) {
        this.index = this.length;
    }

    return next;
};

DOMParseContext.prototype.readRegExp = function (regexp) {
    var value = (regexp.exec(this.html.substring(this.index)) || [''])[0];
    this.index += value.length;
    return value;
};

DOMParseContext.prototype.peekIgnoreWhitespace = function (count) {
    count = count || 1;
    var value = '';
    var next = '';
    var offset = 0;
    do {
        next = this.html.charAt(this.index + ++offset);
        if (!next) {
            break;
        }

        if (!/\s/.test(next)) {
            value += next;
        }
    } while (value.length < count);

    return value;
};

DOMParseContext.prototype.readUntilNonWhitespace = function () {
    var value = '';
    var next = null;
    while (!this.eof) {
        next = this.read();
        value += next;
        if (!/\s$/.test(value)) {
            break;
        }
    }

    return value;
};

DOMParseContext.prototype.readAttribute = function () {
    var name = this.readRegExp(NAME_REGEX);
    var value = null;
    if (this.current === '=' || this.peekIgnoreWhitespace() === '=') {
        this.readRegExp(/\s*=\s*/);
        var quote = /['"]/.test(this.current) ? this.current : '';
        var attributeValueRegexp = !quote ? /(.*?)(?=[\s>])/ : new RegExp(quote + '(.*?)' + quote);

        var match = attributeValueRegexp.exec(this.substring) || [0, ''];
        value = match[1];
        this.read(match[0].length);
    }

    return [name, value];
};

DOMParseContext.prototype.readAttributes = function (xml) {
    var isClosingToken = function () {
        if (xml) {
            return this.current === '?' && this.peek() === '>';
        }

        return this.current === '>' || (this.current === '/' && this.peekIgnoreWhitespace() === '>');
    };

    var next = this.current;
    var attr = null;
    var attrs = null;
    while (!this.eof && !isClosingToken.call(this)) {
        if (NAME_REGEX.test(next)) {
            attr = this.readAttribute();
            if (!attrs) {
                attrs = {};
            }

            attrs[attr[0]] = attr[1];
            next = this.current;
        } else {
            next = this.read();
        }
    }

    return attrs;
};

DOMParseContext.prototype.readCloserForOpenedElement = function (name) {
    var emptyElements = {
        area: true, base: true, basefont: true, br: true, col: true, frame: true,
        hr: true, img: true, input: true, isindex: true, link: true, meta: true, param: true, embed: true
    };

    var isUnary = name in emptyElements;
    if (this.current === '/') {
        // self closing tag
        this.readUntilNonWhitespace();
        this.read();
        this.popElement();
    } else if (this.current === '?') {
        // xml prolog close
        this.read(2);
    } else {
        // normal closing tag
        this.read();
    }
};

DOMParseContext.prototype.parseOpenElement = function () {
    if (this.text) {
        this.pushElementText(this.text);
        this.text = '';
    }

    var name = this.readRegExp(NAME_REGEX);
    this.pushElement(name);
    var attrs = this.readAttributes();
    if (attrs) {
        this.pushElementAttrs(attrs);
    }

    this.readCloserForOpenedElement(name);
    if (!/^(script|xmp)$/i.test(name)) {
        return;
    }

    var regex = new RegExp('^([\\s\\S]*?)(?:$|</(' + name + ')\\s*>)', 'i');
    var match = regex.exec(this.substring);
    this.read(match[0].length);
    if (match[1]) {
        console.log({ m: match[1] });
        // cdata
        this.pushElementText(match[1]);
    } else {
        //this.popElement();
        //close element
    }
};

DOMParseContext.prototype.parseEndElement = function () {
    var name = this.readRegExp(NAME_REGEX);
    this.readRegExp(/.*?(?:>|$)/);
    if (this.text) {
        this.pushElementText(this.text);
        this.text = '';
    }

    this.popElement();
};

DOMParseContext.prototype.parseCData = function () {
    this.read(8);
    var match = /^([\s\S]*?)(?:$|]]>)/.exec(this.substring);
    var value = match[1];
    this.read(match[0].length);
};

DOMParseContext.prototype.parseComment = function () {
    this.read(3);
    var match = /^([\s\S]*?)(?:$|-->)/.exec(this.substring);
    var value = match[1];
    this.read(match[0].length);
};

DOMParseContext.prototype.parseDocType = function () {
    this.read(8);
    var match = /^\s*([\s\S]*?)(?:$|>)/.exec(this.substring);
    var value = match[1];
    this.read(match[0].length);
};

DOMParseContext.prototype.parseXmlProlog = function () {
    this.read(4);
    this.readAttributes(true);
    this.readCloserForOpenedElement('?xml');
};

DOMParseContext.prototype.parseNext = function () {
    var current = this.current;
    var buffer = current;
    if (current == '<') {
        buffer += this.read();
        if (this.current === '/') {
            buffer += this.read();
            if (NAME_REGEX.test(this.current)) {
                //text element
                this.parseEndElement();
            } else {
                // malformed
                this.read();
                this.append(buffer);
            }
        } else if (this.current === '!') {
            if (/^!\[CDATA\[/.test(this.substring)) {
                // text element
                this.parseCData();
            } else if (/^!--/.test(this.substring)) {
                // comment
                this.parseComment();
            } else if (/^!doctype/i.test(context.substring)) {
                // doctype
                this.parseDocType();
            } else {
                // malformed
                this.read();
                this.append(buffer);
            }
        } else if (this.current === '?') {
            if (/^\?xml/.test(this.substring)) {
                // xml prolog
                this.parseXmlProlog();
            } else {
                // malformed
                this.read();
                this.append(buffer);
            }
        } else if (NAME_REGEX.test(this.current)) {
            // open element
            this.parseOpenElement();
        } else {
            // malformed
            this.read();
            this.append(buffer);
        }
    } else {
        this.append(this.current);
        this.read();
    }
};

var parseDOM = function (html) {
    html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var context = new DOMParseContext(html);
    while (!context.eof) {
        context.parseNext();
    }

    return context.elements;
};

var diffDOM = function (a, b) {
    var patch = [];
    var max = Math.max(a.length, b.length);
    for (var i = 0; i < max; i++) {
        walkDOM(a[i], b[i], patch);
    }

    return patch;
};

var diffAttributes = function (a, b, patch) {
    if (!a && !b) {
        return;
    } else if (a === b) {
        return;
    }

    var akeys = typeof a === 'object' ? Object.keys(a).sort() : null;
    var bkeys = typeof b === 'object' ? Object.keys(b).sort() : null;
    if (!akeys && !bkeys) {
        return;
    } else if (akeys && !bkeys) {
        patch.push.apply(patch, akeys.map(function (key) {
            return ['-@', key];
        }));
    } else if (bkeys && !akeys) {
        patch.push.apply(patch, bkeys.map(function (key) {
            return ['+@', key, b[key]];
        }));
    } else {
        var max = akeys.length > bkeys.length ? akeys.length : bkeys.length;
        for (var i = 0; i < max; i++) {
            var akey = akeys[i];
            var bkey = bkeys[i];
            var avalue = akey ? a[akey] : null;
            var bvalue = bkey ? b[bkey] : null;
            if (!akey && bkey) {
                patch.push(['+@', bkey, bvalue]);
            } else if (!bkey && akey) {
                patch.push(['-@', akey]);
            } else if (akey !== bkey) {
                patch.push(['-@', akey]);
                patch.push(['+@', bkey, bvalue]);
            } else if (avalue !== bvalue) {
                patch.push(['+@', bkey, bvalue]);
            }
        }
    }
};

var diffChildren = function (a, b, patch) {
    var max = Math.max(a.length, b.length);
    for (var i = 0; i < max; i++) {
        var ai = a[i];
        var bi = b[i];
        if (ai || bi) {
            walkDOM(ai, bi, patch);
        }
    }
};

var walkDOM = function (a, b, patch) {
    var getType = function (x) {
        return typeof x === 'string' ? 't' : 'e';
    }

    var atype = getType(a);
    var btype = getType(b);
    if (!a && b) {
        return patch.push(['+' + btype, b]);
    } else if (a && !b) {
        return patch.push(['-' + atype]);
    } else if (a === b) {
        return patch.push(null);
    } else if (atype !== btype) {
        patch.push(['-' + atype]);
        patch.push(['+' + btype, b]);
        return;
    } else if (atype === 't' && a !== b) {
        patch.push(['-t']);
        patch.push(['+t', b]);
        return;
    } else if (a[0] !== b[0]) {
        return patch.push(['+' + btype, b]);
    }

    var selfPatch = [];

    var getAttrs = function (node) {
        return node.length >= 2 && typeof node[1] === 'object' ? node[1] : null;
    };

    var getChildren = function (node) {
        var attr = getAttrs(node);
        return attr ? node.slice(2) : node.slice(1);
    };

    diffAttributes(getAttrs(a), getAttrs(b), selfPatch);
    diffChildren(getChildren(a), getChildren(b), selfPatch);

    if (selfPatch.length > 0) {
        patch.push(selfPatch);
    } else {
        patch.push(null);
    }
};

var ElementWrapper = function (el) {
    this.el = el;
};

ElementWrapper.textNode = function (text) {
    var el = document.createTextNode(text);
    return new ElementWrapper(el);
};

ElementWrapper.fragment = function (html) {
    var dummy = document.createElement('div');
    dummy.innerHTML = html;
    var child = dummy.firstChild;
    dummy.removeChild(child);
    return new ElementWrapper(child);
};

ElementWrapper.prototype.attr = function (name, value) {
    if (arguments.length === 2) {
        this.el.setAttribute(name, value);
    } else {
        value = this.el.getAttribute(name);
    }

    return value;
};

ElementWrapper.prototype.children = function () {
    return this.el.children;
};

ElementWrapper.prototype.next = function () {
    return this.el.nextSibling ? new ElementWrapper(this.el.nextSibling) : null;
};

ElementWrapper.prototype.remove = function () {
    if (this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
    }
};

ElementWrapper.prototype.removeAttr = function (name) {
    if (this.el.hasAttribute(name)) {
        this.el.removeAttribute(name);
    }
};

ElementWrapper.prototype.append = function (element) {
    if (element instanceof ElementWrapper) {
        element = element.el;
    }

    this.el.appendChild(element);
};

ElementWrapper.prototype.parent = function () {
    return this.el.parentNode;
};

ElementWrapper.prototype.children = function () {
    return this.el.childNodes;
};

var selfClosingTags = ['br', 'input'];

var renderToHtmlString = function (vdom) {
    var html = '';
    for (var i = 0; i < vdom.length; i++) {
        html += renderNodeToHtmlString(vdom[i]);
    }

    return html;
};

var renderNodeToHtmlString = function (vdomNode) {
    var html = '<';
    var childrenStart = 1;
    html += vdomNode[0];
    if (vdomNode.length > 1) {
        if (typeof vdomNode[1] === 'object') {
            childrenStart++;
            var attrs = vdomNode[1];
            var names = Object.keys(attrs);
            for (var i = 0; i < names.length; i++) {
                var name = names[i];
                html += ' ' + name + '="' + attrs[name] + '"';
            }
        }

        if (selfClosingTags.indexOf(vdomNode[0]) >= 0) {
            // todo: handle whitelist of self-closing tags
            html += '/>';
        } else {
            html += '>';
            for (var j = childrenStart; j < vdomNode.length; j++) {
                var child = vdomNode[j];
                if (typeof child === 'string') {
                    html += child;
                } else {
                    html += renderNodeToHtmlString(child);
                }
            }

            html += '</' + vdomNode[0] + '>';
        }
    }

    return html;
};

var applyPatch = function (patch, element) {
    var children = element.children();
    var childIndex = 0;
    for (var i = 0; i < patch.length; i++) {
        var child = children[childIndex];
        if (child) {
            child = new ElementWrapper(child);
        }

        var ops = patch[i];
        if (ops && !Array.isArray(ops[0])) {
            performOperation(ops, element, child);
            if (child && !child.parent()) {
                childIndex++;
            }
        } else if (ops && child) {
            childIndex++;
            applyPatch(ops, child);
        }
    }
};

var performOperation = function (op, element, child) {
    switch (op[0]) {
        case '-t':
        case '-e':
            child.remove();
            break;

        case '+t':
            element.append(ElementWrapper.textNode(op[1]));
            break;

        case '+e':
            element.append(ElementWrapper.fragment(renderNodeToHtmlString(op[1])));
            break;

        case '+@':
            element.attr(op[1], op[2]);
            break;

        case '-@':
            element.removeAttr(op[1]);
            break;
    }
};
