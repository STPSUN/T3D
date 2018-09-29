
// AMD support
(function (factory) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        // using AMD; register as anon module
        define(['jquery'], factory);
    } else {
        // no AMD; invoke directly
        factory((typeof (jQuery) != 'undefined') ? jQuery : window.Zepto);
    }
}

(function ($) {
    "use strict";

    /**
     * Feature detection
     */
    var feature = {};
    feature.fileapi = $("<input type='file'/>").get(0).files !== undefined;
    feature.formdata = window.FormData !== undefined;

    var hasProp = !!$.fn.prop;

// attr2 uses prop when it can but checks the return type for
// an expected string.  this accounts for the case where a form 
// contains inputs with names like "action" or "method"; in those
// cases "prop" returns the element
    $.fn.attr2 = function () {
        if (!hasProp) {
            return this.attr.apply(this, arguments);
        }
        var val = this.prop.apply(this, arguments);
        if ((val && val.jquery) || typeof val === 'string') {
            return val;
        }
        return this.attr.apply(this, arguments);
    };
    //加载数据
    $.fn.load = function (data, options) {
        //var opts = $.data(target, 'form').options;
        var form = this;
        if (options == null)
            options = {};
        if (typeof data == 'string') {
            var param = {};
            if (options.param != null)
                param = options.param;
            if (options.onBeforeLoad != null && options.onBeforeLoad.call(form, param) == false)
                return;
            $.ajax({
                url: data,
                data: param,
                dataType: 'json',
                success: function (data) {
                    _load(data);
                },
                error: function () {
                    if (options.onLoadError != null)
                        options.onLoadError.apply(form, arguments);
                }
            });
        } else {
            _load(data);
        }

        function _load(data) {
            for (var name in data) {
                var value = data[name];
                form.find("[name='" + name + "']").each(function () {
                    form.setFieldValue($(this), value);
                });
            }
            if (options.onLoadSuccess != null)
                options.onLoadSuccess.call(form, data);
        }
    };
    //设置控件值
    $.fn.setFieldValue = function (control, value) {
        if ($(control).length == 0)
            return;
        if (value == null)
            value = '';
        var tagName = $(control)[0].tagName.toLocaleLowerCase();
        var type = $(control).attr('type');
        if (tagName == 'input') {
            if (type == 'radio') {
                $(control)[0].checked = $(control).val() == value;
            } else if (type == 'checkbox') {
                if (value != null) {
                    var arr = (value + '').split(',');
                    var checked = false;
                    for (var i = 0; i < arr.length; i++) {
                        if ($(control).val() == arr[i]) {
                            $(control)[0].checked = true;
                            checked = true;
                            break;
                        }
                    }
                    if (!checked)
                        $(control)[0].checked = false;
                }
            } else {
                $(control).val(value);
            }
        } else if (tagName == 'select') {
            $(control).val(value);
            $(control).trigger("change");
        } else if (tagName == 'textarea') {
            var editor = $(control).attr("data-editor");
            if (editor != null && editor != "") {
                eval(editor).setContent(value);
            } else
                $(control).val(value);
        } else {
            $(control).html(value);
        }
        if (typeof (this.reRenderUI) != 'undefined') {
            var ui = $(control).attr("data-ui");
            if (ui == "combosearch")
                type = ui;
            else if (tagName == "input") {
                if (type == "radio" && ui == "switch")
                    type = "switch";
            } else
                type = tagName;
            this.reRenderUI(control, type);
        }
    };

    $.fn.getFormData = function (control) {
        if (control == null)
            control = $(document);
        control.find("input").each(function () {
            var el = $(this);
            var name = el.attr("name");
            if (name != null) {
                var v = $.fieldValue(el, true);
                if (v === null && typeof v == 'undefined') {
                    if (v.constructor == Array) {
                        $.merge(val, v);
                    }
                } else {
                    val.push(v);
                }
            }
        });
    };

    $.fn.ajaxSubmit = function (options) {
        /*jshint scripturl:true */
        // fast fail if nothing selected (http://dev.jquery.com/ticket/2752)
        if (!this.length) {
            log('ajaxSubmit: skipping submit process - no element selected');
            return this;
        }

        var method, action, url, $form = this;

        if (typeof options == 'function') {
            options = {success: options};
        } else if (options === undefined) {
            options = {};
        }

        method = options.type || this.attr2('method');
        action = options.url || this.attr2('action');

        url = (typeof action === 'string') ? $.trim(action) : '';
        url = url || window.location.href || '';
        if (url) {
            // clean url (don't include hash vaue)
            url = (url.match(/^([^#]+)/) || [])[1];
        }

        options = $.extend(true, {
            url: url,
            success: $.ajaxSettings.success,
            type: method || $.ajaxSettings.type,
            dataType: 'json',
            iframeSrc: /^https/i.test(window.location.href || '') ? 'javascript:false' : 'about:blank'
        }, options);

        // hook for manipulating the form data before it is extracted;
        // convenient for use with rich editors like tinyMCE or FCKEditor
        var veto = {};
        this.trigger('form-pre-serialize', [this, options, veto]);
        if (veto.veto) {
            log('ajaxSubmit: submit vetoed via form-pre-serialize trigger');
            return this;
        }

        // provide opportunity to alter form data before it is serialized
        if (options.beforeSerialize && options.beforeSerialize(this, options) === false) {
            log('ajaxSubmit: submit aborted via beforeSerialize callback');
            return this;
        }

        var traditional = options.traditional;
        if (traditional === undefined) {
            traditional = $.ajaxSettings.traditional;
        }

        var elements = [];
        var qx, a = this.formToArray(options.semantic, elements);
        if (options.data) {
            options.extraData = options.data;
            qx = $.param(options.data, traditional);
        }

        // give pre-submit callback an opportunity to abort the submit
        if (options.beforeSubmit && options.beforeSubmit(a, this, options) === false) {
            log('ajaxSubmit: submit aborted via beforeSubmit callback');
            return this;
        }

        // fire vetoable 'validate' event
        this.trigger('form-submit-validate', [a, this, options, veto]);
        if (veto.veto) {
            log('ajaxSubmit: submit vetoed via form-submit-validate trigger');
            return this;
        }

        var q = $.param(a, traditional);
        if (qx) {
            q = (q ? (q + '&' + qx) : qx);
        }
        if (options.type.toUpperCase() == 'GET') {
            options.url += (options.url.indexOf('?') >= 0 ? '&' : '?') + q;
            options.data = null;  // data is null for 'get'
        } else {
            options.data = q; // data is the query string for 'post'
        }

        var callbacks = [];
        if (options.resetForm) {
            callbacks.push(function () {
                $form.resetForm();
            });
        }
        if (options.clearForm) {
            callbacks.push(function () {
                $form.clearForm(options.includeHidden);
            });
        }

        // perform a load on the target only if dataType is not provided
        if (!options.dataType && options.target) {
            var oldSuccess = options.success || function () {
            };
            callbacks.push(function (data) {
                var fn = options.replaceTarget ? 'replaceWith' : 'html';
                $(options.target)[fn](data).each(oldSuccess, arguments);
            });
        } else if (options.success) {
            callbacks.push(options.success);
        }

        options.success = function (data, status, xhr) { // jQuery 1.4+ passes xhr as 3rd arg
            var context = options.context || this;    // jQuery 1.4+ supports scope context
            for (var i = 0, max = callbacks.length; i < max; i++) {
                callbacks[i].apply(context, [data, status, xhr || $form, $form]);
            }
        };

        if (options.error) {
            var oldError = options.error;
            options.error = function (xhr, status, error) {
                var context = options.context || this;
                oldError.apply(context, [xhr, status, error, $form]);
            };
        }

        if (options.complete) {
            var oldComplete = options.complete;
            options.complete = function (xhr, status) {
                var context = options.context || this;
                oldComplete.apply(context, [xhr, status, $form]);
            };
        }

        // are there files to upload?

        // [value] (issue #113), also see comment:
        // https://github.com/malsup/form/commit/588306aedba1de01388032d5f42a60159eea9228#commitcomment-2180219
        var fileInputs = $('input[type=file]:enabled', this).filter(function () {
            return $(this).val() !== '';
        });

        var hasFileInputs = fileInputs.length > 0;
        var mp = 'multipart/form-data';
        var multipart = ($form.attr('enctype') == mp || $form.attr('encoding') == mp);

        var fileAPI = feature.fileapi && feature.formdata;
        log("fileAPI :" + fileAPI);
        var shouldUseFrame = (hasFileInputs || multipart) && !fileAPI;

        var jqxhr;

        // options.iframe allows user to force iframe mode
        // 06-NOV-09: now defaulting to iframe mode if file input is detected
        if (options.iframe !== false && (options.iframe || shouldUseFrame)) {
            // hack to fix Safari hang (thanks to Tim Molendijk for this)
            // see:  http://groups.google.com/group/jquery-dev/browse_thread/thread/36395b7ab510dd5d
            if (options.closeKeepAlive) {
                $.get(options.closeKeepAlive, function () {
                    jqxhr = fileUploadIframe(a);
                });
            } else {
                jqxhr = fileUploadIframe(a);
            }
        } else if ((hasFileInputs || multipart) && fileAPI) {
            jqxhr = fileUploadXhr(a);
        } else {
            jqxhr = $.ajax(options);
        }

        $form.removeData('jqxhr').data('jqxhr', jqxhr);

        // clear element array
        for (var k = 0; k < elements.length; k++) {
            elements[k] = null;
        }

        // fire 'notify' event
        this.trigger('form-submit-notify', [this, options]);
        return this;

        // utility fn for deep serialization
        function deepSerialize(extraData) {
            var serialized = $.param(extraData, options.traditional).split('&');
            var len = serialized.length;
            var result = [];
            var i, part;
            for (i = 0; i < len; i++) {
                // #252; undo param space replacement
                serialized[i] = serialized[i].replace(/\+/g, ' ');
                part = serialized[i].split('=');
                // #278; use array instead of object storage, favoring array serializations
                result.push([decodeURIComponent(part[0]), decodeURIComponent(part[1])]);
            }
            return result;
        }

        // XMLHttpRequest Level 2 file uploads (big hat tip to francois2metz)
        function fileUploadXhr(a) {
            var formdata = new FormData();

            for (var i = 0; i < a.length; i++) {
                formdata.append(a[i].name, a[i].value);
            }

            if (options.extraData) {
                var serializedData = deepSerialize(options.extraData);
                for (i = 0; i < serializedData.length; i++) {
                    if (serializedData[i]) {
                        formdata.append(serializedData[i][0], serializedData[i][1]);
                    }
                }
            }

            options.data = null;

            var s = $.extend(true, {}, $.ajaxSettings, options, {
                contentType: false,
                processData: false,
                cache: false,
                type: method || 'POST'
            });

            if (options.uploadProgress) {
                // workaround because jqXHR does not expose upload property
                s.xhr = function () {
                    var xhr = $.ajaxSettings.xhr();
                    if (xhr.upload) {
                        xhr.upload.addEventListener('progress', function (event) {
                            var percent = 0;
                            var position = event.loaded || event.position; /*event.position is deprecated*/
                            var total = event.total;
                            if (event.lengthComputable) {
                                percent = Math.ceil(position / total * 100);
                            }
                            options.uploadProgress(event, position, total, percent);
                        }, false);
                    }
                    return xhr;
                };
            }

            s.data = null;
            var beforeSend = s.beforeSend;
            s.beforeSend = function (xhr, o) {
                //Send FormData() provided by user
                if (options.formData) {
                    o.data = options.formData;
                } else {
                    o.data = formdata;
                }
                if (beforeSend) {
                    beforeSend.call(this, xhr, o);
                }
            };
            return $.ajax(s);
        }

        // private function for handling file uploads (hat tip to YAHOO!)
        function fileUploadIframe(a) {
            var form = $form[0], el, i, s, g, id, $io, io, xhr, sub, n, timedOut, timeoutHandle;
            var deferred = $.Deferred();

            // #341
            deferred.abort = function (status) {
                xhr.abort(status);
            };

            if (a) {
                // ensure that every serialized input is still enabled
                for (i = 0; i < elements.length; i++) {
                    el = $(elements[i]);
                    if (hasProp) {
                        el.prop('disabled', false);
                    } else {
                        el.removeAttr('disabled');
                    }
                }
            }

            s = $.extend(true, {}, $.ajaxSettings, options);
            s.context = s.context || s;
            id = 'jqFormIO' + (new Date().getTime());
            if (s.iframeTarget) {
                $io = $(s.iframeTarget);
                n = $io.attr2('name');
                if (!n) {
                    $io.attr2('name', id);
                } else {
                    id = n;
                }
            } else {
                $io = $('<iframe name="' + id + '" src="' + s.iframeSrc + '" />');
                $io.css({position: 'absolute', top: '-1000px', left: '-1000px'});
            }
            io = $io[0];


            xhr = {// mock object
                aborted: 0,
                responseText: null,
                responseXML: null,
                status: 0,
                statusText: 'n/a',
                getAllResponseHeaders: function () {
                },
                getResponseHeader: function () {
                },
                setRequestHeader: function () {
                },
                abort: function (status) {
                    var e = (status === 'timeout' ? 'timeout' : 'aborted');
                    log('aborting upload... ' + e);
                    this.aborted = 1;

                    try { // #214, #257
                        if (io.contentWindow.document.execCommand) {
                            io.contentWindow.document.execCommand('Stop');
                        }
                    } catch (ignore) {
                    }

                    $io.attr('src', s.iframeSrc); // abort op in progress
                    xhr.error = e;
                    if (s.error) {
                        s.error.call(s.context, xhr, e, status);
                    }
                    if (g) {
                        $.event.trigger("ajaxError", [xhr, s, e]);
                    }
                    if (s.complete) {
                        s.complete.call(s.context, xhr, e);
                    }
                }
            };

            g = s.global;
            // trigger ajax global events so that activity/block indicators work like normal
            if (g && 0 === $.active++) {
                $.event.trigger("ajaxStart");
            }
            if (g) {
                $.event.trigger("ajaxSend", [xhr, s]);
            }

            if (s.beforeSend && s.beforeSend.call(s.context, xhr, s) === false) {
                if (s.global) {
                    $.active--;
                }
                deferred.reject();
                return deferred;
            }
            if (xhr.aborted) {
                deferred.reject();
                return deferred;
            }

            // add submitting element to data if we know it
            sub = form.clk;
            if (sub) {
                n = sub.name;
                if (n && !sub.disabled) {
                    s.extraData = s.extraData || {};
                    s.extraData[n] = sub.value;
                    if (sub.type == "image") {
                        s.extraData[n + '.x'] = form.clk_x;
                        s.extraData[n + '.y'] = form.clk_y;
                    }
                }
            }

            var CLIENT_TIMEOUT_ABORT = 1;
            var SERVER_ABORT = 2;

            function getDoc(frame) {
                /* it looks like contentWindow or contentDocument do not
                 * carry the protocol property in ie8, when running under ssl
                 * frame.document is the only valid response document, since
                 * the protocol is know but not on the other two objects. strange?
                 * "Same origin policy" http://en.wikipedia.org/wiki/Same_origin_policy
                 */

                var doc = null;

                // IE8 cascading access check
                try {
                    if (frame.contentWindow) {
                        doc = frame.contentWindow.document;
                    }
                } catch (err) {
                    // IE8 access denied under ssl & missing protocol
                    log('cannot get iframe.contentWindow document: ' + err);
                }

                if (doc) { // successful getting content
                    return doc;
                }

                try { // simply checking may throw in ie8 under ssl or mismatched protocol
                    doc = frame.contentDocument ? frame.contentDocument : frame.document;
                } catch (err) {
                    // last attempt
                    log('cannot get iframe.contentDocument: ' + err);
                    doc = frame.document;
                }
                return doc;
            }

            // Rails CSRF hack (thanks to Yvan Barthelemy)
            var csrf_token = $('meta[name=csrf-token]').attr('content');
            var csrf_param = $('meta[name=csrf-param]').attr('content');
            if (csrf_param && csrf_token) {
                s.extraData = s.extraData || {};
                s.extraData[csrf_param] = csrf_token;
            }

            // take a breath so that pending repaints get some cpu time before the upload starts
            function doSubmit() {
                // make sure form attrs are set
                var t = $form.attr2('target'),
                        a = $form.attr2('action'),
                        mp = 'multipart/form-data',
                        et = $form.attr('enctype') || $form.attr('encoding') || mp;

                // update form attrs in IE friendly way
                form.setAttribute('target', id);
                if (!method || /post/i.test(method)) {
                    form.setAttribute('method', 'POST');
                }
                if (a != s.url) {
                    form.setAttribute('action', s.url);
                }

                // ie borks in some cases when setting encoding
                if (!s.skipEncodingOverride && (!method || /post/i.test(method))) {
                    $form.attr({
                        encoding: 'multipart/form-data',
                        enctype: 'multipart/form-data'
                    });
                }

                // support timout
                if (s.timeout) {
                    timeoutHandle = setTimeout(function () {
                        timedOut = true;
                        cb(CLIENT_TIMEOUT_ABORT);
                    }, s.timeout);
                }

                // look for server aborts
                function checkState() {
                    try {
                        var state = getDoc(io).readyState;
                        log('state = ' + state);
                        if (state && state.toLowerCase() == 'uninitialized') {
                            setTimeout(checkState, 50);
                        }
                    } catch (e) {
                        log('Server abort: ', e, ' (', e.name, ')');
                        cb(SERVER_ABORT);
                        if (timeoutHandle) {
                            clearTimeout(timeoutHandle);
                        }
                        timeoutHandle = undefined;
                    }
                }

                // add "extra" data to form if provided in options
                var extraInputs = [];
                try {
                    if (s.extraData) {
                        for (var n in s.extraData) {
                            if (s.extraData.hasOwnProperty(n)) {
                                // if using the $.param format that allows for multiple values with the same name
                                if ($.isPlainObject(s.extraData[n]) && s.extraData[n].hasOwnProperty('name') && s.extraData[n].hasOwnProperty('value')) {
                                    extraInputs.push(
                                            $('<input type="hidden" name="' + s.extraData[n].name + '">').val(s.extraData[n].value)
                                            .appendTo(form)[0]);
                                } else {
                                    extraInputs.push(
                                            $('<input type="hidden" name="' + n + '">').val(s.extraData[n])
                                            .appendTo(form)[0]);
                                }
                            }
                        }
                    }

                    if (!s.iframeTarget) {
                        // add iframe to doc and submit the form
                        $io.appendTo('body');
                    }
                    if (io.attachEvent) {
                        io.attachEvent('onload', cb);
                    } else {
                        io.addEventListener('load', cb, false);
                    }
                    setTimeout(checkState, 15);

                    try {
                        form.submit();
                    } catch (err) {
                        // just in case form has element with name/id of 'submit'
                        var submitFn = document.createElement('form').submit;
                        submitFn.apply(form);
                    }
                } finally {
                    // reset attrs and remove "extra" input elements
                    form.setAttribute('action', a);
                    form.setAttribute('enctype', et); // #380
                    if (t) {
                        form.setAttribute('target', t);
                    } else {
                        $form.removeAttr('target');
                    }
                    $(extraInputs).remove();
                }
            }

            if (s.forceSync) {
                doSubmit();
            } else {
                setTimeout(doSubmit, 10); // this lets dom updates render
            }

            var data, doc, domCheckCount = 50, callbackProcessed;

            function cb(e) {
                if (xhr.aborted || callbackProcessed) {
                    return;
                }

                doc = getDoc(io);
                if (!doc) {
                    log('cannot access response document');
                    e = SERVER_ABORT;
                }
                if (e === CLIENT_TIMEOUT_ABORT && xhr) {
                    xhr.abort('timeout');
                    deferred.reject(xhr, 'timeout');
                    return;
                } else if (e == SERVER_ABORT && xhr) {
                    xhr.abort('server abort');
                    deferred.reject(xhr, 'error', 'server abort');
                    return;
                }

                if (!doc || doc.location.href == s.iframeSrc) {
                    // response not received yet
                    if (!timedOut) {
                        return;
                    }
                }
                if (io.detachEvent) {
                    io.detachEvent('onload', cb);
                } else {
                    io.removeEventListener('load', cb, false);
                }

                var status = 'success', errMsg;
                try {
                    if (timedOut) {
                        throw 'timeout';
                    }

                    var isXml = s.dataType == 'xml' || doc.XMLDocument || $.isXMLDoc(doc);
                    log('isXml=' + isXml);
                    if (!isXml && window.opera && (doc.body === null || !doc.body.innerHTML)) {
                        if (--domCheckCount) {
                            // in some browsers (Opera) the iframe DOM is not always traversable when
                            // the onload callback fires, so we loop a bit to accommodate
                            log('requeing onLoad callback, DOM not available');
                            setTimeout(cb, 250);
                            return;
                        }
                        // let this fall through because server response could be an empty document
                        //log('Could not access iframe DOM after mutiple tries.');
                        //throw 'DOMException: not available';
                    }

                    //log('response detected');
                    var docRoot = doc.body ? doc.body : doc.documentElement;
                    xhr.responseText = docRoot ? docRoot.innerHTML : null;
                    xhr.responseXML = doc.XMLDocument ? doc.XMLDocument : doc;
                    if (isXml) {
                        s.dataType = 'xml';
                    }
                    xhr.getResponseHeader = function (header) {
                        var headers = {'content-type': s.dataType};
                        return headers[header.toLowerCase()];
                    };
                    // support for XHR 'status' & 'statusText' emulation :
                    if (docRoot) {
                        xhr.status = Number(docRoot.getAttribute('status')) || xhr.status;
                        xhr.statusText = docRoot.getAttribute('statusText') || xhr.statusText;
                    }

                    var dt = (s.dataType || '').toLowerCase();
                    var scr = /(json|script|text)/.test(dt);
                    if (scr || s.textarea) {
                        // see if user embedded response in textarea
                        var ta = doc.getElementsByTagName('textarea')[0];
                        if (ta) {
                            xhr.responseText = ta.value;
                            // support for XHR 'status' & 'statusText' emulation :
                            xhr.status = Number(ta.getAttribute('status')) || xhr.status;
                            xhr.statusText = ta.getAttribute('statusText') || xhr.statusText;
                        } else if (scr) {
                            // account for browsers injecting pre around json response
                            var pre = doc.getElementsByTagName('pre')[0];
                            var b = doc.getElementsByTagName('body')[0];
                            if (pre) {
                                xhr.responseText = pre.textContent ? pre.textContent : pre.innerText;
                            } else if (b) {
                                xhr.responseText = b.textContent ? b.textContent : b.innerText;
                            }
                        }
                    } else if (dt == 'xml' && !xhr.responseXML && xhr.responseText) {
                        xhr.responseXML = toXml(xhr.responseText);
                    }

                    try {
                        data = httpData(xhr, dt, s);
                    } catch (err) {
                        status = 'parsererror';
                        xhr.error = errMsg = (err || status);
                    }
                } catch (err) {
                    log('error caught: ', err);
                    status = 'error';
                    xhr.error = errMsg = (err || status);
                }

                if (xhr.aborted) {
                    log('upload aborted');
                    status = null;
                }

                if (xhr.status) { // we've set xhr.status
                    status = (xhr.status >= 200 && xhr.status < 300 || xhr.status === 304) ? 'success' : 'error';
                }

                // ordering of these callbacks/triggers is odd, but that's how $.ajax does it
                if (status === 'success') {
                    if (s.success) {
                        s.success.call(s.context, data, 'success', xhr);
                    }
                    deferred.resolve(xhr.responseText, 'success', xhr);
                    if (g) {
                        $.event.trigger("ajaxSuccess", [xhr, s]);
                    }
                } else if (status) {
                    if (errMsg === undefined) {
                        errMsg = xhr.statusText;
                    }
                    if (s.error) {
                        s.error.call(s.context, xhr, status, errMsg);
                    }
                    deferred.reject(xhr, 'error', errMsg);
                    if (g) {
                        $.event.trigger("ajaxError", [xhr, s, errMsg]);
                    }
                }

                if (g) {
                    $.event.trigger("ajaxComplete", [xhr, s]);
                }

                if (g && !--$.active) {
                    $.event.trigger("ajaxStop");
                }

                if (s.complete) {
                    s.complete.call(s.context, xhr, status);
                }

                callbackProcessed = true;
                if (s.timeout) {
                    clearTimeout(timeoutHandle);
                }

                // clean up
                setTimeout(function () {
                    if (!s.iframeTarget) {
                        $io.remove();
                    } else { //adding else to clean up existing iframe response.
                        $io.attr('src', s.iframeSrc);
                    }
                    xhr.responseXML = null;
                }, 100);
            }

            var toXml = $.parseXML || function (s, doc) { // use parseXML if available (jQuery 1.5+)
                if (window.ActiveXObject) {
                    doc = new ActiveXObject('Microsoft.XMLDOM');
                    doc.async = 'false';
                    doc.loadXML(s);
                } else {
                    doc = (new DOMParser()).parseFromString(s, 'text/xml');
                }
                return (doc && doc.documentElement && doc.documentElement.nodeName != 'parsererror') ? doc : null;
            };
            var parseJSON = $.parseJSON || function (s) {
                /*jslint evil:true */
                return window['eval']('(' + s + ')');
            };

            var httpData = function (xhr, type, s) { // mostly lifted from jq1.4.4

                var ct = xhr.getResponseHeader('content-type') || '',
                        xml = type === 'xml' || !type && ct.indexOf('xml') >= 0,
                        data = xml ? xhr.responseXML : xhr.responseText;

                if (xml && data.documentElement.nodeName === 'parsererror') {
                    if ($.error) {
                        $.error('parsererror');
                    }
                }
                if (s && s.dataFilter) {
                    data = s.dataFilter(data, type);
                }
                if (typeof data === 'string') {
                    if (type === 'json' || !type && ct.indexOf('json') >= 0) {
                        data = parseJSON(data);
                    } else if (type === "script" || !type && ct.indexOf("javascript") >= 0) {
                        $.globalEval(data);
                    }
                }
                return data;
            };

            return deferred;
        }
    };

    $.fn.ajaxForm = function (options) {
        options = options || {};
        options.delegation = options.delegation && $.isFunction($.fn.on);

        // in jQuery 1.3+ we can fix mistakes with the ready state
        if (!options.delegation && this.length === 0) {
            var o = {s: this.selector, c: this.context};
            if (!$.isReady && o.s) {
                log('DOM not ready, queuing ajaxForm');
                $(function () {
                    $(o.s, o.c).ajaxForm(options);
                });
                return this;
            }
            // is your DOM ready?  http://docs.jquery.com/Tutorials:Introducing_$(document).ready()
            log('terminating; zero elements found by selector' + ($.isReady ? '' : ' (DOM not ready)'));
            return this;
        }

        if (options.delegation) {
            $(document)
                    .off('submit.form-plugin', this.selector, doAjaxSubmit)
                    .off('click.form-plugin', this.selector, captureSubmittingElement)
                    .on('submit.form-plugin', this.selector, options, doAjaxSubmit)
                    .on('click.form-plugin', this.selector, options, captureSubmittingElement);
            return this;
        }

        return this.ajaxFormUnbind()
                .bind('submit.form-plugin', options, doAjaxSubmit)
                .bind('click.form-plugin', options, captureSubmittingElement);
    };

    function doAjaxSubmit(e) {
        /*jshint validthis:true */
        var options = e.data;
        if (!e.isDefaultPrevented()) { // if event has been canceled, don't proceed
            e.preventDefault();
            $(e.target).ajaxSubmit(options); // #365
        }
    }

    function captureSubmittingElement(e) {
        /*jshint validthis:true */
        var target = e.target;
        var $el = $(target);
        if (!($el.is("[type=submit],[type=image]"))) {
            // is this a child element of the submit el?  (ex: a span within a button)
            var t = $el.closest('[type=submit]');
            if (t.length === 0) {
                return;
            }
            target = t[0];
        }
        var form = this;
        form.clk = target;
        if (target.type == 'image') {
            if (e.offsetX !== undefined) {
                form.clk_x = e.offsetX;
                form.clk_y = e.offsetY;
            } else if (typeof $.fn.offset == 'function') {
                var offset = $el.offset();
                form.clk_x = e.pageX - offset.left;
                form.clk_y = e.pageY - offset.top;
            } else {
                form.clk_x = e.pageX - target.offsetLeft;
                form.clk_y = e.pageY - target.offsetTop;
            }
        }
        // clear form vars
        setTimeout(function () {
            form.clk = form.clk_x = form.clk_y = null;
        }, 100);
    }

    $.fn.ajaxFormUnbind = function () {
        return this.unbind('submit.form-plugin click.form-plugin');
    };

    $.fn.formToArray = function (semantic, elements) {
        var a = [];
        if (this.length === 0) {
            return a;
        }

        var form = this[0];
        var formId = this.attr('id');
        var els = semantic ? form.getElementsByTagName('*') : form.elements;
        var els2;

        if (els && !/MSIE [678]/.test(navigator.userAgent)) { // #390
            els = $(els).get();  // convert to standard array
        }

        // #386; account for inputs outside the form which use the 'form' attribute
        if (formId) {
            els2 = $(':input[form="' + formId + '"]').get(); // hat tip @thet
            if (els2.length) {
                els = (els || []).concat(els2);
            }
        }

        if (!els || !els.length) {
            return a;
        }

        var i, j, n, v, el, max, jmax;
        for (i = 0, max = els.length; i < max; i++) {
            el = els[i];
            n = el.name;
            if (!n || el.disabled) {
                continue;
            }

            if (semantic && form.clk && el.type == "image") {
                // handle image inputs on the fly when semantic == true
                if (form.clk == el) {
                    a.push({name: n, value: $(el).val(), type: el.type});
                    a.push({name: n + '.x', value: form.clk_x}, {name: n + '.y', value: form.clk_y});
                }
                continue;
            }

            v = $.fieldValue(el, true);
            if (v && v.constructor == Array) {
                if (elements) {
                    elements.push(el);
                }
                for (j = 0, jmax = v.length; j < jmax; j++) {
                    a.push({name: n, value: v[j]});
                }
            } else if (feature.fileapi && el.type == 'file') {
                if (elements) {
                    elements.push(el);
                }
                var files = el.files;
                if (files.length) {
                    for (j = 0; j < files.length; j++) {
                        a.push({name: n, value: files[j], type: el.type});
                    }
                } else {
                    // #180
                    a.push({name: n, value: '', type: el.type});
                }
            } else if (v !== null && typeof v != 'undefined') {
                if (elements) {
                    elements.push(el);
                }
                a.push({name: n, value: v, type: el.type, required: el.required});
            }
        }

        if (!semantic && form.clk) {
            // input type=='image' are not found in elements array! handle it here
            var $input = $(form.clk), input = $input[0];
            n = input.name;
            if (n && !input.disabled && input.type == 'image') {
                a.push({name: n, value: $input.val()});
                a.push({name: n + '.x', value: form.clk_x}, {name: n + '.y', value: form.clk_y});
            }
        }
        return a;
    };

    $.fn.formSerialize = function (semantic) {
        //hand off to jQuery.param for proper encoding
        return $.param(this.formToArray(semantic));
    };

    $.fn.fieldSerialize = function (successful) {
        var a = [];
        this.each(function () {
            var n = this.name;
            if (!n) {
                return;
            }
            var v = $.fieldValue(this, successful);
            if (v && v.constructor == Array) {
                for (var i = 0, max = v.length; i < max; i++) {
                    a.push({name: n, value: v[i]});
                }
            } else if (v !== null && typeof v != 'undefined') {
                a.push({name: this.name, value: v});
            }
        });
        //hand off to jQuery.param for proper encoding
        return $.param(a);
    };

    $.fn.fieldValue = function (successful) {
        for (var val = [], i = 0, max = this.length; i < max; i++) {
            var el = this[i];
            var v = $.fieldValue(el, successful);
            if (v === null || typeof v == 'undefined' || (v.constructor == Array && !v.length)) {
                continue;
            }
            if (v.constructor == Array) {
                $.merge(val, v);
            } else {
                val.push(v);
            }
        }
        return val;
    };

    $.fieldValue = function (el, successful) {
        var n = el.name, t = el.type, tag = el.tagName.toLowerCase();
        if (successful === undefined) {
            successful = true;
        }
        if (successful && (!n || el.disabled || t == 'reset' || t == 'button' ||
                (t == 'checkbox' || t == 'radio') && !el.checked ||
                (t == 'submit' || t == 'image') && el.form && el.form.clk != el ||
                tag == 'select' && el.selectedIndex == -1)) {
            return null;
        }
        if (tag == 'select') {
            var index = el.selectedIndex;
            if (index < 0) {
                return null;
            }
            var a = [], ops = el.options;
            var one = (t == 'select-one');
            var max = (one ? index + 1 : ops.length);
            for (var i = (one ? index : 0); i < max; i++) {
                var op = ops[i];
                if (op.selected) {
                    var v = op.value;
                    if (!v) { // extra pain for IE...
                        v = (op.attributes && op.attributes.value && !(op.attributes.value.specified)) ? op.text : op.value;
                    }
                    if (one) {
                        return v;
                    }
                    a.push(v);
                }
            }
            return a;
        }
        return $(el).val();
    };

    $.fn.clearForm = function (includeHidden) {
        return this.each(function () {
            $('input,select,textarea', this).clearFields(includeHidden);
        });
    };

    /**
     * Clears the selected form elements.
     */
    $.fn.clearFields = $.fn.clearInputs = function (includeHidden) {
        var re = /^(?:color|date|datetime|email|month|number|password|range|search|tel|text|time|url|week)$/i; // 'hidden' is not in this list
        return this.each(function () {
            var t = this.type, tag = this.tagName.toLowerCase();
            if (re.test(t) || tag == 'textarea') {
                this.value = '';
            } else if (t == 'checkbox' || t == 'radio') {
                this.checked = false;
            } else if (tag == 'select') {
                this.selectedIndex = -1;
            } else if (t == "file") {
                if (/MSIE/.test(navigator.userAgent)) {
                    $(this).replaceWith($(this).clone(true));
                } else {
                    $(this).val('');
                }
            } else if (includeHidden) {
                // includeHidden can be the value true, or it can be a selector string
                // indicating a special test; for example:
                //  $('#myForm').clearForm('.special:hidden')
                // the above would clean hidden inputs that have the class of 'special'
                if ((includeHidden === true && /hidden/.test(t)) ||
                        (typeof includeHidden == 'string' && $(this).is(includeHidden))) {
                    this.value = '';
                }
            }
        });
    };

    /**
     * Resets the form data.  Causes all form elements to be reset to their original value.
     */
    $.fn.reset = function () {
        var that = this;
        return this.each(function () {
            // guard against an input with the name of 'reset'
            // note that IE reports the reset function as an 'object'
            if (typeof this.reset == 'function' || (typeof this.reset == 'object' && !this.reset.nodeType)) {
                var controls = [];
                $(this).find(".js_no_reset").each(function () {
                    controls.push({control: this, value: $(this).val()});
                });
                this.reset();
                var con = null;
                for (var i = 0; i < controls.length; i++) {
                    con = controls[i];
                    $(con.control).val(con.value);
                }
                that.find('*').removeClass('validation-succe validation-fail');
                if (typeof (that.reRenderUI) != 'undefined')
                    that.reRenderUI();
            }
        });
    };

    /**
     * Enables or disables any matching elements.
     */
    $.fn.enable = function (b) {
        if (b === undefined) {
            b = true;
        }
        return this.each(function () {
            this.disabled = !b;
        });
    };

    /**
     * Checks/unchecks any matching checkboxes or radio buttons and
     * selects/deselects and matching option elements.
     */
    $.fn.selected = function (select) {
        if (select === undefined) {
            select = true;
        }
        return this.each(function () {
            var t = this.type;
            if (t == 'checkbox' || t == 'radio') {
                this.checked = select;
            } else if (this.tagName.toLowerCase() == 'option') {
                var $sel = $(this).parent('select');
                if (select && $sel[0] && $sel[0].type == 'select-one') {
                    // deselect all other options
                    $sel.find('option').selected(false);
                }
                this.selected = select;
            }
        });
    };

// expose debug var
    $.fn.ajaxSubmit.debug = false;


// helper fn for console logging
    function log() {
        if (!$.fn.ajaxSubmit.debug) {
            return;
        }
        var msg = '[jquery.form] ' + Array.prototype.join.call(arguments, '');
        if (window.console && window.console.log) {
            window.console.log(msg);
        } else if (window.opera && window.opera.postError) {
            window.opera.postError(msg);
        }
    }



    $.fn.bindForm = function (settings) {
        var defaults = {
            debug: false,
            position: "bottom",
            dataType: {
                phone: /((\d{11})|^((\d{3,8})|(\d{4}|\d{3})-(\d{7,8})|(\d{4}|\d{3})-(\d{7,8})-(\d{4}|\d{3}|\d{2}|\d{1})|(\d{7,8})-(\d{4}|\d{3}|\d{2}|\d{1}))$)/,
                email: /^[0-9a-zA-Z_\-\.]+@\w+([-.]\w+)*\.\w+([-.]\w+)*$/,
                mobile: /^(13|14|15|17|18)\d{9}$/,
                url: /^(http|https):\/\/[A-Za-z0-9]+\.[A-Za-z0-9]+[\/=\?%\-&_~`@[\]\':+!]*([^<>\"])*$/,
                ip: /^(0|[1-9]\d?|[0-1]\d{2}|2[0-4]\d|25[0-5]).(0|[1-9]\d?|[0-1]\d{2}|2[0-4]\d|25[0-5]).(0|[1-9]\d?|[0-1]\d{2}|2[0-4]\d|25[0-5]).(0|[1-9]\d?|[0-1]\d{2}|2[0-4]\d|25[0-5])$/,
                //amount: /^\d+(\.\d+)?$/,
                amount: /(^[1-9]([0-9]+)?(\.[0-9]{1,2})?$)|(^(0){1}$)|(^[0-9]\.[0-9]([0-9])?$)/,
                postal: /^[1-9]\d{5}$/,
                qq: /^[1-9]\d{4,12}$/,
                english: /^[A-Za-z]+$/,
                chinese: /^[\u0391-\uFFE5]+$/,
                positive_integer: /^\d+$/,
                negative_integer: /^((-\d+)|(0+))$/,
                discount: /(^[1-9]?$)|(^[1-9]\.[0-9]{1}?$)/
                ///(^[0]?$)|(^[0]\.[0]{1}?$)|(^[1-9]?$)|(^[1-9]\.[0-9]{1}?$)/
            },
            dataTypeMsg: {
                phone: "不是有效的电话号",
                email: "不是有效的电子邮箱",
                mobile: "不是有效的手机号码",
                url: "不是有效的网址",
                ip: "不是有效的IP地址",
                amount: "不是有效的金额",
                postal: "不是有效的邮政编码",
                qq: "不是有效的QQ号码",
                english: "必须是英文",
                chinese: "必须是中文",
                positive_integer: "必须是正整数",
                negative_integer: "必须是负整数",
                discount: "1-9.9之间的数字，精确到小数点后1位"
            }
        };

        this.settings = $.extend({}, defaults, settings);
        var form = this;
        //已经绑定事件时跳过，避免事件重复绑定;          
        if (form.attr("bind_valid") != null)
            return;
        form.attr("bind_valid", "1");
        // Add novalidate tag if HTML5.
        form.attr("novalidate", "novalidate");
        var self = this;
        form.on("blur", ".required", function () {
            self.validValue($(this));
        });
        form.on("keyup", "[data-datatype]", function () {
            self.validValue($(this));
        });
        form.on("keyup", "[data-maxlength]", function () {
            self.validateLength($(this));
        });
        form.on("keyup", "[data-maxcharlength]", function () {
            self.validateCharLength($(this));
        });
        form.on("submit", function () {
            return self.valid();
        });
        this.valid = function () {
            var f = this.validForm();
            if (this.afterValid != null)
                this.afterValid.call(this, f);
            return f;
        };

        this.init = function () {
            var f = true;
            form.find("[data-maxlength]").each(function (i) {
                if ($(this).hasClass("input_fail")) {
                    form.find(".input_fail").eq(0).focus();
                    return false;
                }
                if (!self.validateLength($(this)))
                    f = false;
            });
            form.find("[data-maxcharlength]").each(function (i) {
                if ($(this).hasClass("input_fail")) {
                    form.find(".input_fail").eq(0).focus();
                    return false;
                }
                if (!self.validateCharLength($(this)))
                    f = false;
            });
            if (!f)
                form.find(".input_fail").eq(0).focus();
            return f;
        };
        this.validForm = function () {
            var f = true;
            form.find(".required").each(function (i) {
                if (!self.validValue($(this)))
                    f = false;
            });
            form.find("[data-datatype]").each(function (i) {
                if (!$(this)[0].disabled) {
                    if (!self.validValue($(this)))
                        f = false;
                }
            });
            form.find("[data-maxlength]").each(function (i) {
                if ($(this).hasClass("input_fail")) {
                    form.find(".input_fail").eq(0).focus();
                    f = false;
                }
                if (!self.validateLength($(this)))
                    f = false;
            });
            form.find("[data-maxcharlength]").each(function (i) {
                if ($(this).hasClass("input_fail")) {
                    form.find(".input_fail").eq(0).focus();
                    f = false;
                }
                if (!self.validateCharLength($(this)))
                    f = false;
            });
            if (!f)
                form.find(".input_fail").eq(0).focus();
            return f;
        };
        var inputKeyup = function (con) {
            self.validValue(con);
        };
        var writeMsg = function (con, msg) {
            showFail.call(con, msg);
            con.one("keyup", function () {
                inputKeyup(con);
            });
        };
        this.validValue = function (con) {
            var flag = true;
            con = $(con);
            if (con.length > 0 && con[0].tagName != "INPUT" && con[0].tagName != "TEXTAREA" && con[0].tagName != "SELECT")
                return true;
            var val = con.val();
            if (val == "" && con.hasClass("required")) {
                var msg = con.attr("data-msg");
                if (msg == null || msg == "")
                    msg = "不能为空！";
                writeMsg(con, msg);
                flag = false;
            } else if (val == "" && !con.hasClass("required")) {
                showSucce.call(con);
            }
            if (val != "") {
                if (!this.validateLength(con))
                    flag = false;
                else if (!this.validateCharLength(con))
                    flag = false;
                else {
                    var datatype = con.attr("data-datatype");
                    if (datatype != null && datatype != "") {
                        var reg = this.settings.dataType[datatype];
                        if (reg == null)
                            reg = eval(datatype);
                        //验证正则表达式.    
                        if (!reg.test(val)) {
                            var msg = con.attr("data-datatypemsg");
                            if (msg == null || msg == "")
                                msg = this.settings.dataTypeMsg[datatype];
                            if (msg == null || msg == "")
                                msg = "输入有误！";
                            writeMsg(con, msg);
                            return false;
                        }
                    }
                    var equalcontron = con.attr("data-equalcontron");//控件值比对 用于比较密码
                    if (equalcontron != null && val != $(equalcontron).val()) {
                        var msg = con.attr("data-equalmsg");
                        if (msg == null || msg == "")
                            msg = "两次输入的值不一至";
                        writeMsg(con, msg);
                        return false;
                    }
                    showSucce.call(con);
                    con.unbind("keyup", function () {
                        inputKeyup(con);
                    });
                }
            }
            return flag;
        };
        this.validateCharLength = function (con) {
            var flag = true;
            con = $(con);
            var maxlength = con.attr("data-maxcharlength");
            if (maxlength != null && maxlength > 0) {
                var val = con.val();
                var len = val.length;
                var vlid = con.attr("data-wrodlength");
                if (vlid != null && vlid != "")
                    $(vlid).html(len);
                if (len > maxlength) {
                    var msg = "长度不能超过" + maxlength + "个字符！";
                    showFail.call(con, msg);
                    flag = false;
                } else
                {
                    showSucce.call(con, msg);
                }
            }
            return flag;
        };
        //验证长度
        this.validateLength = function (con) {
            var flag = true;
            con = $(con);
            var maxlength = con.attr("data-maxlength");
            if (maxlength != null && maxlength > 0) {
                var val = con.val();
                var len = Math.round(this.getValueLength(val));
                var vlid = con.attr("data-wrodlength");
                if (vlid != null && vlid != "")
                    $(vlid).html(len);
                if (len > maxlength) {
                    var msg = "长度不能超过" + (maxlength / 2) + "个汉字或" + maxlength + "个英文字母！";
                    showFail.call(con, msg);
                    flag = false;
                } else
                {
                    showSucce.call(con, msg);
                }
            }
            return flag;
        };
        this.getValueLength = function (val) {
            if (val == null || val == "")
                return 0;
            var cArr = val.match(/[^\x00-\xff]/ig);
            return val.length + (cArr == null ? 0 : cArr.length);
        };
        this.fail = function (con, msg) {
            showFail.call($(con), msg);
        };
        this.removeFail = function (con) {
            removeFail.call($(con));
        };
        this.succe = function (con) {
            showSucce.call($(con));
        };

        var showSucce = function () {
            var con = $(this);
            var box = getMsgBox.call(con);
            box.parent().removeClass("validation-fail").addClass("validation-succe");
            con.removeClass("input_fail");
        };
        var showFail = function (msg) {
            var con = $(this);
            var box = getMsgBox.call(con);
            box.find(".js_msg").text(msg);
            con.addClass("input_fail");
            var select_wrap = box.parent().removeClass("validation-succe").addClass("validation-fail").find(".ui-wrap");
            if (select_wrap.length > 0) {
                var left = select_wrap.parent().prev().outerWidth() + select_wrap.outerWidth();
                box.css("left", left);
            }

        };
        var removeFail = function () {
            var con = $(this);
            var box = $(this).next(".validation-msg-wrap");
            box.remove();
            con.parent().removeClass("validation-fail");
            con.removeClass("input_fail");
        };
        var getMsgBox = function () {
            var box = $(this).next(".validation-msg-wrap");
            if (box.length == 0) {
                box = $('<div class="validation-msg-wrap"><div class="tipbox right"><i class="arrow"></i><div class="tipbox-content js_msg"></div></div></div>');
                $(this).after(box);
            }
            return box;
        };
        if (typeof (this.ui) != 'undefined')
            this.ui().render();
        return this;
    };


}));