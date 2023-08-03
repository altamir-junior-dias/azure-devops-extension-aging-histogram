(() => {
    /* PUBLIC */
    window.AzureDevOpsProxy = {
        getCurrentIterarion: (skip) => {
            var deferred = $.Deferred();
    
            var webContext = VSS.getWebContext();
            var teamContext = { projectId: webContext.project.id, teamId: webContext.team.id, project: "", team: "" };
    
            tfsWebAPIClient.getTeamIterations(teamContext, "current").then((items) => {
                var iterations = items.map(i => { 
                    return { 
                        id: i.id, 
                        name: i.name, 
                        path: i.path, 
                        startDate: i.attributes.startDate, 
                        endDate: i.attributes.finishDate 
                    }; 
                });
    
                if (skip === undefined) {
                    deferred.resolve(iterations[0]);
                } else {
                    var currentIteration = iterations[0];
    
                    window.AzureDevOpsProxy.getIterations().then(iterations => {
                        var orderedIterations = iterations.sort((a, b) => { return a.startDate > a.endDate ? 1 : 1; });
    
                        var index = orderedIterations.findIndex(interation => interation.id == currentIteration.id) + skip;
    
                        if (index < 0) {
                            deferred.resolve(iterations[0]);
                        } else if (index > iterations.length - 1) {
                            deferred.resolve(iterations[iterations.length -1]);
                        } else {
                            deferred.resolve(iterations[index]);
                        }
                    });
                }
            });
    
            return deferred.promise();
        },

        getCurrentUser: () => { 
            return VSS.getWebContext().user;
        },

        getExtensionData: (data, defaultValue) => {
            var deferred = $.Deferred();

            extensionDataService.getValue(data)
                .then((value) => {
                    deferred.resolve(value ?? defaultValue);
                },
                () => {
                    deferred.resolve(defaultValue);
                });

            return deferred.promise();
        },

        getItems: (query, asOf) => {
            var deferred = $.Deferred();
    
            var projectId = VSS.getWebContext().project.id;
            witClient.queryByWiql({ query: getCleanedQuery(query, asOf) }, projectId).then((result) => {
                let ids = result.workItems.map(r => r.id);
    
                if (ids.length > 0) {
                    getWorkItemsById(ids, getQueryFields(query), asOf).then((workItems) => deferred.resolve(workItems));
                } else {
                    deferred.resolve([]);
                }
            });
    
            return deferred.promise();
        },

        getItemRevisions: (id) => {
            var deferred = $.Deferred();

            witClient.getRevisions(id).then(revisions => deferred.resolve(revisions));

            return deferred.promise();
        },
        
        getIteration: (iteration) => {
            var deferred = $.Deferred();
    
            var webContext = VSS.getWebContext();
            var teamContext = { projectId: webContext.project.id, teamId: webContext.team.id, project: "", team: "" };
    
            tfsWebAPIClient.getTeamIteration(teamContext, iteration).then(data => {
                deferred.resolve({ 
                    id: data.id, 
                    name: data.name, 
                    path: data.path, 
                    startDate: data.attributes.startDate, 
                    endDate: data.attributes.finishDate 
                });    
            });
    
            return deferred.promise();
        },

        getIterations: () => {
            let deferred = $.Deferred();
    
            var webContext = VSS.getWebContext();
            var teamContext = { projectId: webContext.project.id, teamId: webContext.team.id, project: "", team: "" };
    
            tfsWebAPIClient.getTeamIterations(teamContext).then((items) => {
                var iterations = items.map(i => { 
                    return { 
                        id: i.id, 
                        name: i.name, 
                        path: i.path, 
                        startDate: i.attributes.startDate, 
                        endDate: i.attributes.finishDate 
                    }; 
                });
    
                deferred.resolve(iterations);
            });
    
            return deferred.promise();
        },
    
        getParentChildren: (query, getChildRevisions) => {
            var deferred = $.Deferred();
    
            var projectId = VSS.getWebContext().project.id;
    
            witClient.queryByWiql({ query: getCleanedQuery(query) }, projectId).then((queryResult) => {
                var sources = queryResult.workItemRelations.filter(r => r.source != null).map(r => r.source.id)
                var targets = queryResult.workItemRelations.map(r => r.target.id);
    
                var uniqueSources = sources.filter(function (value, index, self) { return self.indexOf(value) === index; });
                var uniqueTargets = targets.filter(function (value, index, self) { return self.indexOf(value) === index; });
    
                var ids = uniqueSources.concat(uniqueTargets);
    
                var deferreds = [];
    
                deferreds.push(getWorkItemsById(ids, getQueryFields(query)));

                if (getChildRevisions) {
                    deferreds.push(getRevisionsFromItems(ids));
                }
    
                Promise.all(deferreds).then(result => {
                    var workItems = result[0];
    
                    var parents = queryResult.workItemRelations
                        .filter(r => r.source == null)
                        .map(r => {
                            var parent = workItems.find(wi => wi.id == r.target.id).fields;
    
                            parent.id = r.target.id;
                            parent.children = queryResult.workItemRelations
                                .filter(s => s.source != null && s.source.id == r.target.id)
                                .map(s => {
                                    var child = workItems.find(wi => wi.id == s.target.id).fields;
                                    child.id = s.target.id;
    
                                    if (getChildRevisions) {
                                        child.revisions = result[1].filter(r => r.id == child.id);
                                    }
    
                                    return child; 
                                });
    
                            return parent;
                        });
        
                    deferred.resolve(parents);
                });
            });
    
            return deferred.promise();
        },

        getQuery: (queryPath) => {
            var deferred = $.Deferred();
            var webContext = VSS.getWebContext();
    
            var sendResult = (deferred, result) => {
                result.children.sort((a, b) => {
                    var result = a.isFolder && !b.isFolder ? -1 : !a.isFolder && b.isFolder ? 1 : 0;
    
                    if (result == 0) {
                        result = a.path > b.path ? 1 : a.path < b.path ? -1 : 0;
                    }
    
                    return result;
                });
    
                deferred.resolve(result);
            };
    
            witRestClient.getQuery(webContext.project.id, queryPath, 'all', 1).then(function (query) {
                var children = query.children ?? [];
                var childrenQueries = children.filter(query => !(query.hasChildren ?? false));
                var childrenFolders = children.filter(query => query.hasChildren ?? false);

                var result = {
                    id: query.id,
                    name: query.name,
                    path: query.path,
                    isFolder: query.isFolder ?? false,
                    children: childrenQueries.map(childQuery => {
                        return {
                            id: childQuery.id,
                            name: childQuery.name,
                            path: childQuery.path,
                            isFolder: childQuery.isFolder ?? false,
                            children: []
                        };
                    })
                };

                if (childrenFolders.length > 0) {
                    var deferreds = [];

                    childrenFolders.forEach(child => deferreds.push(window.AzureDevOpsProxy.getQuery(child.path)));

                    Promise.all(deferreds).then(queries => {
                        queries.forEach(childQuery => {
                            result.children.push({
                                id: query.id,
                                name: childQuery.name,
                                path: childQuery.path,
                                isFolder: childQuery.isFolder ?? false,
                                children: childQuery.children
                            });
                        });

                        sendResult(deferred, result);
                    });

                } else {

                    sendResult(deferred, result);
                }
            });
    
            return deferred.promise();
        },

        getQueryWiql: (queryId) => {
            var deferred = $.Deferred();
            var webContext = VSS.getWebContext();

            witRestClient.getQuery(webContext.project.id, queryId, 'all', 1).then(function (query) {
                deferred.resolve(query.wiql);
            });

            return deferred.promise();
        },

        getSharedQueries: () => {
            var deferred = $.Deferred();

            window.AzureDevOpsProxy.getQuery('Shared Queries').then(function (query) {
                deferred.resolve(query.children);
            });

            return deferred.promise();
        },

        getWorkItemType : (referenceName) => {
            var deferred = $.Deferred();
    
            var webContext = VSS.getWebContext();
            witClient.getWorkItemType(webContext.project.id, referenceName).then(item => {
                deferred.resolve({
                    referenceName: item.referenceName,
                    name: item.name
                });
            });
    
            return deferred.promise();
        },

        getWorkItemTypeFields : (referenceName) => {
            var deferred = $.Deferred();
    
            var webContext = VSS.getWebContext();
            witClient.getWorkItemType(webContext.project.id, referenceName).then(wotkItemType => {
                var fields = wotkItemType.fields.map(field => {
                    return {
                        referenceName: field.referenceName,
                        name: field.name,
                        type: getFieldType(field.referenceName)
                    };
                });

                deferred.resolve(fields);
            });
    
            return deferred.promise();
        },

        getWorkItemTypes: () => {
            var deferred = $.Deferred();
    
            var webContext = VSS.getWebContext();
            witClient.getWorkItemTypes(webContext.project.id).then(items => {
                var workItemType = items.map(item => {
                    return {
                        referenceName: item.referenceName,
                        name: item.name
                    };
                });
    
                deferred.resolve(workItemType);
            });
    
            return deferred.promise();
        },

        init: (VSSService, TFSWorkItemTrackingRestClient, TFSWorkRestClient, ExtensionDataService) => {
            witClient = VSSService?.getCollectionClient(TFSWorkItemTrackingRestClient.WorkItemTrackingHttpClient);
            witRestClient = TFSWorkItemTrackingRestClient.getClient();
            tfsWebAPIClient = TFSWorkRestClient?.getClient();
            extensionDataService = ExtensionDataService;

            var webContext = VSS.getWebContext();
            witClient?.getWorkItemFields(webContext.project.id).then(fields => {
                projectFields = fields.map(field => {
                    return {
                        referenceName: field.referenceName,
                        type: field.type
                    };
                });
            });
        },

        saveExtensionData: (data, value) => {
            var deferred = $.Deferred();

            extensionDataService.setValue(data, value).then(() => {
                deferred.resolve();
            });

            return deferred.promise();
        }
    };

    /* PRIVATE */
    var witClient;
    var witRestClient;
    var tfsWebAPIClient;
    var extensionDataService;

    var projectFields;

    var getCleanedQuery = (query, asOf) => {
        let queryFields = query
            .substring(query.toUpperCase().indexOf("SELECT") + 7, query.toUpperCase().indexOf("FROM"))
            .trim();

        let cleanedQuery = query
            .replace(queryFields, '[System.Id]');

        if (asOf !== undefined && asOf != null)
        {
            cleanedQuery += 'ASOF \'' + asOf.toISOString().split('T')[0] + '\'';
        }

        return cleanedQuery;
    };

    var getQueryFields = (query) => {
        var queryFields = query
            .substring(query.toUpperCase().indexOf("SELECT") + 7, query.toUpperCase().indexOf("FROM"))
            .trim();

        var fields = queryFields
            .toUpperCase()
            .replace('[SYSTEM.ID]', '')
            .trim()
            .split(',')
            .filter(f => f != '')
            .map(f => f.replace('[', '').replace(']', '').trim());

        return fields;
    };

    var getRevisionsFromItem = (id) => {
        let deferred = $.Deferred();

        witClient.getRevisions(id).then(revisions => {
            deferred.resolve(revisions);
        });

        return deferred.promise();
    };

    var getRevisionsFromItems = (ids) => {
        var deferred = $.Deferred();

        var deferreds = [];

        ids.forEach(id => deferreds.push(getRevisionsFromItem(id)));

        Promise.all(deferreds).then(result => {
            deferred.resolve([].concat.apply([], result));
        });

        return deferred.promise();
    };

    var getWorkItemsById = (ids, fields) => {
        var deferred = $.Deferred();

        let deferreds = [];

        for(let i = 0; i < ids.length; i += 50)
        {
            let pack = ids.slice(i, i + 50);

            deferreds.push(witClient.getWorkItems(pack, fields));
        }

        Promise.all(deferreds).then(result => {
            deferred.resolve([].concat.apply([], result));
        });

        return deferred.promise();
    };

    var getFieldType = (referenceName) => {
        return projectFields.find(field => field.referenceName == referenceName)?.type;
    };
})();
