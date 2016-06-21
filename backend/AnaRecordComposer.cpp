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
  
  // composeHeader();
  // composeHits();
  // composeTracks();
  // composeClusters();
  // composeVertices();
  // etc.

}




