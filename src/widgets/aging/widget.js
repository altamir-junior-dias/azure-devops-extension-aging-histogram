(() => {
    /* PUBLIC */

    window.Widget = {
        load: (widgetSettings) => {
            var settings = getSettings(widgetSettings); 

            $('#title').text(settings.title);
            $('#sub-title').text(settings.type == '0' ? 'Overall' : settings.type == '1' ? 'State' : 'Board Column');

            getData(settings).then(data => {
                prepareChart(data);
            });

            return window.WidgetHelpers.WidgetStatusHelper.Success();
        }
    };

    /* PRIVATE */

    var getBoardColumnAges = (wiql) => {
        var deferred = $.Deferred();

        var query = `select [System.Id], [System.BoardColumn], [System.ChangedDate] ${wiql.substring(wiql.toUpperCase().indexOf('FROM'))}`;

        window.AzureDevOpsProxy.getItems(query).then(items => {
            if (items.length > 0 && items[0].fields['System.BoardColumn'] === undefined) {
                $('#chart').hide();
                $('#message').show();
       
                $('#message').text('Couldn\'t find BoardColumn field on the query');
            }

            var deferreds = [];

            items.forEach(item => deferreds.push(window.AzureDevOpsProxy.getItemRevisions(item.id)));

            Promise.all(deferreds).then(itemsRevisions => {
                var allRevisions = [];

                itemsRevisions.forEach(item => {
                    item.forEach(revision => allRevisions.push(revision));
                });

                var ages = items.map(item => {
                    var revisions = allRevisions
                        .filter(revision => revision.id == item.id);

                    revisions.sort((a, b) => a.rev > b.rev ? -1 : a.rev < b.rev ? 1 : 0);

                    var index = 0;
                    while (revisions[index].fields['System.BoardColumn'] == item.fields['System.BoardColumn']) {
                        index++;
                    }

                    var endDate = new Date();
                    var startDate = new Date(revisions[index - 1].fields['System.ChangedDate']);
    
                    return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
                });

                deferred.resolve(ages);
            });
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
                        percentiles: percentiles.split(',').map(percentile => parseInt(percentile, 10))
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

        window.AzureDevOpsProxy.getQueryWiql(settings.query, false).then(wiql => {
            var ages;
            
            if (settings.type == '0') {
                ages = getOverallAges(wiql);
                
            } else if (settings.type == '1') {
                ages = getStateAges(wiql);
                
            } else {
                ages = getBoardColumnAges(wiql);
            }

            ages.then(data => {
                var groups = data.reduce((a, c) => (a[c] = (a[c] || 0) + 1, a), Object.create(null));
                var min = Math.min(...data);
                var max = Math.max(...data);

                var items = [];
                for (var index = min; index <= max; index++) {
                    items.push({ age: index, items: groups[index] ?? 0 });
                }

                prepareChart(items, settings.percentiles);
    
                deferred.resolve();
            });
        });

        return deferred.promise();
    };

    var getOverallAges = (wiql) => {
        var deferred = $.Deferred();

        var query = `select [System.Id], [System.CreatedDate], [Microsoft.VSTS.Common.ClosedDate] ${wiql.substring(wiql.toUpperCase().indexOf('FROM'))}`;

        window.AzureDevOpsProxy.getItems(query).then(items => {
            var ages = items.map(item => {
                var endDate = item.fields['Microsoft.VSTS.Common.ClosedDate'] !== undefined ? new Date(item.fields['Microsoft.VSTS.Common.ClosedDate']) : new Date();
                var startDate = new Date(item.fields['System.CreatedDate']);

                return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
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

    var getStateAges = (wiql) => {
        var deferred = $.Deferred();

        var query = `select [System.Id], [Microsoft.VSTS.Common.StateChangeDate] ${wiql.substring(wiql.toUpperCase().indexOf('FROM'))}`;

        window.AzureDevOpsProxy.getItems(query).then(items => {
            var ages = items.map(item => {
                var endDate = new Date();
                var startDate = new Date(item.fields['Microsoft.VSTS.Common.StateChangeDate']);

                return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
            });

            deferred.resolve(ages);
        });

        return deferred.promise();
    };

    var prepareChart = (data, percentiles) => {
        $('#chart').show();
        $('#message').hide();

        var chartArea = document.getElementById('chart');
        var chart = new Chart(chartArea, getChartConfiguration(data, percentiles));
    }; 
})();