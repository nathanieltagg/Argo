//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include "AnalysisTreeComposer.h"

#include <TTree.h>
#include <TLeaf.h>
#include <TFile.h>
#include <TH1F.h>
#include <TH1D.h>
#include <TLorentzVector.h>
#include "Timer.h"

#include "json.hpp"
#include "TimeReporter.h"
#include "TreeReader.h"
#include "TreeElementLooter.h"
#include "RootToJson.h"
#include "json_tools.h"
#include "crc32checksum.h"
#include "GetSloMonDB.h"

#include <stdlib.h>


using namespace std;
using nlohmann::json;

AnalysisTreeComposer::AnalysisTreeComposer()
  : m_file(nullptr)
  , m_tree(nullptr)
{
}
  
AnalysisTreeComposer::~AnalysisTreeComposer()
{
}

void AnalysisTreeComposer::initialize()
{
}

Output_t AnalysisTreeComposer::satisfy_request(Request_t request)
{
  std::cout << "ANALYSISTREE COMPOSER!!!" << std::endl;
  TimeReporter timer("TOTAL");

  m_request = request;
  m_result["request"] = *request;  

  if(request->find("filename")==request->end()) {
    return Error("No file requested");
  }
  m_filename =  (*request)["filename"].get<std::string>();
  std::string sel   = request->value("selection","1");
  long long     start = request->value("entrystart",(long long)0);
  long long     end   = request->value("entryend",(long long)999999999);
  m_options = request->value("options",std::string(""));
  
  m_entry = start;  
  {
    TimeReporter tr("Open file");
    m_file = new TFile(m_filename.c_str(),"READ");
    if(!m_file->IsOpen()) {
      delete m_file;
      return Error("File could not be opened for reading"); 
    }
    m_tree = dynamic_cast<TTree*>(m_file->Get("analysistree/anatree"));
    if(!m_tree) {
      delete m_file;
      return Error("Could not find analysistree/anatree in file " + m_filename);
    }
    tr.addto(m_stats);
  }
  
  {
    TimeReporter tr("Find event");
    std::string err;
    m_entry = find_entry_in_tree(m_tree, sel, start, end, err);
    if(m_entry<0) {
      m_tree = 0;
      delete m_file;
      return Error(err);
    }
  }
  
  json source;
  source["file"] = m_filename;
  // source["selection"] = inSelection;
  source["start"] = start;
  source["end"] = end;
  source["entry"] = m_entry;
  source["options"] = m_options;
  source["selection"] = sel;
  m_result["source"] = source;

  m_result["composer_id"] = m_id;
  m_result["monitor"] = monitor_data();

  compose();
  return dump_result();
}

void AnalysisTreeComposer::compose()
{
  

  // parse some options.

  // Set branches to read here.
  m_tree->SetBranchStatus("*",1);  // By default, read everything.
  
  // m_tree->SetBranchStatus("anab::*",0); // Don't analyze this yet.
  // m_tree->SetBranchStatus("sim::Photonss*",0); // Don't analyze this yet.
  // m_tree->SetBranchStatus("sim::Channels*",0); // Don't analyze this yet.
  // m_tree->SetBranchStatus("sim::AuxDetChannels*",0); // Don't analyze this yet.
  
  m_tr.setTree(m_tree);
  m_tree->GetEntry(m_entry);
  composeHeader();
  composeHits();
  composeTracks();
  composeOpFlash();
  // composeClusters();
  // composeVertices();
  // etc.
}


void AnalysisTreeComposer::composeHeader()
{
  // Header data. Alas, this is the stuff that's nearly impossible to get!  
  json header;
  header["run"] = m_tr.getJson("run");
  header["subrun"] = m_tr.getJson("subrun");
  header["event"] = m_tr.getJson("event");
  header["eventTime"] = m_tr.getVal("evttime")*1000;
  header["isRealData"] = m_tr.getInt("isdata");
  header["experimentType"] = m_tr.jsonF("EventAuxiliary.experimentType_");
  header["daqTime"] = m_tr.getVal("evttime")*1000;
  
  json trigger;
  trigger["triggerword"] = m_tr.getJson("triggerbits");
  header["trigger"] = trigger;
  {
    boost::mutex::scoped_lock lck(m_result_mutex);
    m_result["header"] = header;
  }
}

