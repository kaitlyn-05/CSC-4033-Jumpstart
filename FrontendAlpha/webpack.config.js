
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

// Webpack configuration for the React frontend
module.exports = {
  mode: "development",
  entry: "./index.jsx",

  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
  },

  // Loads Babel to convert JSX into JavaScript
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              "@babel/preset-env",
              ["@babel/preset-react", { runtime: "classic" }],
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },

  // Allows imports without specifying .js or .jsx
  resolve: {
    extensions: [".js", ".jsx"],
  },

  // Generates the HTML file
  plugins: [
    new HtmlWebpackPlugin({
      template: "./index.html",
    }),
  ],

  // Webpack development server
  devServer: {
    host: "localhost",
    port: 3000,
    open: true,

    // Serves generated frontend files
    static: {
      directory: path.resolve(__dirname, "dist"),
    },

    // Sends API requests to the Express backend
    proxy: [
      {
        context: ["/api"],
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    ],
  },
};
