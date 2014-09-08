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