'use strict';

console.log("starting")
var http = require('http');
var https = require('https');
var util = require('util');
var fs = require('fs');
const fsPromises = require('fs').promises;
var express = require('express');
var logger = require('morgan');
var compression = require('compression');

var events = require('events');
var glob = require("glob");
var cors = require('cors');
var path = require("path");
var morgan = require('morgan');
var moment = require('moment');
var path = require('path');
var mkdirp = require('mkdirp');
var chalk = require('chalk');

var rimraf = require('rimraf');

var config = require("./configuration.js"); // loads config.js
var samweb = require("./samweb.js");
var sanitize = require("sanitize-filename");
var child_process = require('child_process');
var cluster = require('cluster');

// IDEA: can do this right here: process.env.DYLD_LIBRARY_PATH="<stuff>"
// NOPE! Doesn't work. Tried it.  The dlopen fails; apparently the underlying engine doesn't give a shit about process.env when loading variables

// My backend instantiation (maps to a ComposerWithQueue object) 
console.log(process.env.LD_LIBRARY_PATH);
var argo = require("argonode");

var app = express();
var httpServer = http.createServer(app);
var httpsServer = https.createServer(app);


mkdirp(config.datacache);
mkdirp(config.live_event_cache);

// app.use(morgan('tiny',{immediate:true}));
app.use(morgan('tiny'));
// var expressWs = require('express-ws')(app,httpServer,{wsOptions:{perMessageDeflate:true}});

// app.get('/test', function(req,res,next){
//   console.log("test");
//   res.send("test");
// });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pin_pnfs_file(filename)
{
  // dccp -P should pin a file, but this fails with cryptic error messages
  var dccp = "/usr/bin/dccp";
  var dcap_file = filename.replace(/^\/pnfs/,"dcap://fndca1.fnal.gov:24137//pnfs/fnal.gov/usr");
  console.log("pinning file with dcap url:",dcap_file);
  const child = child_process.execFile(dccp,['-P',dcap_file],(error,stdout,stderr)=> {
    if(error) throw error;
    console.log("DCCP OUTPUT:",stdout,"\nDCCP STDERR:",stderr);
  })

  // Kirby suggests: do an ifdh cp, then killl the job. Doesn't seem to work.
  // const child = child_process.spawn("ifdh",['cp',filename,'/dev/null'],{shell:true,env:process.env});
  // await sleep(5000); // wait 5 seconds.
  // console.log("kill ifdh process for file",filename);
  // child.kill();

  // dccp -P should pin a file, but this fails with cryptic error messages
  // var dccp = "/usr/bin/dccp";
  // const child = child_process.execFile(dccp,['-P',filename],(error,stdout,stderr)=> {
  //   if(error) throw error;
  //   console.log("DCCP OUTPUT:",stdout,"\nDCCP STDERR:",stderr);
  // })

  // Try to read the first byte of a file.  Do absolutely nothing with it - this is just there to pin a pnfs file
  // fs.open(filename,'r',function(err,fd){
  //   var buff = Buffer.alloc(10);;
  //   fs.read(fd,buff,0,1,null,function(err,bytes,buffer){
  //     if(err)   console.log("Got error reading ",filename,err);
  //     if(bytes) console.log("Succesfully read data on ",filename);
  //   })
  // })
}

