#!/usr/bin/env node
///
/// Little script to copy the current UPS enviroment into a few 
/// static scripts.  This should be called every time you change enviromnent.
///

/// Creates the file ups_env.json

var nodemon = {
  verbose: true,
  ext: "js pug inc dylib so",
  ignore: ["static/**", "logs/*"],
}

var obj = { DYLD_LIBRARY_PATH :""
          , LD_LIBRARY_PATH   :""
          , ROOT_INCLUDE_PATH :""
          , PYTHONPATH        :""
          , PATH              :""
          };


nodemon.env = {};
for(v in obj) {
  nodemon.env[v] = process.env[v]; // get current variable.  
}

var fs = require('fs');

fs.writeFileSync("nodemon.json",JSON.stringify(nodemon,null,2));

          