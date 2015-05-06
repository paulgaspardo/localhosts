var http = require('http');
var httpProxy = require('http-proxy');
var fs = require('fs');
var LineByLineReader = require('line-by-line');

var proxy = httpProxy.createProxyServer({});

var targets = {};

var server = http.createServer(function (req, res) {
  var target = targets[req.headers.host];

  if (target) {
    proxy.web(req, res, { target: target }, function (e) {
      res.writeHead(504);
      res.end('Unable to connect to ' + target + ': ' + e);
    });
  } else {
    res.writeHead(404);
    res.end('Host not found: ' + req.headers.host);
  }
});

function loadHosts() {
  console.log('Loading /etc/hosts');
  var linePattern = /^\s*\S+\s+(\S+)\s*#\s*proxy\s+([^\s#]+)/i;
  var lr = new LineByLineReader('/etc/hosts');

  var newTargets = {};

  lr.on('error', function (err) {
    console.log('Error reading /etc/hosts: ' + err);
  });
  lr.on('line', function (line) {
    var match = line.match(linePattern);
    if (match) {
      var host = match[1];
      var target = match[2];
      if (target.match(/^\d+$/)) {
        target = 'http://localhost:' + target;
      } else if (!target.match(/^https?\:\/\//)) {
        target = 'http://' + target;
      }
      console.log(host + ' => ' + target);
      newTargets[host] = target;
    }
  });
  lr.on('end', function () {
    targets = newTargets;
  });
}

fs.watch('/etc/hosts', loadHosts);
loadHosts();

server.listen(80);
