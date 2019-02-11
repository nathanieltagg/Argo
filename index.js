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
var moment = require('moment');
var path = require('path');
var mkdirp = require('mkdirp');
var chalk = require('chalk');

// conifig defaults:
var defaults = {
  datacache: __dirname + "/datacache",
  datacache_max_files: 100,
  datacache_max_age:   3600000, // one hour, in ms
}


var config = defaults;


// My backend instantiation (maps to a ComposerWithQueue object) 
var Composer = require("argonode");
var composer_config ={
  "forking": false,
  "fork_logs": __dirname + "/logs/",
  "CacheStoragePath": config.datacache,
  "CacheStorageUrl": "/datacache",
  "WorkingSuffix": "event",
  "CreateSubdirCache": true,
};
var app = express();
httpServer = http.createServer(app);



mkdirp(config.datacache);

// app.use(morgan('tiny',{immediate:true}));
app.use(morgan('tiny'));



var expressWs = require('express-ws')(app,httpServer,{wsOptions:{perMessageDeflate:true}});

app.ws('/server/stream-event', attach_stream);

function attach_stream(ws,req)
{
  // ws might be wss or ws
  console.log("ws server hit!",req.query)

  var event_req = req.query;
  
  event_req.pathglob= "";
  event_req.selection=  req.query.selection?(String(req.query.selection)):"1";
  event_req.entrystart= req.query.entry?parseInt(req.query.entry):0;
  event_req.entryend= 1000000000;
  event_req.options= req.query.options || "";
  if(req.query.filename) event_req.pathglob = decodeURIComponent(req.query.filename);
  // FIXME raw file lookup req.param.what == 'raw'
  console.log("pathglob:",req.query.filename,event_req.pathglob);
  var alive = true;
  glob(event_req.pathglob,  function (er, files) {
    console.log("found files",files);
    event_req.filename = files[0];
    
    if(fs.existsSync(event_req.filename)) {
      // FIXME PNFS CHECK
      console.log("Constructed request:",event_req);
      
      // Make a new composer object.
      ws.my_composer = new Composer(composer_config,function(data) {
        console.log(chalk.red("Sending data"),data.length,data.substr(0,50));
        // dont' need this, but debugging:
        var o = JSON.parse(data);
        for(k in o) {        
          console.log("  ",chalk.red(k.padEnd(10)));
          if(typeof o[k] == 'object') for(kk in o[k])
            console.log("    ",chalk.red(kk.padEnd(10)));
        }
        ws.send(data);
      });
      // Initiate the initial request.
      ws.my_composer.request(event_req);
      // Declare where messages should go 
      ws.onmessage = function(msg) {
        let newreq = JSON.parse(msg);
        let merge_req = {...newreq,...event_req}
        console.log(chalk.green("Passing subsequent request"),merge_req);
        ws.my_composer.request(msg);
      }
      // What to do if client disconnects
      ws.onclose = function() {
        console.log(chalk.blue("Socket closed, shutting down"));        
        ws.my_composer.shutdown(); // Tell it to stop processing queue.
        delete ws.my_composer; // release it.
        ws.onmessage = null; // remove listener.
      }
      return;
    } else {
      // If we got to here, we got a request but were unable to handle it.
      ws.send({
        "error": "Unable to find a file matching request for "
                  +pathlglob
                  +(err?" ("+err+")":"")
      });
    } // glob callback
  }); // glob
};


app.get("/server/serve_event.cgi",function(req,res,next){
  console.log(req.query);
  var event_req = req.query;
  
  event_req.pathglob= "";
  event_req.selection=  req.query.selection?(String(req.query.selection)):"1";
  event_req.entrystart= req.query.entry?parseInt(req.query.entry):0;
  event_req.entryend= 1000000000;
  event_req.options= req.query.options || "";
  if(req.query.filename) event_req.pathglob = decodeURIComponent(req.query.filename);
  // FIXME raw file lookup req.param.what == 'raw'
  console.log("pathglob:",req.query.filename,event_req.pathglob);
  glob(event_req.pathglob,  function (er, files) {
    console.log("found files",files);
    event_req.filename = files[0];
    if(fs.existsSync(event_req.filename)) {
      // FIXME PNFS CHECK
      console.log("Constructed request:",event_req);
      composerFactory.composeWithProgress(event_req,
          function(result){
              console.log("Result complete:",result.length);
              // var doc = JSON.parse(result);
              res.setHeader('Content-Type', 'application/json');
              res.send("{\"record\":"+result+"}");
              return;
            },
            function(progress){
              console.log("PROGRESS",progress);
            }
      );
    }
  });
  clean_datacache();
  // var errorblock = {'error': "something fucked up"};
  // res.setHeader('Content-Type', 'application/json');
  // res.send(JSON.stringify(errorblock));
});


var pug = require('pug');
app.set('view engine', 'pug')
app.set('views','pug');
app.get('/', function (req, res) {
  res.render('argo', { pagename: 'argo' })
})

app.use(express.static(__dirname + '/static'));
app.use('/datacache',express.static(config.datacache));

// FIXME: cleanup datacache
async function clean_datacache()
{

  console.log(config.datacache);
  var maxAge = moment()
  var files = fs.readdirSync(config.datacache);
  var files_with_ages = [];
  now = new Date().getTime();

  for(file of files) {
    if(path.extname(file) == ".png") {
      var pathname = path.resolve(config.datacache,file);
      var stat = fs.statSync(pathname);
      files_with_ages.push({filename:file,pathname:pathname,age:now-stat.mtime});
    }
  }
  files_with_ages.sort((a,b)=>{return b.age-a.age;})
  var n = files_with_ages.length;
  var n0 = n;
  for(f of files_with_ages) {
    console.log(f);
    if( (n>config.datacache_max_files) ||
        (f.age > config.datacache_max_age) ) {
          n--; 
          console.log("deleting ",f.pathname);
          fs.unlinkSync(f.pathname); n--;
    }    
  }
  console.log("deleted ",n0-n,"/",n0," files");
    
}

clean_datacache();

console.log("dirname is ",__dirname);
var browser = require("./browser.js");
app.use("/browser/",browser.router);
app.use("/server/file_browser.cgi",browser.router);

process.send = process.send || function () {}; // in case there's no prcoess manager
httpServer.listen(4590); // looks a little like 'argo'
console.log("Port openend on 4590");
