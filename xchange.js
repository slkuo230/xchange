var Q = require('q');
var https = require('https');
var fs = require('fs');
var path = require('path');
var extend = require('extend');
var COUNTRIES = {
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
var BASE = 'USD';
var TABLE_PATH = path.join(process.cwd(),'./exchangeData.json');

function yapiRequest() {

    var deferred = Q.defer(), countries = [];

    for(var country in COUNTRIES) {
        countries.push('\"' + BASE + country + '\"');
    }

    var query = 'select * from yahoo.finance.xchange where pair in (' + countries.join(',') + ')';

    var options = {
        hostname: 'query.yahooapis.com',
        path: '/v1/public/yql?q=' + encodeURIComponent(query) + '&format=json&diagnostics=false&env=store://datatables.org/alltableswithkeys&callback=',
        method: 'GET'
    };

    var req = https.request(options, function(res) {

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
    }

    yapiRequest().then(function(rates) {
        conversionRate = rates[to].rate/rates[from].rate;
        deferred.resolve(conversionRate);
    });

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

function updateRates(data) {
    var data      = JSON.parse(data),
        countries = data.query.results.rate,
        _output    = extend({},COUNTRIES);

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
    return JSON.parse(fs.readFileSync(TABLE_PATH));
}

exports.getSymbol         = getSymbol;

exports.getConversionRate = getConversionRate;

exports.convert           = convert;

