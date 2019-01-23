var http = require('http');
var https = require('https');
var fs = require('fs');
var express = require('express');
var logger = require('morgan');
var compression = require('compression');
var glob = require("glob");
var cors = require('cors');
var path = require("path");
var morgan = require('morgan');

// My backend instantiation (maps to a ComposerFactory object) 
var backend = require("argo");
var composerFactory = new backend({"max_composers":0});
var ssi = require("ssi"); // server-side includes
var app = express();
httpServer = http.createServer(app);

app.use(cors());

ssi = require("ssi");

var includes = new ssi("../",
                        "./compiled/",
                        "*.html");
includes.compile();

app.use(morgan('tiny',{immediate:true}));
app.use(morgan('tiny'));

app.get("/server/serve_event.cgi",function(req,res,next){
  console.log(req.query);
  var event_req = {
    pathglob: "",
    selection:  req.query.selection?(String(req.query.selection)):"1",
    entrystart: req.query.entry?parseInt(req.query.entry):0,
    entryend: 1000000000,
    options: req.query.options || "",
  };
  if(req.query.filename) event_req.pathglob = decodeURIComponent(req.query.filename);
  // FIXME raw file lookup req.param.what == 'raw'
  console.log("pathglob:",req.query.filename,event_req.pathglob);
  glob(event_req.pathglob,  function (er, files) {
    console.log("found files",files);
    event_req.filename = files[0];
    if(fs.existsSync(event_req.filename)) {
      // FIXME PNFS CHECK
      console.log("Constructed request:",event_req);
      composerFactory.compose(event_req,
          function(result){
              console.log("Result complete:",result.length);
              // var doc = JSON.parse(result);
              res.setHeader('Content-Type', 'application/json');
              res.send("{\"record\":"+result+"}");
              return;
            }
      );
    }
  });
  // var errorblock = {'error': "something fucked up"};
  // res.setHeader('Content-Type', 'application/json');
  // res.send(JSON.stringify(errorblock));
});


var pug = require('pug');
app.set('view engine', 'pug')
app.set('views','pugified');
app.get('/', function (req, res) {
  res.render('argo', { pagename: 'argo' })
})

app.use(express.static(__dirname + '/static'));
app.use('/js/',express.static('../js'));
app.use('/libs/',express.static('../libs'));
app.use('/core/',express.static('../core'));
app.use('/images/',express.static('../images'));
app.use('/shaders/',express.static('../shaders'));
app.use('/css/',express.static('../css/'));
app.use('/datacache/',express.static('../datacache/'));

var browser = require("./browser.js");
app.use("/browser/",browser.router);
app.use("/server/file_browser.cgi",browser.router);

process.send = process.send || function () {}; // in case there's no prcoess manager
httpServer.listen(4590); // looks a little like 'argo'
console.log("Port openend on 4590");
