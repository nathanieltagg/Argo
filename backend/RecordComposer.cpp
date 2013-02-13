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
#include "TBranchElement.h"
#include "TStreamerInfo.h"

#include "TVirtualCollectionProxy.h"

#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <time.h>
#include <math.h>
#include <stdio.h>
#include <TTreeFormula.h>

#include "RecordComposer.h"
#include "JsonElement.h"
#include "TreeReader.h"
#include "MakePng.h"

using namespace std;

void RecordComposer::composeHeaderData() 
{
  // Header data. Alas, this is the stuff that's nearly impossible to get!  
  JsonObject header;
  header.add("run",ftr.jsonF("EventAuxiliary.id_.subRun_.run_.run_"));
  header.add("subrun",ftr.jsonF("EventAuxiliary.id_.subRun_.subRun_"));
  header.add("event",ftr.jsonF("EventAuxiliary.id_.event_"));
  // Todo: build these into a proper javascript-style timestamp.
  double tlow = ftr.getF("EventAuxiliary.time_.timeLow_");
  double thigh = ftr.getF("EventAuxiliary.time_.timeHigh_");
  header.add("timeLow",tlow);
  header.add("timeHigh",thigh);
  header.add("isRealData",ftr.jsonF("EventAuxiliary.isRealData_"));
  header.add("experimentType",ftr.jsonF("EventAuxiliary.experimentType_"));
  
  fOutput.add("header",header);
}

void RecordComposer::composeHits() 
{
  JsonObject r;
  JsonArray arr = ftr.makeArray(
        "wire",     "recob::Hits_ffthit__Reco.obj.fWireID.Wire"
      , "plane",    "recob::Hits_ffthit__Reco.obj.fWireID.Plane"
      , "view",     "recob::Hits_ffthit__Reco.obj.fView"
      , "m",        "recob::Hits_ffthit__Reco.obj.fMultiplicity"
      , "q",        "recob::Hits_ffthit__Reco.obj.fCharge"
      , "σq",       "recob::Hits_ffthit__Reco.obj.fSigmaCharge"
      , "t",        "recob::Hits_ffthit__Reco.obj.fPeakTime"
      , "σt",       "recob::Hits_ffthit__Reco.obj.fSigmaPeakTime"
      , "t1",       "recob::Hits_ffthit__Reco.obj.fStartTime"
      , "t2",       "recob::Hits_ffthit__Reco.obj.fEndTime"
          , "rdkey","recob::Hits_ffthit__Reco.obj.fRawDigit.key_"
    );
  r.add("n",arr.length());
  r.add("hits",arr);

  fOutput.add("hits",r);
}

void RecordComposer::composeWires() 
{
  JsonObject r;
  TLeaf* lf = fTree->GetLeaf("recob::Wires_caldata__Reco.obj.fView");
  int nwires = lf->GetLen();

  // special code to try to get vector<float> out of a leaf.
  // Copied liberally from TBranchElement::PrintValue and GetCollectionProxy()->PrintValueSTL
  
  TBranchElement* be = (TBranchElement*) fTree->GetBranch("recob::Wires_caldata__Reco.obj.fSignal");
  if(!be) {
    fOutput.add("composeWires-error","Couldn't get wires caldata branch");  
    return;
  }
  
  TVirtualCollectionProxy::TPushPop helper(be->GetCollectionProxy(), be->GetObject());    
  auto cont = be->GetCollectionProxy();
  if (!(be->GetInfo())) {
    fOutput.add("composeWires-error","Couldn't GetInfo on wires caldata branch"); 
    return;
  }
  Int_t eoffset = be->GetOffset();
  Int_t offset = eoffset + be->GetInfo()->GetOffsets()[be->GetID()];
  
  // Get first row.
  char* pointer = (char*)cont->At(0);
  char* ladd = pointer+offset;
  std::vector<float> *ptr = (std::vector<float> *)ladd;
  
  size_t width = ptr->size();
  std::vector<float> normalized(width);
  // Notes: calibrated values of fSignal on wires go roughly from -100 to 2500
  MakePng png(width,nwires,16,"wires");
  
  
  JsonArray arr;
  for(long i=0;i<nwires;i++) {
    // std::cout << "Doing wire " << i << std::endl;
    JsonObject wire;
    wire.add("view",ftr.getJson("recob::Wires_caldata__Reco.obj.fView",i));
    wire.add("signalType",ftr.getJson("recob::Wires_caldata__Reco.obj.fSignalType",i));
    wire.add("rdkey",ftr.getJson("recob::Wires_caldata__Reco.obj.fRawDigit.key_",i));

    // Get signal pointer.  This is ROOT magic crap I dont' understand, but it works. 
    pointer = (char*)cont->At(i);
    ladd = pointer+offset;
    ptr = (std::vector<float> *)ladd;
    // std::string signal("[");
    for(size_t k = 0; k<width; k++) {
      float o = (500 + (*ptr)[k])/3000.;
      if(o<0) o=0;
      if(o>1) o=1;
      normalized[k]=0;
      // signal += Form("%.2f,",k);
    }
    // if (signal.size ()>0)  signal.erase(signal.size()-1,1); // Remove trailing comma.
    // signal += "]";
    // wire.add("signal",signal);
    png.AddRow(normalized);
    
    // This works, but is WAAYYYYYY TOO SLOW
    //    wire.add("signal",ftr.makeSimpleFArray(Form("recob::Wires_caldata__Reco.obj[%ld].fSignal",i)));
    arr.add(wire);
  }
  png.Finish();
  fOutput.add("wires",arr);
  
  fOutput.add("wireimg",png.getBase64Encoded());
}

void RecordComposer::compose()
{
  fOutput.add("converter","ComposeResult.cpp $Revision$ $Date$ ");

  // parse options.
  int doCalWires = 0;
  if( std::string::npos != fOptions.find("_WIRES_")) doCalWires = 1;

  // Set branches to read here.
  fTree->SetBranchStatus("*",1);  // By default, read all.
  fTree->SetBranchStatus("raw::RawDigits*",0); // Don't know how to read these yet.
  fTree->SetBranchStatus("recob::Wires_caldata",doCalWires);

  //
  // Load the tree element.
  //
  Int_t bytesRead = fTree->GetEntry(fEntry);
  if(bytesRead<0) {
    cout << "Error: I/O error on GetEntry trying to read entry " << fEntry;
    fOutput.add("error","I/O error on GetEntry");
    return;
  }
  if(bytesRead==0) {
    cout << "Error: Nonexistent entry reported by GetEntry trying to read entry " << fEntry;
    fOutput.add("error","Entry does not exist on tree");
    return;
  }
  
  
  //
  // OK, now build the result.
  //
  composeHeaderData();
  composeHits();
  
  if(doCalWires) composeWires();
  
  
  
}