async function resolve_request(event_req)
{
  /// Throw error if unable to return request.
  try {
    ///
    /// Return an object suitable for passing to the Composer, with completely-specified filepath.
    /// Warning: modifies inReq
    if(event_req.what=="live") {
      // Do special live thing.  Set the json file name to either the most recent cache or the named cache.
      if(!event_req.filename) {
        await checkLiveCache();
        if(!current_live_event)  throw new Error("No live event available.");
        event_req.filename=path.join(config.live_event_cache,current_live_event,"event.json");
      }
      if(!event_req.filename.includes(".json")) 
        event_req.filename=path.join(config.live_event_cache,event_req.filename,"event.json");      
    }
    if(event_req.what=="json"){
      // look at prebuild json file
      if(!event_req.filename) event_req.filename=__dirname+"/static/default_event.json";
    }

    if(event_req.what == "run") {
      // Do special thing to find by run number
      var run = parseInt(event_req.run);
      if(!run) throw new Error("Run not specified");
      var subrun = (event_req.subrun) ? "." + parseInt(event_req.subrun) : "";
      var spec = `file_format artroot and run_number=${run}${subrun}`;
      
      var event = parseInt(event_req.event);
      if(!event) throw new Error("Event not specified"); // require.
      spec += ` and first_event<=${event} and last_event>=${event} `;

      if(event_req.nameinc) spec += " and file_name like %" + event_req.nameinc + "%";
      
      // not used at present:
      if(event_req.trig) spec += "(data_stream ${trigtype} or ub_project.stage ${trigtype})"

      // var datatier = event_req.tier || "raw";  // e.g. swizzled
      spec += ` and (data_tier raw or ub_project.stage merge)`;
      //
      // //find the file.
      // var notblind = "minus ub_blinding.blind true";
      // var spec = `data_tier ${datatier} and (data_stream ${trigtype} or ub_project.stage ${trigtype}) and run_number=${run}.${subrun} and first_event<=${event} and last_event>=${event} and file_format artroot `;
      var files = [];
      console.log("trying spec:",spec);
      files = await samweb.samweb('list-files',spec);
      if(files.length<1) throw new Error("No files found matching "+spec);
      if(files[0].length<1) throw new Error("No files found matching "+spec);
      console.log("files:",files);
      
      // remove empty entries
      var files2 = files.filter(function (el) {
        return el.length>0;
      });
      console.log("files2:",files2);
      
      // Find shortest remaining filename.
      const shorter = (left, right) => left.length <= right.length ? left : right
      var filename = files2.reduce(shorter);
      
      console.log("trying file",filename);
      loc = await samweb.samweb('locate-file',filename);
      console.log("location",loc);
      // if it's an array, get the first one
      if(Array.isArray(loc)) loc = loc[0];
      // strip off the stuff in parenths
      loc = loc.replace(/\s*\(.*?\)\s*/g, '');
      loc = loc.replace('enstore:', '');
      console.log("Trimmed location:",loc);
      event_req.filename = loc+'/'+filename;    // pass to logic below
      console.log("final loc:",event_req.filename)
    }

    if(event_req.what == "samdim") {    
      // Do special thing to find by sam defintion
      var samdim = event_req.samdim || "";
      if(samdim.length==0) throw new Error("No sam dimensions provided");
      files = await samweb.samweb('list-files',samdim);
      if(files.length<1) throw new Error("No files found matching"+spec);
      var filename = files[0];
      event_req.filename = files[0];    // pass to logic below
    }

    if(event_req.what == "samrunevent") {
      // Sam definition, run/sub/event.
      var samdef = event_req.samdef || "";
      if(samdim.length==0) throw new Error("No sam dimensions provided");
      var event = parseInt(event_req.event);
      if(isNan(event))  throw new Error("No Event provided");
      var subrun = parseInt(event_req.subrun);
      if(isNan(subrun))  throw new Error("No subrun provided");
      var run = parseInt(event_req.run);
      if(isNan(run)) throw new Error("No run provided");

      files = await samweb.samweb('list-files',
                            'defname:'+definition+' and run_number='+run+"."+subrun
                             +" and file_format artroot with limit 1");
      if(files.length<1) throw new Error("No files found matching"+spec);
      var filename = files[0];
      event_req.selection = event_req.selection || 
                              "EventAuxiliary.id_.subRun_.run_.run_=="+subrun
                             + "&&"
                             + "EventAuxiliary.id_.event_=="+event;
      event_req.filename = files[0];    // pass to logic below
    }


    // Otherwise, we've been asked for a file.
    event_req.pathglob= "";
    event_req.selection=  event_req.selection || "1";
    event_req.entrystart= parseInt(event_req.entry) || 0;
    event_req.entryend= event_req.entryend || 1000000000;
    event_req.options= event_req.options || "";


    var reqfile = event_req.filename;
    if(!reqfile) throw new Error("No file specified in request");

    if(! reqfile.includes("/")) { 
      // We've been asked for a file, but we don't have a full path. This is a job for sam!
      reqfile = await samweb.sam_locate_file(reqfile).catch(err=>{throw err;});
    }    
      
    if(!fs.existsSync(reqfile)) {
      throw new Error("Cannot find file "+reqfile);
    }
    event_req.filename = reqfile;

    // PNFS CHECK
    if(event_req.filename.startsWith("/pnfs/")) {
      var pnfs_dotfile = path.join( path.dirname(event_req.filename),  ".(get)("+path.basename(event_req.filename)+")(locality)");
      var pnfs_status = String(fs.readFileSync(pnfs_dotfile));
      console.log("PNFS status of file:",pnfs_status);
      if(!pnfs_status.includes("ONLINE")) {
        // Pin it. Tell pnfs to stage the file for 20 min minimum.  Update: doesn't work because, again, documentation is written only for gurus, not regular folk. 
        // This gets permission-denied since it's a read-only filesystem (I think)
        // fs.closeSync(fs.openSync(path.join( path.dirname(event_req.filename),  ".(pin)("+path.basename(event_req.filename)+")(stage)(1200)"), 'w'));
        pin_pnfs_file(event_req.filename);
        throw new Error("UNSTAGED - The file you requested is in tape storage. It's being fetched now; please reload in a minute or two.")
      }
    }
    // Success, file exists (and if pnfs it's on disk)
    return event_req;
  } catch (err) {console.trace("resolve_request throwing"); throw(Error(err));};
}


