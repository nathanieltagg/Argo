'use strict';

var spawn = require('child_process');
var config = require("./configuration.js"); // loads config.js

function samweb()
{
  // Utility function to return promise samweb, assuming it's in the current PATH (set up by sam_web_client)
  // Returns array of lines.
  //
  //
  var sam_args = [...config.sam_arguments,...arguments];
  console.trace("samweb stack");
  return new Promise(function(resolve,reject) {
    console.time('samweb');
    spawn.execFile("samweb",sam_args,(error, stdout, stderr) => {
      if (error) {
        console.log("Samweb call failed:"," samweb "+sam_args.join('**'));
        console.log(stdout);
        console.log(stderr);
        return reject(Error("samweb failed "+error+" $ samweb "+sam_args.join(' ')+"*DONE*"));
      } else {
        console.timeEnd('samweb');
        var lines = stdout.split("\n");  // split newlines
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

function sam_find_event(run, subrun, event, definition)
{
  return new Promise(function(resolve,reject){
    samweb('list-files',
           'defname:'+definition+' and run_number='+run+"."+subrun
           +" and file_format artroot with limit 1")
    .then(fn2 => sam_locate_file(fn2[0]), err=>reject(err))
    .then(loc => resolve(loc), err=>reject(err))
    .catch(err=>reject(err));
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




module.exports.samweb = samweb;
module.exports.sam_locate_file = sam_locate_file;
module.exports.sam_get_raw_ancestor = sam_get_raw_ancestor;
module.exports.sam_find_event = sam_find_event;


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
