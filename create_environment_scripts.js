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
            "exec_mode" : "cluster",
            "instances" : 2,
            "wait_ready": true,
            "listen_timeout": 20000,
            "env": {
              "NODE_ENV": "production",
            }
          }
   ]
}



var obj = { DYLD_LIBRARY_PATH :""
          , DYLD_FALLBACK_LIBRARY_PATH: ""
          , LD_LIBRARY_PATH   :""
          , ROOT_INCLUDE_PATH :""
          , PYTHONPATH        :""
          , PATH              :""
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

fs.writeFileSync("pm2.ecosystem.json",JSON.stringify(pm2,null,2));

          