// Deal with WS connections.
// app.ws('/ws/stream-event', attach_stream);
// app.ws('/wss/stream-event', attach_stream);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ noServer: true });


httpServer.on('upgrade', function upgrade(request, socket, head) {

    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request);
    });
});

wss.on('connection', async function(ws,req) {
  if(req.url.includes("stream-event"))  return await attach_stream(ws,req);
  if(req.url.includes("notify-stream")) return await attach_notify_live_stream(ws,req);
});


async function attach_stream(ws,req)
{
  console.log("attach stream");
  // Utility function
  function send_error_message(message) {
    var p = {"error":message};
    try{ ws.send(JSON.stringify(p)); } catch(err) { console.error("Websocket error.",err); }    
  }

  function send_data(data,datatype) {
    // This is the do_output callback, called either on progress, piece, or finished.
    console.log(chalk.red("Sending data"),datatype,data.length,data.substr(0,50));
    // dont' need this, but debugging:
    var o = JSON.parse(data);
    for(var k in o) {        
      console.log("  ",chalk.red(k.padEnd(10)));
      if(typeof o[k] == 'object') for(var kk in o[k])
        console.log("    ",chalk.red(kk.padEnd(10)));
    }
    try{ ws.send(data); } catch(err) { console.error("Websocket error.",err); }
  }

  // Make a new composer object, send all output to the ws
  ws.my_composer = new argo.ComposerWithQueue(config.composer_config,send_data);
  
  // Declare where messages should go 
  ws.on("message",function(msg) {
    console.log(chalk.green("onmessage"),msg);
    var newreq;
    try {
      newreq = JSON.parse(msg);
    } catch (err) {
      send_error_message("Bad request"+newreq);
      return;
    }
    // See if there is a 'what' flag. If so, need a new event.
    if(newreq.what) {
      resolve_request(newreq).then(
        (r)=>{ 
          console.log("Request sent to composer:",r);
          ws.my_composer.request(r);}) // And we're off and running again!  Or this is queued; the plug-in takes care of it.  
        .catch(err=>{
          console.log(err.message);
          console.log(err.stack);
          send_error_message(err.message);
        }); 
    } else if(newreq.event_descriptor) {
      // This is an update request for more data.
      ws.my_composer.request(newreq);
    }
    
  });
  
  // What to do if client disconnects
  ws.on("close",function() {
    console.log(chalk.blue("Socket closed, shutting down"));        
    ws.my_composer.shutdown(); // Tell it to stop processing queue.
    delete ws.my_composer; // release it.
    ws.onmessage = null; // remove listener.
  });

  // this code resolves a URL-based query (?file=blah&what=file)
  // This is superceded by a message event.
  // if(req.query && Object.keys(req.squery).length>0) {
  //   // We have an initial request
  //   var event_req = Object.assign(req.query); // Shallow copy.
  //   try{
  //     resolve_request(event_req);
  //   } catch(err) {
  //     send_error_message(err.message)
  //   }
  //   console.log("initial request sent to composer",event_req);
  //   ws.my_composer.request(event_req);
  // }
};






app.get("/server/serve_event.cgi",function(req,res,next){
  console.log("serve_event.cgi",req.query);
  var event_req = req.query;
  
  if(event_req.what) {
    resolve_request(event_req).then(      
      (request)=>{ 
        var composer = new argo.Composer(config.composer_config);
        composer.composeIncremental(request, (result)=>{
          composer; // make sure it stays alive
          res.setHeader('Content-Type', 'application/json');
          res.send(result);          
        }, console.log);
      });
    }
});


// Pug templates.
var pug = require('pug');
app.set('view engine', 'pug')
app.set('views','pug');




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


// Browserify middleware.
var browserify = require('browserify-middleware');
app.use('/js',browserify(__dirname + '/client'))


// static files.
app.use(express.static(__dirname + '/static'));
app.use('/live_event_cache',express.static(config.live_event_cache));

// app.use("/server",express.static(__dirname+'/static'));

