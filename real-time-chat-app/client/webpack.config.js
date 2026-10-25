
const HtmlWebPackPlugin = require("html-webpack-plugin");
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");

const deps = require("./package.json").dependencies;

module.exports = {
  mode: "development",

  entry: "./src/index.js",

  output: {
    publicPath: "auto",
    clean: true,
  },

  resolve: {
    extensions: [".jsx", ".js", ".json"],
  },

  devServer: {
  port: 8080,

  headers: {
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
  },

  allowedHosts: "all",
  hot: false,
  liveReload: false,
  historyApiFallback: true,
},

  module: {
    rules: [
      {
        test: /\.m?js$/,
        type: "javascript/auto",
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              "@babel/preset-env",
              "@babel/preset-react",
            ],
          },
        },
      },
    ],
  },

  plugins: [
    new ModuleFederationPlugin({
      name: "chat",
      filename: "remoteEntry.js",

      exposes: {
        "./Chat": "./src/Chat.jsx",
      },

      shared: {
        ...deps,
        react: {
          singleton: true,
          requiredVersion: deps.react,
        },
        "react-dom": {
          singleton: true,
          requiredVersion: deps["react-dom"],
        },
      },
    }),

    new HtmlWebPackPlugin({
      template: "./src/index.html",
    }),
  ],
};
