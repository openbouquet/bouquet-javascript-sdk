/*! Squid Core API V2.0 */
(function (root, squid_api, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define([], factory);
    } else {
        // Browser globals
        root[squid_api] = factory();
    }
    // just make sure console.log will not crash
    if (!root.console) {
        root.console = {
            log: function () {
            }
        };
    }
}(this, "squid_api", function () {

    // Squid API definition
    var squid_api = {
        debug: null,
        version: "3.0.0",
        DATE_FORMAT: "YYYY-MM-DDTHH:mm:ss.SSSZZ",
        apiHost: null,
        apiEnv: null,
        apiBaseURL : null,
        apiURL: null,
        loginURL: null,
        timeoutMillis: null,
        customerId: null,
        projectId: null,
        domainId: null,
        clientId: null,
        fakeServer: null,
        defaultShortcut: null,
        defaultConfig: null,
        swaggerURL: null,
        apiSchema: null,
        apiVersion: null,
        uri : null,
        browserOK : null,
        wsNotification : null,
        wsConnectionAttempts: 1,
        bouquetSessionId : null,
        options : {
            enableTracking : true
        },
        constants : {
            HEADER_BOUQUET_SESSIONID : "X-Bouquet-Session-Id"
        },
        obioURL : null,
        teamId : null,
        authCode : null,

        // declare some namespaces
        model: {},
        view: {},
        collection: {},
        controller: {},

        setApiURL: function (a1) {
            if (a1 && a1[a1.length - 1] == "/") {
                a1 = a1.substring(0, a1.length - 1);
            }
            this.apiURL = a1;
            console.log("apiURL : " + this.apiURL);
            return this;
        },

        setTimeoutMillis: function (t) {
            this.timeoutMillis = t;
            return this;
        },

        utils: {

            /**
             * Union of attributes of 2 objects.
             */
            mergeAttributes: function (obj1, obj2) {
                var obj = {};
                if (obj1) {
                    for (var att1 in obj1) {
                        obj[att1] = obj1[att1];
                    }
                }
                if (obj2) {
                    for (var att2 in obj2) {
                        obj[att2] = obj2[att2];
                    }
                }
                return obj;
            },

            /**
             * Deep find an object having a given property value and objectType in a JSON object.
             */
            find: function (theObject, key, value, objectType) {
                var result = null, i;
                if (theObject instanceof Array) {
                    for (i = 0; i < theObject.length; i++) {
                        result = this.find(theObject[i], key,
                            value, objectType);
                        if (result) {
                            break;
                        }
                    }
                } else {
                    for (var prop in theObject) {
                        if (prop == key) {
                            if (theObject[prop] == value) {
                                if (!objectType || (objectType == theObject.objectType)) {
                                    return theObject;
                                }
                            }
                        }
                        if ((theObject[prop] instanceof Object) || (theObject[prop] instanceof Array)) {
                            result = this.find(theObject[prop], key, value, objectType);
                            if (result) {
                                break;
                            }
                        }
                    }
                }
                return result;
            },

            /**
             * Streamline a selection (get rid of the facet items).
             */
            buildCleanSelection: function (selectionOpt) {
                var selection = {
                    "facets": []
                };
                if (selectionOpt) {
                    var facets = selectionOpt.facets;
                    if (facets) {
                        for (var is = 0; is < facets.length; is++) {
                            var facet = facets[is];
                            if (facet.selectedItems && (facet.selectedItems.length > 0)) {
                                var newFacet = {
                                    "selectedItems": facet.selectedItems,
                                    "dimension": facet.dimension,
                                    "id": facet.id
                                };
                                selection.facets.push(newFacet);
                            }
                        }
                    }
                    // compare
                    selection.compareTo = selectionOpt.compareTo;
                }
                return selection;
            },
            
            /**
             * http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
             */
            hashCode : function(s) {
                var hash = 0;
                if (s.length === 0) return hash;
                for (i = 0; i < s.length; i++) {
                    char = s.charCodeAt(i);
                    hash = ((hash<<5)-hash)+char;
                    hash = hash & hash; // Convert to 32bit integer
                }
                return hash;
            },
            
            idToPath : function(id) {
                var path = "";
                for(var oid in id) {
                    path += "/"+oid.substring(0,oid.length-2)+"s/"+id[oid];
                }
                return path;
            }
        }
    };
    return squid_api;
}));

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['Backbone', '_', 'squid_api'], factory);
    } else {
        factory(root.Backbone, _, root.squid_api);
    }
}(this, function (Backbone, _, squid_api) {
    
    // override Backbone ajax to handle bouquet session id header
    Backbone.ajax = function() {
        arguments[0].headers = {};
        arguments[0].headers[squid_api.constants.HEADER_BOUQUET_SESSIONID] = squid_api.bouquetSessionId;
        return Backbone.$.ajax.apply(Backbone.$, arguments);      
    };

    // setup squid_api.model

    squid_api.model.BaseModel = Backbone.Model.extend({

        addParameter: function (name, value) {
            if ((typeof value !== 'undefined') && (value !== null)) {
                if (!this.parameters) {
                    this.parameters = [];
                }
                this.parameters.push({"name": name, "value": value});
            }
        },

        removeParameter: function (name) {
            if (this.parameters) {
                this.parameters = this.parameters.filter(function( obj ) {
                    return obj.name !== name;
                });
            }
        },

        getParameter: function (name) {
            var i = 0, param;
            if (this.parameters) {
                while (i < this.parameters.length) {
                    param = this.parameters[i];
                    if (param.name == name) {
                        return param.value;
                    }
                    i++;
                }
            }
            return null;
        },

        setParameter: function (name, value) {
            var index = null;
            if (!this.parameters) {
                this.parameters = [];
            }
            for (var i = 0; i < this.parameters.length; i++) {
                if (this.parameters[i].name === name) {
                    index = i;
                    break;
                }
            }
            if (index !== null) {
                if ((typeof value === 'undefined') || (value === null)) {
                    // unset
                    this.parameters.splice(index, 1);
                } else {
                    // set
                    this.parameters[index].value = value;
                }
            } else {
                this.parameters.push({"name": name, "value": value});
            }
        },

        initialize: function (attributes, options) {
            if (options) {
                this.parameters = options.parameters;
                this.statusModel = options.statusModel;
            }
        },

        constructor: function () {
            // Define some attributes off of the prototype chain
            this.parameters = [];
            this.statusModel = null;

            // Call the original constructor
            Backbone.Model.apply(this, arguments);
        },

        idAttribute: "oid",

        getOid : function(idName) {
            var oid;
            if (this.get("id")) {
                oid = this.get("id")[idName];
                if (!oid) {
                    oid = this.get("oid");
                }
            } else {
                oid = this.get("oid");
            }
            if (!oid) {
                oid = "";
            }
            return oid;
        },

        baseRoot: function () {
            return squid_api.apiURL;
        },
        urlRoot: function () {
            return this.baseRoot();
        },
        url: function () {
            if (typeof this.timeoutMillis === 'undefined') {
                this.setParameter("timeout", squid_api.timeoutMillis);
            } else if (this.timeoutMillis !== null) {
                this.setParameter("timeout", this.timeoutMillis());
            }
            this.setParameter("access_token", squid_api.model.login.get("accessToken"));
            
            // build uri
            var url = squid_api.utils.buildApiUrl(this.urlRoot(), null, this.parameters);
            return url.toString();
        },
        
        error: null,

        optionsFilter: function (options) {
            // success
            var success, me = this;
            if (!options) {
                options = {success: null, error: null};
            } else {
                success = options.success;
            }
            options.success = function (model, response, options) {
                if (me.statusModel) {
                    me.statusModel.pullTask(model);
                }
                // normal behavior
                if (success) {
                    success.call(this, model, response, options);
                }
            };

            var error;
            error = options.error;
            options.error = function (model, response, options) {
                if (me.statusModel) {
                    me.statusModel.set("error", response);
                    me.statusModel.pullTask(model);
                }
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
        fetch: function (options) {
            if (this.statusModel) {
                this.statusModel.pushTask(this);
            }
            return Backbone.Model.prototype.fetch.call(this, this.optionsFilter(options));
        },

        /*
         * Overriding save to handle token expiration
         */
        save: function (attributes, options) {
            if (this.statusModel) {
                this.statusModel.pushTask(this);
            }
            return Backbone.Model.prototype.save.call(this, attributes, this.optionsFilter(options));
        }

    });

    squid_api.model.BaseCollection = Backbone.Collection.extend({
        parentId: null,
        fetched : false,
        error: null,
        parameters: [],
        deferredMap : {},

        addParameter: function (name, value) {
            this.parameters.push({"name": name, "value": value});
        },
        
        setParameter: function (name, value) {
            var index = null;
            if (!this.parameters) {
                this.parameters = [];
            }
            for (var i = 0; i < this.parameters.length; i++) {
                if (this.parameters[i].name === name) {
                    index = i;
                    break;
                }
            }
            if (index !== null) {
                if ((typeof value === 'undefined') || (value === null)) {
                    // unset
                    this.parameters.splice(index, 1);
                } else {
                    // set
                    this.parameters[index].value = value;
                }
            } else {
                this.parameters.push({"name": name, "value": value});
            }
        },

        initialize: function (model, options) {
            if (options) {
                this.parentId = options.parentId;
                this.parameters = options.parameters;
            }
        },
        baseRoot: function () {
            return squid_api.apiURL;
        },
        urlRoot: function () {
            return this.baseRoot();
        },

        url: function () {
            if (typeof this.timeoutMillis === 'undefined') {
                this.setParameter("timeout", squid_api.timeoutMillis);
            } else if (this.timeoutMillis !== null) {
                this.setParameter("timeout", this.timeoutMillis());
            }
            this.setParameter("access_token", squid_api.model.login.get("accessToken"));
            
            // build uri
            var url = squid_api.utils.buildApiUrl(this.urlRoot(), null, this.parameters);
            return url;
        },
        
        addParam: function (url, name, value) {
            if (value) {
                var delim;
                if (url.indexOf("?") < 0) {
                    delim = "?";
                } else {
                    delim = "&";
                }
                url += delim + name + "=" + value;
            }
            return url.toString();
        },

        /**
         * Getter for a Model or a Collection of Models.
         * This method will perform a fetch only if the requested object is not in the object cache.
         * @param oid if set, will return a Model with the corresponding oid.
         * @param forceRefresh if set and true : object in cache will be fetched and non child attributes 
         * will be updated.
         * @return a Promise
         */
        load : function(oid, forceRefresh) {
            // the deferred key must be unique for the object we're fetching
            var deferredKey = oid || "_all";
            var deferredKeyPrefix = this.urlRoot();
            deferredKey = deferredKeyPrefix+"_"+deferredKey;
            var deferred = this.deferredMap[deferredKey];
            // check if not already executing
            if (deferred && (deferred.state() === "pending")) {
                // return existing pending deferred
            } else {
                // create a new deferred
                deferred = $.Deferred();
                this.deferredMap[deferredKey] = deferred;
                var me = this;
                if (oid) {
                    // check if already existing
                    var model = this.findWhere({"oid" : oid});
                    if (model) {
                        if (forceRefresh !== true) {
                            // return existing
                            deferred.resolve(model);
                        } else {
                            // update the model's attributes (non child)
                            var clone = model.clone();
                            clone.fetch().done(function() {
                                var excluded = clone.get("_children");
                                var attributes = clone.attributes;
                                for (var att in attributes) {
                                    if (!excluded || (excluded.indexOf(att)<0)) {
                                        model.set(att, clone.get(att));
                                    }
                                }
                                deferred.resolve(model);
                            }).fail(function() {
                                deferred.resolve(model);
                            });
                        }
                    } else {
                        // fetch collection to get the model
                        this.load().done( function(collection) {
                            model = collection.findWhere({"oid" : oid});
                            if (model) {
                                deferred.resolve(model);
                            } else {
                                // try to fetch first (T1625)
                                var parentId = collection.parent.get("id");
                                model = new collection.model({"id" : parentId});
                                model.set({"oid" : oid});
                                model.fetch().done(function() {
                                    collection.add(model);
                                    deferred.resolve(model);
                                }).fail(function() {
                                    deferred.reject("object not found");
                                });
                            }
                        }).fail(function(error) {
                            squid_api.model.status.set("error", error);
                            deferred.reject(error);
                        });
                    }
                } else {
                    if (this.fetched) {
                        deferred.resolve(this);
                    } else {
                        // fetch collection
                        console.log("fetching "+deferredKey);
                        this.fetch().done( function() {
                            me.fetched = true;
                            deferred.resolve(me);
                        }).fail(function(error) {
                            squid_api.model.status.set("error", error);
                            deferred.reject(error);
                        });
                    }
                }
            }
            return deferred.promise();
        }
    });

    squid_api.model.TokenModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return this.baseRoot() + "/tokeninfo";
        }
    });

    squid_api.model.LoginModel = squid_api.model.BaseModel.extend({

        accessToken: null,

        login: null,

        resetPassword: null,

        urlRoot: function () {
            return this.baseRoot() + "/user";
        },

        /**
         * Logout the current user
         */
        logout: function () {
            var me = this;
            // set the access token and refresh data
            if (this.get("accessToken")) {
                var request = Backbone.ajax({
                    type: "GET",
                    url: squid_api.apiURL + "/logout?access_token=" + this.get("accessToken"),
                    dataType: 'json',
                    contentType: 'application/json'
                });
    
                request.done(function (jsonData) {
                    squid_api.utils.clearLogin();
                });
    
                request.fail(function (jqXHR, textStatus, errorThrown) {
                    squid_api.model.status.set("message", "logout failed");
                    squid_api.model.status.set("error", "error");
                });
            } else {
                squid_api.utils.clearLogin();
            }
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

        url: function () {
            return this.baseRoot() + this.wsName + "?access_token=" + this.accessToken; // get user
        }

    });
    squid_api.model.userModel = new squid_api.model.UserModel();


    // Status Model
    squid_api.model.StatusModel = squid_api.model.BaseModel.extend({
        STATUS_RUNNING: "RUNNING",
        STATUS_DONE: "DONE",
        runningTasks: [],
        pushTask: function (task) {
            this.runningTasks.push(task);
            console.log("running tasks count : " + this.runningTasks.length);
            Backbone.Model.prototype.set.call(this, "status", this.STATUS_RUNNING);
        },
        pullTask: function (task) {
            var i = this.runningTasks.indexOf(task);
            if (i != -1) {
                this.runningTasks.splice(i, 1);
            }
            console.log("running tasks count : " + this.runningTasks.length);
            if (this.runningTasks.length === 0) {
                Backbone.Model.prototype.set.call(this, "status", this.STATUS_DONE);
            }
        }
    });
    squid_api.model.status = new squid_api.model.StatusModel({
        status: null,
        error: null,
        message: null,
        project: null,
        domain: null
    });

    /*
     * --- API Meta-Model objects Mapping to Backbone Models---
     */

    squid_api.model.CustomerInfoModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return this.baseRoot() + "/";
        }
    });

    squid_api.model.ClientModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return this.baseRoot() + "/clients/" + this.getOid("clientId");
        }
    });
    
    squid_api.model.ClientCollection = squid_api.model.BaseCollection.extend({
        model: squid_api.model.ClientModel,
        urlRoot: function () {
            return this.baseRoot() + "/clients";
        }
    });

    squid_api.model.StateModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return this.baseRoot() + "/states/" + this.getOid("stateId");
        }
    });

    squid_api.model.ShortcutModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return this.baseRoot() + "/shortcuts/" + this.getOid("shortcutId");
        }
    });

    squid_api.model.ShortcutCollection = squid_api.model.BaseCollection.extend({
        model: squid_api.model.ShortcutModel,
        urlRoot: function () {
            return this.baseRoot() + "/shortcuts";
        }
    });


    squid_api.model.InternalanalysisjobModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return this.baseRoot() + "/internalanalysisjobs/";
        }
    });

    squid_api.model.InternalanalysisjobCollection = squid_api.model.BaseCollection.extend({
        model: squid_api.model.InternalanalysisjobModel,
        urlRoot: function () {
            return this.baseRoot() + "/internalanalysisjobs";
        }
    });

    squid_api.model.ProjectModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return this.baseRoot() + "/projects/" + this.getOid("projectId");
        }
    });

    squid_api.model.ProjectCollection = squid_api.model.BaseCollection.extend({
        model: squid_api.model.ProjectModel,
        urlRoot: function () {
            return this.baseRoot() + "/projects";
        }
    });

    squid_api.model.UserModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return this.baseRoot() + "/users/" + this.getOid("userId");
        }
    });
    
    squid_api.model.GroupModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return this.baseRoot() + "/usergroups/" + this.getOid("groupId");
        }
    });

    squid_api.model.GroupCollection = squid_api.model.BaseCollection.extend({
        model: squid_api.model.GroupModel,
        urlRoot: function () {
            return this.baseRoot() + "/usergroups";
        }
    });

    squid_api.model.UserCollection = squid_api.model.BaseCollection.extend({
        model: squid_api.model.UserModel,
        urlRoot: function () {
            return this.baseRoot() + "/users";
        }
    });
    
    squid_api.model.BookmarkfolderModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return this.baseRoot() + "/bookmarkfolders/" + this.getOid("bookmarkfolderId");
        }
    });
    
    squid_api.model.BookmarkfolderCollection = squid_api.model.BaseCollection.extend({
        model: squid_api.model.BookmarkfolderModel,
        urlRoot: function () {
            return this.baseRoot() + "/bookmarkfolders";
        }
    });

    squid_api.model.DomainModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments) + "/domains/" + this.getOid("domainId");
        }
    });

    squid_api.model.DomainCollection = squid_api.model.BaseCollection.extend({
        model: squid_api.model.DomainModel,
        urlRoot: function () {
            return this.parent.urlRoot() + "/domains";
        }
    });

    squid_api.model.RelationModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments) + "/relations/" + this.getOid("relationId");
        }
    });

    squid_api.model.RelationCollection = squid_api.model.BaseCollection.extend({
        model: squid_api.model.RelationModel,
        urlRoot: function () {
            return this.parent.urlRoot() + "/relations";
        }
    });

    squid_api.model.DimensionModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return squid_api.model.DomainModel.prototype.urlRoot.apply(this, arguments) + "/dimensions/" + this.getOid("dimensionId");
        }
    });

    squid_api.model.DimensionCollection = squid_api.model.BaseCollection.extend({
        model: squid_api.model.DimensionModel,
        urlRoot: function () {
            return this.parent.urlRoot() + "/dimensions";
        }
    });

    squid_api.model.MetricModel = squid_api.model.BaseModel.extend({
        urlRoot: function () {
            return squid_api.model.DomainModel.prototype.urlRoot.apply(this, arguments) + "/metrics/" + this.getOid("metricId");
        }
    });

    squid_api.model.MetricCollection = squid_api.model.BaseCollection.extend({
        model: squid_api.model.MetricModel,
        urlRoot: function () {
            return this.parent.urlRoot() + "/metrics";
        }
    });

    squid_api.model.BookmarkModel = squid_api.model.BaseModel.extend({
        urlRoot: function() {
            return squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments) + "/bookmarks/" + this.getOid("bookmarkId");
        }
    });

    squid_api.model.BookmarkCollection = squid_api.model.BaseCollection.extend({
        model : squid_api.model.BookmarkModel,
        urlRoot: function() {
            return this.parent.urlRoot() + "/bookmarks";
        }
    });

    // declare nested models after Model and Collections as there are cyclic dependencies

    squid_api.model.CustomerInfoModel.prototype.relations = {
        "projects" : squid_api.model.ProjectCollection,
        "users" : squid_api.model.UserCollection,
        "userGroups" : squid_api.model.GroupCollection,
        "shortcuts" : squid_api.model.ShortcutCollection,
        "clients" : squid_api.model.ClientCollection,
        "bookmarkfolders" : squid_api.model.BookmarkfolderCollection
    };

    squid_api.model.ProjectModel.prototype.relations = {
        "domains" : squid_api.model.DomainCollection,
        "relations" : squid_api.model.RelationCollection,
        "bookmarks" : squid_api.model.BookmarkCollection
    };

    squid_api.model.DomainModel.prototype.relations = {
        "dimensions" : squid_api.model.DimensionCollection,
        "metrics" : squid_api.model.MetricCollection
    };
    
    squid_api.model.BookmarkfolderModel.prototype.relations = {
        "folders" : squid_api.model.BookmarkfolderCollection
    };

    /**
     * Backbone collection enhancement to perform a save() on all models of a collection.
     * This method will trigger a "sync" event on the collection when all done.
     * @return a Promise which is resolved once all save operations are done.
     */
    Backbone.Collection.prototype.saveAll = function (models) {
        var dfd = new $.Deferred();
        var me = this;
        // create array of deferreds to save
        var deferreds = [];
        for (var i = 0; i < models.length; i++) {
            if (models[i].hasChanged()) {
                deferreds.push(models[i].save());
            }
        }

        // resolve promise once all models have been saved
        $.when.apply($, deferreds).done(function (models) {
            me.trigger("sync");
            dfd.resolve(models);
        });

        return dfd.promise();
    };
    
    return squid_api;
}));

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
        
        getAPIUrlDfd : null,
        authCodeCookiePrefix : "obioac_",
        tokenCookiePrefix : "sq-token",
        
        getAuthCode : function() {
            var authCode = squid_api.utils.getParamValue("code", null, squid_api.uri);
            if (authCode) {
                // store it for future use in same session
                squid_api.utils.writeCookie(squid_api.utils.authCodeCookiePrefix, "", null, authCode);
            } else {
                // try to retrieve it from storage
                authCode = squid_api.utils.readCookie(squid_api.utils.authCodeCookiePrefix);
            }
            return authCode;
        },
        
        getAPIUrl : function() {
            var dfd = squid_api.utils.getAPIUrlDfd;
            if (!dfd) {
                squid_api.utils.getAPIUrlDfd = $.Deferred();
                dfd = squid_api.utils.getAPIUrlDfd;

                if ((!squid_api.apiURL) && squid_api.teamId) {
                    var authCode = squid_api.utils.getAuthCode();
                    if (squid_api.obioURL && authCode) {
                        $.ajax({
                            url: squid_api.obioURL+"/teams/"+squid_api.teamId,
                            dataType: 'json',
                            headers: {
                                "Authorization":("Bearer "+authCode)
                            }
                        }).done(null, function (xhr, status, error) {
                            if (xhr.serverUrl.charAt(xhr.serverUrl.length-1) == '/') {
                                squid_api.apiBaseURL = xhr.serverUrl.substring(0, xhr.serverUrl.length-1);
                            } else {
                                squid_api.apiBaseURL = xhr.serverUrl;
                            }
                            squid_api.setApiURL(squid_api.apiBaseURL + "/rs");
                            squid_api.swaggerURL = squid_api.apiBaseURL + "/swagger.json";
                            console.log("apiURL:"+squid_api.apiURL);
                            dfd.resolve(squid_api.apiURL);
                        }).fail(null, function (xhr, status, error) {
                            console.error("failed to get apiURL");
                            dfd.reject();
                        });
                    } else {
                        var message = "Unable to connect to the API, please check openbouquet.io";
                        squid_api.model.status.set("error",{
                            "dismissible": false,
                            "message": message
                        });
                        dfd.reject();
                    }
                } else {
                    dfd.resolve(squid_api.apiURL);
                }
            }
            return dfd;
        },
        
        getAPIStatus : function() {
            var dfd = $.Deferred();
            if (!squid_api.apiVersion) {
                // not in cache, execute the query
                squid_api.utils.getAPIUrl().done(function(apiURL) {
                    $.ajax({
                        url: apiURL+"/status"
                    }).done(null, function (xhr) {
                        // put in cache
                        squid_api.apiVersion = xhr;
                        dfd.resolve(xhr);
                    }).fail(null, function (xhr) {
                        dfd.reject();
                    });
                }).fail(null, function (xhr) {
                    dfd.reject();
                });
            } else {
                dfd.resolve(squid_api.apiVersion);
            }
            return dfd;
        },
        
        /**
         * Check the API matches a given version string.
         * @param semver range to match (e.g. ">=4.2.4")
         * @return a Promise
         */
        checkAPIVersion : function(range) {
            var dfd = $.Deferred();
            squid_api.utils.getAPIStatus().done(function (status) {
                // version check
                if (status["bouquet-server"]) {
                    var version = status["bouquet-server"].version;
                    if (version.indexOf('-') > -1) {
                        version = version.substring(0, version.indexOf('-'));
                    }
                    if (semver.satisfies(version, range)) {
                        dfd.resolve(version);
                    } else {
                        dfd.reject(version);
                    }
                } else {
                    dfd.reject();
                }
            }).fail(null, function () {
                dfd.reject();
            });
            return dfd;
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
            squid_api.utils.writeCookie(squid_api.utils.tokenCookiePrefix + "_" + squid_api.customerId, "", -100000, null);
            squid_api.utils.writeCookie(squid_api.utils.tokenCookiePrefix, "", -100000, null);
            if (squid_api.utils.teamId) {
                squid_api.utils.writeCookie(squid_api.utils.authCodeCookiePrefix, "", -100000, null);
            }
            squid_api.getLoginFromToken(null);
        },

        getLoginUrl : function(redirectURI) {
            var dfd = $.Deferred();
            if (squid_api.loginURL) {
                var url = new URI(squid_api.loginURL);
                url.setQuery("response_type","code");
                if (squid_api.clientId) {
                    url.setQuery("client_id", squid_api.clientId);
                }
                
                // build redirectUri
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
                
                url.setQuery("redirect_uri",rurlString);
                
                squid_api.utils.getAPIStatus().done(function(status) {
                    if (status.teamId) {
                        url.setQuery("teamId", status.teamId);
                    }
                    dfd.resolve(url);
                }).fail(function() {
                    dfd.resolve(url);
                });
            } else {
                dfd.reject();
            }
            return dfd;
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
        },
        
        redirect: function(url) {
            if (squid_api.wsNotification) {
                // close the notification WS
                squid_api.bouquetSessionId = null;
                squid_api.wsNotification.close();
            }
            if (!squid_api.debug) {
                // redirect
                window.location.href = url;
            } else {
                // bypass redirection
                console.log("DEBUG redirection : "+url);
            }
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
                var data = {
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": squid_api.clientId,
                    "redirect_uri": null
                };
                if (squid_api.teamId) {
                    data.teamId = squid_api.teamId;
                }

                // fetch the access token
                squid_api.utils.getAPIUrl().done(function(apiURL) {
                    $.ajax({
                        type: "POST",
                        url: apiURL + "/token",
                        dataType: 'json',
                        data: data
                    }).fail(function (jqXHR) {
                        if (jqXHR.status === 401) {
                            // init the Login URL if provided by server
                            if (jqXHR.responseJSON.loginURL) {
                                squid_api.loginURL = jqXHR.responseJSON.loginURL;
                            }
                        }
                        deferred.reject(jqXHR.responseJSON);
                    }).done(function (data) {
                        var token = data.oid;
                        me.getLoginFromToken(token).done( function(login) {
                            deferred.resolve(login);
                        }).fail( function() {
                            deferred.reject();
                        });
                    });
                }).fail(function () {
                    deferred.reject();
                });
            } else {
                var token = squid_api.utils.getParamValue("access_token", null, me.uri);
                squid_api.utils.getAPIUrl().done(function(apiURL) {
                    me.getLoginFromToken(token).always( function(login) {
                        deferred.resolve(login);
                    });
                }).fail(function () {
                    deferred.reject();
                });
            }
            return deferred;
        },
        
        /**
         * Get a Model object
         * @param the object composite Id
         * Returns a Promise
         */
        getObject : function(id, forceRefresh) {
            return this.getObjectHelper(squid_api.getCustomer(), id, 0, forceRefresh);
        },
        
        getObjectHelper : function(p, id, level, forceRefresh) {
            var keys = Object.keys(id);
            var l = keys.length;
            var oid = keys[level];
            if (level < l) {
                level++;
                return p.then(function(o) {
                    // done
                    var c = o.get(oid.substring(0,oid.length-2)+"s");
                    var doForceRefresh = false;
                    if (forceRefresh && (level === l)) {
                        // this is our object
                        doForceRefresh = true;
                    }
                    return squid_api.getObjectHelper(c.load(id[oid], doForceRefresh),id, level, forceRefresh);
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
                    }).fail( function(data) {
                        deferred.reject(data);
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

        setConfigSelection : function(selectionClone) {
            var config = squid_api.model.config;
            var domain = config.get("domain");

            // persist config period facet selection
            if (config.get("period") && config.get("period")[domain]) {
                var configSelection = config.get("selection");
                var currentPeriodId = config.get("period")[domain];
                var configPeriodSelectedItems;

                // find current period selected Items
                for (var i=0; i<configSelection.facets.length; i++) {
                    if (configSelection.facets[i].id === currentPeriodId) {
                        configPeriodSelectedItems = configSelection.facets[i].selectedItems;
                    }
                }
                
                // update selectionClone with period selected items
                for (var ix=0; ix<selectionClone.facets.length; ix++) {
                    if (selectionClone.facets[ix].id === currentPeriodId) {
                        selectionClone.facets[ix].selectedItems = configPeriodSelectedItems;
                    }
                }
            }

            // Set the updated filters model
            config.set("selection", squid_api.utils.buildCleanSelection(selectionClone));
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
            this.teamId = squid_api.utils.getParamValue("teamId", null, me.uri);

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
                if (args.loginURL) {
                    squid_api.loginURL = args.loginURL;
                }
                apiUrl = squid_api.utils.getParamValue("apiUrl", args.apiUrl, uri);
                if (apiUrl) {
                    if (apiUrl.indexOf("://") < 0) {
                        apiUrl = "https://" + apiUrl;
                    }
                    this.apiBaseURL = apiUrl + "/" + api + "/" + version;
                    this.setApiURL(this.apiBaseURL + "/rs");
                    this.swaggerURL = this.apiBaseURL + "/swagger.json";
                    if (!squid_api.loginURL) {
                        // building default loginURL
                        squid_api.loginURL = apiUrl + "/" + api + "/auth/oauth";
                    }
                } else {
                    this.obioURL = squid_api.utils.getParamValue("obioUrl", args.obioUrl, uri);
                }
    
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
            var me = this;
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
                    // continue init process
                    this.initStep0(args);
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
                if (v) {
                    message = "Bouquet Server version does not match this App's api version requirements";
                    me.model.status.set("error",{
                        "dismissible": false,
                        "message": message
                    });
                }
                me.initStep1(args);
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
                if (args && args.config && args.config.bookmark) {
                    bookmark = args.config.bookmark;
                }
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
            }).fail(function(data) {
                var error;
                if (data) {
                    error = data.error;
                } else {
                    error = "failed to get customer";
                }
                squid_api.model.login.set({"error": error}, {silent : true});
                squid_api.model.login.set("login", null);
            });
        },
        
        initStep2: function (args, shortcut, bookmark) {
            // set the config
            if (shortcut) {
                squid_api.setShortcutId(shortcut);
            } else if (bookmark) {
                squid_api.setBookmarkId(bookmark, {"project" : args.config.project});
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
                        squid_api.getObject(data.source, true).done(function(o) {
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
                    if (squid_api.bouquetSessionId) {
                        squid_api.bouquetSessionId = null;
                        var time = Math.min(30, (Math.pow(2, squid_api.wsConnectionAttempts) - 1));
                        console.log("WebSocket connection closed, Code: " + event.code + (event.reason === "" ? "" : ", Reason: " + event.reason)+" - retrying in " + time + " sec");
                        setTimeout(function () {
                            // We've tried to reconnect so increment the attempts by 1
                            squid_api.wsConnectionAttempts++;
                            // Connection has closed so try to reconnect every 10 seconds.
                            squid_api.initStep3(); 
                        }, time*1000);
                    }
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

/*! Squid Core API AnalysisJob Controller V2.0 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['Backbone', '_', 'squid_api'], factory);
    } else {
        factory(root.Backbone, _, root.squid_api);
    }
}(this, function (Backbone, _, squid_api) {

    // here we expose some models

    squid_api.model.ProjectAnalysisJob = squid_api.model.ProjectModel.extend({
        urlRoot: function () {
            var url = squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments);
            url = url + "/analysisjobs/" + (this.get("id").analysisJobId ? this.get("id").analysisJobId : "");
            return url;
        },
        error: null,
        domains: null,
        dimensions: null,
        metrics: null,
        selection: null
    });

    squid_api.model.ProjectAnalysisJobViewSQL = squid_api.model.ProjectAnalysisJob.extend({
        urlRoot: function () {
            return squid_api.model.ProjectAnalysisJob.prototype.urlRoot.apply(this, arguments) + "/sql";
        },
        error: null
    });

    squid_api.model.ProjectAnalysisJobResult = squid_api.model.ProjectAnalysisJob.extend({
        urlRoot: function () {
            return squid_api.model.ProjectAnalysisJob.prototype.urlRoot.apply(this, arguments) + "/results";
        },
        error: null
    });

    squid_api.model.ProjectAnalysisJobRender = squid_api.model.ProjectAnalysisJob.extend({
        urlRoot: function () {
            return squid_api.model.ProjectAnalysisJob.prototype.urlRoot.apply(this, arguments) + "." + this.get("format");
        },
        error: null
    });

    squid_api.model.AnalysisJob = squid_api.model.BaseModel.extend({
        results: null,

        initialize: function (attributes, options) {
            this.set("id", {
                "projectId": squid_api.projectId,
                "analysisJobId": null
            });
            if (squid_api.domainId) {
                this.setDomainIds([squid_api.domainId]);
            }
        },

        setProjectId: function (projectId) {
            this.set({
                "id": {
                    "projectId": projectId,
                    "analysisJobId": null
                },
                "oid": null,
                "domains": null,
                "dimensions": null,
                "metrics": null,
                "selection": null,
                "results": null
            });
            return this;
        },

        setDomain: function (domain) {
            if (domain) {
                this.setDomainIds([domain]);
            }
        },

        setDomainIds: function (domainIdList) {
            var domains;
            if (domainIdList) {
                domains = [];
                for (var i = 0; i < domainIdList.length; i++) {
                    if (domainIdList[i].projectId) {
                        domains.push({
                            "projectId": domainIdList[i].projectId,
                            "domainId": domainIdList[i].domainId
                        });
                    } else {
                        domains.push({
                            "projectId": this.get("id").projectId,
                            "domainId": domainIdList[i]
                        });
                    }
                }
            } else {
                domains = null;
            }
            this.set({
                "id": {
                    "projectId": this.get("id").projectId,
                    "analysisJobId": null
                },
                "oid": null,
                "domains": domains,
                "dimensions": null,
                "metrics": null,
                "selection": null,
                "results": null
            });
            return this;
        },

        setDimensionIds: function (dimensionIdList, silent) {
            var dims;
            if (dimensionIdList) {
                dims = [];
                for (var i = 0; i < dimensionIdList.length; i++) {
                    if (dimensionIdList[i]) {
                        if (dimensionIdList[i].projectId) {
                            dims.push({
                                "projectId": dimensionIdList[i].projectId,
                                "domainId": dimensionIdList[i].domainId,
                                "dimensionId": dimensionIdList[i].dimensionId
                            });
                        } else {
                            dims.push({
                                "projectId": this.get("id").projectId,
                                "domainId": this.get("domains")[0].domainId,
                                "dimensionId": dimensionIdList[i]
                            });
                        }
                    }
                }
            } else {
                dims = null;
            }
            this.setDimensions(dims, silent);
            return this;
        },

        setFacets: function (facetList, silent) {
            var facets;
            if (facetList) {
                facets = [];
                for (var i = 0; i < facetList.length; i++) {
                    if (facetList[i]) {
                        facets.push({
                            "value": facetList[i]
                        });
                    }
                }
            } else {
                facets = null;
            }
            silent = silent || false;
            this.set({"facets": facets}, {"silent": silent});
            return this;
        },

        setDimensions: function (dimensions, silent) {
            silent = silent || false;
            this.set({"dimensions": dimensions}, {"silent": silent});
            return this;
        },

        setDimensionId: function (dimensionId, index) {
            var dims = this.get("dimensions") || [];
            dims = dims.slice(0);
            index = index || 0;
            if (dimensionId.projectId) {
                dims[index] = {
                    "projectId": dimensionId.projectId,
                    "domainId": dimensionId.domainId,
                    "dimensionId": dimensionId.dimensionId
                };
            } else {
                dims[index] = {
                    "projectId": this.get("id").projectId,
                    "domainId": this.get("domains")[0].domainId,
                    "dimensionId": dimensionId
                };
            }
            this.setDimensions(dims);
            return this;
        },

        setFacet: function (facetId, index) {
            var facets = this.get("facets") || [];
            facets = facets.slice(0);
            index = index || 0;
            facets[index] = facetId;
            this.setFacets(facets);
            return this;
        },

        setMetricIds: function (metricIdList, silent) {
            var metrics;
            if (metricIdList) {
                metrics = [];
                for (var i = 0; i < metricIdList.length; i++) {
                    if (metricIdList[i]) {
                        metrics.push({
                            "projectId": this.get("id").projectId,
                            "domainId": this.get("domains")[0].domainId,
                            "metricId": metricIdList[i]
                        });
                    }
                }
            } else {
                metrics = null;
            }
            this.setMetrics(metrics, silent);
            return this;
        },

        setMetrics: function (metricsArg, silent) {
            var metrics = [];
            silent = silent || false;
            if (metricsArg) {
                for (var i = 0; i < metricsArg.length; i++) {
                    var metric = metricsArg[i];
                    if (metric) {
                        if (metric instanceof Object) {
                            // metric is already on object
                            if (metric.projectId) {
                                // but is just a PK
                                metrics.push({
                                    "id": metric
                                });
                            } else {
                                metrics.push(metric);
                            }
                        } else {
                            // metric is just an Id
                            metrics.push({
                                "id": {
                                    "projectId": this.get("id").projectId,
                                    "domainId": this.get("domains")[0].domainId,
                                    "metricId": metric
                                }
                            });
                        }
                    }
                }
            }
            this.set({"metricList": metrics}, {"silent": silent});
            return this;
        },

        setMetricId: function (metricId, index) {
            var items = this.get("metrics") || [];
            items = items.slice(0);
            index = index || 0;
            items[index] = {
                "projectId": this.get("id").projectId,
                "domainId": this.get("domains")[0].domainId,
                "metricId": metricId
            };
            this.setMetrics(items);
            return this;
        },

        setSelection: function (selection, silent) {
            silent = silent || false;
            var cleanSelection = squid_api.utils.buildCleanSelection(selection);
            selection = cleanSelection;
            this.set({"selection": selection}, {"silent": silent});
            return this;
        },

        isDone: function () {
            return (this.get("status") == "DONE");
        }
    });

    squid_api.model.MultiAnalysisJob = Backbone.Model.extend({

        setProjectId: function (projectId) {
            var analyses = this.get("analyses");
            if (analyses) {
                for (var i = 0; i < analyses.length; i++) {
                    analyses[i].setProjectId(projectId);
                }
            }
        },

        isDone: function () {
            return (this.get("status") == "DONE");
        }
    });

    // Controller definition

    var controller = {

        fakeServer: null,

        /**
         * Create (and execute) a new AnalysisJob.
         * @returns a Jquery Deferred
         */
        createAnalysisJob: function (analysisModel, selection) {

            var observer = $.Deferred();

            analysisModel.set("status", "RUNNING");

            // create a new AnalysisJob
            var projectAnalysisJob = new squid_api.model.ProjectAnalysisJob();
            var projectId;
            if (analysisModel.get("id").projectId) {
                projectId = analysisModel.get("id").projectId;
            } else {
                projectId = analysisModel.get("projectId");
            }
            projectAnalysisJob.parameters = analysisModel.parameters;
            projectAnalysisJob.statusModel = squid_api.model.status;
            projectAnalysisJob.set(analysisModel.attributes);
            if ((!analysisModel.get("selection")) && selection) {
                projectAnalysisJob.set("selection", selection);
            }
            projectAnalysisJob.set({
                "id": {
                    projectId: projectId,
                    analysisJobId: null
                },
                "results": null,
                "error": null
            });

            // save the analysisJob to API
            if (this.fakeServer) {
                this.fakeServer.respond();
            }

            projectAnalysisJob.save({}, {
                success: function (model, response) {
                    if (model.get("error")) {
                        console.error("createAnalysis error " + model.get("error").message);
                        analysisModel.set("results", null);
                        analysisModel.set("error", model.get("error"));
                        analysisModel.set("status", model.get("status"));
                        observer.reject(model, response);
                    } else {
                        console.log("createAnalysis success");
                        analysisModel.set("id", model.get("id"));
                        analysisModel.set("oid", model.get("id").analysisJobId);
                        analysisModel.set("results", model.get("results"));
                        if (model.get("results") === null && model.get("status") !== "RUNNING") {
                            analysisModel.set("status", "PENDING");
                        } else {
                            analysisModel.set("status", model.get("status"));
                        }
                        observer.resolve(model, response);
                    }
                },
                error: function (model, response) {
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
         * @return a Promise
         */
        compute: function (analysisJob, filters) {
            if (analysisJob.get("analyses")) {
                // compute a multi analysis
                return this.computeMultiAnalysis(analysisJob, filters);
            } else {
                // compute a single analysis
                return this.computeSingleAnalysis(analysisJob, filters);
            }
        },

        /**
         * Retrieve job results (loop until DONE or error)
         */
        getAnalysisJobResults: function (observer, analysisModel) {
            observer = observer || $.Deferred();
            console.log("getAnalysisJobResults");
            var analysisJobResults = new squid_api.model.ProjectAnalysisJobResult();
            analysisJobResults.parameters = analysisModel.parameters;
            analysisJobResults.statusModel = squid_api.model.status;
            analysisJobResults.set("id", analysisModel.get("id"));
            analysisJobResults.set("oid", analysisModel.get("oid"));

            // get the results from API
            analysisJobResults.fetch({
                error: function (model, response) {
                    analysisModel.set("error", {message: response.statusText});
                    analysisModel.set("status", "DONE");
                    observer.reject(model, response);
                },
                success: function (model, response) {
                    if (response === null || response === undefined) {
                        analysisModel.set("status", "PENDING");
                        analysisModel.set("results", []);
                        observer.resolve(model, response);
                    } else {
                        if (model.get("apiError") && (model.get("apiError") == "COMPUTING_IN_PROGRESS")) {
                        // retry
                        controller.getAnalysisJobResults(observer, analysisModel);
                    } else {
                        var t = model.get("statistics");
                        if (t) {
                            console.log("AnalysisJob computation time : " + (t.endTime - t.startTime) + " ms");
                        }
                        // update the analysis Model
                        analysisModel.set("statistics", t);
                        analysisModel.set("error", null);
                        analysisModel.set("results", model.toJSON());
                        analysisModel.set("status", "DONE");
                        observer.resolve(model, response);
                        }
                    }
                }
            });
            if (this.fakeServer) {
                this.fakeServer.respond();
            }
            return observer;
        },

        /**
         * Retrieve job (loop until DONE or error)
         */
        getAnalysisJob: function (observer, analysisModel) {
            console.log("getAnalysisJob");
            var analysisJob = new squid_api.model.ProjectAnalysisJob();
            analysisJob.statusModel = squid_api.model.status;
            analysisJob.set("id", analysisModel.get("id"));
            analysisJob.set("oid", analysisModel.get("oid"));

            // set parameters
            analysisJob.parameters = analysisModel.parameters;

            // get the results from API
            analysisJob.fetch({
                error: function (model, response) {
                    analysisModel.set("error", {message: response.statusText});
                    analysisModel.set("status", "DONE");
                    observer.reject(model, response);
                },
                success: function (model, response) {
                    if (model.get("status") && (model.get("status") === "RUNNING")) {
                        // retry in 1s
                        setTimeout(function () {
                            controller.getAnalysisJob(observer, analysisModel);
                        }, 1000);

                    } else {
                        var t = model.get("statistics");
                        if (t) {
                            console.log("AnalysisJob computation time : " + (t.endTime - t.startTime) + " ms");
                        }
                        // update the analysis Model
                        analysisModel.set("statistics", t);
                        analysisModel.set("error", null);
                        analysisModel.set("status", model.get("status"));
                        observer.resolve(model, response);
                    }
                }
            });
            if (this.fakeServer) {
                this.fakeServer.respond();
            }
        },

        /**
         * Create (and execute) a new Single AnalysisJob, retrieve the results
         * and set the 'done' or 'error' attribute to true when all analysis are done or any failed.
         * @return Observer (Deferred)
         */
        computeSingleAnalysis: function (analysisJob, filters) {
            var selection, observer = $.Deferred();

            // compute a single analysis
            if (!filters) {
                if (!analysisJob.get("selection")) {
                    // use default filters
                    selection = squid_api.model.filters.get("selection");
                } else {
                    selection = analysisJob.get("selection");
                }
            } else {
                selection = filters.get("selection");
            }

            selection = squid_api.utils.buildCleanSelection(selection);

            // validate job
            if (((!analysisJob.get("metricList") || analysisJob.get("metricList").length === 0)) && (!analysisJob.get("dimensions") && (!analysisJob.get("facets") || analysisJob.get("facets").length === 0))) {
                console.error("Invalid analysis : Must at least define a metric or a dimension");
                observer.reject({"err": "invalid_analysis", "message": "Must at least define a metric or a dimension"});
            } else {
                this.createAnalysisJob(analysisJob, selection)
                    .done(function (model, response) {
                        if (model.get("status") == "DONE") {
                            var t = model.get("statistics");
                            if (t) {
                                console.log("AnalysisJob computation time : " + (t.endTime - t.startTime) + " ms");
                            }
                            // update the analysis Model
                            analysisJob.set("statistics", t);
                            analysisJob.set("error", model.get("error"));
                            analysisJob.set("results", model.get("results"));
                            if (model.get("results") === null && model.get("status") !== "RUNNING") {
                                analysisJob.set("status", "PENDING");
                            } else {
                                analysisJob.set("status", model.get("status"));
                            }
                            
                            observer.resolve(model, response);
                        } else {
                            // try to get the results
                            controller.getAnalysisJobResults(observer, analysisJob);
                        }
                    })
                    .fail(function (model, response) {
                        observer.reject(model, response);
                    });
            }

            return observer;
        },

        /**
         * Create (and execute) a new MultiAnalysisJob, retrieve the results
         * and set the 'done' or 'error' attribute to true when all analysis are done or any failed.
         */
        computeMultiAnalysis: function (multiAnalysisModel, filters) {
            var me = this;
            multiAnalysisModel.set("status", "RUNNING");
            var analyses = multiAnalysisModel.get("analyses");
            var analysesCount = analyses.length;
            // build all jobs
            var jobs = [];
            for (var i = 0; i < analysesCount; i++) {
                var analysisModel = analyses[i];
                jobs.push(this.computeSingleAnalysis(analysisModel, filters));
            }
            console.log("analysesCount : " + analysesCount);
            // wait for jobs completion
            var combinedPromise = $.when.apply($, jobs);

            combinedPromise.always(function () {
                for (var i = 0; i < analysesCount; i++) {
                    var analysis = analyses[i];
                    if (analysis.get("error")) {
                        multiAnalysisModel.set("error", analysis.get("error"));
                    }
                }
                multiAnalysisModel.set("status", "DONE");
            });
            return combinedPromise;
        },

        // backward compatibility

        computeAnalysis: function (analysisJob, filters) {
            return this.compute(analysisJob, filters);
        },

        AnalysisModel: squid_api.model.AnalysisJob,

        MultiAnalysisModel: squid_api.model.MultiAnalysisJob


    };


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

    /**
     * ProjectFacetJob : used to compute Facets from a Selection
     */
    squid_api.model.ProjectFacetJob = squid_api.model.ProjectModel.extend({
        urlRoot: function () {
            var id = this.get("id").facetJobId;
            return squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments) + "/facetjobs/" + (id ? id : "");
        },
        error: null,
        domains: null,
        timeoutMillis: function () {
            return squid_api.timeoutMillis;
        },
        relations : {}
    });

    /**
     * ProjectFacetJobResult : get the ProjectFacetJob's computation results (a Selection).
     */
    squid_api.model.ProjectFacetJobResult = squid_api.model.ProjectFacetJob.extend({
        urlRoot: function () {
            return squid_api.model.ProjectFacetJob.prototype.urlRoot.apply(this, arguments) + "/results/";
        },
        error: null,
        timeoutMillis: function () {
            return squid_api.timeoutMillis;
        }
    });

    /**
     * ProjectFacetJobFacet : get the Members of a single Facet.
     */
    squid_api.model.ProjectFacetJobFacet = squid_api.model.ProjectFacetJobResult.extend({
        urlRoot: function () {
            // facet id need url-encoding
            var id = encodeURIComponent(this.get("oid"));
            return squid_api.model.ProjectFacetJobResult.prototype.urlRoot.apply(this, arguments) + id;
        },
        error: null,
        timeoutMillis: function () {
            return squid_api.timeoutMillis;
        }
    });

    /**
     * FilterJob is the Model which is manipulated be the Filters panel.
     * This is not an API model but a JSSDK internal model.
     * It implements useful methods to manipulate the Selection.
     * Its "id" will be the id of the ProjectFacetJob which was used to compute its selection.
     */
    squid_api.model.FiltersJob = Backbone.Model.extend({

        initialize: function () {
            this.set("id", {
                "projectId": squid_api.projectId
            });
        },

        setProjectId: function (projectId) {
            this.set({
                    "id": {
                        "projectId": projectId
                    },
                    "domains": null,
                    "selection": null
                }
            );
            return this;
        },

        setDomainIds: function (domainIdList) {
            if (domainIdList) {
                var domains = [];
                for (var i = 0; i < domainIdList.length; i++) {
                    var id = domainIdList[i];
                    if (id.domainId) {
                        domains.push(id);
                    } else {
                        domains.push({
                            "projectId": this.get("id").projectId,
                            "domainId": id
                        });
                    }
                }
                this.set({"domains": domains});
            } else {
                if (this.get("domains")) {
                    this.set({"domains": null});
                }
            }

            return this;
        },

        addSelection: function (dimension, value) {
            var facets = this.get("selection").facets;
            // check if the facet already exists
            var facetToUpdate;
            for (var i = 0; i < facets.length; i++) {
                var facet = facets[i];
                if (facet.dimension.oid == dimension.id.dimensionId) {
                    facetToUpdate = facet;
                }
            }
            if (!facetToUpdate) {
                facetToUpdate = {
                    "dimension": {
                        "id": {
                            "projectId": this.get("id").projectId,
                            "domainId": dimension.id.domainId,
                            "dimensionId": dimension.id.dimensionId
                        }
                    },
                    "selectedItems": []
                };
                facets.push(facetToUpdate);
            }
            // update the facet
            facetToUpdate.selectedItems.push({
                "type": "v",
                "id": -1,
                "value": value
            });
        },

        isDone: function () {
            return (this.get("status") == "DONE");
        },

        /*
         * Extract the selectedItem from the filters (in a more usable form).
         */
        getSelection: function () {
            var data = {}, item;
            var selection = this.get("selection");
            if (selection && selection.facets) {
                var index = 0;
                var facets = selection.facets;
                for (var i = facets.length - 1; i >= 0; i--) {
                    var facet = facets[i];
                    if ((!facet.dimension.type || facet.dimension.type == "CATEGORICAL" || facet.dimension.type == "INDEX") && facet.selectedItems && facet.selectedItems.length > 0) {
                        var temp = [];
                        if (facet.items) {
                            for (var i2 = 0; i2 < facet.items.length; i2++) {
                                item = facet.items[i2];
                                if (item.type == "v") {
                                    temp[item.id] = item.value;
                                }
                            }
                        }
                        var unique = [];
                        for (var j = 0; j < facet.selectedItems.length; j++) {
                            item = facet.selectedItems[j];
                            if (item.type == "v") {
                                var sel = null;
                                var oid = facet.dimension.id.dimensionId;
                                var group = data[oid];
                                if (!group) {
                                    sel = [];
                                    data[oid] =
                                    {
                                        "dimension": facet.dimension,
                                        "selection": sel
                                    };
                                } else {
                                    sel = group.selection;
                                }
                                var value = (item.id >= 0 && item.id < temp.length) ? temp[item.id] : item.value;
                                if (!unique[value]) {
                                    unique[value] = true;
                                    sel.push({
                                        "name": facet.dimension.name ? facet.dimension.name : facet.dimension.id.dimensionId,
                                        "value": value,
                                        "item": item,
                                        "index": index++
                                    });
                                }
                            }
                        }
                    }
                }
            }
            return data;
        }
    });

    // Main Controller

    var controller = {

        fakeServer: null,

        /**
         * Streamline a selection (get rid of the facet items).
         */
        buildCleanSelection: function (selectionOpt) {
            return squid_api.utils.buildCleanSelection(selectionOpt);
        },

        getTemporalFacets: function (selection) {
            var timeFacets = [];
            if (selection && selection.facets) {
                var facets = selection.facets;
                for (var i = 0; i < facets.length; i++) {
                    var facet = facets[i];
                    // V2 way
                    if (facet.dimension.valueType && (facet.dimension.valueType === "DATE")) {
                        timeFacets.push(facet);
                    } else if (facet.selectedItems[0] && (facet.selectedItems[0].lowerBound || facet.selectedItems[0].upperBound)) {
                        // V1 way
                        timeFacets.push(facet);
                    }
                }
            }
            return timeFacets;
        },

        getTemporalFacet: function (selection) {
            var timeFacet;
            var temporalFacets = this.getTemporalFacets(selection);
            if (temporalFacets.length > 0) {
                timeFacet = temporalFacets[0];
            }
            return timeFacet;
        },

        /**
         * Create (and execute) a new Job.
         */
        createJob: function (jobModel, selectionOpt, successCallback, dfd) {
            dfd = dfd || new $.Deferred();

            jobModel.set({"userSelection": null}, {"silent": true});
            jobModel.set("status", "RUNNING");

            // create a new Job

            if (!selectionOpt) {
                selectionOpt = jobModel.get("selection");
            }

            var selection = this.buildCleanSelection(selectionOpt);

            var projectFacetJob = new squid_api.model.ProjectFacetJob();
            projectFacetJob.statusModel = squid_api.model.status;
            var projectId;
            if (jobModel.get("id").projectId) {
                projectId = jobModel.get("id").projectId;
            } else {
                projectId = jobModel.get("projectId");
            }

            if (jobModel.get("engineVersion")) {
                projectFacetJob.set("engineVersion", jobModel.get("engineVersion"));
            }

            var domains = jobModel.get("domains");
            if ((!domains) || (!projectId)) {
                // take first dimension's
                if (selectionOpt) {
                    var facets = selectionOpt.facets;
                    if (facets) {
                        domains = [];
                        for (var i=0; i<facets.length; i++) {
                            var facet = facets[i];
                            domains.push({
                                "projectId" : facet.dimension.id.projectId,
                                "domainId" : facet.dimension.id.domainId
                            });
                            if (!projectId) {
                                projectId = facet.dimension.id.projectId;
                            }
                            break;
                        }
                    }
                }
            }

            projectFacetJob.set({
                "id": {
                    projectId: projectId
                },
                "domains": domains,
                "selection": selection
            });

            // save the job
            if (this.fakeServer) {
                this.fakeServer.respond();
            }

            projectFacetJob.save({}, {
                success: function (model, response) {
                    if (successCallback) {
                        successCallback(model, jobModel, dfd);
                    } else {
                        dfd.resolve();
                    }
                },
                error: function (model, response) {
                    console.error("create job error");
                    jobModel.set("error", response);
                    jobModel.set("status", "DONE");
                    dfd.reject();
                }

            });

            return dfd;
        },

        jobCreationCallback: function (projectFacetJob, jobModel, dfd) {
            dfd = dfd || new $.Deferred();
            jobModel.set("id", projectFacetJob.get("id"));
            jobModel.set("oid", projectFacetJob.get("oid"));
            if (projectFacetJob.get("status") === "DONE") {
                var t = projectFacetJob.get("statistics");
                if (t) {
                    console.log("FacetJob computation time : " + (t.endTime - t.startTime) + " ms");
                }
                // update the Model
                jobModel.set("statistics", t);
                jobModel.set("error", projectFacetJob.get("error"));
                if (projectFacetJob.get("error")) {
                    // jobs returned an error
                    console.error("FacetJob computation error " + projectFacetJob.get("error").message);
                    squid_api.model.status.set("error", projectFacetJob.get("error"));
                }
                if (projectFacetJob.get("results")) {
                    var facets = projectFacetJob.get("results").facets;
                    jobModel.set({
                        "results" : {
                            "compareTo" : projectFacetJob.get("results").compareTo
                        },
                        "selection" : {
                            "facets": facets,
                            "compareTo" : projectFacetJob.get("selection").compareTo
                        }
                    });
                }
                jobModel.set("status", "DONE");
                dfd.resolve();
            } else {
                // try to get the results
                return controller.getJobResults(jobModel, dfd);
            }
        },

        /**
         * Create (and execute) a new Job, then retrieve the results.
         * @param jobModel a FiltersJob
         * @param selection an optional array of Facets
         */
        compute: function (jobModel, selection, dfd) {
            dfd = dfd || new $.Deferred();
            return this.createJob(jobModel, selection, this.jobCreationCallback, dfd);
        },

        /**
         * Retrieve facet members
         */
        getFacetMembers: function (jobModel, facetId, startIndex, maxResults, dfd) {
            dfd = dfd || new $.Deferred();
            startIndex = startIndex || 0;
            maxResults = maxResults || 100;

            console.log("getting Facet : " + facetId);
            var facetJob = new squid_api.model.ProjectFacetJobFacet();
            facetJob.statusModel = squid_api.model.status;
            facetJob.set("id", jobModel.get("id"));
            facetJob.set("oid", facetId);
            if (startIndex) {
                facetJob.addParameter("startIndex", startIndex);
            }
            if (maxResults) {
                facetJob.addParameter("maxResults", maxResults);
            }
            // do not timeout
            facetJob.setParameter("timeout", null);
            facetJob.addParameter("waitComplete", true); // deprecated

            // get the results from API
            facetJob.fetch({
                error: function (model, response) {
                    jobModel.set("error", {message: response.statusText});
                    jobModel.set("status", "DONE");
                    dfd.reject();
                },
                success: function (model, response) {
                    // update the Model
                    var facet;
                    var selection = jobModel.get("selection");
                    if (selection) {
                        var facets = selection.facets;
                        for (fIdx = 0; fIdx < facets.length; fIdx++) {
                            if (facets[fIdx].id == facetId) {
                                facet = facets[fIdx];
                                break;
                            }
                        }
                    } else {
                        selection = [];
                    }
                    if (!facet) {
                        // add a new facet to the selection
                        selection.push(model);
                        jobModel.set("selection", selection);
                    } else {
                        // update the existing facet's items
                        facet.items = model.get("items");
                        facet.done = model.get("done");
                    }
                    dfd.resolve(jobModel);
                }
            });
            if (this.fakeServer) {
                this.fakeServer.respond();
            }

            return dfd.promise();
        },

        /**
         * retrieve the results.
         */
        getJobResults: function (jobModel, dfd) {
            dfd = dfd || new $.Deferred();
            var jobResults = new squid_api.model.ProjectFacetJobResult();
            jobResults.statusModel = squid_api.model.status;
            jobResults.set("id", jobModel.get("id"));
            jobResults.set("oid", jobModel.get("oid"));

            // get the results from API
            jobResults.fetch({
                error: function (model, response) {
                    jobModel.set("error", {message: response.statusText});
                    jobModel.set("status", "DONE");
                    dfd.reject();
                },
                success: function (model, response) {
                    if (model.get("apiError") && (model.get("apiError") == "COMPUTING_IN_PROGRESS")) {
                        // retry
                        controller.getJobResults(jobModel, dfd);
                    } else {
                        var t = model.get("statistics");
                        if (t) {
                            console.log("FacetJob computation time : " + (t.endTime - t.startTime) + " ms");
                        }
                        // update the Model
                        jobModel.set("statistics", t);
                        jobModel.set("error", null);
                        jobModel.set("selection", {"facets": model.get("facets")});
                        jobModel.set("status", "DONE");
                        dfd.resolve();
                    }
                }
            });
            if (this.fakeServer) {
                this.fakeServer.respond();
            }
            return dfd;
        },

        /**
         * Unselect recursively all children
         */
        unSelectChildren: function (facets, facet, includeSelf) {
            var i = 0;
            var selectedItems = facet.selectedItems? facet.selectedItems.length: 0;
            if (includeSelf && selectedItems>0) {
                facet.selectedItems = [];
            }
            // treat children dimensions
            // build a facet map to retrieve parents by dimension id and not facet id
            var facetMap = {};
            for (i = 0; i < facets.length; i++) {
                facetMap[facets[i].dimension.oid] = facets[i];
            }
            // look for all dimensions in case a parent has multiple children & a valid selection
            if (!includeSelf || selectedItems>0) {
                for (i = 0; ((i < facets.length)); i++) {
                    var facet1 = facets[i];
                    if (facet1.dimension.parentId) {
                        if (facetMap[facet1.dimension.parentId.dimensionId]) {
                            if (facetMap[facet1.dimension.parentId.dimensionId].id === facet.id) {
                                this.unSelectChildren(facets, facet1, true);
                            }
                        }
                    }
                }
            }
        },

        unSelect: function (facets, facetId, memberId) {
            var childDimension;
            var i = 0;
            var selectedFacet;
            for (i = 0; i < facets.length; i++) {
                var facet = facets[i];
                if ((memberId === null) || (facet.id === facetId)) {
                    this.unSelectMember(facet, memberId);
                    selectedFacet = facet;
                    break;
                }
            }
            // unselect recursively
            if (selectedFacet) {
                this.unSelectChildren(facets, selectedFacet, false);
            }
        },

        unSelectMember: function (facet, memberId) {
            var selectedItems = facet.selectedItems;
            var facetIndex;
            for (var ix = 0; ((ix < selectedItems.length) && !facetIndex); ix++) {
                if ((memberId === null) || (memberId === selectedItems[ix].id) || (memberId === parseFloat(selectedItems[ix].id))) {
                    facetIndex = ix;
                    selectedItems.splice(facetIndex, 1);
                }
            }
            return facetIndex;
        },

        // backward compatibility
        FiltersModel: squid_api.model.FiltersJob

    };

    squid_api.controller.facetjob = controller;
    return controller;
}));
