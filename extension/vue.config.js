const webpack = require('webpack')

module.exports = {
    devServer: {
        port: 9292,
        // note when using this flag: MUST SET CHROME FLAG
        // "Insecure origins treated as secure" with local URL
        https: true,
    },
    filenameHashing: true, // change to false to remove hashes from built components
    configureWebpack: {
        plugins: [
            new webpack.ProvidePlugin({
                $: 'jquery',
                jquery: 'jquery',
                'window.jQuery': 'jquery',
                jQuery: 'jquery'
            }),
            new webpack.ProvidePlugin({
                _: 'lodash',
                lodash: 'lodash',
                'window.lodash': 'lodash',
            }),
            new webpack.ProvidePlugin({
                moment: 'moment',
                'window.moment': 'moment',
            }),
        ]
    },
    publicPath: process.env.NODE_ENV === 'production'
        ? '/assets/pagescript/'
        : '/',
    productionSourceMap: false
}
