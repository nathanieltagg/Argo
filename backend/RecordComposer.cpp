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


#include "RecordComposer.h"
#include "JsonElement.h"
#include "TreeReader.h"
#include "TreeElementLooter.h"
#include "ColorMap.h"
#include "MakePng.h"
#include "RootToJson.h"
#include "crc32checksum.h"
#include "WirePalette.h"
#include <stdlib.h>


class TimeReporter
{
public:
  std::string fName;
  Timer t;
  TimeReporter(const std::string& name="") :fName(name), t() {};
  ~TimeReporter() { std::cout << "++TimeReporter " << fName << " " << t.Count() << " s" << std::endl;}
  
  void addto(JsonObject& stats) { stats.add(fName,t.Count()); }
};


WirePalette gWirePalette; // Create at program start as a singleton.

using namespace std;

std::string RecordComposer::sfFileStoragePath = "../datacache";
std::string RecordComposer::sfUrlToFileStorage = "datacache";





RecordComposer::RecordComposer(JsonObject& output, TTree* tree, Long64_t jentry, const std::string options)
  : fOutput(output), fTree(tree), fEntry(jentry), fOptions(options), ftr(tree)
{
}
  
RecordComposer::~RecordComposer()
{
}


 
std::string RecordComposer::stripdots(const std::string& s)
{
  std::string out = s;
  size_t pos;
  while((pos = out.find('.')) != std::string::npos)  out.erase(pos, 1);
  return out;
}

void RecordComposer::hsvToRgb(unsigned char* out, float h, float s, float v){
    float r, g, b;

    int i = floor(h * 6);
    float f = h * 6 - i;
    float p = v * (1 - s);            // 0
    float q = v * (1 - f * s);        // 1-f
    float t = v * (1 - (1 - f) * s);  // f

    switch(i % 6){
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    
    // cout << (int)(r*255) << "\t"
    //     << (int)(g*255) << "\t"
    //     << (int)(b*255) << "\n";
    // return rgbToHsv(int(r*255),int(g*255),int(b*255));
    // return [r * 255, g * 255, b * 255];
    *(out   ) = (unsigned int)(r*255);
    *(out+1 ) = (unsigned int)(g*255);
    *(out+2 ) = (unsigned int)(b*255);
}


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
  
  // Add my own things. 
  // FIXME: this should come from the event data, not be hardcoded, but this will have to do for the moment.
  header.add("TDCStart",0);
  header.add("TDCEnd",9600);
  
  fOutput.add("header",header);
}

void RecordComposer::composeHits() 
{
  vector<string> leafnames = findLeafOfType("vector<recob::Hit>>");
  if(leafnames.size()==0) {
    fOutput.add("hit_warning","No hit branch found in file.");
    return;
  } 
  
  JsonObject reco_list;
  JsonObject hist_list;
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {
    std::string name = leafnames[iname];
    TimeReporter timer(name);
    std::cout << "Looking at hits object " << (name+"obj_").c_str() << endl;   
    
    // JsonArray arr = ftr.makeArray(
   //        "wire",     name+"obj.fWireID.Wire"
   //      , "plane",    name+"obj.fWireID.Plane"
   //      , "view",     name+"obj.fView"
   //      , "m",        name+"obj.fMultiplicity"
   //      , "q",        name+"obj.fCharge"
   //      , "\u03C3q",       name+"obj.fSigmaCharge"
   //      , "t",        name+"obj.fPeakTime"
   //      , "\u03C3t",       name+"obj.fSigmaPeakTime"
   //      , "t1",       name+"obj.fStartTime"
   //      , "t2",       name+"obj.fEndTime"
   //    );
   //  r.add("n",arr.length());
   //  r.add("hits",arr);

    JsonArray arr;
    TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
    if(!l) continue;
    int nhits = l->GetLen();
    cout << "nhits: " << nhits << endl;

    TLeaf* lhit_wire    = fTree->GetLeaf( (name+"obj.fWireID.Wire"     ).c_str());
    TLeaf* lhit_plane   = fTree->GetLeaf( (name+"obj.fWireID.Plane"    ).c_str());
    // TLeaf* lhit_view    = fTree->GetLeaf( (name+"obj.fView"            ).c_str());
    // TLeaf* lhit_m       = fTree->GetLeaf( (name+"obj.fMultiplicity"    ).c_str());
    TLeaf* lhit_q       = fTree->GetLeaf( (name+"obj.fCharge"          ).c_str());
    // TLeaf* lhit_sigq    = fTree->GetLeaf( (name+"obj.fSigmaCharge"     ).c_str());
    TLeaf* lhit_t       = fTree->GetLeaf( (name+"obj.fPeakTime"        ).c_str());
    // TLeaf* lhit_sigt    = fTree->GetLeaf( (name+"obj.fSigmaPeakTime"   ).c_str());
    TLeaf* lhit_t1      = fTree->GetLeaf( (name+"obj.fStartTime"       ).c_str());
    TLeaf* lhit_t2      = fTree->GetLeaf( (name+"obj.fEndTime"         ).c_str());
    
    // Hit histograms.
    TH1D timeProfile("timeProfile","timeProfile",960,0,9600);
    std::vector<TH1*> planeProfile;
    planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",218,0,2398));
    planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",218,0,2398));
    planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",432,0,3456));
 
    
    std::vector<JsonObject> v;
    for(int i=0;i<nhits;i++){
      JsonObject h;
      int wire  = ftr.getInt(lhit_wire   ,i);
      int plane = ftr.getInt(lhit_plane  ,i);
      double q  = ftr.getVal(lhit_q      ,i);
      double t  = ftr.getVal(lhit_t      ,i);
      double t1  = ftr.getVal(lhit_t1      ,i);
      double t2  = ftr.getVal(lhit_t2      ,i);
      if(plane==2)timeProfile.Fill(t,q);
      if(plane>=0 && plane<3) planeProfile[plane]->Fill(wire,q);
      h.add("wire",    wire  );
      h.add("plane",   plane );
      h.add("q",       JsonFixed(q,0)     );
      h.add("t",       JsonFixed(t,1)     );
      h.add("t1",      JsonFixed(t1,1)    );
      h.add("t2",      JsonFixed(t2,1)    );
      // h.add("view",    ftr.getJson(lhit_view   ,i) ); // View is redundant with plane.
      // h.add("m",       ftr.getJson(lhit_m      ,i) );  // unusued
      // h.add("\u03C3q", ftr.getJson(lhit_sigq   ,i) ); // unused
      // h.add("\u03C3t", ftr.getJson(lhit_sigt   ,i) ); //unused
      v.push_back(h);                              
    }

    for(size_t i=0;i<v.size();i++) arr.add(v[i]);        
    reco_list.add(stripdots(name),arr);
    
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
    hist_list.add(stripdots(name),hists);
    timer.addto(fStats);
  }
  fOutput.add("hits",reco_list);
  fOutput.add("hit_hists",hist_list);
}

// Utility function for composeCluster
JsonObject RecordComposer::GetClusterWireAndTDC(TreeElementLooter& l, int row) {
  JsonObject o;
  if(!l.ok()) return o;
  const vector<double>* v = l.get<vector<double> >(row);
  if(v->size()<2) return o;
  o.add("wire", (*v)[0]);
  o.add("tdc" , (*v)[1]);
  return o;
}

void RecordComposer::composeClusters()
{
  vector<string> leafnames = findLeafOfType("vector<recob::Cluster>>");
  if(leafnames.size()==0) {
    fOutput.add("cluster_warning","No cluster branch found in file.");
    return;
  } 
  
  JsonObject reco_list;
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {    
    std::string name = leafnames[iname];
    TimeReporter timer(name);
    std::cout << "Looking at cluster object " << (name+"obj_").c_str() << endl;
    JsonArray jClusters;
    TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
    if(!l) continue;
    int nclusters = l->GetLen();
    cout << "clusters: " << nclusters << endl;
    TreeElementLooter startPos     (fTree,name+"obj.fStartPos");
    TreeElementLooter endPos       (fTree,name+"obj.fEndPos");
    TreeElementLooter sigmaStartPos(fTree,name+"obj.fSigmaStartPos");
    TreeElementLooter sigmaEndPos  (fTree,name+"obj.fSigmaEndPos");

    for(int i=0;i<nclusters;i++) {
      JsonObject jclus;
      jclus.add("totalCharge",ftr.getJson(name+"obj.fTotalCharge",i));
      jclus.add("dTdW"       ,ftr.getJson(name+"obj.fdTdW",i));
      jclus.add("dQdW"       ,ftr.getJson(name+"obj.fdQdW",i));
      jclus.add("sigmadTdW"  ,ftr.getJson(name+"obj.fSigmadTdW",i));
      jclus.add("sigmadQdW"  ,ftr.getJson(name+"obj.fSigmadQdW",i));
      jclus.add("ID"         ,ftr.getJson(name+"obj.fID",i));
      jclus.add("view"       ,ftr.getJson(name+"obj.fView",i));
      
      jclus.add("startPos"      ,GetClusterWireAndTDC(startPos,i));
      jclus.add("endPos"        ,GetClusterWireAndTDC(endPos,i));
      jclus.add("sigmaStartPos" ,GetClusterWireAndTDC(sigmaStartPos,i));
      jclus.add("sigmaEndPos"   ,GetClusterWireAndTDC(sigmaEndPos,i));
      
      jClusters.add(jclus);
    }
    reco_list.add(stripdots(name),jClusters);
    timer.addto(fStats);
  } 
  fOutput.add("clusters",reco_list);
}

