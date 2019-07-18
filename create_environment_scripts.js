#!/usr/bin/env node
///
/// Little script to copy the current UPS enviroment into a few 
/// static scripts.  This should be called every time you change enviromnent.
///

/// Creates the file ups_env.json
var fs = require('fs');

// Template for nodemon file
var nodemon = {
  "__comment" : "This file is auto-generated from create_environment_scripts.js. Make changes there!",
  verbose: true,
  ext: "js pug inc dylib so",
  ignore: ["static/**", "logs/*"],
}


var pm2 = {
  "__comment" : "This file is auto-generated from create_environment_scripts.js. Make changes there!",  
  "apps" : [
     {
            "name": "argo-node",
            "script": "index.js",
            "watch": false,
            "cwd":__dirname,
            "env": {
              "NODE_ENV": "production",
            }
          }
   ]
}

// node-cluster is responsible for clustering, not pm2
// "exec_mode" : "cluster",
// "instances" : 2,
// "wait_ready": true,
// "listen_timeout": 20000,



var obj = { DYLD_LIBRARY_PATH :null
          , DYLD_FALLBACK_LIBRARY_PATH:null
          , LD_LIBRARY_PATH   :null
          , ROOT_INCLUDE_PATH :null
          , PYTHONPATH        :null
          , PYTHONHOME        :null
          , PATH              :null	  
          };


nodemon.env = {};
for(v in obj) {
  nodemon.env[v] = process.env[v]; // get current variable.  
}
nodemon.env["DYLD_LIBRARY_PATH"] = "";
nodemon.env["DYLD_FALLBACK_LIBRARY_PATH"] = process.env["DYLD_LIBRARY_PATH"];

fs.writeFileSync("nodemon.json",JSON.stringify(nodemon,null,2));

for(v in obj) {
  pm2.apps[0].env[v] = process.env[v]; // get current variable.  
}
pm2.apps[0].env["DYLD_LIBRARY_PATH"] = "";
pm2.apps[0].env["DYLD_FALLBACK_LIBRARY_PATH"] = process.env["DYLD_LIBRARY_PATH"];
pm2

fs.writeFileSync("pm2.json",JSON.stringify(pm2,null,2));

          
