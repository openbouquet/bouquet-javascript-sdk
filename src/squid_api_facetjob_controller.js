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
                    jobModel.set("selection", {"facets": facets});
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
         * Retrieve facet members and retry until it is fully loaded.
         */
        getFacetMembers: function (jobModel, facetId, startIndex, maxResults, delay, dfd) {
            dfd = dfd || new $.Deferred();
            startIndex = startIndex || 0;
            maxResults = maxResults || 100;
            if (delay) {
                // retry with a delay
                setTimeout(function () {
                    controller.getFacetMembers(jobModel, facetId, startIndex, maxResults, null, dfd);
                }, delay);
            } else {
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
                facetJob.addParameter("waitComplete", true);

                // get the results from API
                facetJob.fetch({
                    error: function (model, response) {
                        jobModel.set("error", {message: response.statusText});
                        jobModel.set("status", "DONE");
                        dfd.reject();
                    },
                    success: function (model, response) {
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
            var childDimension;
            var i = 0;
            if (includeSelf) {
                facet.selectedItems = [];
            }
            // treat children dimensions
            // build a facet map to retrieve parents by dimension id and not facet id
            var facetMap = {};
            for (i = 0; i < facets.length; i++) {
                facetMap[facets[i].dimension.oid] = facets[i];
            }
            // look for a child dimension
            for (i = 0; ((i < facets.length) && !childDimension); i++) {
                var facet1 = facets[i];
                if (facet1.dimension.parentId) {
                    if (facetMap[facet1.dimension.parentId.dimensionId].id === facet.id) {
                        childDimension = facet1;
                    }
                }
            }
            if (childDimension) {
                this.unSelectChildren(facets, childDimension, true);
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
                if ((memberId === null) || (memberId === selectedItems[ix].id)) {
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