//uses webpack
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
//Webpack config for React frontend
module.exports = {
  mode: "development",
  entry: "./index.jsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
  },
  //loads babel to convert jsx into js 
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  //Resolve file extensions for imports (lets you import js files without extension)
  resolve: {
    extensions: [".js", ".jsx"],
  },
  //Plugins for HTML generation
  plugins: [
    new HtmlWebpackPlugin({
      template: "./index.html",
    }),
  ],
  //Webpack server config (temporary)
  devServer: {
    host: "localhost",
    port: 3000,
    open: true,
    static: {
      directory: path.resolve(__dirname, "dist"),
    },
  },
};
