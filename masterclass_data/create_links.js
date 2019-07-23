#!/bin/env node

const lineReader = require('line-reader');
const fs = require('fs');
var spawn = require('child_process');
var Promise = require('bluebird');


var config = {
	sam_arguments :["-e","uboone"]
}


function samweb()
{
  // Utility function to return promise samweb, assuming it's in the current PATH (set up by sam_web_client)
  // Returns array of lines.
  //
  //
  var sam_args = [...config.sam_arguments,...arguments];

  return new Promise(function(resolve,reject) {
    // console.time('samweb');
    spawn.execFile("samweb",sam_args,(error, stdout, stderr) => {
      if (error) {
        console.log("Samweb call failed:"," samweb "+sam_args.join(' '));
        console.log(stdout);
        console.log(stderr);
        return reject(Error("samweb failed "+error+" $ samweb "+sam_args.join(' ')));
      } else {
        // console.timeEnd('samweb');
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

var txt = fs.readFileSync('crossing_muons_run1_eventnumber.txt','utf8');
var lines = txt.split('\n');


var fd = fs.openSync("links2.html","w");
fs.appendFileSync(fd,
	"<!DOCTYPE html><html><body><h2>Crossing Muon Events</h2>"
	,'utf8');

async function do_it() {
	for(line of lines) {
		var spec = line.trim().split('/');
		try{
			const result = await samweb('list-files',"defname:run1_crossing_muons_reco2_lite and data_tier=reconstructed and file_size>100000 "+
					    	"and run_number="+spec[0]+"."+spec[1]);
		    var link = "https://argo-dev-microboone.fnal.gov/masterclass/#filename="
		    + encodeURIComponent(result[0])+"&selection="
		    	+ encodeURIComponent("EventAuxiliary.id_.subRun_.run_.run_=="+spec[0]
		    	   + "&&"
		    	   + "EventAuxiliary.id_.event_=="+spec[2]);
		    var h = "<a href='"+link+"'>Run "+spec[0]+" Subrun "+spec[1]+" Event "+spec[2]+"</a><br>"
			fs.appendFileSync(fd,h,'utf8');
	    } catch(e) { console.log(e); }
	}	
}

do_it().then(()=>{
	fs.appendFileSync(fd,
	"</body></html>"
	,'utf8');
	fs.closeFileSync(fs);
});


// This method also works,
// but doesn't output as it goes. 
// Still learning about async/await!
//
// var data = [];
// lineReader.eachLine('crossing_muons_run1_eventnumber.txt', async (line,done) => {
// 		var spec = line.split('/');
// 		// if(data.length<3) 
// 			data.push(spec);
// 		if(done) {
// 			let promises = await data.map(async(spec) => { // map instead of forEach
// 				    const result = await samweb('list-files',"defname:run1_crossing_muons_reco2_lite and data_tier=reconstructed and file_size>100000 "+
// 				    	"and run_number="+spec[0]+"."+spec[1]);

// 				    // construct the link.
// 				    var link = "https://argo-dev-microboone.fnal.gov/masterclass/#filename="
// 				    + encodeURIComponent(result[0])+"&selection="
// 				    	+ encodeURIComponent("EventAuxiliary.id_.subRun_.run_.run_=="+spec[0]
// 				    	   + "&&"
// 				    	   + "EventAuxiliary.id_.event_=="+spec[2]);

// 				    return {spec:spec, file:result[0],link:link};
// 				});


// 			const results = await Promise.all(promises);

// 			var fd = fs.openSync("links.html","w");
// 			fs.appendFileSync(fd,
// 				"<!DOCTYPE html><html><body><h2>Crossing Muon Events</h2>"
// 				,'utf8');

// 			for(r of results){
// 				var h = "<a href='"+r.link+"''>Run "+r.spec[0]+" Subrun "+r.spec[1]+" Event "+r.spec[2]+"</a><br>"
// 				fs.appendFileSync(fd,h,'utf8');

// 			}
// 			fs.appendFileSync(fd,
// 				"</body></html>"
// 				,'utf8');


// 			console.log(results);
// 			return false;
// 		}
// 	 return true;
// });
