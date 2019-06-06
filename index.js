console.log("starting")
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
  sam_arguments :["-e","uboone"],
}
defaults.composer_config = {
   "forking": false,
   "CacheStoragePath": defaults.datacache,
   "CacheStorageUrl": "/datacache",
   "WorkingSuffix": "event",
   "CreateSubdirCache": true,
  "fork_logdir": __dirname+"/logs/",
  plexus: {
    tpc_source:"sqlite "+__dirname+"/db/current-plexus.db",
    pmt_source:"sqlite "+__dirname+"/db/current-plexus.db",
  }
}
var config = require('deepmerge')(defaults,require('./config.js'));

console.log("config:",config);

// IDEA: can do this right here: process.env.DYLD_LIBRARY_PATH="<stuff>"
// NOPE! Doesn't work. Tried it.  The dlopen fails; apparently the underlying engine doesn't give a shit about process.env when loading variables

// My backend instantiation (maps to a ComposerWithQueue object) 
var argo = require("argonode");

// var samweb_path = process.env.00
var app = express();
httpServer = http.createServer(app);


function samweb()
{
  // Utility function to return promise samweb, assuming it's in the current PATH (set up by sam_web_client)
  // Returns array of lines.
  //
  //
  var sam_args = [...config.sam_arguments,...arguments];
  return new Promise(function(resolve,reject) {
    console.time('samweb');
    spawn.execFile("samweb",sam_args,(error, stdout, stderr) => {
      if (error) {
        console.log("Samweb call failed:"," samweb "+sam_args.join(' '));
        console.log(stdout);
        console.log(stderr);
        return reject(Error("samweb failed "+error+" $ samweb "+sam_args.join(' ')));
      } else {
        console.timeEnd('samweb');
        lines = stdout.split("\n");  // split newlines
        for(var i=0;i<lines.length;i++){
          lines[i] = lines[i].trim(); // trim each output line of whitespace
        }
        console.log("samweb command: $ samweb "+sam_args.join('**') );
        console.log("result: ",lines);
        return resolve(lines);
      }
    });
  });
}

function sam_locate_file(filename)
{
  return new Promise(function(resolve,reject){
    samweb("locate-file",filename).then(locs=>{
      // returned string is enstore:/pnfs/.../dir(stuff)
      var loc = locs[0] || '';
      console.log("located "+loc);
      var m = loc.match(/[^:]*:(.*)\(.*\)/);
      if(!m) return reject(Error("File not found in SAM"));
      if(m.length<2) return reject(Error("Could not parse SAM locate-file response "+loc));
      var mypathname = path.join(m[1],filename);
      console.log("locate-file looking for",mypathname)
      
      if(fs.existsSync(mypathname)) {
        console.log("locate-file found it's target",mypathname)
        return resolve(mypathname);
      } else {
        return reject(Error("SAM path doesn't exist on this computer:"+mypathname));
        // FIXME: I could include code here that uses xrootd (xrdcp command) or idfh cp to get the file to the local computer. 
        // However, those require custom installtion of either VOMS or globus-url-copy, which are a pain to get going on Mac OSX.
      }
    },
    err=>{console.log("sam_locate_file fail",err); return reject(new Error("samweb could not locate-file "+filename))} );
  });
}

function sam_get_raw_ancestor(filename)
{
  return new Promise(function(resolve,reject){
    samweb('list-files',
            "isancestorof:(file_name="+filename+") and availability:default and data_tier=raw and file_format=artroot")
    .then(fn2 => sam_locate_file(fn2[0]), err=>reject(err))
    .then(loc => resolve(loc), err=>reject(err))
    .catch(err=>reject(err));

    // samweb('file-lineage','ancestors',filename).then(lineage=>{
    //   console.log(lineage);
    //   // split into lines:
    //   lines = lineage.split("\n");
    //   lines.reverse(); // last first
    //   for(l of lines) {
    //     if(l.includes(".root")) { // We want the root ancestor who has a .root extension. This file SHOULD have raw wires.
    //       return sam_locate_file(l.trim());
    //     }
    //   }
    // })
    // .catch(err=>{console.log(err); reject(err)});
  });
}


