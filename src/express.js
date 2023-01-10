var Q = require('q');
var env = require('./env.js');
var pkg = require('../package.json');
var path = require('path');
var express = require('express');
var helmet = require('helmet');
var nunjucks = require('nunjucks');
var crypto = require('crypto');
var morgan = require('morgan');
var compression = require('compression');
var finalhandler = require('finalhandler');
var serveFavicon = require('serve-favicon');
var colors = require('colors/safe');
var _ = require('lodash');
var fs = require('fs');
var { logger } = require('./logger.js');
var { router: statusRouter, getPacificTime} = require('./api/status.js');

var DEBUG = env('debug');
var ROOT_PATH = require('path').normalize( __dirname + '/..');
var BASE_PATH = ROOT_PATH;

var PasswordBackendService = require('./backend/password');
var passwordBackend = new PasswordBackendService();
var { connect: postgresConnect } = require('./data/postgres');

let CLIENT_PATH = BASE_PATH + '/client';
let DIST_PATH = BASE_PATH + '/dist';
let root = path.join(__dirname, '/../', 'build');

const googleAnalyticsUrl = 'https://www.google-analytics.com';
const webpackDevServer = 'http://localhost:8000';
const webpackDevServerSocket = 'ws://localhost:8000';
const reportToAge = 2592000; // 30 days

function render404 (req, res) {
  finalhandler(req, res)(false);
}

function validateHostname(hostName) {
  var validHosts = env('validHosts');
  if (validHosts) {
    return validHosts.indexOf(hostName) !== -1;
  }
  logger.error('The validHosts env variable is required');
  return false;
}

/**
 * loads sensitive parts of envar from pwservice
 *
 * @returns {Promise}
 */
async function loadEnvFromPwService() {

  // Do not fetch from PwService if there is no pwServiceKey.
  if (_.isEmpty(env('pwServiceAccessKeyPath'))) { return Promise.resolve(); }

  const databaseKey = env('databaseKey');
  const passwordServiceKeys = env('passwordServiceKeys');

  if (!databaseKey && !passwordServiceKeys) { return Promise.resolve(); }

  try {
    env.env('pwServiceAccessKey', _.trim(fs.readFileSync(env('pwServiceAccessKeyPath'))));
  } catch (e) {
    logger.error('Error loading password service access key, check your envs pwServiceAccessKeyPath\n', e);
  }

  const pwService = env('passwordService');
  const fetchFromPwService = databaseKey.concat(passwordServiceKeys);

  for (const key of fetchFromPwService) {
    // Get values sequentially
    const keyName = key.pwServiceKey;
    logger.info(`Fetching ${keyName} from ${pwService}`);
    try {
      const response = await passwordBackend.getPassword(keyName);
      env.env(key.envarKey, response.value);
    } catch (e) {
      const message = `Could not fetch '${keyName}' from PwService`;
      if (key.throwError) {
        // Only throw an error if specified.
        throw new Error(message);
      } else {
        logger.error(message + ', moving on...');
      }
    }
  }

  return;
}

