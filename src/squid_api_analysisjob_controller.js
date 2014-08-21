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
                    console.log("createAnalysis success");
                    analysisModel.set("id", model.get("id"));
                    analysisModel.set("oid", model.get("id").analysisJobId);
                    observer.resolve(model, response);
                },
                error : function(model, response) {
                    console.log("createAnalysis error");
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
            var observer = $.Deferred();
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
            combinedPromise.done( function() {
                for (var i=0; i<analysesCount; i++) {
                    var analysis = analyses[i];
                    if (analysis.get("error")) {
                        multiAnalysisModel.set("error", analysis.get("error"));
                    }
                }
            });
            combinedPromise.always( function() {
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