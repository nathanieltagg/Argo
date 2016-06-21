//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include <TTree.h>
#include <TLeaf.h>
#include <TFile.h>
#include <TROOT.h>
#include <TH1F.h>
#include <TH1D.h>
#include <TLorentzVector.h>
#include <TTreeFormula.h>
#include "TBranchElement.h"
#include "TStreamerInfo.h"
#include "Timer.h"
#include "TVirtualCollectionProxy.h"

#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <algorithm>
#include <time.h>
#include <math.h>
#include <stdio.h>
#include <TTreeFormula.h>


#include "AnaRecordComposer.h"
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

using namespace std;



AnaRecordComposer::AnaRecordComposer(JsonObject& output, TTree* tree, Long64_t jentry, const std::string options)
  : fOutput(output), fTree(tree), fEntry(jentry), fOptions(options), ftr(tree)
{
  fCacheStoragePath     = "../live_event_cache";
  fCacheStorageUrl      = "live_event_cache";
  fWorkingSuffix = "working";
  fFinalSuffix   = "event";
  fCreateSubdirCache = true;  
}
  
AnaRecordComposer::~AnaRecordComposer()
{
}


void AnaRecordComposer::compose()
{
  fCurrentEventDirname = fCacheStoragePath;
  fCurrentEventUrl     = fCacheStorageUrl;
  
  // parse some options.

  // Set branches to read here.
  fTree->SetBranchStatus("*",1);  // By default, read everything.
  
    // fTree->SetBranchStatus("raw::RawDigits*",doRaw); // Speed!
  // fTree->SetBranchStatus("recob::Wires*"  ,doCal); // Speed!
  //
  // fTree->SetBranchStatus("anab::*",0); // Don't analyze this yet.
  // fTree->SetBranchStatus("sim::Photonss*",0); // Don't analyze this yet.
  // fTree->SetBranchStatus("sim::Channels*",0); // Don't analyze this yet.
  // fTree->SetBranchStatus("sim::AuxDetChannels*",0); // Don't analyze this yet.
  
  fTree->GetEntry(fEntry);
  composeHeader();
  composeHits();
  // composeTracks();
  // composeClusters();
  // composeVertices();
  // etc.

}

void AnaRecordComposer::composeHeader()
{
  // Header data. Alas, this is the stuff that's nearly impossible to get!  
  JsonObject header;
  header.add("run",ftr.getJson("run"));
  header.add("subrun",ftr.getJson("subrun"));
  header.add("event",ftr.getJson("event"));
  header.add("eventTime",ftr.getVal("evttime")*1000);
  header.add("isRealData",ftr.getInt("isdata"));
  header.add("experimentType",ftr.jsonF("EventAuxiliary.experimentType_"));
  header.add("daqTime",ftr.getVal("evttime")*1000);
  
  JsonObject trigger;
  trigger.add("triggerword",ftr.getJson("triggerbits"));
  header.add("trigger",trigger);
  {
    boost::mutex::scoped_lock lck(fOutputMutex);
    fOutput.add("header",header);
  }
}

void AnaRecordComposer::composeHits()
{
  JsonObject reco_list;
  JsonObject hist_list;
  
  TimeReporter timer("ana_hits");
    

  TLeaf* l = fTree->GetLeaf("no_hits_stored");
  if(!l) return;
  int nhits = ftr.getInt("no_hits_stored");
  cout << "nhits: " << nhits << endl;
  
  // Hit histograms.
  TH1D timeProfile("timeProfile","timeProfile",960,0,9600);
  std::vector<TH1*> planeProfile;
  planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",218,0,2398));
  planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",218,0,2398));
  planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",432,0,3456));

  JsonArray arr;
  for(int i=0;i<nhits;i++){
    JsonObject h;
    int wire  = ftr.getInt("hit_wire" ,i);
    int plane = ftr.getInt("hit_plane"  ,i);
    double q  = ftr.getVal("hit_charge"     ,i);
    double t  = ftr.getVal("hit_peakT"    ,i);
    double t1  = ftr.getVal("hit_startT"    ,i);
    double t2  = ftr.getVal("hit_endT"  ,i);
    if(plane==2)timeProfile.Fill(t,q);
    if(plane>=0 && plane<3) planeProfile[plane]->Fill(wire,q);
    h.add("wire",    wire  );
    h.add("plane",   plane );
    h.add("q",       JsonFixed(q,0)     );
    h.add("t",       JsonFixed(t,1)     );
    h.add("t1",      JsonFixed(t1,1)    );
    h.add("t2",      JsonFixed(t2,1)    );
    arr.add(h);                              
  }

  reco_list.add("ana",arr);
  
  JsonObject hists;
  hists.add("timeHist",TH1ToHistogram(&timeProfile));
  JsonArray jPlaneHists;
  jPlaneHists.add(TH1ToHistogram(planeProfile[0]));
  jPlaneHists.add(TH1ToHistogram(planeProfile[1]));
  jPlaneHists.add(TH1ToHistogram(planeProfile[2]));
  hists.add("planeHists",jPlaneHists);

  delete planeProfile[0];
  delete planeProfile[1];
  delete planeProfile[2];    
  hist_list.add("ana",hists);
  timer.addto(fStats);
  {
    boost::mutex::scoped_lock lck(fOutputMutex);
  
    fOutput.add("hits",reco_list);
    fOutput.add("hit_hists",hist_list);
  }
}