void  RecordComposer::composeVertex2d()
{
  vector<string> leafnames = findLeafOfType("vector<recob::EndPoint2D>>");
  JsonObject reco_list;
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {    
    std::string name = leafnames[iname];
    TimeReporter timer(name);
    std::cout << "Looking at 2d object " << (name+"obj_").c_str() << endl;

    JsonArray jlist;

    TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
    if(!l) continue;
    int n = l->GetLen();
    cout << "endpoint2ds: " << n << endl;
    
    for(int i=0;i<n;i++) {
      JsonObject jpt;
             
      jpt.add("t"           ,ftr.getJson(name+"obj.fDriftTime",i));
      jpt.add("plane"       ,ftr.getJson(name+"obj.fWireID.Plane",i));
      jpt.add("wire"        ,ftr.getJson(name+"obj.fWireID.Wire",i));
      jpt.add("id"          ,ftr.getJson(name+"obj.fID",i));
      jpt.add("strength"    ,ftr.getJson(name+"obj.fStrength",i));
      jpt.add("view"        ,ftr.getJson(name+"obj.fView",i));
      jpt.add("q"           ,ftr.getJson(name+"obj.fTotalCharge",i));

      jlist.add(jpt);
    }
    reco_list.add(stripdots(name),jlist);
    timer.addto(fStats);
  } 
  fOutput.add("endpoint2d",reco_list);  
}
  
void  RecordComposer::composeSpacepoints()
{
  vector<string> leafnames = findLeafOfType("vector<recob::SpacePoint> >");  
  JsonObject reco_list;
    
  for(size_t iname = 0; iname<leafnames.size(); iname++) {    
    std::string name = leafnames[iname];
    TimeReporter timer(name);
    std::cout << "Looking at spacepoint object " << (name+"obj_").c_str() << endl;
    JsonArray jSpacepoints;
    TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
    if(!l) continue;
    int n = l->GetLen();
    cout << "Found " << n << " objects" << endl;
    TLeaf* lXYZ    = fTree->GetLeaf((name+"obj.fXYZ").c_str());
    TLeaf* lErrXYZ = fTree->GetLeaf((name+"obj.fErrXYZ").c_str());

    for(int i=0;i<n;i++) {
      JsonObject jsp;
      
      jsp.add("id"    ,ftr.getJson(name+"obj.fID"       ,i));
      jsp.add("chisq" ,ftr.getJson(name+"obj.fChisq"    ,i));
      JsonArray xyz;
      JsonArray errXyz;
      for(int j=0;j<lXYZ->GetLenStatic();j++) 
        xyz   .add(ftr.getJson(lXYZ,i,j));
      for(int j=0;j<lErrXYZ->GetLenStatic();j++)       
        errXyz.add(ftr.getJson(lErrXYZ,i,j));
      
      jsp.add("xyz",xyz);
      jsp.add("errXyz",errXyz);

      jSpacepoints.add(jsp);
    }
    reco_list.add(stripdots(name),jSpacepoints);
    timer.addto(fStats);
  }  
  fOutput.add("spacepoints",reco_list);
}
  
void  RecordComposer::composeTracks()
{
  vector<string> leafnames = findLeafOfType("vector<recob::Track>");

  JsonObject reco_list;

  for(size_t iname = 0; iname<leafnames.size(); iname++) {    
    std::string name = leafnames[iname];
    TimeReporter timer(name);
    std::cout << "Looking at track object " << (name+"obj_").c_str() << endl;
    JsonArray jTracks;
    TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
    if(!l) continue;
    int n = l->GetLen();
    cout << "Found " << n << " objects" << endl;
    
    TreeElementLooter tel_fXYZ         (fTree,name+"obj.fXYZ");
    TreeElementLooter tel_fDir         (fTree,name+"obj.fDir");
    TreeElementLooter tel_fCov         (fTree,name+"obj.fCov");
    TreeElementLooter tel_fdQdx        (fTree,name+"obj.fdQdx");
    TreeElementLooter tel_fFitMomentum (fTree,name+"obj.fFitMomentum");

    for(int i=0;i<n;i++) {
      JsonObject jtrk;
    
      jtrk.add("id"    ,ftr.getJson(name+"obj.fID"       ,i));
      const vector<TVector3>          *XYZ           = tel_fXYZ        .get<vector<TVector3>          >(i);
      const vector<TVector3>          *Dir           = tel_fDir        .get<vector<TVector3>          >(i);
      // const vector<TMatrixT<double> > *Cov           = tel_fCov        .get<vector<TMatrixT<double> > >(i);
      // const vector<vector<double> >   *dQdx          = tel_fdQdx       .get<vector<vector<double> >   >(i);
      const vector<double>            *FitMomentum   = tel_fFitMomentum.get<vector<double>            >(i);
      JsonArray jpoints;
      
      for(size_t j=0;j<XYZ->size();j++) {
        JsonObject jpoint;
        jpoint.add("x",(*XYZ)[j].x());
        jpoint.add("y",(*XYZ)[j].y());
        jpoint.add("z",(*XYZ)[j].z());
        jpoint.add("vx",(*Dir)[j].x());
        jpoint.add("vy",(*Dir)[j].y());
        jpoint.add("vz",(*Dir)[j].z());
        // jpoint.add("dQdx",(*dQdx)[0][j]); // Problematic; sometimes crashes
        // jpoint.add("dQdy",(*dQdx)[1][j]);
        // jpoint.add("dQdz",(*dQdx)[2][j]);
        jpoint.add("P",(*FitMomentum)[j]);
        jpoints.add(jpoint);
      }
      jtrk.add("points",jpoints);

      jTracks.add(jtrk);
    }

    reco_list.add(stripdots(name),jTracks);
    timer.addto(fStats);
  }  
  fOutput.add("tracks",reco_list);

}
  
// Optical
void  RecordComposer::composeOpFlashes()
{
  vector<string> leafnames = findLeafOfType("vector<recob::OpFlash>");
  JsonObject reco_list;
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {    
    std::string name = leafnames[iname];
    TimeReporter timer(name);
    std::cout << "Looking at opflash object " << (name+"obj_").c_str() << endl;
    JsonArray jOpFlashes;
    TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
    if(!l) continue;
    int n = l->GetLen();
    cout << "flashes: " << n << endl;
     //       Double_t recob::OpFlashs_opflash__Reco.obj.fTime
     // vector<double> recob::OpFlashs_opflash__Reco.obj.fPEperOpDet
     // vector<double> recob::OpFlashs_opflash__Reco.obj.fWireCenter
     // vector<double> recob::OpFlashs_opflash__Reco.obj.fWireWidths
     //       Double_t recob::OpFlashs_opflash__Reco.obj.fYCenter
     //       Double_t recob::OpFlashs_opflash__Reco.obj.fYWidth
     //       Double_t recob::OpFlashs_opflash__Reco.obj.fZCenter
     //       Double_t recob::OpFlashs_opflash__Reco.obj.fZWidth
     //          Int_t recob::OpFlashs_opflash__Reco.obj.fOnBeamTime
    
  
    TreeElementLooter tel_fPEperOpDet(fTree,name+"obj.fPEperOpDet");
    TreeElementLooter tel_fWireCenter(fTree,name+"obj.fWireCenters");
    TreeElementLooter tel_fWireWidths(fTree,name+"obj.fWireWidths");

    for(int i=0;i<n;i++) {
      JsonObject jflash;
      jflash.add("time"       ,ftr.getJson(name+"obj.fTime",i));
      jflash.add("timeWidth"  ,ftr.getJson(name+"obj.fTimeWidth",i));
      jflash.add("absTime"    ,ftr.getJson(name+"obj.fAbsTime",i));
      jflash.add("yCenter"    ,ftr.getJson(name+"obj.fYCenter",i));
      jflash.add("yWidth"     ,ftr.getJson(name+"obj.fYWidth",i));
      jflash.add("zCenter"    ,ftr.getJson(name+"obj.fZCenter",i));
      jflash.add("zWidth"     ,ftr.getJson(name+"obj.fZWidth",i));
      jflash.add("onBeamTime" ,ftr.getJson(name+"obj.fOnBeamTime",i));
      
      // auto-construct arrays; lots o' syntactic sugar here.
      if(tel_fPEperOpDet.ok())  jflash.add("pePerOpDet",     JsonArray(*(tel_fPEperOpDet .get<vector<double> >(i))));
      if(tel_fWireCenter.ok())  jflash.add("wireCenter",     JsonArray(*(tel_fWireCenter .get<vector<double> >(i))));
      if(tel_fWireWidths.ok())  jflash.add("wireWidths",     JsonArray(*(tel_fWireWidths .get<vector<double> >(i))));

      jOpFlashes.add(jflash);
    }
    reco_list.add(stripdots(name),jOpFlashes);
    timer.addto(fStats);
  }   
  fOutput.add("opflashes",reco_list);
}

