
#include "TFile.h"
#include "TTree.h"

#include "ReadLarsoftConfig.h"

#include <iostream>
#include <string>
#include <vector>
#include "Timer.h"

using std::cerr;
using std::cout;
using std::endl;
using std::string;
using nlohmann::json;

#include "gallery/Event.h"
#include "GalleryComposer.h"
#include "UniversalComposer.h"

int main(int argc, char* argv[])
{
  // ------------------
  // use the boost command line option processing library to help out
  // with command line options
  json jrequest = 
     " { \"shift_hit_ticks\": {\"conditions\": [{ \"key\": \"module_type\", \"value\": \"RawDigitFilterUBooNE\"}], \"parameter\": \"NumTicksToDropFront\" } "
     " , \"gdml\":            {\"conditions\": [{ \"key\": \"service_type\", \"value\": \"Geometry\"}], \"parameter\": \"GDML\" } "
     " } "_json;

  if(argc<2) return 1;
  std::string filename = argv[1];
  gallery::Event* event = new gallery::Event({filename});
  event->goToEntry(0);

  GalleryComposer gc;
  ReadLarsoftConfig(event->getTFile(),jrequest);

  Config_t configuration(new nlohmann::json);
  // (*configuration)["CacheStoragePath"] = imagepath;
  // (*configuration)["CacheStorageUrl"]  = imageurl;
  std::string path = "../";
  (*configuration)["plexus"] = { {"tpc_source", std::string("sqlite ").append(path).append("db/current-plexus.db")}
                               , {"pmt_source", std::string("sqlite ").append(path).append("db/current-plexus.db")}
                               };
    
  // gTimeStart = gSystem->Now();
  // cout << "Request Parameters:" << endl;
  // cout << "    Filename: --" << filename << "--" << endl;
  // cout << "    Selection:--" << selection << "--" << endl;
  // cout << "    From:     --" << entrystart << " to " << entryend << endl;
  // cout << "    Options:  --" << options << endl;

  Request_t request(new nlohmann::json);
  (*request)["options"] = "";
  (*request)["filename"] = filename;
  (*request)["selection"] = "1";
  (*request)["entrystart"] = 0;
  (*request)["entryend"] = 10000;

  UniversalComposer composer;
  composer.configure(configuration);
  Output_t payload = composer.satisfy_request(request);




  TFile* file = new TFile(argv[1],"READ");

  ReadLarsoftConfig(event->getTFile(),jrequest);

  // Register the tkey VFS with sqlite:
  std::cout << jrequest.dump(2);
}
