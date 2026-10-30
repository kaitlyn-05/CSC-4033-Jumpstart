// Use the local Webpack proxy during development.
// Connect directly to Azure when the website is deployed.

const API_BASE_URL =
    window.location.hostname === "localhost"
        ? ""
        : "https://jumpstart-etgkghcvewhaeqf7.centralus-01.azurewebsites.net";

// Export the URL using CommonJS.
module.exports = API_BASE_URL;