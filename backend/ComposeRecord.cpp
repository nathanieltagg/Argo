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
#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <time.h>
#include <math.h>
#include <stdio.h>
#include <TTreeFormula.h>

#include "ComposeRecord.h"
#include "JsonElement.h"
#include "TreeReader.h"

using namespace std;

JsonObject ComposeHeaderData(TreeReader& t) 
{
  // Header data. Alas, this is the stuff that's nearly impossible to get!  
  return JsonObject();
}

JsonObject ComposeHits(TreeReader& t) 
{
  JsonObject r;
  JsonArray arr = t.makeArray(
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
    );
  std::cout << "makeArray got " << arr.length() << std::endl;
  r.add("n",arr.length());
  r.add("hits",arr);

  return r;
}

void ComposeRecord(JsonObject& result, TTree* inTree, Long64_t inEntry)
{
  result.add("converter","ComposeResult.cpp $Revision$ $Date$ ");
  
  // inTree->GetEntry(inEntry,1);
  TreeReader t(inTree);
  TObjArray* leafList = inTree->GetListOfLeaves();
  
  //
  // OK, now build the result.
  //
  
  result.add("header",ComposeHeaderData(t));


  ///
  /// Hits
  ///
  
  result.add("hits",ComposeHits(t));
  

}

