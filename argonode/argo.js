/*********************************************************************
 * NAN - Native Abstractions for Node.js
 *
 * Copyright (c) 2018 NAN contributors
 *
 * MIT License <https://github.com/nodejs/nan/blob/master/LICENSE.md>
 ********************************************************************/

var addon = require('./build/Release/addon');

function ComposerWithQueue(config, output_callback) 
{
  if(!config) config = {};
  this.queue = [];
  this.composer = new addon.Composer(config);
  this.running = false;
  this.do_output = output_callback;
  this.shutting_down = false;
}

ComposerWithQueue.prototype.shutdown = function()
{
  this.queue = [];
  // Unbind response functions.
  this.do_output = null;
  this.do_end_of_request = null;
  this.composer = null;
  this.shutting_down = true;
}


ComposerWithQueue.prototype.request = function(req)
{
  if(this.shutting_down) return;
  this.queue.push(req);
  this.next_request(); // run it idle.
}

ComposerWithQueue.prototype.next_request = function()
{
  if(this.shutting_down) return;
  if(!this.running) {
    var next = this.queue.shift();
    if(next) {
      this.running = true;
      this.composer.composeIncremental(next,
        this.do_end_of_request.bind(this),
        this.do_output
      );
    }
  }
}


ComposerWithQueue.prototype.do_end_of_request = function(output)
{
  this.running  = false;
  if(this.shutting_down) return;
  this.next_request(); // Next in queue if any
  this.do_output(output);
}



module.exports=ComposerWithQueue;


/// End of library. Test code follows


if (require.main === module) {
  
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);
const chalk = require('chalk');

var test1 = function(filename){
  
    // main code
  
  // test code:
  var config={
    // "forking":true
  };

  var composer = new addon.Composer(config);

  console.log(composer);

  var request= {
    "filename":filename,
      // "/Users/tagg/Argo/Supernova_0016788_0307030_0313281.ubdaq";
      // "/Users/tagg/Argo/server/ana_hist_ceda4617-288a-4bd5-822d-a9207ce86188.root";
      // "/Users/tagg/Argo/server/larlite_pandoraCosmic.root";
      "entrystart":0,
      "entryend"  :99999,
      "selection" : "1", //"EventAuxiliary.id_.event_==1552",
      "options"   : "__NORAW__NOCAL__",
      // "piece"  : "/hits/recob::Hits_gaushit__DataRecoStage1",
      // "pieces" : [ "/hits/recob::Hits_pandoraCosmicHitRemoval__DataRecoStage2",
      //              "/hits/recob::Hits_trajcluster__DataRecoStage2",
      //             ]
  };

  // Synchronous request:
  // var r = composer.composeSync(request);

  function end_callback(result) {
    console.log(chalk.bold.blue("Result complete:"),result.length);
    var doc = JSON.parse(result);
    for(i in doc) {
      var s = JSON.stringify(doc[i]);
      console.log(i,"\t",s.length,"\t",s.substr(0,1000));
    }
    console.log("skeleton",doc.skeleton);
    // hack to make it not delete the composer prematurely:
  }
  
  function inc_callback(s) {
    var o = JSON.parse(s);
    console.log(chalk.bold.red("Callback Output"),s.length,chalk.red(Object.keys(o)));
  }
  
  
  console.log("READY TO WORK");

  // Asyncronous incremental request:
  composer.composeIncremental(request, end_callback, inc_callback);
  
  console.log("WORKING WORKING");
  delete composer;
  
}

function testSync() {
  var composer2 = new addon.Composer({});
  var request= {
    "filename":
    "/Users/tagg/PhysicsRun-2016_10_15_23_42_50-0008318-00001_20161016T055643_ext_unbiased_20161016T064506_merged.root",
      "entrystart":0,
      "entryend"  :99999,
      "selection" : "1",
      "options"   : "__NORAW__NOCAL__",
      "piece"  : "/hits/recob::Hits_gaushit__DataRecoStage1",
      "pieces" : [ "/hits/recob::Hits_pandoraCosmicHitRemoval__DataRecoStage2",
                   "/hits/recob::Hits_trajcluster__DataRecoStage2",
                  ]
  };
  var r = composer2.composeSync(request);
  console.log("Sync done");
}

function testQ(filename) {
    var config={
    // "forking":true
  };
  
  function got_out(data) {
    var o = JSON.parse(data);
    console.log(chalk.bold.red("Callback Output"),data.length);
    for(k in o) {
      s = JSON.stringify(o[k]);
      console.log("  ",
        chalk.red(k.padEnd(10)),
        s.length,
        s.substr(0,50)
      );
    }
  }

  var composer = new ComposerWithQueue(config,got_out);

  console.log(chalk.bold.green("Making request 1"));
  composer.request( {
      "filename":filename,
      "entrystart":0,
      "entryend"  :99999,
      "selection" : "1", //"EventAuxiliary.id_.event_==1552",
      "options"   : "__NORAW__NOCAL__",
      "piece"  : "/hits/recob::Hits_gaushit__DataRecoStage1",
   } );
   console.log(chalk.bold.green("Making request 2"));
   composer.request( {
       "filename":filename,
       "entrystart":0,
       "entryend"  :99999,
       "selection" : "1", //"EventAuxiliary.id_.event_==1552",
       "options"   : "__NORAW__NOCAL__",
       "piece"  : "/hits/recob::Hits_pandoraCosmicHitRemoval__DataRecoStage2",
    } );
   
  console.log("WORKING WORKING");

  setTimeoutPromise(8000, ).then((value) => {
    console.log(chalk.bold.green("Shutdown."));
    composer.shutdown();
  });  

}

function testSync() {
  var composer2 = new addon.Composer({});
  var request= {
    "filename":
    "/Users/tagg/PhysicsRun-2016_10_15_23_42_50-0008318-00001_20161016T055643_ext_unbiased_20161016T064506_merged.root",
      "entrystart":0,
      "entryend"  :99999,
      "selection" : "1",
      "options"   : "__NORAW__NOCAL__",
      "piece"  : "/hits/recob::Hits_gaushit__DataRecoStage1",
      "pieces" : [ "/hits/recob::Hits_pandoraCosmicHitRemoval__DataRecoStage2",
                   "/hits/recob::Hits_trajcluster__DataRecoStage2",
                  ]
  };
  var r = composer2.composeSync(request);
  console.log("Sync done");
}

  {
    new ComposerWithQueue({},null); // Should release immediately.
    console.log("Release now?");
  }
  testQ("/Users/tagg/PhysicsRun-2016_5_10_15_21_12-0006234-00031_20160802T075516_ext_unbiased_20160802T110203_merged_20160802T121639_reco1_20160802T144807_reco2_20171030T150606_reco1_20171030T162925_reco2.root");
  setTimeoutPromise(10000000, ).then((value) => {
    console.log(chalk.bold.green("All should be dead."));
  });  
    // testSync();
    
    //test1(      "/Users/tagg/PhysicsRun-2016_10_15_23_42_50-0008318-00001_20161016T055643_ext_unbiased_20161016T064506_merged.root");
    //test1( "/Users/tagg/PhysicsRun-2016_5_10_15_21_12-0006234-00031_20160802T075516_ext_unbiased_20160802T110203_merged_20160802T121639_reco1_20160802T144807_reco2_20171030T150606_reco1_20171030T162925_reco2.root");
}
