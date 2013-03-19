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

void RecordComposer::composeClusters()
{
  vector<string> leafnames = findLeafOfType("vector<recob::Cluster>>");
  if(leafnames.size()==0) {
    fOutput.add("cluster_warning","No cluster branch found in file.");
    return;
  } 
  if(leafnames.size()>1) {
    fOutput.add("cluster_warning","More than one cluster list found!");
  } 
  
  
  for(string name : leafnames) {    
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
      
      // auto-construct arrays; lots o' syntactic sugar here.
      if(startPos.ok())       jclus.add("startPos",     JsonArray(*(startPos     .get<vector<double> >(i))));
      if(endPos.ok())         jclus.add("endPos",       JsonArray(*(endPos       .get<vector<double> >(i))));
      if(sigmaStartPos.ok())  jclus.add("sigmaStartPos",JsonArray(*(sigmaStartPos.get<vector<double> >(i))));
      if(sigmaEndPos.ok())    jclus.add("sigmaEndPos",  JsonArray(*(sigmaEndPos  .get<vector<double> >(i))));
      

      jClusters.add(jclus);
    }
    if(leafnames.size()==1) 
      fOutput.add("clusters",jClusters);
    else
      fOutput.add(string("clusters_")+name,jClusters);
  }    
}

void  RecordComposer::composeSpacepoints()
{
  vector<string> leafnames = findLeafOfType("vector<recob::SpacePoint> >");
  if(leafnames.size()==0) {
    fOutput.add("spacepoint_warning","No cluster branch found in file.");
    return;
  } 
  if(leafnames.size()>1) {
    fOutput.add("spacepoint_warning","More than one cluster list found!");
  } 
  
  
  for(string name : leafnames) {    
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
    if(leafnames.size()==1) 
      fOutput.add("spacepoints",jSpacepoints);
    else
      fOutput.add(string("spacepoints_")+name,jSpacepoints);
  }  
}
  
void  RecordComposer::composeTracks()
{
  vector<string> leafnames = findLeafOfType("vector<recob::Track>");
  if(leafnames.size()==0) {
    fOutput.add("tracks_warning","No track branch found in file.");
    return;
  } 
  if(leafnames.size()>1) {
    fOutput.add("tracks_warning","More than one track list found!");
  } 


  for(string name : leafnames) {    
    std::cout << "Looking at track object " << (name+"obj_").c_str() << endl;
    JsonArray jTracks;
    TLeaf* l = fTree->GetLeaf((name+"obj_").c_str());
    if(!l) continue;
    int n = l->GetLen();
    cout << "Found " << n << " objects" << endl;
    

    //          vector<TVector3> recob::Tracks_trackkalmanhit__Reco.obj.fXYZ
    //          vector<TVector3> recob::Tracks_trackkalmanhit__Reco.obj.fDir
    // vector<TMatrixT<double> > recob::Tracks_trackkalmanhit__Reco.obj.fCov
    //   vector<vector<double> > recob::Tracks_trackkalmanhit__Reco.obj.fdQdx
    //            vector<double> recob::Tracks_trackkalmanhit__Reco.obj.fFitMomentum
    //                     Int_t recob::Tracks_trackkalmanhit__Reco.obj.fID

    TreeElementLooter tel_fXYZ         (fTree,name+"obj.fXYZ");
    TreeElementLooter tel_fDir         (fTree,name+"obj.fDir");
    TreeElementLooter tel_fCov         (fTree,name+"obj.fCov");
    TreeElementLooter tel_fdQdx        (fTree,name+"obj.fdQdx");
    TreeElementLooter tel_fFitMomentum (fTree,name+"obj.fFitMomentum");

    for(int i=0;i<n;i++) {
      JsonObject jtrk;
    
      jtrk.add("id"    ,ftr.getJson(name+"obj.fID"       ,i));
      const vector<TVector3>          *XYZ           = tel_fXYZ        .get<vector<TVector3>          >(i);
      // const vector<TVector3>          *Dir           = tel_fDir        .get<vector<TVector3>          >(i);
      // const vector<TMatrixT<double> > *Cov           = tel_fCov        .get<vector<TMatrixT<double> > >(i);
      // const vector<vector<double> >   *dQdx          = tel_fdQdx       .get<vector<vector<double> >   >(i);
      // const vector<double>            *FitMomentum   = tel_fFitMomentum.get<vector<double>            >(i);
      JsonArray jpoints;
      
      for(int j=0;j<XYZ->size();j++) {
        JsonObject jpoint;
        jpoint.add("x",(*XYZ)[j].x());
        jpoint.add("y",(*XYZ)[j].y());
        jpoint.add("z",(*XYZ)[j].z());
        jpoints.add(jpoint);
      }
      jtrk.add("points",jpoints);

      jTracks.add(jtrk);
    }

    if(leafnames.size()==1) 
      fOutput.add("tracks",jTracks);
    else
      fOutput.add(string("tracks_")+name,jTracks);
  }  

}
  
