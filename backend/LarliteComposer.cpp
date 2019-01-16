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


#include "json.hpp"
#include "LarliteComposer.h"
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
using nlohmann::json;


LarliteComposer::LarliteComposer()
{
}
  
LarliteComposer::~LarliteComposer()
{
}

void LarliteComposer::initialize()
{}
  
  
void LarliteComposer::satisfy_request(Request_t request, Result_t output)
{
  std::cout << "LARLITE COMPOSER!!!" << std::endl;
  TimeReporter timer("TOTAL");
  
  assert(output.get());
  

  m_request = request;
  m_result = output;
  (*m_result)["request"] = *request;  

  if(request->find("filename")==request->end()) {
    (*m_result)["error"] = "No file requested";
    return;
  }
  m_filename =  (*request)["filename"].get<std::string>();
  std::string sel   = request->value("selection","1");
  long long     start = request->value("entrystart",(long long)0);
  long long     end   = request->value("entryend",(long long)999999999);
  m_options = request->value("options",std::string(""));
  
  m_entry = start; 
  TFile* file = nullptr;
  TTree* tree = nullptr;
  {
    TimeReporter tr("Open file");
    file = new TFile(m_filename.c_str(),"READ");
    if(!file->IsOpen()) {
      delete file;
      (*m_result)["error"] = "File could not be opened for reading";      
      return;
    }
    tree = dynamic_cast<TTree*>(file->Get("larlite_id_tree"));
    if(!tree) {
      delete file;
      (*m_result)["error"] = "Could not find larlite_id_tree in file " + m_filename;      
      return;
    }
    tr.addto(m_stats);
  }
  
  {
    TimeReporter tr("Find event");
    std::string err;
    m_entry = find_entry_in_tree(tree, sel, start, end, err);
    if(m_entry<0) {
      delete file;
      (*m_result)["error"] = err;
      return;    
    }
  }
  delete file;
  
  json source;
  source["file"] = m_filename;
  // source["selection"] = inSelection;
  source["start"] = start;
  source["end"] = end;
  source["entry"] = m_entry;
  source["options"] = m_options;
  source["selection"] = sel;
  (*m_result)["source"] = source;

  (*m_result)["monitor"] = monitor_data();

  compose();
}



void LarliteComposer::compose()
{
  m_storage_manager.set_io_mode(m_storage_manager.kREAD);
  m_storage_manager.add_in_filename(m_filename);

  
  if(!m_storage_manager.open()) {
    std::cerr << "Couldn't open storage manager on file " << m_filename << std::endl;
    (*m_result)["error"] = std::string("Couldn't open storage manager on file ") + m_filename;
    return;
  }
  if(!m_storage_manager.go_to(m_entry)) {
    std::cerr << "Can't go_to entry " << m_entry << std::endl;
    (*m_result)["error"] = std::string("Can't go_to entry ") + std::to_string(m_entry);
    return;
  }
  
  for(auto prod: m_storage_manager.list_input_product()) {
    std::cout << Form("product type %3d %10s %s",prod.first, larlite::data::kDATA_TREE_NAME[prod.first].c_str(), prod.second.c_str()) << std::endl;
  }

  compose_header();
  compose_hits();
  compose_tracks();
  compose_associations();
  
  
  
  
}

void LarliteComposer::compose_header()
{
  json header;
  
  header["run"] = m_storage_manager.run_id();
  header["subrun"] = m_storage_manager.subrun_id();
  header["event"] = m_storage_manager.event_id();

  header["timeLow"] = -1;
  header["timeHigh"] = -1;
  header["isRealData"] = -1;
  header["experimentType"] = -1;
  

  header["seconds"] = 0;
  header["daqTime"] = 0;
  
  header["eventTime"] = 0; // in ms.
  header["swizzlertime"] = 0;

  {
    boost::mutex::scoped_lock lck(m_result_mutex);
    (*m_result)["header"] = header;
  }
}

void LarliteComposer::compose_hits()
{
  json reco_list;
  for(auto prod: m_storage_manager.list_input_product()) {
    if(prod.first == larlite::data::kHit) {
      std::string name = prod.second;
      TimeReporter timer(name);
      
      std::cout << "Found hit product " << name << std::endl;
      
      auto hits = m_storage_manager.get_data<larlite::event_hit>(name);
      json jhits;
      for(auto const& hit: *hits) {
        json jhit;
        jhit["wire"] =  hit.WireID().Wire;
        jhit["plane"] =  hit.WireID().Plane;
        jhit["q"] =  hit.Integral();
        jhit["t"] =  hit.PeakTime();
        jhit["t1"] =  hit.StartTick();
        jhit["t2"] =  hit.EndTick();

        jhits.push_back(jhit);
      }
      
      
      reco_list[name] = jhits;
      timer.addto(m_stats);
    }
  }
  
  {
    boost::mutex::scoped_lock lck(m_result_mutex);
    (*m_result)["hits"] = reco_list;
  }
}

void LarliteComposer::compose_tracks()
{
  json reco_list;
  for(auto prod: m_storage_manager.list_input_product()) {
    if(prod.first == larlite::data::kTrack) {
      std::string name = prod.second;
      TimeReporter timer(name);
      
      std::cout << "Found track product " << name << std::endl;
      
      auto tracks = m_storage_manager.get_data<larlite::event_track>(name);
      json jtracks;
      for(auto const& track: *tracks) {
        json jtrk;
        jtrk["id"] = track.ID();
        json jpoints;
        for(int ii=0;ii<track.NumberTrajectoryPoints(); ii++) 
        {
          json jpoint;
          const TVector3& Dir = track.DirectionAtPoint(ii);
          const TVector3& XYZ = track.LocationAtPoint(ii);
          jpoint["x"] =  XYZ.x();
          jpoint["y"] =  XYZ.y();
          jpoint["z"] =  XYZ.z();
          jpoint["vx"] = Dir.x();
          jpoint["vy"] = Dir.y();
          jpoint["vz"] = Dir.z();
          if(track.NumberFitMomentum() > ii) jpoint["P"] = track.MomentumAtPoint(ii);
          jpoints.push_back(jpoint);
        }
        jtrk["points"] = jpoints;
        
        jtracks.push_back(jtrk);
      }
      
      
      reco_list[name] = jtracks;
      timer.addto(m_stats);
    }
  }
  
  {
    boost::mutex::scoped_lock lck(m_result_mutex);
    (*m_result)["tracks"] = reco_list;
  }
}

void LarliteComposer::compose_associations()
{
  for(auto prod: m_storage_manager.list_input_product()) {
    if(prod.first == larlite::data::kAssociation) {
      std::string name = prod.second;
      
      std::cout << "Found ass product " << name << std::endl;
    }
  }
}


#endif
