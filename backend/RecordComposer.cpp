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
{
  unsigned char vv[] =   { 
    #include "palette.inc" 
  };
  fPalette.assign(&vv[0], &vv[0]+sizeof(vv));
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
  int nwires = lf->GetLen();

  TreeElementLooter l(fTree,"recob::Wires_caldata__Reco.obj.fSignal");
  l.Setup();
  const std::vector<float> *ptr = l.get<std::vector<float>>(0);
  
  
  size_t width = ptr->size();
  // Notes: calibrated values of fSignal on wires go roughly from -100 to 2500
  MakePng png(width,nwires,MakePng::palette,fPalette);
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
  std::string rawdigit_obj_name = "raw::RawDigits_daq__GenieGen.obj";
  TLeaf* lf = fTree->GetLeaf((rawdigit_obj_name+".fChannel").c_str());
  int ndig = lf->GetLen();
  ColorMap colormap;
  
  TreeElementLooter l(fTree,rawdigit_obj_name+".fADC");
  l.Setup();
  const std::vector<short> *ptr = l.get<std::vector<short>>(0);
  // FIXME: Naive assumption that all vectors will be this length. Will be untrue for compressed or decimated data!
  size_t width = ptr->size();

  MakePng png(width,ndig,MakePng::palette,fPalette);
  MakePng epng(width,ndig,MakePng::rgb);
  std::vector<unsigned char> imagedata(width);
  std::vector<unsigned char> encodeddata(width*3);
   
  
  for(int i=0;i<ndig;i++) {
    ptr= l.get<std::vector<short>>(i);
    std::vector<short>::iterator it;
    for(size_t k = 0; k<width; k++) {
      short raw = (*ptr)[k];
      // colormap.get(&imagedata[k*3],float(raw)/4000.);
      imagedata[k] = tanscale(raw);
      
      // Save bitpacked data as image map.
      int iadc = raw + 0x8000;
      encodeddata[k*3]   = 0xFF&(iadc>>8);
      encodeddata[k*3+1] = iadc&0xFF;
      encodeddata[k*3+2] = 0;
    }
    png.AddRow(imagedata);
    epng.AddRow(encodeddata);
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
  fOutput.add("raw",r);
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
  composeHits();
  
  if(doCal) composeCal();
  if(doRaw) composeRaw();
  
  
  
}

