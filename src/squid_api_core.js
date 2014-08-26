/*! Squid Core API V2.0 */
(function (root, squid_api, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['jquery', 'backbone'], factory);
    } else {
        // Browser globals
        root[squid_api] = factory(root.$, root.Backbone);
    }
    // just make sure console.log will not crash
    if (!root.console) {
        root.console = {
            log : function() {}
        };
    }
}(this, "squid_api", function ($, Backbone) {
    
    // Squid API definition
    var squid_api = {
        version : "2.0.0",
        apiURL: null,
        loginURL : null,
        timeoutMillis : null,
        customerId: null,
        projectId: null,
        clientId: null,
        fakeServer: null,
        
        // declare some namespaces
        model: {},
        view: {},
        collection: {},
        controller: {},
        
        setApiURL: function(a1) {
            if (a1 && a1[a1.length - 1] == "/") {
                a1 = a1.substring(0, a1.length - 1);
            }
            this.apiURL = a1;
            console.log("apiURL : "+this.apiURL);
            return this;
        },
        
        setTimeoutMillis: function(t) {
            this.timeoutMillis = t;
            return this;
        },
        
        getProject : function(callback) {
            var project = this.model.project;
            if ((!project) || (project.get("oid") != this.projectId)) {
                // lazy deepread the project
                project = new squid_api.model.ProjectModel({"id" : {"customerId" : this.customerId, "projectId" : this.projectId}});
                project.setDeepread(true);
                project.fetch({
                    success : function(model, response, options) {
                        this.model.project = project;
                    }
                });
            }
            return project;
        },

        utils: {

            /*
             * Get a parameter value from the current location url
             */
            getParamValue: function(name, defaultValue) {
                var l = window.location.href;
                var idx = l.indexOf(name+"=");
                var value = "";
                if (idx>0) {
                    var i=idx+name.length+1;
                    while(i<l.length && (l.charAt(i) != "&") && (l.charAt(i) != "#")) {
                        value += l.charAt(i);
                        i++;
                    }
                } else {
                    value = defaultValue;
                }
                return value;
            },

            clearParam : function(name) {
                var l = window.location.href;
                var idx = l.indexOf(name+"=");
                var value = window.location.href;
                if (idx>0) {
                    if (l.charAt(idx-1) == "&") {
                        idx--;
                    }
                    value = l.substring(0, idx);
                    var i=idx+name.length+1;
                    while(i<l.length && (l.charAt(i) != "&") && (l.charAt(i) != "#")) {
                        i++;
                    }
                    value += l.substring(i, l.length);
                }
                return value;
            },

            /**
             * Write a cookie.
             * @param name cookie name
             * @param dom cookie domain
             * @param exp cookie expiration delay in minutes
             * @param v cookie value
             */
            writeCookie: function(name, dom, exp, v) {
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

            readCookie: function(name) {
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

            clearLogin : function() {
                var cookiePrefix = "sq-token";
                squid_api.utils.writeCookie(cookiePrefix + "_" + squid_api.customerId, "", -100000, null);
                squid_api.utils.writeCookie(cookiePrefix, "", -100000, null);
                squid_api.model.login.set({
                    accessToken: null,
                    login: null
                });
            },
            
            find : function(theObject, key, value) {
                var result = null, i;
                if (theObject instanceof Array) {
                    for (i = 0; i < theObject.length; i++) {
                        result = this.find(theObject[i], key,
                                value);
                    }
                } else {
                    for ( var prop in theObject) {
                        if (prop == key) {
                            if (theObject[prop] == value) {
                                return theObject;
                            }
                        }
                        if ((theObject[prop] instanceof Object) || (theObject[prop] instanceof Array)) {
                            result = this.find(theObject[prop], key, value);
                        }
                    }
                }
                return result;
            }
        },
        
        /**
         * Init the API default settings.
         * @param a config json object
         */
        setup : function(args) {
            var api, apiUrl, loginUrl, timeoutMillis;
            
            args = args || {};
            args.customerId = args.customerId || null;
            args.clientId = args.clientId || null;
            args.projectId = args.projectId || null;
            
            this.customerId = squid_api.utils.getParamValue("customerId", null);
            if (!this.customerId) {
                this.customerId = args.customerId;
            }
            
            this.clientId = squid_api.utils.getParamValue("clientId", null);
            if (!this.clientId) {
                this.clientId = args.clientId;
            }
            
            this.projectId = squid_api.utils.getParamValue("projectId",null);
            if (!this.projectId) {
                this.projectId = args.projectId;
            }
            
            // init the api server URL
            api = squid_api.utils.getParamValue("api","release");
            apiUrl = squid_api.utils.getParamValue("apiUrl","https://api.squidsolutions.com");
            apiUrl += "/"+api+"/v4.2/rs";
            this.setApiURL(apiUrl);
            
            // init the Login URL
            loginUrl = squid_api.utils.getParamValue("loginUrl","https://api.squidsolutions.com");
            loginUrl += "/"+api+"/api/oauth?response_type=code";
            if (this.clientId) {
                loginUrl += "&client_id=" + this.clientId;
            }
            if (this.customerId) {
                loginUrl += "&customerId=" + this.customerId;
            }
            this.loginURL = loginUrl;
            console.log("loginURL : "+this.loginURL);

            // init the timout
            timeoutMillis = args.timeoutMillis;
            if (!timeoutMillis) {
                timeoutMillis = 10*1000; // 10 Sec.
            }
            this.setTimeoutMillis(timeoutMillis);
            
            this.model.project = new squid_api.model.ProjectModel({"id" : {"customerId" : this.customerId, "projectId" : this.projectId}});

        },

        /**
         * Init the API by checking if an AccessToken is present in the url and updating the loginModel accordingly.
         * @param a config json object (if present will call the setup method).
         */
        init: function(args) {
            var me = this, loginModel;
            
            if (args) {
                this.setup(args);
                loginModel = args.loginModel;
            }
            
            // handle session expiration
            this.model.status.on('change:error', function(model) {
                var err = model.get("error").status;
                if ((err == 401) || (err == 403)) {
                    me.utils.clearLogin();
                }
            });
            
            if (!loginModel) {
                loginModel = this.model.login;
            }
            
            // check for login performed
            loginModel.on('change:login', function(model) {
                if (model.get("login")) {
                    // login ok
                    if (me.projectId) {
                        // lazy deepread the project
                        me.model.project.setDeepread(true);
                        me.model.project.fetch({
                            success : function(model, response, options) {
                                me.model.project = model;
                                console.log("project fetched : "+model.get("name"));
                            },
                            error : function(model, response, options) {
                                console.error("project fetch failed");
                            }
                        });
                    }
                }
            });
            
            // set the access_token (to start the login model update)      
            var code = squid_api.utils.getParamValue("code", null);
            if (code) {
                loginModel.setAccessCode(code);
            } else {
                var token = squid_api.utils.getParamValue("access_token", null);
                loginModel.setAccessToken(token);
            }
            
            // log
            console.log("squid_api.controller : ");
            for (var i1 in squid_api.controller) {
                console.log(i1);
            }
            console.log("squid_api.view : ");
            for (var i2 in squid_api.view) {
                console.log(i2);
            }
        }
    };

    squid_api.model.BaseModel = Backbone.Model.extend({
        
        deepread : false,
        
        setDeepread : function(v) {
            this.deepread = v;
        },
        
        idAttribute: "oid",
        
        baseRoot: function() {
            return squid_api.apiURL;
        },
        urlRoot: function() {
            return this.baseRoot();
        },
        url: function() {
            var url = this.urlRoot();
            if (typeof this.timeoutMillis === 'undefined' ) {
                url = this.addParam(url, "timeout",squid_api.timeoutMillis);
            } else {
                if (this.timeoutMillis !== null) {
                    url = this.addParam(url, "timeout",this.timeoutMillis());
                }
            }
            url = this.addParam(url, "access_token",squid_api.model.login.get("accessToken"));
            if (this.deepread === true) {
                url = this.addParam(url, "deepread", "1");
            }
            return url;
        },
        error: null,
        addParam : function(url, name, value) {
            if (value) {
                var delim;
                if (url.indexOf("?")<0) {
                    delim = "?";
                } else {
                    delim = "&";
                }
                url += delim + name + "=" + value;
            }
            return url;
        },

        optionsFilter : function(options) {
            // success
            var success;
            if (!options) {
                options = {success : null, error : null}; 
            } else {
                success = options.success;
            }
            options.success =  function(model, response, options) {
                squid_api.model.status.pullTask(model);
                // normal behavior
                if (success) {
                    success.call(this, model, response, options);
                }
            };

            var error;
            error = options.error;
            options.error =  function(model, response, options) {
                squid_api.model.status.set("error", response);
                squid_api.model.status.pullTask(model);
                if (error) {
                    // normal behavior
                    error.call(this.model, response, options);
                }
            };
            return options;
        },

        /*
         * Overriding fetch to handle token expiration
         */
        fetch : function(options) {
            squid_api.model.status.pushTask(this);
            return Backbone.Model.prototype.fetch.call(this, this.optionsFilter(options));
        },

        /*
         * Overriding save to handle token expiration
         */
        save : function(attributes, options) {
            squid_api.model.status.pushTask(this);
            return Backbone.Model.prototype.save.call(this, attributes, this.optionsFilter(options));
        }

    });

    squid_api.model.BaseCollection = Backbone.Collection.extend({
        initialize : function(model, options) {
            this.parentId = options.parentId;
        },
        baseRoot: function() {
            return squid_api.apiURL;
        },
        urlRoot: function() {
            return this.baseRoot();
        },
        url: function() {
            var url = this.urlRoot();
            url = this.addParam(url, "timeout",squid_api.timeoutMillis);
            url = this.addParam(url, "access_token",squid_api.model.login.get("accessToken"));
            return url;
        },
        error: null,
        addParam : function(url, name, value) {
            if (value) {
                var delim;
                if (url.indexOf("?")<0) {
                    delim = "?";
                } else {
                    delim = "&";
                }
                url += delim + name + "=" + value;
            }
            return url;
        }
    });

    squid_api.model.TokenModel = squid_api.model.BaseModel.extend({
        urlRoot: function() {
            return this.baseRoot() + "/tokeninfo";
        }
    });

    squid_api.model.LoginModel = squid_api.model.BaseModel.extend({

        accessToken: null,

        login: null,

        resetPassword: null,

        urlRoot: function() {
            return this.baseRoot() + "/user";
        },

        getDefaultLoginUrl : function() {
            var url = "https://api.squidsolutions.com/release/v4.2/api/oauth?client_id=" + squid_api.clientId;
            if (squid_api.customerId) {
                url += "&customerId=" + squid_api.customerId;
            }
            return url;
        },
        
        /**
         * Login the user using an access_token
         */
        setAccessCode: function(code, cookieExpiration) {
            var me = this;

            // set the access token and refresh data
            var request = $.ajax({
                type: "POST",
                url: squid_api.apiURL + "/token",
                dataType: 'json',
                data: {"grant_type" : "authorization_code", "code": code, "client_id" : squid_api.clientId, "redirect_uri" : null}
            });
            
            request.fail(function(jqXHR) {
                me.setAccessToken(null, cookieExpiration);
            });
            
            request.done(function(data) {
                var token = data.oid;
                me.setAccessToken(token, cookieExpiration);
            });
            
        },

        /**
         * Login the user using an access_token
         */
        setAccessToken: function(token, cookieExpiration) {
            var cookiePrefix = "sq-token",cookie, me = this;
            
            if (!cookieExpiration) {
                cookieExpiration = 120; // 2 hours
            }
            
            if (squid_api.customerId) {
                cookie = cookiePrefix + "_" + squid_api.customerId;
            }
            else {
                cookie = cookiePrefix;
            }
            if (!token) {
                // search in a cookie
                token = squid_api.utils.readCookie(cookie);
            }

            if (!token) {
                squid_api.model.login.set("login", null);
            } else {
                this.set("accessToken", token);

                // fetch the token info from server
                var tokenModel = new squid_api.model.TokenModel({
                    "token": token
                });
    
                tokenModel.fetch({
                    error: function(model, response, options) {
                        squid_api.model.login.set("login", null);
                    },
                    success: function(model, response, options) {
                        // set the customerId
                        squid_api.customerId = model.get("customerId");
                        // verify the clientId
                        if (model.get("clientId") != this.clientId) {
                            model.set("login", null);
                        }
    
                        // update login model from server
                        me.fetch({
                            success: function(model) {
                                if ((token) && (typeof token != "undefined")) {
                                    // write in a customer cookie
                                    squid_api.utils.writeCookie(cookiePrefix + "_" + squid_api.customerId, "", cookieExpiration, token);
                                    // write in a global cookie
                                    squid_api.utils.writeCookie(cookiePrefix, "", cookieExpiration, token);
                                }
                            }
                        });
                    }
                });
            }


        },

        /**
         * Logout the current user
         */
        logout: function() {
            var me = this;
            // set the access token and refresh data
            var request = $.ajax({
                type: "GET",
                url: squid_api.apiURL + "/logout?access_token=" + this.get("accessToken"),
                dataType: 'json',
                contentType: 'application/json'
            });

            request.done(function(jsonData) {
                squid_api.utils.clearLogin();
            });

            request.fail(function(jqXHR, textStatus, errorThrown) {
                squid_api.model.status.set("message", "logout failed");
                squid_api.model.status.set("error", errorThrown);
            });
        }

    });

    squid_api.model.login = new squid_api.model.LoginModel();

    // user model
    squid_api.model.UserModel = squid_api.model.BaseModel.extend({

        accessToken: null,

        login: null,

        email: null,

        groups: null,

        objectType: "User",

        password: null,

        wsName: null,

        error: "",

        url: function() {
            return this.baseRoot() + this.wsName + "?access_token=" + this.accessToken; // get user
        }

    });
    squid_api.model.userModel = new squid_api.model.UserModel();


    // Status Model
    squid_api.model.StatusModel = squid_api.model.BaseModel.extend({
        STATUS_RUNNING : "RUNNING",
        STATUS_DONE : "DONE",
        runningTasks : [],
        pushTask : function(task) {
            this.runningTasks.push(task);
            console.log("running tasks count : "+this.runningTasks.length);
            Backbone.Model.prototype.set.call(this,"status",this.STATUS_RUNNING);
        },
        pullTask : function(task) {
            var i = this.runningTasks.indexOf(task);
            if (i != -1) {
                this.runningTasks.splice(i, 1);
            }
            console.log("running tasks count : "+this.runningTasks.length);
            if (this.runningTasks.length === 0) {
                Backbone.Model.prototype.set.call(this,"status",this.STATUS_DONE);
            }
        }
    });
    squid_api.model.status = new squid_api.model.StatusModel({
        status : null,
        error : null,
        message : null
    });

    /*
     * --- Meta Model ---
     */

    squid_api.model.ProjectModel = squid_api.model.BaseModel.extend({
        urlRoot: function() {
            return this.baseRoot() + "/projects/" + this.get("id").projectId;
        }
    });
    
    squid_api.model.ProjectCollection = squid_api.model.BaseCollection.extend({
        model : squid_api.model.ProjectModel,
        urlRoot: function() {
            return this.baseRoot() + "/projects";
        }
    });

    squid_api.model.DomainModel = squid_api.model.ProjectModel.extend({
        urlRoot: function() {
            return squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments) + "/domains/" + this.get("id").domainId;
        }
    });
    
    squid_api.model.DomainCollection = squid_api.model.BaseCollection.extend({
        model : squid_api.model.DomainModel,
        urlRoot: function() {
            return squid_api.model.ProjectCollection.prototype.urlRoot.apply(this, arguments) +"/"+ this.parentId.projectId + "/domains";
        }
    });
    
    squid_api.model.DimensionModel = squid_api.model.DomainModel.extend({
        urlRoot: function() {
            return squid_api.model.DomainModel.prototype.urlRoot.apply(this, arguments) + "/dimensions/" + this.get("id").dimensionId;
        }
    });
    
    squid_api.model.DimensionCollection = squid_api.model.BaseCollection.extend({
        model : squid_api.model.DimensionModel,
        urlRoot: function() {
            return squid_api.model.DomainCollection.prototype.urlRoot.apply(this, arguments) + "/" + this.parentId.domainId + "/dimensions";
        }
    });

    squid_api.model.MetricModel = squid_api.model.DomainModel.extend({
        urlRoot: function() {
            return squid_api.model.DomainModel.prototype.urlRoot.apply(this, arguments) + "/metrics/" + this.get("id").metricId;
        }
    });

    squid_api.model.MetricCollection = squid_api.model.BaseCollection.extend({
        model : squid_api.model.MetricModel,
        urlRoot: function() {
            return squid_api.model.DomainCollection.prototype.urlRoot.apply(this, arguments) + "/" + this.parentId.domainId + "/metrics";
        }
    });

    return squid_api;
}));