void  RecordComposer::composeOpPulses()
{
  vector<string> leafnames = findLeafOfType("vector<raw::OpDetPulse>");  
  JsonObject reco_list;
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {    
    std::string name = leafnames[iname];
    TimeReporter timer(name);
    std::cout << "Looking at ophits object " << (name+"obj_").c_str() << endl;
    TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
    if(!l) continue;
    int n = l->GetLen();
    TreeElementLooter loot(fTree,name+"obj.fWaveform");
    if(!loot.ok()) return;
  
    JsonArray joppulses;
    for(int i=0;i<n;i++) {
      
      int chan    = ftr.getInt(name+"obj.fOpChannel"   ,i);
      int samples = ftr.getInt(name+"obj.fSamples"     ,i);
      int frame   = ftr.getInt(name+"obj.fPMTFrame"    ,i);
      int tdc     = ftr.getInt(name+"obj.fFirstSample" ,i);
      const std::vector<short> *ptr = loot.get<std::vector<short> >(i);
      const std::vector<short>& wave = *ptr;

      if(samples > 10000) {
        // We're dealing with badly-made MC which is just dumping it's waveform content.
        
        // Scan through the wavform and fake up pulse entries when you see something good.
        int t = 0;
        int tot = wave.size();
        while(t<tot) {
          if(wave[t] == 0) {t++; continue;}
          
          // start a pulse.
          JsonObject jobj;
          jobj.add("opDetChan"     ,chan    );
          jobj.add("frame"         ,frame   );
          jobj.add("tdc"           ,t       );
          JsonArray jwave;
          int nsamp = 0;
          while(t<tot && wave[t]!=0) {
            jwave.add(wave[t]); nsamp++;  t++;
            if((t<tot) && wave[t]==0) {jwave.add(wave[t]); nsamp++; t++;} // Add one more - insist that there be two zeroes in a row.
          }
          jobj.add("samples",nsamp);
          jobj.add("waveform",jwave);
          joppulses.add(jobj);          
          // cout << "Created pulse channel " << chan << " with " << nsamp << " samples " << endl;
        }
        
        
      } else {
        // This appears to be genuine, so we'll reproduce it faithfully.
        JsonObject jobj;
        jobj.add("opDetChan"     ,chan    );
        jobj.add("samples"       ,samples );
        jobj.add("frame"         ,frame   );
        jobj.add("tdc"           ,tdc     );
        JsonArray waveform;
        for(size_t j=0;j<wave.size();j++) {
          waveform.add( wave[j] );
        }
        jobj.add("waveform",waveform);
        joppulses.add(jobj);
        
      }

    }
    
    reco_list.add(stripdots(name),joppulses);
    timer.addto(fStats);
  }
  fOutput.add("oppulses",reco_list);
  
}
  
void  RecordComposer::composeOpHits()
{
  vector<string> leafnames = findLeafOfType("vector<recob::OpHit>");  
  JsonObject reco_list;
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {    
    std::string name = leafnames[iname];
    TimeReporter timer(name);
    std::cout << "Looking at ophits object " << (name+"obj_").c_str() << endl;
    TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
    if(!l) continue;
    int n = l->GetLen();
    cout << "ophits: " << n << endl;

    JsonArray jophits;
    for(int i=0;i<n;i++) {
      JsonObject jobj;
      
      jobj.add("opDetChan"     ,ftr.getJson(name+"obj.fOpChannel"            ,i));
      jobj.add("peakTime"      ,ftr.getJson(name+"obj.fPeakTime"             ,i));
      jobj.add("width"         ,ftr.getJson(name+"obj.fWidth"                ,i));
      jobj.add("area"          ,ftr.getJson(name+"obj.fArea"                 ,i));
      jobj.add("amp"           ,ftr.getJson(name+"obj.fAmplitude"            ,i));
      jobj.add("pe"            ,ftr.getJson(name+"obj.fPE"                   ,i));
      jobj.add("fastToTotal"   ,ftr.getJson(name+"obj.fFastToTotal"          ,i));
      jophits.add(jobj);
    }
    
    reco_list.add(stripdots(name),jophits);
    timer.addto(fStats);
  }
  fOutput.add("ophits",reco_list);
  
}


void RecordComposer::wireOfChannel(int channel, int& plane, int& wire)
{
  if(channel < 2399) {
    plane = 0; wire= channel; return;
  }
  else if(channel <4798) {
    plane = 1; 
    wire = channel - 2399;
    return;
  }
  else{
    plane = 2;
    wire= channel-4798;
    return;
  }
}


void RecordComposer::composeCalAvailability()
{
  vector<string> leafnames = findLeafOfType("vector<recob::Wire>");
  JsonObject reco_list;
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {
    std::string name = leafnames[iname];
    reco_list.add(stripdots(name),JsonElement());
  }
  fOutput.add("cal",reco_list);
}

