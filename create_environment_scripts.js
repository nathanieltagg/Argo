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

fs.writeFileSync("pm2.json",JSON.stringify(pm2,null,2));


if(fs.existsSync("/etc/systemd/system"))
{
  // We're running on a linux system, so we want to use PM2.

  // Create an environment file usable by the PM2 startup script.
  // We'll do this by creating an extra config file that systemd looks at, which is cool!
  // https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/7/html/system_administrators_guide/sect-Managing_Services_with_systemd-Unit_Files#brid-Managing_Services_with_systemd-Extending_Unit_Config

  // The downside to this method: all scripts run under pm2 will use this enviroment! Boo!

  // Build the file.
  var cf = "";
  cf += "# File auto-generated by Argo create_environment_scripts.js\n";
  cf += "Environment=PATH="+process.env["PATH"]+"\n";
  cf += "Environment=LD_LIBRARY_PATH="+process.env["LD_LIBRARY_PATH"]+"\n";
  cf += "Environment=ROOT_INCLUDE_PATH="+process.env["ROOT_INCLUDE_PATH"]+"\n";
  cf += "Environment=PYTHONPATH="+process.env["PYTHONPATH"]+"\n";
  cf += "Environment=PYTHONHOME="+process.env["PYTHONHOME"]+"\n";


  var need_to_redeploy = true;
  var conf_file_path = "/etc/systemd/system/pm2-"+process.env["USER"]+".service.d/";
  var conf_file_name = "argo-environment.conf";

  if(fs.existsSync(conf_file_path+conf_file_name)) {
    var old_cf = fs.readFileSync(conf_file_path+conf_file_name);
    if(old_cf == cf) need_to_redeploy = false;
  }
  if(need_to_redeploy) {
    fs.writeFileSync(conf_file_name,cf);    
    console.log("PM2 environment is not ready. To prepare:");
    if(!fs.existsSync(conf_file_path))
      console.log('   ksu -a -c "mkdir -m 755 '+conf_file_path+'"');
    console.log  ('   ksu -a -c "cp ./'+conf_file_name+' '+conf_file_path+conf_file_name+ '" && rm ./'+conf_file_name );
    console.log  ('   ksu -a -c "systemctl daemon-reload"');
    console.log  ('   ksu -a -c "systemctl restart pm2-'+process.env["USER"]+'.service"');

  }
}






          
