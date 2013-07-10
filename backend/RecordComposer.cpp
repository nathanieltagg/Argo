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
#include "TBranchElement.h"
#include "TStreamerInfo.h"

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
#include <stdlib.h>

using namespace std;

std::string RecordComposer::sfFileStoragePath = "../datacache";
std::string RecordComposer::sfUrlToFileStorage = "datacache";

void BuildThumbnail(const std::string& pathname, const std::string& thumbname)
{
  // Compose a thumbnail image using external application. 
  // Fork a background process for more speed.
  std::string cmd = "PATH=$PATH:/usr/local/bin convert ";
  cmd += pathname;
  cmd += " -sample 20% ";
  cmd += thumbname;
  cmd += " &";
  std::cerr << "BuildThumbnail: " << cmd << std::endl;
  system(cmd.c_str());
}


JsonObject TH1ToHistogram( TH1* hist )
{
  JsonObject h;
  if(!hist) return h;
  h.add("n",hist->GetNbinsX());
  h.add("min",hist->GetXaxis()->GetXmin());
  h.add("max",hist->GetXaxis()->GetXmax());
  h.add("underflow",hist->GetBinContent(0));
  h.add("overflow",hist->GetBinContent(hist->GetNbinsX()+1));
  double tot = hist->GetSumOfWeights();
  h.add("total",tot);
  h.add("sum_x",tot*hist->GetMean());
  h.add("max_content",hist->GetMaximum());
  h.add("min_content",hist->GetMinimum());
  JsonArray data;
  for(int i=1; i <= hist->GetNbinsX();i++) {
    data.add(hist->GetBinContent(i));
  }
  h.add("data",data);
  return h;
}


inline unsigned char tanscale(float adc) 
{
  return (unsigned char)(atan(adc/50.)/M_PI*256.) + 127;  
}

inline float inv_tanscale(unsigned char y) 
{
  return tan((y-127)*M_PI/256.)*50.;
}
 
std::string stripdots(const std::string& s)
{
  std::string out = s;
  size_t pos;
  while((pos = out.find('.')) != std::string::npos)  out.erase(pos, 1);
  return out;
}



RecordComposer::RecordComposer(JsonObject& output, TTree* tree, Long64_t jentry, const std::string options)
  : fOutput(output), fTree(tree), fEntry(jentry), fOptions(options), ftr(tree)
    ,fPalette(256*3) 
   ,fPaletteTrans(256) 
{
  unsigned char vv[] =   { 
    #include "palette.inc" 
  };
  fPalette.assign(&vv[0], &vv[0]+sizeof(vv));
  unsigned char vvt[] =   { 
    #include "palette_trans.inc" 
  };
  fPaletteTrans.assign(&vvt[0], &vvt[0]+sizeof(vvt));
};
  
RecordComposer::~RecordComposer()
{
}

static void hsvToRgb(unsigned char* out, float h, float s, float v){
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
  header.add("TDCEnd",3200);
  
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
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {
    std::string name = leafnames[iname];
    std::cout << "Looking at hits object " << (name+"obj_").c_str() << endl;
        
    // JsonArray arr = ftr.makeArray(
   //        "wire",     name+"obj.fWireID.Wire"
   //      , "plane",    name+"obj.fWireID.Plane"
   //      , "view",     name+"obj.fView"
   //      , "m",        name+"obj.fMultiplicity"
   //      , "q",        name+"obj.fCharge"
   //      , "σq",       name+"obj.fSigmaCharge"
   //      , "t",        name+"obj.fPeakTime"
   //      , "σt",       name+"obj.fSigmaPeakTime"
   //      , "t1",       name+"obj.fStartTime"
   //      , "t2",       name+"obj.fEndTime"
   //          , "rdkey",name+"obj.fRawDigit.key_"
   //    );
   //  r.add("n",arr.length());
   //  r.add("hits",arr);

    JsonArray arr;
    TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
    if(!l) continue;
    int nhits = l->GetLen();
    cout << "nhits: " << nhits << endl;

    for(int i=0;i<nhits;i++) {
      JsonObject hit;
      hit.add("wire",      ftr.getJson(name+"obj.fWireID.Wire",i));
      hit.add("plane",     ftr.getJson(name+"obj.fWireID.Plane" ,i));
      hit.add("view",      ftr.getJson(name+"obj.fView" ,i));
      hit.add("m",         ftr.getJson(name+"obj.fMultiplicity",i));
      hit.add("q",         ftr.getJson(name+"obj.fCharge",i));
      hit.add("\u03C3q",   ftr.getJson(name+"obj.fSigmaCharge" ,i));
      hit.add("t",         ftr.getJson(name+"obj.fPeakTime" ,i));
      hit.add("\u03C3t",   ftr.getJson(name+"obj.fSigmaPeakTime" ,i));
      hit.add("t1",        ftr.getJson(name+"obj.fStartTime" ,i));
      hit.add("t2",        ftr.getJson(name+"obj.fEndTime" ,i));
      // \u03C3 is the UTF-8 encoding for \sigma. See http://www.fileformat.info/info/unicode/char/03c3/index.htm
      
      
      arr.add(hit);
    }
    
    reco_list.add(stripdots(name),arr);
  }
  fOutput.add("hits",reco_list);
}

