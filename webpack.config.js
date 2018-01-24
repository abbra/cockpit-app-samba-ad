var copy = require("copy-webpack-plugin");
var extract = require("extract-text-webpack-plugin");

module.exports = {
    entry: "./samba-ad.jsx",
    resolve: {
        alias: {
            "react": "react-lite-cockpit"
        },
        modules: [ "lib", "node_modules" ]
    },
    externals: [
        "cockpit"
    ],
    output: {
        filename: 'dist/samba-ad.js'
    },
    plugins: [
        new extract("dist/samba-ad.css"),
        new copy(
            [
                { from: "index.html", to: "dist/" },
                { from: "logo.png", to: "dist/" },
                { from: "logo-big.png", to: "dist/" },
                { from: "manifest.json", to: "dist/" },
                { from: "samba-ad-check-install", to: "dist/" }
            ]
        )
    ],
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                enforce: 'pre',
                loader: 'eslint-loader'
            },
            {
                test: /\.(js|jsx)$/,
                loader: 'babel-loader',
                options:
                {
                    presets: ['es2015', 'react']
                }
            },
            {
                test: /\.css$/,
                loader: extract.extract("css-loader")
            }
        ]
    }
};
