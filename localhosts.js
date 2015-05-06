var http = require('http');
var httpProxy = require('http-proxy');
var fs = require('fs');
var LineByLineReader = require('line-by-line');
var express = require('express');

var proxy = httpProxy.createProxyServer({});

var targets = {};

var server = http.createServer(function (req, res) {
  var target = targets[req.headers.host];

  if (target) {
    target(req, res);
  } else {
    res.writeHead(404);
    res.end('Host not found: ' + req.headers.host);
  }
});

function loadHosts() {
  console.log('Loading /etc/hosts');
  var linePattern = /^\s*\S+\s+(\S+)\s*#\s*(proxy|static)\s+([^\s#]+)/i;
  var lr = new LineByLineReader('/etc/hosts');

  var newTargets = {};

  lr.on('error', function (err) {
    console.log('Error reading /etc/hosts: ' + err);
  });
  lr.on('line', function (line) {
    var match = line.match(linePattern);
    if (match) {
      var host = match[1];
      var type = match[2];
      var target = match[3];
      if (type.toLowerCase() == 'static') {
        console.log('Static ' + host + ' => ' + target);
        var static = express.static(target);
        newTargets[host] = function (req, res) {
          static(req, res, function () {
            res.writeHead(404);
            res.end('Not found: ' + req.url + ' in ' + target);
          });
        }
      }
      else if (type.toLowerCase() == 'proxy') {
        if (target.match(/^\d+$/)) {
          target = 'http://localhost:' + target;
        } else if (!target.match(/^https?\:\/\//)) {
          target = 'http://' + target;
        }
        console.log('Proxy ' + host + ' => ' + target);
        newTargets[host] = function (req, res) {
          proxy.web(req, res, { target: target }, function (e) {
            res.writeHead(504);
            res.end('Unable to connect to ' + target + ': ' + e);
          });
        }
      }
    }
  });
  lr.on('end', function () {
    targets = newTargets;
  });
}

fs.watch('/etc/hosts', loadHosts);
loadHosts();

server.listen(80);
