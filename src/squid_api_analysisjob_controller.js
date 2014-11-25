/*! Squid Core API AnalysisJob Controller V2.0 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['Backbone', 'squid_api'], factory);
    } else {
        factory(root.Backbone, root.squid_api);
    }
}(this, function (Backbone, squid_api) {
    
    // here we expose some models

    squid_api.model.ProjectAnalysisJob = squid_api.model.ProjectModel.extend({
            urlRoot: function() {
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

    squid_api.model.ProjectAnalysisJobResult = squid_api.model.ProjectAnalysisJob.extend({
            urlRoot: function() {
                return squid_api.model.ProjectAnalysisJob.prototype.urlRoot.apply(this, arguments) + "/results";
            },
            error: null
        });
    
    squid_api.model.AnalysisJob = squid_api.model.BaseModel.extend({
        results: null,

        initialize: function(attributes, options) {
            this.set("id", {
                "projectId": squid_api.projectId,
                "analysisJobId": null
            });
            if (squid_api.domainId) {
                this.setDomainIds([squid_api.domainId]);
            }
        },

        setProjectId : function(projectId) {
            this.set({"id": {
                "projectId": projectId,
                "analysisJobId": null
            },
            "domains": null,
            "dimensions" : null,
            "metrics" : null,
            "selection" : null,
            "results" : null}
            );
            return this;
        },

        setDomainIds : function(domainIdList) {
            var domains;
            if (domainIdList) {
                domains = [];
                for (var i=0; i<domainIdList.length; i++) {
                    domains.push({
                        "projectId": this.get("id").projectId,
                        "domainId": domainIdList[i]
                    });
                }
                
            } else {
                domains = null;
            }
            this.set({"domains": domains,
                "dimensions": null,
                "metrics": null,
                "selection": null,
                "results" : null}
            );
            return this;
        },

        setDimensionIds : function(dimensionIdList) {
            var dims;
            if (dimensionIdList) {
                dims = [];
                for (var i=0; i<dimensionIdList.length; i++) {
                    dims.push({
                        "projectId": this.get("id").projectId,
                        "domainId": this.get("domains")[0].domainId,
                        "dimensionId": dimensionIdList[i]
                    });
                }
            } else {
                dims = null;
            }
            this.set("dimensions", dims);
            return this;
        },

        setDimensionId : function(dimensionId, index) {
            var dims = this.get("dimensions").slice(0) || [];
            index = index || 0;
            dims[index] = {
                "projectId": this.get("id").projectId,
                "domainId": this.get("domains")[0].domainId,
                "dimensionId": dimensionId
            };
            this.set("dimensions", dims);
            return this;
        },

        setMetricIds : function(metricIdList) {
            var metrics;
            if (metricIdList) {
                metrics = [];
                for (var i=0; i<metricIdList.length; i++) {
                    metrics.push({
                        "projectId": this.get("id").projectId,
                        "domainId": this.get("domains")[0].domainId,
                        "metricId": metricIdList[i]
                    });
                }
            } else {
                metrics = null;
            }
            this.set("metrics", metrics);
            return this;
        },
        
        setMetricId : function(metricId, index) {
            var items = this.get("metrics").slice(0) || [];
            index = index || 0;
            items[index] = {
                "projectId": this.get("id").projectId,
                "domainId": this.get("domains")[0].domainId,
                "metricId": metricId
            };
            this.set("metrics", items);
            return this;
        },
        
        setSelection : function(selection) {
            this.set("selection", selection);
            return this;
        },

        isDone : function() {
            return (this.get("status") == "DONE");
        }
    });

    squid_api.model.MultiAnalysisJob = Backbone.Model.extend({
        isDone : function() {
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
        createAnalysisJob: function(analysisModel, selection) {

            var observer = $.Deferred();

            analysisModel.set("status","RUNNING");

            // create a new AnalysisJob
            var projectAnalysisJob = new squid_api.model.ProjectAnalysisJob();
            var projectId;
            if (analysisModel.get("id").projectId) {
                projectId = analysisModel.get("id").projectId;
            } else {
                projectId = analysisModel.get("projectId");
            }
            projectAnalysisJob.set({"id" : {
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

            projectAnalysisJob.save({}, {
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
        compute: function(analysisJob, filters) {
            if (analysisJob.get("analyses")) {
                // compute a multi analysis
                this.computeMultiAnalysis(analysisJob, filters);
            } else {
                // compute a single analysis
                this.computeSingleAnalysis(analysisJob, filters);
            }
        },

        /**
         * retrieve the results.
         */
        getAnalysisJobResults: function(observer, analysisModel) {
            console.log("getAnalysisJobResults");
            var analysisJobResults = new squid_api.model.ProjectAnalysisJobResult();
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
                        var t = model.get("statistics");
                        if (t) {
                            console.log("AnalysisJob computation time : "+(t.endTime-t.startTime) + " ms");
                        }
                        // update the analysis Model
                        analysisModel.set("statistics", t);
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
         * Create (and execute) a new Single AnalysisJob, retrieve the results
         * and set the 'done' or 'error' attribute to true when all analysis are done or any failed.
         * @return Observer (Deferred)
         */
        computeSingleAnalysis: function(analysisJob, filters) {
            var selection, observer = $.Deferred();
               
            // compute a single analysis
            if (!filters) {
                selection =  analysisJob.get("selection");
                if (!selection) {
                    // use default filters
                    filters = squid_api.model.filters;
                    selection =  filters.get("selection");
                }
            } else {
                selection =  filters.get("selection");
            }
            
            this.createAnalysisJob(analysisJob, selection)
                .done(function(model, response) {
                    if (model.get("status") == "DONE") {
                        var t = model.get("statistics");
                        if (t) {
                            console.log("AnalysisJob computation time : "+(t.endTime-t.startTime) + " ms");
                        }
                        // update the analysis Model
                        analysisJob.set("statistics", t);
                        analysisJob.set("error", model.get("error"));
                        analysisJob.set("results", model.get("results"));
                        analysisJob.set("status", "DONE");
                        observer.resolve(model, response);
                    } else {
                        // try to get the results
                        controller.getAnalysisJobResults(observer, analysisJob);
                    }
                })
                .fail(function(model, response) {
                    observer.reject(model, response);
                });

            return observer;
        },

        /**
         * Create (and execute) a new MultiAnalysisJob, retrieve the results
         * and set the 'done' or 'error' attribute to true when all analysis are done or any failed.
         */
        computeMultiAnalysis: function(multiAnalysisModel, filters) {
            var me = this;
            multiAnalysisModel.set("status", "RUNNING");
            var analyses = multiAnalysisModel.get("analyses");
            var analysesCount = analyses.length;
            // build all jobs
            var jobs = [];
            for (var i=0; i<analysesCount; i++) {
                var analysisModel = analyses[i];
                jobs.push(this.computeSingleAnalysis(analysisModel, filters));
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
        
        // backward compatibility
        
        computeAnalysis: function(analysisJob, filters) {
            return this.compute(analysisJob, filters);
        },
        
        AnalysisModel: squid_api.model.AnalysisJob,
        
        MultiAnalysisModel: squid_api.model.MultiAnalysisJob
        

    };
    

    squid_api.controller.analysisjob = controller;
    return controller;
}));
