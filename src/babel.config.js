module.exports = {
  'presets': [
    [
      '@babel/preset-env',{
        'targets': {
          'node': 'current'
        }
      }
    ],
    '@babel/preset-react'
  ],
  'plugins': [
    '@babel/plugin-proposal-throw-expressions',
    'lodash',
    [
      'import', {
        'libraryName': '@material-ui/core',
        'libraryDirectory': 'esm',
        'camel2DashComponentName': false  // default: true
      }, 
      '@material-ui/core'
    ],
    [
      'import',
      {
        'libraryName': '@material-ui/icons',
        'libraryDirectory': 'esm',
        'camel2DashComponentName': false
      },
      '@material-ui/icons'
    ]
  ]
};