void RecordComposer::composeCal() 
{
  vector<string> leafnames = findLeafOfType("vector<recob::Wire>");
  JsonObject reco_list;
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {
    std::string name = leafnames[iname];
  
    std::cout << "Looking at cal Wires object " << (name+"obj_").c_str() << endl;
    TimeReporter timer(name);
    TLeaf* lf = fTree->GetLeaf((name+"obj_").c_str());
    if(!lf) continue;
    int nwires = lf->GetLen();

    TLeaf* lchannel= fTree->GetLeaf((name+"obj.fRawDigit.key_").c_str());
    TLeaf* lsignal = fTree->GetLeaf((name+"obj.fSignal").c_str());
    TLeaf* lroi    = fTree->GetLeaf((name+"obj.fSignalROI").c_str());
    TreeElementLooter* simpleLooter =0;
    TreeElementLooter* roiLooter =0;
    size_t width;
    if(lsignal) {
      simpleLooter = new TreeElementLooter(fTree,name+"obj.fSignal");
      if(!simpleLooter->ok()) {delete simpleLooter; continue;};
      const std::vector<float> *ptr = simpleLooter->get<std::vector<float> >(0);
      width = ptr->size();
    } else if( lroi ){
      roiLooter    = new TreeElementLooter(fTree,name+"obj.fSignalROI");
      if(!roiLooter->ok()) {delete roiLooter; continue;};
      width = ftr.getInt(name+"obj.fMaxSamples");
    } else {
      std::cout << "! Can't figure out what the hell this is!" << std::endl;
      continue;
    }
    
    if(width<=0) continue;
  
    JsonObject r;
    // Notes: calibrated values of fSignal on wires go roughly from -100 to 2500
    MakePng png(width,8254,MakePng::palette_alpha,gWirePalette.fPalette,gWirePalette.fPaletteTrans);
    MakePng encoded(width,8254,MakePng::rgb);
    ColorMap colormap;
  
    std::vector<unsigned char> imagedata(width);
    std::vector<unsigned char> encodeddata(width*3);

    TH1D timeProfile("timeProfile","timeProfile",width,0,width);
    std::vector<Double_t> timeProfileData(width+2,0);
    std::vector<TH1*> planeProfile;
    planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",3456,0,3456));


    // Map the rows in the data to wirenumbers
    std::vector<int> channelToRow(8254,-1);
    for(size_t irow=0;irow<nwires;irow++) {
      int channel =ftr.getInt(lchannel,irow);
      channelToRow[channel] = irow;
    }
    

    std::vector<float> wireArr(width); // Storage.
    wireArr.reserve(width);

    // Loop through logical channel number (i.e. logical wire number)
    for(long channel=0;channel<8254;channel++) {
      // std::cout << "Doing wire " << i << std::endl;
      // JsonObject wire;
      // wire.add("view",ftr.getJson("recob::Wires_caldata__Reco.obj.fView",i));
      // wire.add("signalType",ftr.getJson("recob::Wires_caldata__Reco.obj.fSignalType",i));
      // wire.add("rdkey",ftr.getJson("recob::Wires_caldata__Reco.obj.fRawDigit.key_",i));

      // Find the row in the data that matches.
      int row = channelToRow[channel];
      if(row<0) {
        std::fill(wireArr.begin(), wireArr.end(), 0);        
      } else {
        
        // Now actually get the data
        
        // The simple way:
        if(simpleLooter) {
          const std::vector<float> *ptr = simpleLooter->get<std::vector<float> >(row);
          wireArr = *ptr;        
        }
      
        // The hard way: Bruce's new ROIs.
        if(roiLooter) {
          std::fill(wireArr.begin(), wireArr.end(), 0);
          const vector<pair<unsigned int,vector<float> > >*ptr = roiLooter->get<vector<pair<unsigned int,vector<float> > > >(row);
          for(size_t iroi=0;iroi<ptr->size();iroi++) {
            unsigned int roi_loc = (*ptr)[iroi].first;
            const vector<float>& roi_wave = (*ptr)[iroi].second;
            for(size_t s=0;s<roi_wave.size();s++) {
              wireArr[s+roi_loc] = roi_wave[s]; // copy it in.
            }
          }
        }

      }
      

      
      // std::string signal("[");
      double wiresum = 0;
      for(size_t k = 0; k<width; k++) {
        // Color map.
        float adc = wireArr[k];
        //timeProfile.Fill(k,adc);
        timeProfileData[k+1] += adc;
        
        wiresum+=fabs(adc);
        // colormap.get(&imagedata[k*3],adc/4000.);
        imagedata[k] = gWirePalette.tanscale((short)adc);
      
        // Save bitpacked data as image map.
        int fadc = adc + float(0x8000);
        int iadc = fadc;
        encodeddata[k*3]   = 0xFF&(iadc>>8);
        encodeddata[k*3+1] = iadc&0xFF;
        encodeddata[k*3+2] = (unsigned char)((fadc-float(iadc))*255);
      }
      int wire, plane;
      wireOfChannel(channel,plane,wire);
      planeProfile[plane]->Fill(wire,wiresum);
    
      png.AddRow(imagedata);
      encoded.AddRow(encodeddata);
    
      // This works, but is WAAYYYYYY TOO SLOW
      //    wire.add("signal",ftr.makeSimpleFArray(Form("recob::Wires_caldata__Reco.obj[%ld].fSignal",i)));
      // arr.add(wire);
    }
    timeProfile.SetContent(&timeProfileData[0]);
    png.Finish();
    encoded.Finish();
    // r.add("wires",arr);
    // Create histogram:

    std::string wireimg = png.writeToUniqueFile(sfFileStoragePath);
    std::string wireimg_thumb = wireimg+".thumb.png";
    BuildThumbnail(sfFileStoragePath+wireimg,sfFileStoragePath+wireimg_thumb);
    r.add("wireimg_url",sfUrlToFileStorage+wireimg);
    r.add("wireimg_url_thumb",sfUrlToFileStorage+wireimg_thumb);
    r.add("wireimg_encoded_url",sfUrlToFileStorage+
                              encoded.writeToUniqueFile(sfFileStoragePath)
                              );

    r.add("timeHist",TH1ToHistogram(&timeProfile));
    JsonArray jPlaneHists;
    jPlaneHists.add(TH1ToHistogram(planeProfile[0]));
    jPlaneHists.add(TH1ToHistogram(planeProfile[1]));
    jPlaneHists.add(TH1ToHistogram(planeProfile[2]));
    r.add("planeHists",jPlaneHists);

    delete planeProfile[0];
    delete planeProfile[1];
    delete planeProfile[2];
    if(simpleLooter) delete simpleLooter;
    if(roiLooter)    delete roiLooter;
    
    reco_list.add(stripdots(name),r);
    timer.addto(fStats);
  }
  fOutput.add("cal",reco_list);
}

void RecordComposer::composeRawAvailability()
{
  vector<string> leafnames = findLeafOfType("vector<raw::RawDigit>");
  JsonObject reco_list;
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {
    std::string name = leafnames[iname];
    reco_list.add(stripdots(name),JsonElement());
  }
  fOutput.add("raw",reco_list);
}


void RecordComposer::composeRaw()
{
  vector<string> leafnames = findLeafOfType("vector<raw::RawDigit>");
  JsonObject reco_list;
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {
    std::string name = leafnames[iname];
  
    TimeReporter timer(name);
    // Remove from the list anything which looks like a prespill or a postspill window.
    if( std::string::npos != fOptions.find("_NoPreSpill_")) 
      if(string::npos != name.find("preSpill")) {
        reco_list.add(stripdots(name),JsonElement()); // null it out.
        continue;
      }
    if( std::string::npos != fOptions.find("_NoPostSpill_"))
      if(string::npos != name.find("postSpill")) {
        reco_list.add(stripdots(name),JsonElement()); // null it out.
        continue;
      }
      
    std::cout << "Looking at raw::RawDigit object " << (name+"obj_").c_str() << endl;
    TLeaf* lf = fTree->GetLeaf((name+"obj_").c_str());
    if(!lf) return;
    int ndig = lf->GetLen();
    
    JsonObject r;
    ColorMap colormap;
  
    TreeElementLooter l(fTree,name+"obj.fADC");
    TLeaf* l_pedestal = fTree->GetLeaf(string(name+"obj.fPedestal").c_str());
    // TLeaf* l_samples  = fTree->GetLeaf(string(name+"obj.fSamples").c_str());
    const std::vector<short> *ptr = l.get<std::vector<short> >(0);
    // FIXME: Naive assumption that all vectors will be this length. Will be untrue for compressed or decimated data!
    size_t width = ptr->size();

    MakePng png(width,ndig, MakePng::palette_alpha,gWirePalette.fPalette,gWirePalette.fPaletteTrans);
    MakePng epng(width,ndig,MakePng::rgb);
    std::vector<unsigned char> imagedata(width);
    std::vector<unsigned char> encodeddata(width*3);
  
    TH1D timeProfile("timeProfile","timeProfile",width,0,width);
    std::vector<TH1*> planeProfile;
    std::vector<Double_t> timeProfileData(width+2,0);
    planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",3456,0,3456));
  
    JsonArray jpedestals;
    
    for(int i=0;i<ndig;i++) {
      short pedestal = ftr.getInt(l_pedestal,i);
      if(pedestal<0) pedestal = 0; // Didn't read correctly.
      jpedestals.add(pedestal);
      
      ptr= l.get<std::vector<short> >(i);
      std::vector<short>::iterator it;
      double wiresum = 0;
    
      for(size_t k = 0; k<width; k++) {
        short raw = (*ptr)[k];
        short pedcorr = raw - pedestal;
        // colormap.get(&imagedata[k*3],float(raw)/4000.);
        imagedata[k] = gWirePalette.tanscale(pedcorr);
      
        // Save bitpacked data as image map.
        int iadc = raw + 0x8000;
        encodeddata[k*3]   = 0xFF&(iadc>>8);
        encodeddata[k*3+1] = iadc&0xFF;
        encodeddata[k*3+2] = 0;
        double val = fabs(pedcorr);
        wiresum += val;
        timeProfileData[k+1] += val;
      }
      png.AddRow(imagedata);
      epng.AddRow(encodeddata);

      int wire, plane;
      wireOfChannel(i,plane,wire);
      planeProfile[plane]->Fill(wire,wiresum);

    }
    timeProfile.SetContent(&timeProfileData[0]);
    png.Finish();
    epng.Finish();
  
    std::string wireimg = png.writeToUniqueFile(sfFileStoragePath);
    std::string wireimg_thumb = wireimg+".thumb.png";
    BuildThumbnail(sfFileStoragePath+wireimg,sfFileStoragePath+wireimg_thumb);
    r.add("wireimg_url",sfUrlToFileStorage+wireimg);
    r.add("wireimg_url_thumb",sfUrlToFileStorage+wireimg_thumb);
    r.add("wireimg_encoded_url",sfUrlToFileStorage+
                              epng.writeToUniqueFile(sfFileStoragePath)
                              );

    r.add("timeHist",TH1ToHistogram(&timeProfile));
    JsonArray jPlaneHists;
    jPlaneHists.add(TH1ToHistogram(planeProfile[0]));
    jPlaneHists.add(TH1ToHistogram(planeProfile[1]));
    jPlaneHists.add(TH1ToHistogram(planeProfile[2]));
    r.add("planeHists",jPlaneHists);
    r.add("pedestals",jpedestals);

    delete planeProfile[0];
    delete planeProfile[1];
    delete planeProfile[2];
    reco_list.add(stripdots(name),r);
    timer.addto(fStats);
  }
  fOutput.add("raw",reco_list);
}