// Utility function for composeCluster
JsonObject GetClusterWireAndTDC(TreeElementLooter& l, int row) {
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
  } 
  fOutput.add("clusters",reco_list);
}

void  RecordComposer::composeSpacepoints()
{
  vector<string> leafnames = findLeafOfType("vector<recob::SpacePoint> >");  
  JsonObject reco_list;
    
  for(size_t iname = 0; iname<leafnames.size(); iname++) {    
    std::string name = leafnames[iname];
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
  }  
  fOutput.add("spacepoints",reco_list);
}
  
void  RecordComposer::composeTracks()
{
  vector<string> leafnames = findLeafOfType("vector<recob::Track>");

  JsonObject reco_list;

  for(size_t iname = 0; iname<leafnames.size(); iname++) {    
    std::string name = leafnames[iname];
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
      const vector<vector<double> >   *dQdx          = tel_fdQdx       .get<vector<vector<double> >   >(i);
      const vector<double>            *FitMomentum   = tel_fFitMomentum.get<vector<double>            >(i);
      JsonArray jpoints;
      
      for(int j=0;j<XYZ->size();j++) {
        JsonObject jpoint;
        jpoint.add("x",(*XYZ)[j].x());
        jpoint.add("y",(*XYZ)[j].y());
        jpoint.add("z",(*XYZ)[j].z());
        jpoint.add("vx",(*Dir)[j].x());
        jpoint.add("vy",(*Dir)[j].y());
        jpoint.add("vz",(*Dir)[j].z());
        jpoint.add("dQdx",(*dQdx)[0][j]);
        jpoint.add("dQdy",(*dQdx)[1][j]);
        jpoint.add("dQdz",(*dQdx)[2][j]);
        jpoint.add("P",(*FitMomentum)[j]);
        jpoints.add(jpoint);
      }
      jtrk.add("points",jpoints);

      jTracks.add(jtrk);
    }

    reco_list.add(stripdots(name),jTracks);
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
    TreeElementLooter tel_fWireCenter(fTree,name+"obj.fWireCenter");
    TreeElementLooter tel_fWireWidths(fTree,name+"obj.fWireWidths");

    for(int i=0;i<n;i++) {
      JsonObject jflash;
      jflash.add("time"       ,ftr.getJson(name+"obj.fTime",i));
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
  }   
  fOutput.add("opflashes",reco_list);
}
  
