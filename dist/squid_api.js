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
        domainId: null,
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
            this.domainId = args.domainId || null;
            args.selection = args.selection || null;
            apiUrl = args.apiUrl || null;
            
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
            
            this.model.project = new squid_api.model.ProjectModel({"id" : {"customerId" : this.customerId, "projectId" : this.projectId}});
            
            var defaultSelection = null;
            if (args.selection) {
                if (args.selection.date) {
                    // setup default filters
                    defaultSelection = {
                            "facets" : [ {
                                "dimension" : {
                                    "id" : {
                                        "projectId" : this.projectId,
                                        "domainId" : this.domainId,
                                        "dimensionId" : args.selection.date.dimensionId
                                    }
                                },
                                "selectedItems" : [ {
                                    "type" : "i",
                                    "lowerBound" : (args.selection.date.lowerBound + "T00:00:00.000Z"),
                                    "upperBound" : (args.selection.date.upperBound + "T00:00:00.000Z")
                                } ]
                            } ]
                    };
                }
            }
            
            var filters = new squid_api.controller.facetjob.FiltersModel();
            filters.setDomainIds([this.domainId]);
            filters.set("selection" , defaultSelection);
            squid_api.model.filters = filters;
            
            if ((typeof args.filtersDefaultEvents == 'undefined') || (args.filtersDefaultEvents === true)) {
                // check for new filter selection
                filters.on('change:userSelection', function() {
                    squid_api.controller.facetjob.compute(filters, filters.get("userSelection"));
                });
                
                // check for project init performed
                squid_api.model.project.on('change', function() {
                    // launch the filters computation
                    squid_api.controller.facetjob.compute(filters);
                });
            }
            
            // init the api server URL
            api = squid_api.utils.getParamValue("api","release");
            version = squid_api.utils.getParamValue("version","v4.2");
            
            if (!apiUrl) {
                apiUrl = squid_api.utils.getParamValue("apiUrl","https://api.squidsolutions.com");
            }
            if (apiUrl.indexOf("://") < 0) {
                apiUrl = "https://"+apiUrl;
            }
            this.setApiURL(apiUrl + "/"+api+"/"+version+"/rs");
            
            // init the Login URL
            loginUrl = squid_api.utils.getParamValue("loginUrl",apiUrl);
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
                squid_api.model.status.set("error", "error");
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
/*! Squid Core API AnalysisJob Controller V2.0 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['Backbone', 'squid_api'], factory);
    } else {
        factory(root.Backbone, root.squid_api);
    }
}(this, function (Backbone, squid_api) {

    var controller = {

        fakeServer: null,

        /**
         * Create (and execute) a new AnalysisJob.
         * @returns a Jquery Deferred
         */
        createAnalysisJob: function(analysisModel, filters) {

            var observer = $.Deferred();

            analysisModel.set("status","RUNNING");

            var selection;
            if (!filters) {
                selection =  analysisModel.get("selection");
            } else {
                selection =  filters.get("selection");
            }

            // create a new AnalysisJob
            var analysisJob = new controller.ProjectAnalysisJob();
            var projectId;
            if (analysisModel.get("id").projectId) {
                projectId = analysisModel.get("id").projectId;
            } else {
                projectId = analysisModel.get("projectId");
            }
            analysisJob.set({"id" : {
                    projectId: projectId,
                    analysisJobId: null},
                    "domains" : analysisModel.get("domains"),
                    "dimensions": analysisModel.get("dimensions"),
                    "metrics": analysisModel.get("metrics"),
                    "autoRun": analysisModel.get("autoRun"),
                    "selection": selection});

            // save the analysisJob to API
            if (this.fakeServer) {
                this.fakeServer.respond();
            }

            analysisJob.save({}, {
                success : function(model, response) {
                    if (model.get("error")) {
                        console.error("createAnalysis error " + model.get("error").message);
                        analysisModel.set("results", null);
                        analysisModel.set("error", model.get("error"));
                        analysisModel.set("status", "DONE");
                        observer.reject(model, response);
                    } else {
                        console.log("createAnalysis success");
                        analysisModel.set("id", model.get("id"));
                        analysisModel.set("oid", model.get("id").analysisJobId);
                        observer.resolve(model, response);
                    }
                },
                error : function(model, response) {
                    console.error("createAnalysis error");
                    analysisModel.set("results", null);
                    analysisModel.set("error", response);
                    analysisModel.set("status", "DONE");
                    observer.reject(model, response);
                }
            });

            return observer;
        },

        /**
         * Create (and execute) a new AnalysisJob, then retrieve the results.
         */
        compute: function(analysisModel, filters) {
            filters = filters || squid_api.model.filters;
            var observer = $.Deferred();

            /* Run on startup and on dimension change, however this handles
               an analysis array inside of the analysis model */
               
            if (analysisModel.get("analyses")) {
                this.computeMultiAnalysis(analysisModel, filters);
            } else {
                this.createAnalysisJob(analysisModel, filters)
                    .done(function(model, response) {
                        if (model.get("status") == "DONE") {
                            analysisModel.set("error", model.get("error"));
                            analysisModel.set("results", model.get("results"));
                            analysisModel.set("status", "DONE");
                            observer.resolve(model, response);
                        } else {
                            // try to get the results
                            controller.getAnalysisJobResults(observer, analysisModel);
                        }
                    })
                    .fail(function(model, response) {
                        observer.reject(model, response);
                    });
            }

            return observer;
        },

        // backward compatibility
        computeAnalysis: function(analysisModel, filters) {
            return this.compute(analysisModel, filters);
        },

        /**
         * retrieve the results.
         */
        getAnalysisJobResults: function(observer, analysisModel) {
            console.log("getAnalysisJobResults");
            var analysisJobResults = new controller.ProjectAnalysisJobResult();
            analysisJobResults.set("id", analysisModel.get("id"));
            analysisJobResults.set("oid", analysisModel.get("oid"));

            // get the results from API
            analysisJobResults.fetch({
                error: function(model, response) {
                    analysisModel.set("error", {message : response.statusText});
                    analysisModel.set("status", "DONE");
                    observer.reject(model, response);
                },
                success: function(model, response) {
                    if (model.get("apiError") && (model.get("apiError") == "COMPUTING_IN_PROGRESS")) {
                        // retry
                        controller.getAnalysisJobResults(observer, analysisModel);
                    } else {
                        // update the analysis Model
                        analysisModel.set("error", null);
                        analysisModel.set("results", model.toJSON());
                        analysisModel.set("status", "DONE");
                        observer.resolve(model, response);
                    }
                }
            });
            if (this.fakeServer) {
                this.fakeServer.respond();
            }
        },

        /**
         * Create (and execute) a new MultiAnalysisJob, retrieve the results
         * and set the 'done' or 'error' attribute to true when all analysis are done or any failed.
         */
        computeMultiAnalysis: function(multiAnalysisModel, selection) {
            var me = this;
            multiAnalysisModel.set("status", "RUNNING");
            var analyses = multiAnalysisModel.get("analyses");
            var analysesCount = analyses.length;
            // build all jobs
            var jobs = [];
            for (var i=0; i<analysesCount; i++) {
                var analysisModel = analyses[i];
                jobs.push(this.computeAnalysis(analysisModel, selection));
            }
            console.log("analysesCount : "+analysesCount);
            // wait for jobs completion
            var combinedPromise = $.when.apply($,jobs);
            
            combinedPromise.fail( function() {
                squid_api.model.status.set("message", "Computation failed");
                squid_api.model.status.set("error", "Computation failed");
            });
            
            combinedPromise.always( function() {
                for (var i=0; i<analysesCount; i++) {
                    var analysis = analyses[i];
                    if (analysis.get("error")) {
                        multiAnalysisModel.set("error", analysis.get("error"));
                    }
                }
                multiAnalysisModel.set("status", "DONE");
            });
        },

        AnalysisModel: Backbone.Model.extend({
            results: null,

            initialize: function() {
                this.set("id", {
                    "projectId": squid_api.projectId,
                    "analysisJobId": null
                });
                if (squid_api.domainId) {
                    this.setDomainIds([squid_api.domainId]);
                }
            },

            setProjectId : function(projectId) {
                this.set("id", {
                        "projectId": projectId,
                        "analysisJobId": null
                });
                return this;
            },

            setDomainIds : function(domainIdList) {
                var domains = [];
                for (var i=0; i<domainIdList.length; i++) {
                    domains.push({
                        "projectId": this.get("id").projectId,
                        "domainId": domainIdList[i]
                    });
                }
                this.set("domains", domains);
                return this;
            },

            setDimensionIds : function(dimensionIdList) {
                var dims = [];
                for (var i=0; i<dimensionIdList.length; i++) {
                    dims.push({
                        "projectId": this.get("id").projectId,
                        "domainId": this.get("domains")[0].domainId,
                        "dimensionId": dimensionIdList[i]
                    });
                }
                this.set("dimensions", dims);
                this.trigger("change:dimensions", dims);
                return this;
            },

            setDimensionId : function(dimensionId, index) {
                var dims = this.get("dimensions");
                index = index || 0;
                dims[index] = {
                    "projectId": this.get("id").projectId,
                    "domainId": this.get("domains")[0].domainId,
                    "dimensionId": dimensionId
                };
                this.set("dimensions", dims);
                this.trigger("change:dimensions", dims);
                return this;
            },

            setMetricIds : function(metricIdList) {
                var metrics = [];
                for (var i=0; i<metricIdList.length; i++) {
                    metrics.push({
                        "projectId": this.get("id").projectId,
                        "domainId": this.get("domains")[0].domainId,
                        "metricId": metricIdList[i]
                    });
                }
                this.set("metrics", metrics);
                return this;
            },

            isDone : function() {
                return (this.get("status") == "DONE");
            }
        }),

        MultiAnalysisModel: Backbone.Model.extend({
            isDone : function() {
                return (this.get("status") == "DONE");
            }
        })

    };

    // ProjectAnalysisJob Model
    controller.ProjectAnalysisJob = squid_api.model.ProjectModel.extend({
            urlRoot: function() {
                return squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments) + "/analysisjobs/" + (this.get("id").analysisJobId ? this.get("id").analysisJobId : "");
            },
            error: null,
            domains: null,
            dimensions: null,
            metrics: null,
            selection: null
        });

    // ProjectAnalysisJobResult Model
    controller.ProjectAnalysisJobResult = controller.ProjectAnalysisJob.extend({
            urlRoot: function() {
                return controller.ProjectAnalysisJob.prototype.urlRoot.apply(this, arguments) + "/results" + "?" + "compression="+this.compression+ "&"+"format="+this.format;
            },
            error: null,
            format: "json",
            compression: "none"
        });

    squid_api.controller.analysisjob = controller;
    return controller;
}));

