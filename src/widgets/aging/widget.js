(() => {
    /* PUBLIC */

    window.Widget = {
        load: (widgetSettings) => {
            var settings = getSettings(widgetSettings); 

            $('#title').text(settings.title);
            $('#sub-title').text(settings.type == '0' ? 'Overall' : settings.type == '1' ? 'State' : 'Board Column');

            getData(settings).then(data => {
                if (data.length > 0) {
                    prepareChart(data, settings.percentiles);
                }
            });

            return window.WidgetHelpers.WidgetStatusHelper.Success();
        }
    };

    /* PRIVATE */

    var getBoardColumnAges = (query) => {
        var deferred = $.Deferred();

        query.wiql = `select [System.Id], [System.BoardColumn], [System.ChangedDate] ${query.wiql.substring(query.wiql.toUpperCase().indexOf('FROM'))}`;

        window.AzureDevOpsProxy.getItemsFromQuery(query, true).then(items => {
            var ages = [];

            if (items.filter(item => item['System.BoardColumn'] !== undefined).length == 0) {
                $('#chart').hide();
                $('#message').show();
    
                $('#message').text('Couldn\'t find BoardColumn field on the query');

            } else {
                items.forEach(item => {
                    item.revisions.sort((a, b) => a.rev > b.rev ? -1 : a.rev < b.rev ? 1 : 0);

                    var hasRevisions = item.revisions.filter(revision => revision.fields['System.BoardColumn'] !== undefined).length > 0;

                    if (hasRevisions) {
                        var index = 0;
                        while (item.revisions[index].fields['System.BoardColumn'] == item['System.BoardColumn']) {
                            index++;
                        }

                        var endDate = new Date();
                        var startDate = new Date(item.revisions[index - 1].fields['System.ChangedDate']);
        
                        ages.push(Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
                    }

                    if (item.children !== undefined) {
                        item.children.forEach(child => {
                            child.revisions.sort((a, b) => a.rev > b.rev ? -1 : a.rev < b.rev ? 1 : 0);
            
                            var hasRevisions = child.revisions.filter(revision => revision.fields['System.BoardColumn'] !== undefined).length > 0;
            
                            if (hasRevisions) {
                                var index = 0;
                                while (child.revisions[index].fields['System.BoardColumn'] == child['System.BoardColumn']) {
                                    index++;
                                }
            
                                var endDate = new Date();
                                var startDate = new Date(child.revisions[index - 1].fields['System.ChangedDate']);
                
                                ages.push(Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));        
                            }
                        });
                    }
                });
            }

            deferred.resolve(ages);
        });

        return deferred.promise();
    };

    var getChartConfiguration = (data, percentiles) => {
        var config = {
            type: 'BarPercentile',
            data: {
                labels: data.map(d => d.age),
                datasets: [
                    {
                        label: "Items",
                        backgroundColor: "#79AEC8",
                        borderColor: "#417690",
                        data: data.map(d => d.items),
                        percentiles: percentiles != '' ? percentiles.split(',').map(percentile => parseInt(percentile, 10)) : []
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 3,
                scales: { y: { title: { text: 'Items', display: 'true' } }, x: { title: { text: 'Days', display: 'true' } } },
                plugins: {
                    title:  { display: false },
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        };

        return config;
    };

    var getData = (settings) => {
        var deferred = $.Deferred();

        window.AzureDevOpsProxy.getQueryWiql(settings.query, false).then(query => {
            var ages;
            
            if (settings.type == '0') {
                ages = getOverallAges(query);
                
            } else if (settings.type == '1') {
                ages = getStateAges(query);
                
            } else {
                ages = getBoardColumnAges(query);
            }

            ages.then(data => {
                var groups = data.reduce((a, c) => (a[c] = (a[c] || 0) + 1, a), Object.create(null));
                var min = Math.min(...data);
                var max = Math.max(...data);

                var items = [];
                for (var index = min; index <= max; index++) {
                    items.push({ age: index, items: groups[index] ?? 0 });
                }

                deferred.resolve(items);
            });
        });

        return deferred.promise();
    };

    var getOverallAges = (query) => {
        var deferred = $.Deferred();

        query.wiql = `select [System.Id], [System.CreatedDate], [Microsoft.VSTS.Common.ClosedDate] ${query.wiql.substring(query.wiql.toUpperCase().indexOf('FROM'))}`;

        window.AzureDevOpsProxy.getItemsFromQuery(query).then(items => {
            var ages = [];

            items.forEach(item => {
                var endDate = item['Microsoft.VSTS.Common.ClosedDate'] !== undefined && item['Microsoft.VSTS.Common.ClosedDate'] !== null && item['Microsoft.VSTS.Common.ClosedDate'] !== '' ? new Date(item['Microsoft.VSTS.Common.ClosedDate']) : new Date();
                var startDate = new Date(item['System.CreatedDate']);

                ages.push(Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));

                if (item.children !== undefined) {
                    item.children.forEach(child => {
                        var endDate = child['Microsoft.VSTS.Common.ClosedDate'] !== undefined && child['Microsoft.VSTS.Common.ClosedDate'] !== null && child['Microsoft.VSTS.Common.ClosedDate'] !== '' ? new Date(child['Microsoft.VSTS.Common.ClosedDate']) : new Date();
                        var startDate = new Date(child['System.CreatedDate']);
        
                        ages.push(Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
                    });
                }
            });

            deferred.resolve(ages);
        });

        return deferred.promise();
    };

    var getSettings = (widgetSettings) => {
        var settings = JSON.parse(widgetSettings.customSettings.data);

        return {
            title: settings?.title ?? 'Aging',
            type: settings?.type ?? '0',
            query: settings?.query ?? '',
            percentiles: settings?.percentiles ?? ''
        };
    };

    var getStateAges = (query) => {
        var deferred = $.Deferred();

        query.wiql = `select [System.Id], [Microsoft.VSTS.Common.StateChangeDate] ${query.wiql.substring(query.wiql.toUpperCase().indexOf('FROM'))}`;

        window.AzureDevOpsProxy.getItemsFromQuery(query).then(items => {
            var ages = [];

            items.forEach(item => {
                var endDate = new Date();
                var startDate = new Date(item['Microsoft.VSTS.Common.StateChangeDate']);

                ages.push(Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));

                if (item.children !== undefined) {
                    item.children.forEach(child => {
                        var endDate = new Date();
                        var startDate = new Date(child['Microsoft.VSTS.Common.StateChangeDate']);
        
                        ages.push(Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
                    });
                }
            });

            deferred.resolve(ages);
        });

        return deferred.promise();
    };

    var prepareChart = (data, percentiles) => {
        $('#chart').show();
        $('#message').hide();

        if (data.length == 0) {
            $('#chart').hide();
            $('#message').show();

            $('#message').text('There aren\'t data to show');
        }

        var chartArea = document.getElementById('chart');
        var chart = new Chart(chartArea, getChartConfiguration(data, percentiles));
    }; 
})();