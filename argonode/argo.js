/*********************************************************************
 * NAN - Native Abstractions for Node.js
 *
 * Copyright (c) 2018 NAN contributors
 *
 * MIT License <https://github.com/nodejs/nan/blob/master/LICENSE.md>
 ********************************************************************/

var addon = require('./build/Release/addon');

module.exports=addon.Factory;


var test = function(){
    // main code
  
  // test code:
  var config={"max_composers":123};

  var factory = new addon.Factory(config);

  console.log(factory);

  var request= {
    "filename":
    "/Users/tagg/PhysicsRun-2016_5_10_15_21_12-0006234-00031_20160802T075516_ext_unbiased_20160802T110203_merged_20160802T121639_reco1_20160802T144807_reco2_20171030T150606_reco1_20171030T162925_reco2.root",
      // "/Users/tagg/Argo/Supernova_0016788_0307030_0313281.ubdaq";
      // "/Users/tagg/Argo/server/ana_hist_ceda4617-288a-4bd5-822d-a9207ce86188.root";
      // "/Users/tagg/Argo/server/larlite_pandoraCosmic.root";
      "entrystart":0,
      "entryend"  :99999,
      "selection" : "1",
      "options"   : "__NORAW__NOCAL__"
  };

  // Synchronous request:
  // var r = factory.composeSync(request);

  function check_result(result) {
    console.log("Result complete:",result.length);
    var doc = JSON.parse(result);
    for(i in doc) {
      var s = JSON.stringify(doc[i]);
      console.log(i,"\t",s.length,"\t",s.substr(0,20));
    }
  }
  // Asyncronous request:
  // factory.compose(request, check_result);
  // console.log("WORKING WORKING");

  // Asyncronous request with a progressbar callback::
  factory.composeWithProgress(request,check_result,
      function(s) {
          console.log("PROGRESS CALLBACK PPPPPPP" + s);
        }

  );
  console.log("WORKING WORKING");
  
  
}

if (require.main === module) {
    test();
}