void  RecordComposer::composeOpHits()
{
  vector<string> leafnames = findLeafOfType("vector<recob::OpHit>");  
  JsonObject reco_list;
  
  for(size_t iname = 0; iname<leafnames.size(); iname++) {    
    std::string name = leafnames[iname];
    std::cout << "Looking at ophits object " << (name+"obj_").c_str() << endl;
    TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
    if(!l) continue;
    int n = l->GetLen();
    cout << "ophits: " << n << endl;
    //    Int_t recob::OpHits_ophit__Reco.obj_
    //    Int_t recob::OpHits_ophit__Reco.obj.fOpDetChannel
    // Double_t recob::OpHits_ophit__Reco.obj.fPeakTime
    // Double_t recob::OpHits_ophit__Reco.obj.fWidth
    // Double_t recob::OpHits_ophit__Reco.obj.fArea
    // Double_t recob::OpHits_ophit__Reco.obj.fAmplitude
    // Double_t recob::OpHits_ophit__Reco.obj.fPE
    // Double_t recob::OpHits_ophit__Reco.obj.fPeakTimeError
    // Double_t recob::OpHits_ophit__Reco.obj.fWidthError
    // Double_t recob::OpHits_ophit__Reco.obj.fAreaError
    // Double_t recob::OpHits_ophit__Reco.obj.fAmplitudeError
    // Double_t recob::OpHits_ophit__Reco.obj.fPEError

    JsonArray jophits;
    for(int i=0;i<n;i++) {
      JsonObject jobj;
      
      jobj.add("opDetChan"     ,ftr.getJson(name+"obj.fOpDetChannel"         ,i));
      jobj.add("peakTime"      ,ftr.getJson(name+"obj.fPeakTime"             ,i));
      jobj.add("width"         ,ftr.getJson(name+"obj.fWidth"                ,i));
      jobj.add("area"          ,ftr.getJson(name+"obj.fArea"                 ,i));
      jobj.add("amp"           ,ftr.getJson(name+"obj.fAmplitude"            ,i));
      jobj.add("pe"            ,ftr.getJson(name+"obj.fPE"                   ,i));
      jobj.add("peakTimeErr"   ,ftr.getJson(name+"obj.fPeakTimeError"        ,i));
      jobj.add("widthErr"      ,ftr.getJson(name+"obj.fWidthError"           ,i));
      jobj.add("areaErr"       ,ftr.getJson(name+"obj.fAreaError"            ,i));
      jobj.add("ampErr"        ,ftr.getJson(name+"obj.fAmplitudeError"       ,i));
      jobj.add("peErr"         ,ftr.getJson(name+"obj.fPEError"              ,i));
      jophits.add(jobj);
    }


    // if(n>0)    jophits = ftr.makeArray(
    //    "opDetChan"     ,(name+"obj.fOpDetChannel") 
    //   ,"peakTime"      ,(name+"obj.fPeakTime") 
    //   ,"width"         ,(name+"obj.fWidth") 
    //   ,"area"          ,(name+"obj.fArea") 
    //   ,"amp"           ,(name+"obj.fAmplitude") 
    //   ,"pe"            ,(name+"obj.fPE") 
    //   ,"peakTimeErr"   ,(name+"obj.fPeakTimeError") 
    //   ,"widthErr"      ,(name+"obj.fWidthError") 
    //   ,"areaErr"       ,(name+"obj.fAreaError") 
    //   ,"ampErr"        ,(name+"obj.fAmplitudeError") 
    //   ,"peErr"         ,(name+"obj.fPEError") 
    //   );
    
    reco_list.add(stripdots(name),jophits);
  }
  fOutput.add("ophits",reco_list);
  
}


