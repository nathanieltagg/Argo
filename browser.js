var express = require('express');
var pug = require('pug');
var fs = require('fs');
const { join, extname, resolve } = require("path")
var moment = require("moment");
var cookieParser = require('cookie-parser')
var router = express.Router();
module.exports.router = router;

router.use(cookieParser());



// FIXME: make configurable:
var targetlink = "/"
var extensions = {'.ubdaq':"Raw UBDAQ files",
                  '.root':"Root files (Can read AnalysisTuple OR Larsoft OR Larlite files)"};
var default_path = __dirname;
var allowed_paths = ['/home','/Users','/pnfs','/uboone/data','/uboone/app'];

function human_size(size)
{
    if (size > 1099511627776)  //   TiB: 1024 GiB
    {
        return (size / 1099511627776).toFixed(2) + " TB";
    }
    else if (size > 1073741824) //   GiB: 1024 MiB
    {
        return (size / 1073741824).toFixed(2) + " GB";
    }
    else if (size > 1048576)      //   MiB: 1024 KiB
    {
        return (size / 1048576).toFixed(2) + " MB";
    }
    else if (size > 1024)           //   KiB: 1024 B
    {
        return (size / 1024).toFixed(0) + " kB";
    }
    else                                    //   bytes
    {
      return size + " bytes";
    }
}

async function browser(path,req,res,next)
{
  // Do we have a path? If not, then use cookie save.
  if(path.length<2) {
    path = req.cookies['file-browser-saved-path'] || default_path;    
  }
  
  // Is the path we've been given legal?
  // FIXME
  
  // Does path exist?
  if(!fs.existsSync(path)) return res.send("Specified path does not exist");
  // FIXME
  
  res.cookie('file-browser-saved-path',path);
  
  console.log("looking at ",path);
  
  // look at path contents
  var result = { 
    path: path,
    targetlink: targetlink,
    extensions: extensions, 
    files: { dirs:[] } 
  };
  for( e in extensions ) { result.files[e] = []; }

  try {
    let files = await fs.promises.readdir(path);
    for(const file of files) {
      if(file[0]=='.') continue;
      var fullpath = resolve(path,file);
      if(!fs.existsSync(fullpath)) continue;
            
      var stats = await fs.promises.stat(fullpath);
      var extension = extname(file);
      console.log(file,extension); 
      var entry = {
        "filename": file,
        "pathname": fullpath,
        "modified" : moment(stats.mtime).format('MMM Do YYYY, h:mm:ss a'),
        "ago"     : moment(stats.mtime).fromNow(),
        "size"     : human_size(stats.size),
        "sizedata" : stats.size,
        "mdata"    : stats.mtime.getTime(),
      }
      if(stats.isDirectory())     result.files.dirs.push(entry);
      if(extension in extensions) {
        result.files[extension].push(entry);
        console.log(entry);
      }
    }
  } catch(err) {
    console.error("what?",err);
  }
  
  // console.log(result);
  res.send( pug.renderFile("pug/browser.pug",result) );
  
}


router.get("/*",function(req,res,next){
   browser(req.path,req,res,next);
});

router.get("/",function(req,res,next){
  var path = req.query.path;
  browser(path,req,res,next);
});


