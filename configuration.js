'use strict';


// Programming note:
// top level module code only executes once!
// This code will only be run by first require-er.

// conifig defaults:
var defaults = {
  datacache: __dirname + "/datacache",
  datacache_max_files: 100,
  datacache_max_age:   3600000, // one hour, in ms
  sam_arguments :["-e","uboone"],
  live_event_cache: __dirname + "/live_event_cache",
}
defaults.composer_config = {
   "forking": false,
   "CacheStoragePath": defaults.datacache,
   "CacheStorageUrl": "/datacache",
   "WorkingSuffix": "event",
   "CreateSubdirCache": true,
  "fork_logdir": __dirname+"/logs/",
  "DeadChannelDB":__dirname+"/db/dead_channels.txt",
  plexus: {
    tpc_source:"sqlite "+__dirname+"/db/current-plexus.db",
    pmt_source:"sqlite "+__dirname+"/db/current-plexus.db",
  }
}
var config;
if(!config) config = require('deepmerge')(defaults,require('./config.js'));
console.log("config:",config);


module.exports = config;