void AnalysisTreeComposer::composeHits()
{
  json reco_list;
  json hist_list;
  
  TimeReporter timer("ana_hits");
    

  TLeaf* l = m_tree->GetLeaf("no_hits_stored");
  if(!l) return;
  int nhits = m_tr.getInt("no_hits_stored");
  cout << "nhits: " << nhits << endl;
  
  // Hit histograms.
  TH1D timeProfile("timeProfile","timeProfile",960,0,9600);
  std::vector<TH1*> planeProfile;
  planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",218,0,2398));
  planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",218,0,2398));
  planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",432,0,3456));

  json arr;
  for(int i=0;i<nhits;i++){
    json h;
    int wire  = m_tr.getInt("hit_wire" ,i);
    int plane = m_tr.getInt("hit_plane"  ,i);
    double q  = m_tr.getVal("hit_charge"     ,i);
    double t  = m_tr.getVal("hit_peakT"    ,i);
    double t1  = m_tr.getVal("hit_startT"    ,i);
    double t2  = m_tr.getVal("hit_endT"  ,i);
    if(plane==2)timeProfile.Fill(t,q);
    if(plane>=0 && plane<3) planeProfile[plane]->Fill(wire,q);
    h["wire"] =     wire  ;
    h["plane"] =    plane ;
    h["q"] =        jsontool::fixed(q,0)     ;
    h["t"] =        jsontool::fixed(t,1)     ;
    h["t1"] =       jsontool::fixed(t1,1)    ;
    h["t2"] =       jsontool::fixed(t2,1)    ;
    arr.push_back(h);
  }

  reco_list["ana"] = arr;
  
  json hists;
  hists["timeHist"] = TH1ToHistogram(&timeProfile);
  json jPlaneHists;
  jPlaneHists.push_back(TH1ToHistogram(planeProfile[0]));
  jPlaneHists.push_back(TH1ToHistogram(planeProfile[1]));
  jPlaneHists.push_back(TH1ToHistogram(planeProfile[2]));
  hists["planeHists"] = jPlaneHists;

  delete planeProfile[0];
  delete planeProfile[1];
  delete planeProfile[2];    
  hist_list["ana"] = hists;
  timer.addto(m_stats);
  {
    boost::mutex::scoped_lock lck(m_result_mutex);
  
    m_result["hits"] = reco_list;
    m_result["hit_hists"] = hist_list;
  }
}


void AnalysisTreeComposer::composeTracks()
{
	json reco_list;
	// Get list of tracks types.

	std::vector< std::string > track_types;
    TObjArray* list = m_tree->GetListOfLeaves();
    for(int i=0;i<list->GetEntriesFast();i++) {
      TObject* o = list->At(i);
	  TString name = o->GetName();
	  if(name.BeginsWith("ntracks_")) {
		  std::string trkname = name.Data()+8;
		  std::cout << "Found track name " << trkname << std::endl;
		  track_types.push_back(trkname);	  	
	  }
    }
	
	for(std::string trkname: track_types) 
	{
		json tracks;
		int n = m_tr.getInt(std::string("ntracks_")+trkname);
		for(int i=0;i<n; i++) {
			json trk;
			trk["id"] = m_tr.getInt(std::string("trkId_")+trkname,i);
			
			// Get array sizes for trackpoints.
			TLeaf* lxyz = m_tree->GetLeaf((std::string("trkxyz_")+trkname).c_str());
			if(!lxyz) return;
			//int r1 = 3;
			int r2 = 2000;
			int r3 = 3;
			// That is, the trkxyz has dimensions [ntrack][3][2000][3]
			// Adujust.
			r2 = lxyz->GetLenStatic() / 9;
			
			json jhits;
      // for(int iplane=0;iplane<3;iplane++){ // We don't need all 3 planes!
      int iplane = 2; {
				int nhits_in_plane = m_tr.getInt(std::string("ntrkhits_")+trkname,i,iplane);
				for(int ihit = 0;ihit < nhits_in_plane; ihit++) {
					json jhit;
					int index = iplane*(r2*r3) + ihit*(r3);
					double x = m_tr.getVal(lxyz,i,index+0);
					double y = m_tr.getVal(lxyz,i,index+1);
					double z = m_tr.getVal(lxyz,i,index+2);
				  jhit["x"] = x;
				  jhit["y"] = y;
				  jhit["z"] = z;
					jhits.push_back(jhit);
				}
			}
			trk["points"] = jhits;
			tracks.push_back(trk);
		}
		reco_list[trkname] = tracks;
	}
    {
      boost::mutex::scoped_lock lck(m_result_mutex);
      m_result["tracks"] = reco_list;
    }
}

void AnalysisTreeComposer::composeOpFlash()
{
	json reco_list;
	json jflashes;
  TimeReporter timer("opflash");
  int n = m_tr.getInt("no_flashes");
  for(int i=0;i<n; i++) {
		json jflash;
    jflash["time"       ] = m_tr.getJson("flash_time",i);
    jflash["timeWidth"  ] = m_tr.getJson("flash_timewidth",i);
    // jflash["absTime"    ] = m_tr.getJson("obj.fAbsTime",i);
    jflash["yCenter"    ] = m_tr.getJson("flash_ycenter",i);
    jflash["yWidth"     ] = m_tr.getJson("flash_ywidth",i);
    jflash["zCenter"    ] = m_tr.getJson("flash_zcenter",i);
    jflash["zWidth"     ] = m_tr.getJson("flash_zwidth",i);
    // jflash["onBeamTime" ] = m_tr.getJson("obj.fOnBeamTime",i);
    // jflash["inBeamFrame"] = m_tr.getJson("obj.fInBeamFrame",i);
    jflash["totPe"] =       m_tr.getJson("flash_pe",i);
    
    json dummy;
    dummy.push_back(0);    dummy.push_back(0);    dummy.push_back(0);
    jflash["wireCenter"] = dummy;
    jflash["wireWidths"] = dummy;
    jflash["pePerOpDet"] = dummy;

    jflashes.push_back(jflash);
  }
  reco_list["ana"] = jflashes;
  timer.addto(m_stats);
  {
  boost::mutex::scoped_lock lck(m_result_mutex);
  m_result["opflashes"] = reco_list;
  }
}
    



// void AnalysisTreeComposer::composeVertex()
// {
//
// }


