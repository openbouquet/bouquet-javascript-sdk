(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['Backbone', '_', 'squid_api'], factory);
    } else {
        factory(root.Backbone, _, root.squid_api);
    }
}(this, function (Backbone, _, squid_api) {

    // Enhance Squid API utils

    squid_api.utils = _.extend(squid_api.utils, {

        /**
         * Check the API matches a given version string.
         * @param semver range to match (e.g. ">=4.2.4")
         * @return a Promise
         */
        checkAPIVersion : function(range) {
            var dfd = $.Deferred();
            if (!squid_api.apiVersion) {
                // not in cache, execute the query
                $.ajax({
                    url: squid_api.apiURL+"/status"
                }).done(null, function (xhr) {
                    // put in cache
                    squid_api.apiVersion = xhr;
                    // version check
                    if (xhr["bouquet-server"]) {
                        var version = xhr["bouquet-server"].version;
                        version = version.replace("-SNAPSHOT","");
                        if (semver.satisfies(version, range)) {
                            dfd.resolve(version);
                        } else {
                            dfd.reject(version);
                        }
                    } else {
                        dfd.reject();
                    }
                }).fail(null, function (xhr) {
                    dfd.reject();
                });
                return dfd;
            } else {
                // already in cache
                // just check and return a promise
                if (squid_api.apiVersion["bouquet-server"]) {
                    var version = squid_api.apiVersion["bouquet-server"].version;
                    version = version.replace("-SNAPSHOT","");
                    if (semver.satisfies(version, range)) {
                        return dfd.resolve(version);
                    } else {
                        return dfd.reject(version);
                    }
                } else {
                    return dfd.reject();
                }
            }
        },

        /*
         * Get a parameter value from the current location url
         */
        getParamValue: function (name, defaultValue, uri) {
            uri = uri || new URI(window.location.href);
            var value;
            if (uri.hasQuery(name) === true) {
                value = uri.search(true)[name];
            } else {
                value = defaultValue;
            }
            return value;
        },

        clearParam: function (name) {
            var uri = new URI(window.location.href);
            uri.removeQuery(name);
        },

        selectedComparator : function(a,b) {
            var da = a.selected;
            var db = b.selected;
            return (da === db) ? 0 : da ? -1 : 1;
        },

        dynamicComparator : function(a,b) {
            var da = a.dynamic;
            var db = b.dynamic;
            return (da === db) ? 0 : da ? 1 : -1;
        },

        alphaNameComparator : function(a,b) {
            var va;
            var vb;
            if (a.name && b.name) {
                va = a.name.toLowerCase();
                vb = b.name.toLowerCase();
            } else if (a.label && b.label) {
                va = a.label.toLowerCase();
                vb = b.label.toLowerCase();
            }
            if (va < vb) {
                return -1;
            }
            if (va > vb) {
                return 1;
            }
            return 0;
        },

        /**
         * default model comparator : selected first, then dynamic, then alpha-name
         */
        defaultComparator: function(a, b) {
            var r;
            r = squid_api.utils.selectedComparator(a,b);
            if (r === 0) {
                r = squid_api.utils.dynamicComparator(a,b);
                if (r === 0) {
                    r = squid_api.utils.alphaNameComparator(a,b);
                }
            }
            return r;
        },

        /**
         * Write a cookie.
         * @param name cookie name
         * @param dom cookie domain
         * @param exp cookie expiration delay in minutes
         * @param v cookie value
         */
        writeCookie: function (name, dom, exp, v) {
            var d = null;
            if (exp) {
                d = new Date();
                d.setTime(d.getTime() + (exp * 60 * 1000));
            }
            var nc = name + "=" + escape(v) + ((d === null) ? "" : ";expires=" + d.toUTCString()) + "; path=/;";
            if (dom) {
                nc = nc + " domain=" + dom;
            }
            document.cookie = nc;
        },

        readCookie: function (name) {
            var c = null,
                dc = document.cookie;
            if (dc.length > 0) {
                var cs = dc.indexOf(name + "=");
                if (cs != -1) {
                    cs = cs + name.length + 1;
                    var ce = dc.indexOf(";", cs);
                    if (ce == -1) {
                        ce = dc.length;
                    }
                    c = unescape(dc.substring(cs, ce));
                }
            }
            return c;
        },

        clearLogin: function () {
            var cookiePrefix = "sq-token";
            squid_api.utils.writeCookie(cookiePrefix + "_" + squid_api.customerId, "", -100000, null);
            squid_api.utils.writeCookie(cookiePrefix, "", -100000, null);
            squid_api.getLoginFromToken(null);
        },

        getLoginUrl : function(redirectURI) {
            if (!this.redirectUri) {
                // use the current location stripping token or code parameters
                redirectUri = window.location.href;
            }
            // build redirect URI with appropriate token or code parameters
            var rurl = new URI(redirectUri);
            rurl.removeQuery("access_token");
            rurl.setQuery("code","auth_code");
            var rurlString = rurl.toString();
            // ugly trick to bypass urlencoding of auth_code parameter value
            rurlString = rurlString.replace("code=auth_code","code=${auth_code}");

            // redirection mode
            var url = new URI(squid_api.loginURL);
            url.setQuery("response_type","code");
            if (squid_api.clientId) {
                url.setQuery("client_id", squid_api.clientId);
            }
            url.setQuery("redirect_uri",rurlString);
            return url;
        },
        
        buildApiUrl : function(host, path, queryParameters) {
            var uri = host;
            if (!uri) {
                uri = squid_api.apiURL;
            }
            if (path) {
                uri = uri + path;
            }
            var url = new URI(uri);
            // add extra parameters
            if (queryParameters) {
                for (var i = 0; i < queryParameters.length; i++) {
                    var param = queryParameters[i];
                    if ((param.value !== null) && (typeof param.value !== 'undefined')) {
                        url.addQuery(param.name, param.value);
                    }
                }
            }
            // enforce some query parameters
            if (!url.hasQuery("timeout")) {
                url.setQuery("timeout", squid_api.timeoutMillis);
            }
            if (!url.hasQuery("access_token")) {
                url.setQuery("access_token", squid_api.model.login.get("accessToken"));
            }
            return url;
        }

    });

    squid_api = _.extend(squid_api, {
        /**
         * Compute an AnalysisJob or a FacetJob.
         * @return a Promise
         */
        compute: function (job, filters) {
            if (this.model.AnalysisJob && this.model.FiltersJob) {
                if (job instanceof this.model.FiltersJob) {
                    return this.controller.facetjob.compute(job, filters);
                } else {
                    return this.controller.analysisjob.compute(job, filters);
                }
            } else {
                throw Error("Cannot compute Job as dependencies are not loaded");
            }

        },

        getLoginFromToken: function (token, cookieExpiration) {
            var deferred = $.Deferred();
            var cookiePrefix = "sq-token", cookie, me = this;
            if (!cookieExpiration) {
                cookieExpiration = 60*24*365; // 1 year
            }
            if (squid_api.customerId) {
                cookie = cookiePrefix + "_" + squid_api.customerId;
            } else {
                cookie = cookiePrefix;
            }
            if (!token) {
                // search in a cookie
                token = squid_api.utils.readCookie(cookie);
            }

            // TODO should update this after we fetch the token
            squid_api.model.login.set("accessToken", token);

            // fetch the token info from server
            var tokenModel = new squid_api.model.TokenModel();
            tokenModel.fetch().fail(function (model, response, options) {
                if (model.status === 401) {
                    // init the Login URL if provided by server
                    if (model.responseJSON.loginURL) {
                        squid_api.loginURL = model.responseJSON.loginURL;
                    }
                    squid_api.model.login.set({"login": null});
                } else {
                    squid_api.model.login.set("error", response);
                    squid_api.model.login.set("login", "error");
                    var mes = "Cannot connect to Bouquet (error " + model.status + ")";
                    if (model.status === 404) {
                        mes += "\nCheck that the apiUrl parameter is correct";
                    }
                    squid_api.model.status.set({"message": mes, "canStart": false}, {silent: true});// must silent to avoid double display
                    squid_api.model.status.set("error", true);
                }
                deferred.reject();
            }).done(function (model, response, options) {
                // set the customerId
                squid_api.customerId = model.customerId;

                // verify the clientId
                if (model.clientId != this.clientId) {
                    console.log("WARN : the Token used doesn't match you application's ClientId");
                }

                if ((token) && (typeof token != "undefined")) {
                    // write in a customer cookie
                    squid_api.utils.writeCookie(cookiePrefix + "_" + squid_api.customerId, "", cookieExpiration, token);
                    // write in a global cookie
                    squid_api.utils.writeCookie(cookiePrefix, "", cookieExpiration, token);
                }

                // update login model from server
                squid_api.model.login.fetch().done( function() {
                    deferred.resolve(squid_api.model.login);
                }).fail( function() {
                    deferred.reject();
                });
            });

            return deferred;
        },

        /**
         * Proceed with the login process by dealing with access token or code.
         * @return a LoginModel within a Promise
         */
        getLogin : function() {
            var deferred = $.Deferred();
            var me = this;

            // set the access_token (to start the login model update)
            var code = squid_api.utils.getParamValue("code", null, me.uri);
            if (code) {
                // remove code parameter from browser history
                if (window.history) {
                    var uri = new URI(window.location.href);
                    uri.removeQuery("code");
                    window.history.pushState(code, "", uri);
                }

                // fetch the access token
                $.ajax({
                    type: "POST",
                    url: squid_api.apiURL + "/token",
                    dataType: 'json',
                    data: {
                        "grant_type": "authorization_code",
                        "code": code,
                        "client_id": squid_api.clientId,
                        "redirect_uri": null
                    }
                }).fail(function (jqXHR) {
                    deferred.reject();
                }).done(function (data) {
                    var token = data.oid;
                    me.getLoginFromToken(token).done( function(login) {
                        deferred.resolve(login);
                    }).fail( function() {
                        deferred.reject();
                    });
                });
            } else {
                var token = squid_api.utils.getParamValue("access_token", null, me.uri);
                me.getLoginFromToken(token).always( function(login) {
                    deferred.resolve(login);
                });
            }
            return deferred;
        },
        
        /**
         * Get a Model object
         * @param the object composite Id
         * Returns a Promise
         */
        getObject : function(id) {
            return this.getObjectHelper(squid_api.getCustomer(), id, 0);
        },
        
        getObjectHelper : function(p, id, level) {
            var keys = Object.keys(id);
            var l = keys.length;
            var oid = keys[level];
            if (level < l) {
                level++;
                return p.then(function(o) {
                    // done
                    var c = o.get(oid.substring(0,oid.length-2)+"s");
                    return squid_api.getObjectHelper(c.load(id[oid]),id, level);
                }, function() {
                    // fail
                    return p;
                });
            } else {
                return p;
            }
        },
        
        /**
         * Get the current Customer Model.
         * Returns a Promise
         */
        getCustomer : function() {
            var deferred;
            // check if not already executing
            if (this.deferredGetCustomer && (this.deferredGetCustomer.state() === "pending")) {
                // return existing pending deferredGetCustomer
                deferred = this.deferredGetCustomer;
            } else {
                // create a new deferredGetCustomer
                this.deferredGetCustomer = $.Deferred();
                deferred = this.deferredGetCustomer;
                var customer = squid_api.model.customer;
                if (customer) {
                    deferred.resolve(customer);
                } else {
                    // fetch the customer after making sure user is logged
                    this.getLogin().done( function() {
                        var customer2 = new squid_api.model.CustomerInfoModel();
                        customer2.fetch().done( function() {
                            squid_api.model.customer = customer2;
                            deferred.resolve(customer2);
                        }).fail( function() {
                            console.error("unable to fetch customer");
                            deferred.reject(customer2);
                        });
                    }).fail( function() {
                        deferred.reject();
                    });
                }
            }
            return deferred.promise();
        },

        /**
         * Get the current Project Model.
         * Returns a Promise
         */
        getSelectedProject : function(forceRefresh) {
            var projectId = squid_api.model.config.get("project");
            return this.getCustomer().then(function(customer) {
                return customer.get("projects").load(projectId, forceRefresh);
            });
        },

        /**
         * Get the current Domain Model.
         * Returns a Promise
         */
        getSelectedDomain : function(forceRefresh) {
            var projectId = squid_api.model.config.get("project");
            var domainId = squid_api.model.config.get("domain");
            return this.getCustomer().then(function(customer) {
                return customer.get("projects").load(projectId).then(function(project) {
                    return project.get("domains").load(domainId, forceRefresh);
                });
            });
        },

        /**
         * Save the current State model
         * @param an array of extra config elements
         */
        saveState: function (config) {
            var me = this;
            var attributes = {
                "config": me.model.config.attributes
            };

            // add the extra config
            if (config) {
                for (var i = 0; i < config.length; i++) {
                    var c = config[i];
                    for (var prop in c) {
                        attributes.config[prop] = c[prop];
                    }
                }
            }

            // check if save is required
            if ((!me.model.state) || (!_.isEqual(me.model.state, attributes.config))) {
                // check for same pending operation
                if (!squid_api.pendingStateSave) {
                    squid_api.pendingStateSave = {};
                }
                var hashCode = squid_api.utils.hashCode(JSON.stringify(attributes.config));
                if (!squid_api.pendingStateSave[hashCode]) {
                    squid_api.pendingStateSave[hashCode] = true;
                    var stateModel = new me.model.StateModel();
                    stateModel.set({
                        "id": {
                            "customerId": this.customerId,
                            "stateId": null
                        }
                    });
                    // save
                    stateModel.save(attributes, {
                        success: function (model, response, options) {
                            var oid = model.get("oid");
                            console.log("state saved : " + oid);
                            // keep for comparison when saved again
                            me.model.state = model.get("config");

                            // save in browser history
                            if (window.history) {
                                var uri = new URI(window.location.href);
                                uri.setQuery("state", oid);
                                window.history.pushState(model.toJSON(), "", uri);
                            }
                            delete squid_api.pendingStateSave[hashCode];
                        },
                        error: function (model, response, options) {
                            console.error("state save failed");
                            delete squid_api.pendingStateSave[hashCode];
                        }
                    });
                }
            }
        },

        /**
         * Apply a new config to squid_api.model.config
         * @param config the new config to apply
         * @param forcedConfig a function (or an object) used to post-process config values
         */
        setConfig : function(config, forcedConfig) {
            // keep for comparison when saved again
            squid_api.model.state = config;
            var newConfig = squid_api.utils.mergeAttributes(squid_api.defaultConfig, config);
            
            // set to null attributes no longer in current config
            for (var att in squid_api.model.config.attributes) {
                if (!newConfig[att]) {
                    newConfig[att] = null;
                }
            }
            
            // fix some invalid config attributes
            if (newConfig.chosenDimensions === null || ! newConfig.chosenDimensions) {
                newConfig.chosenDimensions = [];
            }
            if (newConfig.project === undefined) {
                delete newConfig.project;
            }
            
            // apply forcedConfig
            if (_.isFunction(forcedConfig)) {
                newConfig = forcedConfig(newConfig);
            } else {
                newConfig = squid_api.utils.mergeAttributes(newConfig, forcedConfig);
            }
            
            // apply the new config to current config
            squid_api.model.status.set("configReady", false);
            squid_api.model.config.set(newConfig);
            squid_api.model.status.set("configReady", true);
        },

        setStateId: function (dfd, stateId, forcedConfig) {
            var me = this;
            dfd = dfd || (new $.Deferred());
            // fetch the State
            var stateModel = new squid_api.model.StateModel();
            stateModel.set({
                "id": {
                    "customerId": this.customerId,
                    "stateId": stateId
                }
            });
            stateModel.fetch({
                success: function (model, response, options) {
                    // set the config
                    me.setConfig(model.get("config"), forcedConfig);
                    dfd.resolve(model);
                },
                error: function (model, response, options) {
                    // state fetch failed
                    dfd.reject();
                }
            });
            return dfd.promise();
        },

        setShortcutId: function (shortcutId, forcedConfig) {
            var me = this;
            var dfd = new $.Deferred();
            if (shortcutId) {
                var shortcutModel = new squid_api.model.ShortcutModel();
                shortcutModel.set({
                    "id": {
                        "customerId": this.customerId,
                        "shortcutId": shortcutId
                    }
                });
                shortcutModel.fetch({
                    success: function (model, response, options) {
                        console.log("shortcut fetched : " + model.get("name"));
                        me.model.status.set("shortcut", model);
                        // get the associated state
                        me.setStateId(dfd, model.get("stateId"), forcedConfig);
                    },
                    error: function (model, response, options) {
                        console.error("shortcut fetch failed : " + shortcutId);
                        dfd.reject();
                    }
                });
            } else {
                me.model.config.set(squid_api.defaultConfig);
            }
            return dfd.promise();
        },
        
        setBookmarkAction: function (bookmark, forcedConfig, attributes) {
            squid_api.setBookmark(bookmark, forcedConfig, attributes);
        },
        
        setBookmark: function (bookmark, forcedConfig, attributes) {
            var config = bookmark.get("config");
            squid_api.model.status.set("bookmark", bookmark);

            // if attributes array exists - only set these attributes
            if (attributes) {
                config = squid_api.model.config.toJSON();
                for (i=0; i<attributes.length; i++) {
                    var attr = attributes[i];
                    if (config[attr] && bookmark.get("config")[attr]) {
                        config[attr] = bookmark.get("config")[attr];
                    }
                }
            }
            
            // set the config
            squid_api.setConfig(config, forcedConfig);
        },

        setBookmarkId: function (bookmarkId, forcedConfig, attributes) {
            var me = this;
            var dfd = new $.Deferred();
            if (!forcedConfig) {
                forcedConfig = {};
            }
            var projectId = forcedConfig.project;
            if (!projectId) {
                projectId = me.model.config.get("project");
            }
            if (!projectId) {
                projectId = me.defaultConfig.project;
            }
            if (projectId && bookmarkId) {
                // get the Bookmark
                squid_api.getCustomer().then(function(customer) {
                    customer.get("projects").load(projectId).then(function(project) {
                        project.get("bookmarks").load(bookmarkId).done(function(bookmark) {
                            // current bookmark id goes to the config
                            forcedConfig.project = projectId;
                            forcedConfig.bookmark = bookmarkId;
                            me.setBookmarkAction(bookmark, forcedConfig, attributes);
                            dfd.resolve(bookmark);
                        }).fail(function(model, response, options) {
                            console.error("bookmark fetch failed : " + bookmarkId);
                            dfd.reject();
                        });
                    });
                });
            } else {
                me.model.config.set(squid_api.defaultConfig);
            }
            return dfd.promise();
        },

        /**
         * Setup the API default settings.
         * Note this method is idempotent.
         * @param a config json object
         */
        setup: function (args) {
            var me = this, api, apiUrl, timeoutMillis;
            args = args || {};

            var uri;
            if (args.uri) {
                uri = new URI(args.uri);
            } else {
                uri = this.uri || new URI(window.location.href);
            }
            this.uri = uri;
            this.customerId = squid_api.utils.getParamValue("customerId", args.customerId || this.customerId, uri);
            this.clientId = squid_api.utils.getParamValue("clientId", args.clientId || this.clientId, uri);
            this.debug = squid_api.utils.getParamValue("debug", args.debug || this.debug, uri);

            this.defaultShortcut = args.defaultShortcut || null;
            this.defaultConfig = this.utils.mergeAttributes(this.defaultConfig, args.config);
            this.defaultConfig.bookmark = squid_api.utils.getParamValue("bookmark", this.defaultConfig.bookmark, uri);
            this.defaultConfig.project = squid_api.utils.getParamValue("projectId", this.defaultConfig.project, uri);
            this.defaultConfig.selection = this.defaultConfig.selection || {
                    "facets" : []
            };
            this.defaultConfig.orderBy = null;

            if (args.browsers) {
                this.browsers = args.browsers;
            }

            if (args.apiVersionCheck) {
                this.apiVersionCheck = args.apiVersionCheck || "*";
            } else {
                this.apiVersionCheck = this.apiVersionCheck || "*";
            }

            // Application Models

            // support for backward compatibility
            if (!squid_api.model.project) {
                squid_api.model.project = new squid_api.model.ProjectModel();
            }

            // config
            if (!this.model.config) {
                this.model.config = new Backbone.Model();
            }

            // filters
            if (!this.model.filters) {
                this.model.filters = new squid_api.controller.facetjob.FiltersModel();
            }

            if (!this.apiUrl) {
                // init the api server URL
                api = squid_api.utils.getParamValue("api", "release", uri);
                version = squid_api.utils.getParamValue("version", "v4.2", uri);
    
                apiUrl = squid_api.utils.getParamValue("apiUrl", args.apiUrl, uri);
                if (!apiUrl) {
                    console.error("Please provide an API endpoint URL");
                } else {
                    if (apiUrl.indexOf("://") < 0) {
                        apiUrl = "https://" + apiUrl;
                    }
                    this.apiBaseURL = apiUrl + "/" + api + "/" + version;
                    this.setApiURL(this.apiBaseURL + "/rs");
                    this.swaggerURL = this.apiBaseURL + "/swagger.json";
                }
                // building default loginURL from apiURL
                squid_api.loginURL = apiUrl + "/" + api + "/auth/oauth";
    
                // init the timout
                timeoutMillis = args.timeoutMillis;
                if (!timeoutMillis) {
                    timeoutMillis = 10 * 1000; // 10 Sec.
                }
                this.setTimeoutMillis(timeoutMillis);
            }

            return this;
        },

        /**
         * Init the API by checking if an AccessToken is present in the url and updating the loginModel accordingly.
         * Note this method is idempotent.
         * @param a json object. If this object contains a "config" attribute, it'll be used as a default for setConfig.
         */
        init: function (args) {
            if (this.browserOK === null) {
                this.browserOK = false;
                if (this.browsers) {
                    // check browser compatibility
                    for (var browserIdx = 0; browserIdx < this.browsers.length; browserIdx++) {
                        var browser = this.browsers[browserIdx];
                        if (navigator.userAgent.indexOf(browser) > 0) {
                            this.browserOK = true;
                        }
                    }
                } else {
                    this.browserOK = true;
                }
                if (this.browserOK) {
                    if (!this.apiURL) {
                        this.model.status
                            .set(
                                "error",
                                {
                                    "dismissible": false,
                                    "message": "Please provide an API endpoint URL"
                                });
                    } else {
                        // continue init process
                        this.initStep0(args);
                    }
                } else {
                    console.error("Unsupported browser : " + navigator.userAgent);
                    this.model.status
                        .set(
                            'error',
                            {
                                "dismissible": false,
                                "message": "Sorry, you're using an unsupported browser. Supported browsers are Chrome, Firefox, Safari"
                            });
                }
            } else {
                // API already initialized
                if (args && args.config) {
                    if (args.config.bookmark) {
                    	this.setBookmarkId(args.config.bookmark);
                    } else {
                        this.setConfig(args.config);
                    }
                }
            }
        },

        initStep0: function(args) {
            // log API version
            var me = this;
            squid_api.utils.checkAPIVersion(this.apiVersionCheck).done(function(v){
                console.log("Bouquet Server version : "+v);
                me.initStep1(args);
            }).fail(function(v){
                var message;
                if (!v) {
                    message = "Unable to connect to the API";
                } else {
                    message = "Bouquet Server version does not match this App's api version requirements";
                }
                me.model.status.set("error",{
                    "dismissible": false,
                    "message": message
                });
            });
        },

        initStep1: function (args) {
            var me = this;

            // handle session expiration
            this.model.status.on('change:error', function (model) {
                var err = model.get("error");
                if (err) {
                    var status = err.status;
                    if (status == 401) {
                        me.utils.clearLogin();
                    }
                }
            });
            
            // check for login performed
            squid_api.getCustomer().done(function(customer) {
                // perform config init chain
                me.defaultConfig.customer = customer.get("id");
                var state = squid_api.utils.getParamValue("state", null, me.uri);
                var shortcut = squid_api.utils.getParamValue("shortcut", me.defaultShortcut, me.uri);
                var bookmark = me.defaultConfig.bookmark;
                var status = squid_api.model.status;
                var forcedConfig;
                if (args && args.config) {
                    // passing a config should take precedence over any state passed in url
                    forcedConfig = args.config;
                }
                if (state) {
                    me.setStateId(null, state, forcedConfig).fail(function () {
                        console.log("Warning : specified application state not found");
                        me.initStep2(args, shortcut, bookmark);
                    }).done(function() {
                        me.initStep3();
                    });
                } else {
                    me.initStep2(args, shortcut, bookmark);
                }
            }).fail(function() {
                squid_api.model.login.set("login", null);
            });
        },
        
        initStep2: function (args, shortcut, bookmark) {
            // set the config
            if (shortcut) {
                squid_api.setShortcutId(shortcut);
            } else if (bookmark) {
                squid_api.setBookmarkId(bookmark);
            } else if (args && args.config) {
                squid_api.setConfig(args.config);
            } else {
                squid_api.model.config.set(squid_api.defaultConfig);
            }
            squid_api.initStep3();
        },
            
        initStep3: function () {
            // init the notification websocket
            var ws;
            var endpoint = "ws"+squid_api.apiBaseURL.substring(4)+"/notification"+"?access_token="+squid_api.model.login.get("accessToken");
            console.log("Establishing WebSocket connection to "+endpoint);
            if ("WebSocket" in window) {
                ws = new WebSocket(endpoint);
            } else if ("MozWebSocket" in window) {
                ws = new MozWebSocket(endpoint);
            } else {
                console.error("WebSocket is not supported by this browser.");
            }
            if (ws) {
                squid_api.wsNotification = ws;
                ws.onopen = function () {
                    // reset the tries back to 1 since we have a new connection opened.
                    console.log("WebSocket connection opened.");
                    ws.send("hello");
                };
                ws.onmessage = function (event) {
                    var data = JSON.parse(event.data);
                    if (data.bouquetSessionId) {
                        if (data.logout === true) {
                            // that's a logout message
                            squid_api.bouquetSessionId = data.bouquetSessionId;
                            console.log("Logout bouquetSessionId: " + squid_api.bouquetSessionId);
                            squid_api.utils.clearLogin();
                        } else {
                            // that's a welcome message
                            squid_api.bouquetSessionId = data.bouquetSessionId;
                            squid_api.wsConnectionAttempts = 1; 
                            console.log("New bouquetSessionId: " + squid_api.bouquetSessionId);
                        }
                    } else {
                        // that's a object update message
                        // lookup the object
                        squid_api.getObject(data.source).done(function(o) {
                            data.name = o.get("name"); 
                            data.objectType = o.get("objectType"); 
                            squid_api.model.status.set({
                                "type" : "notification",
                                "message" : "An object was modified by an external action, please refresh your page to reflect this change.",
                                "data" : data
                                });
                        });
                    }
                };
                ws.onclose = function (event) {
                    squid_api.bouquetSessionId = null;
                    var time = Math.min(30, (Math.pow(2, squid_api.wsConnectionAttempts) - 1));
                    console.log("WebSocket connection closed, Code: " + event.code + (event.reason === "" ? "" : ", Reason: " + event.reason)+" - retrying in " + time + " sec");
                    setTimeout(function () {
                        // We've tried to reconnect so increment the attempts by 1
                        squid_api.wsConnectionAttempts++;
                        // Connection has closed so try to reconnect every 10 seconds.
                        squid_api.initStep3(); 
                    }, time*1000);
                };
            }
        },

        /**
         * Get the API's (Swagger) Schema.
         * Example usage :
         * squid_api.getSchema().done(function(data){console.log("schema :"+data);});
         * @param forceRefresh if true schema will be fetched
         * @return a Promise wrapping a schema json object or null if fetch failed.
         */
        getSchema: function (forceRefresh) {
            var dfd;
            var me = this;
            if ((!me.apiSchema) || (forceRefresh === true)) {
                // not in cache, execute the query
                return $.ajax({
                    url: me.swaggerURL
                }).done(null, function (xhr, status, error) {
                    // put in cache
                    me.apiSchema = xhr;
                });
            } else {
                // already in cache
                dfd = $.Deferred();
                // just resolve and return a promise
                return dfd.resolve(me.apiSchema).promise();
            }
        }
    });

    return squid_api;
}));