/*! Squid Core API FacetJob Controller V2.0 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['Backbone', 'squid_api'], factory);
    } else {
        factory(root.Backbone, root.squid_api);
    }
}(this, function (Backbone, squid_api) {
    
    var controller = {
            
            fakeServer: null,

            /**
             * Create (and execute) a new Job.
             */
            createJob: function(jobModel, selection, successCallback) {

                jobModel.set({"userSelection" :  null}, {"silent" : true});
                jobModel.set("status","RUNNING");

                // create a new Job
                if (!selection) {
                    selection =  jobModel.get("selection");
                }

                var job = new controller.ProjectFacetJob();
                var projectId;
                if (jobModel.get("id").projectId) {
                    projectId = jobModel.get("id").projectId;
                } else {
                    projectId = jobModel.get("projectId");
                }

                job.set({"id" : {
                    projectId: projectId},
                    "domains" : jobModel.get("domains"),
                    "selection": selection});

                // save the job
                if (this.fakeServer) {
                    this.fakeServer.respond();
                }

                job.save({}, {
                    success : function(model, response) {
                        console.log("create job success");
                        if (successCallback) {
                            successCallback(model, jobModel);
                        }
                    },
                    error: function(model, response) {
                        console.log("create job error");
                        jobModel.set("error", response);
                        jobModel.set("status", "DONE");
                    }

                });

            },

            jobCreationCallback : function(model, jobModel) {
                jobModel.set("id", model.get("id"));
                jobModel.set("oid", model.get("oid"));
                if (model.get("status") == "DONE") {
                    jobModel.set("error", model.get("error"));
                    if (model.get("results")) {
                        jobModel.set("selection", {"facets" : model.get("results").facets});
                    }
                    jobModel.set("status", "DONE");
                } else {
                    // try to get the results
                    controller.getJobResults(jobModel, filters);
                }
            },

            /**
             * Create (and execute) a new Job, then retrieve the results.
             */
            compute: function(jobModel, selection) {
                this.createJob(jobModel, selection, this.jobCreationCallback);
            },

            /**
             * retrieve the results.
             */
            getJobResults: function(jobModel) {
                console.log("get JobResults");
                var jobResults = new controller.ProjectFacetJobResult();
                jobResults.set("id", jobModel.get("id"));
                jobResults.set("oid", jobModel.get("oid"));

                // get the results from API
                jobResults.fetch({
                    error: function(model, response) {
                        jobModel.set("error", {message : response.statusText});
                        jobModel.set("status", "DONE");
                    },
                    success: function(model, response) {
                        if (model.get("apiError") && (model.get("apiError") == "COMPUTING_IN_PROGRESS")) {
                            // retry
                            controller.getJobResults(jobModel);
                        } else {
                            // update the Model
                            jobModel.set("error", null);
                            jobModel.set("selection", {"facets" : model.get("facets")});
                            jobModel.set("status", "DONE");
                        }
                    }
                });
                if (this.fakeServer) {
                    this.fakeServer.respond();
                }
            },

            FiltersModel: Backbone.Model.extend({
                
                initialize: function() {
                    this.set("id", {
                        "projectId": squid_api.projectId
                    });
                },
                
                setProjectId : function(projectId) {
                    this.set("id", {
                        "projectId": projectId
                    });
                    return this;
                },

                setDomainIds : function(domainIdList) {
                    var domains = [];
                    for (var i=0; i<domainIdList.length; i++) {
                        domains.push({
                            "projectId": this.get("id").projectId,
                            "domainId": domainIdList[i]
                        });
                    }
                    this.set("domains", domains);
                    return this;
                },

                addSelection : function(dimension,value) {
                    var facets = this.get("selection").facets;
                    // check if the facet already exists
                    var facetToUpdate;
                    for (var i=0;i<facets.length;i++) {
                        var facet = facets[i];
                        if (facet.dimension.oid==dimension.id.dimensionId) {
                            facetToUpdate = facet;
                        }
                    }
                    if (!facetToUpdate) {
                        facetToUpdate = {
                                "dimension" : {
                                    "id" : {
                                        "projectId" : this.get("id").projectId,
                                        "domainId" : dimension.id.domainId,
                                        "dimensionId" : dimension.id.dimensionId
                                    }
                                },
                                "selectedItems" : []
                        };
                        facets.push(facetToUpdate);
                    }
                    // update the facet
                    facetToUpdate.selectedItems.push({
                        "type" : "v",
                        "id" : -1,
                        "value" : value
                    });
                },

                isDone : function() {
                    return (this.get("status") == "DONE");
                },
                
                getSelection : function() {
                    // extract the selectedItem from the filters in a more usable form
                    var data = {}, item;
                    var selection = this.get("selection");
                    if (selection && selection.facets) {
                        var index = 0;
                        var facets = selection.facets;
                        for (var i=facets.length-1;i>=0;i--) {
                            var facet = facets[i];
                            if ((!facet.dimension.type || facet.dimension.type=="CATEGORICAL" || facet.dimension.type=="INDEX") && facet.selectedItems && facet.selectedItems.length>0) {
                                var temp = [];
                                if (facet.items) {
                                    for (var i2=0;i2<facet.items.length;i2++) {
                                        item = facet.items[i2];
                                        if (item.type=="v") {
                                            temp[item.id] = item.value;
                                        }
                                    }
                                }
                                var unique = [];
                                for (var j=0;j<facet.selectedItems.length;j++) {
                                    item = facet.selectedItems[j];
                                    if (item.type=="v") {
                                        var sel = null;
                                        var oid = facet.dimension.id.dimensionId;
                                        var group = data[oid];
                                        if (!group) {
                                            sel = [];
                                            data[oid] = 
                                            {"dimension":facet.dimension,
                                                    "selection":sel};
                                        } else {
                                            sel = group.selection;
                                        }
                                        var value = (item.id>=0 && item.id<temp.length)?temp[item.id]:item.value;
                                        if (!unique[value]) {
                                            unique[value] = true;
                                            sel.push({"name":facet.dimension.name?facet.dimension.name:facet.dimension.id.dimensionId,
                                                    "value":value,
                                                    "item":item,
                                                    "index":index++});
                                        }
                                    }
                                }
                            }
                        }
                    }
                    return data;
                }
            })
    };

    controller.ProjectFacetJob = squid_api.model.ProjectModel.extend({
        urlRoot: function() {
            return squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments) + "/facetjobs/" + (this.id ? this.id : "");
        },
        error: null,
        domains: null,
        timeoutMillis: function() { 
            return squid_api.timeoutMillis; 
        }
    });

    controller.ProjectFacetJobResult = controller.ProjectFacetJob.extend({
        urlRoot: function() {
            return controller.ProjectFacetJob.prototype.urlRoot.apply(this, arguments) + "/results";
        },
        error: null,
        timeoutMillis: function() { 
            return squid_api.timeoutMillis; 
        }
    });

    squid_api.controller.facetjob = controller;
    return controller;
}));