int RecordComposer::pointOffLine(const TLorentzVector& x0, const TLorentzVector& pv, const TLorentzVector& x, double tol)
{
  // Starting at x0 and moving along a vector p, how far off the line is point x?
  TVector3 dx(x.X()-x0.X()
             ,x.Y()-x0.Y()
             ,x.Z()-x0.Z());
  TVector3 p = pv.Vect();
  double dx_dot_p = dx.Dot(p);  
  double p2 = p.Mag2();
  if(p2<=0) p2 = 1;
  double delta2 = dx.Mag2() - (dx_dot_p*dx_dot_p)/p.Mag2();
  if(delta2 > tol*tol) return 1;
  if(delta2 < 0) return 1;
  return 0;
}

// double distanceOffLine(const TVector3& p, const TVector3& x1, const TVector3 &x2 )
// {
//   // Find lambda, the distance along the line segment closest to the point.
//   // v = vector from p1 to p2
//   TVector3 v = x2-x1;
//   TVector3 qp = p-x1;
//   
//   double v_dot_qp = v.Dot(qp);
//   double v2 = v.Mag2();
//   double lam = v_dot_qp/v2;
//   
//   if(lam<=0) {
//     // Closest point is p1.
//     return qp.Mag();
//   }
//   if(lam>=1) {
//     // Closest point is p2
//     return (p-x2).Mag();
//   }
//   
//   // Closest point is along the line.
//   double qp2 = qp.Mag2();
//   double d2 = qp2-lam*lam*v2;
//   return sqrt(d2);
// }
void RecordComposer::composeAuxDets()
{
  // On hold. No way I can figure out how to decode a std::set<AuxDetIDE>.
  
  // vector<string> leafnames = findLeafOfType("vector<sim::AuxDetSimChannel>");
  // JsonObject reco_list;
  // 
  // for(size_t iname = 0; iname<leafnames.size(); iname++) {
  //   std::string name = leafnames[iname];     
  //       
  //   std::cout << "Looking at sim::AuxDetSimChannel " << (name+"obj_").c_str() << endl;
  // 
  //   JsonArray jAuxDets;
  //   TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
  //   if(!l) continue;
  //   int n = l->GetLen();
  //   cout << "auxdets: " << n << endl;
  //    //       Double_t recob::OpFlashs_opflash__Reco.obj.fTime
  //    // vector<double> recob::OpFlashs_opflash__Reco.obj.fPEperOpDet
  //    // vector<double> recob::OpFlashs_opflash__Reco.obj.fWireCenter
  //    // vector<double> recob::OpFlashs_opflash__Reco.obj.fWireWidths
  //    //       Double_t recob::OpFlashs_opflash__Reco.obj.fYCenter
  //    //       Double_t recob::OpFlashs_opflash__Reco.obj.fYWidth
  //    //       Double_t recob::OpFlashs_opflash__Reco.obj.fZCenter
  //    //       Double_t recob::OpFlashs_opflash__Reco.obj.fZWidth
  //    //          Int_t recob::OpFlashs_opflash__Reco.obj.fOnBeamTime
  //   
  // 
  //   TreeElementLooter tel_fPEperOpDet(fTree,name+"obj.fPEperOpDet");
  //   TreeElementLooter tel_fWireCenter(fTree,name+"obj.fWireCenter");
  //   TreeElementLooter tel_fWireWidths(fTree,name+"obj.fWireWidths");
  // 
  //   for(int i=0;i<n;i++) {
  //     JsonObject jflash;
  //     jflash.add("time"       ,ftr.getJson(name+"obj.fTime",i));
  //     jflash.add("yCenter"    ,ftr.getJson(name+"obj.fYCenter",i));
  //     jflash.add("yWidth"     ,ftr.getJson(name+"obj.fYWidth",i));
  //     jflash.add("zCenter"    ,ftr.getJson(name+"obj.fZCenter",i));
  //     jflash.add("zWidth"     ,ftr.getJson(name+"obj.fZWidth",i));
  //     jflash.add("onBeamTime" ,ftr.getJson(name+"obj.fOnBeamTime",i));
  // 
  // 
  // }
}