// Optical
void  RecordComposer::composeOpFlashes()
{}
  
void  RecordComposer::composeOpHits()
{}


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


void RecordComposer::composeCal() 
{
  JsonObject r;
  TLeaf* lf = fTree->GetLeaf("recob::Wires_caldata__Reco.obj.fView");
  if(!lf) {
    // fOutput.add("cal","no leaf named recob::Wires_caldata__Reco.obj.fView");
    return;
  }
  int nwires = lf->GetLen();

  TreeElementLooter l(fTree,"recob::Wires_caldata__Reco.obj.fSignal");
  if(!l.ok()) return;
  const std::vector<float> *ptr = l.get<std::vector<float>>(0);
  
  
  size_t width = ptr->size();
  // Notes: calibrated values of fSignal on wires go roughly from -100 to 2500
  MakePng png(width,nwires,MakePng::palette_alpha,fPalette,fPaletteTrans);
  MakePng encoded(width,nwires,MakePng::rgb);
  ColorMap colormap;
  
  std::vector<unsigned char> imagedata(width);
  std::vector<unsigned char> encodeddata(width*3);

  TH1D timeProfile("timeProfile","timeProfile",width,0,width);
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
      timeProfile.Fill(k,adc);
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
  fOutput.add("cal",r);
}

void RecordComposer::composeRaw()
{
  
  JsonObject r;
  
  // Fixme: 
  // This probably changes depending upon simulation method. This should work for now.
  //   Idea: look through leaves for type of TLeafElement using  IsA() or dynamic cast.
  //         Find an object which matches leaf->GetTypeName() of art::Wrapper<vector<raw::RawDigit> > 
  //         or some crude regex match to that<
  //         
  std::string rawdigit_obj_name = "raw::RawDigits_daq__GenieGen.obj";
  TLeaf* lf = fTree->GetLeaf((rawdigit_obj_name+".fChannel").c_str());
  int ndig = lf->GetLen();
  ColorMap colormap;
  
  TreeElementLooter l(fTree,rawdigit_obj_name+".fADC");
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
      timeProfile.Fill(k,val);
    }
    png.AddRow(imagedata);
    epng.AddRow(encodeddata);

    int wire, plane;
    wireOfChannel(i,plane,wire);
    planeProfile[plane]->Fill(wire,wiresum);

  }
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
  fOutput.add("raw",r);
}



