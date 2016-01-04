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

        /*
         * Get a parameter value from the current location url
         */
        getParamValue: function (name, defaultValue) {
            var uri = new URI(window.location.href);
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
            squid_api.model.login.set({
                accessToken: null,
                login: null
            });
        },

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
                cookieExpiration = 120; // 2 hours
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

            if (!token) {
                deferred.reject();
            } else {
                // TODO should update this after we fetch the token
                squid_api.model.login.set("accessToken", token);

                // fetch the token info from server
                var tokenModel = new squid_api.model.TokenModel();
                tokenModel.fetch().fail(function (model, response, options) {
                    if (model.status === 401) {
                        squid_api.model.login.set("login", null);
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
            }
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
            var code = squid_api.utils.getParamValue("code", null);
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
                var token = squid_api.utils.getParamValue("access_token", null);
                me.getLoginFromToken(token).always( function(login) {
                    deferred.resolve(login);
                });
            }
            return deferred;
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
        getSelectedProject : function() {
            var projectId = squid_api.model.config.get("project");
            return this.getCustomer().then(function(customer) {
            	return customer.get("projects").load(projectId);
            });
        },

        /**
         * Get a collection of the current Project Model.
         * Returns a Promise
         */
        getSelectedProjectCollection : function(collectionName) {
            var projectId = squid_api.model.config.get("project");
            return this.getCustomer().then(function(customer) {
                return customer.get("projects").load(projectId).then(function(project) {
                    return project.get(collectionName).load();
                });
            });
        },

        /**
         * Get the current Domain Model.
         * Returns a Promise
         */
        getSelectedDomain : function() {
            var projectId = squid_api.model.config.get("project");
            var domainId = squid_api.model.config.get("domain");
            return this.getCustomer().then(function(customer) {
                return customer.get("projects").load(projectId).then(function(project) {
                    return project.get("domains").load(domainId);
                });
            });
        },

        /**
         * Get a collection of the current Domain Model.
         * Returns a Promise
         */
        getSelectedDomainCollection : function(collectionName) {
            return this.getSelectedDomain().then(function(domain) {
                return domain.get(collectionName).load();
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
                    },
                    error: function (model, response, options) {
                        console.error("state save failed");
                    }
                });
            }
        },

        setConfig : function(config, baseConfig, forcedConfig) {
            // keep for comparison when saved again
            squid_api.model.state = config;
            config = squid_api.utils.mergeAttributes(baseConfig, config);
            if (_.isFunction(forcedConfig)) {
                config = forcedConfig(config);
            } else {
                config = squid_api.utils.mergeAttributes(config, forcedConfig);
            }
            squid_api.model.config.set(config);
        },

        setStateId: function (dfd, stateId, baseConfig, forcedConfig) {
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
                    me.setConfig(model.get("config"),baseConfig, forcedConfig);
                },
                error: function (model, response, options) {
                    // state fetch failed
                    dfd.reject();
                }
            });
            return dfd.promise();
        },

        setShortcutId: function (shortcutId, baseConfig, forcedConfig) {
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
                        me.setStateId(dfd, model.get("stateId"), baseConfig, forcedConfig);
                    },
                    error: function (model, response, options) {
                        console.error("shortcut fetch failed : " + shortcutId);
                        dfd.reject();
                    }
                });
            } else {
                me.model.config.set(baseConfig);
            }
            return dfd.promise();
        },

        setBookmarkId: function (bookmarkId, baseConfig, forcedConfig) {
            var me = this;
            var dfd = new $.Deferred();
            var projectId = me.model.config.get("project");
            if (projectId && bookmarkId) {
                // fetch the Bookmark
                var bookmarkModel = new squid_api.model.BookmarkModel();
                bookmarkModel.set({
                    "id": {
                        "customerId": this.customerId,
                        "projectId": projectId,
                        "bookmarkId": bookmarkId
                    }
                });
                bookmarkModel.fetch({
                    success: function (model, response, options) {
                        console.log("bookmark fetched : " + model.get("name"));
                        me.model.status.set("bookmark", model);
                        // current bookmark id goes to the config (whereas shortcut)
                        if (!forcedConfig) {
                            forcedConfig = {};
                        }
                        forcedConfig.bookmark = bookmarkId;
                        // set the config
                        me.setConfig(model.get("config"), baseConfig, forcedConfig);
                    },
                    error: function (model, response, options) {
                        console.error("bookmark fetch failed : " + bookmarkId);
                        dfd.reject();
                    }
                });
            } else {
                me.model.config.set(baseConfig);
            }
            return dfd.promise();
        },

        /**
         * Setup the API default settings.
         * @param a config json object
         */
        setup: function (args) {
            var me = this, api, apiUrl, loginUrl, timeoutMillis;

            args = args || {};
            args.customerId = args.customerId || null;
            args.clientId = args.clientId || null;
            args.projectId = args.projectId || null;
            args.domainId = args.domainId || null;
            args.relationId = args.relationId || null;
            args.selection = args.selection || null;
            this.defaultShortcut = args.defaultShortcut || null;
            this.defaultConfig = args.config || {};
            apiUrl = args.apiUrl || null;

            this.debug = squid_api.utils.getParamValue("debug", null);
            if (!this.debug) {
                this.debug = args.debug;
            }

            this.customerId = squid_api.utils.getParamValue("customerId", null);
            if (!this.customerId) {
                this.customerId = args.customerId;
            }

            this.clientId = squid_api.utils.getParamValue("clientId", null);
            if (!this.clientId) {
                this.clientId = args.clientId;
            }

            var domainId = squid_api.utils.getParamValue("domainId", null);
            if (!domainId) {
                domainId = args.domainId;
            } else {
                this.defaultConfig.domain = domainId;
            }
            this.domainId = domainId;

            var projectId = squid_api.utils.getParamValue("projectId", null);
            if (!projectId) {
                projectId = args.projectId;
            } else {
                this.defaultConfig.project = projectId;
            }
            this.projectId = projectId;

            if (args.browsers) {
                this.browsers = args.browsers;
            }

            this.defaultConfig.selection = {
                    "facets" : []
            };

            // Application Models

            // support for backward compatibility
            squid_api.model.project = new squid_api.model.ProjectModel();

            // config
            this.model.config = new Backbone.Model();

            // listen for project/domain change
            this.model.config.on("change", function (config) {
                var project;
                if (config.hasChanged("project")) {
                    squid_api.getSelectedProject().always( function(project) {
                        if (config.hasChanged("domain") && config.get("domain")) {
                            // load the domain
                            squid_api.getSelectedDomain();
                        } else {
                            // project only changed
                            // reset domain, selection, bookmark
                            config.set({
                                "bookmark" : null,
                                "domain" : null,
                                "selection" : {
                                    "domain" : null,
                                    "facets": []
                                }
                            });
                        }
                    });
                } else if (config.hasChanged("domain")) {
                    // load the domain
                    squid_api.getSelectedDomain();

                    // reset the selection
                    config.set("selection",{
                        "domain" : config.get("domain"),
                        "facets": []
                    });
                }
            });

            // filters
            this.model.filters = new squid_api.controller.facetjob.FiltersModel();

            // init the api server URL
            api = squid_api.utils.getParamValue("api", "release");
            version = squid_api.utils.getParamValue("version", "v4.2");

            apiUrl = squid_api.utils.getParamValue("apiUrl", apiUrl);
            if (!apiUrl) {
                console.error("Please provide an API endpoint URL");
            } else {
                if (apiUrl.indexOf("://") < 0) {
                    apiUrl = "https://" + apiUrl;
                }
                this.setApiURL(apiUrl + "/" + api + "/" + version + "/rs");
                this.swaggerURL = apiUrl + "/" + api + "/" + version + "/swagger.json";

                // init the Login URL
                loginUrl = squid_api.utils.getParamValue("loginUrl", apiUrl);
                loginUrl += "/" + api + "/auth/oauth?response_type=code";
                if (this.clientId) {
                    loginUrl += "&client_id=" + this.clientId;
                }
                if (this.customerId) {
                    loginUrl += "&customerId=" + this.customerId;
                }
                this.loginURL = loginUrl;
                console.log("loginURL : " + this.loginURL);
            }


            // init the timout
            timeoutMillis = args.timeoutMillis;
            if (!timeoutMillis) {
                timeoutMillis = 10 * 1000; // 10 Sec.
            }
            this.setTimeoutMillis(timeoutMillis);

            return this;
        },

        /**
         * Init the API by checking if an AccessToken is present in the url and updating the loginModel accordingly.
         * @param a config json object (if present will call the setup method).
         */
        init: function (args) {
            var browserOK = false;

            if (this.browsers) {
                // check browser compatibility
                for (var browserIdx = 0; browserIdx < this.browsers.length; browserIdx++) {
                    var browser = this.browsers[browserIdx];
                    if (navigator.userAgent.indexOf(browser) > 0) {
                        browserOK = true;
                    }
                }
            } else {
                browserOK = true;
            }
            if (browserOK) {
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
                    this.initStep1(args);
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
        },

        initStep1: function (args) {
            var me = this, loginModel;

            if (args) {
                this.setup(args);
                loginModel = args.loginModel;
            }

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

            if (!loginModel) {
                loginModel = this.model.login;
            }

            // check for login performed
            squid_api.getCustomer().done(function(customer) {
                // perform config init chain
                me.defaultConfig.customer = customer.get("id");
                var state = squid_api.utils.getParamValue("state", null);
                var shortcut = squid_api.utils.getParamValue("shortcut", me.defaultShortcut);
                var bookmark = squid_api.utils.getParamValue("bookmark", null);
                var status = squid_api.model.status;
                if (state) {
                    var dfd = me.setStateId(null, state, me.defaultConfig);
                    dfd.fail(function () {
                        status.set("message", "State not found");
                        if (shortcut) {
                            me.setShortcutId(shortcut, me.defaultConfig);
                        } else if (bookmark) {
                            me.setBookmarkId(bookmark, me.defaultConfig);
                        }
                    });
                } else {
                    if (shortcut) {
                        me.setShortcutId(shortcut, me.defaultConfig);
                    } else if (bookmark) {
                        me.setBookmarkId(bookmark, me.defaultConfig);
                    } else {
                        me.model.config.set(me.defaultConfig);
                    }
                }
            }).fail(function() {
                squid_api.model.login.set("login", null);
            });
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
