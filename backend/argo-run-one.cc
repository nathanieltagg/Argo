//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include <stdlib.h>
#include <stdio.h>
#include <iostream>
#include <fstream>

#include <TROOT.h>
#include <TRint.h>
#include <TStyle.h>
#include <TSystem.h>
#include <TTimeStamp.h>
#include <TError.h>

#include "ComposerFactory.h"

#include <signal.h>
#include <algorithm>
#include <string>
#include <boost/program_options.hpp>


using namespace std;




int main(int argc, char **argv)
{
  std::string progname = argv[0];
  std::string options = "_tilesize1024_";
  std::string filename;
  std::string selection ="1";
  Long64_t entrystart = 0;
  Long64_t entryend = 1000000000;
  std::string jsonfilename = "out.json";  
  std::string path = "../";
  
  namespace po = boost::program_options;
  using std::string;
  po::options_description desc ( "Allowed options" );
  desc.add_options()
     ( "help,h"                              , "Help message" )
     ( "input-file,i",  po::value<string >(), "Input DAQ/ROOT file" )
     ( "options,o",     po::value<string >(), "Processing options (default _tilesize1024_)" )
     ( "selection,s" ,  po::value<string>(),     "Selection String (default '1')")
     ( "start" ,        po::value<int>(),     "Entrystart (default 0)")
     ( "end" ,          po::value<int>(),     "Entryend (default 1000000000)")
     ( "output,j",      po::value<string>(), "JSON output file (default out.json)" )
     ( "path,p",        po::value<string>(), "Path to ARGO hierarchy (db,datacache,etc) " )
       
             ;
  
  po::variables_map vm;
  // po::store(po::command_line_parser(argc, argv).
  //           options(desc).run(), vm);
  po::store(po::parse_command_line(argc, argv, desc), vm);
  po::notify(vm);    
  
  if (vm.count("help")) {
      cout << desc << "\n";
      return 1;
  }
  if (vm.count("input-file"))
  {
    filename = vm["input-file"].as<string>();
  } else {
    cout << desc << "\n";
    return 1;    
  }
  
  if (vm.count("options")) {
    options = vm["options"].as<string>();
  }
  if (vm.count("selection")) {
    selection = vm["selection"].as<string>();
  }
  if (vm.count("start")) {
    entrystart = vm["start"].as<int>();
  }
  if (vm.count("end")) {
    entryend = vm["end"].as<int>();
  }
  if (vm.count("output")) {
    jsonfilename = vm["output"].as<string>();
  }
  if (vm.count("path")) {
    path = vm["path"].as<string>();
  }


  Config_t configuration(new nlohmann::json);
  (*configuration)["CacheStoragePath"] = "../datacache";
  (*configuration)["CacheStorageUrl"]  = "datacache";
  (*configuration)["plexus"] = { {"tpc_source", std::string("sqlite ").append(path).append("db/current-plexus.db")}
                               , {"pmt_source", std::string("sqlite ").append(path).append("db/current-plexus.db")}
                               };
    
  // gTimeStart = gSystem->Now();
  cout << "Request Parameters:" << endl;
  cout << "    Filename: --" << filename << "--" << endl;
  cout << "    Selection:--" << selection << "--" << endl;
  cout << "    From:     --" << entrystart << " to " << entryend << endl;
  cout << "    Options:  --" << options << endl;

  Request_t request(new nlohmann::json);
  (*request)["options"] = options;
  (*request)["filename"] = filename;
  (*request)["selection"] = selection;
  (*request)["entrystart"] = entrystart;
  (*request)["entryend"] = entryend;

  ComposerFactory factory;
  factory.configure(configuration);
  Output_t payload = factory.compose(request);
  
  ofstream outstream(jsonfilename.c_str());
  outstream << *payload;
  outstream.close();
}