void RecordComposer::composeMC()
{

  vector<string> leafnames = findLeafOfType("vector<simb::GTruth>");
  JsonObject mc;

  JsonObject truth_list;
  for(size_t iname = 0; iname<leafnames.size(); iname++) {
    std::string name = leafnames[iname];
    TimeReporter timer(name);
    
    std::vector<std::pair< std::string,std::string> > list;
    list.push_back(std::make_pair<std::string,std::string>("fGint"                             ,  string(name+"obj.fGint"                    )));
    list.push_back(std::make_pair<std::string,std::string>("fGscatter"                         ,  string(name+"obj.fGscatter"                )));
    list.push_back(std::make_pair<std::string,std::string>("fweight"                           ,  string(name+"obj.fweight"                  )));
    list.push_back(std::make_pair<std::string,std::string>("fprobability"                      ,  string(name+"obj.fprobability"             )));
    list.push_back(std::make_pair<std::string,std::string>("fXsec"                             ,  string(name+"obj.fXsec"                    )));
    list.push_back(std::make_pair<std::string,std::string>("fDiffXsec"                         ,  string(name+"obj.fDiffXsec"                )));
    list.push_back(std::make_pair<std::string,std::string>("fNumPiPlus"                        ,  string(name+"obj.fNumPiPlus"               )));
    list.push_back(std::make_pair<std::string,std::string>("fNumPiMinus"                       ,  string(name+"obj.fNumPiMinus"              )));
    list.push_back(std::make_pair<std::string,std::string>("fNumPi0"                           ,  string(name+"obj.fNumPi0"                  )));
    list.push_back(std::make_pair<std::string,std::string>("fNumProton"                        ,  string(name+"obj.fNumProton"               )));
    list.push_back(std::make_pair<std::string,std::string>("fNumNeutron"                       ,  string(name+"obj.fNumNeutron"              )));
    list.push_back(std::make_pair<std::string,std::string>("fIsCharm"                          ,  string(name+"obj.fIsCharm"                 )));
    list.push_back(std::make_pair<std::string,std::string>("fResNum"                           ,  string(name+"obj.fResNum"                  )));
    list.push_back(std::make_pair<std::string,std::string>("fgQ2"                              ,  string(name+"obj.fgQ2"                     )));
    list.push_back(std::make_pair<std::string,std::string>("fgq2"                              ,  string(name+"obj.fgq2"                     )));
    list.push_back(std::make_pair<std::string,std::string>("fgW"                               ,  string(name+"obj.fgW"                      )));
    list.push_back(std::make_pair<std::string,std::string>("fgT"                               ,  string(name+"obj.fgT"                      )));
    list.push_back(std::make_pair<std::string,std::string>("fgX"                               ,  string(name+"obj.fgX"                      )));
    list.push_back(std::make_pair<std::string,std::string>("fgY"                               ,  string(name+"obj.fgY"                      )));
    list.push_back(std::make_pair<std::string,std::string>("fFShadSystP4_fP_fBits"             ,  string(name+"obj.fFShadSystP4.fP.fBits"    )));
    list.push_back(std::make_pair<std::string,std::string>("fFShadSystP4_fP_fX"                ,  string(name+"obj.fFShadSystP4.fP.fX"       )));
    list.push_back(std::make_pair<std::string,std::string>("fFShadSystP4_fP_fY"                ,  string(name+"obj.fFShadSystP4.fP.fY"       )));
    list.push_back(std::make_pair<std::string,std::string>("fFShadSystP4_fP_fZ"                ,  string(name+"obj.fFShadSystP4.fP.fZ"       )));
    list.push_back(std::make_pair<std::string,std::string>("fFShadSystP4_fE"                   ,  string(name+"obj.fFShadSystP4.fE"          )));
    list.push_back(std::make_pair<std::string,std::string>("fIsSeaQuark"                       ,  string(name+"obj.fIsSeaQuark"              )));
    list.push_back(std::make_pair<std::string,std::string>("fHitNucP4_fP_fBits"                ,  string(name+"obj.fHitNucP4.fP.fBits"       )));
    list.push_back(std::make_pair<std::string,std::string>("fHitNucP4_fP_fX"                   ,  string(name+"obj.fHitNucP4.fP.fX"          )));
    list.push_back(std::make_pair<std::string,std::string>("fHitNucP4_fP_fY"                   ,  string(name+"obj.fHitNucP4.fP.fY"          )));
    list.push_back(std::make_pair<std::string,std::string>("fHitNucP4_fP_fZ"                   ,  string(name+"obj.fHitNucP4.fP.fZ"          )));
    list.push_back(std::make_pair<std::string,std::string>("fHitNucP4_fE"                      ,  string(name+"obj.fHitNucP4.fE"             )));
    list.push_back(std::make_pair<std::string,std::string>("ftgtZ"                             ,  string(name+"obj.ftgtZ"                    )));
    list.push_back(std::make_pair<std::string,std::string>("ftgtA"                             ,  string(name+"obj.ftgtA"                    )));
    list.push_back(std::make_pair<std::string,std::string>("ftgtPDG"                           ,  string(name+"obj.ftgtPDG"                  )));
    list.push_back(std::make_pair<std::string,std::string>("fProbePDG"                         ,  string(name+"obj.fProbePDG"                )));
    list.push_back(std::make_pair<std::string,std::string>("fProbeP4_fP_fBits"                 ,  string(name+"obj.fProbeP4.fP.fBits"        )));
    list.push_back(std::make_pair<std::string,std::string>("fProbeP4_fP_fX"                    ,  string(name+"obj.fProbeP4.fP.fX"           )));
    list.push_back(std::make_pair<std::string,std::string>("fProbeP4_fP_fY"                    ,  string(name+"obj.fProbeP4.fP.fY"           )));
    list.push_back(std::make_pair<std::string,std::string>("fProbeP4_fP_fZ"                    ,  string(name+"obj.fProbeP4.fP.fZ"           )));
    list.push_back(std::make_pair<std::string,std::string>("fProbeP4_fE"                       ,  string(name+"obj.fProbeP4.fE"              )));
    list.push_back(std::make_pair<std::string,std::string>("fVertex_fP_fX"                     ,  string(name+"obj.fVertex.fP.fX"            )));
    list.push_back(std::make_pair<std::string,std::string>("fVertex_fP_fY"                     ,  string(name+"obj.fVertex.fP.fY"            )));
    list.push_back(std::make_pair<std::string,std::string>("fVertex_fP_fZ"                     ,  string(name+"obj.fVertex.fP.fZ"            )));
    list.push_back(std::make_pair<std::string,std::string>("fVertex_fE"                        ,  string(name+"obj.fVertex.fE"               )));
    JsonArray gtruth_arr = ftr.makeArray(list);
        
    truth_list.add(stripdots(name),gtruth_arr);
    timer.addto(fStats);
  }
  mc.add("gtruth",truth_list);


  leafnames = findLeafOfType("vector<simb::MCTruth>");
  JsonObject mctruth_list;
  for(size_t iname = 0; iname<leafnames.size(); iname++) {
    std::string name = leafnames[iname];
    TimeReporter timer(name);
        
    std::vector<std::pair< std::string,std::string> > list;
    // Not pulled; maybe I can get away without it?
    // vector<pair<TLorentzVector,TLorentzVector> > obj.fMCNeutrino.fNu.ftrajectory.ftrajectory
    // vector<pair<TLorentzVector,TLorentzVector> > obj.fMCNeutrino.fLepton.ftrajectory.ftrajectory
    //   set<int> obj.fMCNeutrino.fLepton.fdaughters
    //     set<int> obj.fMCNeutrino.fNu.fdaughters

    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fstatus"                 , string(name+"obj.fMCNeutrino.fNu.fstatus"                 )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_ftrackId"                , string(name+"obj.fMCNeutrino.fNu.ftrackId"                )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fpdgCode"                , string(name+"obj.fMCNeutrino.fNu.fpdgCode"                )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fmother"                 , string(name+"obj.fMCNeutrino.fNu.fmother"                 )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fprocess"                , string(name+"obj.fMCNeutrino.fNu.fprocess"                )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fmass"                   , string(name+"obj.fMCNeutrino.fNu.fmass"                   )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fpolarization_fX"        , string(name+"obj.fMCNeutrino.fNu.fpolarization.fX"        )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fpolarization_fY"        , string(name+"obj.fMCNeutrino.fNu.fpolarization.fY"        )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fpolarization_fZ"        , string(name+"obj.fMCNeutrino.fNu.fpolarization.fZ"        )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fWeight"                 , string(name+"obj.fMCNeutrino.fNu.fWeight"                 )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fGvtx_fP_fX"             , string(name+"obj.fMCNeutrino.fNu.fGvtx.fP.fX"             )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fGvtx_fP_fY"             , string(name+"obj.fMCNeutrino.fNu.fGvtx.fP.fY"             )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fGvtx_fP_fZ"             , string(name+"obj.fMCNeutrino.fNu.fGvtx.fP.fZ"             )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_fGvtx_fE"                , string(name+"obj.fMCNeutrino.fNu.fGvtx.fE"                )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fNu_frescatter"              , string(name+"obj.fMCNeutrino.fNu.frescatter"              )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fstatus"             , string(name+"obj.fMCNeutrino.fLepton.fstatus"             )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_ftrackId"            , string(name+"obj.fMCNeutrino.fLepton.ftrackId"            )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fpdgCode"            , string(name+"obj.fMCNeutrino.fLepton.fpdgCode"            )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fmother"             , string(name+"obj.fMCNeutrino.fLepton.fmother"             )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fprocess"            , string(name+"obj.fMCNeutrino.fLepton.fprocess"            )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fmass"               , string(name+"obj.fMCNeutrino.fLepton.fmass"               )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fpolarization_fX"    , string(name+"obj.fMCNeutrino.fLepton.fpolarization.fX"    )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fpolarization_fY"    , string(name+"obj.fMCNeutrino.fLepton.fpolarization.fY"    )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fpolarization_fZ"    , string(name+"obj.fMCNeutrino.fLepton.fpolarization.fZ"    )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fWeight"             , string(name+"obj.fMCNeutrino.fLepton.fWeight"             )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fGvtx_fP_fX"         , string(name+"obj.fMCNeutrino.fLepton.fGvtx.fP.fX"         )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fGvtx_fP_fY"         , string(name+"obj.fMCNeutrino.fLepton.fGvtx.fP.fY"         )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fGvtx_fP_fZ"         , string(name+"obj.fMCNeutrino.fLepton.fGvtx.fP.fZ"         )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_fGvtx_fE"            , string(name+"obj.fMCNeutrino.fLepton.fGvtx.fE"            )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fLepton_frescatter"          , string(name+"obj.fMCNeutrino.fLepton.frescatter"          )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fMode"                       , string(name+"obj.fMCNeutrino.fMode"                       )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fInteractionType"            , string(name+"obj.fMCNeutrino.fInteractionType"            )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fCCNC"                       , string(name+"obj.fMCNeutrino.fCCNC"                       )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fTarget"                     , string(name+"obj.fMCNeutrino.fTarget"                     )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fHitNuc"                     , string(name+"obj.fMCNeutrino.fHitNuc"                     )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fHitQuark"                   , string(name+"obj.fMCNeutrino.fHitQuark"                   )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fW"                          , string(name+"obj.fMCNeutrino.fW"                          )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fX"                          , string(name+"obj.fMCNeutrino.fX"                          )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fY"                          , string(name+"obj.fMCNeutrino.fY"                          )));
    list.push_back(std::make_pair<std::string,std::string>( "fMCNeutrino_fQSqr"                       , string(name+"obj.fMCNeutrino.fQSqr"                       )));
    list.push_back(std::make_pair<std::string,std::string>( "fOrigin"                                 , string(name+"obj.fOrigin"                                 )));
    list.push_back(std::make_pair<std::string,std::string>( "fNeutrinoSet"                            , string(name+"obj.fNeutrinoSet"                            )));
    std::vector<JsonObject> v_mctruths = ftr.makeVector(list);

    // The fPartList object is in fact a vector<simb::MCParticle>, as is read in the next step.
    // However, the default splitlevel means it's stored as monolithic blocks and has no "obj." stuff.
    // The only way I can see to get at it is to do a ttreeformula. 
    // However, I think the only thing in there we care about is the track number...?

    for(size_t i=0;i<v_mctruths.size();i++) {      
      TTreeFormula ttf("tff",string(name+"obj.fPartList["+std::to_string((long long)i)+"].ftrackId").c_str(),fTree);
      int npart = ttf.GetNdata();
      JsonArray trackids;
      for(int j = 0;j<npart; j++) {
        trackids.add((int)ttf.EvalInstance(j));
      }
      v_mctruths[i].add("trackIds",trackids);
    }
    JsonArray arr(v_mctruths);
    mctruth_list.add(stripdots(name),arr);
    timer.addto(fStats);
    
  }
  mc.add("mctruth",mctruth_list);

  JsonObject particle_list;
  leafnames = findLeafOfType("vector<simb::MCParticle>");
  for(size_t iname = 0; iname<leafnames.size(); iname++) {
    std::string name = leafnames[iname];
    if(fTree->GetLeaf((name+"obj_").c_str())==0) continue;
    TimeReporter timer(name);
    
    JsonElement::sfDecimals=5;
    JsonArray gparticle_arr;
  
    vector<pair< string,string> > key_leaf_pairs;
    key_leaf_pairs.push_back(make_pair<string,string>("fdaughters"                 , name+"obj.fdaughters"               ));
    key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fE"                   , name+"obj.fGvtx.fE"                 ));
    key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fP.fX"                , name+"obj.fGvtx.fP.fX"              ));
    key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fP.fY"                , name+"obj.fGvtx.fP.fY"              ));
    key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fP.fZ"                , name+"obj.fGvtx.fP.fZ"              ));
    key_leaf_pairs.push_back(make_pair<string,string>("fmass"                      , name+"obj.fmass"                    ));
    key_leaf_pairs.push_back(make_pair<string,string>("fmother"                    , name+"obj.fmother"                  ));
    key_leaf_pairs.push_back(make_pair<string,string>("fpdgCode"                   , name+"obj.fpdgCode"                 ));
    key_leaf_pairs.push_back(make_pair<string,string>("fpolarization.fX"           , name+"obj.fpolarization.fX"         ));
    key_leaf_pairs.push_back(make_pair<string,string>("fpolarization.fY"           , name+"obj.fpolarization.fY"         ));
    key_leaf_pairs.push_back(make_pair<string,string>("fpolarization.fZ"           , name+"obj.fpolarization.fZ"         ));
    key_leaf_pairs.push_back(make_pair<string,string>("fprocess"                   , name+"obj.fprocess"                 ));
    key_leaf_pairs.push_back(make_pair<string,string>("frescatter"                 , name+"obj.frescatter"               ));
    key_leaf_pairs.push_back(make_pair<string,string>("fstatus"                    , name+"obj.fstatus"                  ));
    key_leaf_pairs.push_back(make_pair<string,string>("ftrackId"                   , name+"obj.ftrackId"                 ));
    key_leaf_pairs.push_back(make_pair<string,string>("fWeight"                    , name+"obj.fWeight"                  ));
    std::vector<JsonObject> v_particles = ftr.makeVector(key_leaf_pairs);
    std::cout << "Making particle list " << name << " " << v_particles.size() << std::endl;
    TreeElementLooter l(fTree,name+"obj.ftrajectory.ftrajectory");
    for(size_t i=0;i<v_particles.size();i++) {
      if(l.ok()){        
        // Add  the trajectory points.
        const std::vector<pair<TLorentzVector,TLorentzVector> > *traj;
        traj = l.get<std::vector<pair<TLorentzVector,TLorentzVector> > >(i);

        // Find which points are really required.
        // Start at the beginning and trace along the mom'm vector until you find a point outside of tolerance. Add that point
        // and use it as the seed for later ones.
        int n = traj->size();
        if(n<1) continue;
        std::vector<unsigned char> usePt(n,0);
        usePt[0] = 1;
        const TLorentzVector* x0 = &((*traj)[0].first);
        const TLorentzVector* p  = &((*traj)[0].second);
        int n_need = 1;
        for(int j=1;j<n;j++) {
          int off = pointOffLine(*x0,*p,(*traj)[j].first,0.3);
          // cout << j << " " << delta << endl;
          if(off) { // 0.1 mm tolerance
            usePt[j] = 1; n_need++;
            x0 = &((*traj)[j].first);
            p  = &((*traj)[j].second); 
          }
        }
        // add the last one no matter what.
        if(usePt[n-1]==0) { usePt[n-1]=1; n_need++; }

        // std::cout << "MC track " << i << " found trajectory points " << n_need << " / " << n << endl;

        /*
        // Order the trajectory points by how far they diverge from a line from start to finish.
        // Add the first two points as being crucial.
        int n = traj->size();
        std::vector<double> ptAcc(n,-1);
        ptAcc[0] = ptAcc[traj->size()-1] = 1e99;
        // Now recursively go through unused points. Each time, find the point furthest off the existing line,
        // and add it, labelling it's accuracy as the degree to which it corrects the implicit line you would
        // have used if you didn't know it.
        bool done = false;
        while(!done) {
          int worst=-1;
          double worstacc = -1;
          int lowbracket = 0;
          int highbracket = traj->size()-1;
          for(int k=0;k<n;k++) {
            // consider point k.
            if(ptAcc[k]>-1) {
              lowbracket = k;
              continue; // done this one.
            }
            // ok, we're considering point k. Find the high bracket.
            for(int m=k+1;k<n;m++) {
              if(ptAcc[m]>-1) {
                highbracket = m;
                break; 
              }              
            }
            // Find accuracy improvement from point k.
            double acc = distanceOffLine( (*traj)[k].first.Vect(), (*traj)[lowbracket].first.Vect(), (*traj)[highbracket].first.Vect() );
            if(acc > worstacc) { worst = k; worstacc = acc;}
            // cout << "Considering point " << k << " between " << lowbracket << " and " << highbracket << " has accuracy " << acc 
            //               << " worst is " << worst << endl;
          }
          cout << "Worst is " << worst << " with acc " << worstacc << " out of " << n << endl;
          if(worst == -1) done = true;
          else            ptAcc[worst] = worstacc;
          if(worstacc < 0.1) done = true;
        }
        */


        JsonArray jtraj;
        for(size_t j=0;j<traj->size();j++){
          if(usePt[j]==0) continue;
          JsonObject trajpoint;
          const TLorentzVector& pos = (*traj)[j].first;
          const TLorentzVector& mom = (*traj)[j].second;
          // trajpoint.add("acc",ptAcc[j]);
          trajpoint.add("x",JsonFixed(pos.X(),1));
          trajpoint.add("y",JsonFixed(pos.Y(),1));
          trajpoint.add("z",JsonFixed(pos.Z(),1));
          trajpoint.add("t",JsonFixed(pos.T(),1));
          trajpoint.add("px",JsonFixed(mom.X(),4));
          trajpoint.add("py",JsonFixed(mom.Y(),4));
          trajpoint.add("pz",JsonFixed(mom.Z(),4));
          trajpoint.add("E" ,JsonFixed(mom.T(),6));
          jtraj.add(trajpoint);
        }
        v_particles[i].add("trajectory",jtraj);
      }
    }
    JsonArray j_particles(v_particles);
  
    JsonElement::sfDecimals=2;

    particle_list.add(stripdots(name),j_particles);
    timer.addto(fStats);
  }
  mc.add("particles",particle_list);
  
  fOutput.add("mc",mc);
  
}


