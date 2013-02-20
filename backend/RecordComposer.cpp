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
#include "TreeElementLooter.h"
#include "ColorMap.h"
#include "MakePng.h"

using namespace std;

std::string RecordComposer::sfFileStoragePath = "../datacache";
std::string RecordComposer::sfUrlToFileStorage = "datacache";




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
  
  JsonArray arr;
  for(long i=0;i<nwires;i++) {
    // std::cout << "Doing wire " << i << std::endl;
    JsonObject wire;
    wire.add("view",ftr.getJson("recob::Wires_caldata__Reco.obj.fView",i));
    wire.add("signalType",ftr.getJson("recob::Wires_caldata__Reco.obj.fSignalType",i));
    wire.add("rdkey",ftr.getJson("recob::Wires_caldata__Reco.obj.fRawDigit.key_",i));

    // Get signal pointer.  This is ROOT magic crap I dont' understand, but it works. 
    // pointer = (char*)cont->At(i);
    // ladd = pointer+offset;
    // ptr = (std::vector<float> *)ladd;
    ptr = l.get<std::vector<float>>(i);
    // std::string signal("[");
    float max = 0;
    float min = 1;
    for(size_t k = 0; k<width; k++) {
      // convert to 8-bit value.
      // float o = 127. + ((*ptr)[k])*0.5; // 100 ADC -> grayscale of 177. Max at 255 is ADC=256, which covers a fair range. (About 2 MIP)
      // if(o<0) o=0;
      // if(o>255) o=255;
      // unsigned char c = (unsigned char)(floor(o));
      // imagedata[k]=c;

      /*
      float adc = (*ptr)[k];
      int iadc = (int)adc;
      // Scale up so it's an absolute number.
      int aadc = iacdc 0x8000;
      if(aadc<0) aadc = 0;
      if(aadc>0xFFFF) aadc = 0xFFFF;
      int high = aadc >> 8;
      int low  = aadc & 0xFF;

      int mid = iadc >> 3; + 0x80;  // Lose factor of 8 in resolution, factor of 8(?) in dynamic range as a tradeoff
      //Other way to do it: make a lookup table for true adc->mid and inverse lookup table for the client.
      if(mid > 0xFF) mid = 0xFF;
      if(mid < 0   ) mid = 0;
      */
      
      /*
      float adc = (*ptr)[k];
      int iadc = (int) adc;
      int aadc = abs(iadc);
      if (aadc>0xFFFF) aadc = 0xFFFF; // Shouldn't happen too often
      int low = aadc &0xFF;
      int high = (aadc >> 8)&0xFF;
      imagedata[k*3] = 0xFF-(unsigned char)low;
      imagedata[k*3+1] = 0xFF-(unsigned char)high;
      imagedata[k*3+2] =(iadc>0)?0xFF:0xFE;
      */
      
      //Color map.
      float adc = (*ptr)[k];
      // colormap.get(&imagedata[k*3],adc/4000.);
      imagedata[k] = tanscale(adc);
      
      // Save bitpacked data as image map.
      int fadc = adc + float(0x8000);
      int iadc = fadc;
      encodeddata[k*3]   = 0xFF&(iadc>>8);
      encodeddata[k*3+1] = iadc&0xFF;
      encodeddata[k*3+2] = (unsigned char)((fadc-float(iadc))*255);
      
      //hsvToRgb(&imagedata[k*3],h,1,1);
      
      // signal += Form("%.2f,",k);
    }
    // if (signal.size ()>0)  signal.erase(signal.size()-1,1); // Remove trailing comma.
    // signal += "]";
    // wire.add("signal",signal);
    png.AddRow(imagedata);
    encoded.AddRow(encodeddata);
    
    // This works, but is WAAYYYYYY TOO SLOW
    //    wire.add("signal",ftr.makeSimpleFArray(Form("recob::Wires_caldata__Reco.obj[%ld].fSignal",i)));
    arr.add(wire);
  }
  png.Finish();
  encoded.Finish();
  fOutput.add("wires",arr);

  
  fOutput.add("wireimg_url",sfUrlToFileStorage+
                            png.writeToUniqueFile(sfFileStoragePath)
                            );
  fOutput.add("wireimg_encoded_url",sfUrlToFileStorage+
                            encoded.writeToUniqueFile(sfFileStoragePath)
                            );
  
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
  fOutput.add("raw_wire_img_url",sfUrlToFileStorage+
                            png.writeToUniqueFile(sfFileStoragePath)
                            );
  fOutput.add("raw_wire_encoded_img_url",sfUrlToFileStorage+
                            epng.writeToUniqueFile(sfFileStoragePath)
                            );
  
}

void RecordComposer::compose()
{
  fOutput.add("converter","ComposeResult.cpp $Revision$ $Date$ ");

  // parse options.
  int doCalWires = 0;
  int doRaw = 1;
  if( std::string::npos != fOptions.find("_WIRES_")) doCalWires = 1;

  // Set branches to read here.
  fTree->SetBranchStatus("*",1);  // By default, read all.
  fTree->SetBranchStatus("raw::RawDigits*",1); // Don't know how to read these yet.
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
  if(doRaw) composeRaw();
  
  
  
}