void wireOfChannel(int channel, int& plane, int& wire)
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
    TLeaf* lf = fTree->GetLeaf((name+"obj_").c_str());
    if(!lf) continue;
    int nwires = lf->GetLen();
    TreeElementLooter l(fTree,name+"obj.fSignal");
    if(!l.ok()) return;
    const std::vector<float> *ptr = l.get<std::vector<float>>(0);
  
    JsonObject r;
    size_t width = ptr->size();
    // Notes: calibrated values of fSignal on wires go roughly from -100 to 2500
    MakePng png(width,nwires,MakePng::palette_alpha,fPalette,fPaletteTrans);
    MakePng encoded(width,nwires,MakePng::rgb);
    ColorMap colormap;
  
    std::vector<unsigned char> imagedata(width);
    std::vector<unsigned char> encodeddata(width*3);

    TH1D timeProfile("timeProfile","timeProfile",width,0,width);
    std::vector<Double_t> timeProfileData(width+2,0);
    std::vector<TH1*> planeProfile;
    planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",3456,0,3456));

    // JsonArray arr;
    for(long i=0;i<nwires;i++) {
      // std::cout << "Doing wire " << i << std::endl;
      // JsonObject wire;
      // wire.add("view",ftr.getJson("recob::Wires_caldata__Reco.obj.fView",i));
      // wire.add("signalType",ftr.getJson("recob::Wires_caldata__Reco.obj.fSignalType",i));
      // wire.add("rdkey",ftr.getJson("recob::Wires_caldata__Reco.obj.fRawDigit.key_",i));

      // Get signal pointer.  This is ROOT magic crap I dont' understand, but it works. 
      // pointer = (char*)cont->At(i);
      // ladd = pointer+offset;
      // ptr = (std::vector<float> *)ladd;
      ptr = l.get<std::vector<float>>(i);
      // std::string signal("[");
      float max = 0;
      float min = 1;
      double wiresum = 0;
      for(size_t k = 0; k<width; k++) {
        // Color map.
        float adc = (*ptr)[k];
        //timeProfile.Fill(k,adc);
        timeProfileData[k+1] += adc;
        
        wiresum+=adc;
        // colormap.get(&imagedata[k*3],adc/4000.);
        imagedata[k] = tanscale(adc);
      
        // Save bitpacked data as image map.
        int fadc = adc + float(0x8000);
        int iadc = fadc;
        encodeddata[k*3]   = 0xFF&(iadc>>8);
        encodeddata[k*3+1] = iadc&0xFF;
        encodeddata[k*3+2] = (unsigned char)((fadc-float(iadc))*255);
      }
      int wire, plane;
      wireOfChannel(i,plane,wire);
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
    reco_list.add(stripdots(name),r);
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
    if(!l.ok()) return;
    const std::vector<short> *ptr = l.get<std::vector<short>>(0);
    // FIXME: Naive assumption that all vectors will be this length. Will be untrue for compressed or decimated data!
    size_t width = ptr->size();

    MakePng png(width,ndig, MakePng::palette_alpha,fPalette,fPaletteTrans);
    MakePng epng(width,ndig,MakePng::rgb);
    std::vector<unsigned char> imagedata(width);
    std::vector<unsigned char> encodeddata(width*3);
  
    TH1D timeProfile("timeProfile","timeProfile",width,0,width);
    std::vector<TH1*> planeProfile;
    std::vector<Double_t> timeProfileData(width+2,0);
    planeProfile.push_back(new TH1D("planeProfile0","planeProfile0",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile1","planeProfile1",2398,0,2398));
    planeProfile.push_back(new TH1D("planeProfile2","planeProfile2",3456,0,3456));
  
  
    for(int i=0;i<ndig;i++) {
      ptr= l.get<std::vector<short>>(i);
      std::vector<short>::iterator it;
      double wiresum = 0;
    
      for(size_t k = 0; k<width; k++) {
        short raw = (*ptr)[k];
        // colormap.get(&imagedata[k*3],float(raw)/4000.);
        imagedata[k] = tanscale(raw);
      
        // Save bitpacked data as image map.
        int iadc = raw + 0x8000;
        encodeddata[k*3]   = 0xFF&(iadc>>8);
        encodeddata[k*3+1] = iadc&0xFF;
        encodeddata[k*3+2] = 0;
        double val = fabs(raw);
        wiresum += val;
        //timeProfile.Fill(k,val);
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

    delete planeProfile[0];
    delete planeProfile[1];
    delete planeProfile[2];
    reco_list.add(stripdots(name),r);
  }
  fOutput.add("raw",reco_list);
}


int pointOffLine(const TLorentzVector& x0, const TLorentzVector& pv, const TLorentzVector& x, double tol)
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


void RecordComposer::composeMC()
{

  vector<string> leafnames = findLeafOfType("vector<simb::GTruth>");
  JsonObject mc;

  JsonObject truth_list;
  for(size_t iname = 0; iname<leafnames.size(); iname++) {
    std::string name = leafnames[iname];
    
    JsonArray gtruth_arr = ftr.makeArray(
        "fGint"                             ,  name+"obj.fGint"                           
       ,"fGscatter"                         ,  name+"obj.fGscatter"                       
       ,"fweight"                           ,  name+"obj.fweight"                         
       ,"fprobability"                      ,  name+"obj.fprobability"                    
       ,"fXsec"                             ,  name+"obj.fXsec"                           
       ,"fDiffXsec"                         ,  name+"obj.fDiffXsec"                       
       ,"fNumPiPlus"                        ,  name+"obj.fNumPiPlus"                      
       ,"fNumPiMinus"                       ,  name+"obj.fNumPiMinus"                     
       ,"fNumPi0"                           ,  name+"obj.fNumPi0"                         
       ,"fNumProton"                        ,  name+"obj.fNumProton"                      
       ,"fNumNeutron"                       ,  name+"obj.fNumNeutron"                     
       ,"fIsCharm"                          ,  name+"obj.fIsCharm"                        
       ,"fResNum"                           ,  name+"obj.fResNum"                         
       ,"fgQ2"                              ,  name+"obj.fgQ2"                            
       ,"fgq2"                              ,  name+"obj.fgq2"                            
       ,"fgW"                               ,  name+"obj.fgW"                             
       ,"fgT"                               ,  name+"obj.fgT"                             
       ,"fgX"                               ,  name+"obj.fgX"                             
       ,"fgY"                               ,  name+"obj.fgY"                             
       ,"fFShadSystP4_fP_fBits"             ,  name+"obj.fFShadSystP4.fP.fBits"           
       ,"fFShadSystP4_fP_fX"                ,  name+"obj.fFShadSystP4.fP.fX"              
       ,"fFShadSystP4_fP_fY"                ,  name+"obj.fFShadSystP4.fP.fY"              
       ,"fFShadSystP4_fP_fZ"                ,  name+"obj.fFShadSystP4.fP.fZ"              
       ,"fFShadSystP4_fE"                   ,  name+"obj.fFShadSystP4.fE"                 
       ,"fIsSeaQuark"                       ,  name+"obj.fIsSeaQuark"                     
       ,"fHitNucP4_fP_fBits"                ,  name+"obj.fHitNucP4.fP.fBits"              
       ,"fHitNucP4_fP_fX"                   ,  name+"obj.fHitNucP4.fP.fX"                 
       ,"fHitNucP4_fP_fY"                   ,  name+"obj.fHitNucP4.fP.fY"                 
       ,"fHitNucP4_fP_fZ"                   ,  name+"obj.fHitNucP4.fP.fZ"                 
       ,"fHitNucP4_fE"                      ,  name+"obj.fHitNucP4.fE"                    
       ,"ftgtZ"                             ,  name+"obj.ftgtZ"                           
       ,"ftgtA"                             ,  name+"obj.ftgtA"                           
       ,"ftgtPDG"                           ,  name+"obj.ftgtPDG"                         
       ,"fProbePDG"                         ,  name+"obj.fProbePDG"                       
       ,"fProbeP4_fP_fBits"                 ,  name+"obj.fProbeP4.fP.fBits"               
       ,"fProbeP4_fP_fX"                    ,  name+"obj.fProbeP4.fP.fX"                  
       ,"fProbeP4_fP_fY"                    ,  name+"obj.fProbeP4.fP.fY"                  
       ,"fProbeP4_fP_fZ"                    ,  name+"obj.fProbeP4.fP.fZ"                  
       ,"fProbeP4_fE"                       ,  name+"obj.fProbeP4.fE"                     
       ,"fVertex_fP_fX"                     ,  name+"obj.fVertex.fP.fX"                   
       ,"fVertex_fP_fY"                     ,  name+"obj.fVertex.fP.fY"                   
       ,"fVertex_fP_fZ"                     ,  name+"obj.fVertex.fP.fZ"                   
       ,"fVertex_fE"                        ,  name+"obj.fVertex.fE"                      
    );
    truth_list.add(stripdots(name),gtruth_arr);
  }
  mc.add("gtruth",truth_list);
  
  JsonObject particle_list;
  leafnames = findLeafOfType("vector<simb::MCParticle>");
  for(size_t iname = 0; iname<leafnames.size(); iname++) {
    std::string name = leafnames[iname];
    
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
    TreeElementLooter l(fTree,name+"obj.ftrajectory.ftrajectory");
    JsonArray j_particles;
    if(l.ok()){
      for(int i=0;i<v_particles.size();i++) {
        // Add  the trajectory points.
        const std::vector<pair<TLorentzVector,TLorentzVector> > *traj;
        traj = l.get<std::vector<pair<TLorentzVector,TLorentzVector>>>(i);

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

        std::cout << "MC track " << i << " found trajectory points " << n_need << " / " << n << endl;

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
        for(int j=0;j<traj->size();j++){
          if(usePt[j]==0) continue;
          JsonObject trajpoint;
          const TLorentzVector& pos = (*traj)[j].first;
          const TLorentzVector& mom = (*traj)[j].second;
          // trajpoint.add("acc",ptAcc[j]);
          trajpoint.add("x",pos.X());
          trajpoint.add("y",pos.Y());
          trajpoint.add("z",pos.Z());
          trajpoint.add("t",pos.T());
          trajpoint.add("px",JsonElement(mom.X(),4));
          trajpoint.add("py",JsonElement(mom.Y(),4));
          trajpoint.add("pz",JsonElement(mom.Z(),4));
          trajpoint.add("E" ,JsonElement(mom.T(),6));
          jtraj.add(trajpoint);
        }
        v_particles[i].add("trajectory",jtraj);
        j_particles.add(v_particles[i]);
      }
    }
  
    JsonElement::sfDecimals=2;

    particle_list.add(stripdots(name),j_particles);
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

  // don't 
  // Set branches to read here.
  fTree->SetBranchStatus("*",1);  // By default, read all.
  fTree->SetBranchStatus("raw::RawDigits*",doRaw); // Speed!
  fTree->SetBranchStatus("recob::Wires*"  ,doCal); // Speed!

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

  // Wire data.
  // Start first so background image conversion tasks can be started as we build the rest.
  if(doCal) composeCal();
  if(doRaw) composeRaw();

  //reco
  composeHits();
  composeClusters();
  composeSpacepoints();
  composeTracks();
  
  // Optical
  composeOpFlashes();
  composeOpHits();
  
  composeMC();
  
  
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