void RecordComposer::compose()
{
  fOutput.add("converter","ComposeResult.cpp $Revision$ $Date$ ");

  // parse some options.
  int doCal = 1;
  int doRaw = 1;
  if( std::string::npos != fOptions.find("_NOCAL_")) doCal = 0;
  if( std::string::npos != fOptions.find("_NORAW_")) doRaw = 0;

  if(!doCal) composeCalAvailability(); // just look at branch names.
  if(!doRaw) composeRawAvailability();

  // Set branches to read here.
  fTree->SetBranchStatus("*",1);  // By default, read nothing.
  
  fTree->SetBranchStatus("raw::RawDigits*",doRaw); // Speed!
  fTree->SetBranchStatus("recob::Wires*"  ,doCal); // Speed!
  
  fTree->SetBranchStatus("anab::*",0); // Don't analyze this yet.
  fTree->SetBranchStatus("sim::Photonss*",0); // Don't analyze this yet.
  fTree->SetBranchStatus("sim::Channels*",0); // Don't analyze this yet.
  fTree->SetBranchStatus("sim::AuxDetChannels*",0); // Don't analyze this yet.
  
  
  // Remove from the list anything which looks like a prespill or a postspill window if
  // it's being de-requested.
  if( std::string::npos != fOptions.find("_NoPreSpill_"))  fTree->SetBranchStatus("raw::RawDigits_daq_preSpill*",0);
  if( std::string::npos != fOptions.find("_NoPostSpill_")) fTree->SetBranchStatus("raw::RawDigits_daq_postSpill*",0);


  //
  // Load the tree element. This should be very fast, but we're loading no 
  //
  Int_t bytesRead;
  {
    TimeReporter timer("GetEntry");
    bytesRead = fTree->GetEntry(fEntry);
    timer.addto(fStats);
  }
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

  // Wire data.
  // Start first so background image conversion tasks can be started as we build the rest.
  if(doCal) composeCal();
  if(doRaw) composeRaw();

  //reco
  composeHits();
  composeClusters();
  composeVertex2d();
  composeSpacepoints();
  composeTracks();
  
  // Optical
  composeOpPulses();
  composeOpFlashes();
  composeOpHits();
  
  composeAuxDets();
  
  composeMC();
  
  RecordComposer::composeAssociations();
    
  fOutput.add("stats",fStats);
  
  
}