void RecordComposer::composeMC()
{
  
  // Fixme: 
  // This probably changes depending upon simulation method. This should work for now.
  std::string gtruth_obj_name = "simb::GTruths_generator__GenieGen.obj.";

  JsonArray gtruth_arr = ftr.makeArray(
      "fGint"                             ,  gtruth_obj_name+"fGint"                           
     ,"fGscatter"                         ,  gtruth_obj_name+"fGscatter"                       
     ,"fweight"                           ,  gtruth_obj_name+"fweight"                         
     ,"fprobability"                      ,  gtruth_obj_name+"fprobability"                    
     ,"fXsec"                             ,  gtruth_obj_name+"fXsec"                           
     ,"fDiffXsec"                         ,  gtruth_obj_name+"fDiffXsec"                       
     ,"fNumPiPlus"                        ,  gtruth_obj_name+"fNumPiPlus"                      
     ,"fNumPiMinus"                       ,  gtruth_obj_name+"fNumPiMinus"                     
     ,"fNumPi0"                           ,  gtruth_obj_name+"fNumPi0"                         
     ,"fNumProton"                        ,  gtruth_obj_name+"fNumProton"                      
     ,"fNumNeutron"                       ,  gtruth_obj_name+"fNumNeutron"                     
     ,"fIsCharm"                          ,  gtruth_obj_name+"fIsCharm"                        
     ,"fResNum"                           ,  gtruth_obj_name+"fResNum"                         
     ,"fgQ2"                              ,  gtruth_obj_name+"fgQ2"                            
     ,"fgq2"                              ,  gtruth_obj_name+"fgq2"                            
     ,"fgW"                               ,  gtruth_obj_name+"fgW"                             
     ,"fgT"                               ,  gtruth_obj_name+"fgT"                             
     ,"fgX"                               ,  gtruth_obj_name+"fgX"                             
     ,"fgY"                               ,  gtruth_obj_name+"fgY"                             
     ,"fFShadSystP4_fP_fBits"             ,  gtruth_obj_name+"fFShadSystP4.fP.fBits"           
     ,"fFShadSystP4_fP_fX"                ,  gtruth_obj_name+"fFShadSystP4.fP.fX"              
     ,"fFShadSystP4_fP_fY"                ,  gtruth_obj_name+"fFShadSystP4.fP.fY"              
     ,"fFShadSystP4_fP_fZ"                ,  gtruth_obj_name+"fFShadSystP4.fP.fZ"              
     ,"fFShadSystP4_fE"                   ,  gtruth_obj_name+"fFShadSystP4.fE"                 
     ,"fIsSeaQuark"                       ,  gtruth_obj_name+"fIsSeaQuark"                     
     ,"fHitNucP4_fP_fBits"                ,  gtruth_obj_name+"fHitNucP4.fP.fBits"              
     ,"fHitNucP4_fP_fX"                   ,  gtruth_obj_name+"fHitNucP4.fP.fX"                 
     ,"fHitNucP4_fP_fY"                   ,  gtruth_obj_name+"fHitNucP4.fP.fY"                 
     ,"fHitNucP4_fP_fZ"                   ,  gtruth_obj_name+"fHitNucP4.fP.fZ"                 
     ,"fHitNucP4_fE"                      ,  gtruth_obj_name+"fHitNucP4.fE"                    
     ,"ftgtZ"                             ,  gtruth_obj_name+"ftgtZ"                           
     ,"ftgtA"                             ,  gtruth_obj_name+"ftgtA"                           
     ,"ftgtPDG"                           ,  gtruth_obj_name+"ftgtPDG"                         
     ,"fProbePDG"                         ,  gtruth_obj_name+"fProbePDG"                       
     ,"fProbeP4_fP_fBits"                 ,  gtruth_obj_name+"fProbeP4.fP.fBits"               
     ,"fProbeP4_fP_fX"                    ,  gtruth_obj_name+"fProbeP4.fP.fX"                  
     ,"fProbeP4_fP_fY"                    ,  gtruth_obj_name+"fProbeP4.fP.fY"                  
     ,"fProbeP4_fP_fZ"                    ,  gtruth_obj_name+"fProbeP4.fP.fZ"                  
     ,"fProbeP4_fE"                       ,  gtruth_obj_name+"fProbeP4.fE"                     
     ,"fVertex_fP_fX"                     ,  gtruth_obj_name+"fVertex.fP.fX"                   
     ,"fVertex_fP_fY"                     ,  gtruth_obj_name+"fVertex.fP.fY"                   
     ,"fVertex_fP_fZ"                     ,  gtruth_obj_name+"fVertex.fP.fZ"                   
     ,"fVertex_fE"                        ,  gtruth_obj_name+"fVertex.fE"                      
  );
  
  // Fixme: 
  // This probably changes depending upon simulation method. This should work for now.
  JsonElement::sfDecimals=5;
  JsonArray gparticle_arr;
  std::string gpart_obj_name = "simb::MCParticles_largeant__GenieGen.obj.";
 
  vector<pair< string,string> > key_leaf_pairs;
  key_leaf_pairs.push_back(make_pair<string,string>("fdaughters"                 , gpart_obj_name+"fdaughters"               ));
  key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fE"                   , gpart_obj_name+"fGvtx.fE"                 ));
  key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fP.fX"                , gpart_obj_name+"fGvtx.fP.fX"              ));
  key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fP.fY"                , gpart_obj_name+"fGvtx.fP.fY"              ));
  key_leaf_pairs.push_back(make_pair<string,string>("fGvtx.fP.fZ"                , gpart_obj_name+"fGvtx.fP.fZ"              ));
  key_leaf_pairs.push_back(make_pair<string,string>("fmass"                      , gpart_obj_name+"fmass"                    ));
  key_leaf_pairs.push_back(make_pair<string,string>("fmother"                    , gpart_obj_name+"fmother"                  ));
  key_leaf_pairs.push_back(make_pair<string,string>("fpdgCode"                   , gpart_obj_name+"fpdgCode"                 ));
  key_leaf_pairs.push_back(make_pair<string,string>("fpolarization.fX"           , gpart_obj_name+"fpolarization.fX"         ));
  key_leaf_pairs.push_back(make_pair<string,string>("fpolarization.fY"           , gpart_obj_name+"fpolarization.fY"         ));
  key_leaf_pairs.push_back(make_pair<string,string>("fpolarization.fZ"           , gpart_obj_name+"fpolarization.fZ"         ));
  key_leaf_pairs.push_back(make_pair<string,string>("fprocess"                   , gpart_obj_name+"fprocess"                 ));
  key_leaf_pairs.push_back(make_pair<string,string>("frescatter"                 , gpart_obj_name+"frescatter"               ));
  key_leaf_pairs.push_back(make_pair<string,string>("fstatus"                    , gpart_obj_name+"fstatus"                  ));
  key_leaf_pairs.push_back(make_pair<string,string>("ftrackId"                   , gpart_obj_name+"ftrackId"                 ));
  key_leaf_pairs.push_back(make_pair<string,string>("fWeight"                    , gpart_obj_name+"fWeight"                  ));
  std::vector<JsonObject> v_particles = ftr.makeVector(key_leaf_pairs);
  TreeElementLooter l(fTree,gpart_obj_name+"ftrajectory.ftrajectory");
  JsonArray j_particles;
  if(l.ok()){
    for(int i=0;i<v_particles.size();i++) {
      // Add  the trajectory points.
      const std::vector<pair<TLorentzVector,TLorentzVector> > *traj;
      traj = l.get<std::vector<pair<TLorentzVector,TLorentzVector>>>(i);
      JsonArray jtraj;
      for(int j=0;j<traj->size();j++){
        JsonObject trajpoint;
        const TLorentzVector& pos = (*traj)[j].first;
        const TLorentzVector& mom = (*traj)[j].second;
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
  
  JsonObject mc;
  mc.add("gtruth",gtruth_arr);
  mc.add("particles",j_particles);
  fOutput.add("mc",mc);
  
}


void RecordComposer::compose()
{
  fOutput.add("converter","ComposeResult.cpp $Revision$ $Date$ ");

  // parse options.
  int doCal = 1;
  int doRaw = 1;
  if( std::string::npos != fOptions.find("_WIRES_")) doCal = 1;

  // Set branches to read here.
  fTree->SetBranchStatus("*",1);  // By default, read all.
  fTree->SetBranchStatus("raw::RawDigits*",doRaw); // Don't know how to read these yet.
  fTree->SetBranchStatus("recob::Wires_caldata",doCal);

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

  //reco
  composeHits();
  composeClusters();
  composeSpacepoints();
  composeTracks();
  
  if(doCal) composeCal();
  if(doRaw) composeRaw();
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