function makeApp (opts={}) {
  const app = express();
  const prefixTokens = colors.white('[:now] ');
  const suffixTokens = colors.gray(' [:method] :url :ms :status');
  const httpStaticLogger = morgan(prefixTokens + `[${colors.green('http')}]       ` + suffixTokens);
  const httpDynamicLogger = morgan(prefixTokens + `[${colors.blue('http')}]       ` + suffixTokens);
  const debugLogger = morgan(prefixTokens + `[${colors.red('http')}]       ` + suffixTokens);

  // use the nunjucks HTML engine to render the nonce value for CSP.      
  app.set('view engine', 'mst');
  nunjucks.configure(root, {
    autoescape: true,
    express: app
  });


  if (!opts.testing) {
    // prevent host header attacks
    app.use(helmet());
    app.use(function(req, res, next) {
      if (!validateHostname(req.hostname)) {
        res.status(403).end();
      } else {
        next();
      }
    });
  }

  // Set cache-control header for all requests
  app.use(helmet.noCache());

  /**
   * Every request to the backend sets a new value of the 
   * csp-nonce for inline script and style tags. The value 
   * of the nonce must be base64 encoded and must follow the
   * 1*( ALPHA / DIGIT / "+" / "/" / "-" / "_" )*2( "=" ) format.
   * 
   * Also, sets the `Report-To` header for any reports from the browser.
   */
  app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');

    const hostname = DEBUG ? `${req.hostname}:${env('port')}` : req.hostname; // Account for localhost
    const reportUrl = `${req.protocol}://${hostname}/admin/v1/reports`;
    res.locals.reportUrl = reportUrl;
    res.set('Report-To', {
      'group': 'reports',
      'max_age': reportToAge,
      'endpoints': [{
        'url': reportUrl
      }]
    });

    next();
  });
  // Set the connect-src. We allow the google-analytics 
  // domain in production only. While we allow the webpack
  // devServer websockets in the debug environment only.
  const connectSrc = ["'self'"];
  if (DEBUG) { // debug environment
    connectSrc.push(webpackDevServer, webpackDevServerSocket, googleAnalyticsUrl);
  } else { // production environment
    connectSrc.push(googleAnalyticsUrl);
  }
  // Computed hashes for libraries which do not have a way to set nonce.
  // This is an alternative way to allow the library to use in line style.
  // https://quantifind.atlassian.net/browse/FE-6037
  const libraryInLineStyleHashes = [
    "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
    "'sha256-tRaEJyEFz5xZqYDnbBz871uEyenL6zb2tN4sPO6VsQo='",
  ];
  // Set the `Content-Security-Policy` header which helps 
  // mitigate cross-site scripting attacks. 
  app.use(helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'base-uri': ["'self'"],
      'script-src': [(req, res) => `'nonce-${res.locals.nonce}'`, "'strict-dynamic'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'self'"],
      'style-src': [(req, res) => `'nonce-${res.locals.nonce}'`, ...libraryInLineStyleHashes],
      'img-src': ["'self'", 'https:', 'http:', 'data:'],
      'connect-src': connectSrc,
      'form-action': ["'self'"],
      'report-uri': (req, res) => res.locals.reportUrl, // Will be ignored in browsers that use CSP Level 3
      'report-to': "reports" // eslint-disable-line quotes
    }
  }));

  let favExists = false;
  let favPath = path.join(root, 'favicon.png');

  app.use('/favicon.png', (req, resp, next) => {
    favExists = favExists || fs.existsSync(favPath);

    // Only serve favicon if it exists otherwise 404
    if (favExists) {
      const middleware = serveFavicon(favPath);
      return middleware(req, resp, next);
    } else {
      resp.status(404).end();
    }
  });
  app.use(compression());

  // re-route font path, make it work with qomponent setup
  app.use('/client/elements/qf-font-proxima', [
    httpStaticLogger,
    express.static(BASE_PATH + '/node_modules/qomponents/client/elements/qf-font-proxima'),
    render404
  ]);

  // serve own static assets
  app.use('/client', [
    httpStaticLogger,
    express.static(CLIENT_PATH),
    render404
  ]);

  app.use('/dist', [
    httpStaticLogger,
    express.static(DIST_PATH),
    render404
  ]);

  app.use('/lib', [
    httpStaticLogger,
    express.static(BASE_PATH + '/lib'),
    render404
  ]);

  app.get('/robots.txt', [
    httpStaticLogger,
    function (req, res) {
      res.type('text/plain');
      res.send('User-agent: *\nDisallow: /');
    }
  ]);

  if (DEBUG) {
    app.use('/test/wct', [
      debugLogger,
      express.static(ROOT_PATH + '/test/wct'),
      render404
    ]);
  }

  // function to setup the API, need to wait for db connection
  function setupApi() {
    app.use('/admin', [
      httpDynamicLogger,
      statusRouter,
      render404
    ]);

    app.use('/api', [
      httpDynamicLogger,
      require('./api/index.js'),
      render404
    ]);

    // dynamically render the csp-nonce in the HTML.
    // We are deliberately using the `.mst` files so as
    // to separate them out from other static files which
    // are served by express.static.
    app.use('/unsupported.mst', [
      httpStaticLogger,
      (req, res) => {
        res.render('unsupported.mst', { cspNonce: res.locals.nonce });
      }
    ]);

    app.all('*', [
      httpStaticLogger,
      express.static(root),
      (req, res) => {
        res.render('index.mst', { cspNonce: res.locals.nonce });
      }
    ]);
  }

  return Q.all([Q.resolve(app), postgresConnect()])
            .then((results) => {
              if (opts.ensureDb) {
                // ensure permission/groups exist
                require('../ops/ensureDb.js').syncPermissions();
              }            
              setupApi();
              return results;
            });
}


module.exports = {
  appPromise: function (opts) {
    logger.info(colors.underline(pkg.name) + ' v' + pkg.version + ' starting up...');
    logger.info('serving from '+BASE_PATH);
    return loadEnvFromPwService().then(() => {
      return Q.when(makeApp(opts));
    });
  },
  loadEnvFromPwService
};

morgan.token('ms', function (req, res){
  if (!res._header || !req._startAt) { return ''; }
  var diff = process.hrtime(req._startAt);
  var ms = diff[0] * 1000 + diff[1] * 0.001 * 0.001;
  return Math.ceil(ms)+'ms';
});

morgan.token('now', function () {
  return getPacificTime();
});