void RecordComposer::composeAssociations()
{
  TimeReporter timer("Associations");
  
  JsonObject assns;
  std::map<std::string, JsonObject> assn_list;
  std::map<std::string, JsonObject>::iterator assn_list_itr;
  
  // First, create a lookup table of all the tree branches.
  std::map<uint32_t,TBranch*> branchmap;
  TObjArray* branches = fTree->GetListOfBranches();
  int n = branches->GetEntriesFast();
  for(int i=0;i<n;i++) {
    TObject* o = branches->At(i);
    TBranch* b = (TBranch*)o;
    std::string bname = b->GetName();
    uint32_t    branchid = crc32checksum(bname);
    branchmap[branchid] = b;
    //std::cout << branchid << "\t" << bname << std::endl;
  }
  
  // Next, load the BranchIDLists
  TFile* file = fTree->GetCurrentFile();
  TTree* metaData = dynamic_cast<TTree*>(file->Get("MetaData"));
  if(!metaData) {
    std::cout << "Grr! Can't find metadata tree!";
    assns.add("error","Can't find metadata tree.");
    fOutput.add("associations",assns);
    return;
  }

  metaData->GetEntry(0);
  
  // TreeElementLooter l(metaData,"BranchIDLists");
  // const std::vector< std::vector<unsigned int> > *branchidlists = l.get<std::vector< std::vector<unsigned int> > >(0);
  
  // Note that we have to have a LinkDef.h for this to work, which includes the line
  // #pragma link C++ class vector<vector<unsigned int> >+;

  vector< vector< uint32_t > > *branchidlists = 0;
  metaData->SetBranchAddress("BranchIDLists",&branchidlists);
  metaData->GetEntry(0);
  if(branchidlists==0) {
    std::cout << "Grr! Can't get branchidlists!";
    assns.add("error","Can't get branchidlists from metadata tree.");
    fOutput.add("associations",assns);
    return;
  }
  //std::cout << " branchidlists size: " << (*branchidlists).size() << std::endl;

  // Now actually get a list of associations.
  vector<string> names = findLeafOfType("art::Wrapper<art::Assns");
  for(size_t iname=0; iname<names.size(); iname++) {
    std::string& name = names[iname];
    TimeReporter onetimer(name);
    cout << "Looking at association " << name << endl;

    if(!fTree->GetBranchStatus(name.c_str())) {
      std::cout << " Skipping " << name << std::endl;
      continue;
    }
    
    // Attempt to pull association data.
    TTreeFormula f_a("f_a",std::string(name+".obj.ptr_data_1_.second").c_str(),fTree);
    TTreeFormula f_b("f_b",std::string(name+".obj.ptr_data_2_.second").c_str(),fTree);

    TTreeFormula f_a_processId("f_a_processId",std::string(name+".obj.ptr_data_1_.first.id_.processIndex_").c_str(),fTree);
    TTreeFormula f_a_productId("f_a_productId",std::string(name+".obj.ptr_data_1_.first.id_.productIndex_").c_str(),fTree);
    TTreeFormula f_b_processId("f_b_processId",std::string(name+".obj.ptr_data_2_.first.id_.processIndex_").c_str(),fTree);
    TTreeFormula f_b_productId("f_b_productId",std::string(name+".obj.ptr_data_2_.first.id_.productIndex_").c_str(),fTree);

    int na = f_a.GetNdata();
    int nb = f_b.GetNdata();
    if(na!=nb) cout << "Error: Association " << name << " has mismatched entry lists " << std::endl;
    if(na == 0) continue;  // Don't bother with empty association lists.

    // Also eval the other formulas:
    if(f_a_processId.GetNdata() ==0) continue;
    if(f_a_productId.GetNdata() ==0) continue;
    if(f_b_processId.GetNdata() ==0) continue;
    if(f_b_productId.GetNdata() ==0) continue;
    
    // At this point, we'll assume that no association is heterogeneous.
    size_t a_processId = f_a_processId.EvalInstance(0);
    size_t a_productId = f_a_productId.EvalInstance(0);
    size_t b_processId = f_b_processId.EvalInstance(0);
    size_t b_productId = f_b_productId.EvalInstance(0);
    
    // Now we can get the branches for these guys.
    // What a complex mess!
    uint32_t a_branchid = (*branchidlists)[a_processId-1][a_productId-1];
    TBranch* a_branch = branchmap[ a_branchid ];
    uint32_t b_branchid = (*branchidlists)[b_processId-1][b_productId-1];
    TBranch* b_branch = branchmap[ b_branchid ];

    if(!a_branch) { cout<< "  Can't find A branch!" << endl;  continue;}
    if(!b_branch) { cout<< "  Can't find B branch!" << endl;  continue;}
    
    std::string a_name = stripdots(a_branch->GetName());
    std::string b_name = stripdots(b_branch->GetName());
    
    std::cout << "  A branch: " << a_name << endl;
    std::cout << "  B branch: " << b_name << endl;
    
    // OK, so now we're ready to build the association maps.
    std::vector< JsonArray > a_to_b;
    std::vector< JsonArray > b_to_a;
    for(Int_t i=0;i<na;i++) {
      int a_id = f_a.EvalInstance(i);
      int b_id = f_b.EvalInstance(i);
      if(a_to_b.size() <= a_id) a_to_b.resize(a_id+1);
      a_to_b[a_id].add(b_id);
      if(b_to_a.size() <= b_id) b_to_a.resize(b_id+1);
      b_to_a[b_id].add(a_id);
    }
    
    // Create the JSON objects, which are also arrays-of-arrays. Some arrays are empty.
    JsonArray j_a_to_b;
    for(size_t j=0;j<a_to_b.size();j++) { j_a_to_b.add(a_to_b[j]); }
    JsonArray j_b_to_a;
    for(size_t j=0;j<b_to_a.size();j++) { j_b_to_a.add(b_to_a[j]); }

    // Create the JSON objects, which are here coded as map-to-arrays.
    // This works too, but actually leads to bigger output and slower parse times, since it's not very sparse. 
    // JsonObject j_a_to_b;
    // for(size_t j=0;j<a_to_b.size();j++) {
    //   if(a_to_b[j].size()>0) j_a_to_b.add(std::to_string(j),JsonArray(a_to_b[j]));
    //  }
    // JsonObject j_b_to_a;
    // for(size_t j=0;j<b_to_a.size();j++) {
    //   if(b_to_a[j].size()>0) j_b_to_a.add(std::to_string(j),JsonArray(b_to_a[j]));
    // }

    // Now push these into the maps.
    assn_list[a_name].add(b_name,j_a_to_b);
    assn_list[b_name].add(a_name,j_b_to_a);
    onetimer.addto(fStats);
  }

  // Add maps to output object.
  for(assn_list_itr = assn_list.begin(); assn_list_itr != assn_list.end(); assn_list_itr++) {
    assns.add(assn_list_itr->first, assn_list_itr->second);
  }
  cout << "Association total size: " << assns.str().length() << std::endl;
  fOutput.add("associations",assns);
  fStats.add("Associations",timer.t.Count());
}


// Utility functions.


vector<string>  RecordComposer::findLeafOfType(std::string pattern)
{
  /// Look in the tree. Try to find a leafelement that matches 'pattern'.
  /// Return the full name of that leaf.
  vector<string> retval;
  
  // Strip whitespace from pattern.
  pattern.erase(std::remove_if(pattern.begin(), pattern.end(), ::isspace), pattern.end());
  
  TObjArray* list = fTree->GetListOfLeaves();
  for(int i=0;i<list->GetEntriesFast();i++) {
    TObject* o = list->At(i);
    TLeaf* le = (TLeaf*)o;
    std::string name = le->GetTypeName();
    // Strip whitespace from pattern.
    name.erase(std::remove_if(name.begin(), name.end(), ::isspace), name.end());
    size_t found = name.find(pattern);
    if(found != std::string::npos) {
      // Return this match.
      retval.push_back(le->GetName());
    }
  }
  return retval;
}


