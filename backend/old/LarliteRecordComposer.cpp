//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//
#ifdef LARLITE

#include <TTree.h>
#include <TLeaf.h>
#include <TFile.h>
#include <TROOT.h>
#include <TH1F.h>
#include <TH1D.h>
#include <TLorentzVector.h>

#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <algorithm>
#include <time.h>
#include <math.h>
#include <stdio.h>


#include "LarliteRecordComposer.h"
#include "JsonElement.h"
#include "TimeReporter.h"
#include "TreeReader.h"
#include "TreeElementLooter.h"
#include "RootToJson.h"
#include "crc32checksum.h"
#include "GetSloMonDB.h"
#include "wireOfChannel.h"
#include "waveform_tools.h"

#include <stdlib.h>

#include "boost/thread/thread.hpp"
#include "boost/thread/mutex.hpp"
#include "boost/thread/shared_mutex.hpp"


#include "DataFormat/track.h"
#include "DataFormat/hit.h"

using namespace std;



LarliteRecordComposer::LarliteRecordComposer(JsonObject& output, const std::string& filename, Long64_t jentry, const std::string options)
  : fOutput(output), fFilename(filename), fEntry(jentry), fOptions(options)
{
  
  fCacheStoragePath     = "../live_event_cache";
  fCacheStorageUrl      = "live_event_cache";
  fWorkingSuffix = "working";
  fFinalSuffix   = "event";
  fCreateSubdirCache = true;  

}
  
LarliteRecordComposer::~LarliteRecordComposer()
{
}


void LarliteRecordComposer::compose()
{
  fCurrentEventDirname = fCacheStoragePath;
  fCurrentEventUrl     = fCacheStorageUrl;
 
  fStorage_manager.set_io_mode(fStorage_manager.kREAD);
  fStorage_manager.add_in_filename(fFilename);

  int dummy;
  fOutput.add("composer",abi::__cxa_demangle(typeid(*this).name(),0,0,&dummy));
  
  if(!fStorage_manager.open()) {
    std::cerr << "Couldn't open storage manager on file " << fFilename << std::endl;
    fOutput.add("error",std::string("Couldn't open storage manager on file ") + fFilename);
    return;
  }
  if(!fStorage_manager.go_to(fEntry)) {
    std::cerr << "Can't go_to entry " << fEntry << std::endl;
    fOutput.add("error",std::string("Can't go_to entry ") + std::to_string(fEntry));
    return;
  }
  
  for(auto prod: fStorage_manager.list_input_product()) {
    std::cout << Form("product type %3d %10s %s",prod.first, larlite::data::kDATA_TREE_NAME[prod.first].c_str(), prod.second.c_str()) << std::endl;
  }

  compose_header();
  compose_hits();
  compose_tracks();
  compose_associations();
  
  
  
  
}

void LarliteRecordComposer::compose_header()
{
  JsonObject header;
  
  header.add("run",fStorage_manager.run_id());
  header.add("subrun",fStorage_manager.subrun_id());
  header.add("event",fStorage_manager.event_id());

  header.add("timeLow",-1);
  header.add("timeHigh",-1);
  header.add("isRealData",-1);
  header.add("experimentType",-1);
  

  header.add("seconds",0);
  header.add("daqTime",0);
  
  header.add("eventTime",0); // in ms.
  header.add("swizzlertime",0);

  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("header",header);
  }
}

void LarliteRecordComposer::compose_hits()
{
  JsonObject reco_list;
  for(auto prod: fStorage_manager.list_input_product()) {
    if(prod.first == larlite::data::kHit) {
      std::string name = prod.second;
      TimeReporter timer(name);
      
      std::cout << "Found hit product " << name << std::endl;
      
      auto hits = fStorage_manager.get_data<larlite::event_hit>(name);
      JsonArray jhits;
      for(auto const& hit: *hits) {
        JsonObject jhit;
        jhit.add("wire", hit.WireID().Wire);
        jhit.add("plane", hit.WireID().Plane);
        jhit.add("q", hit.Integral());
        jhit.add("t", hit.PeakTime());
        jhit.add("t1", hit.StartTick());
        jhit.add("t2", hit.EndTick());

        jhits.add(jhit);
      }
      
      
      reco_list.add(name,jhits);
      timer.addto(fStats);
    }
  }
  
  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("hits",reco_list);
  }
}

void LarliteRecordComposer::compose_tracks()
{
  JsonObject reco_list;
  for(auto prod: fStorage_manager.list_input_product()) {
    if(prod.first == larlite::data::kTrack) {
      std::string name = prod.second;
      TimeReporter timer(name);
      
      std::cout << "Found track product " << name << std::endl;
      
      auto tracks = fStorage_manager.get_data<larlite::event_track>(name);
      JsonArray jtracks;
      for(auto const& track: *tracks) {
        JsonObject jtrk;
        jtrk.add("id",track.ID());
        JsonArray jpoints;
        for(int ii=0;ii<track.NumberTrajectoryPoints(); ii++) 
        {
          JsonObject jpoint;
          const TVector3& Dir = track.DirectionAtPoint(ii);
          const TVector3& XYZ = track.LocationAtPoint(ii);
          jpoint.add("x", XYZ.x());
          jpoint.add("y", XYZ.y());
          jpoint.add("z", XYZ.z());
          jpoint.add("vx",Dir.x());
          jpoint.add("vy",Dir.y());
          jpoint.add("vz",Dir.z());
          if(track.NumberFitMomentum() > ii) jpoint.add("P",track.MomentumAtPoint(ii));
          jpoints.add(jpoint);
        }
        jtrk.add("points",jpoints);
        
        jtracks.add(jtrk);
      }
      
      
      reco_list.add(name,jtracks);
      timer.addto(fStats);
    }
  }
  
  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("tracks",reco_list);
  }
}

void LarliteRecordComposer::compose_associations()
{
  for(auto prod: fStorage_manager.list_input_product()) {
    if(prod.first == larlite::data::kAssociation) {
      std::string name = prod.second;
      
      std::cout << "Found ass product " << name << std::endl;
    }
  }
}


#endif
