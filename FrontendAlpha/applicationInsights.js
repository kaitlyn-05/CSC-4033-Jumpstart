
const { ApplicationInsights } = require("@microsoft/applicationinsights-web");

const connectionString =
    process.env.VITE_APPLICATIONINSIGHTS_CONNECTION_STRING;
console.log(
    "Application Insights configured:",
    Boolean(connectionString)
);
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
