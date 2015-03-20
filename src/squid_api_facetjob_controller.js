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
        urlRoot: function() {
            var id = this.get("id").facetJobId;
            return squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments) + "/facetjobs/" + (id ? id : "");
        },
        error: null,
        domains: null,
        timeoutMillis: function() { 
            return squid_api.timeoutMillis; 
        }
    });

    /**
     * ProjectFacetJobResult : get the ProjectFacetJob's computation results (a Selection).
     */
    squid_api.model.ProjectFacetJobResult = squid_api.model.ProjectFacetJob.extend({
        urlRoot: function() {
            return squid_api.model.ProjectFacetJob.prototype.urlRoot.apply(this, arguments) + "/results/";
        },
        error: null,
        timeoutMillis: function() { 
            return squid_api.timeoutMillis; 
        }
    });
    
    /**
     * ProjectFacetJobFacet : get the Members of a single Facet.
     */
    squid_api.model.ProjectFacetJobFacet = squid_api.model.ProjectFacetJobResult.extend({
        urlRoot: function() {
            return squid_api.model.ProjectFacetJobResult.prototype.urlRoot.apply(this, arguments) + this.get("oid");
        },
        error: null,
        timeoutMillis: function() { 
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

        initialize: function() {
            this.set("id", {
                "projectId": squid_api.projectId
            });
        },
        
        setProjectId : function(projectId) {
            this.set({"id": {
                "projectId": projectId
            },
            "domains": null,
            "selection" : null}
            );
            return this;
        },

        setDomainIds : function(domainIdList) {
            var domains;
            if (domainIdList) {
                domains = [];
                for (var i=0; i<domainIdList.length; i++) {
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
            } else {
                domains = null;
            }
            this.set({"domains" : domains});
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
        
        /*
         * Extract the selectedItem from the filters (in a more usable form).
         */
        getSelection : function() {
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
    });
    
    // Main Controller
    
    var controller = {

            fakeServer: null,
            
            /**
             * Streamline a selection (get rid of the facet items).
             */
            buildCleanSelection : function(selectionOpt) {
                var selection = {
                        "facets" : []
                };
                if (selectionOpt) {
                    var facets = selectionOpt.facets;
                    if (facets) {
                        for (var is = 0; is < facets.length; is++) {
                            var facet = facets[is];
                            var newFacet = {
                                    "selectedItems" : facet.selectedItems,
                                    "dimension" : facet.dimension,
                                    "id" : facet.id
                            };
                            selection.facets.push(newFacet);
                        }
                    }
                }
                return selection;
            },

            /**
             * Create (and execute) a new Job.
             */
            createJob: function(jobModel, selectionOpt, successCallback, dfd) {
                dfd = dfd || new $.Deferred();
                
                jobModel.set({"userSelection" :  null}, {"silent" : true});
                jobModel.set("status","RUNNING");

                // create a new Job
                
                if (!selectionOpt) {
                    selectionOpt =  jobModel.get("selection");
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
                    projectFacetJob.set("engineVersion",jobModel.get("engineVersion"));
                }

                projectFacetJob.set({"id" : {
                    projectId: projectId},
                    "domains" : jobModel.get("domains"),
                    "selection": selection});

                // save the job
                if (this.fakeServer) {
                    this.fakeServer.respond();
                }

                projectFacetJob.save({}, {
                    success : function(model, response) {
                        console.log("create job success");
                        if (successCallback) {
                            successCallback(model, jobModel, dfd);
                        } else {
                            dfd.resolve();
                        }
                    },
                    error: function(model, response) {
                        console.log("create job error");
                        jobModel.set("error", response);
                        jobModel.set("status", "DONE");
                        dfd.reject();
                    }

                });
                
                return dfd.promise();
            },

            jobCreationCallback : function(projectFacetJob, jobModel, dfd) {
                dfd = dfd || new $.Deferred();
                jobModel.set("id", projectFacetJob.get("id"));
                jobModel.set("oid", projectFacetJob.get("oid"));
                if (projectFacetJob.get("status") == "DONE") {
                    var t = projectFacetJob.get("statistics");
                    if (t) {
                        console.log("FacetJob computation time : "+(t.endTime-t.startTime) + " ms");
                    }
                    // update the Model
                    jobModel.set("statistics", t);
                    jobModel.set("error", projectFacetJob.get("error"));
                    if (projectFacetJob.get("results")) {
                    	var facets = projectFacetJob.get("results").facets;
                        jobModel.set("selection", {"facets" : facets});
                    }
                    jobModel.set("status", "DONE");
                    dfd.resolve();
                } else {
                    // try to get the results
                    controller.getJobResults(jobModel, dfd);
                }
                return dfd.promise();
            },

            /**
             * Create (and execute) a new Job, then retrieve the results.
             * @param jobModel a FiltersJob
             * @param selection an optional array of Facets
             */
            compute: function(jobModel, selection, dfd) {
                dfd = dfd || new $.Deferred();
                this.createJob(jobModel, selection, this.jobCreationCallback, dfd);
                return dfd.promise();
            },
            
            /**
             * Retrieve facet members and retry until it is fully loaded.
             */
            getFacetMembers: function(jobModel, facetId, startIndex, maxResults, delay, dfd) {
                dfd = dfd || new $.Deferred();
                startIndex = startIndex || 0;
                maxResults = maxResults || 100;
                if (delay) {
                    // retry with a delay
                    setTimeout(function() {
                        controller.getFacetMembers(jobModel, facetId, startIndex, maxResults, null, dfd);
                    }, delay);
                } else {
                    console.log("getting Facet : "+facetId);
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
                    facetJob.addParameter("waitComplete", true);
    
                    // get the results from API
                    facetJob.fetch({
                        error: function(model, response) {
                            jobModel.set("error", {message : response.statusText});
                            jobModel.set("status", "DONE");
                            dfd.reject();
                        },
                        success: function(model, response) {
                            if (model.get("apiError") && (model.get("apiError") == "COMPUTING_IN_PROGRESS")) {
                                // retry
                                controller.getFacetMembers(jobModel, facetId, startIndex, maxResults, 1000, dfd);
                            } else {
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
                                    dfd.resolve();
                                } else {
                                    // update the existing facet's items
                                    facet.items = model.get("items");
                                    if (model.get("done") === false) {
                                        // re-poll facet content
                                        controller.getFacetMembers(jobModel, facet.id, startIndex, maxResults, 1000, dfd);
                                    } else {
                                        dfd.resolve();
                                    }
                                }
                            }
                        }
                    });
                    if (this.fakeServer) {
                        this.fakeServer.respond();
                    }
                }
                return dfd.promise();
            },

            /**
             * retrieve the results.
             */
            getJobResults: function(jobModel, dfd) {
                dfd = dfd || new $.Deferred();
                var jobResults = new squid_api.model.ProjectFacetJobResult();
                jobResults.statusModel = squid_api.model.status;
                jobResults.set("id", jobModel.get("id"));
                jobResults.set("oid", jobModel.get("oid"));

                // get the results from API
                jobResults.fetch({
                    error: function(model, response) {
                        jobModel.set("error", {message : response.statusText});
                        jobModel.set("status", "DONE");
                        dfd.reject();
                    },
                    success: function(model, response) {
                        if (model.get("apiError") && (model.get("apiError") == "COMPUTING_IN_PROGRESS")) {
                            // retry
                            controller.getJobResults(jobModel);
                        } else {
                            var t = model.get("statistics");
                            if (t) {
                                console.log("FacetJob computation time : "+(t.endTime-t.startTime) + " ms");
                            }
                            // update the Model
                            jobModel.set("statistics", t);
                            jobModel.set("error", null);
                            jobModel.set("selection", {"facets" : model.get("facets")});
                            jobModel.set("status", "DONE");
                            dfd.resolve();
                        }
                    }
                });
                if (this.fakeServer) {
                    this.fakeServer.respond();
                }
                return dfd.promise();
            },

            // backward compatibility
            FiltersModel : squid_api.model.FiltersJob

    };

    squid_api.controller.facetjob = controller;
    return controller;
}));