// Datacache files
app.use('/datacache',express.static(config.datacache));
async function clean_datacache()
{

  console.log(config.datacache);
  var maxAge = moment()
  var files = fs.readdirSync(config.datacache);
  var files_with_ages = [];
  var now = Date.now();

  for(var file of files) {
    if(path.extname(file) == ".png") {
      var pathname = path.resolve(config.datacache,file);
      var stat = fs.statSync(pathname);
      files_with_ages.push({filename:file,pathname:pathname,age:now-stat.mtime});
    }
  }
  files_with_ages.sort((a,b)=>{return b.age-a.age;})
  var n = files_with_ages.length;
  var n0 = n;
  for(var f of files_with_ages) {
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



// samspider cgi
var cgi = require('cgi');
app.all("/samspider/samspider.cgi", cgi(__dirname+"/samspider/samspider.cgi",
        {stderr: process.stderr}) );
app.all("/samspider", cgi(__dirname+"/samspider/samspider.cgi",
        {stderr: process.stderr}) );
app.use('/samspider', express.static(__dirname + '/samspider'));



var browser = require("./browser.js");

///// Uboone Masterclass specific:
var masterclass_browser = new browser({
    targetlink:  "/masterclass/",
    extensions: {
                '.ubdaq':"Raw UBDAQ files",
                '.root':"Root files (Can read AnalysisTuple OR Larsoft OR Larlite files)"
                },
    default_path: '/uboone/data/users/sowjanya/MasterClass/BNBCosmics_et_MCC8p1',
    allowed_paths: ['/home','/Users','/pnfs','/uboone/data','/uboone/app'],

});
app.use("/masterclass/browser/",masterclass_browser.router);
app.get('/masterclass', function (req, res) {  res.render('masterclass', { pagename: 'masterclass' }) }); // Main page.




///// Protodune specific:
var atreides_browser = new browser({
    targetlink:  "/atreides/",
    extensions: {
                '.root':"Root files (Can read Larsoft OR Larlite files)"
                },
    default_path: __dirname,
    allowed_paths: ['/home','/Users','/pnfs','/dune/data','/dune/app'],

});
app.use("/atreides/browser/",atreides_browser.router);
app.get('/atreides', function (req, res) { res.render('atreides', { pagename: 'atreides' }) }); // Main page.

///// MIcroboone specific:
// File browser
var browser = require("./browser.js");

var argo_browser = new browser({
    targetlink:  "/",
    extensions: {
                '.ubdaq':"Raw UBDAQ files",
                '.root':"Root files (Can read AnalysisTuple OR Larsoft OR Larlite files)"
                },
    default_path: __dirname,
    allowed_paths: ['/home','/Users','/pnfs','/uboone/data','/uboone/app'],

});
app.use("/browser/",argo_browser.router);
// app.use("/server/file_browser.cgi",argo_browser.router);


app.get('/live',function(req,res) {
  res.render('live', {pagename: 'live'});
})

// At end:
//May be causing errors.
app.get('/:pagename', function (req, res) {
  console.error("Got request for ",req.params.pagename)
  return res.status(404).send("404");
  // res.render(sanitize(req.params.pagename), { pagename: req.params.pagename })
})

// At end:
app.get('/', function (req, res) {
  res.render('argo', { pagename: 'argo' })
})



////////////////////////////////////////////////
/// LIVE

var recent_live_events = null;
var current_live_event = null;
const readdirAsync = util.promisify(fs.readdir);
async function checkLiveCache()
{
  recent_live_events = await readdirAsync(config.live_event_cache);
  recent_live_events.sort();
  current_live_event = recent_live_events.slice(-1)[0];
}
checkLiveCache().then();
var current_heartbeat = {};
var current_heartbeat_time = 0;

var live_data_emitter = new events.EventEmitter();


setInterval(async ()=>{
  // console.log("Sending heartbeats...");
  await checkLiveCache();
  current_heartbeat.server_time = Date.now();
  live_data_emitter.emit("emit",'interval');
}
  ,5000);

if(cluster.isWorker) {
  process.on('message', function(msg) {
    if(typeof msg === "object") {
      if(msg.newevent) recent_live_events.push(msg.newevent);
      live_data_emitter.emit("newevent");
    }
  });


}

// app.ws('/ws/notify-live',  attach_notify_live_stream);
// app.ws('/wss/notify-live', attach_notify_live_stream);

async function attach_notify_live_stream(ws,req)
{
  console.log("attaching to notify-stream",req.ip)
  function send_heartbeat(reason) {
    if(ws.readyState != 1) { // 1 is WebSocket.OPEN
      console.warn('notify-stream not open',ws.ip);
      return; // This socket is closing or in error; it may take a while to terminate.
    }
    var o = {};
    o.reason=reason;
    o.heartbeat = current_heartbeat;
    o.heartbeat_time = current_heartbeat_time;
    o.server_time = Date.now();
    o.recent_live_events = recent_live_events;
    o.current_live_event = current_live_event;

    var str = JSON.stringify(o);
    try{ 
      ws.send(str);
    } catch(err) { console.error("Websocket error.",err); }

  }
  // intial heartbeat
  send_heartbeat('initial');
  
  // Emit to us when you get a beat
  live_data_emitter.on('emit',send_heartbeat);
  // Don't emit to us if we close
  ws.on('message',(ev)=>{console.log("notify-live mesg:",ev); send_heartbeat('requested');});
  ws.on('close',()=>{live_data_emitter.removeListener('emit',send_heartbeat);});
  ws.on('error',(err)=>{console.log(err); ws.close()});

};



/// Code to allow the argo-live-backend executable to simply upload the most recent data!
var ipfilter = (req,res,next)=>{next()}; // default is no-op
if(config.restrict_live_event_upload) {
  console.log("Restricting live event uploads to whitelist:",config.restrict_live_event_upload);
  ipfilter = require('express-ipfilter').IpFilter(config.restrict_live_event_upload,{ mode: 'allow' });
}
const uploader = require('express-fileupload')({
  // useTempFiles: true, tempFileDir:'/tmp/' // this fills tmp.
});
app.post("/live-event-upload",
  ipfilter,
  uploader,
  function(req,res) {
  console.log("Received event upload from ",req.ip," with ",req.body,req.files && Object.keys(req.files).length);
  // console.log("body of upload:",req.body,req.files && Object.keys(req.files).join(', '));
  if(req.body.heartbeat) {
    current_heartbeat = JSON.parse(req.body.heartbeat);
    current_heartbeat_time = Date.now();
    live_data_emitter.emit("emit","heartbeat");
  }

  if(req.body.event_dir) {
    // there is data!
    current_live_event = req.body.event_dir;
    var current_path = path.join(config.live_event_cache,current_live_event);
    // console.log(req.files);
    if(req.files && Object.keys(req.files).length>0) {
      fs.mkdirSync(current_path);
      for(var i in req.files) {
        var f = req.files[i];
        if(f.size) {
          var dest = path.join(current_path,sanitize(f.name));
          // console.log("moving ",f.name,dest);
          f.mv(dest,console.err);
        }      
      }
      // if we are responsible for this data, clean the cache (in a few mssec)
      setTimeout(cleanLiveEventCache, 0);
    }
    recent_live_events.push(current_live_event);
    if(cluster.isWorker) process.send({newevent:current_live_event});
    live_data_emitter.emit('emit','newevent');

  }
  res.status(400);
  res.send("");
});

function cleanLiveEventCache()
{
  console.log("cleaning live event cache");
  fs.readdir(config.live_event_cache,(err,dir)=>
    {
      dir = dir.sort(); // put in order of files in alphbetical order
      while(dir.length> config.live_event_max_files) {
        var basename = dir.shift();
        console.log("cleaning out ",basename);
        // Remove from list of recent results, if it's there.
        var idx = recent_live_events.indexOf(basename);
        if(idx>-1) recent_live_events.splice(idx,1);
        // console.log("new array of recent live events is",recent_live_events);

        // Remove the file.
        var pathname = path.join(config.live_event_cache,basename);
        rimraf(pathname,(err)=>{if(err) console.error;}); // rimraf does rm -rf
      }

  });
}





///////////////////////////////////////////////
// Run the server
if(process.env.NODE_ENV=="production") {
  var numCPUs = 4;

  if (cluster.isMaster) {
    var workers = [];

    function gotWorkerMsg(msg) {
      for(var w in workers) {
        w.send(msg);
      }
    }
    for (var i = 0; i < numCPUs; i++) {
        var worker = cluster.fork();
        workers.push(worker);
        worker.on("messsage",gotWorkerMsg);
    }

  } else {
   // is worker.
   httpServer.listen(config.http_server_port,function(){
     process.send = process.send || function () {}; // in case there's no prcoess manager
     process.send({ready:1});
     console.log(chalk.red("Port openend on ",config.http_server_port));

    }); 
  }

} else {

  // no clusters.
  httpServer.listen(config.http_server_port,function(){
     process.send = process.send || function () {}; // in case there's no prcoess manager
     process.send('ready');
     console.log(chalk.red("Port openend on ",config.http_server_port));

    }); // looks a little like 'argo'
}




