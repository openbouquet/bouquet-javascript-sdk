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
                this.set({"metricList": metrics}, {"silent": silent});
            }
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
                        analysisModel.set("status", "DONE");
                        observer.reject(model, response);
                    } else {
                        console.log("createAnalysis success");
                        analysisModel.set("id", model.get("id"));
                        analysisModel.set("oid", model.get("id").analysisJobId);
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

            // get the results from API
            analysisJob.fetch({
                error: function (model, response) {
                    analysisModel.set("error", {message: response.statusText});
                    analysisModel.set("status", "DONE");
                    observer.reject(model, response);
                },
                success: function (model, response) {
                    if (model.get("status") && (model.get("status") != "DONE")) {
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
                            analysisJob.set("status", "DONE");
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
