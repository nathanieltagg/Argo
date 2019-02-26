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
var spawn = require('child_process');

// conifig defaults:
var defaults = {
  datacache: __dirname + "/datacache",
  datacache_max_files: 100,
  datacache_max_age:   3600000, // one hour, in ms
  sam_arguments :["-e","uboone"]
}


var config = defaults;


// IDEA: can do this right here: process.env.DYLD_LIBRARY_PATH="<stuff>"
// NOPE! Doesn't work. Tried it.  The dlopen fails; apparently the underlying engine doesn't give a shit about process.env when loading variables

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
// var samweb_path = process.env.00
var app = express();
httpServer = http.createServer(app);


function samweb()
{
  // Utility function to call samweb, assuming it's in the current PATH (set up by sam_web_client)
  //
  //
  console.time('samweb');
  var sam_args = [...config.sam_arguments,...arguments];
  return new Promise(function(resolve,reject) {
    spawn.execFile("samweb",sam_args,(error, stdout, stderr) => {
      if (error) {
        // console.log("samweb error",error);
        reject(Error("samweb failed "+error+" $ samweb "+sam_args.join(' ')));
      } else {
        console.timeEnd('samweb');
        resolve(stdout.trim());
      }
    });
  });
}

// Samweb test.
// samweb("locate-file","PhysicsRun-2016_5_10_15_21_12-0006234-00031_20160802T075516_ext_unbiased_20160802T110203_merged_20160802T121639_reco1_20160802T144807_reco2_20171030T150606_reco1_20171030T162925_reco2.root")
// . then( (o)=>{console.log(o);}  )
// . catch();

// // test file loading
// // This takes only 12 ms to parse and 6 ms to redole (on mac). That indicates it makes sense for Node to read saved files and then piece them out just
// // like the C++ code!
// var default_event = {};
// var default_event_text = fs.readFileSync("static/default_event.json");
// console.time("parse json");
// default_event = JSON.parse(default_event_text);
// console.timeEnd("parse json")
// console.time("redole json");
// for(i in default_event) {
//   var bit = JSON.stringify(default_event[i]);
//   console.log(i,bit.length);
// }
// console.timeEnd("redole json");



mkdirp(config.datacache);

// app.use(morgan('tiny',{immediate:true}));
app.use(morgan('tiny'));
var expressWs = require('express-ws')(app,httpServer,{wsOptions:{perMessageDeflate:true}});


// Deal with WS connections.
app.ws('/server/stream-event', attach_stream);
function attach_stream(ws,req)
{
  console.log("attach stream",req.query);
  // Utility function
  function send_error_message(message) {
    var p = {"error":message};
    try{ ws.send(JSON.stringify(p)); } catch(err) { console.error("Websocket error.",err); }    
  }
  
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
    if(files.length==0) {
      send_error_message("No such file exists ("+event_req.pathglob+")");
      return;
    }
    event_req.filename = path.resolve(files[0]);
    
    if(fs.existsSync(event_req.filename)) {
      // PNFS CHECK
      if(event_req.filename.startsWith("/pnfs/")) {
        var pnfs_dotfile = path.join( path.dirname(event_req.filename),  ".(get)("+path.basename(event_req.filename)+")(locality)");
        var pnfs_status = fs.readFileSync(pnfs_dotfile);
        console.log("PNFS status of file:",pnfs_status);
        if(!pnfs_status.includes("ONLINE")) {
          // Pin it. Tell pnfs to stage the file for 20 min minimum
          fs.closeSync(fs.openSync(path.join( path.dirname(event_req.filename),  ".(fset)("+path.basename(event_req.filename)+")(stage)(1200)"), 'w'));
          
          send_error_message("UNSTAGED - The file you requested is in tape storage. It's being fetched now; please reload in a minute or two.")
        }
      }
      console.log("Constructed request:",event_req);
      
      // Make a new composer object.
      ws.my_composer = new Composer(composer_config,function(data,datatype) {
        console.log(chalk.red("Sending data"),datatype,data.length,data.substr(0,50));
        // dont' need this, but debugging:
        var o = JSON.parse(data);
        for(k in o) {        
          console.log("  ",chalk.red(k.padEnd(10)));
          if(typeof o[k] == 'object') for(kk in o[k])
            console.log("    ",chalk.red(kk.padEnd(10)));
        }
        try{ ws.send(data); } catch(err) { console.error("Websocket error.",err); }
      });
      // Initiate the initial request.
      ws.my_composer.request(event_req);
  
  
      // Declare where messages should go 
      ws.on("message",function(msg) {
        console.log(chalk.green("onmessage"),msg);
        var newreq;
        try {
          newreq = JSON.parse(msg);
        } catch (err) {
          var errpacket = JSON.stringify({
              "error": "Bad request "
                        +newreq
              +(err?" ("+err+")":"")
            });  
          try{ ws.send(errpacket); } catch(err) { console.error("Websocket error.",err); }        
                  
        }
        console.log(chalk.green(newreq,event_req));
        
        // var merge_req = {...newreq,...event_req}
        console.log(chalk.green("Passing subsequent request"),newreq);
        ws.my_composer.request(newreq); // And we're off and running again!  Or this is queued; the plug-in takes care of it.
      });
      
      // What to do if client disconnects
      ws.on("close",function() {
        console.log(chalk.blue("Socket closed, shutting down"));        
        ws.my_composer.shutdown(); // Tell it to stop processing queue.
        delete ws.my_composer; // release it.
        ws.onmessage = null; // remove listener.
      });

      return; // Return to event loop.

    } else {
      // If we got to here, we got a request but were unable to handle it.
      var msg = JSON.stringify({
          "error": "Unable to find a file matching request for "
                    +pathlglob
          +(err?" ("+err+")":"")
        });
      
      try{ ws.send(msg); } catch(err) { console.error("Websocket error.",err); }        
    } // glob callback
  }); // glob
};






app.get("/server/serve_event.cgi",function(req,res,next){
  console.log("serve_event.cgi",req.query);
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


// Pug templates.
var pug = require('pug');
app.set('view engine', 'pug')
app.set('views','pug');
app.get('/', function (req, res) {
  res.render('argo', { pagename: 'argo' })
})




// CSS precompiler. needs to come before /static call
var compileSass = require('express-compile-sass');
app.use('/css',compileSass({
    root: __dirname+'/scss',
    sourceMap: true, // Includes Base64 encoded source maps in output css
    sourceComments: true, // Includes source comments in output css
    watchFiles: true, // Watches sass files and updates mtime on main files for each change
    logToConsole: false // If true, will log to console.error on errors
}));
app.use('/css',express.static(__dirname + '/scss'));


// static files.
app.use(express.static(__dirname + '/static'));

app.use("/server",express.static(__dirname+'/static'));

// Datacache files
app.use('/datacache',express.static(config.datacache));
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

// clean at program start.
clean_datacache();

console.log("dirname is ",__dirname);

// File browser
var browser = require("./browser.js");
app.use("/browser/",browser.router);
app.use("/server/file_browser.cgi",browser.router);

process.send = process.send || function () {}; // in case there's no prcoess manager
httpServer.listen(4590); // looks a little like 'argo'
console.log("Port openend on 4590");
