(() => {
    /* PUBLIC */
    window.WidgetConfiguration = {
        init: (WidgetHelpers) => {
            widgetHelpers = WidgetHelpers;
        },

        load: (widgetSettings, widgetConfigurationContext) => {
            context = widgetConfigurationContext;

            var settings = getSettings(widgetSettings);
            prepareControls(settings);

            return widgetHelpers.WidgetStatusHelper.Success();
        },

        save: (widgetSettings) => {
            return widgetHelpers.WidgetConfigurationSave.Valid(getSettingsToSave());
        }
    };

    /* PRIVATE */
    var context;
    var widgetHelpers;

    var $title = $('#title');
    var $type = $('#type');
    var $query = $('#query');
    var $percentiles = $('#percentiles');

    var addQueryToSelect = (query, level) => {
        level = level ?? 0;

        if (query.isFolder ?? false) {
            $query.append($('<option>')
                .val(query.id)
                .html('&nbsp;&nbsp;'.repeat(level) + query.name)
                .attr('data-level', '0')
                .css('font-weight', 'bold')
                .attr('disabled', 'disabled'));

            if (query.children.length > 0)
            {
                query.children.forEach(innerQuery => {
                    addQueryToSelect(innerQuery, level + 1);
                });
            }

        } else {
            $query.append($('<option>')
                .val(query.id)
                .html('&nbsp;&nbsp;'.repeat(level) + query.name)
                .attr('data-level', level));
        }
    };

    var changeSettings = () => {
        settings = getSettingsToSave();

        var eventName = widgetHelpers.WidgetEvent.ConfigurationChange;
        var eventArgs = widgetHelpers.WidgetEvent.Args(settings);
        context.notify(eventName, eventArgs);
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

    var getSettingsToSave = () => {
        var percentiles = $percentiles
            .val()
            .split(',')
            .filter(p => !isNaN(parseInt(p, 10)))
            .join(',');

        return {
            data: JSON.stringify({
                title: $title.val(),
                type: $type.val(),
                query: $query.val(),
                percentiles: percentiles
            })
        };
    };

    var prepareControls = (settings) => {
        var deferred = $.Deferred();

        window.AzureDevOpsProxy.getSharedQueries().then(queries => {
            $query.append($('<option>'));

            queries.forEach(query => {
                addQueryToSelect(query);
            });

            $title.val(settings.title);
            $type.val(settings.type);
            $query.val(settings.query);
            $percentiles.val(settings.percentiles);

            $title.on('change', changeSettings);
            $type.on('change', changeSettings);
            $query.on('change', changeSettings);
            $percentiles.on('change', changeSettings);

            deferred.resolve();
        });

        return deferred.promise();
    };
})();