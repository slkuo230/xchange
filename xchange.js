var Q = require('q'),
    https = require('https'),
    fs = require('fs'),
    path = require('path'),
    extend = require('extend'),
    COUNTRIES = {
        "AUD": { "symbol":"$" },
        "CAD": { "symbol":"$" },
        "CNY": { "symbol":"元" },
        "EUR": { "symbol":"€" },
        "INR": { "symbol":"₹" },
        "KRW": { "symbol":"₩" },
        "JPY": { "symbol":"¥" },
        "TWD": { "symbol":"NT$" },
        "USD": { "symbol":"$" }
    }
    BASE = 'USD',
    TABLE_PATH = path.join(process.cwd(),'./exchangeData.json');

function yapiRequest() {

    var deferred = Q.defer(), countries = [], query, options, req;

    for(var country in COUNTRIES) {
        countries.push('\"' + BASE + country + '\"');
    }

    query = 'select * from yahoo.finance.xchange where pair in (' + countries.join(',') + ')';

    options = {
        hostname: 'query.yahooapis.com',
        path: '/v1/public/yql?q=' + encodeURIComponent(query) + '&format=json&diagnostics=false&env=store://datatables.org/alltableswithkeys&callback=',
        method: 'GET'
    };

    req = https.request(options, function(res) {

      if(res.statusCode !== 200)
        deferred.reject(new Error('request failed with status code: ' + res.statusCode));

      res.on('data', function(data) {
        var output = updateRates(data);
        writeFile(output).then(function() {
            deferred.resolve(updateRates(data));
        }, function() {
            deferred.reject(new Error('Error writing to ' + TABLE_PATH));
        });
      });

    });

    req.end();

    req.on('error', function(e) {
      deferred.reject(e);
    });

    return deferred.promise;

}

function getConversionRate(from,to,useStatic) {

    var deferred = Q.defer(), rates, conversionRate;

    if(useStatic) {
        rates = readFile();
        conversionRate = rates[to].rate/rates[from].rate;
        deferred.resolve(conversionRate);
    } else {
        yapiRequest().then(function(rates) {
            conversionRate = rates[to].rate/rates[from].rate;
            deferred.resolve(conversionRate);
        });
    }
    return deferred.promise;
}

function convert(amount,from,to,useStatic) {

    var deferred = Q.defer();

    getConversionRate(from,to,useStatic).then(function(conversionRate) {
        deferred.resolve(amount * conversionRate);
    });

    return deferred.promise;
}

function getSymbol(country) {
    return COUNTRIES[country]['symbol'];
}

function getListCountries() {
    return Object.keys(COUNTRIES);
}

function getListSymbols() {
    return COUNTRIES;
}

function updateRates(data) {
    var data      = JSON.parse(data),
        countries = data.query.results.rate,
        _output   = extend({},COUNTRIES);

    countries.forEach(function(country) {
        var geoCode = country.id.replace(BASE,'');
        _output[geoCode]['rate'] = parseFloat(country.Rate);
    });

    return _output;
}

function writeFile(data) {
    var deferred = Q.defer();
    fs.writeFile(TABLE_PATH,JSON.stringify(data),deferred.resolve);
    return deferred.promise;
}

function readFile() {
    if(fs.existsSync(TABLE_PATH))
        return JSON.parse(fs.readFileSync(TABLE_PATH));
    return {};
}

exports.getSymbol         = getSymbol;

exports.getConversionRate = getConversionRate;

exports.getListCountries  = getListCountries;

exports.getListSymbols    = getListSymbols;

exports.convert           = convert;

