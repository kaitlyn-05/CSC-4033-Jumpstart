
const { ApplicationInsights } = require("@microsoft/applicationinsights-web");

const connectionString =
    process.env.VITE_APPLICATIONINSIGHTS_CONNECTION_STRING;

let appInsights = null;

if (connectionString) {
    appInsights = new ApplicationInsights({
        config: {
            connectionString,
            enableAutoRouteTracking: true
        }
    });

    appInsights.loadAppInsights();
}

module.exports = appInsights;