// Samweb tests.
 // samweb("locate-file","PhysicsRun-2016_5_10_15_21_12-0006234-00031_20160802T075516_ext_unbiased_20160802T110203_merged_20160802T121639_reco1_20160802T144807_reco2_20171030T150606_reco1_20171030T162925_reco2.root")
//  sam_locate_file("PhysicsRun-2018_6_24_12_43_59-0017373-00195_20180718T082326_ext_bnb_3_20181127T205047_optfilter_20181201T010640_reco1_postwcct_postdl_20181201T021012_reco2_20181201T021832_slimmed.root")
// . then( (o)=>{console.log(o);}  )
// . catch();
//
// samweb_get_raw_ancestor("PhysicsRun-2016_5_10_15_21_12-0006234-00031_20160802T075516_ext_unbiased_20160802T110203_merged_20160802T121639_reco1_20160802T144807_reco2_20171030T150606_reco1_20171030T162925_reco2.root")
// .then(m=>{console.log('file I want:',m)})
// .catch(err=> console.log(err));
 

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

app.get('/test', function(req,res,next){
  console.log("test");
  res.send("test");
});

function readTouch(filename)
{
  // Try to read the first byte of a file.  Do absolutely nothing with it - this is just there to pin a pnfs file
  fs.open(filename,'r',function(err,fd){
    var buff = Buffer.alloc(10);;
    fs.read(fd,buff,0,1,null,function(err,bytes,buffer){
      if(err)   console.log("Got error reading ",filename,err);
      if(bytes) console.log("Succesfully read data on ",filename);
    })
  })
}


async function resolve_request(event_req)
{
  /// Throw error if unable to return request.
  ///
  /// Return an object suitable for passing to the Composer, with completely-specified filepath.
  /// Warning: modifies inReq
  if(event_req.what=="live") {
    // Do special live thing.
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
    files = await samweb('list-files',spec);
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
    loc = await samweb('locate-file',filename);
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
    files = await samweb('list-files',samdim);
    if(files.length<1) throw new Error("No files found matching"+spec);
    var filename = files[0];
    event_req.filename = files[0];    // pass to logic below

    // console.log("samdim found file",filename);
    // loc = await samweb('locate-file',filename);
    // console.log("location",loc);
    // event_req.filename = loc;
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
    reqfile = await sam_locate_file(reqfile).catch(err=>{throw err;});
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
      readTouch(event_req.filename);
      throw new Error("UNSTAGED - The file you requested is in tape storage. It's being fetched now; please reload in a minute or two.")
    }
  }
  // Success, file exists (and if pnfs it's on disk)
  return event_req;

}


// Deal with WS connections.
app.ws('/ws/stream-event', attach_stream);
async function attach_stream(ws,req)
{
  console.log("attach stream");
  // Utility function
  function send_error_message(message) {
    var p = {"error":message};
    try{ ws.send(JSON.stringify(p)); } catch(err) { console.error("Websocket error.",err); }    
  }
  
  // ws might be wss or ws
  console.log("ws server hit!",req.query)

  function send_data(data,datatype) {
    // This is the do_output callback, called either on progress, piece, or finished.
    console.log(chalk.red("Sending data"),datatype,data.length,data.substr(0,50));
    // dont' need this, but debugging:
    var o = JSON.parse(data);
    for(k in o) {        
      console.log("  ",chalk.red(k.padEnd(10)));
      if(typeof o[k] == 'object') for(kk in o[k])
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
        .catch(err=>{send_error_message(err.message)}); 
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

// app.use("/server",express.static(__dirname+'/static'));

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
app.use("/server/file_browser.cgi",argo_browser.router);


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
app.use("/atreides/server/file_browser.cgi",atreides_browser.router);


// At end:
app.get('/', function (req, res) {
  res.render('argo', { pagename: 'argo' })
})

app.get('/atreides', function (req, res) {
  res.render('atreides', { pagename: 'atreides' })
})


process.send = process.send || function () {}; // in case there's no prcoess manager
httpServer.listen(4590); // looks a little like 'argo'
console.log(chalk.red("Port openend on 4590"));
