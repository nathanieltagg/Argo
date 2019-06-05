
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




  TFile* file = new TFile(argv[1],"READ");

  // ReadLarsoftConfig(event->getTFile(),jrequest);
  // ReadLarsoftConfig(event->getTFile(),jrequest);
  ReadLarsoftConfigAsJson(file);

  // Register the tkey VFS with sqlite:
  std::cout << jrequest.dump(2);
}
