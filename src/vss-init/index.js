(() => {
    /* PUBLIC */
    window.initializeWidget = (widgetName, widgetFile) => {
        appendScript('lib/chart.min.js').onload = () => {
            appendScript('lib/VSS.SDK.min.js').onload = () => {
                class BarPercentileChart extends Chart.BarController {
                    draw() {
                        super.draw(arguments);

                        if (this.getMeta().controller.getDataset().percentiles != undefined)
                        {
                            this.getMeta().controller.getDataset().percentiles.forEach(percentile => 
                            {
                                var total = this.getMeta().data.reduce((previous, current) => previous + current.$context.raw, 0);
                                var ranking = Math.floor((percentile / 100) * total, 0);
                                var index = 0;
                                var total = 0;
        
                                while (index < this.getMeta().data.length)
                                {
                                    total += this.getMeta().data[index].$context.raw;
        
                                    if (total >= ranking)
                                    {
                                        break;
                                    }
        
                                    index++;
                                }
        
                                var point = this.getMeta().data[index];
        
                                this.chart.ctx.beginPath();
                                this.chart.ctx.moveTo(point.x, this.chart.chartArea.top + 24);
                                this.chart.ctx.strokeStyle = '#ff0000';
                                this.chart.ctx.lineWidth = 2;
                                this.chart.ctx.lineTo(point.x, this.chart.chartArea.bottom);
                                this.chart.ctx.stroke();
        
                                this.chart.ctx.fillStyle = '#ff0000';
                                this.chart.ctx.textAlign = 'center';
                                this.chart.ctx.fillText(percentile + '%', point.x, this.chart.chartArea.top + 12);
                            });
                        }
                    }
                }
                BarPercentileChart.id = 'BarPercentile';
                BarPercentileChart.defaults = Chart.BarController.defaults;
                Chart.register(BarPercentileChart);

                VSS.init({                        
                    explicitNotifyLoaded: true,
                    usePlatformStyles: true
                });
        
                VSS.require([
                    'TFS/Dashboards/WidgetHelpers', 
                    'VSS/Service', 
                    'TFS/WorkItemTracking/RestClient',
                    'TFS/Work/RestClient',
                    'Charts/Services',
                    'core-azure-devops-proxy.js',
                    widgetFile + '.js'
                ], function (WidgetHelpers, VSSService, TFSWorkItemTrackingRestClient, TFSWorkRestClient, ChartsService) {
                    window.AzureDevOpsProxy.init(VSSService, TFSWorkItemTrackingRestClient, TFSWorkRestClient);
                    window.WidgetHelpers = WidgetHelpers;
                    window.ChartsService = ChartsService.ChartsService;
        
                    WidgetHelpers.IncludeWidgetStyles();
                
                    VSS.register(widgetName, () => {
                        return window.Widget;
                    });
                
                    VSS.notifyLoadSucceeded();
                });
            };
        };
    };

    window.initializeWidgetConfiguration = (widgetConfigurationName, widgetConfigurationFile) => {
        appendScript('lib/VSS.SDK.min.js').onload = () => {
            VSS.init({
                explicitNotifyLoaded: true,
                usePlatformStyles: true
            });
    
            VSS.require([
                'TFS/Dashboards/WidgetHelpers', 
                'VSS/Service', 
                'TFS/WorkItemTracking/RestClient',
                'TFS/Work/RestClient',
                'core-azure-devops-proxy.js',
                widgetConfigurationFile + '.js'
            ], (WidgetHelpers, VSSService, TFSWorkItemTrackingRestClient, TFSWorkRestClient) => {
                WidgetHelpers.IncludeWidgetConfigurationStyles();

                VSS.register(widgetConfigurationName, () => {
                    window.AzureDevOpsProxy.init(VSSService, TFSWorkItemTrackingRestClient, TFSWorkRestClient);
                    window.WidgetConfiguration.init(WidgetHelpers);

                    return {
                        load: window.WidgetConfiguration.load,
                        onSave: window.WidgetConfiguration.save
                    }
                });

                VSS.notifyLoadSucceeded();
            });
        };
    };

    window.initializeHub = (hubFile) => {
        appendStyle('https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css');

        appendScript('https://cdn.jsdelivr.net/npm/toastify-js').onload = () => {    
            appendScript('lib/VSS.SDK.min.js').onload = () => {    
                VSS.init({                        
                    usePlatformScripts: true,
                    usePlatformStyles: false
                });

                VSS.ready(() => {
                    VSS.require([
                        hubFile,
                        'core-azure-devops-proxy.js'
                    ], () => {
                        VSS.getService(VSS.ServiceIds.ExtensionData).then((dataService) => {
                            var proxy = typeof window.AzureDevOpsProxy === 'object' ? window.AzureDevOpsProxy : null;
                            proxy.init(null, null, null, dataService);

                            var hub = typeof window['Hub'] === 'object' ? window.Hub : null;

                            hub.init(proxy);
                            hub.load();

                            VSS.notifyLoadSucceeded();
                        });
                    });
                });
            };
        };
    };

    /* PRIVATE */
    var appendScript = (scriptSource) => {
        var scriptTag = document.createElement('script');
        scriptTag.src = scriptSource;
        document.head.appendChild(scriptTag);

        return scriptTag;
    };
    
    var appendStyle = (styleSource) => {
        var styleTag = document.createElement('link');
        styleTag.rel = 'stylesheet'
        styleTag.type = 'text/css';
        styleTag.href = styleSource;
        styleTag.media = 'all';
        document.head.appendChild(styleTag);
    };
})();